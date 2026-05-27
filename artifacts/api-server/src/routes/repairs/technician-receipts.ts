/**
 * technician-receipts.ts — إيصالات الفنيين لكل بطاقة صيانة
 *
 * POST /api/repair-jobs/:id/technician-receipts  — إضافة إيصال فني
 * GET  /api/repair-jobs/:id/technician-receipts  — جلب إيصالات بطاقة
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  repairJobsTable,
  repairReceiptTechniciansTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { ctx } from "./_shared";

const router: IRouter = Router();

/* ── Zod schema ─────────────────────────────────────────── */
const techReceiptSchema = z.object({
  technician_id: z.number({ required_error: "معرّف الفني مطلوب" }).int().positive("معرّف الفني يجب أن يكون رقماً موجباً"),
  item_name: z.string({ required_error: "اسم البند مطلوب" }).min(1, "اسم البند مطلوب").max(300, "اسم البند طويل جداً"),
  amount: z.number({ required_error: "المبلغ مطلوب" }).min(0, "المبلغ لا يمكن أن يكون سالباً"),
});

/* GET /api/repair-jobs/:id/technician-receipts */
router.get("/repair-jobs/:id/technician-receipts", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض إيصالات الفنيين" });
  }
  const { company_id } = ctx(req);
  const jobId = Number(req.params.id);

  /* تحقق من أن البطاقة تنتمي للشركة */
  const [job] = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const receipts = await db.select()
    .from(repairReceiptTechniciansTable)
    .where(eq(repairReceiptTechniciansTable.repair_job_id, jobId))
    .orderBy(desc(repairReceiptTechniciansTable.created_at));

  return res.json(receipts.map(r => ({ ...r, amount: Number(r.amount) })));
}));

/* POST /api/repair-jobs/:id/technician-receipts */
router.post("/repair-jobs/:id/technician-receipts", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإضافة إيصالات الفنيين" });
  }
  const { company_id } = ctx(req);
  const jobId = Number(req.params.id);

  const v = techReceiptSchema.safeParse(req.body);
  if (!v.success) {
    return res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" });
  }

  /* تحقق من أن البطاقة تنتمي للشركة */
  const [job] = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const [receipt] = await db.insert(repairReceiptTechniciansTable).values({
    repair_job_id: jobId,
    technician_id: v.data.technician_id,
    item_name: v.data.item_name,
    amount: String(v.data.amount),
  }).returning();

  return res.status(201).json({ ...receipt, amount: Number(receipt.amount) });
}));

export default router;
