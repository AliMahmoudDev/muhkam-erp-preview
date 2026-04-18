import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, expensesTable, expenseCategoriesTable, transactionsTable, safesTable } from "@workspace/db";
import {
  GetExpensesResponse,
  CreateExpenseBody,
  DeleteExpenseParams,
  DeleteExpenseResponse,
} from "@workspace/api-zod";
import { wrap, httpError } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";
import { assertPeriodOpen } from "../lib/period-lock";
import { getOrCreateSafeAccount, getOrCreateGeneralExpenseAccount, createAutoJournalEntry } from "../lib/auto-account";

const router: IRouter = Router();

function formatExpense(e: typeof expensesTable.$inferSelect) {
  return { ...e, amount: Number(e.amount), created_at: e.created_at.toISOString() };
}

/* ═══════════════════════════════════════════════════════════
   تصنيفات المصروفات — Expense Categories
═══════════════════════════════════════════════════════════ */

router.get("/expense-categories", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_expenses")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const cats = await db.select().from(expenseCategoriesTable)
    .where(eq(expenseCategoriesTable.company_id, companyId))
    .orderBy(expenseCategoriesTable.name);
  res.json(cats);
}));

router.post("/expense-categories", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_add_expense")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const name = String(req.body.name ?? "").trim();
  if (!name) { res.status(400).json({ error: "اسم التصنيف مطلوب" }); return; }

  const [existing] = await db.select().from(expenseCategoriesTable)
    .where(and(eq(expenseCategoriesTable.company_id, companyId), eq(expenseCategoriesTable.name, name)));
  if (existing) { res.status(400).json({ error: `التصنيف "${name}" موجود بالفعل` }); return; }

  const [cat] = await db.insert(expenseCategoriesTable).values({ name, company_id: companyId }).returning();
  res.status(201).json(cat);
}));

router.delete("/expense-categories/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_add_expense")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صالح" }); return; }
  const cidExp = req.user!.company_id!;
  const [cat] = await db.select({ name: expenseCategoriesTable.name }).from(expenseCategoriesTable).where(and(eq(expenseCategoriesTable.id, id), eq(expenseCategoriesTable.company_id, cidExp))).limit(1);
  if (!cat) { res.status(404).json({ error: "التصنيف غير موجود" }); return; }
  const [linkedExpense] = await db.select({ id: expensesTable.id }).from(expensesTable).where(and(eq(expensesTable.category, cat.name), eq(expensesTable.company_id, cidExp))).limit(1);
  if (linkedExpense) { res.status(400).json({ error: "لا يمكن حذف التصنيف لأنه مرتبط بمصروفات" }); return; }
  await db.delete(expenseCategoriesTable).where(and(eq(expenseCategoriesTable.id, id), eq(expenseCategoriesTable.company_id, cidExp)));
  res.json({ success: true });
}));

/* ═══════════════════════════════════════════════════════════
   تقارير المصروفات — Expense Reports
═══════════════════════════════════════════════════════════ */

router.get("/expense-reports", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_expenses")) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const companyId = req.user!.company_id!;
  const category  = req.query.category  ? String(req.query.category)  : null;
  const dateFrom  = req.query.date_from ? String(req.query.date_from) : null;
  const dateTo    = req.query.date_to   ? String(req.query.date_to)   : null;

  const rows = await db.execute(sql`
    SELECT
      e.id,
      e.category,
      CAST(e.amount AS FLOAT8) AS amount,
      e.description,
      e.safe_name,
      TO_CHAR(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date
    FROM expenses e
    WHERE e.company_id = ${companyId}
      AND (${category}::text IS NULL OR e.category = ${category}::text)
      AND (${dateFrom}::date IS NULL OR e.created_at::date >= ${dateFrom}::date)
      AND (${dateTo}::date   IS NULL OR e.created_at::date <= ${dateTo}::date)
    ORDER BY e.created_at DESC
  `);

  const result = (rows.rows as any[]).map(r => ({
    id:          r.id,
    category:    r.category,
    amount:      Math.round(Number(r.amount) * 100) / 100,
    description: r.description ?? null,
    safe_name:   r.safe_name   ?? null,
    date:        r.date,
  }));

  res.json(result);
}));

/* ═══════════════════════════════════════════════════════════
   المصروفات — Expenses CRUD
═══════════════════════════════════════════════════════════ */

router.get("/expenses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_expenses")) {
    res.status(403).json({ error: "غير مصرح بعرض المصروفات" }); return;
  }
  const companyId = req.user?.company_id ?? null;
  const expenses = await db.select().from(expensesTable)
    .where(companyId !== null ? eq(expensesTable.company_id, companyId) : undefined)
    .orderBy(expensesTable.created_at);
  res.json(GetExpensesResponse.parse(expenses.map(formatExpense)));
}));

router.post("/expenses", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_add_expense")) {
    res.status(403).json({ error: "غير مصرح بإضافة مصروفات" }); return;
  }

  await assertPeriodOpen(new Date().toISOString().split("T")[0], req);

  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const safe_id: number | undefined = req.body.safe_id ? parseInt(req.body.safe_id) : undefined;
  const amt = parsed.data.amount;

  const result = await db.transaction(async (tx) => {
    let safe: typeof safesTable.$inferSelect | null = null;
    if (safe_id) {
      const cidPre = req.user?.company_id ?? undefined;
      const [s] = await tx.select().from(safesTable).where(and(
        eq(safesTable.id, safe_id),
        ...(cidPre !== undefined ? [eq(safesTable.company_id, cidPre)] : []),
      ));
      if (!s) throw httpError(400, "الخزينة غير موجودة");
      // خصم ذرّي مع شرط كفاية الرصيد لمنع التضارب المتزامن
      const debited = await tx.update(safesTable)
        .set({ balance: sql`${safesTable.balance} - ${String(amt)}` })
        .where(and(
          eq(safesTable.id, s.id),
          ...(cidPre !== undefined ? [eq(safesTable.company_id, cidPre)] : []),
          sql`${safesTable.balance} >= ${String(amt)}`,
        ))
        .returning();
      if (!debited[0]) throw httpError(400, `رصيد الخزينة غير كافٍ (${Number(s.balance).toFixed(2)} ج.م)`);
      safe = s;
    }
    const companyId = req.user?.company_id ?? undefined;
    const [exp] = await tx.insert(expensesTable).values({
      category: parsed.data.category,
      amount: String(amt),
      description: parsed.data.description ?? null,
      safe_id: safe?.id ?? null,
      safe_name: safe?.name ?? null,
      company_id: companyId,
    }).returning();
    await tx.insert(transactionsTable).values({
      type: "expense", reference_type: "expense", reference_id: exp.id,
      safe_id: safe?.id ?? null, safe_name: safe?.name ?? null,
      amount: String(amt), direction: safe ? "out" : "none",
      description: parsed.data.description ?? parsed.data.category,
      date: new Date().toISOString().split("T")[0],
      company_id: companyId,
    });
    return { exp, safe };
  });

  const { exp: expense, safe } = result;
  if (safe) {
    try {
      const cidExp = req.user!.company_id!;
      const expAcct  = await getOrCreateGeneralExpenseAccount(cidExp);
      const safeAcct = await getOrCreateSafeAccount(safe.id, safe.name, cidExp);
      const todayStr = new Date().toISOString().split("T")[0];
      await createAutoJournalEntry({
        date:        todayStr,
        description: `مصروف: ${parsed.data.category}${parsed.data.description ? ` — ${parsed.data.description}` : ""}`,
        reference:   `EXP-${expense.id}`,
        debit:  expAcct,
        credit: safeAcct,
        amount: amt,
        companyId: cidExp,
      });
    } catch (jeErr) {
      console.error("Failed to create journal entry for expense:", jeErr);
    }
  }
  res.status(201).json(formatExpense(expense));
}));

router.delete("/expenses/:id", wrap(async (req, res) => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [preCheck] = await db.select().from(expensesTable).where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.company_id, req.user!.company_id!)));
  if (!preCheck) { res.status(404).json({ error: "المصروف غير موجود" }); return; }
  await assertPeriodOpen(preCheck.created_at?.toISOString().split("T")[0] ?? null, req);

  let deletedSafeId:   number | null = null;
  let deletedSafeName: string | null = null;
  let deletedAmount:   number        = 0;
  let deletedCategory: string        = "";

  await db.transaction(async (tx) => {
    const [exp] = await tx.select().from(expensesTable).where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.company_id, req.user!.company_id!)));
    if (exp?.safe_id) {
      const cidGuard = req.user!.company_id!;
      const [safe] = await tx.select().from(safesTable).where(and(
        eq(safesTable.id, exp.safe_id),
        eq(safesTable.company_id, cidGuard),
      ));
      if (safe) {
        deletedSafeId   = safe.id;
        deletedSafeName = safe.name;
        await tx.update(safesTable)
          .set({ balance: sql`${safesTable.balance} + ${String(Number(exp.amount))}` })
          .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cidGuard)));
      }
    }
    if (exp) {
      deletedAmount   = Number(exp.amount);
      deletedCategory = exp.category ?? "مصروف محذوف";
    }
    await tx.delete(expensesTable).where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.company_id, req.user!.company_id!)));
  });

  if (deletedSafeId !== null && deletedAmount > 0) {
    try {
      const cidDel = req.user!.company_id!;
      const safeAcct = await getOrCreateSafeAccount(deletedSafeId, deletedSafeName ?? `خزينة ${deletedSafeId}`, cidDel);
      const expAcct  = await getOrCreateGeneralExpenseAccount(cidDel);
      const todayStr = new Date().toISOString().split("T")[0];
      await createAutoJournalEntry({
        date:        todayStr,
        description: `إلغاء مصروف: ${deletedCategory}`,
        reference:   `EXP-DEL-${params.data.id}`,
        debit:  safeAcct,
        credit: expAcct,
        amount: deletedAmount,
        companyId: cidDel,
      });
    } catch (jeErr) {
      console.error("Failed to create reversal JE for deleted expense:", jeErr);
    }
  }

  res.json(DeleteExpenseResponse.parse({ success: true, message: "Expense deleted" }));
}));

export default router;
