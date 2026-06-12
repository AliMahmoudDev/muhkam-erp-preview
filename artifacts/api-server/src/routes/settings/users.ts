import { Router } from 'express';
import { eq, and, ne, sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { authenticate, requireRole, getTenant } from '../../middleware/auth';
import { hashPin } from '../../lib/hash';
import { createUserSchema, updateUserSchema, validate } from '../../lib/schemas';
import { wrap } from '../../lib/async-handler';
import { erpUsersTable } from '@workspace/db';
import { writeAuditLog } from '../../lib/audit-log';
import { setCache, getCache, deleteCache } from '../../lib/cache';
import { requireUser } from '../../lib/tenant';

const router = Router();

// ─── USERS ────────────────────────────────────────────────────────────────────

router.get(
  '/settings/users',
  authenticate,
  requireRole('admin'),
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const cacheKey = `users:${companyId}`;
    const cached = await getCache<object[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    const users = await db
      .select()
      .from(erpUsersTable)
      .where(and(eq(erpUsersTable.company_id, companyId), ne(erpUsersTable.role, 'super_admin')))
      .orderBy(erpUsersTable.id);
    const masked = users.map(({ pin, ...u }) => ({
      ...u,
      pin: pin ? '****' : null,
      pinLength: Math.min(Math.max(pin?.length ?? 4, 4), 6),
    }));
    await setCache(cacheKey, masked, 120);
    res.json(masked);
  })
);

router.post(
  '/settings/users',
  authenticate,
  requireRole('admin'),
  wrap(async (req, res) => {
    const v = validate(createUserSchema, req.body);
    if (!v.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: v.errors });
      return;
    }

    const { name, phone, pin, role, permissions, warehouse_id, safe_id, active, employee_id } =
      v.data;
    const companyId = requireUser(req).company_id ?? undefined;

    if ((role as string) === 'super_admin') {
      res.status(403).json({ error: 'لا يمكن إنشاء حساب مسؤول عام من هنا' });
      return;
    }

    const normalizedPhone = phone.trim();
    const normalizedUsername = normalizedPhone;
    if (!normalizedPhone) {
      res.status(400).json({ error: 'رقم الهاتف مطلوب' });
      return;
    }

    const cleanPin = pin?.trim();
    if (!cleanPin || cleanPin.length < 4 || cleanPin === '0000' || cleanPin === '1234') {
      res
        .status(400)
        .json({ error: 'يجب إدخال رقم سري آمن للمستخدم، ولا يمكن استخدام 0000 أو 1234' });
      return;
    }

    const [existingByUsername] = await db
      .select({ id: erpUsersTable.id })
      .from(erpUsersTable)
      .where(
        sql`LOWER(${erpUsersTable.username}) = ${normalizedUsername} OR ${erpUsersTable.phone} = ${normalizedUsername}`
      )
      .limit(1);
    if (existingByUsername) {
      res.status(409).json({ error: 'رقم الهاتف مستخدم بالفعل' });
      return;
    }

    const hashedPin = await hashPin(cleanPin);
    const [user] = await db
      .insert(erpUsersTable)
      .values({
        name,
        username: normalizedUsername,
        phone: normalizedPhone,
        pin: hashedPin,
        role: role || 'cashier',
        permissions: permissions || '{}',
        warehouse_id: warehouse_id ? Number(warehouse_id) : null,
        safe_id: safe_id ? Number(safe_id) : null,
        employee_id: employee_id ? Number(employee_id) : null,
        active: active !== undefined ? Boolean(active) : true,
        company_id: companyId,
      })
      .returning();

    await writeAuditLog({
      action: 'create',
      record_type: 'user',
      record_id: user.id,
      new_value: { name: user.name, username: user.username, role: user.role },
      user: { id: requireUser(req).id, username: requireUser(req).username },
      company_id: companyId,
    });
    await deleteCache(`users:${requireUser(req).company_id}`);
    res.json({ ...user, pin: '****' });
  })
);

router.put(
  '/settings/users/:id',
  authenticate,
  requireRole('admin'),
  wrap(async (req, res) => {
    const v = validate(updateUserSchema, req.body);
    if (!v.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: v.errors });
      return;
    }

    const id = Number(req.params.id);
    const requesterId = requireUser(req).id;
    const companyId = getTenant(req);
    const {
      name,
      username,
      phone,
      pin,
      role,
      permissions,
      active,
      warehouse_id,
      safe_id,
      employee_id,
      repair_commission_pct,
      repair_specialty,
      repair_notifications,
    } = v.data;

    if ((role as string) === 'super_admin') {
      res.status(403).json({ error: 'لا يمكن تعيين دور المسؤول العام من هنا' });
      return;
    }

    const [target] = await db
      .select()
      .from(erpUsersTable)
      .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)));
    if (!target) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    if (target.role === 'super_admin') {
      res.status(403).json({ error: 'لا يمكن تعديل حساب المسؤول العام من هنا' });
      return;
    }
    if (requesterId === id && role !== undefined && role !== requireUser(req).role) {
      res.status(403).json({ error: 'لا يمكنك تغيير دورك الخاص' });
      return;
    }

    const normalizedPhone = phone !== undefined ? String(phone).trim() : undefined;
    const normalizedUsername =
      normalizedPhone !== undefined
        ? normalizedPhone
        : username !== undefined
          ? String(username).trim().toLowerCase()
          : undefined;
    if (phone !== undefined && !normalizedPhone) {
      res.status(400).json({ error: 'رقم الهاتف مطلوب' });
      return;
    }
    if (username !== undefined && !normalizedUsername) {
      res.status(400).json({ error: 'رقم الهاتف مطلوب' });
      return;
    }
    if (normalizedUsername) {
      const [existingByUsername] = await db
        .select({ id: erpUsersTable.id })
        .from(erpUsersTable)
        .where(
          and(
            sql`LOWER(${erpUsersTable.username}) = ${normalizedUsername} OR ${erpUsersTable.phone} = ${normalizedUsername}`,
            ne(erpUsersTable.id, id)
          )
        )
        .limit(1);
      if (existingByUsername) {
        res.status(409).json({ error: 'رقم الهاتف مستخدم بالفعل' });
        return;
      }
    }

    let hashedPin: string | undefined = undefined;
    if (pin !== undefined && pin !== null && pin !== '' && pin !== '****') {
      const cleanPin = String(pin).trim();
      if (cleanPin.length < 4 || cleanPin === '0000' || cleanPin === '1234') {
        res
          .status(400)
          .json({ error: 'يجب إدخال رقم سري آمن للمستخدم، ولا يمكن استخدام 0000 أو 1234' });
        return;
      }
      hashedPin = await hashPin(cleanPin);
    }

    const [user] = await db
      .update(erpUsersTable)
      .set({
        name,
        username: normalizedUsername,
        phone: normalizedPhone,
        ...(hashedPin !== undefined ? { pin: hashedPin } : {}),
        role,
        permissions,
        active,
        warehouse_id:
          warehouse_id !== undefined ? (warehouse_id ? Number(warehouse_id) : null) : undefined,
        safe_id: safe_id !== undefined ? (safe_id ? Number(safe_id) : null) : undefined,
        employee_id:
          employee_id !== undefined ? (employee_id ? Number(employee_id) : null) : undefined,
        ...(repair_commission_pct !== undefined
          ? { repair_commission_pct: Number(repair_commission_pct) }
          : {}),
        ...(repair_specialty !== undefined ? { repair_specialty: repair_specialty ?? null } : {}),
        ...(repair_notifications !== undefined
          ? { repair_notifications: Boolean(repair_notifications) }
          : {}),
      })
      .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)))
      .returning();
    res.json({ ...user, pin: '****' });
  })
);

router.delete(
  '/settings/users/:id',
  authenticate,
  requireRole('admin'),
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const companyId = getTenant(req);

    if (requireUser(req).id === id) {
      res.status(403).json({ error: 'لا يمكنك حذف حسابك الخاص' });
      return;
    }

    const [target] = await db
      .select()
      .from(erpUsersTable)
      .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)));
    if (!target) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    if (target.role === 'super_admin') {
      res.status(403).json({ error: 'لا يمكن حذف حساب المسؤول العام من هنا' });
      return;
    }

    await db
      .delete(erpUsersTable)
      .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)));
    await writeAuditLog({
      action: 'delete',
      record_type: 'user',
      record_id: id,
      old_value: { name: target.name, username: target.username, role: target.role },
      user: { id: requireUser(req).id, username: requireUser(req).username },
      company_id: companyId,
    });
    await deleteCache(`users:${companyId}`);
    res.json({ success: true });
  })
);

export default router;
