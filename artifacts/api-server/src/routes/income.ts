import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, incomeTable, transactionsTable, safesTable } from "@workspace/db";
import {
  GetIncomeResponse,
  CreateIncomeBody,
  DeleteIncomeParams,
  DeleteIncomeResponse,
} from "@workspace/api-zod";
import { wrap, httpError } from "../lib/async-handler";
import { getTenant } from "../middleware/auth";

const router: IRouter = Router();

function formatIncome(i: typeof incomeTable.$inferSelect) {
  return { ...i, amount: Number(i.amount), created_at: i.created_at.toISOString() };
}

router.get("/income", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const income = await db.select().from(incomeTable)
    .where(eq(incomeTable.company_id, companyId))
    .orderBy(incomeTable.created_at);
  res.json(GetIncomeResponse.parse(income.map(formatIncome)));
}));

router.post("/income", wrap(async (req, res) => {
  const parsed = CreateIncomeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const safe_id: number | undefined = req.body.safe_id ? parseInt(req.body.safe_id) : undefined;
  const amt = parsed.data.amount;
  if (amt <= 0) throw httpError(400, "المبلغ يجب أن يكون أكبر من صفر");

  const cid = req.user!.company_id!;
  const income = await db.transaction(async (tx) => {
    let safe: typeof safesTable.$inferSelect | null = null;
    if (safe_id) {
      const [s] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, safe_id), eq(safesTable.company_id, cid)));
      if (!s) throw httpError(400, "الخزينة غير موجودة");
      await tx.update(safesTable)
        .set({ balance: String(Number(s.balance) + amt) })
        .where(and(eq(safesTable.id, s.id), eq(safesTable.company_id, cid)));
      safe = s;
    }
    const companyId = cid;
    const [inc] = await tx.insert(incomeTable).values({
      source: parsed.data.source,
      amount: String(amt),
      description: parsed.data.description ?? null,
      safe_id: safe?.id ?? null,
      safe_name: safe?.name ?? null,
      company_id: companyId,
    }).returning();
    await tx.insert(transactionsTable).values({
      type: "income", reference_type: "income", reference_id: inc.id,
      safe_id: safe?.id ?? null, safe_name: safe?.name ?? null,
      amount: String(amt), direction: safe ? "in" : "none",
      description: parsed.data.description ?? parsed.data.source,
      date: new Date().toISOString().split("T")[0],
      company_id: companyId,
    });
    return inc;
  });
  res.status(201).json(formatIncome(income));
}));

router.delete("/income/:id", wrap(async (req, res) => {
  const params = DeleteIncomeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const cid = req.user!.company_id!;
  await db.transaction(async (tx) => {
    const [inc] = await tx.select().from(incomeTable)
      .where(and(eq(incomeTable.id, params.data.id), eq(incomeTable.company_id, cid)));
    if (!inc) throw httpError(404, "السجل غير موجود");
    if (inc.safe_id) {
      const [safe] = await tx.select().from(safesTable)
        .where(and(eq(safesTable.id, inc.safe_id), eq(safesTable.company_id, cid)));
      if (safe) await tx.update(safesTable)
        .set({ balance: String(Number(safe.balance) - Number(inc.amount)) })
        .where(and(eq(safesTable.id, safe.id), eq(safesTable.company_id, cid)));
    }
    await tx.delete(incomeTable)
      .where(and(eq(incomeTable.id, params.data.id), eq(incomeTable.company_id, cid)));
  });
  res.json(DeleteIncomeResponse.parse({ success: true, message: "Income deleted" }));
}));

export default router;
