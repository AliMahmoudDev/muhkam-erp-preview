import { Router } from "express";
import { eq, desc, or, count, and, ne, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authenticate, requireRole, requireTenantStrict, getTenant } from "../middleware/auth";
import { hashPin } from "../lib/hash";
import { z } from "zod/v4";
import { createUserSchema, updateUserSchema, validate, firstZodError } from "../lib/schemas";
import { wrap } from "../lib/async-handler";

const createSafeSchema = z.object({
  name: z.string().min(1),
  balance: z.union([z.string(), z.number()]).optional().nullable(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const updateSafeSchema = z.object({
  name: z.string().min(1).optional(),
  balance: z.union([z.string(), z.number()]).optional(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const closeSafeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  actual_balance: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  branch_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const periodSchema = z.object({
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  unlock_reason: z.string().optional().nullable(),
  lock_mode: z.string().optional().nullable(),
});

const systemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional().nullable(),
  company_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const resetSchema = z.object({
  confirm: z.string(),
});
import {
  erpUsersTable,
  safesTable,
  safeTransfersTable,
  warehousesTable,
  salesTable,
  saleItemsTable,
  purchasesTable,
  purchaseItemsTable,
  customersTable,
  expensesTable,
  incomeTable,
  transactionsTable,
  receiptVouchersTable,
  depositVouchersTable,
  paymentVouchersTable,
  salesReturnsTable,
  systemSettingsTable,
  stockMovementsTable,
  stockCountSessionsTable,
} from "@workspace/db";
import { invalidateClosingDateCache } from "../lib/period-lock";
import { writeAuditLog } from "../lib/audit-log";
import { auditLogsTable } from "@workspace/db";
import { setCache, getCache, deleteCache } from "../lib/cache";

const router = Router();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function upsertSetting(key: string, value: string | null, companyId: number) {
  if (!companyId || companyId <= 0) throw Object.assign(new Error("upsertSetting: companyId required"), { status: 403 });
  if (value === null) {
    await db.delete(systemSettingsTable)
      .where(and(eq(systemSettingsTable.key, key), eq(systemSettingsTable.company_id, companyId)));
  } else {
    await db.insert(systemSettingsTable)
      .values({ key, company_id: companyId, value })
      .onConflictDoUpdate({
        target: [systemSettingsTable.key, systemSettingsTable.company_id],
        set:    { value, updated_at: new Date() },
      });
  }
}

async function readSettings(keys: string[], companyId: number): Promise<Record<string, string | null>> {
  if (!companyId || companyId <= 0) throw Object.assign(new Error("readSettings: companyId required"), { status: 403 });
  const rows = await db.select().from(systemSettingsTable)
    .where(eq(systemSettingsTable.company_id, companyId));
  const map: Record<string, string | null> = {};
  // eslint-disable-next-line security/detect-object-injection
  for (const k of keys) map[k] = null;
  for (const r of rows) if (keys.includes(r.key)) map[r.key] = r.value ?? null;
  return map;
}

// ─── USERS ────────────────────────────────────────────────────────────────────

router.get("/settings/users", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const companyId = getTenant(req);
  const cacheKey = `users:${companyId}`;
  const cached = await getCache<object[]>(cacheKey);
  if (cached) { res.json(cached); return; }
  const users = await db.select().from(erpUsersTable)
    .where(and(eq(erpUsersTable.company_id, companyId), ne(erpUsersTable.role, "super_admin")))
    .orderBy(erpUsersTable.id);
  const masked = users.map(({ pin, ...u }) => ({
    ...u,
    pin: pin ? "****" : null,
    pinLength: Math.min(Math.max(pin?.length ?? 4, 4), 6),
  }));
  await setCache(cacheKey, masked, 120);
  res.json(masked);
}));

router.post("/settings/users", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const v = validate(createUserSchema, req.body);
  if (!v.success) { res.status(400).json({ error: "بيانات غير صحيحة", details: v.errors }); return; }

  const { name, username, pin, role, permissions, warehouse_id, safe_id, active, employee_id } = v.data;
  const companyId = req.user!.company_id ?? undefined;

  if ((role as string) === "super_admin") {
    res.status(403).json({ error: "لا يمكن إنشاء حساب مسؤول عام من هنا" }); return;
  }

  const rawPin = pin || "0000";
  const hashedPin = await hashPin(String(rawPin));
  const [user] = await db.insert(erpUsersTable).values({
    name,
    username,
    pin: hashedPin,
    role: role || "cashier",
    permissions: permissions || "{}",
    warehouse_id: warehouse_id ? Number(warehouse_id) : null,
    safe_id: safe_id ? Number(safe_id) : null,
    employee_id: employee_id ? Number(employee_id) : null,
    active: active !== undefined ? Boolean(active) : true,
    company_id: companyId,
  }).returning();

  await writeAuditLog({
    action: "create",
    record_type: "user",
    record_id: user.id,
    new_value: { name: user.name, username: user.username, role: user.role },
    user: { id: req.user!.id, username: req.user!.username },
    company_id: companyId,
  });
  await deleteCache(`users:${req.user!.company_id}`);
  res.json({ ...user, pin: "****" });
}));

router.put("/settings/users/:id", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const v = validate(updateUserSchema, req.body);
  if (!v.success) { res.status(400).json({ error: "بيانات غير صحيحة", details: v.errors }); return; }

  const id = Number(req.params.id);
  const requesterId = req.user!.id;
  const companyId = getTenant(req);
  const { name, username, pin, role, permissions, active, warehouse_id, safe_id, employee_id, repair_commission_pct, repair_specialty, repair_notifications } = v.data;

  if ((role as string) === "super_admin") {
    res.status(403).json({ error: "لا يمكن تعيين دور المسؤول العام من هنا" }); return;
  }

  const [target] = await db.select().from(erpUsersTable)
    .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)));
  if (!target) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  if (target.role === "super_admin") {
    res.status(403).json({ error: "لا يمكن تعديل حساب المسؤول العام من هنا" }); return;
  }
  if (requesterId === id && role !== undefined && role !== req.user!.role) {
    res.status(403).json({ error: "لا يمكنك تغيير دورك الخاص" }); return;
  }

  let hashedPin: string | undefined = undefined;
  if (pin !== undefined && pin !== null && pin !== "" && pin !== "****") {
    hashedPin = await hashPin(String(pin));
  }

  const [user] = await db.update(erpUsersTable)
    .set({
      name, username,
      ...(hashedPin !== undefined ? { pin: hashedPin } : {}),
      role, permissions, active,
      warehouse_id: warehouse_id !== undefined ? (warehouse_id ? Number(warehouse_id) : null) : undefined,
      safe_id: safe_id !== undefined ? (safe_id ? Number(safe_id) : null) : undefined,
      employee_id: employee_id !== undefined ? (employee_id ? Number(employee_id) : null) : undefined,
      ...(repair_commission_pct !== undefined ? { repair_commission_pct: Number(repair_commission_pct) } : {}),
      ...(repair_specialty !== undefined ? { repair_specialty: repair_specialty ?? null } : {}),
      ...(repair_notifications !== undefined ? { repair_notifications: Boolean(repair_notifications) } : {}),
    })
    .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)))
    .returning();
  res.json({ ...user, pin: "****" });
}));

router.delete("/settings/users/:id", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const companyId = getTenant(req);

  if (req.user!.id === id) {
    res.status(403).json({ error: "لا يمكنك حذف حسابك الخاص" }); return;
  }

  const [target] = await db.select().from(erpUsersTable)
    .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)));
  if (!target) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  if (target.role === "super_admin") {
    res.status(403).json({ error: "لا يمكن حذف حساب المسؤول العام من هنا" }); return;
  }

  await db.delete(erpUsersTable)
    .where(and(eq(erpUsersTable.id, id), eq(erpUsersTable.company_id, companyId)));
  await writeAuditLog({
    action: "delete",
    record_type: "user",
    record_id: id,
    old_value: { name: target.name, username: target.username, role: target.role },
    user: { id: req.user!.id, username: req.user!.username },
    company_id: companyId,
  });
  await deleteCache(`users:${companyId}`);
  res.json({ success: true });
}));

// ─── SAFES ────────────────────────────────────────────────────────────────────

router.get("/settings/safes", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const safes = await db.select().from(safesTable)
    .where(eq(safesTable.company_id, companyId))
    .orderBy(safesTable.id);
  res.json(safes);
}));

router.post("/settings/safes", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const parsedSafe = createSafeSchema.safeParse(req.body);
  if (!parsedSafe.success) { res.status(400).json({ error: firstZodError(parsedSafe.error) }); return; }
  const { name, balance, branch_id } = parsedSafe.data;
  const companyId = req.user?.company_id ?? undefined;
  const [safe] = await db.insert(safesTable)
    .values({ name, balance: String(balance || 0), company_id: companyId, branch_id: branch_id ? Number(branch_id) : null })
    .returning();
  res.json(safe);
}));

router.put("/settings/safes/:id", authenticate, requireRole("admin"), requireTenantStrict, wrap(async (req, res) => {
  const parsedSafeU = updateSafeSchema.safeParse(req.body);
  if (!parsedSafeU.success) { res.status(400).json({ error: firstZodError(parsedSafeU.error) }); return; }
  const id = Number(req.params.id);
  const tenant = req.user!.company_id!;
  const { name, balance, branch_id } = parsedSafeU.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (balance !== undefined) updates.balance = String(balance);
  if (branch_id !== undefined) updates.branch_id = branch_id ? Number(branch_id) : null;
  const [safe] = await db.update(safesTable)
    .set(updates)
    .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)))
    .returning();
  if (!safe) { res.status(404).json({ error: "الخزينة غير موجودة" }); return; }
  res.json(safe);
}));

router.delete("/settings/safes/:id", authenticate, requireRole("admin"), requireTenantStrict, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const tenant = req.user!.company_id!;
  const [safe] = await db.select().from(safesTable)
    .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
  if (!safe) { res.status(404).json({ error: "الخزينة غير موجودة" }); return; }

  if (Number(safe.balance) !== 0) {
    res.status(409).json({ error: "لا يمكن حذف خزينة تحتوي على رصيد — يجب أن يكون الرصيد صفراً أولاً" }); return;
  }

  const [[expenses], [income], [receipts], [payments], [deposits], [transfers], [sales], [txn]] = await Promise.all([
    db.select({ n: count() }).from(expensesTable).where(eq(expensesTable.safe_id, id)),
    db.select({ n: count() }).from(incomeTable).where(eq(incomeTable.safe_id, id)),
    db.select({ n: count() }).from(receiptVouchersTable).where(eq(receiptVouchersTable.safe_id, id)),
    db.select({ n: count() }).from(paymentVouchersTable).where(eq(paymentVouchersTable.safe_id, id)),
    db.select({ n: count() }).from(depositVouchersTable).where(eq(depositVouchersTable.safe_id, id)),
    db.select({ n: count() }).from(safeTransfersTable).where(or(eq(safeTransfersTable.from_safe_id, id), eq(safeTransfersTable.to_safe_id, id))),
    db.select({ n: count() }).from(salesTable).where(eq(salesTable.safe_id, id)),
    db.select({ n: count() }).from(transactionsTable).where(eq(transactionsTable.safe_id, id)),
  ]);

  const hasMovements =
    Number(expenses.n) > 0 || Number(income.n) > 0 ||
    Number(receipts.n) > 0 || Number(payments.n) > 0 || Number(deposits.n) > 0 ||
    Number(transfers.n) > 0 || Number(sales.n) > 0 || Number(txn.n) > 0;

  if (hasMovements) {
    res.status(409).json({ error: "لا يمكن حذف خزينة لها حركات مالية مسجّلة" }); return;
  }

  await db.delete(safesTable).where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
  res.json({ success: true });
}));

/* Closing a safe creates financial adjustment transactions. Restrict to
   admin role to prevent any authenticated tenant user from mutating
   treasury balances. */
router.post("/settings/safes/:id/close", authenticate, requireRole("admin"), requireTenantStrict, wrap(async (req, res) => {
  const parsedClose = closeSafeSchema.safeParse(req.body);
  if (!parsedClose.success) { res.status(400).json({ error: firstZodError(parsedClose.error) }); return; }
  const id = Number(req.params.id);
  const tenant = req.user!.company_id!;
  const { date, actual_balance, notes } = parsedClose.data;
  const closeDate = date ?? new Date().toISOString().split("T")[0];

  const [safe] = await db.select().from(safesTable)
    .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
  if (!safe) { res.status(404).json({ error: "الخزينة غير موجودة" }); return; }

  const systemBalance = Number(safe.balance);
  const closing_no = `CLO-${id}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

  const todayTx = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.safe_id, id), eq(transactionsTable.company_id, tenant)))
    .orderBy(desc(transactionsTable.created_at));

  const dayTx = todayTx.filter(t => (t.date ?? "") === closeDate);
  const totalIn  = dayTx.filter(t => t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = dayTx.filter(t => t.direction === "out").reduce((s, t) => s + Number(t.amount), 0);

  let difference = 0;
  let adjustmentNote = null;
  if (actual_balance !== undefined && actual_balance !== null) {
    const actualBal = Number(actual_balance);
    difference = actualBal - systemBalance;
    if (Math.abs(difference) > 0.001) {
      adjustmentNote = difference > 0
        ? `زيادة خزينة ${difference.toFixed(2)} — تم التسجيل في إقفال ${closing_no}`
        : `عجز خزينة ${Math.abs(difference).toFixed(2)} — تم التسجيل في إقفال ${closing_no}`;

      await db.insert(transactionsTable).values({
        type: "safe_adjustment",
        reference_type: "safe_closing",
        safe_id: id,
        safe_name: safe.name,
        amount: String(Math.abs(difference)),
        direction: difference > 0 ? "in" : "out",
        description: adjustmentNote,
        date: closeDate,
        company_id: tenant,
      });

      await db.update(safesTable)
        .set({ balance: String(Number(actual_balance)) })
        .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
    }
  }

  await db.insert(transactionsTable).values({
    type: "safe_closing",
    reference_type: "safe_closing",
    safe_id: id,
    safe_name: safe.name,
    amount: String(actual_balance !== undefined ? Number(actual_balance) : systemBalance),
    direction: "in",
    description: notes ? `${notes} — إقفال ${closing_no}` : `إقفال خزينة ${safe.name} — ${closeDate}`,
    date: closeDate,
    company_id: tenant,
  });

  res.json({
    success: true,
    closing_no,
    safe_id: id,
    safe_name: safe.name,
    date: closeDate,
    system_balance: systemBalance,
    actual_balance: actual_balance !== undefined ? Number(actual_balance) : systemBalance,
    difference: Math.round(difference * 100) / 100,
    adjustment_note: adjustmentNote,
    summary: {
      total_in: Math.round(totalIn * 100) / 100,
      total_out: Math.round(totalOut * 100) / 100,
      net: Math.round((totalIn - totalOut) * 100) / 100,
      transaction_count: dayTx.length,
    },
  });
}));

router.get("/settings/safes/:id/statement", authenticate, requireTenantStrict, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const tenant = req.user!.company_id!;
  const { date_from, date_to } = req.query as { date_from?: string; date_to?: string };

  const [safe] = await db.select().from(safesTable)
    .where(and(eq(safesTable.id, id), eq(safesTable.company_id, tenant)));
  if (!safe) { res.status(404).json({ error: "الخزينة غير موجودة" }); return; }

  let txList = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.safe_id, id), eq(transactionsTable.company_id, tenant)))
    .orderBy(transactionsTable.date, transactionsTable.created_at);

  if (date_from) txList = txList.filter(t => (t.date ?? "") >= date_from);
  if (date_to)   txList = txList.filter(t => (t.date ?? "") <= date_to);

  let running = 0;
  const rows = txList.map(t => {
    const amt = Number(t.amount);
    running += t.direction === "in" ? amt : -amt;
    return {
      id: t.id,
      type: t.type,
      direction: t.direction,
      amount: amt,
      balance_after: Math.round(running * 100) / 100,
      description: t.description,
      date: t.date,
      created_at: t.created_at?.toISOString(),
    };
  });

  const totalIn  = txList.filter(t => t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = txList.filter(t => t.direction === "out").reduce((s, t) => s + Number(t.amount), 0);

  res.json({
    safe_id: id,
    safe_name: safe.name,
    current_balance: Number(safe.balance),
    total_in:  Math.round(totalIn  * 100) / 100,
    total_out: Math.round(totalOut * 100) / 100,
    net:       Math.round((totalIn - totalOut) * 100) / 100,
    rows,
  });
}));

// ─── WAREHOUSES ───────────────────────────────────────────────────────────────

router.get("/settings/warehouses", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const warehouses = await db.select().from(warehousesTable)
    .where(eq(warehousesTable.company_id, companyId))
    .orderBy(warehousesTable.id);
  res.json(warehouses);
}));

router.post("/settings/warehouses", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const parsedWH = createWarehouseSchema.safeParse(req.body);
  if (!parsedWH.success) { res.status(400).json({ error: firstZodError(parsedWH.error) }); return; }
  const { name, address, branch_id } = parsedWH.data;
  const companyId = req.user?.company_id ?? undefined;
  const [warehouse] = await db.insert(warehousesTable)
    .values({ name, address: address || null, company_id: companyId, branch_id: branch_id ? Number(branch_id) : null })
    .returning();
  res.json(warehouse);
}));

router.put("/settings/warehouses/:id", authenticate, requireRole("admin"), requireTenantStrict, wrap(async (req, res) => {
  const parsedWHU = updateWarehouseSchema.safeParse(req.body);
  if (!parsedWHU.success) { res.status(400).json({ error: firstZodError(parsedWHU.error) }); return; }
  const id = Number(req.params.id);
  const tenant = req.user!.company_id!;
  const { name, address, branch_id } = parsedWHU.data;
  const updates: Record<string, unknown> = {};
  if (name    !== undefined) updates.name      = String(name).trim();
  if (address !== undefined) updates.address   = address ? String(address).trim() : null;
  if (branch_id !== undefined) updates.branch_id = branch_id ? Number(branch_id) : null;
  const [wh] = await db.update(warehousesTable)
    .set(updates)
    .where(and(eq(warehousesTable.id, id), eq(warehousesTable.company_id, tenant)))
    .returning();
  if (!wh) { res.status(404).json({ error: "المخزن غير موجود" }); return; }
  res.json(wh);
}));

router.delete("/settings/warehouses/:id", authenticate, requireRole("admin"), requireTenantStrict, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const tenant = req.user!.company_id!;
  const [wh] = await db.select().from(warehousesTable)
    .where(and(eq(warehousesTable.id, id), eq(warehousesTable.company_id, tenant)));
  if (!wh) { res.status(404).json({ error: "المخزن غير موجود" }); return; }

  const [[movements], [sessions]] = await Promise.all([
    db.select({ n: count() }).from(stockMovementsTable).where(eq(stockMovementsTable.warehouse_id, id)),
    db.select({ n: count() }).from(stockCountSessionsTable).where(eq(stockCountSessionsTable.warehouse_id, id)),
  ]);

  if (Number(movements.n) > 0) {
    res.status(409).json({ error: "لا يمكن حذف مخزن له حركات مخزونية مسجّلة" }); return;
  }
  if (Number(sessions.n) > 0) {
    res.status(409).json({ error: "لا يمكن حذف مخزن له جلسات جرد مسجّلة" }); return;
  }

  await db.delete(warehousesTable).where(eq(warehousesTable.id, id));
  res.json({ success: true });
}));

// ─── PERIOD LOCK ──────────────────────────────────────────────────────────────

router.get("/settings/period", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const s = await readSettings(["closing_date", "lock_locked_by", "lock_locked_at", "lock_mode"], companyId);
  res.json({
    closing_date: s["closing_date"],
    locked_by:    s["lock_locked_by"],
    locked_at:    s["lock_locked_at"],
    lock_mode:    s["lock_mode"] ?? "manual",
    is_locked:    !!s["closing_date"],
  });
}));

router.put("/settings/period", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const parsedPeriod = periodSchema.safeParse(req.body);
  if (!parsedPeriod.success) { res.status(400).json({ error: firstZodError(parsedPeriod.error) }); return; }
  const { closing_date, unlock_reason, lock_mode } = parsedPeriod.data;
  const username  = req.user?.username  ?? "مجهول";
  const userId    = req.user?.id        ?? null;
  const companyId = req.user!.company_id!;

  if (closing_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closing_date)) {
      res.status(400).json({ error: "تنسيق التاريخ غير صحيح — استخدم YYYY-MM-DD" }); return;
    }
    await upsertSetting("closing_date",   closing_date,                companyId);
    await upsertSetting("lock_locked_by", username,                    companyId);
    await upsertSetting("lock_locked_at", new Date().toISOString(),    companyId);
    await upsertSetting("lock_mode",      lock_mode ?? "manual",       companyId);

    await writeAuditLog({
      action: "lock_period",
      record_type: "financial_lock",
      record_id: 0,
      new_value: { closing_date, locked_by: username, lock_mode: lock_mode ?? "manual" },
      user: { id: userId ?? undefined, username },
    });
  } else {
    if (!unlock_reason || String(unlock_reason).trim().length < 3) {
      res.status(400).json({ error: "يجب إدخال سبب فتح الفترة (3 أحرف على الأقل)" }); return;
    }
    const prev = await readSettings(["closing_date", "lock_locked_by"], companyId);
    await upsertSetting("closing_date",   null, companyId);
    await upsertSetting("lock_locked_by", null, companyId);
    await upsertSetting("lock_locked_at", null, companyId);
    await upsertSetting("lock_mode",      null, companyId);

    await writeAuditLog({
      action: "unlock_period",
      record_type: "financial_lock",
      record_id: 0,
      old_value: { closing_date: prev["closing_date"], locked_by: prev["lock_locked_by"] },
      new_value: { unlock_reason, unlocked_by: username },
      user: { id: userId ?? undefined, username },
    });
  }

  invalidateClosingDateCache(companyId);
  const updated = await readSettings(["closing_date", "lock_locked_by", "lock_locked_at", "lock_mode"], companyId);
  res.json({
    closing_date: updated["closing_date"],
    locked_by:    updated["lock_locked_by"],
    locked_at:    updated["lock_locked_at"],
    lock_mode:    updated["lock_mode"] ?? "manual",
    is_locked:    !!updated["closing_date"],
  });
}));

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

router.get("/settings/audit-logs", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const companyId = getTenant(req);
  const limit  = Math.min(parseInt(String(req.query.limit ?? "200")), 500);
  const rows   = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.company_id, companyId))
    .orderBy(desc(auditLogsTable.created_at))
    .limit(limit);
  const record_type = req.query.record_type as string | undefined;
  const filtered = record_type ? rows.filter(r => r.record_type === record_type) : rows;
  res.json(filtered.map(r => ({ ...r, created_at: r.created_at.toISOString() })));
}));

// ─── RESET DATABASE (Full Factory Reset) ──────────────────────────────────────
// يحذف كل بيانات الشركة بالكامل (من A إلى Z) مع الحفاظ على:
// 1. سجل الشركة نفسه (companies row)
// 2. المستخدم الحالي (admin الذي ينفّذ العملية)
// يستخدم نفس منهجية cascadeDeleteCompany لكن بدون حذف الشركة نفسها.

router.post("/settings/reset", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const parsedReset = resetSchema.safeParse(req.body);
  if (!parsedReset.success) { res.status(400).json({ error: firstZodError(parsedReset.error) }); return; }
  const { confirm } = parsedReset.data;
  if (confirm !== "إعادة تعيين كاملة") {
    res.status(400).json({ error: "يجب كتابة عبارة التأكيد بشكل صحيح" }); return;
  }

  const companyId     = req.user!.company_id!;
  const currentUserId = req.user!.id;

  await db.transaction(async (tx) => {
    const cid = companyId;

    // ملاحظة: ترتيب الحذف مهم لتجنب FK violations
    // نحذف من الأعمق للأبسط

    /* ── Level 3: deepest children (via subquery on employee/user) ── */
    await tx.execute(sql`DELETE FROM refresh_tokens          WHERE user_id IN (SELECT id FROM erp_users WHERE company_id = ${cid} AND id != ${currentUserId})`);
    await tx.execute(sql`DELETE FROM leave_approvals         WHERE leave_request_id IN (SELECT id FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM attendance_records      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM attendance_summary      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_contacts       WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_documents      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_status_history WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_history          WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_accrual_history   WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM overtime_records        WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM monthly_incentive_summary WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM daily_incentive_accrual WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM incentive_metrics       WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_shift_assignments WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_incentive_assignments WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_deductions WHERE salary_advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_history   WHERE salary_advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_ledger    WHERE advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM payroll_adjustments   WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM payroll_line_items    WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_slabs  WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_rules  WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_components WHERE salary_structure_id IN (SELECT id FROM salary_structures WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM journal_entry_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM sale_items          WHERE sale_id IN (SELECT id FROM sales WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM sale_return_items   WHERE return_id IN (SELECT id FROM sales_returns WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM purchase_items      WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM stock_count_items   WHERE session_id IN (SELECT id FROM stock_count_sessions WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_requests      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM payroll_records     WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);

    /* ── Accounting, banking, HR extras ── */
    await tx.execute(sql`DELETE FROM accrual_runs              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_statement_lines      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM depreciation_runs         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budget_lines              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_deductions       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM warranty_records          WHERE company_id = ${cid}`);

    /* ── Repair module ── */
    await tx.execute(sql`DELETE FROM repair_payments           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_job_parts          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_status_history     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_jobs               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_statuses           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_checklist_items    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_pipeline_config    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_dashboard_cards    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_device_models      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_accessories        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM scrap_items               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bad_debts                 WHERE company_id = ${cid}`);

    /* ── Devices, price lists ── */
    await tx.execute(sql`DELETE FROM devices                   WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM price_lists WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM price_lists               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM sales_targets             WHERE company_id = ${cid}`);

    /* ── Level 2: all direct company_id tables ── */
    await tx.execute(sql`DELETE FROM journal_entries       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM sales_returns         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM purchase_returns      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM sales                 WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM purchases             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM suppliers             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM receipt_vouchers      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM deposit_vouchers      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM payment_vouchers      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM treasury_vouchers     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM safe_transfers        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM stock_movements       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM stock_count_sessions  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM stock_transfers       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM expenses              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM income                WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM transactions          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM customer_ledger       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM salary_advances       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_bonuses      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_custody_lines WHERE custody_id IN (SELECT id FROM employee_custody WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_custody      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM salary_structures     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM payroll_periods       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM statutory_contributions WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM tax_brackets          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM incentive_schemes     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM salary_advance_settings WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM leave_policies        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM leave_blackout_dates  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM leave_types           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM public_holidays       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM shift_schedules       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employees             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM job_titles            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM departments           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM branches              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM products              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM customers             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM categories            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM customer_classifications WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM expense_categories    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM accounts              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM safes                 WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM warehouses            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM fiscal_years          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM alerts                WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM system_settings       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM idempotency_keys      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM audit_logs            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM accruals              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_accounts         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budgets               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM fixed_assets          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM cost_centers          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM exchange_rates        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM announcements         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM notifications         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_tiers    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_settings WHERE company_id = ${cid}`);

    /* ── Tables added later (trial, consignment, etc.) ── */
    await tx.execute(sql`DELETE FROM trial_abuse_log WHERE company_id = ${cid}`);

    /* ── Users: حذف الكل ما عدا المستخدم الحالي ── */
    await tx.execute(sql`DELETE FROM erp_users WHERE company_id = ${cid} AND id != ${currentUserId}`);
  });

  res.json({ success: true, message: "تم إعادة تعيين قاعدة البيانات بالكامل — تم حذف جميع البيانات" });
}));

// ─── CUSTOMER STATEMENT ───────────────────────────────────────────────────────

router.get("/customers/:id/statement", authenticate, wrap(async (req, res) => {
  const customerId = Number(req.params.id as string);
  const companyId  = req.user!.company_id!;

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.company_id, companyId)));
  if (!customer) { res.status(404).json({ error: "العميل غير موجود" }); return; }

  const sales = await db.select().from(salesTable)
    .where(and(eq(salesTable.customer_id, customerId), eq(salesTable.company_id, companyId)))
    .orderBy(desc(salesTable.created_at));

  const salesWithItems = await Promise.all(sales.map(async (sale) => {
    const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.sale_id, sale.id));
    return { ...sale, items };
  }));

  const linkedPurchases = await db.select().from(purchasesTable)
    .where(and(eq(purchasesTable.customer_id, customerId), eq(purchasesTable.company_id, companyId)))
    .orderBy(desc(purchasesTable.created_at));

  const purchasesWithItems = await Promise.all(linkedPurchases.map(async (pur) => {
    const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchase_id, pur.id));
    return { ...pur, items };
  }));

  const salesReturns = await db.select().from(salesReturnsTable)
    .where(and(eq(salesReturnsTable.customer_id, customerId), eq(salesReturnsTable.company_id, companyId)))
    .orderBy(desc(salesReturnsTable.created_at));

  const receiptVouchers = await db.select().from(receiptVouchersTable)
    .where(and(eq(receiptVouchersTable.customer_id, customerId), eq(receiptVouchersTable.company_id, companyId)))
    .orderBy(desc(receiptVouchersTable.created_at));

  const depositVouchers = await db.select().from(depositVouchersTable)
    .where(and(eq(depositVouchersTable.customer_id, customerId), eq(depositVouchersTable.company_id, companyId)))
    .orderBy(desc(depositVouchersTable.created_at));

  const paymentVouchers = await db.select().from(paymentVouchersTable)
    .where(and(eq(paymentVouchersTable.customer_id, customerId), eq(paymentVouchersTable.company_id, companyId)))
    .orderBy(desc(paymentVouchersTable.created_at));

  res.json({
    customer,
    sales: salesWithItems,
    linked_purchases: purchasesWithItems,
    sales_returns: salesReturns,
    receipt_vouchers: receiptVouchers,
    deposit_vouchers: depositVouchers,
    payment_vouchers: paymentVouchers,
  });
}));

// ─── SYSTEM SETTINGS ──────────────────────────────────────────────────────────

router.get("/settings/system", authenticate, wrap(async (req, res) => {
  const role      = req.user?.role ?? "";
  const companyId = role === "super_admin"
    ? Number(req.query.company_id)
    : req.user?.company_id;
  if (!companyId || !Number.isFinite(companyId)) {
    res.status(role === "super_admin" ? 400 : 403)
       .json({ error: role === "super_admin" ? "company_id query param required" : "Tenant not resolved" });
    return;
  }
  const cacheKey = `settings:${companyId}`;
  const cached = await getCache<Record<string, string>>(cacheKey);
  if (cached) { res.json(cached); return; }
  const rows = await db.select().from(systemSettingsTable)
    .where(eq(systemSettingsTable.company_id, companyId));
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value ?? "";
  await setCache(cacheKey, result, 300);
  res.json(result);
}));

router.post("/settings/system", authenticate, wrap(async (req, res) => {
  const role = req.user?.role ?? "";
  if (!["admin", "super_admin"].includes(role)) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const parsedSys = systemSettingSchema.safeParse(req.body);
  if (!parsedSys.success) { res.status(400).json({ error: firstZodError(parsedSys.error) }); return; }
  const { key, value } = parsedSys.data;
  if (!key.trim()) { res.status(400).json({ error: "المفتاح مطلوب" }); return; }
  const companyId = role === "super_admin"
    ? Number(req.body?.company_id ?? req.query.company_id)
    : req.user?.company_id;
  if (!companyId || !Number.isFinite(companyId)) {
    res.status(role === "super_admin" ? 400 : 403)
       .json({ error: role === "super_admin" ? "company_id required" : "Tenant not resolved" });
    return;
  }
  await upsertSetting(key.trim(), value ?? "", companyId);
  await deleteCache(`settings:${companyId}`);
  res.json({ success: true, key: key.trim(), value: value ?? "" });
}));

export default router;
