/** customers/crud.ts */
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
  '/customers/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_view_customers')) {
      res.status(403).json({ error: 'غير مصرح بعرض العملاء' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'معرّف غير صالح' });
      return;
    }
    const companyId = getTenant(req);
    const rows = await db.execute(sql`
    SELECT
      c.id, c.name, c.customer_code, c.phone,
      c.is_customer, c.is_supplier, c.account_id, c.created_at,
      COALESCE(SUM(CAST(cl.amount AS FLOAT8)), 0) AS ledger_balance
    FROM customers c
    LEFT JOIN customer_ledger cl ON cl.customer_id = c.id AND cl.company_id = c.company_id
    WHERE c.id = ${id} AND c.company_id = ${companyId}
    GROUP BY c.id, c.name, c.customer_code, c.phone,
             c.is_customer, c.is_supplier, c.account_id, c.created_at
  `);
    if (!rows.rows.length) {
      res.status(404).json({ error: 'العميل غير موجود' });
      return;
    }
    const r = rows.rows[0] as Record<string, unknown>;
    res.json({
      id: r.id,
      name: r.name,
      customer_code: r.customer_code,
      phone: r.phone,
      balance: Math.round(Number(r.ledger_balance) * 100) / 100,
      is_customer: r.is_customer ?? true,
      is_supplier: r.is_supplier ?? false,
      created_at: new Date(String(r.created_at)).toISOString(),
    });
  })
);

router.put(
  '/customers/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_customers')) {
      res.status(403).json({ error: 'غير مصرح بتعديل العملاء' });
      return;
    }
    const params = UpdateCustomerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const normalized = normalizeName(parsed.data.name);
    const companyIdPut = getTenant(req);

    // رقم الهاتف إلزامي
    const phonePut = String(parsed.data.phone ?? '').trim();
    if (!phonePut) {
      res.status(400).json({ error: 'رقم الهاتف مطلوب' });
      return;
    }

    // تحقق من تكرار الاسم (باستثناء نفس العميل)
    const dupNameRows = await db.execute(
      sql`SELECT id, name FROM customers WHERE normalized_name = ${normalized} AND company_id = ${companyIdPut} AND id != ${params.data.id} LIMIT 1`
    );
    if ((dupNameRows.rows as Record<string, unknown>[]).length > 0) {
      const dup = (dupNameRows.rows as Record<string, unknown>[])[0];
      res.status(400).json({ error: `يوجد عميل بنفس الاسم بالفعل: "${dup.name}"` });
      return;
    }

    // تحقق من تكرار رقم الهاتف (باستثناء نفس العميل)
    const dupPhoneRows = await db.execute(
      sql`SELECT id, name FROM customers WHERE phone = ${phonePut} AND company_id = ${companyIdPut} AND id != ${params.data.id} LIMIT 1`
    );
    if ((dupPhoneRows.rows as Record<string, unknown>[]).length > 0) {
      const dup = (dupPhoneRows.rows as Record<string, unknown>[])[0];
      res.status(400).json({ error: `رقم الهاتف مستخدم بالفعل للعميل: "${dup.name}"` });
      return;
    }

    const [before] = await db
      .select()
      .from(customersTable)
      .where(
        and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, getTenant(req)))
      );
    if (!before) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const classificationId =
      req.body.classification_id !== undefined
        ? req.body.classification_id === null
          ? null
          : parseInt(String(req.body.classification_id), 10)
        : undefined;

    const [customer] = await db
      .update(customersTable)
      .set({
        name: parsed.data.name.trim(),
        normalized_name: normalized,
        phone: parsed.data.phone ?? null,
        balance: parsed.data.balance !== undefined ? String(parsed.data.balance) : undefined,
        is_customer: parsed.data.is_customer !== undefined ? parsed.data.is_customer : undefined,
        is_supplier: parsed.data.is_supplier !== undefined ? parsed.data.is_supplier : undefined,
        ...(classificationId !== undefined
          ? { classification_id: isNaN(classificationId as number) ? null : classificationId }
          : {}),
        ...(req.body.price_list_id !== undefined
          ? {
              price_list_id:
                req.body.price_list_id === null ? null : Number(req.body.price_list_id),
            }
          : {}),
        ...(req.body.price_list_markup !== undefined
          ? {
              price_list_markup:
                req.body.price_list_markup === null ? null : String(req.body.price_list_markup),
            }
          : {}),
      })
      .where(
        and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, getTenant(req)))
      )
      .returning();
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    void writeAuditLog({
      action: 'update',
      record_type: 'customer',
      record_id: customer.id,
      old_value: before ? formatCustomer(before) : null,
      new_value: formatCustomer(customer),
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
    });

    await deleteCache(`customers:${companyIdPut}`);
    res.json(UpdateCustomerResponse.parse(formatCustomer(customer)));
  })
);

router.delete(
  '/customers/:id',
  wrap(async (req, res) => {
    if (!hasPermission(req.user, 'can_manage_customers')) {
      res.status(403).json({ error: 'غير مصرح بحذف العملاء' });
      return;
    }
    const params = DeleteCustomerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    // فحص الرصيد — لا يمكن حذف عميل بدين قائم
    const ledgerRows = await db
      .select({ amount: customerLedgerTable.amount })
      .from(customerLedgerTable)
      .where(eq(customerLedgerTable.customer_id, params.data.id));
    const ledgerBalance = ledgerRows.reduce((s, r) => s + Number(r.amount), 0);
    if (Math.abs(ledgerBalance) > 0.001) {
      const label =
        ledgerBalance > 0
          ? `عليه لنا ${ledgerBalance.toFixed(2)}`
          : `له علينا ${Math.abs(ledgerBalance).toFixed(2)}`;
      res.status(400).json({ error: `لا يمكن حذف العميل — يوجد رصيد غير مسوّى (${label})` });
      return;
    }

    const [before] = await db
      .select()
      .from(customersTable)
      .where(
        and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, getTenant(req)))
      );
    if (!before) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    await db
      .delete(customersTable)
      .where(
        and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, getTenant(req)))
      );

    void writeAuditLog({
      action: 'delete',
      record_type: 'customer',
      record_id: params.data.id,
      old_value: before ? formatCustomer(before) : null,
      new_value: null,
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
    });

    await deleteCache(`customers:${req.user?.company_id}`);
    res.json(DeleteCustomerResponse.parse({ success: true, message: 'Customer deleted' }));
  })
);

export default router;
