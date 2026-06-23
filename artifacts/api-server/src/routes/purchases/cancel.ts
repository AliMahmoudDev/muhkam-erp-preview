/** purchases/cancel.ts */
import { Router, type IRouter } from 'express';
import { eq, and, gt, not, inArray, sql } from 'drizzle-orm';
import { db, purchasesTable, purchaseItemsTable, productsTable, customersTable, safesTable, transactionsTable, stockMovementsTable, purchaseReturnsTable, journalEntriesTable, journalEntryLinesTable, customerLedgerTable } from '@workspace/db';
import { wrap, httpError } from '../../lib/async-handler';
import { assertPeriodOpen } from '../../lib/period-lock';
import { hasPermission } from '../../lib/permissions';
import { resolveTenantWarehouseId } from '../../lib/warehouse-guard';
import { getTenant } from '../../middleware/auth';
import { createJournalEntry } from '../../lib/auto-account';
import { formatPurchase } from './_helpers';

const router: IRouter = Router();

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
