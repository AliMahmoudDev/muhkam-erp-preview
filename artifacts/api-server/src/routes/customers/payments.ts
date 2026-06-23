/** customers/payments.ts */
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


router.post(
  '/customers/:id/receipt',
  wrap(async (req, res) => {
    const params = CreateCustomerReceiptParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateCustomerReceiptBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const cid = getTenant(req);
    const amt = parsed.data.amount;
    if (amt <= 0) {
      res.status(400).json({ error: 'المبلغ يجب أن يكون أكبر من صفر' });
      return;
    }
    const receiptNo = `RCP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const txDate = new Date().toISOString().split('T')[0];

    /* ── fetch customer first (outside tx so 404 is returned cleanly) ── */
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, cid)));
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    /* ── atomic write: ledger + transaction + balance ─────────────────── */
    await db.transaction(async (tx) => {
      /* 1. دفتر الأستاذ — amount سالب يُقلّل الدين على العميل */
      await tx.insert(customerLedgerTable).values({
        customer_id: params.data.id,
        type: 'receipt',
        amount: String(-amt),
        reference_type: 'manual_receipt',
        reference_no: receiptNo,
        description: parsed.data.description ?? `سند قبض ${receiptNo} — ${customer.name}`,
        date: txDate,
        company_id: cid,
      });

      /* 2. سجل الحركة المالية المركزية — مع company_id للعزل الصحيح */
      await tx.insert(transactionsTable).values({
        type: 'receipt',
        reference_type: 'manual_receipt',
        customer_id: params.data.id,
        customer_name: customer.name,
        amount: String(amt),
        direction: 'in',
        description: parsed.data.description ?? `سند قبض ${receiptNo} — ${customer.name}`,
        date: txDate,
        company_id: cid,
      });

      /* 3. تحديث رصيد العميل المحفوظ */
      const newBalance = Number(customer.balance) - amt;
      await tx
        .update(customersTable)
        .set({ balance: String(newBalance) })
        .where(and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, cid)));
    });

    const [updated] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, params.data.id), eq(customersTable.company_id, cid)));
    const ledgerBal = await getCustomerLedgerBalance((updated ?? customer).account_id, cid);
    res.json(CreateCustomerReceiptResponse.parse(formatCustomer(updated ?? customer, ledgerBal)));
  })
);

/* ── دفتر أستاذ العميل — جلب كل الحركات مع الرصيد المتراكم ──────────────── */
router.get(
  '/customers/:id/ledger',
  wrap(async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, id), eq(customersTable.company_id, getTenant(req))));
    if (!customer) throw httpError(404, 'العميل غير موجود');

    const entries = await db
      .select()
      .from(customerLedgerTable)
      .where(eq(customerLedgerTable.customer_id, id))
      .orderBy(asc(customerLedgerTable.date), asc(customerLedgerTable.created_at))
      .limit(500);

    let running = 0;
    const rows = entries.map((e) => {
      const amt = Number(e.amount);
      running += amt;
      return {
        id: e.id,
        type: e.type,
        amount: amt,
        balance_after: Math.round(running * 100) / 100,
        reference_type: e.reference_type,
        reference_id: e.reference_id,
        reference_no: e.reference_no,
        description: e.description,
        date: e.date,
        created_at: e.created_at.toISOString(),
      };
    });

    const balance = Math.round(running * 100) / 100;

    res.json({
      customer_id: id,
      customer_name: customer.name,
      balance,
      entries: rows,
    });
  })
);

/* ── سداد مباشر من العميل (بدون فاتورة) ──────────────────────────────────── */
router.post(
  '/customers/:id/payment',
  wrap(async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const { amount, safe_id, notes, date } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw httpError(400, 'أدخل مبلغاً صحيحاً');

    const txDate = date ?? new Date().toISOString().split('T')[0];
    const paymentNo = `PAY-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    const cidPay = getTenant(req);
    await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.id, id), eq(customersTable.company_id, cidPay)));
      if (!customer) throw httpError(404, 'العميل غير موجود');

      // 1. خصم من رصيد الخزينة إن وُجدت
      if (safe_id) {
        const safeIdInt = parseInt(safe_id);
        const [safe] = await tx
          .select()
          .from(safesTable)
          .where(and(eq(safesTable.id, safeIdInt), eq(safesTable.company_id, cidPay)));
        if (safe) {
          await tx
            .update(safesTable)
            .set({ balance: String(Number(safe.balance) + amt) })
            .where(and(eq(safesTable.id, safeIdInt), eq(safesTable.company_id, cidPay)));

          // الحركة المالية المركزية
          await tx.insert(transactionsTable).values({
            company_id: cidPay,
            type: 'receipt_voucher',
            reference_type: 'customer_payment',
            reference_id: id,
            safe_id: safeIdInt,
            safe_name: safe.name,
            customer_id: id,
            customer_name: customer.name,
            amount: String(amt),
            direction: 'in',
            description: notes
              ? `${notes} — ${customer.name}`
              : `سداد مباشر ${paymentNo} — ${customer.name}`,
            date: txDate,
          });
        }
      }

      // 2. دفتر الأستاذ — تسجيل السداد (يُقلّل الدين)
      await tx.insert(customerLedgerTable).values({
        company_id: cidPay,
        customer_id: id,
        type: 'payment',
        amount: String(-amt),
        reference_type: 'manual_payment',
        reference_no: paymentNo,
        description: notes ? `${notes}` : `سداد مباشر ${paymentNo}`,
        date: txDate,
      });

      // 3. تحديث رصيد العميل المحفوظ (يمكن أن يصبح سالباً إذا سدّد أكثر مما عليه)
      const newBalance = Number(customer.balance) - amt;
      await tx
        .update(customersTable)
        .set({ balance: String(newBalance) })
        .where(and(eq(customersTable.id, id), eq(customersTable.company_id, cidPay)));
    });

    // إعادة الرصيد المحدّث
    const [updated] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, id), eq(customersTable.company_id, cidPay)));
    const ledgerBal = await getCustomerLedgerBalance(updated.account_id, cidPay);
    res.json({ success: true, customer: formatCustomer(updated, ledgerBal) });
  })
);

router.post(
  '/customers/:id/supplier-payment',
  wrap(async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const { amount, safe_id, notes, date } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw httpError(400, 'أدخل مبلغاً صحيحاً');
    const safeId = parseInt(safe_id);
    if (isNaN(safeId)) throw httpError(400, 'اختر الخزينة');

    const txDate = date ?? new Date().toISOString().split('T')[0];
    const paymentNo = `SPAY-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    let resultCustomer: typeof customersTable.$inferSelect | undefined;

    const cidSPay = getTenant(req);
    await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.id, id), eq(customersTable.company_id, cidSPay)));
      if (!customer) throw httpError(404, 'العميل غير موجود');
      if (!customer.is_supplier) throw httpError(400, 'هذا العميل ليس مورداً');

      const [safe] = await tx
        .select()
        .from(safesTable)
        .where(and(eq(safesTable.id, safeId), eq(safesTable.company_id, cidSPay)));
      if (!safe) throw httpError(404, 'الخزينة غير موجودة');
      if (Number(safe.balance) < amt) throw httpError(400, 'رصيد الخزينة غير كافٍ');

      await tx
        .update(safesTable)
        .set({ balance: String(Number(safe.balance) - amt) })
        .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cidSPay)));

      const [updated] = await tx
        .update(customersTable)
        .set({ balance: String(Number(customer.balance) + amt) })
        .where(and(eq(customersTable.id, id), eq(customersTable.company_id, cidSPay)))
        .returning();

      await tx.insert(transactionsTable).values({
        type: 'supplier_payment',
        reference_type: 'supplier_payment',
        reference_id: id,
        direction: 'out',
        customer_id: id,
        customer_name: customer.name,
        safe_id: safe.id,
        safe_name: safe.name,
        amount: String(amt),
        description: notes || `تسديد دفعة للمورد - ${customer.name}`,
        date: txDate,
        company_id: cidSPay,
      });

      // دفتر الأستاذ: تسديد للمورد يُقلّل ما يدين به لنا (أو يزيد دينه علينا)
      // الرصيد السالب = ندين له، التسديد يُقلّل ما علينا → +amt في دفتر الأستاذ
      await tx.insert(customerLedgerTable).values({
        customer_id: id,
        reference_id: id,
        type: 'supplier_payment',
        amount: String(amt), // يُزيد رصيده (يُقلّل ما ندين به)
        reference_type: 'supplier_payment',
        reference_no: paymentNo,
        description: notes ? `${notes}` : `تسديد للمورد ${paymentNo} — ${customer.name}`,
        date: txDate,
        company_id: cidSPay,
      });

      resultCustomer = updated;
    });

    if (!resultCustomer) {
      throw httpError(500, 'فشل في تحديث بيانات العميل');
    }
    res.json({ success: true, customer: formatCustomer(resultCustomer) });
  })
);

/* ─── تصنيفات العملاء ─── */

export default router;
