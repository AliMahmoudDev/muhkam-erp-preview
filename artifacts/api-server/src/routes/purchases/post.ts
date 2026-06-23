/** purchases/post.ts */
import { Router, type IRouter } from 'express';
import { buildPurchaseJournalLines } from './detail';
import { eq, and } from 'drizzle-orm';
import { db, purchasesTable, purchaseItemsTable } from '@workspace/db';
import { wrap, httpError } from '../../lib/async-handler';
import { triggerBackup } from '../../lib/backup-service';
import { assertPeriodOpen } from '../../lib/period-lock';
import { runAllChecks } from '../../lib/alert-service';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { createJournalEntry } from '../../lib/auto-account';
import { formatPurchase } from './_helpers';

const router: IRouter = Router();

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

export default router;
