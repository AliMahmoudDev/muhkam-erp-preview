/** purchases/create.ts */
import { Router, type IRouter } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { db, purchasesTable, purchaseItemsTable, productsTable, customersTable, safesTable, transactionsTable, stockMovementsTable, customerLedgerTable } from '@workspace/db';
import { CreatePurchaseBody } from '@workspace/api-zod';
import { wrap, httpError } from '../../lib/async-handler';
import { nextPurchaseInvoiceNo } from '../../lib/invoice-no';
import { assertPeriodOpen } from '../../lib/period-lock';
import { hasPermission } from '../../lib/permissions';
import { resolveTenantWarehouseId } from '../../lib/warehouse-guard';
import { getTenant } from '../../middleware/auth';
import { formatPurchase } from './_helpers';

const router: IRouter = Router();

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

      // توزيع تكلفة الشحن بالتناسب — يُرسَل دائماً بالجنيه المصري من الواجهة
      const shippingCostEgp = Number(shipping_cost ?? 0);
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


export default router;
