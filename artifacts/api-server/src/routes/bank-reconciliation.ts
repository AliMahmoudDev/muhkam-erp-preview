/**
 * /api/bank-accounts & /api/bank-statement-lines — المطابقة البنكية
 */
import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, bankAccountsTable, bankStatementLinesTable, journalEntriesTable, safesTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";
import { requireFeature } from "../middleware/feature-guard";

const router: IRouter = Router();
router.use(["/bank-accounts", "/bank-statement-lines"], requireFeature("bank_reconciliation"));

function fmtBank(b: typeof bankAccountsTable.$inferSelect) {
  return { ...b, opening_balance: Number(b.opening_balance), created_at: b.created_at.toISOString() };
}
function fmtLine(l: typeof bankStatementLinesTable.$inferSelect) {
  return { ...l, amount: Number(l.amount), created_at: l.created_at.toISOString() };
}

/* ═══════ Bank Accounts ═══════ */

router.get("/bank-accounts", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const rows = await db.select().from(bankAccountsTable)
    .where(eq(bankAccountsTable.company_id, cid))
    .orderBy(desc(bankAccountsTable.created_at));
  res.json(rows.map(fmtBank));
}));

router.post("/bank-accounts", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { name, account_number, bank_name, currency, safe_id, opening_balance } = req.body;
  if (!name || !bank_name) throw httpError(400, "الاسم واسم البنك مطلوبان");
  const [row] = await db.insert(bankAccountsTable).values({
    name, account_number: account_number || null, bank_name,
    currency: currency || "EGP",
    safe_id: safe_id ? Number(safe_id) : null,
    opening_balance: String(opening_balance || 0),
    is_active: true,
    company_id: cid,
  }).returning();
  res.status(201).json(fmtBank(row));
}));

router.delete("/bank-accounts/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  await db.delete(bankAccountsTable)
    .where(and(eq(bankAccountsTable.id, Number(req.params.id)), eq(bankAccountsTable.company_id, cid)));
  res.json({ message: "تم الحذف" });
}));

/* ═══════ Bank Statement Lines ═══════ */

router.get("/bank-accounts/:id/lines", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const bankId = Number(req.params.id);
  const [bank] = await db.select().from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.id, bankId), eq(bankAccountsTable.company_id, cid)));
  if (!bank) throw httpError(404, "الحساب البنكي غير موجود");

  const lines = await db.select().from(bankStatementLinesTable)
    .where(and(eq(bankStatementLinesTable.bank_account_id, bankId), eq(bankStatementLinesTable.company_id, cid)))
    .orderBy(desc(bankStatementLinesTable.date));

  res.json(lines.map(fmtLine));
}));

router.post("/bank-accounts/:id/lines", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const bankId = Number(req.params.id);
  const [bank] = await db.select().from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.id, bankId), eq(bankAccountsTable.company_id, cid)));
  if (!bank) throw httpError(404, "الحساب البنكي غير موجود");

  const lines = Array.isArray(req.body) ? req.body : [req.body];
  if (lines.length === 0) throw httpError(400, "لا توجد سطور للإضافة");
  for (const l of lines) {
    if (!["credit", "debit"].includes(l.type)) throw httpError(400, `نوع السطر "${l.type}" غير صحيح — يجب أن يكون credit أو debit`);
    if (!isFinite(Number(l.amount)) || Number(l.amount) <= 0) throw httpError(400, "مبلغ كل سطر يجب أن يكون أكبر من صفر");
    if (!l.date || !l.description) throw httpError(400, "التاريخ والوصف مطلوبان لكل سطر");
  }

  const inserted = await db.insert(bankStatementLinesTable).values(
    lines.map((l: { date: string; description: string; amount: number; type: string; reference?: string }) => ({
      bank_account_id: bankId,
      date: l.date,
      description: l.description,
      amount: String(l.amount),
      type: l.type,
      reference: l.reference || null,
      status: "unmatched",
      company_id: cid,
    }))
  ).returning();

  res.status(201).json(inserted.map(fmtLine));
}));

/* PATCH /api/bank-statement-lines/:id/match */
router.patch("/bank-statement-lines/:id/match", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { entry_id } = req.body;

  const [line] = await db.select().from(bankStatementLinesTable)
    .where(and(eq(bankStatementLinesTable.id, Number(req.params.id)), eq(bankStatementLinesTable.company_id, cid)));
  if (!line) throw httpError(404, "السطر غير موجود");
  if (line.status === "matched") throw httpError(409, "تمت مطابقة هذا السطر مسبقاً");

  if (entry_id) {
    const [entry] = await db.select().from(journalEntriesTable)
      .where(and(eq(journalEntriesTable.id, Number(entry_id)), eq(journalEntriesTable.company_id, cid)));
    if (!entry) throw httpError(404, "قيد اليومية غير موجود");
  }

  const [updated] = await db.update(bankStatementLinesTable)
    .set({ status: "matched", matched_entry_id: entry_id ? Number(entry_id) : null })
    .where(and(eq(bankStatementLinesTable.id, Number(req.params.id)), eq(bankStatementLinesTable.company_id, cid)))
    .returning();

  res.json(fmtLine(updated));
}));

/* PATCH /api/bank-statement-lines/:id/unmatch */
router.patch("/bank-statement-lines/:id/unmatch", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const [updated] = await db.update(bankStatementLinesTable)
    .set({ status: "unmatched", matched_entry_id: null })
    .where(and(eq(bankStatementLinesTable.id, Number(req.params.id)), eq(bankStatementLinesTable.company_id, cid)))
    .returning();
  if (!updated) throw httpError(404, "غير موجود");
  res.json(fmtLine(updated));
}));

/* GET /api/bank-accounts/:id/reconciliation — ملخص المطابقة */
router.get("/bank-accounts/:id/reconciliation", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const bankId = Number(req.params.id);

  const [bank] = await db.select().from(bankAccountsTable)
    .where(and(eq(bankAccountsTable.id, bankId), eq(bankAccountsTable.company_id, cid)));
  if (!bank) throw httpError(404, "الحساب البنكي غير موجود");

  const lines = await db.select().from(bankStatementLinesTable)
    .where(and(eq(bankStatementLinesTable.bank_account_id, bankId), eq(bankStatementLinesTable.company_id, cid)));

  const totalCredits = lines.filter(l => l.type === "credit").reduce((s, l) => s + Number(l.amount), 0);
  const totalDebits  = lines.filter(l => l.type === "debit").reduce((s, l) => s + Number(l.amount), 0);
  const bankBalance  = Number(bank.opening_balance) + totalCredits - totalDebits;

  const matched   = lines.filter(l => l.status === "matched").length;
  const unmatched = lines.filter(l => l.status === "unmatched").length;

  const unmatchedCredits = lines.filter(l => l.status === "unmatched" && l.type === "credit").reduce((s, l) => s + Number(l.amount), 0);
  const unmatchedDebits  = lines.filter(l => l.status === "unmatched" && l.type === "debit").reduce((s, l) => s + Number(l.amount), 0);

  // رصيد الخزينة المرتبطة
  let safeBalance: number | null = null;
  if (bank.safe_id) {
    const [safe] = await db.select().from(safesTable)
      .where(and(eq(safesTable.id, bank.safe_id), eq(safesTable.company_id, cid)));
    if (safe) safeBalance = Number(safe.balance);
  }

  res.json({
    bank_account: fmtBank(bank),
    bank_balance: Math.round(bankBalance * 100) / 100,
    safe_balance: safeBalance,
    difference: safeBalance !== null ? Math.round((bankBalance - safeBalance) * 100) / 100 : null,
    total_lines: lines.length,
    matched_count: matched,
    unmatched_count: unmatched,
    unmatched_credits: Math.round(unmatchedCredits * 100) / 100,
    unmatched_debits: Math.round(unmatchedDebits * 100) / 100,
    is_reconciled: unmatched === 0 && (safeBalance === null || Math.abs(bankBalance - safeBalance) < 0.01),
  });
}));

export default router;
