/**
 * technician-earnings.ts — Phase 2 / Phase 3
 *
 * Routes (read-only):
 *   GET /api/technicians/:id/earnings          — قائمة مفصّلة
 *   GET /api/technicians/:id/earnings/summary  — ملخص KPI
 *
 * الصلاحية: صاحب الطلب نفسه (employee_id == :id) أو can_view_reports.
 *
 * SECURITY: لا تُعاد commission_source_snapshot ولا commission_rate_snapshot
 *   في أي استجابة موجهة للفنيين — هذه الحقول تكشف طريقة حساب الكوميشن.
 */

import { Router, type IRouter } from "express";
import { eq, and, gte, ne, inArray, sql } from "drizzle-orm";
import {
  db,
  repairJobServicesTable,
  repairJobsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { ctx } from "./_shared";
import { hasPermission } from "../../lib/permissions";

const router: IRouter = Router();

/* ── helper ─────────────────────────────────────────────────── */
function canViewTech(req: Express.Request, techId: number): boolean {
  const u = req.user as { id?: number; employee_id?: number } | undefined;
  /* technician_id يُخزَّن كـ user_id — نتحقق من الاثنين للتوافق */
  const isSelf = (u?.id != null && Number(u.id) === techId) ||
                 (u?.employee_id != null && Number(u.employee_id) === techId);
  return isSelf || hasPermission(req.user, "can_view_reports");
}

const ACTIVE_SVC_STATUSES = ["pending", "in_progress", "completed"] as const;

/* ── GET /api/technicians/:id/earnings ───────────────────────── */
router.get("/technicians/:id/earnings", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const techId = Number(req.params.id);
  if (!techId) return res.status(400).json({ error: "معرّف الفني غير صحيح" });
  if (!canViewTech(req, techId)) return res.status(403).json({ error: "غير مصرح بعرض أرباح الفنيين" });

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
      /* commission_source_snapshot و commission_rate_snapshot محذوفان — لا يُكشفان للفنيين */
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
  const { company_id } = ctx(req);
  const techId = Number(req.params.id);
  if (!techId) return res.status(400).json({ error: "معرّف الفني غير صحيح" });
  if (!canViewTech(req, techId)) return res.status(403).json({ error: "غير مصرح بعرض أرباح الفنيين" });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseWhere = and(
    eq(repairJobServicesTable.company_id, company_id),
    eq(repairJobServicesTable.technician_id, techId),
    eq(repairJobServicesTable.commission_locked, true),
  );

  /* ── إجمالي الأرباح المحققة + عدد الخدمات المُسلَّمة ── */
  const [totalRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(baseWhere);

  /* ── أرباح اليوم ── */
  const [todayRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(baseWhere, gte(repairJobsTable.delivered_at, todayStart.toISOString().split("T")[0])));

  /* ── أرباح الشهر ── */
  const [monthRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${repairJobServicesTable.commission_computed}::numeric), 0)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(baseWhere, gte(repairJobsTable.delivered_at, monthStart.toISOString().split("T")[0])));

  /* ── الخدمات النشطة + مجموع مبالغها (الأرباح المعلقة) ── */
  const [activeRow] = await db
    .select({
      count:      sql<number>`count(*)`,
      amount_sum: sql<number>`coalesce(sum(${repairJobServicesTable.amount}::numeric), 0)`,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(
      eq(repairJobServicesTable.company_id, company_id),
      eq(repairJobServicesTable.technician_id, techId),
      ne(repairJobsTable.status, "delivered"),
      ne(repairJobsTable.status, "cancelled"),
      inArray(repairJobServicesTable.status, [...ACTIVE_SVC_STATUSES]),
    ));

  return res.json({
    technician_id:        techId,
    total_earned:         Number(totalRow?.total  ?? 0),
    today:                Number(todayRow?.total  ?? 0),
    this_month:           Number(monthRow?.total  ?? 0),
    delivered_count:      Number(totalRow?.count  ?? 0),
    active_count:         Number(activeRow?.count ?? 0),
    /* مجموع مبالغ الخدمات النشطة (الكوميشن لم يُحسب بعد حتى التسليم) */
    outstanding_earnings: Number(activeRow?.amount_sum ?? 0),
  });
}));

export default router;
