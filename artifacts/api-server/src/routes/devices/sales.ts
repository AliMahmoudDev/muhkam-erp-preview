/**
 * POST /devices/purchase — full device purchase flow.
 *
 * Creates: customer (optional), product entry, device record, purchase invoice,
 * purchase item, stock movement, safe transaction, customer ledger entry.
 *
 * @access can_manage_devices
 */
import { Router } from "express";
import { db } from "@workspace/db";
import {
  devicesTable, customersTable, productsTable, safesTable,
  purchasesTable, purchaseItemsTable,
  stockMovementsTable, transactionsTable, customerLedgerTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { wrap, httpError } from "../../lib/async-handler";
import { nextDevicePurchaseInvoiceNo } from "../../lib/invoice-no";
import { hasPermission } from "../../lib/permissions";
import { findOrCreateCustomerByPhone } from "../../lib/auto-customer";
import { ctx, nextDeviceNo, purchaseDeviceSchema } from "./_helpers";

const router = Router();

/**
 * @description Purchase a used device with full financial integration.
 *              Accepts device specs, supplier info, and payment details.
 *              Performs 9-step transaction: customer upsert, product creation,
 *              device record, purchase invoice, stock movement, safe deduction,
 *              customer ledger, and device-purchase link.
 * @route  POST /devices/purchase
 * @access can_manage_devices
 */
router.post("/devices/purchase", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_devices")) {
    return res.status(403).json({ error: "غير مصرح بشراء الأجهزة" });
  }
  const { company_id, user_id, user_name, role, warehouse_id: userWarehouseId } = ctx(req);

  const vPurch = purchaseDeviceSchema.safeParse(req.body);
  if (!vPurch.success) throw httpError(400, vPurch.error.errors[0]?.message ?? "بيانات غير صالحة");

  const {
    brand, model, color, storage, grade, imei, battery_health,
    supplier_phone, id_card_data, condition_notes,
    customer_id: rawCustomerId,
    new_customer_name,
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
    condition_notes?: string;
    purchase_price: number; sale_price?: number;
    payment_type: "cash" | "credit" | "partial";
    safe_id?: number; warehouse_id?: number; paid_amount?: number;
  };

  const purchase_price = Number(rawPurchase ?? 0);
  const sale_price     = Number(rawSale ?? 0);
  const safe_id        = rawSafeId ? Number(rawSafeId) : null;
  const paid_amount    = payment_type === "cash"    ? purchase_price
    : payment_type === "partial" ? Number(rawPaid ?? 0)
    : 0;
  const remaining = purchase_price - paid_amount;

  const reqWarehouseId = rawWarehouseId ? Number(rawWarehouseId) : null;
  const effectiveWarehouseId = (role === "admin" || role === "manager") ? reqWarehouseId : (userWarehouseId ?? reqWarehouseId);
  if (!effectiveWarehouseId) throw httpError(400, "يجب تحديد المخزن");
  if (paid_amount > 0 && !safe_id) throw httpError(400, "يجب اختيار الخزينة للمدفوعات النقدية أو الجزئية");

  const today     = new Date().toISOString().split("T")[0];
  const invoiceNo = await nextDevicePurchaseInvoiceNo(company_id);
  const device_no = await nextDeviceNo(company_id);

  const result = await db.transaction(async (tx) => {
    /* 1. إيجاد/إنشاء عميل/مورد دائم */
    let customer_id: number | null = rawCustomerId ? Number(rawCustomerId) : null;
    let customer_name: string | null = null;
    if (customer_id) {
      const [c] = await tx.select({ id: customersTable.id, name: customersTable.name })
        .from(customersTable).where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, company_id)));
      if (!c) throw httpError(400, "العميل/المورد غير موجود");
      customer_name = c.name;
    } else if (new_customer_name?.trim()) {
      const trimmedName = new_customer_name.trim();
      const { id } = await findOrCreateCustomerByPhone(tx, company_id, {
        name: trimmedName, phone: supplier_phone?.trim() || null,
        classificationName: "عميل جهاز مستعمل",
        isCustomer: true, isSupplier: true, source: "device_purchase",
      });
      customer_id   = id;
      customer_name = trimmedName;
    }

    /* 2. إنشاء منتج */
    const productName = `${brand} ${model}${storage ? " " + storage : ""}${color ? " " + color : ""}`;
    const productSku  = imei ? `IMEI-${imei}` : `DEV-${device_no}`;
    const [newProduct] = await tx.insert(productsTable).values({
      company_id, name: productName, sku: productSku,
      category: "موبايلات مستعملة", quantity: "0",
      cost_price: String(purchase_price), sale_price: String(sale_price),
    } as typeof productsTable.$inferInsert).returning();

    /* 3. سجل الجهاز */
    const [device] = await tx.insert(devicesTable).values({
      company_id, device_no, brand, model,
      color: color ?? null, storage: storage ?? null, grade: grade ?? "B", imei: imei ?? null,
      battery_health: battery_health ? Number(battery_health) : null,
      purchase_price: String(purchase_price), sale_price: String(sale_price),
      supplier_name: customer_name ?? null, supplier_phone: supplier_phone ?? null,
      id_card_data: id_card_data ?? null, condition_notes: condition_notes ?? null,
      purchase_invoice_no: invoiceNo, purchase_invoice_ref: invoiceNo,
      status: "available", product_id: newProduct.id,
      added_by_user_id: user_id, added_by_user_name: user_name,
    } as typeof devicesTable.$inferInsert).returning();

    /* 4. فاتورة شراء */
    const status = payment_type === "credit" ? "unpaid" : remaining > 0 ? "partial" : "paid";
    const [purchase] = await tx.insert(purchasesTable).values({
      invoice_no: invoiceNo,
      supplier_name: customer_name ?? (supplier_phone ?? "مورد غير مسجل"),
      customer_id: customer_id ?? null, customer_name: customer_name ?? null,
      payment_type, total_amount: String(purchase_price),
      paid_amount: String(paid_amount),
      remaining_amount: String(payment_type === "credit" ? purchase_price : remaining),
      status, date: today,
      notes: `شراء جهاز ${productName} — ${device_no}`, company_id,
    } as typeof purchasesTable.$inferInsert).returning();

    /* 5. بند الشراء */
    await tx.insert(purchaseItemsTable).values({
      purchase_id: purchase.id, product_id: newProduct.id,
      product_name: productName, quantity: "1",
      unit_price: String(purchase_price), total_price: String(purchase_price),
    } as typeof purchaseItemsTable.$inferInsert);

    /* 6. تحديث المخزون + حركة */
    await tx.update(productsTable)
      .set({ quantity: "1", cost_price: String(purchase_price) })
      .where(and(eq(productsTable.id, newProduct.id), eq(productsTable.company_id, company_id)));

    await tx.insert(stockMovementsTable).values({
      product_id: newProduct.id, product_name: productName,
      movement_type: "purchase", quantity: "1",
      quantity_before: "0", quantity_after: "1",
      unit_cost: String(purchase_price), reference_type: "purchase",
      reference_id: purchase.id, reference_no: invoiceNo,
      notes: `مشتريات من ${customer_name ?? "مورد"} — ${device_no}`,
      date: today, warehouse_id: effectiveWarehouseId, company_id,
    } as typeof stockMovementsTable.$inferInsert);

    /* 7. خصم الخزينة (نقدي/جزئي) */
    if (paid_amount > 0 && safe_id) {
      const [safe] = await tx.select().from(safesTable).where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, company_id)));
      if (!safe) throw httpError(400, "الخزينة غير موجودة");
      await tx.update(safesTable).set({ balance: String(Number(safe.balance) - paid_amount) })
        .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, company_id)));
      await tx.insert(transactionsTable).values({
        type: "purchase_cash", reference_type: "purchase", reference_id: purchase.id,
        safe_id: safe.id, safe_name: safe.name,
        customer_id: customer_id ?? null, customer_name: customer_name ?? null,
        amount: String(paid_amount), direction: "out",
        description: `دفع نقدي — ${invoiceNo} — ${productName}`,
        date: today, company_id,
      } as typeof transactionsTable.$inferInsert);
    }

    /* 8. دفتر أستاذ العميل (آجل/جزئي) */
    const customerDebt = payment_type === "credit" ? purchase_price : payment_type === "partial" ? remaining : 0;
    if (customerDebt > 0 && customer_id) {
      const [cust] = await tx.select().from(customersTable).where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, company_id)));
      if (cust) {
        await tx.update(customersTable).set({ balance: String(Number(cust.balance ?? "0") - customerDebt) })
          .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, company_id)));
        await tx.insert(transactionsTable).values({
          type: "purchase_credit", reference_type: "purchase", reference_id: purchase.id,
          safe_id: null, safe_name: null, customer_id, customer_name,
          amount: String(customerDebt), direction: "out",
          description: `مشتريات آجل ${invoiceNo} — ${customer_name}`,
          date: today, company_id,
        } as typeof transactionsTable.$inferInsert);
        await tx.insert(customerLedgerTable).values({
          customer_id, type: "purchase", amount: String(-customerDebt),
          reference_type: "purchase", reference_id: purchase.id, reference_no: invoiceNo,
          description: `شراء جهاز ${productName} — مديونية ${invoiceNo}`,
          date: today, company_id,
        } as typeof customerLedgerTable.$inferInsert);
      }
    }

    /* 9. ربط الجهاز بفاتورة الشراء */
    const [finalDevice] = await tx.update(devicesTable)
      .set({ purchase_id: purchase.id, purchase_invoice_ref: invoiceNo, updated_at: new Date() })
      .where(and(eq(devicesTable.id, device.id), eq(devicesTable.company_id, company_id)))
      .returning();

    return { device: finalDevice, purchase, product: newProduct };
  });

  return res.status(201).json(result);
}));

export default router;
