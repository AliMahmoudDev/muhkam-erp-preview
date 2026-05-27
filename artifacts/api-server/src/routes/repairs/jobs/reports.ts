/**
 * Repair stats and report routes:
 *   GET /repair-jobs/stats
 *   GET /repair-jobs/alerts
 *   GET /repair-jobs/technicians
 *   GET /repair-jobs/technician-stats
 *   GET /repair-jobs/reports/technicians
 *   GET /repair-jobs/reports/revenue
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairJobPartsTable,
  repairStatusesTable,
  erpUsersTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { ctx, ensureCompanyDefaults } from "../_shared";
import { getTenant } from "../../../middleware/auth";

const router: IRouter = Router();

/* Stats by status (with colors) for dashboard cards */
router.get("/repair-jobs/stats", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض إحصاءات الصيانة" });
  }
  const { company_id } = ctx(req);
  await ensureCompanyDefaults(company_id);

  const rows = await db.select({
    status: repairJobsTable.status,
    count: sql<number>`count(*)`,
  }).from(repairJobsTable)
    .where(eq(repairJobsTable.company_id, company_id))
    .groupBy(repairJobsTable.status);

  const statusDefs = await db.select().from(repairStatusesTable)
    .where(eq(repairStatusesTable.company_id, company_id))
    .orderBy(repairStatusesTable.sort_order);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.count);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayJobs = await db.select({ count: sql<number>`count(*)` })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.created_at} >= ${today.toISOString()}`
    ));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return res.json({
    total,
    today_count: Number(todayJobs[0]?.count ?? 0),
    pending:     counts["pending"] ?? 0,
    in_progress: counts["in_progress"] ?? 0,
    done:        counts["done"] ?? 0,
    delivered:   counts["delivered"] ?? 0,
    cancelled:   counts["cancelled"] ?? 0,
    by_status: statusDefs.map(s => ({
      key: s.key,
      label: s.label_ar,
      color: s.color,
      count: counts[s.key] ?? 0,
    })),
  });
}));

/* Long-stay alerts */
router.get("/repair-jobs/alerts", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const days = Number(req.query.days ?? 7);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const rows = await db.select().from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      sql`${repairJobsTable.status} NOT IN ('delivered','cancelled')`,
      sql`${repairJobsTable.received_at} <= ${cutoff.toISOString().slice(0,10)}`
    ))
    .orderBy(repairJobsTable.received_at)
    .limit(200);
  return res.json(rows);
}));

/* Technicians list — kept for backward compat */
router.get("/repair-jobs/technicians", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح" });
  }
  const { company_id } = ctx(req);
  const users = await db.select({ id: erpUsersTable.id, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, company_id));
  return res.json(users);
}));

/* Technician performance stats — must be before /repair-jobs/:id */
router.get("/repair-jobs/technician-stats", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض إحصاءات الفنيين" });
  }
  const { company_id } = ctx(req);

  const rows = await db.execute(sql`
    SELECT
      u.id          AS technician_id,
      u.name        AS technician_name,
      COUNT(j.id)::int                                              AS total_jobs,
      COUNT(j.id) FILTER (WHERE j.status = 'delivered')::int         AS delivered,
      COUNT(j.id) FILTER (WHERE j.status NOT IN ('delivered','cancelled','rejected'))::int AS active_jobs,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (j.delivered_at::timestamp - j.received_at::timestamp)) / 86400.0
      ) FILTER (WHERE j.delivered_at IS NOT NULL), 2)::float        AS avg_duration_days
    FROM erp_users u
    LEFT JOIN repair_jobs j
      ON j.company_id = u.company_id
     AND (j.technician_id = u.id OR j.technician_2_id = u.id)
    WHERE u.company_id = ${company_id}
    GROUP BY u.id, u.name
    HAVING COUNT(j.id) > 0
    ORDER BY total_jobs DESC, u.name ASC
  `);

  const list = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows ?? [];
  return res.json(list);
}));

/* GET /repair-jobs/reports/technicians */
router.get("/repair-jobs/reports/technicians", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    res.status(403).json({ error: "غير مصرح بعرض تقارير الفنيين" }); return;
  }
  const companyId = getTenant(req);
  const { from, to } = req.query as { from?: string; to?: string };

  const conditions = [eq(repairJobsTable.company_id, companyId)];
  if (from) conditions.push(sql`${repairJobsTable.received_at} >= ${from}`);
  if (to)   conditions.push(sql`${repairJobsTable.received_at} <= ${to}`);

  const rows = await db.select({
    technician_id:   repairJobsTable.technician_id,
    technician_name: repairJobsTable.technician_name,
    total_jobs:      sql<number>`COUNT(*)`,
    delivered:       sql<number>`SUM(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN 1 ELSE 0 END)`,
    in_progress:     sql<number>`SUM(CASE WHEN ${repairJobsTable.status} NOT IN ('delivered','cancelled') THEN 1 ELSE 0 END)`,
    cancelled:       sql<number>`SUM(CASE WHEN ${repairJobsTable.status} = 'cancelled' THEN 1 ELSE 0 END)`,
    total_revenue:   sql<number>`COALESCE(SUM(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN CAST(${repairJobsTable.final_cost} AS numeric) ELSE 0 END), 0)`,
    total_collected: sql<number>`COALESCE(SUM(CAST(${repairJobsTable.deposit_paid} AS numeric)), 0)`,
    avg_cost:        sql<number>`COALESCE(AVG(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN CAST(${repairJobsTable.final_cost} AS numeric) ELSE NULL END), 0)`,
  })
  .from(repairJobsTable)
  .where(and(...conditions))
  .groupBy(repairJobsTable.technician_id, repairJobsTable.technician_name)
  .orderBy(desc(sql`SUM(CASE WHEN ${repairJobsTable.status} = 'delivered' THEN 1 ELSE 0 END)`));

  res.json(rows);
}));

/* GET /repair-jobs/reports/revenue */
router.get("/repair-jobs/reports/revenue", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    res.status(403).json({ error: "غير مصرح بعرض تقارير الإيرادات" }); return;
  }
  const companyId = getTenant(req);
  const { from, to } = req.query as { from?: string; to?: string };

  const conditions = [
    eq(repairJobsTable.company_id, companyId),
    sql`${repairJobsTable.status} = 'delivered'`,
  ];
  if (from) conditions.push(sql`${repairJobsTable.delivered_at} >= ${from}`);
  if (to)   conditions.push(sql`${repairJobsTable.delivered_at} <= ${to}`);

  const [summary] = await db.select({
    total_jobs:          sql<number>`COUNT(*)`,
    gross_revenue:       sql<number>`COALESCE(SUM(CAST(${repairJobsTable.final_cost} AS numeric)), 0)`,
    total_collected:     sql<number>`COALESCE(SUM(CAST(${repairJobsTable.deposit_paid} AS numeric)), 0)`,
    total_external_cost: sql<number>`COALESCE(SUM(CAST(${repairJobsTable.external_workshop_cost} AS numeric)), 0)`,
    avg_revenue:         sql<number>`COALESCE(AVG(CAST(${repairJobsTable.final_cost} AS numeric)), 0)`,
  }).from(repairJobsTable).where(and(...conditions));

  const partsConds = [eq(repairJobPartsTable.company_id, companyId)];
  if (from || to) {
    partsConds.push(sql`${repairJobPartsTable.job_id} IN (
      SELECT id FROM repair_jobs WHERE company_id = ${companyId} AND status = 'delivered'
      ${from ? sql`AND delivered_at >= ${from}` : sql``}
      ${to   ? sql`AND delivered_at <= ${to}`   : sql``}
    )`);
  }
  const [partsRow] = await db.select({
    parts_cost: sql<number>`COALESCE(SUM(CAST(${repairJobPartsTable.unit_price} AS numeric) * CAST(${repairJobPartsTable.quantity} AS numeric)), 0)`,
  }).from(repairJobPartsTable).where(and(...partsConds));

  const grossRevenue   = Number(summary?.gross_revenue ?? 0);
  const partsCost      = Number(partsRow?.parts_cost ?? 0);
  const externalCost   = Number(summary?.total_external_cost ?? 0);
  const netProfit      = grossRevenue - partsCost - externalCost;

  res.json({
    total_jobs:      Number(summary?.total_jobs ?? 0),
    gross_revenue:   grossRevenue,
    total_collected: Number(summary?.total_collected ?? 0),
    parts_cost:      partsCost,
    external_cost:   externalCost,
    net_profit:      netProfit,
    avg_revenue:     Number(summary?.avg_revenue ?? 0),
  });
}));

export default router;
