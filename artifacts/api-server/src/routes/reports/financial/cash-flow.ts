/**
 * reports/financial/cash-flow.ts
 * GET /api/reports/cash-flow — تقرير التدفق النقدي (Direct Method)
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { getTenant } from "../../../middleware/auth";
import { firstZodError } from "../../../lib/schemas";
import {
  safeDate, r2, buildValidation, TOLERANCE,
  cfSql,
} from "../shared";

const router: IRouter = Router();

const dateRangeQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_from يجب أن يكون YYYY-MM-DD").optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_to يجب أن يكون YYYY-MM-DD").optional(),
});

/* ─────────────────────────────────────────────────────────────────────────
 * 6. تقرير التدفق النقدي
 * GET /api/reports/cash-flow?date_from=&date_to=
 * ───────────────────────────────────────────────────────────────────────── */
router.get("/reports/cash-flow", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_accounts")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير المالية" }); return;
  }
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: firstZodError(qp.error) }); return; }
  const { date_from, date_to } = qp.data;
  const companyId = getTenant(req);
  const sfrom = safeDate(date_from);
  const sto   = safeDate(date_to);

  const cfRows = await db.execute(sql`
    WITH safe_lines AS (
      SELECT
        je.id          AS entry_id,
        je.date,
        CAST(jel.debit  AS FLOAT8) AS cash_in,
        CAST(jel.credit AS FLOAT8) AS cash_out
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
        AND je.status = 'posted'
      WHERE jel.account_code LIKE 'SAFE-%'
        ${sfrom ? sql`AND je.date >= ${sfrom}` : sql``}
        ${sto   ? sql`AND je.date <= ${sto}`   : sql``}
        ${cfSql("je", companyId)}
    ),
    entry_context AS (
      SELECT
        sl.entry_id,
        sl.date,
        sl.cash_in,
        sl.cash_out,
        BOOL_OR(jel.account_code LIKE 'AR-%'       AND CAST(jel.credit AS FLOAT8) > 0) AS ar_credited,
        BOOL_OR(jel.account_code = 'REV-MISC'      AND CAST(jel.credit AS FLOAT8) > 0) AS rev_misc_credited,
        BOOL_OR(jel.account_code LIKE 'AP-%'       AND CAST(jel.debit  AS FLOAT8) > 0) AS ap_debited,
        BOOL_OR(jel.account_code NOT LIKE 'EXP-COGS'
                AND jel.account_code LIKE 'EXP-%'  AND CAST(jel.debit  AS FLOAT8) > 0) AS exp_debited
      FROM safe_lines sl
      JOIN journal_entry_lines jel
        ON jel.entry_id = sl.entry_id
        AND jel.account_code NOT LIKE 'SAFE-%'
      GROUP BY sl.entry_id, sl.date, sl.cash_in, sl.cash_out
    )
    SELECT
      date,
      COALESCE(SUM(CASE WHEN cash_in  > 0 AND ar_credited
                        THEN cash_in  ELSE 0 END), 0)     AS receipts_in,
      COALESCE(SUM(CASE WHEN cash_in  > 0 AND rev_misc_credited
                        THEN cash_in  ELSE 0 END), 0)     AS deposits_in,
      COALESCE(SUM(CASE WHEN cash_in  > 0
                             AND NOT ar_credited
                             AND NOT rev_misc_credited
                        THEN cash_in  ELSE 0 END), 0)     AS cash_sales,
      COALESCE(SUM(CASE WHEN cash_out > 0 AND ap_debited
                        THEN cash_out ELSE 0 END), 0)     AS payments_out,
      COALESCE(SUM(CASE WHEN cash_out > 0 AND exp_debited
                        THEN cash_out ELSE 0 END), 0)     AS expenses_out,
      COALESCE(SUM(CASE WHEN cash_in  > 0 THEN cash_in  ELSE 0 END), 0) AS total_in,
      COALESCE(SUM(CASE WHEN cash_out > 0 THEN cash_out ELSE 0 END), 0) AS total_out
    FROM entry_context
    GROUP BY date
    ORDER BY date
  `);

  const days = (cfRows.rows as Record<string, unknown>[]).map(r => {
    const receipts_in  = r2(Number(r.receipts_in));
    const deposits_in  = r2(Number(r.deposits_in));
    const cash_sales   = r2(Number(r.cash_sales));
    const payments_out = r2(Number(r.payments_out));
    const expenses_out = r2(Number(r.expenses_out));
    const total_in     = r2(Number(r.total_in));
    const total_out    = r2(Number(r.total_out));
    return {
      day: String(r.date),
      receipts_in, cash_sales, deposits_in, total_in,
      payments_out, expenses_out, total_out,
      net_flow: r2(total_in - total_out),
    };
  });

  const totIn          = r2(days.reduce((s, d) => s + d.total_in,     0));
  const totOut         = r2(days.reduce((s, d) => s + d.total_out,    0));
  const totReceiptsIn  = r2(days.reduce((s, d) => s + d.receipts_in,  0));
  const totCashSales   = r2(days.reduce((s, d) => s + d.cash_sales,   0));
  const totDepositsIn  = r2(days.reduce((s, d) => s + d.deposits_in,  0));
  const totPaymentsOut = r2(days.reduce((s, d) => s + d.payments_out, 0));
  const totExpensesOut = r2(days.reduce((s, d) => s + d.expenses_out, 0));

  const cfDayWarnings: string[] = [];
  for (const d of days) {
    const expectedNet = r2(d.total_in) - r2(d.total_out);
    if (Math.abs(expectedNet - r2(d.net_flow)) > TOLERANCE)
      cfDayWarnings.push(`${d.day}: الوارد - الصادر ≠ صافي التدفق (${expectedNet} ≠ ${r2(d.net_flow)})`);
  }

  const cashFlowValidation = buildValidation([
    { name: "إجمالي الوارد - إجمالي الصادر = صافي التدفق النقدي",
      expected: r2(totIn) - r2(totOut),
      actual:   r2(totIn - totOut) },
    { name: "مجموع صافي أيام التدفق = إجمالي صافي التدفق",
      expected: r2(days.reduce((s, d) => s + d.net_flow, 0)),
      actual:   r2(totIn - totOut) },
  ]);

  if (cfDayWarnings.length > 0) {
    cashFlowValidation.status = "WARNING";
    cashFlowValidation.validation_message = [
      ...(cashFlowValidation.validation_message ? [cashFlowValidation.validation_message] : []),
      ...cfDayWarnings,
    ].join(" | ");
  }

  res.json({
    days,
    summary: {
      total_in:          r2(totIn),
      total_out:         r2(totOut),
      net_cash_flow:     r2(totIn - totOut),
      customer_receipts: r2(totReceiptsIn + totCashSales),
      receipts_in:       r2(totReceiptsIn),
      cash_sales:        r2(totCashSales),
      deposits_in:       r2(totDepositsIn),
      payments_out:      r2(totPaymentsOut),
      expenses_out:      r2(totExpensesOut),
    },
    validation: cashFlowValidation,
    _source: "ledger",
  });
}));

export default router;
