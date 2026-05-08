/**
 * /api/accruals — الاستحقاقات والمدفوعات المقدمة
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { z } from "zod/v4";
import { db, accrualsTable, accrualRunsTable, accountsTable, journalEntriesTable, journalEntryLinesTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { getOrCreateAccount } from "../lib/auto-account";
import { requireFeature } from "../middleware/feature-guard";

const router: IRouter = Router();
router.use("/accruals", requireFeature("accounting"));

const createAccrualSchema = z.object({
  type: z.enum(["prepayment", "accrual"], { error: "النوع يجب أن يكون prepayment أو accrual" }),
  category: z.enum(["expense", "revenue"], { error: "التصنيف يجب أن يكون expense أو revenue" }),
  description: z.string().min(1, "الوصف مطلوب"),
  total_amount: z.number({ error: "المبلغ الإجمالي يجب أن يكون رقماً" }).positive("المبلغ يجب أن يكون أكبر من صفر"),
  months_total: z.number({ error: "عدد الأشهر يجب أن يكون رقماً" }).int().min(1, "عدد الأشهر يجب أن يكون شهراً على الأقل"),
  start_date: z.string().min(1, "تاريخ البداية مطلوب"),
  end_date: z.string().min(1, "تاريخ النهاية مطلوب"),
});

const recognizeSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "الفترة مطلوبة بصيغة YYYY-MM"),
});

function fmt(a: typeof accrualsTable.$inferSelect) {
  return {
    ...a,
    total_amount: Number(a.total_amount),
    amount_recognized: Number(a.amount_recognized),
    monthly_amount: a.months_total > 0 ? Number(a.total_amount) / a.months_total : 0,
    created_at: a.created_at.toISOString(),
  };
}

/* ─── الحسابات المحاسبية حسب النوع ─── */
async function getAccrualAccounts(type: string, category: string, _description: string, cid: number) {
  if (type === "prepayment" && category === "expense") {
    const prepaid = await getOrCreateAccount({ code: "ASSET-PREPAID-EXP", name: "مصروفات مدفوعة مقدماً", type: "asset" }, cid);
    const expense = await getOrCreateAccount({ code: "EXP-GENERAL", name: "مصروفات عمومية وإدارية", type: "expense" }, cid);
    return { prepaid_account_id: prepaid.id, expense_account_id: expense.id, prepaidAccount: prepaid, expenseAccount: expense };
  }
  if (type === "prepayment" && category === "revenue") {
    const prepaid = await getOrCreateAccount({ code: "LIAB-DEFERRED-REV", name: "إيرادات مؤجلة", type: "liability" }, cid);
    const expense = await getOrCreateAccount({ code: "REV-SALES", name: "إيرادات المبيعات", type: "revenue" }, cid);
    return { prepaid_account_id: prepaid.id, expense_account_id: expense.id, prepaidAccount: prepaid, expenseAccount: expense };
  }
  if (type === "accrual" && category === "expense") {
    const prepaid = await getOrCreateAccount({ code: "LIAB-ACCRUED-EXP", name: "مصروفات مستحقة", type: "liability" }, cid);
    const expense = await getOrCreateAccount({ code: "EXP-GENERAL", name: "مصروفات عمومية وإدارية", type: "expense" }, cid);
    return { prepaid_account_id: prepaid.id, expense_account_id: expense.id, prepaidAccount: prepaid, expenseAccount: expense };
  }
  // accrual + revenue
  const prepaid = await getOrCreateAccount({ code: "ASSET-ACCRUED-REV", name: "إيرادات مستحقة التحصيل", type: "asset" }, cid);
  const expense = await getOrCreateAccount({ code: "REV-MISC", name: "إيرادات متنوعة", type: "revenue" }, cid);
  return { prepaid_account_id: prepaid.id, expense_account_id: expense.id, prepaidAccount: prepaid, expenseAccount: expense };
}

/* GET /api/accruals */
router.get("/accruals", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const rows = await db.select().from(accrualsTable)
    .where(eq(accrualsTable.company_id, cid))
    .orderBy(desc(accrualsTable.created_at));
  res.json(rows.map(fmt));
}));

/* POST /api/accruals */
router.post("/accruals", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const parsed = createAccrualSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات الاستحقاق غير صالحة", details: parsed.error.issues.map(i => i.message) }); return;
  }
  const { type, category, description, total_amount, months_total, start_date, end_date } = parsed.data;

  const accounts = await getAccrualAccounts(type, category, description, cid);

  const [row] = await db.insert(accrualsTable).values({
    type, category, description,
    total_amount: String(total_amount),
    months_total: Number(months_total),
    start_date, end_date,
    expense_account_id: accounts.expense_account_id,
    prepaid_account_id: accounts.prepaid_account_id,
    amount_recognized: "0",
    status: "active",
    company_id: cid,
  }).returning();

  res.status(201).json(fmt(row));
}));

/* POST /api/accruals/:id/recognize — تسجيل الاستحقاق الشهري */
router.post("/accruals/:id/recognize", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const recParsed = recognizeSchema.safeParse(req.body);
  if (!recParsed.success) {
    res.status(400).json({ error: "الفترة مطلوبة بصيغة YYYY-MM", details: recParsed.error.issues.map(i => i.message) }); return;
  }
  const { period } = recParsed.data;

  const [accrual] = await db.select().from(accrualsTable)
    .where(and(eq(accrualsTable.id, Number(req.params.id)), eq(accrualsTable.company_id, cid)));
  if (!accrual) throw httpError(404, "السجل غير موجود");
  if (accrual.status !== "active") throw httpError(400, "تم الانتهاء من هذا السجل");

  const [existing] = await db.select().from(accrualRunsTable)
    .where(and(
      eq(accrualRunsTable.accrual_id, accrual.id),
      eq(accrualRunsTable.period, period),
      eq(accrualRunsTable.company_id, cid)
    ));
  if (existing) throw httpError(409, "تم التسجيل لهذه الفترة مسبقاً");

  const monthly = accrual.months_total > 0 ? Number(accrual.total_amount) / accrual.months_total : 0;
  const remaining = Number(accrual.total_amount) - Number(accrual.amount_recognized);
  const amount = Math.min(monthly, remaining);
  if (amount < 0.001) throw httpError(400, "لا يوجد مبلغ متبقي للتسجيل");

  const expenseAcc = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, accrual.expense_account_id!), eq(accountsTable.company_id, cid))).then(r => r[0]);
  const prepaidAcc = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, accrual.prepaid_account_id!), eq(accountsTable.company_id, cid))).then(r => r[0]);

  // القيد: من مصروف / إلى مدفوع مقدماً (أو العكس)
  let debitAcc = expenseAcc, creditAcc = prepaidAcc;
  if (accrual.type === "prepayment" && accrual.category === "revenue") {
    debitAcc = prepaidAcc; creditAcc = expenseAcc;
  }
  if (accrual.type === "accrual" && accrual.category === "revenue") {
    debitAcc = prepaidAcc; creditAcc = expenseAcc;
  }

  const [{ total }] = await db.select({ total: count() })
    .from(journalEntriesTable).where(eq(journalEntriesTable.company_id, cid));
  const entryNo = `JE-${String(Number(total) + 1).padStart(5, "0")}`;

  const [entry] = await db.insert(journalEntriesTable).values({
    entry_no: entryNo,
    date: `${period}-01`,
    description: `${accrual.type === "prepayment" ? "استحقاق مدفوع مقدماً" : "مصروف/إيراد مستحق"} - ${accrual.description} - ${period}`,
    status: "posted",
    reference: `ACC-${accrual.id}-${period}`,
    total_debit: String(amount),
    total_credit: String(amount),
    company_id: cid,
  }).returning();

  await db.insert(journalEntryLinesTable).values([
    { entry_id: entry.id, account_id: debitAcc.id, account_code: debitAcc.code, account_name: debitAcc.name, debit: String(amount), credit: "0" },
    { entry_id: entry.id, account_id: creditAcc.id, account_code: creditAcc.code, account_name: creditAcc.name, debit: "0", credit: String(amount) },
  ]);

  for (const [acc, sign] of [[debitAcc, 1], [creditAcc, -1]] as [typeof expenseAcc, number][]) {
    await db.update(accountsTable)
      .set({ current_balance: sql`current_balance + ${String(amount * sign)}::numeric` })
      .where(eq(accountsTable.id, acc.id));
  }

  const newRecognized = Number(accrual.amount_recognized) + amount;
  const newStatus = newRecognized >= Number(accrual.total_amount) - 0.001 ? "completed" : "active";

  await db.update(accrualsTable)
    .set({ amount_recognized: String(newRecognized), status: newStatus })
    .where(and(eq(accrualsTable.id, accrual.id), eq(accrualsTable.company_id, cid)));

  const [run] = await db.insert(accrualRunsTable).values({
    accrual_id: accrual.id, period, amount: String(amount),
    entry_id: entry.id, company_id: cid,
  }).returning();

  res.json({ ...run, amount: Number(run.amount), created_at: run.created_at.toISOString() });
}));

/* DELETE /api/accruals/:id */
router.delete("/accruals/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const [row] = await db.select().from(accrualsTable)
    .where(and(eq(accrualsTable.id, Number(req.params.id)), eq(accrualsTable.company_id, cid)));
  if (!row) throw httpError(404, "غير موجود");
  if (Number(row.amount_recognized) > 0) throw httpError(400, "لا يمكن حذف سجل تم استحقاق جزء منه");
  await db.delete(accrualsTable)
    .where(and(eq(accrualsTable.id, Number(req.params.id)), eq(accrualsTable.company_id, cid)));
  res.json({ message: "تم الحذف" });
}));

export default router;
