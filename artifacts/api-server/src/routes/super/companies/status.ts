/**
 * /api/super/companies/:id — Status management routes
 * (activate, suspend, extend, verify-email).
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { authenticate, requireRole } from "../../../middleware/auth";
import { wrap } from "../../../lib/async-handler";
import { writeAuditLog } from "../../../lib/audit-log";
import { daysRemaining } from "./helpers";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ── POST /super/companies/:id/activate — activate a company ── */
router.post("/super/companies/:id/activate", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(companiesTable)
    .set({ is_active: true })
    .where(eq(companiesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  await writeAuditLog({
    action: "COMPANY_ACTIVATED", record_type: "company", record_id: id,
    new_value: { is_active: true },
    user: req.user, company_id: req.user?.company_id ?? null,
  });

  res.json({ message: "تم تفعيل الشركة", company: updated });
}));

/* ── POST /super/companies/:id/suspend — suspend a company ── */
router.post("/super/companies/:id/suspend", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(companiesTable)
    .set({ is_active: false })
    .where(eq(companiesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  await writeAuditLog({
    action: "COMPANY_SUSPENDED", record_type: "company", record_id: id,
    new_value: { is_active: false },
    user: req.user, company_id: req.user?.company_id ?? null,
  });

  res.json({ message: "تم إيقاف الشركة", company: updated });
}));

/* ── POST /super/companies/:id/extend — extend trial / subscription ── */
router.post("/super/companies/:id/extend", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { days = 7, plan_type } = req.body as { days?: number; plan_type?: string };

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const base = new Date(co.end_date) < new Date() ? new Date() : new Date(co.end_date);
  base.setDate(base.getDate() + Number(days));
  const newEndDate = base.toISOString().slice(0, 10);

  const updates: Partial<typeof companiesTable.$inferInsert> = { end_date: newEndDate, is_active: true };
  if (plan_type) updates.plan_type = plan_type;

  const [updated] = await db
    .update(companiesTable).set(updates)
    .where(eq(companiesTable.id, id)).returning();

  await writeAuditLog({
    action: "COMPANY_EXTENDED", record_type: "subscription", record_id: id,
    old_value: { end_date: co.end_date, plan_type: co.plan_type, is_active: co.is_active },
    new_value: { end_date: newEndDate, plan_type: updates.plan_type ?? co.plan_type, is_active: true, days_added: Number(days) },
    user: req.user, company_id: req.user?.company_id ?? null,
    note: `تمديد الاشتراك ${days} يوم`,
  });

  res.json({ message: `تم تمديد الاشتراك ${days} يوم`, company: { ...updated, daysRemaining: daysRemaining(newEndDate) } });
}));

/* ── POST /super/companies/:id/verify-email — manually mark email verified ─ */
router.post("/super/companies/:id/verify-email", ...superOnly, wrap(async (req, res) => {
  const cid = parseInt(req.params.id as string);
  if (!cid || isNaN(cid)) {
    res.status(400).json({ error: "معرّف غير صالح" });
    return;
  }

  const [updated] = await db
    .update(companiesTable)
    .set({
      email_verified:                true,
      email_verification_token:      null,
      email_verification_expires_at: null,
    })
    .where(eq(companiesTable.id, cid))
    .returning({ id: companiesTable.id, email_verified: companiesTable.email_verified });

  if (!updated) {
    res.status(404).json({ error: "الشركة غير موجودة" });
    return;
  }

  res.json({ success: true, company: updated });
}));

export default router;
