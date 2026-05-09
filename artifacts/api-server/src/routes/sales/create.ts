/**
 * POST /sales — create a new sale invoice.
 *
 * Handles stock decrement (atomic), safe balance update, customer ledger,
 * journal entry generation (cashier role: immediate post), and audit log.
 *
 * @access Requires can_create_sale permission.
 */
import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db, salesTable, saleItemsTable, productsTable, customersTable,
  transactionsTable, safesTable, warehousesTable, erpUsersTable,
  stockMovementsTable, customerLedgerTable,
} from "@workspace/db";
import { CreateSaleBody } from "@workspace/api-zod";
import { wrap, httpError } from "../../lib/async-handler";
import { triggerBackup } from "../../lib/backup-service";
import { assertPeriodOpen } from "../../lib/period-lock";
import { nextSaleInvoiceNo } from "../../lib/invoice-no";
import { runAllChecks } from "../../lib/alert-service";
import { writeAuditLog } from "../../lib/audit-log";
import { hasPermission } from "../../lib/permissions";
import { resolveTenantWarehouseId } from "../../lib/warehouse-guard";
import { getTenant } from "../../middleware/auth";
import { createJournalEntry } from "../../lib/auto-account";
import { formatSale, buildSaleJournalLines } from "./_helpers";

const router: IRouter = Router();

/**
 * @description Create a new sale invoice. Supports cash, credit, and partial
 *              payment types with optional split-payment (multi-safe) support.
 * @route  POST /sales
 * @access can_create_sale
 */
router.post("/sales", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_create_sale")) {
    res.status(403).json({ error: "غير مصرح بإنشاء فواتير بيع" }); return;
  }

  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const { payment_type: pt } = parsed.data;
  if (pt === "cash"    && !hasPermission(req.user, "can_cash_sale"))    { res.status(403).json({ error: "غير مصرح بالبيع النقدي" }); return; }
  if (pt === "partial" && !hasPermission(req.user, "can_partial_sale")) { res.status(403).json({ error: "غير مصرح بالبيع الجزئي" }); return; }
  if (pt === "credit"  && !hasPermission(req.user, "can_credit_sale"))  { res.status(403).json({ error: "غير مصرح بالبيع الآجل" }); return; }

  const requestId = req.headers["x-request-id"] ? String(req.headers["x-request-id"]) : null;
  const companyId = getTenant(req);

  if (requestId) {
    const existing = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.request_id, requestId), eq(salesTable.company_id, companyId)))
      .limit(1);
    if (existing.length > 0) return res.json(existing[0]);
  }

  const {
    payment_type, total_amount, paid_amount, items, customer_name, customer_id,
    notes, date, safe_id, warehouse_id, salesperson_id,
    discount_percent, discount_amount, payments: paymentsInput,
  } = parsed.data;

  // Business logic validation
  if (total_amount <= 0) throw httpError(400, "إجمالي الفاتورة يجب أن يكون أكبر من صفر");
  if (paid_amount < 0)   throw httpError(400, "المبلغ المدفوع لا يمكن أن يكون سالباً");
  if (!items || items.length === 0) throw httpError(400, "الفاتورة يجب أن تحتوي على صنف واحد على الأقل");
  for (const item of items) {
    if (item.quantity  <= 0) throw httpError(400, `كمية الصنف "${item.product_name}" يجب أن تكون أكبر من صفر`);
    if (item.unit_price < 0) throw httpError(400, `سعر الصنف "${item.product_name}" لا يمكن أن يكون سالباً`);
  }

  // Warehouse scope enforcement
  const role = req.user?.role ?? "cashier";
  const bodyWarehouseId = warehouse_id ? Number(warehouse_id) : null;
  const effectiveWarehouseId = (role === "admin" || role === "manager") ? bodyWarehouseId : (req.user?.warehouse_id ?? null);
  if (effectiveWarehouseId === null) { res.status(400).json({ error: "يجب تحديد المخزن" }); return; }

  const tenantWarehouseId = await resolveTenantWarehouseId(
    bodyWarehouseId ?? effectiveWarehouseId,
    companyId,
  );

  // Build effective payments list (split-payment or legacy single-payment)
  type PaymentEntry = { type: "cash" | "credit"; safe_id: number | null; amount: number };
  let effectivePayments: PaymentEntry[];

  if (paymentsInput && paymentsInput.length > 0) {
    effectivePayments = paymentsInput.map(p => ({ type: p.type, safe_id: p.safe_id ?? null, amount: p.amount }));
    const totalAllocated = effectivePayments.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(totalAllocated - total_amount) > 0.05) {
      return res.status(400).json({ error: `مجموع الدفعات (${totalAllocated.toFixed(2)}) لا يساوي إجمالي الفاتورة (${total_amount.toFixed(2)})` });
    }
  } else {
    if (payment_type === "credit") {
      effectivePayments = [{ type: "credit", safe_id: null, amount: total_amount }];
    } else if (payment_type === "cash") {
      effectivePayments = [{ type: "cash", safe_id: safe_id ?? null, amount: total_amount }];
    } else {
      effectivePayments = [];
      if (paid_amount > 0) effectivePayments.push({ type: "cash", safe_id: safe_id ?? null, amount: paid_amount });
      const rem = total_amount - paid_amount;
      if (rem > 0) effectivePayments.push({ type: "credit", safe_id: null, amount: rem });
    }
  }

  const cashPayments   = effectivePayments.filter(p => p.type === "cash"   && p.amount > 0);
  const creditPayments = effectivePayments.filter(p => p.type === "credit" && p.amount > 0);
  const effectivePaidAmount   = cashPayments.reduce((s, p) => s + p.amount, 0);
  const effectiveCreditAmount = creditPayments.reduce((s, p) => s + p.amount, 0);
  const computedPaymentType: "cash" | "credit" | "partial" =
    effectiveCreditAmount === 0 ? "cash" :
    effectivePaidAmount   === 0 ? "credit" :
    "partial";
  const primarySafeId = cashPayments.length > 0 ? cashPayments[0].safe_id : null;
  const remaining = effectiveCreditAmount;

  const status = effectivePaidAmount === 0 && effectiveCreditAmount > 0 ? "unpaid"
    : effectiveCreditAmount > 0 ? "partial"
    : "paid";

  // Safe scope enforcement for cashier/salesperson
  const userSafeId = req.user?.safe_id ?? null;
  if (role === "cashier" || role === "salesperson") {
    if (!userSafeId && cashPayments.length > 0) {
      res.status(403).json({ error: "المستخدم غير مرتبط بخزينة — راجع الإعدادات" }); return;
    }
    for (const p of cashPayments) {
      if (p.safe_id && p.safe_id !== userSafeId) {
        res.status(403).json({ error: "لا يمكنك استخدام خزنة غير المخصصة لك" }); return;
      }
      if (!p.safe_id) p.safe_id = userSafeId;
    }
  }

  let effectiveSafeId: number | null = primarySafeId;
  if (!effectiveSafeId && (role === "cashier" || role === "salesperson") && cashPayments.length > 0) {
    effectiveSafeId = userSafeId;
  }

  if (cashPayments.length > 0 && cashPayments.some(p => !p.safe_id)) {
    return res.status(400).json({ error: "يجب تحديد الخزينة للمدفوعات النقدية" });
  }

  await assertPeriodOpen(date, req);

  const invoiceNo = await nextSaleInvoiceNo(companyId);
  const sale = await db.transaction(async (tx) => {
    // 1. جلب بيانات الخزن والتحقق من وجودها
    const safeRecords: Map<number, typeof safesTable.$inferSelect> = new Map();
    for (const p of cashPayments) {
      if (!p.safe_id) continue;
      if (safeRecords.has(p.safe_id)) continue;
      const [s] = await tx.select().from(safesTable).where(and(eq(safesTable.id, p.safe_id), eq(safesTable.company_id, companyId)));
      if (!s) throw httpError(400, `الخزينة رقم ${p.safe_id} غير موجودة`);
      safeRecords.set(p.safe_id, s);
    }
    const primarySafe = primarySafeId ? safeRecords.get(primarySafeId) ?? null : null;

    let warehouseName: string | null = null;
    if (warehouse_id) {
      const [w] = await tx.select().from(warehousesTable).where(and(eq(warehousesTable.id, warehouse_id), eq(warehousesTable.company_id, companyId)));
      if (!w) throw httpError(400, "المخزن غير موجود");
      warehouseName = w.name;
    }
    let salespersonName: string | null = null;
    if (salesperson_id) {
      const [u] = await tx.select().from(erpUsersTable).where(and(eq(erpUsersTable.id, salesperson_id), eq(erpUsersTable.company_id, companyId)));
      if (!u) throw httpError(400, "البائع غير موجود");
      salespersonName = u.name;
    }
    if (customer_id) {
      const [c] = await tx.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, companyId)));
      if (!c) throw httpError(400, "العميل غير موجود");
    }

    // 2. إنشاء الفاتورة
    const [newSale] = await tx.insert(salesTable).values({
      invoice_no: invoiceNo,
      customer_name: customer_name ?? null,
      customer_id: customer_id ?? null,
      payment_type: computedPaymentType,
      total_amount: String(total_amount),
      paid_amount: String(effectivePaidAmount),
      remaining_amount: String(remaining),
      status,
      safe_id: primarySafe?.id ?? null,
      safe_name: primarySafe?.name ?? null,
      warehouse_id: warehouse_id ?? null,
      warehouse_name: warehouseName,
      salesperson_id: salesperson_id ?? null,
      salesperson_name: salespersonName,
      discount_percent: String(discount_percent ?? 0),
      discount_amount: String(discount_amount ?? 0),
      notes: notes ?? null,
      date: date ?? new Date().toISOString().split("T")[0],
      request_id: requestId,
      user_id: req.user?.id ?? null,
      company_id: req.user?.company_id ?? undefined,
    }).returning();

    // 3. البنود: خصم المخزون (atomic) + تسجيل التكلفة + حركة مخزون
    let totalTaxAmount = 0;
    for (const item of items) {
      const [prod] = await tx.select().from(productsTable).where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId)));
      if (!prod) throw httpError(400, `المنتج "${item.product_name}" غير موجود`);
      const costAtSale = Number(prod.cost_price);
      const costTotal  = costAtSale * item.quantity;
      const itemTaxRate = Number(prod.tax_rate ?? 0);
      const itemTax    = item.quantity * item.unit_price * (itemTaxRate / 100);
      totalTaxAmount  += itemTax;
      const qtyStr     = String(item.quantity);

      const updated = await tx.update(productsTable)
        .set({ quantity: sql`${productsTable.quantity}::numeric - ${qtyStr}::numeric` })
        .where(and(
          eq(productsTable.id, item.product_id),
          eq(productsTable.company_id, companyId),
          sql`${productsTable.quantity}::numeric >= ${qtyStr}::numeric`,
        ))
        .returning({ quantity: productsTable.quantity });

      if (updated.length === 0) {
        throw httpError(400,
          `كمية "${item.product_name}" في المخزون (${Number(prod.quantity).toFixed(3)}) أقل من الكمية المطلوبة (${item.quantity}) — لا يمكن البيع بكميات تتجاوز المخزون المتاح`,
        );
      }
      const oldQty = Number(prod.quantity);
      const newQty = Number(updated[0].quantity);

      await tx.insert(saleItemsTable).values({
        sale_id:      newSale.id,
        product_id:   item.product_id,
        product_name: item.product_name,
        quantity:     qtyStr,
        unit_price:   String(item.unit_price),
        total_price:  String(item.total_price),
        cost_price:   String(costAtSale),
        cost_total:   String(costTotal),
      });

      await tx.insert(stockMovementsTable).values({
        product_id:      item.product_id,
        product_name:    item.product_name,
        movement_type:   "sale",
        quantity:        String(-item.quantity),
        quantity_before: String(oldQty),
        quantity_after:  String(newQty),
        unit_cost:       String(costAtSale),
        reference_type:  "sale",
        reference_id:    newSale.id,
        reference_no:    invoiceNo,
        notes:           customer_name ? `مبيعات لـ ${customer_name}` : "فاتورة مبيعات",
        date:            new Date().toISOString().split("T")[0],
        warehouse_id:    tenantWarehouseId,
        company_id:      companyId,
      });
    }

    // 3.5 ضريبة القيمة المضافة
    if (totalTaxAmount > 0) {
      const effectiveTaxRate = total_amount > 0 ? (totalTaxAmount / total_amount) * 100 : 0;
      await tx.update(salesTable).set({
        tax_amount: String(totalTaxAmount.toFixed(2)),
        tax_rate:   String(effectiveTaxRate.toFixed(2)),
      }).where(eq(salesTable.id, newSale.id));
    }

    // 4. رصيد العميل (الآجل)
    if (effectiveCreditAmount > 0 && customer_id) {
      const [cust] = await tx.select().from(customersTable).where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, companyId)));
      if (cust) {
        await tx.update(customersTable)
          .set({ balance: String(Number(cust.balance) + effectiveCreditAmount) })
          .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, companyId)));
      }
    }

    // 5. رصيد الخزائن
    for (const p of cashPayments) {
      if (!p.safe_id || p.amount <= 0) continue;
      const safeRec = safeRecords.get(p.safe_id);
      if (!safeRec) continue;
      const newBal = Number(safeRec.balance) + p.amount;
      await tx.update(safesTable)
        .set({ balance: String(newBal) })
        .where(and(eq(safesTable.id, p.safe_id), eq(safesTable.company_id, companyId)));
      safeRecords.set(p.safe_id, { ...safeRec, balance: String(newBal) });
    }

    // 6. دفتر أستاذ العميل
    if (customer_id) {
      if (total_amount > 0) {
        await tx.insert(customerLedgerTable).values({
          customer_id, type: "sale", amount: String(total_amount),
          reference_type: "sale", reference_id: newSale.id, reference_no: invoiceNo,
          description: `فاتورة مبيعات ${invoiceNo}`,
          date: date ?? new Date().toISOString().split("T")[0], company_id: companyId,
        });
      }
      if (effectivePaidAmount > 0) {
        await tx.insert(customerLedgerTable).values({
          customer_id, type: "payment", amount: String(-effectivePaidAmount),
          reference_type: "sale", reference_id: newSale.id, reference_no: invoiceNo,
          description: `دفعة فورية على فاتورة ${invoiceNo}`,
          date: date ?? new Date().toISOString().split("T")[0], company_id: companyId,
        });
      }
    }

    // 7. الحركات المالية المركزية
    const txBase = {
      reference_type: "sale" as const,
      reference_id: newSale.id,
      customer_id: customer_id ?? null,
      customer_name: customer_name ?? null,
      description: `فاتورة مبيعات ${invoiceNo}`,
      date: new Date().toISOString().split("T")[0],
      company_id: companyId,
    };
    for (const p of cashPayments) {
      const safeRec = p.safe_id ? safeRecords.get(p.safe_id) : null;
      await tx.insert(transactionsTable).values({
        ...txBase, type: "sale_cash",
        safe_id: p.safe_id ?? null, safe_name: safeRec?.name ?? null,
        amount: String(p.amount), direction: "in",
      });
    }
    if (effectiveCreditAmount > 0) {
      await tx.insert(transactionsTable).values({
        ...txBase, type: "sale_credit",
        safe_id: null, safe_name: null,
        amount: String(effectiveCreditAmount), direction: "none",
      });
    }
    if (cashPayments.length === 0 && effectiveCreditAmount === 0) {
      await tx.insert(transactionsTable).values({
        ...txBase, type: "sale_cash",
        safe_id: null, safe_name: null,
        amount: String(total_amount), direction: "none",
      });
    }

    return newSale;
  });

  void writeAuditLog({
    action: "create",
    record_type: "sale",
    record_id: sale.id,
    new_value: { invoice_no: sale.invoice_no, total_amount, payment_type: computedPaymentType, customer_name: customer_name ?? null, customer_id: customer_id ?? null, role },
    user: { id: req.user?.id, username: req.user?.username },
  });

  // Cashier: immediate post (no draft concept at cashier level)
  if (role === "cashier") {
    const postLines = await buildSaleJournalLines(sale, companyId);
    await db.transaction(async (tx) => {
      if (postLines.length >= 2) {
        await createJournalEntry({
          date: sale.date ?? new Date().toISOString().split("T")[0],
          description: `فاتورة مبيعات ${sale.invoice_no}${sale.customer_name ? ` — ${sale.customer_name}` : ""}`,
          reference: sale.invoice_no,
          lines: postLines,
          companyId,
        }, tx);
      }
      await tx.update(salesTable).set({ posting_status: "posted" }).where(eq(salesTable.id, sale.id));
    });
    const [postedSale] = await db.select().from(salesTable).where(eq(salesTable.id, sale.id));
    void runAllChecks({ customerId: sale.customer_id ?? undefined });
    void triggerBackup("sale_post");
    return res.status(201).json(formatSale(postedSale ?? sale));
  }

  return res.status(201).json(formatSale(sale));
}));

export default router;
