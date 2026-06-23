/** customers/reports.ts */
import { Router, type IRouter } from 'express';
import { eq, and, max, asc, sql } from 'drizzle-orm';
import {
  db,
  customersTable,
  transactionsTable,
  safesTable,
  customerLedgerTable,
  customerClassificationsTable,
} from '@workspace/db';
import { writeAuditLog } from '../lib/audit-log';
import { hasPermission } from '../lib/permissions';
import { getCustomerLedgerBalance } from '../lib/ledger-balance';
import {
  CreateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerBody,
  UpdateCustomerResponse,
  DeleteCustomerParams,
  DeleteCustomerResponse,
  CreateCustomerReceiptParams,
  CreateCustomerReceiptBody,
  CreateCustomerReceiptResponse,
} from '@workspace/api-zod';
import { wrap, httpError } from '../lib/async-handler';
import { getOrCreateCustomerAccount } from '../lib/auto-account';
import { getTenant } from '../middleware/auth';
import { getCache, setCache, deleteCache } from '../lib/cache';
import { normalizeName, formatCustomer, getNextCustomerCode, CACHE_TTL } from './_helpers';

const router: IRouter = Router();


router.get(
  '/customer-reports',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_customers')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const companyId = getTenant(req);
    const customerId = req.query.customer_id ? parseInt(String(req.query.customer_id), 10) : null;
    const classId = req.query.classification_id
      ? parseInt(String(req.query.classification_id), 10)
      : null;
    const dateFrom = req.query.date_from ? String(req.query.date_from) : null;
    const dateTo = req.query.date_to ? String(req.query.date_to) : null;

    const customerFilter = customerId ? sql` AND c.id = ${customerId}` : sql``;
    const classificationFilter = classId ? sql` AND c.classification_id = ${classId}` : sql``;

    const rows = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.customer_code,
      cc.name AS classification_name,
      COALESCE((
        SELECT SUM(CAST(cl2.amount AS FLOAT8))
        FROM customer_ledger cl2
        WHERE cl2.customer_id = c.id
          AND cl2.company_id = c.company_id
          AND (${dateFrom}::date IS NULL OR cl2.date::date < ${dateFrom}::date)
      ), 0) AS opening_balance,
      COALESCE(SUM(CASE
        WHEN CAST(cl.amount AS FLOAT8) > 0
          AND (${dateFrom}::date IS NULL OR cl.date::date >= ${dateFrom}::date)
          AND (${dateTo}::date   IS NULL OR cl.date::date <= ${dateTo}::date)
        THEN CAST(cl.amount AS FLOAT8) ELSE 0 END), 0) AS period_debits,
      COALESCE(SUM(CASE
        WHEN CAST(cl.amount AS FLOAT8) < 0
          AND (${dateFrom}::date IS NULL OR cl.date::date >= ${dateFrom}::date)
          AND (${dateTo}::date   IS NULL OR cl.date::date <= ${dateTo}::date)
        THEN ABS(CAST(cl.amount AS FLOAT8)) ELSE 0 END), 0) AS period_credits
    FROM customers c
    LEFT JOIN customer_classifications cc ON cc.id = c.classification_id AND cc.company_id = c.company_id
    LEFT JOIN customer_ledger cl ON cl.customer_id = c.id AND cl.company_id = c.company_id
    WHERE c.company_id = ${companyId} ${customerFilter} ${classificationFilter}
    GROUP BY c.id, c.name, c.customer_code, cc.name
    ORDER BY c.customer_code
  `);

    const result = (rows.rows as Record<string, unknown>[]).map((r) => ({
      id: r.id,
      name: r.name,
      customer_code: r.customer_code,
      classification_name: r.classification_name ?? null,
      opening_balance: Math.round(Number(r.opening_balance) * 100) / 100,
      period_debits: Math.round(Number(r.period_debits) * 100) / 100,
      period_credits: Math.round(Number(r.period_credits) * 100) / 100,
      closing_balance:
        Math.round(
          (Number(r.opening_balance) + Number(r.period_debits) - Number(r.period_credits)) * 100
        ) / 100,
    }));

    res.json(result);
  })
);

export default router;

export default router;
