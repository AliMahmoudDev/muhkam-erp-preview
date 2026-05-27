/**
 * /api/super/billing — Subscription, trial, plan-settings and revenue routes.
 * Covers plan pricing, revenue dashboard, and trial-abuse analytics.
 */
import { Router } from "express";
import { eq, desc, sql, isNull, count } from "drizzle-orm";
import { db, companiesTable, planSettingsTable, trialAbuseLogTable } from "@workspace/db";
import { authenticate, requireRole } from "../../middleware/auth";
import { wrap } from "../../lib/async-handler";
import { writeAuditLog } from "../../lib/audit-log";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ══════════════════════════════════════════════════════════════════
   PLAN SETTINGS — GET & PUT (prices editable from super-admin UI)
   ══════════════════════════════════════════════════════════════════ */

const DEFAULT_PLANS = [
  { key: "trial",        name_ar: "تجريبية",           description: "فترة تجريبية مجانية",                   price: 0,    includes_mobile: false },
  { key: "basic",        name_ar: "أساسية",             description: "النظام الأساسي بدون تطبيق الموبايل",   price: 299,  includes_mobile: false },
  { key: "basic_mobile", name_ar: "أساسية + موبايل",   description: "النظام الأساسي مع تطبيق الموبايل",     price: 449,  includes_mobile: true  },
  { key: "advanced",     name_ar: "كاملة (Advanced)",   description: "النسخة الكاملة بجميع الميزات",         price: 699,  includes_mobile: true  },
];

export async function getPlanPricesMap(): Promise<Record<string, number>> {
  const rows = await db.select().from(planSettingsTable);
  if (rows.length === 0) {
    await db.insert(planSettingsTable).values(DEFAULT_PLANS).onConflictDoNothing();
    return Object.fromEntries(DEFAULT_PLANS.map(p => [p.key, p.price]));
  }
  return Object.fromEntries(rows.map(r => [r.key, r.price]));
}

router.get("/super/plan-settings", ...superOnly, wrap(async (_req, res) => {
  let rows = await db.select().from(planSettingsTable).orderBy(planSettingsTable.id);
  if (rows.length === 0) {
    await db.insert(planSettingsTable).values(DEFAULT_PLANS).onConflictDoNothing();
    rows = await db.select().from(planSettingsTable).orderBy(planSettingsTable.id);
  }
  res.json(rows);
}));

router.put("/super/plan-settings/:key", ...superOnly, wrap(async (req, res) => {
  const key = String(req.params['key']);
  const { name_ar, description, price, includes_mobile, is_active } = req.body as {
    name_ar?: string; description?: string; price?: number;
    includes_mobile?: boolean; is_active?: boolean;
  };

  if (price !== undefined && (typeof price !== "number" || price < 0)) {
    res.status(400).json({ error: "السعر يجب أن يكون رقماً موجباً" }); return;
  }

  const updates: Partial<typeof planSettingsTable.$inferInsert> = { updated_at: new Date() };
  if (name_ar        !== undefined) updates.name_ar        = name_ar;
  if (description    !== undefined) updates.description    = description;
  if (price          !== undefined) updates.price          = price;
  if (includes_mobile !== undefined) updates.includes_mobile = includes_mobile;
  if (is_active      !== undefined) updates.is_active      = is_active;

  const existing = await db.select().from(planSettingsTable).where(eq(planSettingsTable.key, key));
  let row;
  if (existing.length === 0) {
    [row] = await db.insert(planSettingsTable)
      .values({ key, name_ar: name_ar ?? key, price: price ?? 0, ...updates })
      .returning();
  } else {
    [row] = await db.update(planSettingsTable).set(updates)
      .where(eq(planSettingsTable.key, key)).returning();
  }

  void writeAuditLog({
    action: "PLAN_SETTINGS_UPDATED", record_type: "system", record_id: 0,
    old_value: existing[0] ? { key, price: existing[0].price, is_active: existing[0].is_active } : null,
    new_value: { key, price: row.price, name_ar: row.name_ar, is_active: row.is_active },
    user: req.user, company_id: null,
    note: `تحديث إعدادات خطة: ${key} — السعر: ${row.price}`,
  });
  res.json(row);
}));

/* ══════════════════════════════════════════════════════════════════
   Revenue Dashboard
   GET /super/revenue — MRR, plan breakdown, monthly revenue trends
   ══════════════════════════════════════════════════════════════════ */

router.get("/super/revenue", ...superOnly, wrap(async (_req, res) => {
  const [companies, planPrices] = await Promise.all([
    db.select().from(companiesTable),
    getPlanPricesMap(),
  ]);
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  const activeCompanies = companies.filter(c => c.is_active && c.end_date >= nowStr);

  const mrr = activeCompanies.reduce((sum, c) => sum + (planPrices[c.plan_type] ?? 0), 0);
  const arr  = mrr * 12;

  const planBreakdown = Object.entries(planPrices).map(([plan, price]) => ({
    plan,
    price,
    count:   activeCompanies.filter(c => c.plan_type === plan).length,
    revenue: activeCompanies.filter(c => c.plan_type === plan).length * price,
  }));

  const monthlyRevenue: { month: string; revenue: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    const activeInMonth = companies.filter(c => {
      const start = new Date(c.start_date);
      const end   = new Date(c.end_date);
      const monthStart = new Date(y, m, 1);
      const monthEnd   = new Date(y, m + 1, 0);
      return c.is_active && start <= monthEnd && end >= monthStart;
    });
    const revenue = activeInMonth.reduce((sum, c) => sum + (planPrices[c.plan_type] ?? 0), 0);
    monthlyRevenue.push({ month: label, revenue, count: activeInMonth.length });
  }

  const totalTrialEver = companies.filter(c => c.plan_type === "trial").length;
  const totalPaidEver  = companies.filter(c => c.plan_type !== "trial").length;
  const conversionRate = companies.length > 0
    ? Math.round((totalPaidEver / companies.length) * 100)
    : 0;

  const arpu = activeCompanies.length > 0
    ? Math.round(mrr / activeCompanies.length)
    : 0;

  res.json({
    mrr, arr, arpu, conversionRate,
    activeCompanies: activeCompanies.length,
    trialCompanies:  activeCompanies.filter(c => c.plan_type === "trial").length,
    paidCompanies:   activeCompanies.filter(c => c.plan_type !== "trial").length,
    planBreakdown,
    monthlyRevenue,
    totalPaidEver, totalTrialEver,
  });
}));

/* ═══════════════════════════════════════════════════════════════════════════
 * TRIAL ABUSE ANALYTICS
 * GET /super/trial-abuse-stats
 * ═══════════════════════════════════════════════════════════════════════════ */

router.get("/super/trial-abuse-stats", ...superOnly, wrap(async (_req, res) => {
  const nowStr = new Date().toISOString().slice(0, 10);

  const allTrials = await db
    .select({
      id:                  companiesTable.id,
      name:                companiesTable.name,
      admin_email:         companiesTable.admin_email,
      signup_ip:           companiesTable.signup_ip,
      plan_type:           companiesTable.plan_type,
      is_active:           companiesTable.is_active,
      is_suspicious:       companiesTable.is_suspicious,
      trial_score:         companiesTable.trial_score,
      email_verified:      companiesTable.email_verified,
      verification_status: companiesTable.verification_status,
      end_date:            companiesTable.end_date,
      created_at:          companiesTable.created_at,
    })
    .from(companiesTable)
    .where(eq(companiesTable.has_used_trial, true))
    .orderBy(desc(companiesTable.created_at));

  const ipMap = new Map<string, number>();
  for (const c of allTrials) {
    if (c.signup_ip) ipMap.set(c.signup_ip, (ipMap.get(c.signup_ip) ?? 0) + 1);
  }
  const topIPs = Array.from(ipMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  const suspicious = allTrials
    .filter(c => c.is_suspicious)
    .map(c => ({
      id: c.id, name: c.name, email: c.admin_email,
      trial_score: c.trial_score, signup_ip: c.signup_ip,
      created_at: c.created_at,
    }));

  const unverified = allTrials
    .filter(c => !c.email_verified && c.verification_status !== "verified")
    .map(c => ({
      id: c.id, name: c.name, email: c.admin_email,
      verification_status: c.verification_status, created_at: c.created_at,
    }));

  const soon = new Date();
  soon.setDate(soon.getDate() + 2);
  const soonStr = soon.toISOString().slice(0, 10);
  const expiringSoon = allTrials.filter(
    c => c.plan_type === "trial" && c.is_active && c.end_date >= nowStr && c.end_date <= soonStr
  ).map(c => ({ id: c.id, name: c.name, email: c.admin_email, end_date: c.end_date }));

  const totalTrials  = allTrials.length;
  const converted    = allTrials.filter(c => c.plan_type !== "trial").length;
  const conversionRate = totalTrials > 0 ? Math.round((converted / totalTrials) * 100) : 0;

  res.json({
    top_ips:         topIPs,
    suspicious,
    unverified,
    expiring_soon:   expiringSoon,
    total_trials:    totalTrials,
    converted,
    conversion_rate: `${conversionRate}%`,
    generated_at:    new Date().toISOString(),
  });
}));

/* ── GET /super/trial-abuse — list all trial abuse log entries ── */
router.get("/super/trial-abuse", ...superOnly, wrap(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page  ?? 1));
  const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(trialAbuseLogTable)
    .orderBy(desc(trialAbuseLogTable.created_at))
    .limit(limit)
    .offset(offset);

  const ipCounts = await db
    .select({
      ip:    trialAbuseLogTable.ip,
      total: count(),
    })
    .from(trialAbuseLogTable)
    .where(isNull(trialAbuseLogTable.override_reason))
    .groupBy(trialAbuseLogTable.ip)
    .orderBy(desc(count()));

  res.json({ rows, ip_counts: ipCounts, page, limit });
}));

/* ── POST /super/trial-abuse/:id/override — grant override for a log row ── */
router.post("/super/trial-abuse/:id/override", ...superOnly, wrap(async (req, res) => {
  const id     = parseInt(req.params.id as string);
  const { reason } = req.body as { reason?: string };

  if (!id || isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صالح" });
    return;
  }
  if (!reason?.trim()) {
    res.status(400).json({ error: "سبب التجاوز مطلوب" });
    return;
  }

  const [updated] = await db
    .update(trialAbuseLogTable)
    .set({
      override_reason: reason.trim(),
      overridden_by:   req.user?.username ?? "super_admin",
    })
    .where(eq(trialAbuseLogTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "السجل غير موجود" });
    return;
  }

  res.json({ success: true, row: updated });
}));

/* ── DELETE /super/trial-abuse/:id/override — revoke an override ── */
router.delete("/super/trial-abuse/:id/override", ...superOnly, wrap(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صالح" });
    return;
  }

  const [updated] = await db
    .update(trialAbuseLogTable)
    .set({ override_reason: null, overridden_by: null })
    .where(eq(trialAbuseLogTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "السجل غير موجود" });
    return;
  }

  res.json({ success: true, row: updated });
}));

/* ── GET /super/trial-abuse/lookup — look up DB entries for an IP or email ── */
router.get("/super/trial-abuse/lookup", ...superOnly, wrap(async (req, res) => {
  const ip    = String(req.query.ip    ?? "").trim().toLowerCase();
  const email = String(req.query.email ?? "").trim().toLowerCase();

  if (!ip && !email) {
    res.status(400).json({ error: "ip أو email مطلوب" });
    return;
  }

  const conditions = [];
  if (ip)    conditions.push(eq(trialAbuseLogTable.ip, ip));
  if (email) conditions.push(eq(trialAbuseLogTable.email, email));

  const rows = await db
    .select()
    .from(trialAbuseLogTable)
    .where(conditions.length === 1 ? conditions[0] : sql`(${trialAbuseLogTable.ip} = ${ip} OR ${trialAbuseLogTable.email} = ${email})`)
    .orderBy(desc(trialAbuseLogTable.created_at))
    .limit(50);

  const activeBlocks     = rows.filter(r => r.override_reason === null).length;
  const overriddenBlocks = rows.filter(r => r.override_reason !== null).length;

  res.json({ rows, active_blocks: activeBlocks, overridden_blocks: overriddenBlocks });
}));

/* ── POST /super/trial-abuse/bulk-override — override all entries for an IP or email ── */
router.post("/super/trial-abuse/bulk-override", ...superOnly, wrap(async (req, res) => {
  const { ip, email, reason } = req.body as { ip?: string; email?: string; reason?: string };

  if (!ip && !email) {
    res.status(400).json({ error: "ip أو email مطلوب" });
    return;
  }
  if (!reason?.trim()) {
    res.status(400).json({ error: "سبب التجاوز مطلوب" });
    return;
  }

  const normalIP    = ip    ? ip.trim().toLowerCase()    : undefined;
  const normalEmail = email ? email.trim().toLowerCase() : undefined;

  if (!normalIP && !normalEmail) {
    res.status(400).json({ error: "يجب تحديد IP أو البريد الإلكتروني" });
    return;
  }

  const whereClause = normalIP && normalEmail
    ? sql`(${trialAbuseLogTable.ip} = ${normalIP} OR ${trialAbuseLogTable.email} = ${normalEmail})`
    : normalIP
      ? eq(trialAbuseLogTable.ip, normalIP)
      : eq(trialAbuseLogTable.email, normalEmail as string);

  const updated = await db
    .update(trialAbuseLogTable)
    .set({
      override_reason: reason.trim(),
      overridden_by:   req.user?.username ?? "super_admin",
    })
    .where(sql`(${whereClause}) AND ${trialAbuseLogTable.override_reason} IS NULL`)
    .returning({ id: trialAbuseLogTable.id });

  res.json({ success: true, overridden_count: updated.length });
}));

export default router;
