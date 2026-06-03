import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  repairJobsTable,
  repairStatusHistoryTable,
} from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { ctx } from "../_shared";

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════
   WARRANTY — إنشاء بطاقة ضمان مرتبطة ببطاقة مُسلَّمة
══════════════════════════════════════════════════════════════ */

/**
 * POST /repair-jobs/:id/create-warranty
 *
 * ينشئ بطاقة صيانة جديدة من نوع "warranty" مرتبطة بالبطاقة الأصلية.
 * - البطاقة الأصلية يجب أن تكون في حالة "delivered" وليست ضمان نفسها.
 * - يأخذ بيانات العميل والجهاز من الأصل تلقائياً.
 * - رقم البطاقة الجديدة: {parent_job_no}/W{n}
 */
router.post("/repair-jobs/:id/create-warranty", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإنشاء بطاقة ضمان" });
  }
  const { company_id, user_id, user_name } = ctx(req);
  const parentId = Number(req.params.id);
  const b = req.body as Record<string, unknown>;

  const [parent] = await db.select().from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, parentId), eq(repairJobsTable.company_id, company_id)));

  if (!parent) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });
  if (parent.status !== "delivered") return res.status(400).json({ error: "لا يمكن فتح ضمان إلا على بطاقة مُسلَّمة" });
  if (parent.job_type === "warranty") return res.status(400).json({ error: "لا يمكن فتح ضمان على بطاقة ضمان" });

  /* حساب رقم الضمان: {parent_job_no}/W1, W2, ... */
  const siblings = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(
      eq(repairJobsTable.company_id, company_id),
      eq(repairJobsTable.warranty_of, parentId),
    ));
  const warrantyNo = `${parent.job_no}/W${siblings.length + 1}`;

  const today = new Date().toISOString().split("T")[0];

  const [newJob] = await db.insert(repairJobsTable).values({
    company_id,
    job_no:                warrantyNo,
    job_type:              "warranty",
    warranty_of:           parentId,
    customer_name:         parent.customer_name,
    customer_phone:        parent.customer_phone,
    customer_id:           parent.customer_id,
    device_brand:          parent.device_brand,
    device_model:          parent.device_model,
    device_type:           parent.device_type,
    imei:                  parent.imei,
    serial_no:             parent.serial_no,
    color:                 parent.color,
    storage:               parent.storage,
    problem_description:   b.problem_description ? String(b.problem_description) : null,
    notes:                 b.notes ? String(b.notes) : null,
    status:                "received",
    received_at:           today,
    estimated_cost:        "0",
    final_cost:            "0",
    deposit_paid:          "0",
  }).returning();

  /* سجّل في تاريخ البطاقة الجديدة */
  await db.insert(repairStatusHistoryTable).values({
    job_id:       newJob.id,
    company_id,
    status_from:  null,
    status_to:    "received",
    user_id,
    user_name,
    event_type:   "warranty_created",
    note:         `بطاقة ضمان مرتبطة بـ ${parent.job_no}`,
  });

  /* سجّل في تاريخ البطاقة الأصل */
  await db.insert(repairStatusHistoryTable).values({
    job_id:       parentId,
    company_id,
    status_from:  "delivered",
    status_to:    "delivered",
    user_id,
    user_name,
    event_type:   "warranty_opened",
    note:         `فُتح طلب ضمان: ${warrantyNo}`,
  });

  return res.status(201).json(newJob);
}));

export default router;
