/**
 * /api/super/managers — Super-admin manager account management.
 * CRUD for super_admin users — create, update, toggle, delete.
 */
import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, erpUsersTable } from "@workspace/db";
import { authenticate, requireRole } from "../../middleware/auth";
import { wrap } from "../../lib/async-handler";
import { hashPin } from "../../lib/hash";
import { writeAuditLog } from "../../lib/audit-log";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* ── GET /super/managers — list all super_admin accounts ── */
router.get("/super/managers", ...superOnly, wrap(async (_req, res) => {
  const managers = await db
    .select({
      id: erpUsersTable.id,
      name: erpUsersTable.name,
      username: erpUsersTable.username,
      email: erpUsersTable.email,
      active: erpUsersTable.active,
      last_login: erpUsersTable.last_login,
      created_at: erpUsersTable.created_at,
    })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.role, "super_admin"))
    .orderBy(desc(erpUsersTable.created_at));
  res.json(managers);
}));

/* ── POST /super/managers — create new super_admin ── */
router.post("/super/managers", ...superOnly, wrap(async (req, res) => {
  const { name, username, pin } = req.body as { name?: string; username?: string; pin?: string };

  if (!name?.trim())     { res.status(400).json({ error: "الاسم الكامل مطلوب" }); return; }
  if (!username?.trim()) { res.status(400).json({ error: "اسم المستخدم مطلوب" }); return; }
  if (/\s/.test(username)) { res.status(400).json({ error: "اسم المستخدم لا يجب أن يحتوي على مسافات" }); return; }
  if (!pin || pin.length < 4) { res.status(400).json({ error: "الرقم السري يجب أن يكون 4 أحرف على الأقل" }); return; }

  const [existing] = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(sql`LOWER(${erpUsersTable.username}) = ${username.trim().toLowerCase()}`);
  if (existing) { res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" }); return; }

  const hashedPin = await hashPin(pin);
  const [created] = await db.insert(erpUsersTable).values({
    name: name.trim(),
    username: username.trim().toLowerCase(),
    pin: hashedPin,
    role: "super_admin",
    active: true,
    company_id: null,
  }).returning({
    id: erpUsersTable.id, name: erpUsersTable.name,
    username: erpUsersTable.username, active: erpUsersTable.active,
    last_login: erpUsersTable.last_login, created_at: erpUsersTable.created_at,
  });
  void writeAuditLog({
    action: "MANAGER_CREATED", record_type: "erp_user", record_id: created.id,
    new_value: { username: created.username, name: created.name },
    user: req.user, company_id: null,
    note: `إنشاء حساب مدير عام جديد: ${created.username}`,
  });
  res.status(201).json(created);
}));

/* ── PATCH /super/managers/:id — update name/username/pin ── */
router.patch("/super/managers/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { name, username, pin } = req.body as { name?: string; username?: string; pin?: string };

  const [manager] = await db.select().from(erpUsersTable).where(eq(erpUsersTable.id, id));
  if (!manager || manager.role !== "super_admin") { res.status(404).json({ error: "المدير غير موجود" }); return; }

  if (username?.trim() && /\s/.test(username)) {
    res.status(400).json({ error: "اسم المستخدم لا يجب أن يحتوي على مسافات" }); return;
  }
  if (username?.trim() && username.trim().toLowerCase() !== manager.username.toLowerCase()) {
    const [dup] = await db.select({ id: erpUsersTable.id }).from(erpUsersTable)
      .where(sql`LOWER(${erpUsersTable.username}) = ${username.trim().toLowerCase()}`);
    if (dup) { res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" }); return; }
  }

  const updates: Partial<typeof erpUsersTable.$inferInsert> = {};
  if (name?.trim())       updates.name     = name.trim();
  if (username?.trim())   updates.username = username.trim().toLowerCase();
  if (pin && pin.length >= 4) updates.pin  = await hashPin(pin);

  const [updated] = await db.update(erpUsersTable).set(updates)
    .where(eq(erpUsersTable.id, id)).returning({
      id: erpUsersTable.id, name: erpUsersTable.name,
      username: erpUsersTable.username, active: erpUsersTable.active,
      last_login: erpUsersTable.last_login, created_at: erpUsersTable.created_at,
    });
  void writeAuditLog({
    action: "MANAGER_UPDATED", record_type: "erp_user", record_id: id,
    old_value: { username: manager.username, name: manager.name },
    new_value: { username: updated.username, name: updated.name, pin_changed: !!pin },
    user: req.user, company_id: null,
    note: `تعديل بيانات المدير: ${updated.username}`,
  });
  res.json(updated);
}));

/* ── PATCH /super/managers/:id/toggle — toggle active status ── */
router.patch("/super/managers/:id/toggle", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) { res.status(400).json({ error: "لا يمكن إيقاف حسابك الحالي" }); return; }

  const [manager] = await db.select().from(erpUsersTable).where(eq(erpUsersTable.id, id));
  if (!manager || manager.role !== "super_admin") { res.status(404).json({ error: "المدير غير موجود" }); return; }

  const [updated] = await db.update(erpUsersTable)
    .set({ active: !manager.active })
    .where(eq(erpUsersTable.id, id))
    .returning({ id: erpUsersTable.id, active: erpUsersTable.active });
  void writeAuditLog({
    action: "MANAGER_TOGGLED", record_type: "erp_user", record_id: id,
    old_value: { active: manager.active },
    new_value: { active: updated.active },
    user: req.user, company_id: null,
    note: `${updated.active ? 'تفعيل' : 'تعطيل'} حساب المدير: ${manager.username}`,
  });
  res.json(updated);
}));

/* ── DELETE /super/managers/:id — remove a super_admin ── */
router.delete("/super/managers/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) { res.status(400).json({ error: "لا يمكن حذف حسابك الحالي" }); return; }

  const allManagers = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.role, "super_admin"));
  if (allManagers.length <= 1) {
    res.status(400).json({ error: "يجب أن يكون هناك مدير عام واحد على الأقل" }); return;
  }

  const [manager] = await db.select({ id: erpUsersTable.id })
    .from(erpUsersTable).where(eq(erpUsersTable.id, id));
  if (!manager) { res.status(404).json({ error: "المدير غير موجود" }); return; }

  const [delManager] = await db.select({ username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable).where(eq(erpUsersTable.id, id));
  await db.delete(erpUsersTable).where(eq(erpUsersTable.id, id));
  void writeAuditLog({
    action: "MANAGER_DELETED", record_type: "erp_user", record_id: id,
    old_value: delManager ? { username: delManager.username, name: delManager.name } : null,
    user: req.user, company_id: null,
    note: `حذف حساب المدير: ${delManager?.username ?? id}`,
  });
  res.json({ message: "تم حذف المدير بنجاح" });
}));

export default router;
