/**
 * /api/budgets — الميزانية التقديرية مع المقارنة بالفعلي
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, budgetsTable, budgetLinesTable, accountsTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";

const router: IRouter = Router();

function fmtBudget(b: typeof budgetsTable.$inferSelect) {
  return { ...b, created_at: b.created_at.toISOString() };
}

/* GET /api/budgets */
router.get("/budgets", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const budgets = await db.select().from(budgetsTable)
    .where(eq(budgetsTable.company_id, cid))
    .orderBy(desc(budgetsTable.created_at));
  res.json(budgets.map(fmtBudget));
}));

/* POST /api/budgets */
router.post("/budgets", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { name, fiscal_year, date_from, date_to, notes } = req.body;
  if (!name || !fiscal_year || !date_from || !date_to) throw httpError(400, "البيانات الأساسية ناقصة");

  const [budget] = await db.insert(budgetsTable).values({
    name, fiscal_year: Number(fiscal_year), date_from, date_to,
    notes: notes || null, status: "draft", company_id: cid,
  }).returning();

  res.status(201).json(fmtBudget(budget));
}));

/* GET /api/budgets/:id */
router.get("/budgets/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const [budget] = await db.select().from(budgetsTable)
    .where(and(eq(budgetsTable.id, Number(req.params.id)), eq(budgetsTable.company_id, cid)));
  if (!budget) throw httpError(404, "الميزانية غير موجودة");

  const lines = await db.select().from(budgetLinesTable)
    .where(and(eq(budgetLinesTable.budget_id, budget.id), eq(budgetLinesTable.company_id, cid)))
    .orderBy(budgetLinesTable.period, budgetLinesTable.account_code);

  res.json({ ...fmtBudget(budget), lines: lines.map(l => ({ ...l, budgeted_amount: Number(l.budgeted_amount) })) });
}));

/* PUT /api/budgets/:id/lines — تحديث سطر الميزانية */
router.put("/budgets/:id/lines", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const budgetId = Number(req.params.id);

  const [budget] = await db.select().from(budgetsTable)
    .where(and(eq(budgetsTable.id, budgetId), eq(budgetsTable.company_id, cid)));
  if (!budget) throw httpError(404, "الميزانية غير موجودة");

  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    const { account_id, period, budgeted_amount } = item;
    if (!account_id || !period || budgeted_amount === undefined) continue;

    const [account] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.id, Number(account_id)), eq(accountsTable.company_id, cid)));
    if (!account) continue;

    const existing = await db.select().from(budgetLinesTable)
      .where(and(
        eq(budgetLinesTable.budget_id, budgetId),
        eq(budgetLinesTable.account_id, Number(account_id)),
        eq(budgetLinesTable.period, period),
        eq(budgetLinesTable.company_id, cid)
      ));

    if (existing.length > 0) {
      await db.update(budgetLinesTable)
        .set({ budgeted_amount: String(budgeted_amount) })
        .where(and(
          eq(budgetLinesTable.budget_id, budgetId),
          eq(budgetLinesTable.account_id, Number(account_id)),
          eq(budgetLinesTable.period, period),
          eq(budgetLinesTable.company_id, cid)
        ));
    } else {
      await db.insert(budgetLinesTable).values({
        budget_id: budgetId, account_id: Number(account_id),
        account_code: account.code, account_name: account.name,
        account_type: account.type, period,
        budgeted_amount: String(budgeted_amount),
        company_id: cid,
      });
    }
  }

  res.json({ message: "تم تحديث الميزانية" });
}));

/* GET /api/budgets/:id/actual-vs-budget */
router.get("/budgets/:id/actual-vs-budget", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const [budget] = await db.select().from(budgetsTable)
    .where(and(eq(budgetsTable.id, Number(req.params.id)), eq(budgetsTable.company_id, cid)));
  if (!budget) throw httpError(404, "الميزانية غير موجودة");

  const lines = await db.select().from(budgetLinesTable)
    .where(and(eq(budgetLinesTable.budget_id, budget.id), eq(budgetLinesTable.company_id, cid)));

  if (lines.length === 0) {
    res.json({ budget: fmtBudget(budget), comparison: [] });
    return;
  }

  // جلب الفعلي من قيود اليومية لكل حساب في الفترة
  const actualData = await db.execute(sql`
    SELECT
      jel.account_id,
      jel.account_code,
      LEFT(je.date, 7) AS period,
      COALESCE(SUM(CAST(jel.debit AS FLOAT8)), 0)  AS total_debit,
      COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS total_credit
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    WHERE je.company_id = ${cid}
      AND je.date >= ${budget.date_from}
      AND je.date <= ${budget.date_to}
    GROUP BY jel.account_id, jel.account_code, period
  `);

  const actualMap = new Map<string, { debit: number; credit: number }>();
  for (const r of actualData.rows as Array<{ account_id: number; account_code: string; period: string; total_debit: number; total_credit: number }>) {
    actualMap.set(`${r.account_id}-${r.period}`, { debit: Number(r.total_debit), credit: Number(r.total_credit) });
  }

  const comparison = lines.map(line => {
    const key = `${line.account_id}-${line.period}`;
    const actual = actualMap.get(key) ?? { debit: 0, credit: 0 };
    const budgeted = Number(line.budgeted_amount);

    let actualAmount = 0;
    if (line.account_type === "revenue") actualAmount = actual.credit - actual.debit;
    else actualAmount = actual.debit - actual.credit;

    const variance = actualAmount - budgeted;
    const pct = budgeted !== 0 ? (variance / budgeted) * 100 : null;

    return {
      account_id: line.account_id,
      account_code: line.account_code,
      account_name: line.account_name,
      account_type: line.account_type,
      period: line.period,
      budgeted_amount: budgeted,
      actual_amount: Math.round(actualAmount * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variance_pct: pct !== null ? Math.round(pct * 10) / 10 : null,
    };
  });

  const totBudgeted = comparison.reduce((s, r) => s + r.budgeted_amount, 0);
  const totActual   = comparison.reduce((s, r) => s + r.actual_amount, 0);

  res.json({
    budget: fmtBudget(budget),
    comparison,
    summary: {
      total_budgeted: Math.round(totBudgeted * 100) / 100,
      total_actual: Math.round(totActual * 100) / 100,
      total_variance: Math.round((totActual - totBudgeted) * 100) / 100,
    },
  });
}));

/* DELETE /api/budgets/:id */
router.delete("/budgets/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  await db.delete(budgetLinesTable)
    .where(and(eq(budgetLinesTable.budget_id, Number(req.params.id)), eq(budgetLinesTable.company_id, cid)));
  await db.delete(budgetsTable)
    .where(and(eq(budgetsTable.id, Number(req.params.id)), eq(budgetsTable.company_id, cid)));
  res.json({ message: "تم الحذف" });
}));

export default router;
