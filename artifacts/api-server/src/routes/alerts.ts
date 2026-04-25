import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, alertsTable, systemSettingsTable } from "@workspace/db";
import { runDailyChecks, runAllChecks, resolveAlert } from "../lib/alert-service";
import { wrap } from "../lib/async-handler";
import { getTenant } from "../middleware/auth";

const router = Router();

function isVisibleTo(roleTarget: string | null, userRole: string): boolean {
  if (!roleTarget) return true;
  return roleTarget.split(",").map(r => r.trim()).includes(userRole);
}

router.get("/alerts", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const userRole  = req.user?.role ?? "cashier";
  const includeResolved = req.query.include_resolved === "true";

  const rows = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.company_id, companyId))
    .orderBy(desc(alertsTable.created_at))
    .limit(200);

  const visible = rows.filter(a => {
    if (!isVisibleTo(a.role_target, userRole)) return false;
    if (!includeResolved && a.is_resolved) return false;
    return true;
  });

  res.json(visible);
}));

router.get("/alerts/settings", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(and(eq(systemSettingsTable.company_id, companyId), eq(systemSettingsTable.key, "enable_event_alerts")));
  const rows2 = await db
    .select()
    .from(systemSettingsTable)
    .where(and(eq(systemSettingsTable.company_id, companyId), eq(systemSettingsTable.key, "enable_daily_alerts")));
  const map = Object.fromEntries([...rows, ...rows2].map(r => [r.key, r.value]));
  res.json({
    enable_event_alerts: map["enable_event_alerts"] !== "false",
    enable_daily_alerts: map["enable_daily_alerts"] !== "false",
  });
}));

router.post("/alerts/settings", wrap(async (req, res) => {
  const body      = req.body as Record<string, boolean>;
  const companyId = getTenant(req);

  async function upsertAlertSetting(key: string, value: string) {
    await db
      .insert(systemSettingsTable)
      .values({ key, company_id: companyId, value })
      .onConflictDoUpdate({
        target: [systemSettingsTable.key, systemSettingsTable.company_id],
        set:    { value, updated_at: new Date() },
      });
  }

  if (body.enable_event_alerts !== undefined)
    await upsertAlertSetting("enable_event_alerts", String(body.enable_event_alerts));
  if (body.enable_daily_alerts !== undefined)
    await upsertAlertSetting("enable_daily_alerts", String(body.enable_daily_alerts));

  res.json({ ok: true });
}));

router.post("/alerts/daily-check", wrap(async (_req, res) => {
  await runDailyChecks();
  res.json({ ok: true, message: "تم تشغيل الفحص اليومي" });
}));

router.post("/alerts/run-checks", wrap(async (_req, res) => {
  await runAllChecks();
  res.json({ ok: true, message: "تم تشغيل الفحوصات بنجاح" });
}));

router.post("/alerts/resolve/:id", wrap(async (req, res) => {
  const id        = parseInt(String(req.params['id']), 10);
  const userId    = req.user?.id ?? 0;
  const companyId = getTenant(req);
  await resolveAlert(id, userId, companyId);
  res.json({ ok: true });
}));

router.post("/alerts/mark-read/:id", wrap(async (req, res) => {
  const id        = parseInt(String(req.params['id']), 10);
  const companyId = getTenant(req);
  await db.update(alertsTable).set({ is_read: true })
    .where(and(eq(alertsTable.id, id), eq(alertsTable.company_id, companyId)));
  res.json({ ok: true });
}));

router.post("/alerts/mark-all-read", wrap(async (req, res) => {
  const companyId = getTenant(req);
  await db.update(alertsTable).set({ is_read: true })
    .where(and(eq(alertsTable.is_read, false), eq(alertsTable.company_id, companyId)));
  res.json({ ok: true });
}));

export default router;
