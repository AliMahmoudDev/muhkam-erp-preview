/**
 * Device CRUD and lookup routes:
 *   GET  /devices/stats
 *   GET  /devices/safes
 *   GET  /devices/warehouses
 *   GET  /devices/customer-lookup
 *   GET  /devices/employees
 *   GET  /devices/checklist-items
 *   GET  /devices           — list
 *   GET  /devices/:id       — single
 *   POST /devices           — create (simple, no purchase flow)
 *   PATCH /devices/:id      — update
 *   DELETE /devices/:id     — delete
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  devicesTable, customersTable, safesTable,
  warehousesTable, purchasesTable,
  employeesTable, erpUsersTable, repairChecklistItemsTable,
} from "@workspace/db";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { ctx, nextDeviceNo, createDeviceSchema } from "./_helpers";

const router = Router();

/**
 * @description Aggregate device statistics: counts, purchase value, sale value, profit.
 * @route  GET /devices/stats
 * @access can_view_devices
 */
router.get("/devices/stats", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_devices")) {
    return res.status(403).json({ error: "غير مصرح بعرض إحصاءات الأجهزة" });
  }
  const { company_id } = ctx(req);

  const countRows = await db.select({
    status: devicesTable.status,
    count:  sql<number>`count(*)::int`,
  }).from(devicesTable).where(eq(devicesTable.company_id, company_id)).groupBy(devicesTable.status);

  const map: Record<string, number> = {};
  countRows.forEach(r => { map[r.status] = r.count; });

  const finRows = await db.select({
    status:       devicesTable.status,
    purchase_sum: sql<string>`COALESCE(SUM(purchase_price::numeric), 0)`,
    sale_sum:     sql<string>`COALESCE(SUM(sale_price::numeric), 0)`,
    sold_sum:     sql<string>`COALESCE(SUM(CASE WHEN sold_price IS NOT NULL THEN sold_price::numeric ELSE 0 END), 0)`,
  }).from(devicesTable).where(eq(devicesTable.company_id, company_id)).groupBy(devicesTable.status);

  let stock_purchase_value = 0, stock_sale_value = 0, sold_revenue = 0, sold_cost = 0;
  finRows.forEach(r => {
    if (r.status === "available" || r.status === "maintenance") {
      stock_purchase_value += parseFloat(r.purchase_sum);
      stock_sale_value     += parseFloat(r.sale_sum);
    }
    if (r.status === "sold") {
      sold_revenue += parseFloat(r.sold_sum);
      sold_cost    += parseFloat(r.purchase_sum);
    }
  });

  return res.json({
    total:                  (map.available ?? 0) + (map.sold ?? 0) + (map.maintenance ?? 0),
    available:              map.available  ?? 0,
    sold:                   map.sold       ?? 0,
    maintenance:            map.maintenance ?? 0,
    stock_purchase_value:   Math.round(stock_purchase_value),
    stock_sale_value:       Math.round(stock_sale_value),
    stock_profit_potential: Math.round(stock_sale_value - stock_purchase_value),
    sold_revenue:           Math.round(sold_revenue),
    sold_profit:            Math.round(sold_revenue - sold_cost),
  });
}));

/** @route GET /devices/safes */
router.get("/devices/safes", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح" });
  const { company_id } = ctx(req);
  const rows = await db.select({ id: safesTable.id, name: safesTable.name, balance: safesTable.balance })
    .from(safesTable).where(eq(safesTable.company_id, company_id)).orderBy(safesTable.name);
  return res.json(rows);
}));

/** @route GET /devices/warehouses */
router.get("/devices/warehouses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح" });
  const { company_id } = ctx(req);
  const rows = await db.select({ id: warehousesTable.id, name: warehousesTable.name })
    .from(warehousesTable).where(eq(warehousesTable.company_id, company_id)).orderBy(warehousesTable.name);
  return res.json(rows);
}));

/** @route GET /devices/customer-lookup */
router.get("/devices/customer-lookup", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح" });
  const { company_id } = ctx(req);
  const phone = ((req.query.phone as string) ?? "").trim();
  if (!phone) return res.json({ found: false });
  const rows = await db.select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone, balance: customersTable.balance })
    .from(customersTable)
    .where(and(eq(customersTable.company_id, company_id), ilike(customersTable.phone, `%${phone}%`)))
    .limit(1);
  if (!rows.length) return res.json({ found: false });
  return res.json({ found: true, customer: rows[0] });
}));

/** @route GET /devices/employees */
router.get("/devices/employees", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح" });
  const { company_id } = ctx(req);
  const users = await db.select({
    id:   sql<string>`'u_' || ${erpUsersTable.id}`,
    name: erpUsersTable.name,
  }).from(erpUsersTable).where(and(eq(erpUsersTable.company_id, company_id), eq(erpUsersTable.active, true))).orderBy(erpUsersTable.name);

  const emps = await db.select({
    id:   sql<string>`'e_' || ${employeesTable.id}`,
    name: sql<string>`${employeesTable.first_name_ar} || ' ' || ${employeesTable.last_name_ar}`,
  }).from(employeesTable).where(and(
    eq(employeesTable.company_id, company_id),
    eq(employeesTable.employment_status, "active"),
    sql`${employeesTable.deleted_at} IS NULL`,
  )).orderBy(employeesTable.first_name_ar);

  return res.json([...users, ...emps]);
}));

/**
 * @description List devices with optional status filter and full-text search.
 * @route  GET /devices
 * @access can_view_devices
 */
router.get("/devices", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_devices")) return res.status(403).json({ error: "غير مصرح بعرض الأجهزة" });
  const { company_id } = ctx(req);
  const { status, search } = req.query as Record<string, string>;

  const conds = [eq(devicesTable.company_id, company_id)];
  if (status && status !== "all") conds.push(eq(devicesTable.status, status));

  let rows = await db.select().from(devicesTable).where(and(...conds)).orderBy(desc(devicesTable.created_at));

  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    rows = rows.filter(d =>
      d.brand.toLowerCase().includes(s) || d.model.toLowerCase().includes(s) ||
      d.device_no.toLowerCase().includes(s) ||
      (d.imei && d.imei.toLowerCase().includes(s)) ||
      (d.serial_no && d.serial_no.toLowerCase().includes(s)) ||
      (d.color && d.color.toLowerCase().includes(s)) ||
      (d.sold_to_customer_name && d.sold_to_customer_name.toLowerCase().includes(s))
    );
  }

  const missingInvoice = rows.filter(d => !d.purchase_invoice_no && d.purchase_id);
  if (missingInvoice.length > 0) {
    const ids = missingInvoice.map(d => d.purchase_id as number);
    const invoices = await db.select({ id: purchasesTable.id, invoice_no: purchasesTable.invoice_no })
      .from(purchasesTable).where(sql`${purchasesTable.id} = ANY(${ids})`);
    const invoiceMap: Record<number, string> = {};
    for (const inv of invoices) invoiceMap[inv.id] = inv.invoice_no;
    rows = rows.map(d => {
      if (!d.purchase_invoice_no && d.purchase_id && invoiceMap[d.purchase_id]) {
        return { ...d, purchase_invoice_no: invoiceMap[d.purchase_id], purchase_invoice_ref: invoiceMap[d.purchase_id] };
      }
      return d;
    });
  }

  return res.json(rows);
}));

/** @route GET /devices/:id */
router.get("/devices/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_devices")) return res.status(403).json({ error: "غير مصرح بعرض الأجهزة" });
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.select().from(devicesTable).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!row) return res.status(404).json({ error: "not found" });

  if (!row.purchase_invoice_no && row.purchase_id) {
    const [inv] = await db.select({ invoice_no: purchasesTable.invoice_no }).from(purchasesTable).where(eq(purchasesTable.id, row.purchase_id));
    if (inv) {
      (row as Record<string, unknown>).purchase_invoice_no = inv.invoice_no;
      (row as Record<string, unknown>).purchase_invoice_ref = inv.invoice_no;
    }
  }
  return res.json(row);
}));

/**
 * @description Create a simple device record without a purchase invoice.
 * @route  POST /devices
 * @access can_manage_devices
 */
router.post("/devices", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح بإضافة الأجهزة" });
  const { company_id, user_id, user_name } = ctx(req);
  const vd = createDeviceSchema.safeParse(req.body);
  if (!vd.success) return res.status(400).json({ error: vd.error.errors[0]?.message ?? "بيانات غير صالحة" });

  const device_no = await nextDeviceNo(company_id);
  const b = req.body as Record<string, unknown>;
  const ALLOWED_FIELDS = [
    "brand", "model", "color", "storage", "grade", "imei", "serial_no",
    "battery_health", "condition_notes", "purchase_price", "sale_price",
    "dual_sim", "with_box", "icloud_locked", "network_locked",
    "previously_opened", "mdm_locked", "supplier_name", "supplier_phone",
    "id_card_data", "inspection_data", "inspector_employee_id", "inspector_name", "branch_id",
  ] as const;
  const safeBody: Record<string, unknown> = {};
  // eslint-disable-next-line security/detect-object-injection
  for (const f of ALLOWED_FIELDS) if (f in b) safeBody[f] = b[f];

  type DeviceInsert = typeof devicesTable.$inferInsert;
  const [row] = await db.insert(devicesTable).values({
    ...(safeBody as unknown as DeviceInsert),
    company_id, device_no,
    added_by_user_id:   user_id,
    added_by_user_name: user_name,
    inspector_name:     (safeBody.inspector_name as string | undefined) ?? user_name,
    status: "available",
  }).returning();
  return res.json(row);
}));

/** @route PATCH /devices/:id */
router.patch("/devices/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح بتعديل الأجهزة" });
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const b = req.body as Record<string, unknown>;
  const PATCH_ALLOWED = [
    "brand", "model", "color", "storage", "grade", "imei", "serial_no",
    "battery_health", "condition_notes", "purchase_price", "sale_price",
    "dual_sim", "with_box", "icloud_locked", "network_locked",
    "previously_opened", "mdm_locked", "supplier_name", "supplier_phone",
    "id_card_data", "inspection_data", "inspector_employee_id", "inspector_name", "status", "branch_id",
  ] as const;
  const safeUpdate: Record<string, unknown> = { updated_at: new Date() };
  // eslint-disable-next-line security/detect-object-injection
  for (const f of PATCH_ALLOWED) if (f in b) safeUpdate[f] = b[f];
  const [row] = await db.update(devicesTable).set(safeUpdate).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id))).returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/** @route GET /devices/checklist-items */
router.get("/devices/checklist-items", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_devices")) return res.status(403).json({ error: "غير مصرح" });
  const { company_id } = ctx(req);
  const deviceType = req.query.device_type as string | undefined;
  const where = deviceType
    ? and(eq(repairChecklistItemsTable.company_id, company_id), eq(repairChecklistItemsTable.device_type, deviceType))
    : eq(repairChecklistItemsTable.company_id, company_id);
  const rows = await db.select({
    id:          repairChecklistItemsTable.id,
    label_ar:    repairChecklistItemsTable.label_ar,
    category:    repairChecklistItemsTable.category,
    device_type: repairChecklistItemsTable.device_type,
  }).from(repairChecklistItemsTable).where(where).orderBy(repairChecklistItemsTable.sort_order);
  return res.json(rows);
}));

/** @route DELETE /devices/:id */
router.delete("/devices/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) return res.status(403).json({ error: "غير مصرح بحذف الأجهزة" });
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(devicesTable).where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  return res.json({ ok: true });
}));

export default router;
