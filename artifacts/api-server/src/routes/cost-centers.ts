/**
 * /api/cost-centers — مراكز التكلفة
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, costCentersTable, journalEntriesTable, journalEntryLinesTable, accountsTable } from "@workspace/db";
import { wrap, httpError } from "../lib/async-handler";

const router: IRouter = Router();

function fmt(c: typeof costCentersTable.$inferSelect) {
  return { ...c, created_at: c.created_at.toISOString() };
}

/* GET /api/cost-centers */
router.get("/cost-centers", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const rows = await db.select().from(costCentersTable)
    .where(eq(costCentersTable.company_id, cid))
    .orderBy(costCentersTable.code);
  res.json(rows.map(fmt));
}));

/* POST /api/cost-centers */
router.post("/cost-centers", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { code, name, description } = req.body;
  if (!code || !name) throw httpError(400, "الكود والاسم مطلوبان");

  const [row] = await db.insert(costCentersTable).values({
    code, name, description: description || null, is_active: true, company_id: cid,
  }).returning();

  res.status(201).json(fmt(row));
}));

/* PUT /api/cost-centers/:id */
router.put("/cost-centers/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const { code, name, description, is_active } = req.body;

  const [row] = await db.update(costCentersTable)
    .set({ code, name, description: description || null, is_active: is_active !== false })
    .where(and(eq(costCentersTable.id, Number(req.params.id)), eq(costCentersTable.company_id, cid)))
    .returning();

  if (!row) throw httpError(404, "مركز التكلفة غير موجود");
  res.json(fmt(row));
}));

/* DELETE /api/cost-centers/:id */
router.delete("/cost-centers/:id", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  await db.delete(costCentersTable)
    .where(and(eq(costCentersTable.id, Number(req.params.id)), eq(costCentersTable.company_id, cid)));
  res.json({ message: "تم الحذف" });
}));

/* GET /api/cost-centers/:id/report — تقرير الإيرادات والمصروفات بمركز التكلفة */
router.get("/cost-centers/:id/report", wrap(async (req, res) => {
  const cid = req.user!.company_id!;
  const ccId = Number(req.params.id);
  const { date_from, date_to } = req.query as Record<string, string>;

  const [cc] = await db.select().from(costCentersTable)
    .where(and(eq(costCentersTable.id, ccId), eq(costCentersTable.company_id, cid)));
  if (!cc) throw httpError(404, "مركز التكلفة غير موجود");

  const fromCond = date_from ? sql`AND je.date >= ${date_from}` : sql``;
  const toCond   = date_to   ? sql`AND je.date <= ${date_to}`   : sql``;

  const rows = await db.execute(sql`
    SELECT
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0) AS total_debit,
      COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS total_credit
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE jel.cost_center_id = ${ccId}
      AND je.company_id = ${cid}
      ${fromCond}
      ${toCond}
    GROUP BY a.code, a.name, a.type
    ORDER BY a.type, a.code
  `);

  const lines = (rows.rows as Array<{ code: string; name: string; type: string; total_debit: number; total_credit: number }>)
    .map(r => ({
      account_code: r.code,
      account_name: r.name,
      account_type: r.type,
      total_debit: Number(r.total_debit),
      total_credit: Number(r.total_credit),
      net: r.type === "revenue" ? Number(r.total_credit) - Number(r.total_debit)
         : Number(r.total_debit) - Number(r.total_credit),
    }));

  const totalRevenue = lines.filter(l => l.account_type === "revenue").reduce((s, l) => s + l.net, 0);
  const totalExpense = lines.filter(l => l.account_type === "expense").reduce((s, l) => s + l.net, 0);

  res.json({
    cost_center: fmt(cc),
    lines,
    summary: {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_expense: Math.round(totalExpense * 100) / 100,
      net_income: Math.round((totalRevenue - totalExpense) * 100) / 100,
    },
  });
}));

export default router;
