/**
 * POST /api/auth/device-check
 * Verifies/registers a browser device fingerprint for an authenticated user.
 * - First login: stores the device_id as the trusted device.
 * - Known device: returns { known: true }.
 * - New device: sends notification to all admin/manager users, returns { known: false }.
 */
import { Router } from "express";
import { db, erpUsersTable, notificationsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { wrap } from "../lib/async-handler";
import { z } from "zod/v4";

const router = Router();

const DeviceCheckBody = z.object({
  device_id: z.string().min(1, "device_id مطلوب"),
});

const DeviceApproveBody = z.object({
  target_user_id: z.number().int().positive("معرف المستخدم المستهدف مطلوب"),
  device_id:      z.string().min(1, "device_id مطلوب"),
});

router.post("/auth/device-check", wrap(async (req, res) => {
  const user = req.user;
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const parsed = DeviceCheckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات التحقق من الجهاز غير صحيحة", details: parsed.error.issues.map(i => i.message) });
    return;
  }

  const { device_id } = parsed.data;

  const [dbUser] = await db.select({
    id: erpUsersTable.id,
    name: erpUsersTable.name,
    role: erpUsersTable.role,
    trusted_device_id: erpUsersTable.trusted_device_id,
    company_id: erpUsersTable.company_id,
  }).from(erpUsersTable).where(eq(erpUsersTable.id, user.id));

  if (!dbUser) { res.status(404).json({ error: "مستخدم غير موجود" }); return; }

  const companyId = dbUser.company_id ?? 1;

  /* First time: register this device as trusted */
  if (!dbUser.trusted_device_id) {
    await db.update(erpUsersTable)
      .set({ trusted_device_id: device_id })
      .where(eq(erpUsersTable.id, user.id));
    res.json({ known: true, first_time: true });
    return;
  }

  /* Known device: all good */
  if (dbUser.trusted_device_id === device_id) {
    res.json({ known: true, first_time: false });
    return;
  }

  /* Unknown device: notify all admins + managers of this company */
  const managers = await db.select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(and(
      eq(erpUsersTable.company_id, companyId),
      eq(erpUsersTable.active, true),
      inArray(erpUsersTable.role, ["admin", "manager", "super_admin"]),
    ));

  if (managers.length > 0) {
    await db.insert(notificationsTable).values(
      managers.map(m => ({
        company_id: companyId,
        user_id: m.id,
        type: "device_alert",
        title: "⚠ تسجيل دخول من جهاز غير معروف",
        message: `المستخدم "${dbUser.name}" يحاول فتح النظام من جهاز مختلف عن جهازه المعتاد. الرجاء التحقق.`,
        link: "/settings/users",
      }))
    );
  }

  res.json({ known: false, first_time: false, user_name: dbUser.name });
}));

/**
 * POST /api/auth/device-approve
 * Manager approves a new device for a user — updates their trusted_device_id.
 */
router.post("/auth/device-approve", wrap(async (req, res) => {
  const user = req.user;
  if (!user || !["admin", "manager", "super_admin"].includes(user.role ?? "")) {
    res.status(403).json({ error: "غير مصرح — المدراء فقط" }); return;
  }

  const parsed = DeviceApproveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الموافقة على الجهاز غير صحيحة", details: parsed.error.issues.map(i => i.message) });
    return;
  }

  const { target_user_id, device_id } = parsed.data;

  await db.update(erpUsersTable)
    .set({ trusted_device_id: device_id })
    .where(and(
      eq(erpUsersTable.id, target_user_id),
      eq(erpUsersTable.company_id, user.company_id ?? 1),
    ));

  res.json({ ok: true });
}));

export { router as deviceCheckRouter };
