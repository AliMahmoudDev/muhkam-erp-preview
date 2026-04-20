import { Router, type IRouter } from "express";
import { eq, and, gt, ne, not, inArray, gte, lte, count, ilike, or, desc, sql } from "drizzle-orm";
import { db, salesTable, saleItemsTable, productsTable, customersTable, transactionsTable, safesTable, warehousesTable, erpUsersTable, stockMovementsTable, accountsTable, salesReturnsTable, receiptVouchersTable, journalEntriesTable, journalEntryLinesTable, customerLedgerTable } from "@workspace/db";
import {
  GetSalesResponse,
  CreateSaleBody,
  GetSaleByIdParams,
  GetSaleByIdResponse,
} from "@workspace/api-zod";
import { wrap, httpError } from "../lib/async-handler";
import { triggerBackup } from "../lib/backup-service";
import { assertPeriodOpen } from "../lib/period-lock";
import { getCustomerLedgerBalance } from "../lib/ledger-balance";
import { runAllChecks } from "../lib/alert-service";
import { writeAuditLog } from "../lib/audit-log";
import { hasPermission } from "../lib/permissions";
import { resolveTenantWarehouseId } from "../lib/warehouse-guard";
import {
  getOrCreateSalesRevenueAccount,
  getOrCreateSafeAccount,
  getOrCreateCustomerAccount,
  getOrCreateCOGSAccount,
  getOrCreateInventoryAccount,
  getOrCreateVatPayableAccount,
  createJournalEntry,
  type JournalLine,
} from "../lib/auto-account";

const router: IRouter = Router();

function formatSale(s: typeof salesTable.$inferSelect) {
  return {
    ...s,
    total_amount: Number(s.total_amount),
    paid_amount: Number(s.paid_amount),
    remaining_amount: Number(s.remaining_amount),
    created_at: s.created_at.toISOString(),
  };
}

function formatSaleItem(item: typeof saleItemsTable.$inferSelect) {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
    cost_price: item.cost_price != null ? Number(item.cost_price) : null,
    cost_total: item.cost_total != null ? Number(item.cost_total) : null,
    quantity_returned: item.quantity_returned != null ? Number(item.quantity_returned) : null,
  };
}

router.get("/sales", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_sales")) {
    res.status(403).json({ error: "غير مصرح بعرض المبيعات" }); return;
  }
  const role = req.user?.role ?? "cashier";
  const queryWarehouseId = req.query.warehouse_id ? parseInt(String(req.query.warehouse_id), 10) : null;
  const effectiveWarehouseId = (role === "admin" || role === "manager")
    ? queryWarehouseId
    : (req.user?.warehouse_id ?? null);
  if ((role === "cashier" || role === "salesperson") && effectiveWarehouseId === null) {
    res.status(403).json({ error: "المستخدم غير مرتبط بمخزن" }); return;
  }
  const companyId = req.user?.company_id ?? null;
  const salesWhere = and(
    effectiveWarehouseId ? eq(salesTable.warehouse_id, effectiveWarehouseId) : undefined,
    companyId !== null ? eq(salesTable.company_id, companyId) : undefined,
  );
  /* ── Pagination params ────────────────────────────────────────────────────
     page  = 1-based page number (default: 1)
     limit = records per page (default: 200, max: 1000)
     date_from / date_to = YYYY-MM-DD optional date filter
  ─────────────────────────────────────────────────────────────────────────── */
  const rawLimit = parseInt(String(req.query.limit ?? "200"), 10);
  const pageLimit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 1000);
  const rawPage  = parseInt(String(req.query.page  ?? "1"),  10);
  const pageNum  = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
  const offset   = (pageNum - 1) * pageLimit;

  const dateFrom = req.query.date_from as string | undefined;
  const dateTo   = req.query.date_to   as string | undefined;

  /* ── Search param: ?q=   searches invoice_no, customer_name, customer_code ── */
  const q        = req.query.q ? String(req.query.q).trim() : null;
  const sortDesc = req.query.sort === "desc";

  let searchWhere: ReturnType<typeof or> | undefined;
  if (q) {
    const pat = `%${q}%`;
    // Find customer_ids whose code matches the query (cast int → text)
    const matchingCusts = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(sql`CAST(${customersTable.customer_code} AS TEXT) ILIKE ${pat}`);
    const custIds = matchingCusts.map(c => c.id);
    searchWhere = or(
      ilike(salesTable.invoice_no, pat),
      ilike(sql`COALESCE(${salesTable.customer_name}, '')`, pat),
      custIds.length > 0 ? inArray(salesTable.customer_id, custIds) : sql`false`,
    );
  }

  const fullWhere = and(
    salesWhere,
    dateFrom ? gte(salesTable.date, dateFrom) : undefined,
    dateTo   ? lte(salesTable.date, dateTo)   : undefined,
    searchWhere,
  );

  const [{ total }] = await db.select({ total: count() }).from(salesTable).where(fullWhere);
  const sales = await db.select().from(salesTable)
    .where(fullWhere)
    .orderBy(sortDesc ? desc(salesTable.created_at) : salesTable.created_at)
    .limit(pageLimit)
    .offset(offset);

  const totalCount = Number(total ?? 0);
  const pages = Math.ceil(totalCount / pageLimit);

  /* Keep backward-compat: if no page/limit params, behave like a plain array.
     When page or limit are explicit, return paginated envelope. */
  const hasPaginationParams = req.query.page !== undefined || req.query.limit !== undefined;
  if (hasPaginationParams) {
    res.json({ data: GetSalesResponse.parse(sales.map(formatSale)), total: totalCount, page: pageNum, pages, limit: pageLimit });
  } else {
    res.json(GetSalesResponse.parse(sales.map(formatSale)));
  }
}));

router.post("/sales", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_create_sale")) {
    res.status(403).json({ error: "غير مصرح بإنشاء فواتير بيع" }); return;
  }

  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const { payment_type: pt } = parsed.data;
  if (pt === "cash" && !hasPermission(req.user, "can_cash_sale")) {
    res.status(403).json({ error: "غير مصرح بالبيع النقدي" }); return;
  }
  if (pt === "partial" && !hasPermission(req.user, "can_partial_sale")) {
    res.status(403).json({ error: "غير مصرح بالبيع الجزئي" }); return;
  }
  if (pt === "credit" && !hasPermission(req.user, "can_credit_sale")) {
    res.status(403).json({ error: "غير مصرح بالبيع الآجل" }); return;
  }

  const requestId = req.headers["x-request-id"]
    ? String(req.headers["x-request-id"])
    : null;

  if (requestId) {
    const existing = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.request_id, String(requestId)), eq(salesTable.company_id, req.user!.company_id!)))
      .limit(1);

    if (existing.length > 0) {
      return res.json(existing[0]);
    }
  }
  const {
    payment_type, total_amount, paid_amount, items, customer_name, customer_id,
    notes, date, safe_id, warehouse_id, salesperson_id,
    discount_percent, discount_amount, payments: paymentsInput,
  } = parsed.data;

  // ── Business logic validation ──────────────────────────────────────────
  if (total_amount <= 0) throw httpError(400, "إجمالي الفاتورة يجب أن يكون أكبر من صفر");
  if (paid_amount < 0) throw httpError(400, "المبلغ المدفوع لا يمكن أن يكون سالباً");
  if (!items || items.length === 0) throw httpError(400, "الفاتورة يجب أن تحتوي على صنف واحد على الأقل");
  for (const item of items) {
    if (item.quantity <= 0) throw httpError(400, `كمية الصنف "${item.product_name}" يجب أن تكون أكبر من صفر`);
    if (item.unit_price < 0) throw httpError(400, `سعر الصنف "${item.product_name}" لا يمكن أن يكون سالباً`);
  }

  // ── Scope enforcement: warehouse + safe ──────────────────────────────
  const role = req.user?.role ?? "cashier";
  const bodyWarehouseId = warehouse_id ? Number(warehouse_id) : null;
  const effectiveWarehouseId = (role === "admin" || role === "manager") ? bodyWarehouseId : (req.user?.warehouse_id ?? null);

  if (effectiveWarehouseId === null) {
    res.status(400).json({ error: "يجب تحديد المخزن" }); return;
  }

  const tenantWarehouseId = await resolveTenantWarehouseId(
    bodyWarehouseId ?? effectiveWarehouseId,
    req.user!.company_id!,
  );

  // ── Build effective payments list ─────────────────────────────────────
  // If a `payments` array is provided (split payment), use it.
  // Otherwise fall back to legacy single-payment fields.
  type PaymentEntry = { type: "cash" | "credit"; safe_id: number | null; amount: number };
  let effectivePayments: PaymentEntry[];

  if (paymentsInput && paymentsInput.length > 0) {
    effectivePayments = paymentsInput.map(p => ({
      type: p.type,
      safe_id: p.safe_id ?? null,
      amount: p.amount,
    }));
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

  const cashPayments = effectivePayments.filter(p => p.type === "cash" && p.amount > 0);
  const creditPayments = effectivePayments.filter(p => p.type === "credit" && p.amount > 0);
  const effectivePaidAmount = cashPayments.reduce((s, p) => s + p.amount, 0);
  const effectiveCreditAmount = creditPayments.reduce((s, p) => s + p.amount, 0);
  const computedPaymentType: "cash" | "credit" | "partial" =
    effectiveCreditAmount === 0 ? "cash" :
    effectivePaidAmount === 0 ? "credit" :
    "partial";
  const primarySafeId = cashPayments.length > 0 ? cashPayments[0].safe_id : null;
  const remaining = effectiveCreditAmount;

  // حساب status بعد معرفة قيم الدفعات الفعلية
  const status = effectivePaidAmount === 0 && effectiveCreditAmount > 0 ? "unpaid"
    : effectiveCreditAmount > 0 ? "partial"
    : "paid";

  // Enforce safe scope for cashier / salesperson
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

  const invoiceNo = `INV-${Date.now()}`;

  const cidSale = req.user!.company_id!;
  const sale = await db.transaction(async (tx) => {
      // 1. جلب بيانات الخزن المطلوبة والتحقق من وجودها
      const safeRecords: Map<number, typeof safesTable.$inferSelect> = new Map();
      for (const p of cashPayments) {
        if (!p.safe_id) continue;
        if (safeRecords.has(p.safe_id)) continue;
        const [s] = await tx.select().from(safesTable).where(and(eq(safesTable.id, p.safe_id), eq(safesTable.company_id, cidSale)));
        if (!s) throw httpError(400, `الخزينة رقم ${p.safe_id} غير موجودة`);
        safeRecords.set(p.safe_id, s);
      }
      const primarySafe = primarySafeId ? safeRecords.get(primarySafeId) ?? null : null;

      let warehouseName: string | null = null;
      if (warehouse_id) {
        const [w] = await tx.select().from(warehousesTable).where(and(eq(warehousesTable.id, warehouse_id), eq(warehousesTable.company_id, cidSale)));
        if (!w) throw httpError(400, "المخزن غير موجود");
        warehouseName = w.name;
      }
      let salespersonName: string | null = null;
      if (salesperson_id) {
        const [u] = await tx.select().from(erpUsersTable).where(and(eq(erpUsersTable.id, salesperson_id), eq(erpUsersTable.company_id, cidSale)));
        if (!u) throw httpError(400, "البائع غير موجود");
        salespersonName = u.name;
      }

      // Validate customer ownership if provided
      if (customer_id) {
        const [c] = await tx.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, cidSale)));
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

      // 3. البنود: خصم المخزون (atomic) + تسجيل التكلفة + حركة مخزون صادر
      let totalTaxAmount = 0; // يُحتسب تلقائياً من tax_rate لكل منتج
      for (const item of items) {
        const [prod] = await tx.select().from(productsTable).where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, cidSale)));
        if (!prod) throw httpError(400, `المنتج "${item.product_name}" غير موجود`);
        const costAtSale = Number(prod.cost_price);
        const costTotal = costAtSale * item.quantity;
        // احتساب ضريبة القيمة المضافة لهذا البند (tax_rate من بيانات المنتج)
        const itemTaxRate = Number(prod.tax_rate ?? 0);
        const itemTax = item.quantity * item.unit_price * (itemTaxRate / 100);
        totalTaxAmount += itemTax;
        const qtyStr = String(item.quantity);

        // Atomic stock decrement: SELECT-then-UPDATE allows oversell under concurrency.
        // The single UPDATE with `quantity::numeric >= qty` predicate is race-safe.
        const updated = await tx.update(productsTable)
          .set({ quantity: sql`${productsTable.quantity}::numeric - ${qtyStr}::numeric` })
          .where(and(
            eq(productsTable.id, item.product_id),
            eq(productsTable.company_id, cidSale),
            sql`${productsTable.quantity}::numeric >= ${qtyStr}::numeric`,
          ))
          .returning({ quantity: productsTable.quantity });

        if (updated.length === 0) {
          const oldQtyNow = Number(prod.quantity);
          throw httpError(
            400,
            `كمية "${item.product_name}" في المخزون (${oldQtyNow.toFixed(3)}) أقل من الكمية المطلوبة (${item.quantity}) — لا يمكن البيع بكميات تتجاوز المخزون المتاح`,
          );
        }
        const oldQty = Number(prod.quantity);
        const newQty = Number(updated[0].quantity);

        await tx.insert(saleItemsTable).values({
          sale_id: newSale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: qtyStr,
          unit_price: String(item.unit_price),
          total_price: String(item.total_price),
          cost_price: String(costAtSale),
          cost_total: String(costTotal),
        });

        // ── تسجيل حركة مخزون صادر (مبيعات) ────────────────
        await tx.insert(stockMovementsTable).values({
          product_id: item.product_id,
          product_name: item.product_name,
          movement_type: "sale",
          quantity: String(-item.quantity),      // سالب = صادر
          quantity_before: String(oldQty),
          quantity_after: String(newQty),
          unit_cost: String(costAtSale),
          reference_type: "sale",
          reference_id: newSale.id,
          reference_no: invoiceNo,
          notes: customer_name ? `مبيعات لـ ${customer_name}` : "فاتورة مبيعات",
          date: new Date().toISOString().split("T")[0],
          warehouse_id: tenantWarehouseId,
          company_id: cidSale,
        });
      }

      // 3.5 تحديث ضريبة القيمة المضافة المحتسبة على الفاتورة
      if (totalTaxAmount > 0) {
        const effectiveTaxRate = total_amount > 0 ? (totalTaxAmount / total_amount) * 100 : 0;
        await tx.update(salesTable).set({
          tax_amount: String(totalTaxAmount.toFixed(2)),
          tax_rate:   String(effectiveTaxRate.toFixed(2)),
        }).where(eq(salesTable.id, newSale.id));
      }

      // 4. تحديث رصيد العميل (الدين الآجل فقط)
      if (effectiveCreditAmount > 0 && customer_id) {
        const [cust] = await tx.select().from(customersTable).where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, cidSale)));
        if (cust) {
          await tx.update(customersTable)
            .set({ balance: String(Number(cust.balance) + effectiveCreditAmount) })
            .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, cidSale)));
        }
      }

      // 5. تحديث رصيد كل خزينة من المدفوعات النقدية
      for (const p of cashPayments) {
        if (!p.safe_id || p.amount <= 0) continue;
        const safeRec = safeRecords.get(p.safe_id);
        if (!safeRec) continue;
        const newBal = Number(safeRec.balance) + p.amount;
        await tx.update(safesTable)
          .set({ balance: String(newBal) })
          .where(and(eq(safesTable.id, p.safe_id), eq(safesTable.company_id, cidSale)));
        // تحديث الرصيد المحلي للاستخدام اللاحق في نفس الـ loop إذا لزم
        safeRecords.set(p.safe_id, { ...safeRec, balance: String(newBal) });
      }

      // 6. دفتر أستاذ العميل — تسجيل فوري بصرف النظر عن الترحيل
      if (customer_id) {
        // أ. الدين المتبقي على العميل (إجمالي البيع أو المتبقي)
        if (total_amount > 0) {
          await tx.insert(customerLedgerTable).values({
            customer_id,
            type: "sale",
            amount: String(total_amount),
            reference_type: "sale",
            reference_id: newSale.id,
            reference_no: invoiceNo,
            description: `فاتورة مبيعات ${invoiceNo}`,
            date: date ?? new Date().toISOString().split("T")[0],
            company_id: cidSale,
          });
        }
        // ب. الدفعة الفورية (نقدي) → تُقلّل الدين
        if (effectivePaidAmount > 0) {
          await tx.insert(customerLedgerTable).values({
            customer_id,
            type: "payment",
            amount: String(-effectivePaidAmount),
            reference_type: "sale",
            reference_id: newSale.id,
            reference_no: invoiceNo,
            description: `دفعة فورية على فاتورة ${invoiceNo}`,
            date: date ?? new Date().toISOString().split("T")[0],
            company_id: cidSale,
          });
        }
      }

      // 7. الحركات المالية المركزية — سجل لكل خزينة + سجل للآجل
      const txBase = {
        reference_type: "sale" as const,
        reference_id: newSale.id,
        customer_id: customer_id ?? null,
        customer_name: customer_name ?? null,
        description: `فاتورة مبيعات ${invoiceNo}`,
        date: new Date().toISOString().split("T")[0],
        company_id: cidSale,
      };
      for (const p of cashPayments) {
        const safeRec = p.safe_id ? safeRecords.get(p.safe_id) : null;
        await tx.insert(transactionsTable).values({
          ...txBase,
          type: "sale_cash",
          safe_id: p.safe_id ?? null,
          safe_name: safeRec?.name ?? null,
          amount: String(p.amount),
          direction: "in",
        });
      }
      if (effectiveCreditAmount > 0) {
        await tx.insert(transactionsTable).values({
          ...txBase,
          type: "sale_credit",
          safe_id: null,
          safe_name: null,
          amount: String(effectiveCreditAmount),
          direction: "none",
        });
      }
      if (cashPayments.length === 0 && effectiveCreditAmount === 0) {
        await tx.insert(transactionsTable).values({
          ...txBase,
          type: "sale_cash",
          safe_id: null,
          safe_name: null,
          amount: String(total_amount),
          direction: "none",
        });
      }

      return newSale;
  });

  // ── تسجيل حدث الإنشاء في سجل المراجعة ───────────────────────────────────
  void writeAuditLog({
    action: "create",
    record_type: "sale",
    record_id: sale.id,
    new_value: {
      invoice_no: sale.invoice_no,
      total_amount: total_amount,
      payment_type: computedPaymentType,
      customer_name: customer_name ?? null,
      customer_id: customer_id ?? null,
      role,
    },
    user: { id: req.user?.id, username: req.user?.username },
  });

  // ── ترحيل فوري للكاشير ───────────────────────────────────────────────────
  // الكاشير لا يعرف مفهوم المسودة — كل فاتورة تُرحَّل فوراً عند الإنشاء
  if (role === "cashier") {
    const postLines = await buildSaleJournalLines(sale, cidSale);
    await db.transaction(async (tx) => {
      if (postLines.length >= 2) {
        await createJournalEntry({
          date: sale.date ?? new Date().toISOString().split("T")[0],
          description: `فاتورة مبيعات ${sale.invoice_no}${sale.customer_name ? ` — ${sale.customer_name}` : ""}`,
          reference: sale.invoice_no,
          lines: postLines,
          companyId: cidSale,
        }, tx);
      }
      await tx.update(salesTable).set({ posting_status: "posted" }).where(eq(salesTable.id, sale.id));
    });
    const [postedSale] = await db.select().from(salesTable).where(eq(salesTable.id, sale.id));
    void runAllChecks({ customerId: sale.customer_id ?? undefined });
    void triggerBackup("sale_post");
    return res.status(201).json(formatSale(postedSale ?? sale));
  }

  // القيد المحاسبي يُنشأ عند الترحيل (POST /sales/:id/post) — ليس عند الإنشاء
  return res.status(201).json(formatSale(sale));
}));

router.get("/sales/:id", wrap(async (req, res) => {
  const params = GetSaleByIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, params.data.id), eq(salesTable.company_id, req.user!.company_id!)));
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.sale_id, sale.id));

  res.json(GetSaleByIdResponse.parse({
    ...formatSale(sale),
    items: items.map(formatSaleItem),
  }));
}));

/* ── بناء قيود المبيعات ─────────────────────────────────────────────────── */
//
// قيد الإيراد (Revenue Entry):
//   مدين:  خزينة (SAFE) بمبلغ المحصّل — أو ذمم عميل (AR) بالمتبقي
//   دائن:  إيرادات المبيعات (REV-SALES) بالإجمالي
//
// قيد تكلفة البضاعة المباعة (COGS Entry):
//   مدين:  تكلفة البضاعة المباعة (EXP-COGS) بإجمالي تكلفة الأصناف
//   دائن:  مخزون البضاعة (ASSET-INVENTORY) بنفس المبلغ
//
// هذا يضمن:
//   - ظهور الإيرادات وتكلفة البضاعة بشكل صحيح في قائمة الدخل
//   - انخفاض قيمة المخزون في الميزانية العمومية عند البيع
//   - الربح = الإيرادات - COGS (وليس مجرد الفارق بين سعر البيع وتكلفة المنتج الحالية)
//
async function buildSaleJournalLines(sale: typeof salesTable.$inferSelect, companyId: number): Promise<JournalLine[]> {
  const total     = Number(sale.total_amount);
  const paid      = Number(sale.paid_amount);
  const debt      = total - paid;
  const taxAmount = Number((sale as any).tax_amount ?? 0);
  const netRevenue = total - taxAmount;  // الإيراد صافي بدون ضريبة
  const lines: JournalLine[] = [];

  // ── قيد الإيراد (صافي بدون ضريبة) ──────────────────────────────────────
  const revenueAcct = await getOrCreateSalesRevenueAccount(companyId);
  lines.push({ account: revenueAcct, debit: 0, credit: netRevenue > 0 ? netRevenue : total });

  // ── قيد ضريبة القيمة المضافة (دائن: التزام ضريبي) ──────────────────────
  if (taxAmount > 0) {
    const vatPayableAcct = await getOrCreateVatPayableAccount(companyId);
    lines.push({ account: vatPayableAcct, debit: 0, credit: taxAmount });
  }

  if (paid > 0 && sale.safe_id && sale.safe_name) {
    const safeAcct = await getOrCreateSafeAccount(sale.safe_id, sale.safe_name, companyId);
    lines.push({ account: safeAcct, debit: paid, credit: 0 });
  }

  if (debt > 0 && sale.customer_id) {
    const [cust] = await db.select().from(customersTable).where(and(eq(customersTable.id, sale.customer_id), eq(customersTable.company_id, companyId)));
    if (cust?.account_id) {
      const [acctRow] = await db.select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
        .from(accountsTable).where(and(eq(accountsTable.id, cust.account_id), eq(accountsTable.company_id, companyId)));
      if (acctRow) lines.push({ account: acctRow, debit: debt, credit: 0 });
    } else if (cust?.customer_code) {
      const custAcct = await getOrCreateCustomerAccount(cust.customer_code, cust.name, companyId);
      lines.push({ account: custAcct, debit: debt, credit: 0 });
    }
  }

  const saleItems = await db.select({ cost_total: saleItemsTable.cost_total })
    .from(saleItemsTable)
    .where(eq(saleItemsTable.sale_id, sale.id));

  const totalCOGS = saleItems.reduce((sum, item) => sum + Number(item.cost_total), 0);

  if (totalCOGS > 0) {
    const cogsAcct      = await getOrCreateCOGSAccount(companyId);
    const inventoryAcct = await getOrCreateInventoryAccount(companyId);
    lines.push({ account: cogsAcct,      debit: totalCOGS, credit: 0 });
    lines.push({ account: inventoryAcct, debit: 0, credit: totalCOGS });
  }

  return lines;
}

/* ── ترحيل الفاتورة (draft → posted) ───────────────────────────────────── */
router.post("/sales/:id/post", wrap(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.company_id, req.user!.company_id!)));
  if (!sale) throw httpError(404, "الفاتورة غير موجودة");
  if (sale.posting_status === "posted")    throw httpError(400, "الفاتورة مرحَّلة بالفعل");
  if (sale.posting_status === "cancelled") throw httpError(400, "لا يمكن ترحيل فاتورة ملغاة");

  await assertPeriodOpen(sale.date, req);

  const cidPost = req.user!.company_id!;
  const lines = await buildSaleJournalLines(sale, cidPost);

  const updated = await db.transaction(async (tx) => {
    if (lines.length >= 2) {
      await createJournalEntry({
        date: sale.date ?? new Date().toISOString().split("T")[0],
        description: `فاتورة مبيعات ${sale.invoice_no}${sale.customer_name ? ` — ${sale.customer_name}` : ""}`,
        reference: sale.invoice_no,
        lines,
        companyId: cidPost,
      }, tx);
    }
    const [row] = await tx.update(salesTable)
      .set({ posting_status: "posted" })
      .where(and(eq(salesTable.id, id), eq(salesTable.company_id, cidPost)))
      .returning();
    return row;
  });

  // Fire-and-forget alert checks after posting
  const saleItems = await db.select({ product_id: saleItemsTable.product_id })
    .from(saleItemsTable).where(eq(saleItemsTable.sale_id, id));
  const customerIdForAlert = updated.customer_id ?? undefined;
  void runAllChecks({ customerId: customerIdForAlert });
  for (const item of saleItems) {
    if (item.product_id) void runAllChecks({ productId: item.product_id });
  }

  // Fire-and-forget backup after sale post
  void triggerBackup("sale_post");

  res.json(formatSale(updated));
}));

/* ── إلغاء الفاتورة → عكس كامل (مخزون + أرصدة + قيد محاسبي) ─────────── */
router.post("/sales/:id/cancel", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_cancel_sale")) {
    res.status(403).json({ error: "غير مصرح بإلغاء الفواتير" }); return;
  }
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const [sale] = await db.select().from(salesTable).where(and(eq(salesTable.id, id), eq(salesTable.company_id, req.user!.company_id!)));
  if (!sale) throw httpError(404, "الفاتورة غير موجودة");
  if (sale.posting_status === "cancelled") throw httpError(400, "الفاتورة ملغاة بالفعل");

  // ── التحقق: لا يمكن إلغاء فاتورة بها مرتجعات ────────────────────────────
  const existingReturns = await db.select({ id: salesReturnsTable.id })
    .from(salesReturnsTable)
    .where(eq(salesReturnsTable.sale_id, id));
  if (existingReturns.length > 0) {
    throw httpError(400, "لا يمكن إلغاء فاتورة مرتبطة بمرتجعات — يجب حذف المرتجعات أولاً");
  }

  // ── فحص 1: سندات قبض لاحقة مقيّدة على نفس العميل ───────────────────────
  // إذا وجدت سندات قبض غير ملغاة بعد تاريخ الفاتورة → توقف
  // (الإلغاء يرد ذمة العميل ؛ لكن تلك الذمة ربما سُدِّدت جزئياً بهذه السندات)
  if (sale.customer_id && Number(sale.remaining_amount) > 0) {
    const laterRVs = await db
      .select({ id: receiptVouchersTable.id, voucher_no: receiptVouchersTable.voucher_no })
      .from(receiptVouchersTable)
      .where(and(
        eq(receiptVouchersTable.customer_id, sale.customer_id),
        gt(receiptVouchersTable.date, sale.date ?? ""),
        ne(receiptVouchersTable.posting_status, "cancelled"),
      ));
    if (laterRVs.length > 0) {
      const nos = laterRVs.map(v => v.voucher_no).join("، ");
      throw httpError(400,
        `لا يمكن الإلغاء: توجد ${laterRVs.length} سند(ات) قبض مُسجَّلة على هذا العميل بعد تاريخ الفاتورة (${nos}) — قد تكون مقيّدة على هذه الذمة`
      );
    }
  }

  // ── فحص 2: الإلغاء سيجعل رصيد العميل المحاسبي سالباً (مرحَّلة فقط) ────────
  // لا نفحص المسوّدات لأنها لم تُرحَّل بعد (لا قيود محاسبية بعد)
  if (sale.posting_status === "posted" && sale.customer_id && Number(sale.remaining_amount) > 0.001) {
    const [custRow] = await db
      .select({ account_id: customersTable.account_id, name: customersTable.name })
      .from(customersTable)
      .where(eq(customersTable.id, sale.customer_id));
    if (custRow) {
      const ledgerBal = await getCustomerLedgerBalance(custRow.account_id);
      if (ledgerBal < Number(sale.remaining_amount) - 0.001) {
        throw httpError(400,
          `لا يمكن الإلغاء: رصيد دفتر الأستاذ للعميل (${ledgerBal.toFixed(2)}) أقل من الذمة المُراد عكسها (${Number(sale.remaining_amount).toFixed(2)}) — الإلغاء سيجعل الرصيد سالباً`
        );
      }
    }
  }

  // ── فحص 3: قيود محاسبية لاحقة على نفس الحسابات ─────────────────────────
  // نجد القيد المرتبط بهذه الفاتورة ثم نتحقق من وجود قيود أحدث على نفس الحسابات
  if (sale.posting_status === "posted") {
    const [saleJE] = await db
      .select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.reference, sale.invoice_no));

    if (saleJE) {
      const jeLines = await db
        .select({ account_id: journalEntryLinesTable.account_id })
        .from(journalEntryLinesTable)
        .where(eq(journalEntryLinesTable.entry_id, saleJE.id));

      const accountIds = [...new Set(jeLines.map(l => l.account_id))];
      if (accountIds.length > 0) {
        const laterLines = await db
          .select({ entry_id: journalEntryLinesTable.entry_id })
          .from(journalEntryLinesTable)
          .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.entry_id, journalEntriesTable.id))
          .where(and(
            inArray(journalEntryLinesTable.account_id, accountIds),
            gt(journalEntriesTable.date, sale.date ?? ""),
            not(eq(journalEntriesTable.id, saleJE.id)),
          ))
          .limit(1);

        if (laterLines.length > 0) {
          throw httpError(400,
            "لا يمكن العكس: توجد قيود محاسبية لاحقة مبنية على نفس حسابات هذه الفاتورة — راجع دفتر الأستاذ قبل الإلغاء"
          );
        }
      }
    }
  }

  await assertPeriodOpen(sale.date, req);

  const effectiveWarehouseId = req.user?.warehouse_id ?? null;
  const tenantWarehouseId = await resolveTenantWarehouseId(
    sale.warehouse_id ?? effectiveWarehouseId,
    req.user!.company_id!,
  );

  const today = new Date().toISOString().split("T")[0];

  const cidCancel = req.user!.company_id!;
  await db.transaction(async (tx) => {
    // ── 1. عكس القيد المحاسبي (للفواتير المرحَّلة فقط) ──────────────────
    if (sale.posting_status === "posted") {
      const lines = await buildSaleJournalLines(sale, cidCancel);
      if (lines.length >= 2) {
        const reversed = lines.map(l => ({ account: l.account, debit: l.credit, credit: l.debit }));
        await createJournalEntry({
          date: today,
          description: `إلغاء فاتورة مبيعات ${sale.invoice_no}${sale.customer_name ? ` — ${sale.customer_name}` : ""}`,
          reference: `REV-${sale.invoice_no}`,
          lines: reversed,
          companyId: cidCancel,
        }, tx);
      }
    }

    // ── 2. إعادة المخزون لكل بند + تعديل WAC ─────────────────────────────
    // نستخدم cost_price المحفوظ في sale_items (= WAC التاريخي وقت البيع)
    const saleItems = await tx.select().from(saleItemsTable)
      .where(eq(saleItemsTable.sale_id, sale.id));

    for (const item of saleItems) {
      const qty          = Number(item.quantity);
      const costAtSale   = Number(item.cost_price);

      // SELECT FOR UPDATE — locks this product row for the duration of the txn,
      // preventing concurrent cancel/sale races from reading a stale quantity.
      const lockResult = await tx.execute(
        sql`SELECT id, quantity::text AS qty, cost_price::text AS wac
            FROM products
            WHERE id = ${item.product_id} AND company_id = ${cidCancel}
            FOR UPDATE`
      );
      if (!lockResult.rows.length) continue; // not this tenant's product — skip
      const lockedProd = lockResult.rows[0] as { id: number; qty: string; wac: string };

      const oldQty = Number(lockedProd.qty);
      const oldWAC = Number(lockedProd.wac);
      const newQty = oldQty + qty;
      const newWAC = newQty > 0
        ? ((oldQty * oldWAC) + (qty * costAtSale)) / newQty
        : costAtSale;

      await tx.update(productsTable)
        .set({ quantity: String(newQty), cost_price: String(newWAC.toFixed(4)) })
        .where(and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, cidCancel)));

      await tx.insert(stockMovementsTable).values({
        product_id:      item.product_id,
        product_name:    item.product_name,
        movement_type:   "adjustment",
        quantity:        String(qty),
        quantity_before: String(oldQty),
        quantity_after:  String(newQty),
        unit_cost:       String(costAtSale),
        reference_type:  "sale_cancel",
        reference_id:    sale.id,
        reference_no:    sale.invoice_no,
        notes:           `إلغاء فاتورة مبيعات ${sale.invoice_no}`,
        date:            today,
        warehouse_id:    tenantWarehouseId,
        company_id:      cidCancel,
      });
    }

    // ── 3. عكس رصيد العميل (الآجل / الجزئي) ─────────────────────────────
    const remainingAmt = Number(sale.remaining_amount);
    if (remainingAmt > 0 && sale.customer_id) {
      const [cust] = await tx.select().from(customersTable)
        .where(and(eq(customersTable.id, sale.customer_id), eq(customersTable.company_id, cidCancel)));
      if (cust) {
        await tx.update(customersTable)
          .set({ balance: String(Number(cust.balance) - remainingAmt) })
          .where(and(eq(customersTable.id, cust.id), eq(customersTable.company_id, cidCancel)));
      }
    }

    // ── 4. عكس رصيد الخزينة (النقدي / الجزئي) ────────────────────────────
    const paidAmt = Number(sale.paid_amount);
    if (paidAmt > 0 && sale.safe_id) {
      const [safe] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, sale.safe_id), eq(safesTable.company_id, cidCancel)));
      if (safe) {
        await tx.update(safesTable)
          .set({ balance: String(Number(safe.balance) - paidAmt) })
          .where(and(eq(safesTable.id, sale.safe_id), eq(safesTable.company_id, cidCancel)));
      }
      await tx.insert(transactionsTable).values({
        type:           "sale_cancel",
        reference_type: "sale_cancel",
        reference_id:   sale.id,
        safe_id:        sale.safe_id,
        safe_name:      sale.safe_name ?? "",
        customer_id:    sale.customer_id ?? null,
        customer_name:  sale.customer_name ?? null,
        amount:         String(paidAmt),
        direction:      "out",
        description:    `إلغاء فاتورة مبيعات ${sale.invoice_no}`,
        date:           today,
        company_id:     cidCancel,
      });
    }

    // ── 5. عكس قيود دفتر الأستاذ (مصدر الحقيقة الوحيد) ──────────────────
    // بدلاً من حذف القيود القديمة، نُدرج قيوداً عكسية للشفافية
    if (sale.customer_id) {
      const totalAmt = Number(sale.total_amount);
      if (totalAmt > 0) {
        await tx.insert(customerLedgerTable).values({
          customer_id:    sale.customer_id,
          type:           "sale_cancel",
          amount:         String(-totalAmt),
          reference_type: "sale",
          reference_id:   sale.id,
          reference_no:   sale.invoice_no,
          description:    `إلغاء فاتورة مبيعات ${sale.invoice_no}`,
          date:           today,
          company_id:     cidCancel,
        });
      }
      if (paidAmt > 0) {
        await tx.insert(customerLedgerTable).values({
          customer_id:    sale.customer_id,
          type:           "sale_cancel",
          amount:         String(paidAmt),
          reference_type: "sale",
          reference_id:   sale.id,
          reference_no:   sale.invoice_no,
          description:    `إلغاء دفعة فاتورة ${sale.invoice_no}`,
          date:           today,
          company_id:     cidCancel,
        });
      }
    }

    // ── 6. تحديث حالة الفاتورة ────────────────────────────────────────────
    await tx.update(salesTable)
      .set({ posting_status: "cancelled" })
      .where(eq(salesTable.id, id));
  });

  const [updated] = await db.select().from(salesTable).where(eq(salesTable.id, id));

  void writeAuditLog({
    action: "cancel",
    record_type: "sale",
    record_id: id,
    old_value: { posting_status: "posted", invoice_no: sale.invoice_no },
    new_value: { posting_status: "cancelled" },
    user: { id: req.user?.id, username: req.user?.username },
  });

  res.json(formatSale(updated));
}));

export default router;
