/**
 * technician-earnings.ts — Phase 2
 *
 * Routes (read-only):
 *   GET /api/technicians/:id/earnings          — قائمة مفصّلة
 *   GET /api/technicians/:id/earnings/summary  — ملخص إجمالي
 *
 * المصدر الوحيد: repair_job_services حيث commission_locked = true.
 * لا يعكس أي دفع أو تسوية (Phase 3).
 */

import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  db,
  repairJobServicesTable,
  repairJobsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { ctx } from "./_shared";
import { hasPermission } from "../../lib/permissions";

const router: IRouter = Router();

/* ── GET /api/technicians/:id/earnings ───────────────────────── */
router.get("/technicians/:id/earnings", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ error: "غير مصرح بعرض أرباح الفنيين" });
  }
  const { company_id } = ctx(req);
  const techId = Number(req.params.id);
  if (!techId) return res.status(400).json({ error: "معرّف الفني غير صحيح" });

  const rows = await db
    .select({
      id:                         repairJobServicesTable.id,
      job_id:                     repairJobServicesTable.job_id,
      job_no:                     repairJobsTable.job_no,
      customer_name:              repairJobsTable.customer_name,
      delivered_at:               repairJobsTable.delivered_at,
      service_type_name_snapshot: repairJobServicesTable.service_type_name_snapshot,
      amount:                     repairJobServicesTable.amount,
      commission_computed:        repairJobServicesTable.commission_computed,
      commission_source_snapshot: repairJobServicesTable.commission_source_snapshot,
      commission_rate_snapshot:   repairJobServicesTable.commission_rate_snapshot,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(
      eq(repairJobServicesTable.company_id, company_id),
      eq(repairJobServicesTable.technician_id, techId),
      eq(repairJobServicesTable.commission_locked, true),
    ))
    .orderBy(repairJobsTable.delivered_at);

  return res.json(rows);
}));

/* ── GET /api/technicians/:id/earnings/summary ───────────────── */
router.get("/technicians/:id/earnings/summary", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ error: "غير مصرح بعرض أرباح الفنيين" });
  }
  const { company_id } = ctx(req);
  const techId = Number(req.params.id);
  if (!techId) return res.status(400).json({ error: "معرّف الفني غير صحيح" });

  const now = new Date();
  /* بداية اليوم (منتصف الليل توقيت الخادم) */
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  /* بداية الأسبوع (الأحد = 0) */
  const weekStart  = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayStart.getDay());
  /* بداية الشهر */
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere = and(
    eq(repairJobServicesTable.company_id, company_id),
    eq(repairJobServicesTable.technician_id, techId),
    eq(repairJobServicesTable.commission_locked, true),
  );

  const [totalRow] = await db
    .select({
      total:   sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
      count:   sql<number>`count(*)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(baseWhere);

  const [todayRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(baseWhere, gte(repairJobsTable.delivered_at, todayStart.toISOString().split("T")[0])));

  const [weekRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(baseWhere, gte(repairJobsTable.delivered_at, weekStart.toISOString().split("T")[0])));

  const [monthRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(baseWhere, gte(repairJobsTable.delivered_at, monthStart.toISOString().split("T")[0])));

  return res.json({
    technician_id:   techId,
    total_earned:    Number(totalRow?.total ?? 0),
    today:           Number(todayRow?.total ?? 0),
    this_week:       Number(weekRow?.total  ?? 0),
    this_month:      Number(monthRow?.total ?? 0),
    delivered_count: Number(totalRow?.count ?? 0),
  });
}));

export default router;
