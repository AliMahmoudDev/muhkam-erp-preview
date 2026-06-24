/** purchases/list.ts */
import { Router, type IRouter } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, purchasesTable } from '@workspace/db';
import { GetPurchasesResponse } from '@workspace/api-zod';
import { wrap } from '../../lib/async-handler';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { formatPurchase } from './_helpers';

const router: IRouter = Router();

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


export default router;
