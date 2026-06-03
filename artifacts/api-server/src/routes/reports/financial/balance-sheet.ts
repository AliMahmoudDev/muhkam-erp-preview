/**
 * reports/financial/balance-sheet.ts
 * GET /api/reports/balance-sheet — الميزانية العمومية (Balance Sheet) — LEDGER-BASED
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { getTenant } from "../../../middleware/auth";
import { r2, buildValidation, TOLERANCE, cfSimpleSql } from "../shared";

const router: IRouter = Router();

/* ─────────────────────────────────────────────────────────────────────────
 * 10. الميزانية العمومية (Balance Sheet) — LEDGER-BASED
 * GET /api/reports/balance-sheet
 * ─────────────────────────────────────────────────────────────────────────*/
router.get("/reports/balance-sheet", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_accounts")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير المالية" }); return;
  }
  const companyId = getTenant(req);

  const [accountRows, inventoryRow, capitalRow] = await Promise.all([

    db.execute(sql`
      SELECT code, type, CAST(current_balance AS FLOAT8) AS bal
      FROM accounts
      WHERE is_active = true AND (
        code LIKE 'SAFE-%'
        OR code LIKE 'AR-%'
        OR code LIKE 'AP-%'
        OR type IN ('revenue', 'expense')
      ) ${cfSimpleSql(companyId)}
    `),

    db.execute(sql`
      SELECT COALESCE(SUM(CAST(quantity AS FLOAT8) * CAST(cost_price AS FLOAT8)), 0) AS inventory_value
      FROM products
      WHERE CAST(quantity AS FLOAT8) > 0 ${cfSimpleSql(companyId)}
    `),

    db.execute(sql`
      SELECT COALESCE(SUM(CAST(amount AS FLOAT8)), 0) AS opening_capital
      FROM transactions
      WHERE reference_type IN ('treasury_opening', 'customer_opening', 'supplier_opening', 'inventory_opening')
        ${cfSimpleSql(companyId)}
    `),
  ]);

  let totalCash        = 0;
  let totalReceivables = 0;
  let totalPayables    = 0;
  let revenueSum       = 0;
  let expenseSum       = 0;
  let totalRevenue     = 0;
  let totalCogs        = 0;
  let totalExpenses    = 0;

  for (const row of accountRows.rows as Record<string, unknown>[]) {
    const code = String(row.code);
    const bal  = Number(row.bal);
    const typ  = String(row.type);

    if (code.startsWith("SAFE-")) {
      totalCash += bal;
    } else if (code.startsWith("AR-") && bal > 0.001) {
      totalReceivables += bal;
    } else if (code.startsWith("AP-") && bal < -0.001) {
      totalPayables += -bal;
    } else if (typ === "revenue") {
      revenueSum += bal;
    } else if (typ === "expense") {
      expenseSum += bal;
      if (code === "EXP-COGS") totalCogs += bal;
      else totalExpenses += bal;
    }
  }

  totalRevenue         = r2(-revenueSum);
  const totalExpTotal  = r2(expenseSum);
  const retainedEarnings = r2(totalRevenue - totalExpTotal);

  const inventoryValue = r2(Number(((inventoryRow.rows[0] ?? {}) as Record<string, unknown>)?.inventory_value ?? 0));
  const openingCapital = r2(Number(((capitalRow.rows[0] ?? {}) as Record<string, unknown>)?.opening_capital ?? 0));

  totalCash        = r2(totalCash);
  totalReceivables = r2(totalReceivables);
  totalPayables    = r2(totalPayables);

  const totalAssets      = r2(totalCash + totalReceivables + inventoryValue);
  const totalLiabilities = r2(totalPayables);
  const totalEquity      = r2(openingCapital + retainedEarnings);
  const totalLiabEquity  = r2(totalLiabilities + totalEquity);

  const bsValidation = buildValidation([
    {
      name:     "الأصول = الخصوم + حقوق الملكية",
      expected: totalAssets,
      actual:   totalLiabEquity,
    },
    {
      name:     "الأرباح المحتجزة = الإيرادات - إجمالي المصروفات",
      expected: r2(totalRevenue - totalExpTotal),
      actual:   retainedEarnings,
    },
  ]);

  res.json({
    assets: {
      cash:        totalCash,
      receivables: totalReceivables,
      inventory:   inventoryValue,
      total:       totalAssets,
    },
    liabilities: {
      payables: totalPayables,
      total:    totalLiabilities,
    },
    equity: {
      opening_capital:   openingCapital,
      retained_earnings: retainedEarnings,
      total:             totalEquity,
    },
    total_liabilities_equity: totalLiabEquity,
    pl_detail: {
      total_revenue:  totalRevenue,
      total_cogs:     r2(totalCogs),
      total_expenses: r2(totalExpenses),
    },
    balanced:   Math.abs(totalAssets - totalLiabEquity) <= TOLERANCE,
    validation: bsValidation,
    as_of:      new Date().toISOString().split("T")[0],
    _source:    "ledger",
  });
}));

export default router;
