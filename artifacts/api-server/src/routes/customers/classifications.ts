/** customers/classifications.ts */
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
  '/customer-classifications',
  wrap(async (req, res) => {
    const companyId = getTenant(req);
    const rows = await db
      .select()
      .from(customerClassificationsTable)
      .where(eq(customerClassificationsTable.company_id, companyId))
      .orderBy(asc(customerClassificationsTable.name))
      .limit(500);
    res.json(rows);
  })
);

router.post(
  '/customer-classifications',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_customers')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const name = String(req.body.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'أدخل اسم التصنيف' });
      return;
    }
    const companyId = getTenant(req);
    // تحقق من تكرار اسم التصنيف
    const dupClass = await db.execute(
      sql`SELECT id FROM customer_classifications WHERE LOWER(name) = LOWER(${name}) AND company_id = ${companyId} LIMIT 1`
    );
    if ((dupClass.rows as Record<string, unknown>[]).length > 0) {
      res.status(400).json({ error: `التصنيف "${name}" موجود بالفعل` });
      return;
    }
    const [created] = await db
      .insert(customerClassificationsTable)
      .values({ name, company_id: companyId })
      .returning();
    res.status(201).json(created);
  })
);

router.put(
  '/customer-classifications/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_customers')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'معرّف غير صالح' });
      return;
    }
    const name = String(req.body.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'أدخل اسم التصنيف' });
      return;
    }
    const companyId = getTenant(req);
    const [updated] = await db
      .update(customerClassificationsTable)
      .set({ name })
      .where(
        and(
          eq(customerClassificationsTable.id, id),
          eq(customerClassificationsTable.company_id, companyId)
        )
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: 'التصنيف غير موجود' });
      return;
    }
    res.json(updated);
  })
);

router.delete(
  '/customer-classifications/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_customers')) {
      res.status(403).json({ error: 'غير مصرح' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'معرّف غير صالح' });
      return;
    }
    const cidCC = getTenant(req);
    const [linkedCustomer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(and(eq(customersTable.classification_id, id), eq(customersTable.company_id, cidCC)))
      .limit(1);
    if (linkedCustomer) {
      res.status(400).json({ error: 'لا يمكن حذف التصنيف لأنه مرتبط بعملاء' });
      return;
    }
    const result = await db
      .delete(customerClassificationsTable)
      .where(
        and(
          eq(customerClassificationsTable.id, id),
          eq(customerClassificationsTable.company_id, cidCC)
        )
      )
      .returning({ id: customerClassificationsTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: 'التصنيف غير موجود' });
      return;
    }
    res.json({ success: true });
  })
);

export default router;
