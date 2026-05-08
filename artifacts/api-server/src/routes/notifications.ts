/**
 * /api/notifications — مركز الإشعارات الداخلية للمستخدم الحالي.
 * كل إشعار ينتمي إلى user_id محدد (المستلم).
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { z } from "zod/v4";

const router: IRouter = Router();
const fmt = (v: Date | null | undefined) => (v instanceof Date ? v.toISOString() : (v ?? null));

const NotificationIdParam = z.object({
  id: z.coerce.number().int().positive("معرف الإشعار يجب أن يكون رقماً موجباً"),
});

/**
 * GET /api/notifications — جلب إشعارات المستخدم الحالي (الأحدث أولاً، بحد أقصى 20 إشعاراً).
 * يدعم query param `unread=true` لإعادة الإشعارات غير المقروءة فقط.
 * @param {Request} req - الطلب، يحتوي على user.id و user.company_id من middleware المصادقة
 * @param {Response} res - الاستجابة بمصفوفة الإشعارات
 * @returns {Array} - قائمة الإشعارات مرتبةً تنازلياً حسب تاريخ الإنشاء
 */
router.get("/notifications", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const onlyUnread = String(req.query["unread"] ?? "") === "true";
  const conditions = [
    eq(notificationsTable.user_id, userId),
    eq(notificationsTable.company_id, companyId),
  ];
  if (onlyUnread) conditions.push(eq(notificationsTable.is_read, false));
  const rows = await db.select().from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.created_at))
    .limit(20);
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at), read_at: fmt(r.read_at) })));
}));

/**
 * GET /api/notifications/unread-count — عدد الإشعارات غير المقروءة (خفيف الوزن، لشارة الجرس).
 * @param {Request} req - الطلب، يحتوي على user.id و user.company_id
 * @param {Response} res - الاستجابة بعدد صحيح { count: number }
 * @returns {{ count: number }} - عدد الإشعارات غير المقروءة للمستخدم الحالي
 */
router.get("/notifications/unread-count", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const [row] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(notificationsTable)
    .where(and(
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
      eq(notificationsTable.is_read, false),
    ));
  res.json({ count: row?.count ?? 0 });
}));

/**
 * PATCH /api/notifications/read-all — تحديد جميع إشعارات المستخدم الحالي كمقروءة.
 * يجب أن يُسجَّل قبل PATCH /:id/read حتى لا يُفسَّر "read-all" كمعرف.
 * @param {Request} req - الطلب، يحتوي على user.id و user.company_id
 * @param {Response} res - الاستجابة بـ { ok: true } عند النجاح
 * @returns {{ ok: boolean }} - تأكيد نجاح العملية
 */
router.patch("/notifications/read-all", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  await db.update(notificationsTable)
    .set({ is_read: true, read_at: new Date() })
    .where(and(
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
      eq(notificationsTable.is_read, false),
    ));
  res.json({ ok: true });
}));

/**
 * PATCH /api/notifications/:id/read — تحديد إشعار واحد كمقروء بواسطة معرفه.
 * @param {Request} req - الطلب، يحتوي على params.id (رقم الإشعار)
 * @param {Response} res - الاستجابة بـ { ok: true } عند النجاح أو خطأ 400 إن كان المعرف غير صحيح
 * @returns {{ ok: boolean }} - تأكيد نجاح التحديث
 */
router.patch("/notifications/:id/read", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const parsed = NotificationIdParam.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "معرف الإشعار غير صحيح" }); return; }
  const { id } = parsed.data;
  await db.update(notificationsTable)
    .set({ is_read: true, read_at: new Date() })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
    ));
  res.json({ ok: true });
}));

/**
 * POST /api/notifications/:id/read — نسخة متوافقة مع الإصدار السابق لتحديد إشعار كمقروء.
 * @param {Request} req - الطلب، يحتوي على params.id
 * @param {Response} res - الاستجابة بـ { ok: true }
 * @returns {{ ok: boolean }} - تأكيد نجاح التحديث
 */
router.post("/notifications/:id/read", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const parsed = NotificationIdParam.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "معرف الإشعار غير صحيح" }); return; }
  const { id } = parsed.data;
  await db.update(notificationsTable)
    .set({ is_read: true, read_at: new Date() })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
    ));
  res.json({ ok: true });
}));

/**
 * POST /api/notifications/mark-all-read — نسخة متوافقة مع الإصدار السابق لتحديد الكل كمقروء.
 * @param {Request} req - الطلب، يحتوي على user.id و user.company_id
 * @param {Response} res - الاستجابة بـ { ok: true }
 * @returns {{ ok: boolean }} - تأكيد نجاح العملية
 */
router.post("/notifications/mark-all-read", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  await db.update(notificationsTable)
    .set({ is_read: true, read_at: new Date() })
    .where(and(
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
      eq(notificationsTable.is_read, false),
    ));
  res.json({ ok: true });
}));

/**
 * DELETE /api/notifications/:id — حذف إشعار واحد نهائياً.
 * @param {Request} req - الطلب، يحتوي على params.id (رقم الإشعار)
 * @param {Response} res - الاستجابة بـ { ok: true } عند النجاح
 * @returns {{ ok: boolean }} - تأكيد نجاح الحذف
 */
router.delete("/notifications/:id", wrap(async (req, res) => {
  const userId = req.user?.id;
  const companyId = req.user?.company_id;
  if (!userId || !companyId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const parsed = NotificationIdParam.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "معرف الإشعار غير صحيح" }); return; }
  const { id } = parsed.data;
  await db.delete(notificationsTable)
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.user_id, userId),
      eq(notificationsTable.company_id, companyId),
    ));
  res.json({ ok: true });
}));

export { router as notificationsRouter };
