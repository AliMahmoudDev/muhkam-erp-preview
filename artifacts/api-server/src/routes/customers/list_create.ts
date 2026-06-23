/** customers/list_create.ts */
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
  '/customers',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_customers')) {
      res.status(403).json({ error: 'غير مصرح بعرض العملاء' });
      return;
    }
    // مصدر الحقيقة الوحيد: جدول customer_ledger
    // الرصيد = SUM(amount) لكل عميل
    // موجب = العميل مدين لنا (عليه) — سالب = نحن مدينون له (له علينا)
    const companyId = getTenant(req);
    const cacheKey = `customers:${companyId}`;

    const cached = await getCache<object[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const companyFilter = sql` WHERE c.company_id = ${companyId}`;
    const rawLimitC = parseInt(String(req.query.limit ?? '500'), 10);
    const limitC = Math.min(Math.max(isNaN(rawLimitC) ? 500 : rawLimitC, 1), 2000);
    const rows = await db.execute(sql`
    SELECT
      c.id, c.name, c.customer_code, c.phone,
      c.is_customer, c.is_supplier, c.account_id, c.normalized_name, c.created_at,
      c.classification_id, c.source, c.price_list_id, c.price_list_markup,
      COALESCE(SUM(CAST(cl.amount AS FLOAT8)), 0) AS ledger_balance
    FROM customers c
    LEFT JOIN customer_ledger cl ON cl.customer_id = c.id AND cl.company_id = c.company_id
    ${companyFilter}
    GROUP BY c.id, c.name, c.customer_code, c.phone,
             c.is_customer, c.is_supplier, c.account_id, c.normalized_name, c.created_at,
             c.classification_id, c.source, c.price_list_id, c.price_list_markup
    ORDER BY c.customer_code
    LIMIT ${limitC}
  `);
    const customers = (rows.rows as Record<string, unknown>[]).map((r) => ({
      id: r.id,
      name: r.name,
      customer_code: r.customer_code,
      phone: r.phone,
      balance: Math.round(Number(r.ledger_balance) * 100) / 100,
      is_customer: r.is_customer ?? true,
      is_supplier: r.is_supplier ?? false,
      account_id: r.account_id,
      classification_id: r.classification_id ?? null,
      source: r.source ?? null,
      normalized_name: r.normalized_name,
      created_at: new Date(String(r.created_at)).toISOString(),
      price_list_id: r.price_list_id ?? null,
      price_list_markup: r.price_list_markup != null ? Number(r.price_list_markup) : null,
    }));
    await setCache(cacheKey, customers, CACHE_TTL);
    res.json(customers);
  })
);

router.post(
  '/customers',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_customers')) {
      res.status(403).json({ error: 'غير مصرح بإضافة عملاء' });
      return;
    }
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const normalized = normalizeName(parsed.data.name);
    const companyIdPost = getTenant(req);

    const phonePost = String(parsed.data.phone ?? '').trim();

    // تحقق من تكرار الاسم
    const existingName = await db.execute(
      sql`SELECT id, name FROM customers WHERE normalized_name = ${normalized} AND company_id = ${companyIdPost} LIMIT 1`
    );
    if ((existingName.rows as Record<string, unknown>[]).length > 0) {
      const dup = (existingName.rows as Record<string, unknown>[])[0];
      res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${dup.name}"` });
      return;
    }

    // تحقق من تكرار رقم الهاتف (فقط إذا تم إدخاله)
    if (phonePost) {
      const existingPhone = await db.execute(
        sql`SELECT id, name FROM customers WHERE phone = ${phonePost} AND company_id = ${companyIdPost} LIMIT 1`
      );
      if ((existingPhone.rows as Record<string, unknown>[]).length > 0) {
        const dup = (existingPhone.rows as Record<string, unknown>[])[0];
        res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${dup.name}"` });
        return;
      }
    }

    const newCode = await getNextCustomerCode(companyIdPost);

    const newClassificationId = req.body.classification_id
      ? parseInt(String(req.body.classification_id), 10) || null
      : null;

    const sourceVal = req.body.source ? String(req.body.source) : null;

    const [customer] = await db
      .insert(customersTable)
      .values({
        name: parsed.data.name.trim(),
        customer_code: newCode,
        normalized_name: normalized,
        phone: parsed.data.phone ?? null,
        balance: String(parsed.data.balance ?? 0),
        is_customer: parsed.data.is_customer ?? true,
        is_supplier: parsed.data.is_supplier ?? false,
        classification_id: newClassificationId,
        source: sourceVal,
        company_id: companyIdPost,
      })
      .returning();

    const acct = await getOrCreateCustomerAccount(newCode, parsed.data.name.trim(), getTenant(req));
    const [updated] = await db
      .update(customersTable)
      .set({ account_id: acct.id })
      .where(and(eq(customersTable.id, customer.id), eq(customersTable.company_id, companyIdPost)))
      .returning();

    // الرصيد الافتتاحي → دفتر الأستاذ (مصدر الحقيقة الوحيد)
    const openingBalance = Number(parsed.data.balance ?? 0);
    if (openingBalance !== 0) {
      await db.insert(customerLedgerTable).values({
        company_id: companyIdPost,
        customer_id: updated.id,
        type: 'opening_balance',
        amount: String(openingBalance),
        reference_type: null,
        reference_no: `OPEN-${newCode}`,
        description: `رصيد افتتاحي — ${parsed.data.name.trim()}`,
        date: new Date().toISOString().split('T')[0],
      });
    }

    void writeAuditLog({
      action: 'create',
      record_type: 'customer',
      record_id: updated.id,
      new_value: formatCustomer(updated),
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
    });

    await deleteCache(`customers:${req.user?.company_id}`);
    res.status(201).json(formatCustomer(updated));
  })
);

export default router;
