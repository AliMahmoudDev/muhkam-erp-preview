/**
 * reports/financial/cash-flow-indirect.ts
 * GET /api/reports/cash-flow-indirect — التدفق النقدي - الطريقة غير المباشرة
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { getTenant } from "../../../middleware/auth";
import { firstZodError } from "../../../lib/schemas";
import { r2 } from "../shared";

const router: IRouter = Router();

const dateRangeRequiredQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_from يجب أن يكون YYYY-MM-DD"),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_to يجب أن يكون YYYY-MM-DD"),
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/reports/cash-flow-indirect?date_from=&date_to=
   التدفق النقدي - الطريقة غير المباشرة
   ───────────────────────────────────────────────────────────────────────── */
router.get("/reports/cash-flow-indirect", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_accounts")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير المالية" }); return;
  }
  const qp = dateRangeRequiredQuerySchema.safeParse(req.query);
  if (!qp.success) { res.status(400).json({ error: firstZodError(qp.error) }); return; }
  const companyId = getTenant(req);
  const { date_from, date_to } = qp.data;

  // ─── 1. صافي الربح (إيرادات - مصروفات) ───
  const incomeData = await db.execute(sql`
    SELECT
      a.type,
      COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0) AS total_debit,
      COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS total_credit
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND a.type IN ('revenue', 'expense')
    GROUP BY a.type
  `);

  let netIncome = 0;
  for (const row of incomeData.rows as Array<{ type: string; total_debit: number; total_credit: number }>) {
    if (row.type === "revenue") netIncome += Number(row.total_credit) - Number(row.total_debit);
    if (row.type === "expense") netIncome -= Number(row.total_debit) - Number(row.total_credit);
  }

  // ─── 2. إضافة الاستهلاك (مصروف غير نقدي) ───
  const deprData = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(jel.debit AS FLOAT8)), 0) AS depreciation
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND (a.code LIKE '%DEPR%' OR a.code LIKE '%DEPREC%' OR a.name LIKE '%استهلاك%')
      AND a.type = 'expense'
  `);
  const depreciation = Number((deprData.rows[0] as { depreciation: number })?.depreciation ?? 0);

  // ─── 3. التغيرات في رأس المال العامل ───

  const arData = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(jel.debit AS FLOAT8) - CAST(jel.credit AS FLOAT8)), 0) AS net
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND (a.code LIKE 'AR-%' OR a.name LIKE '%مدين%' OR a.name LIKE '%عميل%')
      AND a.type = 'asset'
  `);
  const arChange = Number((arData.rows[0] as { net: number })?.net ?? 0);

  const apData = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(jel.credit AS FLOAT8) - CAST(jel.debit AS FLOAT8)), 0) AS net
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND (a.code LIKE 'AP-%' OR a.name LIKE '%دائن%' OR a.name LIKE '%مورد%')
      AND a.type = 'liability'
  `);
  const apChange = Number((apData.rows[0] as { net: number })?.net ?? 0);

  const invData = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(jel.debit AS FLOAT8) - CAST(jel.credit AS FLOAT8)), 0) AS net
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND (a.code LIKE '%INV%' OR a.code LIKE '%INVENTORY%' OR a.name LIKE '%مخزون%' OR a.name LIKE '%بضاعة%')
      AND a.type = 'asset'
  `);
  const invChange = Number((invData.rows[0] as { net: number })?.net ?? 0);

  // ─── 4. التدفق من الأنشطة الاستثمارية (شراء أصول ثابتة) ───
  const investData = await db.execute(sql`
    SELECT COALESCE(SUM(CAST(jel.debit AS FLOAT8)), 0) AS total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND a.type = 'asset'
      AND (a.code LIKE 'FA-%' OR a.code LIKE '%ASSET-FIXED%' OR a.name LIKE '%أصل ثابت%' OR a.name LIKE '%معدات%' OR a.name LIKE '%أجهزة%')
  `);
  const assetPurchases = Number((investData.rows[0] as { total: number })?.total ?? 0);

  // ─── 5. التدفق من الأنشطة التمويلية ───
  const finData = await db.execute(sql`
    SELECT
      a.type,
      a.name,
      COALESCE(SUM(CAST(jel.credit AS FLOAT8) - CAST(jel.debit AS FLOAT8)), 0) AS net
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.company_id = ${companyId}
      AND je.date >= ${date_from}
      AND je.date <= ${date_to}
      AND a.type IN ('liability', 'equity')
      AND (a.name LIKE '%قرض%' OR a.name LIKE '%تمويل%' OR a.code LIKE '%LOAN%')
    GROUP BY a.type, a.name
  `);
  const financingNet = (finData.rows as Array<{ net: number }>).reduce((s, row) => s + Number(row.net), 0);

  // ─── حساب التدفق النقدي الإجمالي ───
  const operatingCF = r2(netIncome + depreciation - arChange - invChange + apChange);
  const investingCF = r2(-assetPurchases);
  const financingCF = r2(financingNet);
  const netCF       = r2(operatingCF + investingCF + financingCF);

  res.json({
    period: { date_from, date_to },
    operating_activities: {
      net_income:          r2(netIncome),
      add_depreciation:    r2(depreciation),
      change_in_ar:        r2(-arChange),
      change_in_inventory: r2(-invChange),
      change_in_ap:        r2(apChange),
      net_cash_from_operations: operatingCF,
    },
    investing_activities: {
      asset_purchases:  r2(-assetPurchases),
      net_cash_from_investing: investingCF,
    },
    financing_activities: {
      net_loans_and_equity: r2(financingNet),
      net_cash_from_financing: financingCF,
    },
    net_change_in_cash: netCF,
    generated_at: new Date().toISOString(),
  });
}));

export default router;
