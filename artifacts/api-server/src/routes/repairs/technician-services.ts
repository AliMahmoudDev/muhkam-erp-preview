/**
 * technician-services.ts — Phase 3
 *
 * GET /api/technicians/:id/services
 *   يُعيد الخدمات النشطة المسندة للفني (بطاقات لم تُسلَّم بعد).
 *
 * الفلتر:
 *   - technician_id = :id
 *   - repair_job.status NOT IN ('delivered', 'cancelled')
 *   - repair_job_services.status IN ('pending', 'in_progress', 'completed')
 *
 * الصلاحية: صاحب الطلب نفسه (employee_id == :id) أو can_view_reports.
 *
 * SECURITY: لا تُعاد commission_source_snapshot ولا commission_rate_snapshot —
 *   هذه الحقول مخصصة للإدارة فقط ولا يجب أن تصل للفنيين.
 */

import { Router, type IRouter } from "express";
import { eq, and, ne, inArray } from "drizzle-orm";
import {
  db,
  repairJobServicesTable,
  repairJobsTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { ctx } from "./_shared";
import { hasPermission } from "../../lib/permissions";

const router: IRouter = Router();

const ACTIVE_SVC_STATUSES = ["pending", "in_progress", "completed"] as const;

router.get("/technicians/:id/services", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const techId = Number(req.params.id);
  if (!techId) return res.status(400).json({ error: "معرّف الفني غير صحيح" });

  const reqUser = req.user as { employee_id?: number };
  const isSelf  = reqUser.employee_id != null && Number(reqUser.employee_id) === techId;
  if (!isSelf && !hasPermission(req.user, "can_view_reports")) {
    return res.status(403).json({ error: "غير مصرح بعرض خدمات هذا الفني" });
  }

  const rows = await db
    .select({
      id:                         repairJobServicesTable.id,
      job_id:                     repairJobServicesTable.job_id,
      job_no:                     repairJobsTable.job_no,
      customer_name:              repairJobsTable.customer_name,
      job_status:                 repairJobsTable.status,
      service_type_name_snapshot: repairJobServicesTable.service_type_name_snapshot,
      amount:                     repairJobServicesTable.amount,
      status:                     repairJobServicesTable.status,
      created_at:                 repairJobServicesTable.created_at,
    })
    .from(repairJobServicesTable)
    .innerJoin(repairJobsTable, eq(repairJobsTable.id, repairJobServicesTable.job_id))
    .where(and(
      eq(repairJobServicesTable.company_id, company_id),
      eq(repairJobServicesTable.technician_id, techId),
      ne(repairJobsTable.status, "delivered"),
      ne(repairJobsTable.status, "cancelled"),
      inArray(repairJobServicesTable.status, [...ACTIVE_SVC_STATUSES]),
    ))
    .orderBy(repairJobServicesTable.created_at);

  return res.json(rows);
}));

export default router;
