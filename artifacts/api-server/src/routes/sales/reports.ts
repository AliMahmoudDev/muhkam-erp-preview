/**
 * Sales reporting and posting routes:
 *   GET  /sales         — paginated sale list with filtering/search
 *   GET  /sales/:id     — single sale with line items
 *   POST /sales/:id/post — transition a draft sale to "posted" (creates journal entry)
 */
import { Router, type IRouter } from 'express';
import { eq, and, inArray, gte, lte, count, ilike, or, desc, sql } from 'drizzle-orm';
import {
  db,
  salesTable,
  saleItemsTable,
  customersTable,
  transactionsTable,
  safesTable,
  stockMovementsTable,
  accountsTable,
  salesReturnsTable,
  receiptVouchersTable,
  journalEntriesTable,
  journalEntryLinesTable,
  customerLedgerTable,
} from '@workspace/db';
import { GetSalesResponse, GetSaleByIdParams, GetSaleByIdResponse } from '@workspace/api-zod';
import { wrap, httpError } from '../../lib/async-handler';
import { triggerBackup } from '../../lib/backup-service';
import { assertPeriodOpen } from '../../lib/period-lock';
import { runAllChecks } from '../../lib/alert-service';
import { hasPermission } from '../../lib/permissions';
import { getTenant } from '../../middleware/auth';
import { createJournalEntry } from '../../lib/auto-account';
import { formatSale, formatSaleItem, buildSaleJournalLines } from './_helpers';

// Silence unused-import warnings for tables only referenced in cancel route (imported via _helpers)
void [
  transactionsTable,
  safesTable,
  stockMovementsTable,
  accountsTable,
  salesReturnsTable,
  receiptVouchersTable,
  journalEntriesTable,
  journalEntryLinesTable,
  customerLedgerTable,
];

const router: IRouter = Router();

/**
 * @description List sales with pagination, date range, and full-text search.
 * @route  GET /sales
 * @access can_view_sales
 */
router.get(
  '/sales',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_sales')) {
      res.status(403).json({ error: 'غير مصرح بعرض المبيعات' });
      return;
    }
    const role = req.user?.role ?? 'cashier';
    const queryWarehouseId = req.query.warehouse_id
      ? parseInt(String(req.query.warehouse_id), 10)
      : null;
    const effectiveWarehouseId =
      role === 'admin' || role === 'manager' ? queryWarehouseId : (req.user?.warehouse_id ?? null);
    if ((role === 'cashier' || role === 'salesperson') && effectiveWarehouseId === null) {
      res.status(403).json({ error: 'المستخدم غير مرتبط بمخزن' });
      return;
    }
    const companyId = getTenant(req);
    const salesWhere = and(
      effectiveWarehouseId ? eq(salesTable.warehouse_id, effectiveWarehouseId) : undefined,
      eq(salesTable.company_id, companyId)
    );

    const rawLimit = parseInt(String(req.query.limit ?? '200'), 10);
    const pageLimit = Math.min(Math.max(isNaN(rawLimit) ? 200 : rawLimit, 1), 1000);
    const rawPage = parseInt(String(req.query.page ?? '1'), 10);
    const pageNum = Math.max(isNaN(rawPage) ? 1 : rawPage, 1);
    const offset = (pageNum - 1) * pageLimit;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const q = req.query.q ? String(req.query.q).trim() : null;
    const sortDesc = req.query.sort === 'desc';

    let searchWhere: ReturnType<typeof or> | undefined;
    if (q) {
      const pat = `%${q}%`;
      const matchingCusts = await db
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(
          and(
            sql`CAST(${customersTable.customer_code} AS TEXT) ILIKE ${pat}`,
            eq(customersTable.company_id, companyId)
          )
        );
      const custIds = matchingCusts.map((c) => c.id);
      searchWhere = or(
        ilike(salesTable.invoice_no, pat),
        ilike(sql`COALESCE(${salesTable.customer_name}, '')`, pat),
        custIds.length > 0 ? inArray(salesTable.customer_id, custIds) : sql`false`
      );
    }

    const fullWhere = and(
      salesWhere,
      dateFrom ? gte(salesTable.date, dateFrom) : undefined,
      dateTo ? lte(salesTable.date, dateTo) : undefined,
      searchWhere
    );

    const [{ total }] = await db.select({ total: count() }).from(salesTable).where(fullWhere);
    const sales = await db
      .select()
      .from(salesTable)
      .where(fullWhere)
      .orderBy(sortDesc ? desc(salesTable.created_at) : salesTable.created_at)
      .limit(pageLimit)
      .offset(offset);

    const totalCount = Number(total ?? 0);
    const pages = Math.ceil(totalCount / pageLimit);
    const hasPaginationParams = req.query.page !== undefined || req.query.limit !== undefined;
    if (hasPaginationParams) {
      res.json({
        data: GetSalesResponse.parse(sales.map(formatSale)),
        total: totalCount,
        page: pageNum,
        pages,
        limit: pageLimit,
      });
    } else {
      res.json(GetSalesResponse.parse(sales.map(formatSale)));
    }
  })
);

/**
 * @description Get a single sale invoice with all line items.
 * @route  GET /sales/:id
 * @access can_view_sales
 */
router.get(
  '/sales/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_sales')) {
      res.status(403).json({ error: 'غير مصرح بعرض فواتير المبيعات' });
      return;
    }
    const params = GetSaleByIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const companyId = getTenant(req);
    const [sale] = await db
      .select()
      .from(salesTable)
      .where(and(eq(salesTable.id, params.data.id), eq(salesTable.company_id, companyId)));
    if (!sale) {
      res.status(404).json({ error: 'Sale not found' });
      return;
    }

    const role = req.user?.role ?? 'cashier';
    if (role !== 'admin' && role !== 'manager' && role !== 'super_admin') {
      const userWarehouseId = req.user?.warehouse_id ?? null;
      if (
        userWarehouseId !== null &&
        sale.warehouse_id !== null &&
        sale.warehouse_id !== userWarehouseId
      ) {
        res.status(403).json({ error: 'غير مصرح بعرض فواتير مخازن أخرى' });
        return;
      }
    }

    const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.sale_id, sale.id));
    res.json(GetSaleByIdResponse.parse({ ...formatSale(sale), items: items.map(formatSaleItem) }));
  })
);

/**
 * @description Post a draft sale — creates the accounting journal entry and
 *              transitions the invoice to "posted" status.
 * @route  POST /sales/:id/post
 * @access can_create_sale
 */
router.post(
  '/sales/:id/post',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_create_sale')) {
      res.status(403).json({ error: 'غير مصرح بترحيل فواتير المبيعات' });
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
    if (sale.posting_status === 'posted') throw httpError(400, 'الفاتورة مرحَّلة بالفعل');
    if (sale.posting_status === 'cancelled') throw httpError(400, 'لا يمكن ترحيل فاتورة ملغاة');

    const rolePost = req.user?.role ?? 'cashier';
    if (rolePost !== 'admin' && rolePost !== 'manager' && rolePost !== 'super_admin') {
      const userWarehouseIdPost = req.user?.warehouse_id ?? null;
      if (
        userWarehouseIdPost !== null &&
        sale.warehouse_id !== null &&
        sale.warehouse_id !== userWarehouseIdPost
      ) {
        throw httpError(403, 'غير مصرح بترحيل فواتير مخازن أخرى');
      }
    }

    await assertPeriodOpen(sale.date, req);

    const lines = await buildSaleJournalLines(sale, companyId);
    const updated = await db.transaction(async (tx) => {
      if (lines.length >= 2) {
        await createJournalEntry(
          {
            date: sale.date ?? new Date().toISOString().split('T')[0],
            description: `فاتورة مبيعات ${sale.invoice_no}${sale.customer_name ? ` — ${sale.customer_name}` : ''}`,
            reference: sale.invoice_no,
            lines,
            companyId,
          },
          tx
        );
      }
      const [row] = await tx
        .update(salesTable)
        .set({ posting_status: 'posted' })
        .where(and(eq(salesTable.id, id), eq(salesTable.company_id, companyId)))
        .returning();
      return row;
    });

    const saleItems = await db
      .select({ product_id: saleItemsTable.product_id })
      .from(saleItemsTable)
      .where(eq(saleItemsTable.sale_id, id));
    void runAllChecks({ companyId, customerId: updated.customer_id ?? undefined });
    for (const item of saleItems) {
      if (item.product_id) void runAllChecks({ companyId, productId: item.product_id });
    }
    void triggerBackup('sale_post');

    res.json(formatSale(updated));
  })
);

export default router;
