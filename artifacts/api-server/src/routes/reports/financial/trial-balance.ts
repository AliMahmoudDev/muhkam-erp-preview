/**
 * reports/financial/trial-balance.ts
 * GET /api/reports/trial-balance — ميزان المراجعة
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { getTenant } from "../../../middleware/auth";
import { firstZodError } from "../../../lib/schemas";
import { safeDate } from "../shared";

const router: IRouter = Router();

const dateRangeQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_from يجب أن يكون YYYY-MM-DD").optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_to يجب أن يكون YYYY-MM-DD").optional(),
});

/* ─────────────────────────────────────────────────────────────────────────── *
 * GET /api/reports/trial-balance?date_from=&date_to=
 *
 * ميزان المراجعة — يُجمِّع كل حركات المدين والدائن لكل حساب
 * ─────────────────────────────────────────────────────────────────────────── */
router.get("/reports/trial-balance", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_accounts")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير المالية" }); return;
  }
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: firstZodError(qp.error) }); return; }
  const companyId = getTenant(req);

  const dateFrom = safeDate(qp.data.date_from);
  const dateTo   = safeDate(qp.data.date_to);

  const dateFilter = dateFrom && dateTo
    ? sql`AND je.date BETWEEN ${dateFrom} AND ${dateTo}`
    : dateFrom
      ? sql`AND je.date >= ${dateFrom}`
      : dateTo
        ? sql`AND je.date <= ${dateTo}`
        : sql``;

  const rawRows = await db.execute(sql`
    SELECT
      a.id          AS account_id,
      a.code        AS account_code,
      a.name        AS account_name,
      a.type        AS account_type,
      COALESCE(SUM(CASE WHEN jel.debit  > 0 THEN jel.debit  ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END), 0) AS total_credit
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jel.entry_id
      AND je.company_id = ${companyId}
      AND je.status = 'posted'
      ${dateFilter}
    WHERE a.company_id = ${companyId}
      AND a.is_active = true
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `);

    const accounts = (rawRows.rows as Record<string, unknown>[]).map((r: Record<string, unknown>) => ({
    account_id:    r.account_id,
    account_code:  r.account_code,
    account_name:  r.account_name,
    account_type:  r.account_type,
    total_debit:   Number(r.total_debit),
    total_credit:  Number(r.total_credit),
    balance:       Number(r.total_debit) - Number(r.total_credit),
  }));

  const grandDebit  = accounts.reduce((s, a) => s + a.total_debit,  0);
  const grandCredit = accounts.reduce((s, a) => s + a.total_credit, 0);
  const diff        = Math.abs(grandDebit - grandCredit);
  const TB_TOLERANCE = 0.01; // stricter than the global 0.02

  res.json({
    accounts,
    summary: {
      grand_debit:  Number(grandDebit.toFixed(2)),
      grand_credit: Number(grandCredit.toFixed(2)),
      difference:   Number(diff.toFixed(2)),
      is_balanced:  diff <= TB_TOLERANCE,
    },
    period: { date_from: dateFrom ?? null, date_to: dateTo ?? null },
    generated_at: new Date().toISOString(),
  });
}));

export default router;
