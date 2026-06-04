import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, receiptVouchersTable, customersTable, safesTable, transactionsTable, accountsTable, customerLedgerTable } from "@workspace/db";
import { nextReceiptVoucherNo } from "../lib/invoice-no";
import { z } from "zod/v4";
import { firstZodError } from "../lib/schemas";
import { wrap, httpError } from "../lib/async-handler";
import { assertPeriodOpen } from "../lib/period-lock";
import { getOrCreateSafeAccount, getOrCreateMiscRevenueAccount, createAutoJournalEntry, type AccountRef } from "../lib/auto-account";
import { hasPermission } from "../lib/permissions";
import { writeAuditLog } from "../lib/audit-log";
import { getTenant } from "../middleware/auth";

const createReceiptVoucherSchema = z.object({
  customer_name: z.string().min(1),
  safe_id: z.union([z.string().min(1), z.number().int().positive()]),
  amount: z.union([z.string(), z.number()]).refine(v => Number(v) > 0, { message: "المبلغ يجب أن يكون أكبر من صفر" }),
  customer_id: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const router: IRouter = Router();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCid(req: any): number {
  return getTenant(req);
}

function fmt(v: typeof receiptVouchersTable.$inferSelect) {
  return { ...v, amount: Number(v.amount), created_at: v.created_at.toISOString() };
}

router.get("/receipt-vouchers", wrap(async (req, res) => {
  const cid = getCid(req);
  const limit = Math.min(2000, Math.max(1, parseInt(String(req.query["limit"] ?? "500"), 10)));
  const items = await db.select().from(receiptVouchersTable)
    .where(eq(receiptVouchersTable.company_id, cid))
    .orderBy(desc(receiptVouchersTable.created_at))
    .limit(limit);
  res.json(items.map(fmt));
}));

router.post("/receipt-vouchers", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_add_receipt_voucher")) {
    res.status(403).json({ error: "غير مصرح بإضافة سندات قبض" }); return;
  }

  const parsed = createReceiptVoucherSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: firstZodError(parsed.error) }); return; }

  const cid = getCid(req);
  const { customer_id, customer_name, safe_id, amount, notes, date } = parsed.data;
  const amt = Number(amount);

  const requestId = req.headers["x-request-id"]
    ? String(req.headers["x-request-id"])
    : null;

  if (requestId) {
    const [existing] = await db.select().from(receiptVouchersTable)
      .where(and(eq(receiptVouchersTable.request_id, requestId), eq(receiptVouchersTable.company_id, cid))).limit(1);
    if (existing) return res.json(fmt(existing));
  }

  await assertPeriodOpen(date ?? null, req);

  const voucher = await db.transaction(async (tx) => {
    const [safe] = await tx.select().from(safesTable).where(and(
      eq(safesTable.id, Number(safe_id)),
      eq(safesTable.company_id, cid),
    ));
    if (!safe) throw httpError(400, "الخزينة غير موجودة");
    await tx.update(safesTable)
      .set({ balance: sql`${safesTable.balance} + ${String(amt)}` })
      .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cid)));

    let resolvedCustomerId: number | null = null;
    if (customer_id) {
      const [cust] = await tx.select().from(customersTable).where(and(
        eq(customersTable.id, Number(customer_id)),
        eq(customersTable.company_id, cid),
      ));
      if (!cust) throw httpError(400, "العميل غير موجود أو لا ينتمي لهذه الشركة");
      resolvedCustomerId = cust.id;
      const newBalance = Number(cust.balance) - amt;
      await tx.update(customersTable).set({ balance: String(newBalance) }).where(and(
        eq(customersTable.id, cust.id),
        eq(customersTable.company_id, cid),
      ));
    }

    const voucher_no = await nextReceiptVoucherNo(cid);
    const [v] = await tx.insert(receiptVouchersTable).values({
      request_id: requestId,
      voucher_no,
      date: date ?? new Date().toISOString().split("T")[0],
      customer_id: resolvedCustomerId,
      customer_name,
      safe_id: safe.id,
      safe_name: safe.name,
      amount: String(amt),
      notes: notes ?? null,
      company_id: cid,
    }).returning();

    await tx.insert(transactionsTable).values({
      type: "receipt_voucher",
      reference_type: "receipt_voucher",
      reference_id: v.id,
      safe_id: safe.id,
      safe_name: safe.name,
      customer_id: resolvedCustomerId,
      customer_name,
      amount: String(amt),
      direction: "in",
      description: `سند قبض ${voucher_no} — ${customer_name}`,
      date: date ?? new Date().toISOString().split("T")[0],
      company_id: cid,
    });

    if (resolvedCustomerId) {
      await tx.insert(customerLedgerTable).values({
        customer_id: resolvedCustomerId,
        type: "receipt_voucher",
        amount: String(-amt),
        reference_type: "receipt_voucher",
        reference_id: v.id,
        reference_no: voucher_no,
        description: `سند قبض ${voucher_no} — ${customer_name}`,
        date: date ?? new Date().toISOString().split("T")[0],
        company_id: cid,
      });
    }

    return v;
  });

  void writeAuditLog({
    action: "create",
    record_type: "receipt_voucher",
    record_id: voucher.id,
    new_value: {
      voucher_no: voucher.voucher_no,
      amount: Number(voucher.amount),
      customer_name: voucher.customer_name,
      safe_id: voucher.safe_id,
    },
    user: req.user,
    company_id: cid,
    note: "إنشاء سند قبض",
  });

  return res.status(201).json(fmt(voucher));
}));

/* ── مساعد: جلب حساب العميل من السند ──────────────────────────────────── */
async function getVoucherCustomerAcct(customerId: number | null, companyId: number): Promise<AccountRef | null> {
  if (!customerId) return null;
  const [cust] = await db.select({ account_id: customersTable.account_id, name: customersTable.name })
    .from(customersTable).where(and(eq(customersTable.id, customerId), eq(customersTable.company_id, companyId)));
  if (!cust?.account_id) return null;
  const [acctRow] = await db.select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
    .from(accountsTable).where(and(eq(accountsTable.id, cust.account_id), eq(accountsTable.company_id, companyId)));
  return acctRow ?? null;
}

/* ── ترحيل سند القبض (draft → posted) ──────────────────────────────────── */
router.post("/receipt-vouchers/:id/post", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const [v] = await db.select().from(receiptVouchersTable)
    .where(and(eq(receiptVouchersTable.id, id), eq(receiptVouchersTable.company_id, cid)));
  if (!v) throw httpError(404, "سند القبض غير موجود");
  if (v.posting_status === "posted")    throw httpError(400, "السند مرحَّل بالفعل");
  if (v.posting_status === "cancelled") throw httpError(400, "لا يمكن ترحيل سند ملغى");

  await assertPeriodOpen(v.date, req);

  const custAcct = await getVoucherCustomerAcct(v.customer_id, cid);
  const safeAcct = await getOrCreateSafeAccount(v.safe_id, v.safe_name, cid);
  if (custAcct) {
    await createAutoJournalEntry({
      date: v.date,
      description: `سند قبض ${v.voucher_no} — ${v.customer_name}`,
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
      description: `سند قبض ${v.voucher_no} — إيراد متنوع`,
      reference: v.voucher_no,
      debit: safeAcct,
      credit: miscAcct,
      amount: Number(v.amount),
      companyId: cid,
    });
  }

  const [updated] = await db.update(receiptVouchersTable)
    .set({ posting_status: "posted" })
    .where(and(eq(receiptVouchersTable.id, id), eq(receiptVouchersTable.company_id, cid)))
    .returning();

  void writeAuditLog({
    action: "update",
    record_type: "receipt_voucher",
    record_id: id,
    old_value: { posting_status: v.posting_status },
    new_value: { posting_status: "posted" },
    user: req.user,
    company_id: cid,
    note: "ترحيل سند قبض (draft → posted)",
  });

  res.json(fmt(updated));
}));

/* ── إلغاء سند القبض → قيد عكسي ───────────────────────────────────────── */
router.post("/receipt-vouchers/:id/cancel", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) throw httpError(400, "معرّف غير صحيح");

  const [v] = await db.select().from(receiptVouchersTable)
    .where(and(eq(receiptVouchersTable.id, id), eq(receiptVouchersTable.company_id, cid)));
  if (!v) throw httpError(404, "سند القبض غير موجود");
  if (v.posting_status === "cancelled") throw httpError(400, "السند ملغى بالفعل");

  await assertPeriodOpen(v.date, req);

  if (v.posting_status === "posted") {
    const custAcct = await getVoucherCustomerAcct(v.customer_id, cid);
    if (custAcct) {
      const safeAcct = await getOrCreateSafeAccount(v.safe_id, v.safe_name, cid);
      await createAutoJournalEntry({
        date: new Date().toISOString().split("T")[0],
        description: `إلغاء سند قبض ${v.voucher_no} — ${v.customer_name}`,
        reference: `REV-${v.voucher_no}`,
        debit: custAcct,
        credit: safeAcct,
        amount: Number(v.amount),
        companyId: cid,
      });
    }
  }

  const [updated] = await db.update(receiptVouchersTable)
    .set({ posting_status: "cancelled" })
    .where(and(eq(receiptVouchersTable.id, id), eq(receiptVouchersTable.company_id, cid)))
    .returning();

  void writeAuditLog({
    action: "cancel",
    record_type: "receipt_voucher",
    record_id: id,
    old_value: { posting_status: v.posting_status },
    new_value: { posting_status: "cancelled" },
    user: req.user,
    company_id: cid,
    note: "إلغاء سند قبض",
  });

  res.json(fmt(updated));
}));

/* ── حذف (draft فقط — posted مقفل) ─────────────────────────────────────── */
router.delete("/receipt-vouchers/:id", wrap(async (req, res) => {
  const cid = getCid(req);
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }

  const [preCheck] = await db.select({ date: receiptVouchersTable.date, posting_status: receiptVouchersTable.posting_status })
    .from(receiptVouchersTable)
    .where(and(eq(receiptVouchersTable.id, id), eq(receiptVouchersTable.company_id, cid)));
  if (!preCheck) throw httpError(404, "سند القبض غير موجود");
  if (preCheck.posting_status === "posted") throw httpError(400, "لا يمكن حذف سند مرحَّل — استخدم الإلغاء");
  await assertPeriodOpen(preCheck.date, req);

  await db.transaction(async (tx) => {
    const [v] = await tx.select().from(receiptVouchersTable)
      .where(and(eq(receiptVouchersTable.id, id), eq(receiptVouchersTable.company_id, cid)));
    if (!v) throw httpError(404, "سند القبض غير موجود");
    if (v.posting_status === "posted") throw httpError(400, "لا يمكن حذف سند مرحَّل — استخدم الإلغاء");

    const [safe] = await tx.select().from(safesTable).where(and(
      eq(safesTable.id, v.safe_id),
      eq(safesTable.company_id, cid),
    ));
    if (safe) {
      // عكس قبض ⇒ خصم ذرّي بشرط كفاية الرصيد
      const debited = await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${String(Number(v.amount))}` })
        .where(and(
          eq(safesTable.id, safe.id),
          eq(safesTable.company_id, cid),
          sql`${safesTable.balance} >= ${String(Number(v.amount))}`,
        ))
        .returning();
      if (!debited[0]) throw httpError(400, "رصيد الخزينة غير كافٍ لإلغاء سند القبض — تم صرف المبلغ بالفعل");
    }
    if (v.customer_id) {
      const [cust] = await tx.select().from(customersTable).where(and(
        eq(customersTable.id, v.customer_id),
        eq(customersTable.company_id, cid),
      ));
      if (cust) await tx.update(customersTable).set({ balance: String(Number(cust.balance) + Number(v.amount)) }).where(and(
        eq(customersTable.id, cust.id),
        eq(customersTable.company_id, cid),
      ));

      await tx.delete(customerLedgerTable)
        .where(and(
          eq(customerLedgerTable.reference_type, "receipt_voucher"),
          eq(customerLedgerTable.reference_id, id),
        ));
    }
    await tx.delete(receiptVouchersTable).where(eq(receiptVouchersTable.id, id));
  });

  void writeAuditLog({
    action: "delete",
    record_type: "receipt_voucher",
    record_id: id,
    user: req.user,
    company_id: cid,
    note: "حذف سند قبض (مسودة)",
  });

  res.json({ success: true });
}));

export default router;
