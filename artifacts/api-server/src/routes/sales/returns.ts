/**
 * POST /sales/:id/cancel — Cancel (reverse) a sale invoice.
 *
 * Performs a full system reversal:
 *   1. Reverses the accounting journal entry (for posted invoices)
 *   2. Returns stock to inventory with WAC recalculation
 *   3. Reverses customer balance (credit/partial sales)
 *   4. Reverses safe balance (cash/partial sales)
 *   5. Adds reversal entries to customer ledger
 *   6. Marks invoice as "cancelled"
 *
 * @access Requires can_cancel_sale permission.
 */
import { Router, type IRouter } from 'express';
import { eq, and, gt, ne, not, inArray, sql } from 'drizzle-orm';
import {
  db,
  salesTable,
  saleItemsTable,
  productsTable,
  customersTable,
  transactionsTable,
  safesTable,
  stockMovementsTable,
  salesReturnsTable,
  receiptVouchersTable,
  journalEntriesTable,
  journalEntryLinesTable,
  customerLedgerTable,
} from '@workspace/db';
import { wrap, httpError } from '../../lib/async-handler';
import { assertPeriodOpen } from '../../lib/period-lock';
import { writeAuditLog } from '../../lib/audit-log';
import { hasPermission } from '../../lib/permissions';
import { resolveTenantWarehouseId } from '../../lib/warehouse-guard';
import { getTenant } from '../../middleware/auth';
import { getCustomerLedgerBalance } from '../../lib/ledger-balance';
import { createJournalEntry } from '../../lib/auto-account';
import { formatSale, buildSaleJournalLines } from './_helpers';

const router: IRouter = Router();

/**
 * @description Cancel a sale invoice with full system reversal. Blocked when
 *              returns, later receipt vouchers, or later journal entries exist.
 * @route  POST /sales/:id/cancel
 * @access can_cancel_sale
 */
router.post(
  '/sales/:id/cancel',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_cancel_sale')) {
      res.status(403).json({ error: 'غير مصرح بإلغاء الفواتير' });
      return;
    }
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const companyId = getTenant(req);
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.id, id), eq(salesTable.company_id, companyId)));
    if (!sale) throw httpError(404, 'الفاتورة غير موجودة');
    if (sale.posting_status === 'cancelled') throw httpError(400, 'الفاتورة ملغاة بالفعل');

    // Guard: cannot cancel if returns exist
    const existingReturns = await db
      .select({ id: salesReturnsTable.id })
      .from(salesReturnsTable)
      .where(eq(salesReturnsTable.sale_id, id));
    if (existingReturns.length > 0) {
      throw httpError(400, 'لا يمكن إلغاء فاتورة مرتبطة بمرتجعات — يجب حذف المرتجعات أولاً');
    }

    // Guard: later receipt vouchers on the same customer
    if (sale.customer_id && Number(sale.remaining_amount) > 0) {
      const laterRVs = await db
        .select({ id: receiptVouchersTable.id, voucher_no: receiptVouchersTable.voucher_no })
        .from(receiptVouchersTable)
        .where(
          and(
            eq(receiptVouchersTable.customer_id, sale.customer_id),
            eq(receiptVouchersTable.company_id, sale.company_id),
            gt(receiptVouchersTable.date, sale.date ?? ''),
            ne(receiptVouchersTable.posting_status, 'cancelled')
          )
        );
      if (laterRVs.length > 0) {
        const nos = laterRVs.map((v) => v.voucher_no).join('، ');
        throw httpError(
          400,
          `لا يمكن الإلغاء: توجد ${laterRVs.length} سند(ات) قبض مُسجَّلة على هذا العميل بعد تاريخ الفاتورة (${nos}) — قد تكون مقيّدة على هذه الذمة`
        );
      }
    }

    // Guard: customer ledger would go negative
    if (
      sale.posting_status === 'posted' &&
      sale.customer_id &&
      Number(sale.remaining_amount) > 0.001
    ) {
      const [custRow] = await db
        .select({ account_id: customersTable.account_id, name: customersTable.name })
        .from(customersTable)
        .where(
          and(
            eq(customersTable.id, sale.customer_id),
            eq(customersTable.company_id, sale.company_id)
          )
        );
      if (custRow) {
        const ledgerBal = await getCustomerLedgerBalance(custRow.account_id);
        if (ledgerBal < Number(sale.remaining_amount) - 0.001) {
          throw httpError(
            400,
            `لا يمكن الإلغاء: رصيد دفتر الأستاذ للعميل (${ledgerBal.toFixed(2)}) أقل من الذمة المُراد عكسها (${Number(sale.remaining_amount).toFixed(2)}) — الإلغاء سيجعل الرصيد سالباً`
          );
        }
      }
    }

    // Guard: later journal entries on the same accounts
    if (sale.posting_status === 'posted') {
      const [saleJE] = await db
        .select({ id: journalEntriesTable.id })
        .from(journalEntriesTable)
        .where(
          and(
            eq(journalEntriesTable.reference, sale.invoice_no),
            eq(journalEntriesTable.company_id, sale.company_id)
          )
        );

      if (saleJE) {
        const jeLines = await db
          .select({ account_id: journalEntryLinesTable.account_id })
          .from(journalEntryLinesTable)
          .where(eq(journalEntryLinesTable.entry_id, saleJE.id));

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
                gt(journalEntriesTable.date, sale.date ?? ''),
                not(eq(journalEntriesTable.id, saleJE.id))
              )
            )
            .limit(1);
          if (laterLines.length > 0) {
            throw httpError(
              400,
              'لا يمكن العكس: توجد قيود محاسبية لاحقة مبنية على نفس حسابات هذه الفاتورة — راجع دفتر الأستاذ قبل الإلغاء'
            );
          }
        }
      }
    }

    await assertPeriodOpen(sale.date, req);

    const effectiveWarehouseId = req.user?.warehouse_id ?? null;
    const tenantWarehouseId = await resolveTenantWarehouseId(
      sale.warehouse_id ?? effectiveWarehouseId,
      companyId
    );

    const today = new Date().toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      // 1. عكس القيد المحاسبي (للفواتير المرحَّلة فقط)
      if (sale.posting_status === 'posted') {
        const lines = await buildSaleJournalLines(sale, companyId);
        if (lines.length >= 2) {
          const reversed = lines.map((l) => ({
            account: l.account,
            debit: l.credit,
            credit: l.debit,
          }));
          await createJournalEntry(
            {
              date: today,
              description: `إلغاء فاتورة مبيعات ${sale.invoice_no}${sale.customer_name ? ` — ${sale.customer_name}` : ''}`,
              reference: `REV-${sale.invoice_no}`,
              lines: reversed,
              companyId,
            },
            tx
          );
        }
      }

      // 2. إعادة المخزون لكل بند + تعديل WAC
      const saleItems = await tx
        .select()
        .from(saleItemsTable)
        .where(eq(saleItemsTable.sale_id, sale.id));
      for (const item of saleItems) {
        const qty = Number(item.quantity);
        const costAtSale = Number(item.cost_price);

        const lockResult = await tx.execute(
          sql`SELECT id, quantity::text AS qty, cost_price::text AS wac
            FROM products
            WHERE id = ${item.product_id} AND company_id = ${companyId}
            FOR UPDATE`
        );
        if (!lockResult.rows.length) continue;
        const lockedProd = lockResult.rows[0] as { id: number; qty: string; wac: string };

        const oldQty = Number(lockedProd.qty);
        const oldWAC = Number(lockedProd.wac);
        const newQty = oldQty + qty;
        const newWAC = newQty > 0 ? (oldQty * oldWAC + qty * costAtSale) / newQty : costAtSale;

        await tx
          .update(productsTable)
          .set({ quantity: String(newQty), cost_price: String(newWAC.toFixed(4)) })
          .where(
            and(eq(productsTable.id, item.product_id), eq(productsTable.company_id, companyId))
          );

        await tx.insert(stockMovementsTable).values({
          product_id: item.product_id,
          product_name: item.product_name,
          movement_type: 'adjustment',
          quantity: String(qty),
          quantity_before: String(oldQty),
          quantity_after: String(newQty),
          unit_cost: String(costAtSale),
          reference_type: 'sale_cancel',
          reference_id: sale.id,
          reference_no: sale.invoice_no,
          notes: `إلغاء فاتورة مبيعات ${sale.invoice_no}`,
          date: today,
          warehouse_id: tenantWarehouseId,
          company_id: companyId,
        });
      }

      // 3. عكس رصيد العميل (الآجل)
      const remainingAmt = Number(sale.remaining_amount);
      if (remainingAmt > 0 && sale.customer_id) {
        const [cust] = await tx
          .select()
          .from(customersTable)
          .where(
            and(eq(customersTable.id, sale.customer_id), eq(customersTable.company_id, companyId))
          );
        if (cust) {
          await tx
            .update(customersTable)
            .set({ balance: String(Number(cust.balance) - remainingAmt) })
            .where(and(eq(customersTable.id, cust.id), eq(customersTable.company_id, companyId)));
        }
      }

      // 4. عكس رصيد الخزينة (النقدي)
      const paidAmt = Number(sale.paid_amount);
      if (paidAmt > 0 && sale.safe_id) {
        const [safe] = await tx
          .select()
          .from(safesTable)
          .where(and(eq(safesTable.id, sale.safe_id), eq(safesTable.company_id, companyId)));
        if (safe) {
          await tx
            .update(safesTable)
            .set({ balance: String(Number(safe.balance) - paidAmt) })
            .where(and(eq(safesTable.id, sale.safe_id), eq(safesTable.company_id, companyId)));
        }
        await tx.insert(transactionsTable).values({
          type: 'sale_cancel',
          reference_type: 'sale_cancel',
          reference_id: sale.id,
          safe_id: sale.safe_id,
          safe_name: sale.safe_name ?? '',
          customer_id: sale.customer_id ?? null,
          customer_name: sale.customer_name ?? null,
          amount: String(paidAmt),
          direction: 'out',
          description: `إلغاء فاتورة مبيعات ${sale.invoice_no}`,
          date: today,
          company_id: companyId,
        });
      }

      // 5. عكس قيود دفتر الأستاذ
      if (sale.customer_id) {
        const totalAmt = Number(sale.total_amount);
        if (totalAmt > 0) {
          await tx.insert(customerLedgerTable).values({
            customer_id: sale.customer_id,
            type: 'sale_cancel',
            amount: String(-totalAmt),
            reference_type: 'sale',
            reference_id: sale.id,
            reference_no: sale.invoice_no,
            description: `إلغاء فاتورة مبيعات ${sale.invoice_no}`,
            date: today,
            company_id: companyId,
          });
        }
        if (paidAmt > 0) {
          await tx.insert(customerLedgerTable).values({
            customer_id: sale.customer_id,
            type: 'sale_cancel',
            amount: String(paidAmt),
            reference_type: 'sale',
            reference_id: sale.id,
            reference_no: sale.invoice_no,
            description: `إلغاء دفعة فاتورة ${sale.invoice_no}`,
            date: today,
            company_id: companyId,
          });
        }
      }

      // 6. تحديث حالة الفاتورة
      await tx.update(salesTable).set({ posting_status: 'cancelled' }).where(eq(salesTable.id, id));
    });

    const [updated] = await db.select().from(salesTable).where(eq(salesTable.id, id));

    void writeAuditLog({
      action: 'cancel',
      record_type: 'sale',
      record_id: id,
      old_value: { posting_status: 'posted', invoice_no: sale.invoice_no },
      new_value: { posting_status: 'cancelled' },
      user: { id: req.user?.id, username: req.user?.username },
    });

    res.json(formatSale(updated));
  })
);

export default router;
