import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { authenticate, requireRole, getTenant } from "../../middleware/auth";
import { z } from "zod/v4";
import { firstZodError } from "../../lib/schemas";
import { wrap } from "../../lib/async-handler";
import { systemSettingsTable } from "@workspace/db";
import { invalidateClosingDateCache } from "../../lib/period-lock";
import { writeAuditLog } from "../../lib/audit-log";

const periodSchema = z.object({
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  unlock_reason: z.string().optional().nullable(),
  lock_mode: z.string().optional().nullable(),
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function upsertSetting(key: string, value: string | null, companyId: number) {
  if (!companyId || companyId <= 0) throw Object.assign(new Error("upsertSetting: companyId required"), { status: 403 });
  if (value === null) {
    await db.delete(systemSettingsTable)
      .where(and(eq(systemSettingsTable.key, key), eq(systemSettingsTable.company_id, companyId)));
  } else {
    await db.insert(systemSettingsTable)
      .values({ key, company_id: companyId, value })
      .onConflictDoUpdate({
        target: [systemSettingsTable.key, systemSettingsTable.company_id],
        set:    { value, updated_at: new Date() },
      });
  }
}

async function readSettings(keys: string[], companyId: number): Promise<Record<string, string | null>> {
  if (!companyId || companyId <= 0) throw Object.assign(new Error("readSettings: companyId required"), { status: 403 });
  const rows = await db.select().from(systemSettingsTable)
    .where(eq(systemSettingsTable.company_id, companyId));
  const map: Record<string, string | null> = {};
  // eslint-disable-next-line security/detect-object-injection
  for (const k of keys) map[k] = null;
  for (const r of rows) if (keys.includes(r.key)) map[r.key] = r.value ?? null;
  return map;
}

const router = Router();

// ─── PERIOD LOCK ──────────────────────────────────────────────────────────────

router.get("/settings/period", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const s = await readSettings(["closing_date", "lock_locked_by", "lock_locked_at", "lock_mode"], companyId);
  res.json({
    closing_date: s["closing_date"],
    locked_by:    s["lock_locked_by"],
    locked_at:    s["lock_locked_at"],
    lock_mode:    s["lock_mode"] ?? "manual",
    is_locked:    !!s["closing_date"],
  });
}));

router.put("/settings/period", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const parsedPeriod = periodSchema.safeParse(req.body);
  if (!parsedPeriod.success) { res.status(400).json({ error: firstZodError(parsedPeriod.error) }); return; }
  const { closing_date, unlock_reason, lock_mode } = parsedPeriod.data;
  const username  = req.user?.username  ?? "مجهول";
  const userId    = req.user?.id        ?? null;
  const companyId = getTenant(req);

  if (closing_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closing_date)) {
      res.status(400).json({ error: "تنسيق التاريخ غير صحيح — استخدم YYYY-MM-DD" }); return;
    }
    await upsertSetting("closing_date",   closing_date,                companyId);
    await upsertSetting("lock_locked_by", username,                    companyId);
    await upsertSetting("lock_locked_at", new Date().toISOString(),    companyId);
    await upsertSetting("lock_mode",      lock_mode ?? "manual",       companyId);

    await writeAuditLog({
      action: "lock_period",
      record_type: "financial_lock",
      record_id: 0,
      new_value: { closing_date, locked_by: username, lock_mode: lock_mode ?? "manual" },
      user: { id: userId ?? undefined, username },
    });
  } else {
    if (!unlock_reason || String(unlock_reason).trim().length < 3) {
      res.status(400).json({ error: "يجب إدخال سبب فتح الفترة (3 أحرف على الأقل)" }); return;
    }
    const prev = await readSettings(["closing_date", "lock_locked_by"], companyId);
    await upsertSetting("closing_date",   null, companyId);
    await upsertSetting("lock_locked_by", null, companyId);
    await upsertSetting("lock_locked_at", null, companyId);
    await upsertSetting("lock_mode",      null, companyId);

    await writeAuditLog({
      action: "unlock_period",
      record_type: "financial_lock",
      record_id: 0,
      old_value: { closing_date: prev["closing_date"], locked_by: prev["lock_locked_by"] },
      new_value: { unlock_reason, unlocked_by: username },
      user: { id: userId ?? undefined, username },
    });
  }

  invalidateClosingDateCache(companyId);
  const updated = await readSettings(["closing_date", "lock_locked_by", "lock_locked_at", "lock_mode"], companyId);
  res.json({
    closing_date: updated["closing_date"],
    locked_by:    updated["lock_locked_by"],
    locked_at:    updated["lock_locked_at"],
    lock_mode:    updated["lock_mode"] ?? "manual",
    is_locked:    !!updated["closing_date"],
  });
}));

export default router;
