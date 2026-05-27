/**
 * photos.ts — صور الجهاز (استلام / تسليم) لكل بطاقة صيانة
 *
 * POST /api/repair-jobs/:id/photos  — إضافة صورة
 * GET  /api/repair-jobs/:id/photos  — جلب صور بطاقة
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  repairJobsTable,
  repairDevicePhotosTable,
} from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { ctx } from "./_shared";

const router: IRouter = Router();

/* ── Zod schema ─────────────────────────────────────────── */
const addPhotoSchema = z.object({
  photo_url: z.string({ required_error: "رابط الصورة مطلوب" }).min(1, "رابط الصورة مطلوب").max(2000, "رابط الصورة طويل جداً"),
  photo_type: z.enum(["intake", "delivery"], {
    errorMap: () => ({ message: "نوع الصورة يجب أن يكون intake أو delivery" }),
  }).default("intake"),
});

/* GET /api/repair-jobs/:id/photos */
router.get("/repair-jobs/:id/photos", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_repairs")) {
    return res.status(403).json({ error: "غير مصرح بعرض صور الأجهزة" });
  }
  const { company_id } = ctx(req);
  const jobId = Number(req.params.id);

  /* تحقق من أن البطاقة تنتمي للشركة */
  const [job] = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const photos = await db.select()
    .from(repairDevicePhotosTable)
    .where(eq(repairDevicePhotosTable.repair_job_id, jobId))
    .orderBy(desc(repairDevicePhotosTable.uploaded_at));

  return res.json(photos);
}));

/* POST /api/repair-jobs/:id/photos */
router.post("/repair-jobs/:id/photos", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_repairs")) {
    return res.status(403).json({ error: "غير مصرح بإضافة صور الأجهزة" });
  }
  const { company_id, user_id } = ctx(req);
  const jobId = Number(req.params.id);

  const v = addPhotoSchema.safeParse(req.body);
  if (!v.success) {
    return res.status(400).json({ error: v.error.errors[0]?.message ?? "بيانات غير صالحة" });
  }

  /* تحقق من أن البطاقة تنتمي للشركة */
  const [job] = await db.select({ id: repairJobsTable.id })
    .from(repairJobsTable)
    .where(and(eq(repairJobsTable.id, jobId), eq(repairJobsTable.company_id, company_id)));
  if (!job) return res.status(404).json({ error: "بطاقة الصيانة غير موجودة" });

  const [photo] = await db.insert(repairDevicePhotosTable).values({
    repair_job_id: jobId,
    photo_url: v.data.photo_url,
    photo_type: v.data.photo_type,
    uploaded_by: user_id,
  }).returning();

  return res.status(201).json(photo);
}));

export default router;
