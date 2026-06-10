import { Router, type IRouter } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  db,
  depositVouchersTable,
  safesTable,
  customersTable,
  transactionsTable,
  accountsTable,
  customerLedgerTable,
} from '@workspace/db';
import { nextDepositVoucherNo } from '../lib/invoice-no';
import { z } from 'zod/v4';
import { firstZodError } from '../lib/schemas';
import { wrap, httpError } from '../lib/async-handler';
import { assertPeriodOpen } from '../lib/period-lock';
import {
  getOrCreateSafeAccount,
  getOrCreateMiscRevenueAccount,
  createAutoJournalEntry,
  type AccountRef,
} from '../lib/auto-account';
import { writeAuditLog } from '../lib/audit-log';
import { getTenant } from '../middleware/auth';

const createDepositVoucherSchema = z.object({
  safe_id: z.union([z.string().min(1), z.number().int().positive()]),
  amount: z
    .union([z.string(), z.number()])
    .refine((v) => Number(v) > 0, { message: 'المبلغ يجب أن يكون أكبر من صفر' }),
  customer_id: z.union([z.string(), z.number()]).optional().nullable(),
  customer_name: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

const router: IRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCid(req: any): number {
  return getTenant(req);
}

function fmt(v: typeof depositVouchersTable.$inferSelect) {
  return { ...v, amount: Number(v.amount), created_at: v.created_at.toISOString() };
}

router.get(
  '/deposit-vouchers',
  wrap(async (req, res) => {
    const cid = getCid(req);
    const limit = Math.min(2000, Math.max(1, parseInt(String(req.query['limit'] ?? '500'), 10)));
    const items = await db
      .select()
      .from(depositVouchersTable)
      .where(eq(depositVouchersTable.company_id, cid))
      .orderBy(desc(depositVouchersTable.created_at))
      .limit(limit);
    res.json(items.map(fmt));
  })
);

router.post(
  '/deposit-vouchers',
  wrap(async (req, res) => {
    const parsed = createDepositVoucherSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: firstZodError(parsed.error) });
      return;
    }

    const cid = getCid(req);
    const { safe_id, amount, customer_id, customer_name, source, notes, date } = parsed.data;
    const amt = Number(amount);

    const requestId = req.headers['x-request-id'] ? String(req.headers['x-request-id']) : null;

    if (requestId) {
      const [existing] = await db
        .select()
        .from(depositVouchersTable)
        .where(
          and(
            eq(depositVouchersTable.request_id, requestId),
            eq(depositVouchersTable.company_id, cid)
          )
        )
        .limit(1);
      if (existing) return res.json(fmt(existing));
    }

    await assertPeriodOpen(date ?? null, req);

    const voucher = await db.transaction(async (tx) => {
      const [safe] = await tx
        .select()
        .from(safesTable)
        .where(and(eq(safesTable.id, Number(safe_id)), eq(safesTable.company_id, cid)));
      if (!safe) throw httpError(400, 'الخزينة غير موجودة');
      await tx
        .update(safesTable)
        .set({ balance: sql`${safesTable.balance} + ${String(amt)}` })
        .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cid)));

      let custId: number | null = null;
      let custName: string | null = null;
      if (customer_id) {
        const [cust] = await tx
          .select()
          .from(customersTable)
          .where(
            and(eq(customersTable.id, Number(customer_id)), eq(customersTable.company_id, cid))
          );
        if (cust) {
          custId = cust.id;
          custName = cust.name;
          const newBalance = Number(cust.balance) - amt;
          await tx
            .update(customersTable)
            .set({ balance: String(newBalance) })
            .where(and(eq(customersTable.id, cust.id), eq(customersTable.company_id, cid)));
        }
      }

      const voucher_no = await nextDepositVoucherNo(cid);
      const [v] = await tx
        .insert(depositVouchersTable)
        .values({
          request_id: requestId,
          voucher_no,
          date: date ?? new Date().toISOString().split('T')[0],
          customer_id: custId,
          customer_name: custName ?? (customer_name || null),
          safe_id: safe.id,
          safe_name: safe.name,
          amount: String(amt),
          source: source ?? null,
          notes: notes ?? null,
          company_id: cid,
        })
        .returning();

      const txDate = date ?? new Date().toISOString().split('T')[0];
      const descr = custName
        ? `سند إيداع ${voucher_no} — ${custName}`
        : `سند إيداع ${voucher_no}${source ? ` — ${source}` : ''}`;

      await tx.insert(transactionsTable).values({
        type: 'receipt',
        reference_type: 'deposit_voucher',
        reference_id: v.id,
        safe_id: safe.id,
        safe_name: safe.name,
        customer_id: custId,
        customer_name: custName,
        amount: String(amt),
        direction: 'in',
        description: descr,
        date: txDate,
        company_id: cid,
      });

      if (custId) {
        await tx.insert(customerLedgerTable).values({
          company_id: cid,
          customer_id: custId,
          type: 'deposit_voucher',
          amount: String(-amt),
          reference_type: 'deposit_voucher',
          reference_id: v.id,
          reference_no: voucher_no,
          description: descr,
          date: txDate,
        });
      }

      return v;
    });

    void writeAuditLog({
      action: 'create',
      record_type: 'deposit_voucher',
      record_id: voucher.id,
      new_value: {
        voucher_no: voucher.voucher_no,
        amount: Number(voucher.amount),
        customer_name: voucher.customer_name,
        safe_id: voucher.safe_id,
      },
      user: req.user,
      company_id: cid,
      note: 'إنشاء سند إيداع',
    });

    return res.status(201).json(fmt(voucher));
  })
);

/* ── مساعد: جلب حساب العميل ────────────────────────────────────────────── */
async function getVoucherCustomerAcct(customerId: number | null): Promise<AccountRef | null> {
  if (!customerId) return null;
  const [cust] = await db
    .select({ account_id: customersTable.account_id, name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, customerId));
  if (!cust?.account_id) return null;
  const [acctRow] = await db
    .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
    .from(accountsTable)
    .where(eq(accountsTable.id, cust.account_id));
  return acctRow ?? null;
}

/* ── ترحيل سند التوريد (draft → posted) ────────────────────────────────── */
router.post(
  '/deposit-vouchers/:id/post',
  wrap(async (req, res) => {
    const cid = getCid(req);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const [v] = await db
      .select()
      .from(depositVouchersTable)
      .where(and(eq(depositVouchersTable.id, id), eq(depositVouchersTable.company_id, cid)));
    if (!v) throw httpError(404, 'سند التوريد غير موجود');
    if (v.posting_status === 'posted') throw httpError(400, 'السند مرحَّل بالفعل');
    if (v.posting_status === 'cancelled') throw httpError(400, 'لا يمكن ترحيل سند ملغى');

    await assertPeriodOpen(v.date, req);

    const custAcct = await getVoucherCustomerAcct(v.customer_id);
    const safeAcct = await getOrCreateSafeAccount(v.safe_id, v.safe_name, cid);
    if (custAcct) {
      await createAutoJournalEntry({
        date: v.date,
        description: `سند توريد ${v.voucher_no} — ${v.customer_name ?? ''}`,
        reference: v.voucher_no,
        debit: safeAcct,
        credit: custAcct,
        amount: Number(v.amount),
        companyId: cid,
      });
    } else {
      const miscAcct = await getOrCreateMiscRevenueAccount(cid);
      await createAutoJournalEntry({
        date: v.date,
        description: `سند توريد ${v.voucher_no} — إيراد متنوع`,
        reference: v.voucher_no,
        debit: safeAcct,
        credit: miscAcct,
        amount: Number(v.amount),
        companyId: cid,
      });
    }

    const [updated] = await db
      .update(depositVouchersTable)
      .set({ posting_status: 'posted' })
      .where(and(eq(depositVouchersTable.id, id), eq(depositVouchersTable.company_id, cid)))
      .returning();

    void writeAuditLog({
      action: 'update',
      record_type: 'deposit_voucher',
      record_id: id,
      old_value: { posting_status: v.posting_status },
      new_value: { posting_status: 'posted' },
      user: req.user,
      company_id: cid,
      note: 'ترحيل سند إيداع (draft → posted)',
    });

    res.json(fmt(updated));
  })
);

/* ── إلغاء سند التوريد → قيد عكسي ─────────────────────────────────────── */
router.post(
  '/deposit-vouchers/:id/cancel',
  wrap(async (req, res) => {
    const cid = getCid(req);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) throw httpError(400, 'معرّف غير صحيح');

    const [v] = await db
      .select()
      .from(depositVouchersTable)
      .where(and(eq(depositVouchersTable.id, id), eq(depositVouchersTable.company_id, cid)));
    if (!v) throw httpError(404, 'سند التوريد غير موجود');
    if (v.posting_status === 'cancelled') throw httpError(400, 'السند ملغى بالفعل');

    await assertPeriodOpen(v.date, req);

    if (v.posting_status === 'posted') {
      const custAcct = await getVoucherCustomerAcct(v.customer_id);
      if (custAcct) {
        const safeAcct = await getOrCreateSafeAccount(v.safe_id, v.safe_name, cid);
        await createAutoJournalEntry({
          date: new Date().toISOString().split('T')[0],
          description: `إلغاء سند توريد ${v.voucher_no} — ${v.customer_name ?? ''}`,
          reference: `REV-${v.voucher_no}`,
          debit: custAcct,
          credit: safeAcct,
          amount: Number(v.amount),
          companyId: cid,
        });
      }
    }

    const [updated] = await db
      .update(depositVouchersTable)
      .set({ posting_status: 'cancelled' })
      .where(and(eq(depositVouchersTable.id, id), eq(depositVouchersTable.company_id, cid)))
      .returning();

    void writeAuditLog({
      action: 'cancel',
      record_type: 'deposit_voucher',
      record_id: id,
      old_value: { posting_status: v.posting_status },
      new_value: { posting_status: 'cancelled' },
      user: req.user,
      company_id: cid,
      note: 'إلغاء سند إيداع',
    });

    res.json(fmt(updated));
  })
);

/* ── حذف (draft فقط — posted مقفل) ─────────────────────────────────────── */
router.delete(
  '/deposit-vouchers/:id',
  wrap(async (req, res) => {
    const cid = getCid(req);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: 'معرّف غير صالح' });
      return;
    }

    const [preCheck] = await db
      .select({
        date: depositVouchersTable.date,
        posting_status: depositVouchersTable.posting_status,
      })
      .from(depositVouchersTable)
      .where(and(eq(depositVouchersTable.id, id), eq(depositVouchersTable.company_id, cid)));
    if (!preCheck) throw httpError(404, 'غير موجود');
    if (preCheck.posting_status === 'posted')
      throw httpError(400, 'لا يمكن حذف سند مرحَّل — استخدم الإلغاء');
    await assertPeriodOpen(preCheck.date, req);

    await db.transaction(async (tx) => {
      const [v] = await tx
        .select()
        .from(depositVouchersTable)
        .where(and(eq(depositVouchersTable.id, id), eq(depositVouchersTable.company_id, cid)));
      if (!v) throw httpError(404, 'غير موجود');
      if (v.posting_status === 'posted')
        throw httpError(400, 'لا يمكن حذف سند مرحَّل — استخدم الإلغاء');

      const [safe] = await tx
        .select()
        .from(safesTable)
        .where(and(eq(safesTable.id, v.safe_id), eq(safesTable.company_id, cid)));
      if (safe) {
        // عكس إيداع ⇒ خصم ذرّي بشرط كفاية الرصيد
        const debited = await tx
          .update(safesTable)
          .set({ balance: sql`${safesTable.balance} - ${String(Number(v.amount))}` })
          .where(
            and(
              eq(safesTable.id, safe.id),
              eq(safesTable.company_id, cid),
              sql`${safesTable.balance} >= ${String(Number(v.amount))}`
            )
          )
          .returning();
        if (!debited[0])
          throw httpError(400, 'رصيد الخزينة غير كافٍ لإلغاء سند الإيداع — تم صرف المبلغ بالفعل');
      }

      if (v.customer_id) {
        const [cust] = await tx
          .select()
          .from(customersTable)
          .where(and(eq(customersTable.id, v.customer_id), eq(customersTable.company_id, cid)));
        if (cust)
          await tx
            .update(customersTable)
            .set({ balance: String(Number(cust.balance) + Number(v.amount)) })
            .where(and(eq(customersTable.id, cust.id), eq(customersTable.company_id, cid)));
        await tx.insert(customerLedgerTable).values({
          company_id: cid,
          customer_id: v.customer_id,
          type: 'deposit_voucher',
          amount: String(Number(v.amount)),
          reference_type: 'deposit_voucher_cancel',
          reference_id: v.id,
          reference_no: v.voucher_no,
          description: `إلغاء سند إيداع ${v.voucher_no}`,
          date: new Date().toISOString().split('T')[0],
        });
      }

      await tx.delete(depositVouchersTable).where(eq(depositVouchersTable.id, id));
    });

    void writeAuditLog({
      action: 'delete',
      record_type: 'deposit_voucher',
      record_id: id,
      user: req.user,
      company_id: cid,
      note: 'حذف سند إيداع (مسودة)',
    });

    res.json({ success: true });
  })
);

export default router;
