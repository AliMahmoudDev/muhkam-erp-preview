/** purchases/detail.ts */
import { Router, type IRouter } from 'express';
import { eq, and, not } from 'drizzle-orm';
import { db, purchasesTable, purchaseItemsTable, customersTable, transactionsTable, accountsTable } from '@workspace/db';
import { GetPurchaseByIdParams, GetPurchaseByIdResponse } from '@workspace/api-zod';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { getOrCreateInventoryAccount, getOrCreateSafeAccount, getOrCreateCustomerPayableAccount, getOrCreateVatInputAccount, type JournalLine } from '../../lib/auto-account';
import { formatPurchase, formatPurchaseItem } from './_helpers';

const router: IRouter = Router();

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
          eq(transactionsTable.reference_id, purchase.id),
          eq(transactionsTable.company_id, companyId)
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
      .where(
        and(eq(customersTable.id, purchase.customer_id), eq(customersTable.company_id, companyId))
      );

    if (cust) {
      let apAcct: { id: number; code: string; name: string } | undefined;
      if (cust.account_id) {
        const [a] = await db
          .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
          .from(accountsTable)
          .where(
            and(eq(accountsTable.id, cust.account_id), eq(accountsTable.company_id, companyId))
          );
        // نبحث عن حساب AP خاص بالعميل-المورد
        const [apRow] = await db
          .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
          .from(accountsTable)
          .where(
            and(
              eq(accountsTable.code, `AP-C-${cust.customer_code ?? purchase.customer_id}`),
              eq(accountsTable.company_id, companyId)
            )
          );
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

export default router;
