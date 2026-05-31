/**
 * /api/super/companies/:id — Admin user management routes
 * (reset-admin-password).
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable, erpUsersTable } from "@workspace/db";
import { authenticate, requireRole } from "../../../middleware/auth";
import { wrap } from "../../../lib/async-handler";
import { hashPin } from "../../../lib/hash";
import { writeAuditLog } from "../../../lib/audit-log";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ── POST /super/companies/:id/reset-admin-password — generate a temp password ── */
router.post("/super/companies/:id/reset-admin-password", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const admins = await db
    .select({ id: erpUsersTable.id, username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id))
    .orderBy(erpUsersTable.id);

  if (admins.length === 0) {
    res.status(400).json({ error: "لا يوجد مستخدمون لهذه الشركة" });
    return;
  }

  const adminUsers = await db
    .select({ id: erpUsersTable.id, username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id))
    .orderBy(erpUsersTable.id);

  const target = adminUsers[0];

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
  let tempPassword = "";
  for (let i = 0; i < 10; i++) {
    tempPassword += chars[Math.floor(Math.random() * chars.length)];
  }

  const hashed = await hashPin(tempPassword);
  await db
    .update(erpUsersTable)
    .set({ pin: hashed, login_attempts: 0 })
    .where(eq(erpUsersTable.id, target.id));

  await writeAuditLog({
    action: "ADMIN_PASSWORD_RESET", record_type: "erp_user", record_id: target.id,
    old_value: null, new_value: { company_id: id, reset_by: "super_admin" },
    user: req.user, company_id: null,
    note: `إعادة تعيين كلمة مرور مدير شركة: ${co.name}`,
  });

  res.json({
    message: "تم إعادة تعيين كلمة المرور بنجاح",
    username: target.username,
    name: target.name,
    temp_password: tempPassword,
  });
}));

export default router;
