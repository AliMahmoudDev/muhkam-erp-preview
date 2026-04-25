import { Router } from "express";
import { db } from "@workspace/db";
import {
  devicesTable, customersTable, productsTable, safesTable,
  warehousesTable, purchasesTable, purchaseItemsTable,
  stockMovementsTable, transactionsTable, customerLedgerTable,
  employeesTable, erpUsersTable,
} from "@workspace/db";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { wrap, httpError } from "../lib/async-handler";
import type Express from "express";
import { requireFeature } from "../middleware/feature-guard";

const router = Router();
router.use("/devices", requireFeature("maintenance"));

function ctx(req: Express.Request) {
  const u = (req as unknown as { user: { company_id: number; id: number; name: string; role?: string; warehouse_id?: number } }).user;
  return { company_id: u.company_id, user_id: u.id, user_name: u.name, role: u.role ?? "cashier", warehouse_id: u.warehouse_id ?? null };
}

/* Auto-generate device number: DEV-YYYY-XXXX */
async function nextDeviceNo(company_id: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const rows = await db.select({ no: devicesTable.device_no })
    .from(devicesTable)
    .where(and(
      eq(devicesTable.company_id, company_id),
      sql`${devicesTable.device_no} LIKE ${prefix + "%"}`
    ))
    .orderBy(desc(devicesTable.id))
    .limit(1);
  if (!rows.length) return `${prefix}0001`;
  const last = rows[0].no;
  const seq = parseInt(last.split("-").pop() ?? "0", 10);
  return `${prefix}${String(seq + 1).padStart(4, "0")}`;
}

/* Auto-generate purchase invoice no */
function nextInvoiceNo(): string {
  return `DEV-PUR-${Date.now()}`;
}

/* ─── STATS ─── */
router.get("/devices/stats", wrap(async (req, res) => {
  const { company_id } = ctx(req);

  const countRows = await db.select({
    status: devicesTable.status,
    count: sql<number>`count(*)::int`,
  })
    .from(devicesTable)
    .where(eq(devicesTable.company_id, company_id))
    .groupBy(devicesTable.status);

  const map: Record<string, number> = {};
  countRows.forEach(r => { map[r.status] = r.count; });

  const finRows = await db.select({
    status: devicesTable.status,
    purchase_sum: sql<string>`COALESCE(SUM(purchase_price::numeric), 0)`,
    sale_sum:     sql<string>`COALESCE(SUM(sale_price::numeric), 0)`,
    sold_sum:     sql<string>`COALESCE(SUM(CASE WHEN sold_price IS NOT NULL THEN sold_price::numeric ELSE 0 END), 0)`,
  })
    .from(devicesTable)
    .where(eq(devicesTable.company_id, company_id))
    .groupBy(devicesTable.status);

  let stock_purchase_value = 0;
  let stock_sale_value = 0;
  let sold_revenue = 0;
  let sold_cost = 0;

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
    total:                (map.available ?? 0) + (map.sold ?? 0) + (map.maintenance ?? 0),
    available:            map.available  ?? 0,
    sold:                 map.sold       ?? 0,
    maintenance:          map.maintenance ?? 0,
    stock_purchase_value: Math.round(stock_purchase_value),
    stock_sale_value:     Math.round(stock_sale_value),
    stock_profit_potential: Math.round(stock_sale_value - stock_purchase_value),
    sold_revenue:         Math.round(sold_revenue),
    sold_profit:          Math.round(sold_revenue - sold_cost),
  });
}));

/* ─── LIST SAFES (for purchase form) ─── */
router.get("/devices/safes", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const rows = await db.select({ id: safesTable.id, name: safesTable.name, balance: safesTable.balance })
    .from(safesTable)
    .where(eq(safesTable.company_id, company_id))
    .orderBy(safesTable.name);
  return res.json(rows);
}));

/* ─── LIST WAREHOUSES (for purchase form) ─── */
router.get("/devices/warehouses", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const rows = await db.select({ id: warehousesTable.id, name: warehousesTable.name })
    .from(warehousesTable)
    .where(eq(warehousesTable.company_id, company_id))
    .orderBy(warehousesTable.name);
  return res.json(rows);
}));

/* ─── CUSTOMER PHONE LOOKUP ─── */
router.get("/devices/customer-lookup", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const phone = (req.query.phone as string ?? "").trim();
  if (!phone) return res.json({ found: false });
  const rows = await db.select({
    id: customersTable.id,
    name: customersTable.name,
    phone: customersTable.phone,
    balance: customersTable.balance,
  })
    .from(customersTable)
    .where(and(
      eq(customersTable.company_id, company_id),
      ilike(customersTable.phone, `%${phone}%`),
    ))
    .limit(1);
  if (!rows.length) return res.json({ found: false });
  return res.json({ found: true, customer: rows[0] });
}));

/* ─── LIST ACTIVE INSPECTORS: system users + active employees ─── */
router.get("/devices/employees", wrap(async (req, res) => {
  const { company_id } = ctx(req);

  /* System users (active) */
  const users = await db.select({
    id:   sql<string>`'u_' || ${erpUsersTable.id}`,
    name: erpUsersTable.name,
  })
    .from(erpUsersTable)
    .where(and(
      eq(erpUsersTable.company_id, company_id),
      eq(erpUsersTable.active, true),
    ))
    .orderBy(erpUsersTable.name);

  /* Active employees */
  const emps = await db.select({
    id:   sql<string>`'e_' || ${employeesTable.id}`,
    name: sql<string>`${employeesTable.first_name_ar} || ' ' || ${employeesTable.last_name_ar}`,
  })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.company_id, company_id),
      eq(employeesTable.employment_status, "active"),
      sql`${employeesTable.deleted_at} IS NULL`,
    ))
    .orderBy(employeesTable.first_name_ar);

  return res.json([...users, ...emps]);
}));

/* ─── LIST ─── */
router.get("/devices", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const { status, search } = req.query as Record<string, string>;

  const conds = [eq(devicesTable.company_id, company_id)];
  if (status && status !== "all") conds.push(eq(devicesTable.status, status));

  let rows = await db.select().from(devicesTable)
    .where(and(...conds))
    .orderBy(desc(devicesTable.created_at));

  if (search?.trim()) {
    const s = search.trim().toLowerCase();
    rows = rows.filter(d =>
      d.brand.toLowerCase().includes(s) ||
      d.model.toLowerCase().includes(s) ||
      d.device_no.toLowerCase().includes(s) ||
      (d.imei && d.imei.toLowerCase().includes(s)) ||
      (d.serial_no && d.serial_no.toLowerCase().includes(s)) ||
      (d.color && d.color.toLowerCase().includes(s)) ||
      (d.sold_to_customer_name && d.sold_to_customer_name.toLowerCase().includes(s))
    );
  }

  return res.json(rows);
}));

/* ─── GET ONE ─── */
router.get("/devices/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── CREATE DEVICE (simple, no purchase) ─── */
router.post("/devices", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const device_no = await nextDeviceNo(company_id);
  const [row] = await db.insert(devicesTable).values({
    ...req.body,
    company_id,
    device_no,
    added_by_user_id: user_id,
    added_by_user_name: user_name,
    inspector_name: req.body.inspector_name ?? user_name,
    status: "available",
  }).returning();
  return res.json(row);
}));

/* ─────────────────────────────────────────────────────────────────────────
   PURCHASE DEVICE — Full system integration
   Accepts:
     device fields: brand, model, color, storage, grade, imei, battery_health,
                    supplier_phone, id_card_data
     supplier/customer: customer_id (existing) | new_customer_name (new)
     financial: purchase_price*, sale_price, payment_type*, safe_id, warehouse_id*,
                paid_amount (for partial)
   Creates:
     1. Customer (if new)
     2. Product entry in products table
     3. Device record
     4. Purchase invoice (purchasesTable)
     5. Stock movement (stockMovementsTable)
     6. Safe transaction + balance update (if cash/partial)
     7. Customer ledger entry (if credit/partial + existing customer)
──────────────────────────────────────────────────────────────────────── */
router.post("/devices/purchase", wrap(async (req, res) => {
  const { company_id, user_id, user_name, role, warehouse_id: userWarehouseId } = ctx(req);

  const {
    /* device */
    brand, model, color, storage, grade, imei, battery_health,
    supplier_phone, id_card_data,
    /* supplier */
    customer_id: rawCustomerId,
    new_customer_name,
    /* inspection */
    inspection_data,
    inspector_employee_id: rawInspectorId,
    /* financial */
    purchase_price: rawPurchase,
    sale_price: rawSale,
    payment_type,
    safe_id: rawSafeId,
    warehouse_id: rawWarehouseId,
    paid_amount: rawPaid,
  } = req.body as {
    brand: string; model: string; color?: string; storage?: string;
    grade?: string; imei?: string; battery_health?: number;
    supplier_phone?: string; id_card_data?: string;
    customer_id?: number; new_customer_name?: string;
    inspection_data?: string;
    inspector_employee_id?: string;
    purchase_price: number; sale_price?: number;
    payment_type: "cash" | "credit" | "partial";
    safe_id?: number; warehouse_id?: number; paid_amount?: number;
  };

  /* Resolve inspector: format is "u_<id>" (user) or "e_<id>" (employee) */
  let inspector_employee_id: number | null = null;
  let inspector_name: string | null = null;
  if (rawInspectorId) {
    const [prefix, numStr] = rawInspectorId.split("_");
    const numId = parseInt(numStr ?? "", 10);
    if (!isNaN(numId)) {
      if (prefix === "e") {
        inspector_employee_id = numId;
        const [emp] = await db.select({
          name: sql<string>`${employeesTable.first_name_ar} || ' ' || ${employeesTable.last_name_ar}`,
        }).from(employeesTable).where(eq(employeesTable.id, numId));
        inspector_name = emp?.name ?? null;
      } else if (prefix === "u") {
        const [usr] = await db.select({ name: erpUsersTable.name })
          .from(erpUsersTable).where(eq(erpUsersTable.id, numId));
        inspector_name = usr?.name ?? null;
      }
    }
  }

  /* ── Validation ── */
  if (!brand || !model) throw httpError(400, "الشركة المصنعة والموديل مطلوبان");
  const purchase_price = Number(rawPurchase ?? 0);
  if (purchase_price <= 0) throw httpError(400, "سعر الشراء مطلوب وأكبر من صفر");
  if (!payment_type) throw httpError(400, "طريقة الدفع مطلوبة");

  const sale_price  = Number(rawSale ?? 0);
  const safe_id     = rawSafeId ? Number(rawSafeId) : null;
  const paid_amount = payment_type === "cash" ? purchase_price
    : payment_type === "partial" ? Number(rawPaid ?? 0)
    : 0;
  const remaining   = purchase_price - paid_amount;

  /* Resolve warehouse */
  const reqWarehouseId = rawWarehouseId ? Number(rawWarehouseId) : null;
  const effectiveWarehouseId = (role === "admin" || role === "manager")
    ? reqWarehouseId
    : (userWarehouseId ?? reqWarehouseId);
  if (!effectiveWarehouseId) throw httpError(400, "يجب تحديد المخزن");

  /* Validate safe for cash/partial */
  if (paid_amount > 0 && !safe_id) throw httpError(400, "يجب اختيار الخزينة للمدفوعات النقدية أو الجزئية");

  const today = new Date().toISOString().split("T")[0];
  const invoiceNo = nextInvoiceNo();
  const device_no = await nextDeviceNo(company_id);

  const result = await db.transaction(async (tx) => {
    /* ── 1. Create new customer if needed ── */
    const customer_id: number | null = rawCustomerId ? Number(rawCustomerId) : null;
    let customer_name: string | null = null;

    if (customer_id) {
      const [c] = await tx.select({ id: customersTable.id, name: customersTable.name })
        .from(customersTable)
        .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, company_id)));
      if (!c) throw httpError(400, "العميل/المورد غير موجود");
      customer_name = c.name;
    } else if (new_customer_name?.trim()) {
      /* مورد مؤقت — يُحفظ اسمه نصاً في الجهاز فقط، لا يُضاف لقائمة العملاء */
      customer_name = new_customer_name.trim();
      /* customer_id يبقى null */
    }

    /* ── 2. Find or create product ── */
    const productName = `${brand} ${model}${storage ? " " + storage : ""}${color ? " " + color : ""}`;
    const productSku = imei ? `IMEI-${imei}` : `DEV-${device_no}`;

    const [newProduct] = await tx.insert(productsTable).values({
      company_id,
      name: productName,
      sku: productSku,
      category: "موبايلات مستعملة",
      quantity: "0",
      cost_price: String(purchase_price),
      sale_price: String(sale_price),
    } as typeof productsTable.$inferInsert).returning();

    /* ── 3. Create device record ── */
    const [device] = await tx.insert(devicesTable).values({
      company_id,
      device_no,
      brand,
      model,
      color: color ?? null,
      storage: storage ?? null,
      grade: grade ?? "B",
      imei: imei ?? null,
      battery_health: battery_health ? Number(battery_health) : null,
      purchase_price: String(purchase_price),
      sale_price: String(sale_price),
      supplier_name: customer_name ?? null,
      supplier_phone: supplier_phone ?? null,
      id_card_data: id_card_data ?? null,
      inspection_data: inspection_data ?? null,
      inspector_employee_id,
      inspector_name: inspector_name ?? null,
      status: "available",
      product_id: newProduct.id,
      added_by_user_id: user_id,
      added_by_user_name: user_name,
    } as typeof devicesTable.$inferInsert).returning();

    /* ── 4. Create purchase invoice ── */
    const status = payment_type === "credit" ? "unpaid"
      : remaining > 0 ? "partial" : "paid";

    const [purchase] = await tx.insert(purchasesTable).values({
      invoice_no: invoiceNo,
      supplier_name: customer_name ?? (supplier_phone ?? "مورد غير مسجل"),
      customer_id: customer_id ?? null,
      customer_name: customer_name ?? null,
      payment_type,
      total_amount: String(purchase_price),
      paid_amount: String(paid_amount),
      remaining_amount: String(payment_type === "credit" ? purchase_price : remaining),
      status,
      date: today,
      notes: `شراء جهاز ${productName} — ${device_no}`,
      company_id,
    } as typeof purchasesTable.$inferInsert).returning();

    /* ── 5. Create purchase item ── */
    await tx.insert(purchaseItemsTable).values({
      purchase_id: purchase.id,
      product_id: newProduct.id,
      product_name: productName,
      quantity: "1",
      unit_price: String(purchase_price),
      total_price: String(purchase_price),
    } as typeof purchaseItemsTable.$inferInsert);

    /* ── 6. Update product quantity + stock movement ── */
    await tx.update(productsTable)
      .set({ quantity: "1", cost_price: String(purchase_price) })
      .where(and(eq(productsTable.id, newProduct.id), eq(productsTable.company_id, company_id)));

    await tx.insert(stockMovementsTable).values({
      product_id: newProduct.id,
      product_name: productName,
      movement_type: "purchase",
      quantity: "1",
      quantity_before: "0",
      quantity_after: "1",
      unit_cost: String(purchase_price),
      reference_type: "purchase",
      reference_id: purchase.id,
      reference_no: invoiceNo,
      notes: `مشتريات من ${customer_name ?? "مورد"} — ${device_no}`,
      date: today,
      warehouse_id: effectiveWarehouseId,
      company_id,
    } as typeof stockMovementsTable.$inferInsert);

    /* ── 7. Safe balance deduction (cash / partial) ── */
    if (paid_amount > 0 && safe_id) {
      const [safe] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, company_id)));
      if (!safe) throw httpError(400, "الخزينة غير موجودة");

      await tx.update(safesTable)
        .set({ balance: String(Number(safe.balance) - paid_amount) })
        .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, company_id)));

      await tx.insert(transactionsTable).values({
        type: "purchase_cash",
        reference_type: "purchase",
        reference_id: purchase.id,
        safe_id: safe.id,
        safe_name: safe.name,
        customer_id: customer_id ?? null,
        customer_name: customer_name ?? null,
        amount: String(paid_amount),
        direction: "out",
        description: `دفع نقدي — ${invoiceNo} — ${productName}`,
        date: today,
        company_id,
      } as typeof transactionsTable.$inferInsert);
    }

    /* ── 8. Customer ledger entry (credit / partial debt) ── */
    const customerDebt = payment_type === "credit" ? purchase_price
      : payment_type === "partial" ? remaining : 0;

    if (customerDebt > 0 && customer_id) {
      const [cust] = await tx.select().from(customersTable)
        .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, company_id)));
      if (cust) {
        await tx.update(customersTable)
          .set({ balance: String(Number(cust.balance ?? "0") - customerDebt) })
          .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, company_id)));

        await tx.insert(transactionsTable).values({
          type: "purchase_credit",
          reference_type: "purchase",
          reference_id: purchase.id,
          safe_id: null,
          safe_name: null,
          customer_id,
          customer_name,
          amount: String(customerDebt),
          direction: "out",
          description: `مشتريات آجل ${invoiceNo} — ${customer_name}`,
          date: today,
          company_id,
        } as typeof transactionsTable.$inferInsert);

        await tx.insert(customerLedgerTable).values({
          customer_id,
          type: "purchase",
          amount: String(-customerDebt),
          reference_type: "purchase",
          reference_id: purchase.id,
          reference_no: invoiceNo,
          description: `شراء جهاز ${productName} — مديونية ${invoiceNo}`,
          date: today,
          company_id,
        } as typeof customerLedgerTable.$inferInsert);
      }
    }

    /* ── 9. Link device to purchase ── */
    const [finalDevice] = await tx.update(devicesTable)
      .set({
        purchase_id: purchase.id,
        purchase_invoice_ref: invoiceNo,
        updated_at: new Date(),
      })
      .where(and(eq(devicesTable.id, device.id), eq(devicesTable.company_id, company_id)))
      .returning();

    return { device: finalDevice, purchase, product: newProduct };
  });

  return res.status(201).json(result);
}));

/* ─── UPDATE ─── */
router.patch("/devices/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable)
    .set({ ...req.body, updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── SELL ─── */
router.post("/devices/:id/sell", wrap(async (req, res) => {
  const { company_id, user_id, user_name } = ctx(req);
  const id = Number(req.params.id);
  const {
    customer_id, customer_name,
    sold_price, payment_method, payment_status,
    warranty_months,
  } = req.body;

  const [existing] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status !== "available") return res.status(400).json({ error: "الجهاز غير متاح للبيع" });

  const [row] = await db.update(devicesTable).set({
    status: "sold",
    sold_to_customer_id: customer_id ?? null,
    sold_to_customer_name: customer_name ?? null,
    sold_price: sold_price ?? existing.sale_price,
    sold_at: new Date(),
    sold_by_user_id: user_id,
    sold_by_user_name: user_name,
    payment_method: payment_method ?? "cash",
    payment_status: payment_status ?? "paid",
    warranty_months: warranty_months ?? null,
    updated_at: new Date(),
  })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();

  return res.json(row);
}));

/* ─── SEND TO MAINTENANCE ─── */
router.post("/devices/:id/maintenance", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable)
    .set({ status: "maintenance", updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── RETURN TO AVAILABLE (maintenance → available) ─── */
router.post("/devices/:id/available", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const [row] = await db.update(devicesTable)
    .set({ status: "available", updated_at: new Date() })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();
  if (!row) return res.status(404).json({ error: "not found" });
  return res.json(row);
}));

/* ─── CUSTOMER RETURN (sold → available, clear sale data) ─── */
router.post("/devices/:id/return", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  const { return_reason } = req.body as { return_reason?: string };

  const [existing] = await db.select().from(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status !== "sold") return res.status(400).json({ error: "الجهاز ليس في حالة مباع" });

  const note = return_reason
    ? `[إرجاع من العميل: ${return_reason}]${existing.condition_notes ? " — " + existing.condition_notes : ""}`
    : existing.condition_notes ?? null;

  const [row] = await db.update(devicesTable)
    .set({
      status: "available",
      sold_to_customer_id:   null,
      sold_to_customer_name: null,
      sold_price:            null,
      sold_at:               null,
      sold_by_user_id:       null,
      sold_by_user_name:     null,
      payment_method:        null,
      payment_status:        null,
      warranty_months:       null,
      condition_notes:       note,
      updated_at:            new Date(),
    })
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)))
    .returning();

  return res.json(row);
}));

/* ─── DELETE ─── */
router.delete("/devices/:id", wrap(async (req, res) => {
  const { company_id } = ctx(req);
  const id = Number(req.params.id);
  await db.delete(devicesTable)
    .where(and(eq(devicesTable.id, id), eq(devicesTable.company_id, company_id)));
  return res.json({ ok: true });
}));

export default router;
