import { Router, type IRouter } from 'express';
import { eq, and, gt, not, inArray, sql, desc } from 'drizzle-orm';
import {
  db,
  purchasesTable,
  purchaseItemsTable,
  productsTable,
  customersTable,
  safesTable,
  transactionsTable,
  stockMovementsTable,
  accountsTable,
  purchaseReturnsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  customerLedgerTable,
} from '@workspace/db';
import {
  GetPurchasesResponse,
  CreatePurchaseBody,
  GetPurchaseByIdParams,
  GetPurchaseByIdResponse,
} from '@workspace/api-zod';
import { wrap, httpError } from '../lib/async-handler';
import { triggerBackup } from '../lib/backup-service';
import { nextPurchaseInvoiceNo } from '../lib/invoice-no';
import { assertPeriodOpen } from '../lib/period-lock';
import { runAllChecks } from '../lib/alert-service';
import { hasPermission } from '../lib/permissions';
import { resolveTenantWarehouseId } from '../lib/warehouse-guard';
import { getTenant } from '../middleware/auth';
import {
  getOrCreateInventoryAccount,
  getOrCreateSafeAccount,
  getOrCreateCustomerPayableAccount,
  getOrCreateVatInputAccount,
  createJournalEntry,
  type JournalLine,
} from '../lib/auto-account';

const router: IRouter = Router();

function formatPurchase(p: typeof purchasesTable.$inferSelect) {
  return {
    ...p,
    total_amount: Number(p.total_amount),
    paid_amount: Number(p.paid_amount),
    remaining_amount: Number(p.remaining_amount),
    exchange_rate: Number((p as Record<string, unknown>).exchange_rate ?? 1),
    currency: String((p as Record<string, unknown>).currency ?? 'EGP'),
    shipping_cost: Number((p as Record<string, unknown>).shipping_cost ?? 0),
    created_at: p.created_at.toISOString(),
  };
}

function formatPurchaseItem(item: typeof purchaseItemsTable.$inferSelect) {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
    quantity_returned: item.quantity_returned != null ? Number(item.quantity_returned) : null,
  };
}

router.get(
  '/purchases',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_purchases')) {
      res.status(403).json({ error: 'غير مصرح بعرض المشتريات' });
      return;
    }
    const companyId = getTenant(req);

    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const rawLimit = parseInt(String(req.query.limit ?? '200'), 10);
    const pageLimit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 1000);
    const rawPage = parseInt(String(req.query.page ?? '1'), 10);
    const pageNum = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const offset = (pageNum - 1) * pageLimit;

    if (hasPagination) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(purchasesTable)
        .where(eq(purchasesTable.company_id, companyId));

      const purchases = await db
        .select()
        .from(purchasesTable)
        .where(eq(purchasesTable.company_id, companyId))
        .orderBy(desc(purchasesTable.created_at))
        .limit(pageLimit)
        .offset(offset);

      return res.json({
        data: GetPurchasesResponse.parse(purchases.map(formatPurchase)),
        total: Number(total),
        page: pageNum,
        pages: Math.ceil(Number(total) / pageLimit),
        limit: pageLimit,
      });
    }

    const purchases = await db
      .select()
      .from(purchasesTable)
      .where(eq(purchasesTable.company_id, companyId))
      .orderBy(desc(purchasesTable.created_at))
      .limit(500);
    return res.json(GetPurchasesResponse.parse(purchases.map(formatPurchase)));
  })
);

router.post(
  '/purchases',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_create_purchase')) {
      res.status(403).json({ error: 'غير مصرح بإنشاء فواتير شراء' });
      return;
    }

    const parsed = CreatePurchaseBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const requestId = req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null;

    if (requestId) {
      const [existing] = await db
        .select()
        .from(purchasesTable)
        .where(
          and(
            eq(purchasesTable.request_id, requestId),
            eq(purchasesTable.company_id, getTenant(req))
          )
        )
        .limit(1);
      if (existing) return res.json(formatPurchase(existing));
    }

    const {
      payment_type,
      total_amount,
      paid_amount,
      items,
      supplier_name,
      customer_id,
      customer_name,
      safe_id,
      notes,
      date,
      currency,
      exchange_rate,
      shipping_cost,
      is_consignment,
      consignment_warehouse_id,
    } = parsed.data;

    // ── Business logic validation ──────────────────────────────────────────
    if (total_amount <= 0) throw httpError(400, 'إجمالي الفاتورة يجب أن يكون أكبر من صفر');
    if (paid_amount < 0) throw httpError(400, 'المبلغ المدفوع لا يمكن أن يكون سالباً');
    if (!items || items.length === 0)
      throw httpError(400, 'الفاتورة يجب أن تحتوي على صنف واحد على الأقل');
    for (const item of items) {
      if (item.quantity <= 0)
        throw httpError(400, `كمية الصنف "${item.product_name}" يجب أن تكون أكبر من صفر`);
      if (item.unit_price < 0)
        throw httpError(400, `سعر الصنف "${item.product_name}" لا يمكن أن يكون سالباً`);
    }

    const remaining = total_amount - paid_amount;

    await assertPeriodOpen(date, req);

    const role = req.user?.role ?? 'cashier';
    const bodyWarehouseId = parsed.data.warehouse_id ? Number(parsed.data.warehouse_id) : null;
    const effectiveWarehouseId =
      role === 'admin' || role === 'manager' ? bodyWarehouseId : (req.user?.warehouse_id ?? null);

    if (effectiveWarehouseId === null) {
      res.status(400).json({ error: 'يجب تحديد المخزن' });
      return;
    }

    const tenantWarehouseId = await resolveTenantWarehouseId(effectiveWarehouseId, getTenant(req));

    let status = 'paid';
    if (payment_type === 'credit') status = 'unpaid';
    else if (remaining > 0) status = 'partial';

    const today = date ?? new Date().toISOString().split('T')[0];
    const displayName = customer_name ?? supplier_name ?? null;

    if (paid_amount > 0 && !safe_id) {
      return res.status(400).json({ error: 'يجب اختيار الخزينة للمدفوعات النقدية أو الجزئية' });
    }

    const cidPurchase = getTenant(req);
    const invoiceNo = await nextPurchaseInvoiceNo(cidPurchase);

    // Validate FK ownership before mutation
    if (customer_id) {
      const [c] = await db
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(and(eq(customersTable.id, customer_id), eq(customersTable.company_id, cidPurchase)));
      if (!c) {
        res.status(400).json({ error: 'العميل/المورد غير موجود' });
        return;
      }
    }
    if (safe_id) {
      const [s] = await db
        .select({ id: safesTable.id })
        .from(safesTable)
        .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, cidPurchase)));
      if (!s) {
        res.status(400).json({ error: 'الخزينة غير موجودة' });
        return;
      }
    }

    const purchase = await db.transaction(async (tx) => {
      const [newPurchase] = await tx
        .insert(purchasesTable)
        .values({
          request_id: requestId,
          invoice_no: invoiceNo,
          supplier_name: displayName,
          customer_id: customer_id ?? null,
          customer_name: customer_name ?? null,
          payment_type,
          total_amount: String(total_amount),
          paid_amount: String(paid_amount),
          remaining_amount: String(payment_type === 'credit' ? total_amount : remaining),
          status,
          date: today,
          notes: notes ?? null,
          currency: currency ?? 'EGP',
          exchange_rate: String(exchange_rate ?? 1),
          shipping_cost: String(shipping_cost ?? 0),
          is_consignment: is_consignment ?? false,
          consignment_warehouse_id: consignment_warehouse_id ?? null,
          company_id: cidPurchase,
        })
        .returning();

      // حساب ضريبة القيمة المضافة من معدل ضريبة كل منتج
      let totalTaxAmount = 0;

      // توزيع تكلفة الشحن بالتناسب (بعد تحويلها للجنيه المصري إن كانت بعملة أجنبية)
      const rate = Number(exchange_rate ?? 1);
      const shippingCostEgp = Number(shipping_cost ?? 0) * rate;
      const itemsTotalEgp = items.reduce((s, i) => s + Number(i.total_price), 0);

      // ── Prefetch all products in ONE query (N+1 fix) ──
      const productIds = [...new Set(items.map((i) => i.product_id))];
      const productRows = await tx
        .select()
        .from(productsTable)
        .where(
          and(inArray(productsTable.id, productIds), eq(productsTable.company_id, cidPurchase))
        );
      const productMap = new Map(
        productRows.map((p) => [
          p.id,
          { qty: Number(p.quantity), cost: Number(p.cost_price), taxRate: Number(p.tax_rate ?? 0) },
        ])
      );
      for (const item of items) {
        if (!productMap.has(item.product_id))
          throw httpError(400, `المنتج "${item.product_name}" غير موجود`);
      }

      const purchaseItemValues: Array<typeof purchaseItemsTable.$inferInsert> = [];
      const stockMovementValues: Array<typeof stockMovementsTable.$inferInsert> = [];

      for (const item of items) {
        purchaseItemValues.push({
          purchase_id: newPurchase.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: String(item.quantity),
          unit_price: String(item.unit_price),
          total_price: String(item.total_price),
        });

        const prodState = productMap.get(item.product_id)!;
        const oldQty = prodState.qty;
        const oldCost = prodState.cost;
        const newItemQty = Number(item.quantity);
        // نصيب الصنف من الشحن (موزع بالتناسب مع قيمة الصنف)
        const itemShippingEgp =
          itemsTotalEgp > 0 ? shippingCostEgp * (Number(item.total_price) / itemsTotalEgp) : 0;
        const newItemCost =
          Number(item.unit_price) + (newItemQty > 0 ? itemShippingEgp / newItemQty : 0);
        const newTotalQty = oldQty + newItemQty;
        const newAvgCost =
          newTotalQty > 0
            ? (oldQty * oldCost + newItemQty * newItemCost) / newTotalQty
            : newItemCost;

        // تراكم ضريبة القيمة المضافة من معدل ضريبة المنتج
        const itemTaxRate = prodState.taxRate;
        if (itemTaxRate > 0) {
          const itemNetPrice = Number(item.unit_price) / (1 + itemTaxRate / 100);
          const itemTax = (Number(item.unit_price) - itemNetPrice) * Number(item.quantity);
          totalTaxAmount += itemTax;
        }

        // Product UPDATE stays sequential (WAC depends on running state)
        await tx
          .update(productsTable)
          .set({
            quantity: String(newTotalQty),
            cost_price: String(newAvgCost.toFixed(4)),
          })
          .where(
            and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, cidPurchase))
          );

        // Update local map for next iteration (same product may appear twice)
        prodState.qty = newTotalQty;
        prodState.cost = newAvgCost;

        stockMovementValues.push({
          product_id: item.product_id,
          product_name: item.product_name,
          movement_type: 'purchase',
          quantity: String(newItemQty),
          quantity_before: String(oldQty),
          quantity_after: String(newTotalQty),
          unit_cost: String(newItemCost),
          reference_type: 'purchase',
          reference_id: newPurchase.id,
          reference_no: invoiceNo,
          notes: displayName ? `مشتريات من ${displayName}` : 'فاتورة مشتريات',
          date: today,
          warehouse_id: tenantWarehouseId,
          company_id: cidPurchase,
        });
      }

      // ── Batch-insert purchase items and stock movements (N+1 fix) ──
      if (purchaseItemValues.length > 0) {
        await tx.insert(purchaseItemsTable).values(purchaseItemValues);
      }
      if (stockMovementValues.length > 0) {
        await tx.insert(stockMovementsTable).values(stockMovementValues);
      }

      // تحديث فاتورة المشتريات بضريبة القيمة المضافة المحسوبة تلقائياً
      if (totalTaxAmount > 0) {
        const effectivePurchaseTaxRate =
          total_amount > 0 ? (totalTaxAmount / total_amount) * 100 : 0;
        await tx
          .update(purchasesTable)
          .set({
            tax_amount: String(totalTaxAmount.toFixed(2)),
            tax_rate: String(effectivePurchaseTaxRate.toFixed(2)),
          })
          .where(eq(purchasesTable.id, newPurchase.id));
      }

      const cashOut =
        payment_type === 'cash' ? total_amount : payment_type === 'partial' ? paid_amount : 0;

      const customerDebt =
        payment_type === 'credit' ? total_amount : payment_type === 'partial' ? remaining : 0;

      if (cashOut > 0 && safe_id) {
        const [safe] = await tx
          .select()
          .from(safesTable)
          .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, cidPurchase)));
        if (safe) {
          await tx
            .update(safesTable)
            .set({ balance: String(Number(safe.balance) - cashOut) })
            .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, cidPurchase)));
          await tx.insert(transactionsTable).values({
            type: 'purchase_cash',
            reference_type: 'purchase',
            reference_id: newPurchase.id,
            safe_id: safe.id,
            safe_name: safe.name,
            customer_id: customer_id ?? null,
            customer_name: displayName,
            amount: String(cashOut),
            direction: 'out',
            description: `دفع نقدي — فاتورة مشتريات ${invoiceNo}${displayName ? ` (${displayName})` : ''}`,
            date: today,
            company_id: cidPurchase,
          });
        }
      }

      // آجل أو جزئي: رصيد العميل-المورد يصبح سالباً (نحن مدينون له)
      if (customerDebt > 0 && customer_id) {
        const [cust] = await tx
          .select()
          .from(customersTable)
          .where(
            and(eq(customersTable.id, customer_id), eq(customersTable.company_id, cidPurchase))
          );
        if (cust) {
          await tx
            .update(customersTable)
            .set({ balance: String(Number(cust.balance) - customerDebt) })
            .where(
              and(eq(customersTable.id, customer_id), eq(customersTable.company_id, cidPurchase))
            );
          await tx.insert(transactionsTable).values({
            type: 'purchase_credit',
            reference_type: 'purchase',
            reference_id: newPurchase.id,
            safe_id: null,
            safe_name: null,
            customer_id: customer_id,
            customer_name: displayName,
            amount: String(customerDebt),
            direction: 'out',
            description: `مشتريات آجل من ${displayName ?? 'مورد'} — فاتورة ${invoiceNo}`,
            date: today,
            company_id: cidPurchase,
          });

          await tx.insert(customerLedgerTable).values({
            customer_id: customer_id,
            type: 'purchase',
            amount: String(-customerDebt),
            reference_type: 'purchase',
            reference_id: newPurchase.id,
            reference_no: invoiceNo,
            description: `مشتريات آجل ${invoiceNo} — ${displayName ?? 'مورد'}`,
            date: today,
            company_id: cidPurchase,
          });
        }
      }

      return newPurchase;
    });

    return res.status(201).json(formatPurchase(purchase));
  })
);

router.get(
  '/purchases/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_purchases')) {
      res.status(403).json({ error: 'غير مصرح بعرض فواتير المشتريات' });
      return;
    }
    const params = GetPurchaseByIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [purchase] = await db
      .select()
      .from(purchasesTable)
      .where(
        and(eq(purchasesTable.id, params.data.id), eq(purchasesTable.company_id, getTenant(req)))
      );
    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found' });
      return;
    }

    const items = await db
      .select()
      .from(purchaseItemsTable)
      .where(eq(purchaseItemsTable.purchase_id, purchase.id));

    res.json(
      GetPurchaseByIdResponse.parse({
        ...formatPurchase(purchase),
        items: items.map(formatPurchaseItem),
      })
    );
  })
);

/* ── بناء قيود المشتريات ────────────────────────────────────────────────── */
async function buildPurchaseJournalLines(
  purchase: typeof purchasesTable.$inferSelect,
  companyId: number
): Promise<JournalLine[]> {
  const total = Number(purchase.total_amount);
  const paid = Number(purchase.paid_amount);
  const supplierDebt = total - paid;
  const taxAmount = Number((purchase as Record<string, unknown>).tax_amount ?? 0);
  const netCost = total - taxAmount; // تكلفة المخزون صافي بدون ضريبة
  const lines: JournalLine[] = [];

  // ── قيد المخزون (مدين: صافي التكلفة بدون ضريبة) ──────────────────────────
  const inventoryAcct = await getOrCreateInventoryAccount(companyId);
  lines.push({ account: inventoryAcct, debit: netCost > 0 ? netCost : total, credit: 0 });

  // ── قيد ضريبة القيمة المضافة على المشتريات (مدين: أصل ضريبي) ─────────────
  if (taxAmount > 0) {
    const vatInputAcct = await getOrCreateVatInputAccount(companyId);
    lines.push({ account: vatInputAcct, debit: taxAmount, credit: 0 });
  }

  if (paid > 0) {
    const [txRow] = await db
      .select({ safe_id: transactionsTable.safe_id, safe_name: transactionsTable.safe_name })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.reference_type, 'purchase'),
          eq(transactionsTable.reference_id, purchase.id)
        )
      )
      .limit(1);

    if (txRow?.safe_id && txRow.safe_name) {
      const safeAcct = await getOrCreateSafeAccount(txRow.safe_id, txRow.safe_name, companyId);
      lines.push({ account: safeAcct, debit: 0, credit: paid });
    }
  }

  // الجزء الآجل: حساب ذمم مورد (AP) مرتبط بالعميل-المورد
  if (supplierDebt > 0 && purchase.customer_id) {
    const [cust] = await db
      .select({
        customer_code: customersTable.customer_code,
        name: customersTable.name,
        account_id: customersTable.account_id,
      })
      .from(customersTable)
      .where(eq(customersTable.id, purchase.customer_id));

    if (cust) {
      let apAcct: { id: number; code: string; name: string } | undefined;
      if (cust.account_id) {
        const [a] = await db
          .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
          .from(accountsTable)
          .where(eq(accountsTable.id, cust.account_id));
        // نبحث عن حساب AP خاص بالعميل-المورد
        const [apRow] = await db
          .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
          .from(accountsTable)
          .where(eq(accountsTable.code, `AP-C-${cust.customer_code ?? purchase.customer_id}`));
        apAcct = apRow ?? (cust.customer_code ? undefined : a);
      }
      if (!apAcct) {
        apAcct = await getOrCreateCustomerPayableAccount(
          cust.customer_code ?? purchase.customer_id,
          cust.name,
          companyId
        );
      }
      lines.push({ account: apAcct, debit: 0, credit: supplierDebt });
    }
  }

  return lines;
}

/* ── ترحيل فاتورة المشتريات (draft → posted) ───────────────────────────── */
router.post(
  '/purchases/:id/post',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_create_purchase')) {
      res.status(403).json({ error: 'غير مصرح بترحيل فواتير المشتريات' });
      return;
    }
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const [purchase] = await db
      .select()
      .from(purchasesTable)
      .where(and(eq(purchasesTable.id, id), eq(purchasesTable.company_id, getTenant(req))));
    if (!purchase) throw httpError(404, 'الفاتورة غير موجودة');
    if (purchase.posting_status === 'posted') throw httpError(400, 'الفاتورة مرحَّلة بالفعل');
    if (purchase.posting_status === 'cancelled') throw httpError(400, 'لا يمكن ترحيل فاتورة ملغاة');

    await assertPeriodOpen(purchase.date, req);

    const cidPost = getTenant(req);
    const lines = await buildPurchaseJournalLines(purchase, cidPost);

    const updated = await db.transaction(async (tx) => {
      if (lines.length >= 2) {
        await createJournalEntry(
          {
            date: purchase.date ?? new Date().toISOString().split('T')[0],
            description: `فاتورة مشتريات ${purchase.invoice_no}${purchase.supplier_name ? ` — ${purchase.supplier_name}` : ''}`,
            reference: purchase.invoice_no,
            lines,
            companyId: cidPost,
          },
          tx
        );
      }
      const [row] = await tx
        .update(purchasesTable)
        .set({ posting_status: 'posted' })
        .where(eq(purchasesTable.id, id))
        .returning();
      return row;
    });

    const purchaseItems = await db
      .select({ product_id: purchaseItemsTable.product_id })
      .from(purchaseItemsTable)
      .where(eq(purchaseItemsTable.purchase_id, id));
    void runAllChecks({ companyId: purchase.company_id });
    for (const item of purchaseItems) {
      if (item.product_id)
        void runAllChecks({ companyId: purchase.company_id, productId: item.product_id });
    }

    void triggerBackup('purchase_post');

    res.json(formatPurchase(updated));
  })
);

/* ── إلغاء فاتورة المشتريات ─────────────────────────────────────────────── */
router.post(
  '/purchases/:id/cancel',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_cancel_purchase')) {
      res.status(403).json({ error: 'غير مصرح بإلغاء فواتير الشراء' });
      return;
    }

    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const [purchase] = await db
      .select()
      .from(purchasesTable)
      .where(and(eq(purchasesTable.id, id), eq(purchasesTable.company_id, getTenant(req))));
    if (!purchase) throw httpError(404, 'الفاتورة غير موجودة');
    if (purchase.posting_status === 'cancelled') throw httpError(400, 'الفاتورة ملغاة بالفعل');

    const existingReturns = await db
      .select({ id: purchaseReturnsTable.id })
      .from(purchaseReturnsTable)
      .where(eq(purchaseReturnsTable.purchase_id, id));
    if (existingReturns.length > 0) {
      throw httpError(400, 'لا يمكن إلغاء فاتورة مرتبطة بمرتجعات — يجب حذف المرتجعات أولاً');
    }

    // فحص: المخزون سيصبح سالباً
    {
      const itemsToCheck = await db
        .select({
          product_id: purchaseItemsTable.product_id,
          product_name: purchaseItemsTable.product_name,
          quantity: purchaseItemsTable.quantity,
        })
        .from(purchaseItemsTable)
        .where(eq(purchaseItemsTable.purchase_id, id));

      for (const item of itemsToCheck) {
        const cancelQty = Number(item.quantity);
        const [prod] = await db
          .select({ quantity: productsTable.quantity })
          .from(productsTable)
          .where(eq(productsTable.id, item.product_id));
        if (prod && Number(prod.quantity) < cancelQty - 0.001) {
          throw httpError(
            400,
            `لا يمكن الإلغاء: المخزون الحالي لـ "${item.product_name}" (${Number(prod.quantity).toFixed(3)}) أقل من كمية الشراء المُراد عكسها (${cancelQty.toFixed(3)}) — الإلغاء سيجعل الكمية سالبة`
          );
        }
      }
    }

    // فحص: قيود محاسبية لاحقة
    if (purchase.posting_status === 'posted') {
      const [purchJE] = await db
        .select({ id: journalEntriesTable.id })
        .from(journalEntriesTable)
        .where(eq(journalEntriesTable.reference, purchase.invoice_no));

      if (purchJE) {
        const jeLines = await db
          .select({ account_id: journalEntryLinesTable.account_id })
          .from(journalEntryLinesTable)
          .where(eq(journalEntryLinesTable.entry_id, purchJE.id));

        const accountIds = [...new Set(jeLines.map((l) => l.account_id))];
        if (accountIds.length > 0) {
          const laterLines = await db
            .select({ entry_id: journalEntryLinesTable.entry_id })
            .from(journalEntryLinesTable)
            .innerJoin(
              journalEntriesTable,
              eq(journalEntryLinesTable.entry_id, journalEntriesTable.id)
            )
            .where(
              and(
                inArray(journalEntryLinesTable.account_id, accountIds),
                gt(journalEntriesTable.date, purchase.date ?? ''),
                not(eq(journalEntriesTable.id, purchJE.id))
              )
            )
            .limit(1);

          if (laterLines.length > 0) {
            throw httpError(
              400,
              'لا يمكن العكس: توجد قيود محاسبية لاحقة مبنية على نفس حسابات هذه الفاتورة'
            );
          }
        }
      }
    }

    await assertPeriodOpen(purchase.date, req);

    const effectiveWarehouseId = req.user?.warehouse_id ?? null;
    const tenantWarehouseId = await resolveTenantWarehouseId(
      (purchase as { warehouse_id?: number | null }).warehouse_id ?? effectiveWarehouseId,
      getTenant(req)
    );

    const today = new Date().toISOString().split('T')[0];

    const cidCancel = getTenant(req);
    await db.transaction(async (tx) => {
      // 1. عكس القيد المحاسبي
      if (purchase.posting_status === 'posted') {
        const lines = await buildPurchaseJournalLines(purchase, cidCancel);
        if (lines.length >= 2) {
          const reversed = lines.map((l) => ({
            account: l.account,
            debit: l.credit,
            credit: l.debit,
          }));
          await createJournalEntry(
            {
              date: today,
              description: `إلغاء فاتورة مشتريات ${purchase.invoice_no}${purchase.supplier_name ? ` — ${purchase.supplier_name}` : ''}`,
              reference: `REV-${purchase.invoice_no}`,
              lines: reversed,
              companyId: cidCancel,
            },
            tx
          );
        }
      }

      // 2. إزالة بنود الشراء من المخزون
      const purchaseItems = await tx
        .select()
        .from(purchaseItemsTable)
        .where(eq(purchaseItemsTable.purchase_id, purchase.id));
      for (const item of purchaseItems) {
        const qty = Number(item.quantity);
        const purchaseUnitCost = Number(item.unit_price);

        // SELECT FOR UPDATE — row-level lock to prevent concurrent cancel/purchase races
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
        const newQty = Math.max(0, oldQty - qty);
        let newWAC = oldWAC;
        if (newQty > 0) {
          newWAC = Math.max(0, (oldQty * oldWAC - qty * purchaseUnitCost) / newQty);
        }
        await tx
          .update(productsTable)
          .set({ quantity: String(newQty), cost_price: String(newWAC.toFixed(4)) })
          .where(
            and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, cidCancel))
          );

        await tx.insert(stockMovementsTable).values({
          product_id: item.product_id,
          product_name: item.product_name,
          movement_type: 'adjustment',
          quantity: String(-qty),
          quantity_before: String(oldQty),
          quantity_after: String(newQty),
          unit_cost: String(purchaseUnitCost),
          reference_type: 'purchase_cancel',
          reference_id: purchase.id,
          reference_no: purchase.invoice_no,
          notes: `إلغاء فاتورة مشتريات ${purchase.invoice_no}`,
          date: today,
          warehouse_id: tenantWarehouseId,
          company_id: cidCancel,
        });
      }

      // 3. عكس رصيد العميل-المورد (الآجل)
      const remainingAmt = Number(purchase.remaining_amount);
      if (remainingAmt > 0 && purchase.customer_id) {
        const [cust] = await tx
          .select()
          .from(customersTable)
          .where(
            and(
              eq(customersTable.id, purchase.customer_id),
              eq(customersTable.company_id, cidCancel)
            )
          );
        if (cust) {
          await tx
            .update(customersTable)
            .set({ balance: String(Number(cust.balance) + remainingAmt) })
            .where(and(eq(customersTable.id, cust.id), eq(customersTable.company_id, cidCancel)));

          await tx.insert(customerLedgerTable).values({
            customer_id: purchase.customer_id,
            type: 'purchase_cancel',
            amount: String(remainingAmt),
            reference_type: 'purchase_cancel',
            reference_id: purchase.id,
            reference_no: purchase.invoice_no,
            description: `إلغاء فاتورة مشتريات ${purchase.invoice_no}`,
            date: today,
            company_id: cidCancel,
          });
        }
      }

      // 4. عكس رصيد الخزينة (النقدي)
      const paidAmt = Number(purchase.paid_amount);
      if (paidAmt > 0) {
        const [txRow] = await db
          .select({ safe_id: transactionsTable.safe_id, safe_name: transactionsTable.safe_name })
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.reference_type, 'purchase'),
              eq(transactionsTable.reference_id, purchase.id),
              eq(transactionsTable.company_id, cidCancel)
            )
          )
          .limit(1);

        if (txRow?.safe_id) {
          const [safe] = await tx
            .select()
            .from(safesTable)
            .where(and(eq(safesTable.id, txRow.safe_id), eq(safesTable.company_id, cidCancel)));
          if (safe) {
            await tx
              .update(safesTable)
              .set({ balance: String(Number(safe.balance) + paidAmt) })
              .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cidCancel)));
          }
          await tx.insert(transactionsTable).values({
            type: 'purchase_cancel',
            reference_type: 'purchase_cancel',
            reference_id: purchase.id,
            safe_id: txRow.safe_id,
            safe_name: txRow.safe_name ?? '',
            amount: String(paidAmt),
            direction: 'in',
            description: `إلغاء فاتورة مشتريات ${purchase.invoice_no}`,
            date: today,
            company_id: cidCancel,
          });
        }
      }

      // 5. تحديث حالة الفاتورة
      await tx
        .update(purchasesTable)
        .set({ posting_status: 'cancelled' })
        .where(eq(purchasesTable.id, id));
    });

    const [updated] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
    res.json(formatPurchase(updated));
  })
);

export default router;
