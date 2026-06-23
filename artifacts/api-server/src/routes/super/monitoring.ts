/**
 * /api/super/monitoring — Health, audit log, alerts, announcements, and export routes.
 * Covers server health, Redis status, super-admin audit trail,
 * smart alert center, company CSV export, and announcement CRUD.
 */
import { Router } from "express";
import { eq, desc, sql, type SQL } from "drizzle-orm";
import { db, companiesTable, erpUsersTable } from "@workspace/db";
import { authenticate, requireRole } from "../../middleware/auth";
import { wrap } from "../../lib/async-handler";
import { writeAuditLog } from "../../lib/audit-log";
import { getPlanPricesMap } from "./billing";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ── GET /super/audit-log — forensic trail of super-admin actions ── */
router.get("/super/audit-log", ...superOnly, wrap(async (req, res) => {
  const { auditLogsTable } = await import("@workspace/db");
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
  const action = req.query.action ? String(req.query.action) : null;
  const recordType = req.query.record_type ? String(req.query.record_type) : null;

  const conditions: SQL[] = [sql`${auditLogsTable.company_id} IS NULL`];
  if (action)     conditions.push(eq(auditLogsTable.action, action));
  if (recordType) conditions.push(eq(auditLogsTable.record_type, recordType));

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(sql.join(conditions, sql` AND `))
    .orderBy(desc(auditLogsTable.created_at))
    .limit(limit);

  res.json({ count: rows.length, rows });
}));

/* ══════════════════════════════════════════════════════════════════
   Smart Alerts Center
   GET /super/alerts — expiring, inactive, system issues
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/alerts", ...superOnly, wrap(async (_req, res) => {
  const companies = await db.select().from(companiesTable);
  const now    = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  const alerts: {
    type: "warning" | "danger" | "info" | "success";
    category: string;
    title: string;
    body: string;
    company_id?: number;
    company_name?: string;
    days?: number;
  }[] = [];

  const in3 = new Date(now); in3.setDate(in3.getDate() + 3);
  const in3Str = in3.toISOString().slice(0, 10);
  companies
    .filter(c => c.is_active && c.end_date >= nowStr && c.end_date <= in3Str)
    .forEach(c => {
      const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
      alerts.push({
        type: "danger", category: "expiry",
        title: `⚠️ ينتهي الاشتراك خلال ${days} ${days === 1 ? "يوم" : "أيام"}`,
        body: `شركة "${c.name}" — خطة ${c.plan_type} — تنتهي في ${c.end_date}`,
        company_id: c.id, company_name: c.name, days,
      });
    });

  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  companies
    .filter(c => c.is_active && c.end_date > in3Str && c.end_date <= in7Str)
    .forEach(c => {
      const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
      alerts.push({
        type: "warning", category: "expiry",
        title: `🔔 ينتهي الاشتراك قريباً (${days} أيام)`,
        body: `شركة "${c.name}" — خطة ${c.plan_type} — تنتهي في ${c.end_date}`,
        company_id: c.id, company_name: c.name, days,
      });
    });

  companies
    .filter(c => c.is_active && c.end_date < nowStr)
    .forEach(c => {
      alerts.push({
        type: "danger", category: "expired",
        title: "⛔ اشتراك منتهي (الحساب لا يزال نشطاً!)",
        body: `شركة "${c.name}" — انتهى في ${c.end_date} — يجب تعليقه أو تجديده`,
        company_id: c.id, company_name: c.name,
      });
    });

  const ago7 = new Date(now); ago7.setDate(ago7.getDate() - 7);
  const newThisWeek = companies.filter(c => new Date(c.created_at) >= ago7);
  if (newThisWeek.length > 0) {
    alerts.push({
      type: "success", category: "signup",
      title: `🎉 ${newThisWeek.length} شركة جديدة هذا الأسبوع`,
      body: newThisWeek.map(c => c.name).join("، "),
    });
  }

  const trialCount = companies.filter(c => c.plan_type === "trial" && c.is_active && c.end_date >= nowStr).length;
  const paidCount  = companies.filter(c => c.plan_type !== "trial" && c.is_active && c.end_date >= nowStr).length;
  if (trialCount > paidCount && trialCount > 2) {
    alerts.push({
      type: "warning", category: "conversion",
      title: "📊 معدل تحويل منخفض",
      body: `${trialCount} شركة تجريبية مقابل ${paidCount} مدفوعة — حاول التواصل معهم لتحويلهم`,
    });
  }

  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  if (mem > 400) {
    alerts.push({
      type: "warning", category: "system",
      title: "💾 استهلاك ذاكرة مرتفع",
      body: `الخادم يستخدم ${mem} MB من الذاكرة — راقب الوضع`,
    });
  }

  const critical   = alerts.filter(a => a.type === "danger").length;
  const warnings   = alerts.filter(a => a.type === "warning").length;
  const info_count = alerts.filter(a => a.type === "info").length;
  const successes  = alerts.filter(a => a.type === "success").length;

  res.json({ alerts, summary: { critical, warnings, info: info_count, successes, total: alerts.length } });
}));

/* ══════════════════════════════════════════════════════════════════
   Export Companies as CSV
   GET /super/export/companies — download companies list as CSV
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/export/companies", ...superOnly, wrap(async (_req, res) => {
  const [companies, planPricesEx] = await Promise.all([
    db.select().from(companiesTable),
    getPlanPricesMap(),
  ]);
  const users = await db
    .select({ id: erpUsersTable.id, company_id: erpUsersTable.company_id })
    .from(erpUsersTable)
    .where(sql`${erpUsersTable.role} != 'super_admin'`);

  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const userCountByCompany: Record<number, number> = {};
  for (const u of users) {
    if (u.company_id) userCountByCompany[u.company_id] = (userCountByCompany[u.company_id] ?? 0) + 1;
  }

  const header = "الرقم,اسم الشركة,نوع الخطة,تاريخ البداية,تاريخ الانتهاء,الحالة,عدد المستخدمين,الإيراد الشهري (ج.م.),تاريخ التسجيل";
  const rows = companies.map(c => {
    const status = !c.is_active ? "موقوف" : c.end_date < nowStr ? "منتهي" : c.plan_type === "trial" ? "تجريبي" : "نشط";
    const revenue = planPricesEx[c.plan_type] ?? 0;
    const userCount = userCountByCompany[c.id] ?? 0;
    return [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.plan_type,
      c.start_date,
      c.end_date,
      status,
      userCount,
      revenue,
      new Date(c.created_at).toLocaleDateString("ar-EG"),
    ].join(",");
  });

  const csv = "\uFEFF" + header + "\n" + rows.join("\n");
  const filename = `muhkam-companies-${nowStr}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}));

/* ══════════════════════════════════════════════════════════════════
   Announcements / Notifications
   CRUD: GET / POST / PATCH /:id / DELETE /:id
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/announcements", ...superOnly, wrap(async (_req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const rows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.created_at));
  res.json({ announcements: rows, total: rows.length });
}));

router.post("/super/announcements", ...superOnly, wrap(async (req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const { title, body, type = "info", target = "all", company_id, expires_at } = req.body as {
    title: string; body: string; type?: string; target?: string;
    company_id?: number; expires_at?: string;
  };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "العنوان والنص مطلوبان" });
    return;
  }
  const [row] = await db.insert(announcementsTable).values({
    title: title.trim(),
    body: body.trim(),
    type,
    target: target ?? (company_id ? String(company_id) : "all"),
    company_id: company_id ?? null,
    is_active: true,
    created_by: (req.user as unknown as Record<string, unknown>)?.username as string ?? "super_admin",
    expires_at: expires_at ? new Date(expires_at) : null,
  }).returning();
  void writeAuditLog({
    action: "create", record_type: "announcement", record_id: row.id,
    user: req.user, company_id: null, note: `إشعار جديد: ${title}`,
  });
  res.status(201).json(row);
}));

router.patch("/super/announcements/:id", ...superOnly, wrap(async (req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const id = Number(req.params.id);
  const updates: Partial<{ title: string; body: string; type: string; is_active: boolean; expires_at: Date | null }> = {};
  if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
  if (req.body.body  !== undefined) updates.body  = String(req.body.body).trim();
  if (req.body.type  !== undefined) updates.type  = String(req.body.type);
  if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
  if (req.body.expires_at !== undefined) updates.expires_at = req.body.expires_at ? new Date(req.body.expires_at) : null;
  const [row] = await db.update(announcementsTable).set(updates).where(eq(announcementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "الإشعار غير موجود" }); return; }
  res.json(row);
}));

router.delete("/super/announcements/:id", ...superOnly, wrap(async (req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const id = Number(req.params.id);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  void writeAuditLog({
    action: "delete", record_type: "announcement", record_id: id,
    user: req.user, company_id: null, note: `حذف إشعار رقم ${id}`,
  });
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════
   Server Health & Metrics
   GET /super/health — deep health + request metrics + DB pool stats
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/health", ...superOnly, wrap(async (_req, res) => {
  const { checkDeepHealth } = await import("../../lib/monitor");
  const { getMetrics }      = await import("../../lib/request-counter");
  const { pool }            = await import("@workspace/db");

  const [health, metrics] = await Promise.all([
    checkDeepHealth(),
    Promise.resolve(getMetrics()),
  ]);

  const poolStats = {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
  };

  const mem = process.memoryUsage();

  res.json({
    health,
    metrics,
    pool: poolStats,
    memory: {
      heap_used_mb:  Math.round(mem.heapUsed  / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb:        Math.round(mem.rss       / 1024 / 1024),
      external_mb:   Math.round(mem.external  / 1024 / 1024),
    },
    process: {
      uptime_hours: Math.round(process.uptime() / 3600 * 10) / 10,
      node_version: process.version,
      pid:          process.pid,
      env:          process.env.NODE_ENV ?? "development",
    },
    timestamp: new Date().toISOString(),
  });
}));

/* ── GET /super/health/redis — ping Redis and measure latency ── */
router.get("/super/health/redis", ...superOnly, wrap(async (_req, res) => {
  try {
    const { trialRedis } = await import("../../lib/redis");
    const t0 = Date.now();
    await trialRedis.ping();
    const latency_ms = Date.now() - t0;
    res.json({ status: "ok", latency_ms });
  } catch (err) {
    res.status(503).json({ status: "down", message: "Redis is not reachable" });
  }
}));

export default router;
