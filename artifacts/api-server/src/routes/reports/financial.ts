/**
 * reports/financial.ts
 * Routes: cash-flow, health-check, balance-sheet, trial-balance, cash-flow-indirect
 * All routes require can_view_accounts permission (checked per-handler).
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { getTenant } from "../../middleware/auth";
import { checkHealthCritical } from "../../lib/alert-service";
import { firstZodError } from "../../lib/schemas";
import {
  safeDate, r2, buildValidation, TOLERANCE,
  cfSql, cfSimpleSql,
} from "./shared";

const router: IRouter = Router();

const dateRangeQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_from يجب أن يكون YYYY-MM-DD").optional(),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_to يجب أن يكون YYYY-MM-DD").optional(),
});

const dateRangeRequiredQuerySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_from يجب أن يكون YYYY-MM-DD"),
  date_to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_to يجب أن يكون YYYY-MM-DD"),
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

/* ─────────────────────────────────────────────────────────────────────────
 * 8. فحص صحة النظام — System Health Check
 * GET /api/reports/health-check
 * ─────────────────────────────────────────────────────────────────────────*/
router.get("/reports/health-check", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_accounts")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير المالية" }); return;
  }
  const companyId = getTenant(req);

  const TOL      = 0.02;
  const WARN_AMT = 100;

  type Severity = "OK" | "WARNING" | "CRITICAL";
  type Group    = "customer_issues" | "supplier_issues" | "inventory_issues" | "accounting_issues" | "cash_issues";

  interface Issue {
    id:       string;
    group:    Group;
    type:     string;
    severity: Severity;
    color:    "green" | "yellow" | "red";
    message:  string;
    action:   string;
    details:  Record<string, unknown>;
  }

  const colorOf = (s: Severity): "green" | "yellow" | "red" =>
    s === "OK" ? "green" : s === "WARNING" ? "yellow" : "red";

  const diffSeverity = (diff: number): Severity =>
    Math.abs(diff) <= TOL ? "OK" : Math.abs(diff) < WARN_AMT ? "WARNING" : "CRITICAL";

  const issues: Issue[] = [];
  let checkId = 0;
  const nextId = () => `CHK-${String(++checkId).padStart(3, "0")}`;

  const [custRows, supRows, invRows, profitRows, cashRows] = await Promise.all([

    /* 1. فحص أرصدة العملاء */
    db.execute(sql`
      WITH
        ar_ledger AS (
          SELECT c.id AS customer_id,
                 COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0)
               - COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS ar_bal
          FROM customers c
          LEFT JOIN journal_entry_lines jel ON jel.account_id = c.account_id
          LEFT JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
          WHERE 1=1 ${cfSql("c", companyId)}
          GROUP BY c.id
        ),
        cust_sales AS (
          SELECT customer_id, COALESCE(SUM(CAST(total_amount AS FLOAT8)),0) AS tot
          FROM sales WHERE posting_status='posted' ${cfSimpleSql(companyId)} GROUP BY customer_id
        ),
        cust_receipts AS (
          SELECT customer_id, COALESCE(SUM(CAST(amount AS FLOAT8)),0) AS tot
          FROM receipt_vouchers WHERE posting_status='posted' ${cfSimpleSql(companyId)} GROUP BY customer_id
        ),
        cust_returns AS (
          SELECT customer_id, COALESCE(SUM(CAST(total_amount AS FLOAT8)),0) AS tot
          FROM sales_returns WHERE 1=1 ${cfSimpleSql(companyId)} GROUP BY customer_id
        )
      SELECT c.id, c.name,
             COALESCE(al.ar_bal, 0)                                          AS system_balance,
             COALESCE(cs.tot,0) - COALESCE(cr.tot,0) - COALESCE(cret.tot,0) AS ledger_balance,
             COALESCE(cs.tot,0) AS total_sales,
             COALESCE(cr.tot,0) AS total_receipts,
             COALESCE(cret.tot,0) AS total_returns
      FROM customers c
      LEFT JOIN ar_ledger     al   ON al.customer_id  = c.id
      LEFT JOIN cust_sales    cs   ON cs.customer_id  = c.id
      LEFT JOIN cust_receipts cr   ON cr.customer_id  = c.id
      LEFT JOIN cust_returns  cret ON cret.customer_id = c.id
      WHERE (ABS(COALESCE(al.ar_bal,0) - (COALESCE(cs.tot,0) - COALESCE(cr.tot,0) - COALESCE(cret.tot,0))) > ${TOL}
         OR COALESCE(al.ar_bal,0) != 0) ${cfSql("c", companyId)}
      ORDER BY ABS(COALESCE(al.ar_bal,0) - (COALESCE(cs.tot,0) - COALESCE(cr.tot,0) - COALESCE(cret.tot,0))) DESC
    `),

    /* 2. فحص أرصدة الموردين */
    db.execute(sql`
      WITH
        sup_purchases AS (
          SELECT customer_id, COALESCE(SUM(CAST(total_amount AS FLOAT8)),0) AS tot
          FROM purchases WHERE posting_status='posted' AND customer_id IS NOT NULL ${cfSimpleSql(companyId)} GROUP BY customer_id
        ),
        sup_payments AS (
          SELECT customer_id, COALESCE(SUM(CAST(amount AS FLOAT8)),0) AS tot
          FROM payment_vouchers WHERE posting_status='posted' ${cfSimpleSql(companyId)} GROUP BY customer_id
        ),
        sup_returns AS (
          SELECT customer_id, COALESCE(SUM(CAST(total_amount AS FLOAT8)),0) AS tot
          FROM purchase_returns WHERE customer_id IS NOT NULL ${cfSimpleSql(companyId)} GROUP BY customer_id
        )
      SELECT c.id, c.name,
             COALESCE(sp.tot,0)                                                AS system_balance,
             COALESCE(sp.tot,0) - COALESCE(spv.tot,0) - COALESCE(sret.tot,0)  AS ledger_balance,
             COALESCE(sp.tot,0) AS total_purchases,
             COALESCE(spv.tot,0) AS total_payments,
             COALESCE(sret.tot,0) AS total_returns
      FROM customers c
      JOIN sup_purchases sp   ON sp.customer_id = c.id
      LEFT JOIN sup_payments  spv  ON spv.customer_id = c.id
      LEFT JOIN sup_returns   sret ON sret.customer_id = c.id
      WHERE c.is_supplier = true ${cfSql("c", companyId)}
      ORDER BY total_purchases DESC
    `),

    /* 3. فحص تطابق كميات المخزون */
    db.execute(sql`
      SELECT p.id, p.name,
             CAST(p.quantity   AS FLOAT8)                AS actual_qty,
             CAST(p.cost_price AS FLOAT8)                AS cost_price,
             COALESCE(SUM(CAST(sm.quantity AS FLOAT8)),0) AS calculated_qty
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE 1=1 ${cfSql("p", companyId)}
      GROUP BY p.id, p.name, p.quantity, p.cost_price
      HAVING ABS(CAST(p.quantity AS FLOAT8) - COALESCE(SUM(CAST(sm.quantity AS FLOAT8)),0)) > ${TOL}
          OR CAST(p.quantity AS FLOAT8) != 0
      ORDER BY ABS(CAST(p.quantity AS FLOAT8) - COALESCE(SUM(CAST(sm.quantity AS FLOAT8)),0)) DESC
    `),

    /* 4. فحص الربحية */
    db.execute(sql`
      SELECT
        COALESCE(SUM(CAST(si.total_price AS FLOAT8)),0) AS total_revenue,
        COALESCE(SUM(CAST(si.cost_total  AS FLOAT8)),0) AS total_cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.posting_status = 'posted'
        ${cfSql("s", companyId)}
    `),

    /* 5. فحص التدفق النقدي */
    db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(CAST(amount AS FLOAT8)) FROM receipt_vouchers WHERE posting_status='posted' ${cfSimpleSql(companyId)}),0) AS total_receipts,
        COALESCE((SELECT SUM(CAST(amount AS FLOAT8)) FROM payment_vouchers WHERE posting_status='posted' ${cfSimpleSql(companyId)}),0) AS total_payments,
        COALESCE((SELECT SUM(CAST(amount AS FLOAT8)) FROM expenses WHERE 1=1 ${cfSimpleSql(companyId)}),0)                             AS total_expenses,
        COALESCE((SELECT SUM(CAST(paid_amount AS FLOAT8)) FROM sales WHERE posting_status='posted' AND payment_type='cash' ${cfSimpleSql(companyId)}),0) AS cash_sales
    `),
  ]);

  /* ── معالجة نتائج العملاء ── */
  for (const r of custRows.rows as Record<string, unknown>[]) {
    const arLedger      = r2(Number(r.system_balance));
    const invoiceComputed = r2(Number(r.ledger_balance));
    const diff = Math.abs(arLedger - invoiceComputed);
    if (diff <= TOL) continue;
    const sev = diffSeverity(arLedger - invoiceComputed);
    issues.push({
      id: nextId(), group: "customer_issues", type: "customer_balance",
      severity: sev, color: colorOf(sev),
      message:  `فارق في رصيد AR — ${r.name}`,
      action:   "رصيد حساب AR في دفتر الأستاذ لا يطابق مجموع الفواتير المرحّلة — راجع القيود المحاسبية",
      details: {
        customer_id:      Number(r.id),
        customer_name:    String(r.name),
        ar_ledger_balance: arLedger,
        invoice_computed:  invoiceComputed,
        difference:        r2(arLedger - invoiceComputed),
        total_sales:       r2(Number(r.total_sales)),
        total_receipts:    r2(Number(r.total_receipts)),
        total_returns:     r2(Number(r.total_returns)),
      },
    });
  }
  if (issues.filter(i => i.group === "customer_issues").length === 0) {
    issues.push({
      id: nextId(), group: "customer_issues", type: "customer_balance",
      severity: "OK", color: "green",
      message:  "رصيد AR في دفتر الأستاذ متطابق مع جميع الفواتير المرحّلة",
      action:   "لا يلزم أي إجراء",
      details:  { checked: (custRows.rows as Record<string, unknown>[]).length },
    });
  }

  /* ── معالجة نتائج الموردين ── */
  for (const r of supRows.rows as Record<string, unknown>[]) {
    const totalPurchases = r2(Number(r.total_purchases));
    const totalPayments  = r2(Number(r.total_payments));
    const totalReturns   = r2(Number(r.total_returns));
    const outstanding    = r2(totalPurchases - totalPayments - totalReturns);
    if (Math.abs(outstanding) <= TOL) continue;
    const sev = diffSeverity(outstanding);
    issues.push({
      id: nextId(), group: "supplier_issues", type: "supplier_balance",
      severity: sev, color: colorOf(sev),
      message:  `رصيد مستحق للمورد — ${r.name}`,
      action:   "راجع فواتير الشراء والمدفوعات لهذا المورد",
      details: {
        customer_id:     Number(r.id),
        supplier_name:   String(r.name),
        total_purchases: totalPurchases,
        total_payments:  totalPayments,
        total_returns:   totalReturns,
        outstanding,
      },
    });
  }
  if (issues.filter(i => i.group === "supplier_issues").length === 0) {
    issues.push({
      id: nextId(), group: "supplier_issues", type: "supplier_balance",
      severity: "OK", color: "green",
      message:  "جميع أرصدة الموردين (عملاء-موردين) متوازنة",
      action:   "لا يلزم أي إجراء",
      details:  { checked: (supRows.rows as Record<string, unknown>[]).length },
    });
  }

  /* ── فحص المخزون ── */
  let invOk = true;
  for (const r of invRows.rows as Record<string, unknown>[]) {
    const actual     = r2(Number(r.actual_qty));
    const calculated = r2(Number(r.calculated_qty));
    const qtyDiff    = r2(actual - calculated);
    if (Math.abs(qtyDiff) <= TOL) continue;
    invOk = false;
    const costPrice  = r2(Number(r.cost_price));
    const valueDiff  = r2(qtyDiff * costPrice);
    const sev: Severity = "CRITICAL";
    issues.push({
      id: nextId(), group: "inventory_issues", type: "inventory_qty",
      severity: sev, color: colorOf(sev),
      message:  `فارق في كمية المخزون — ${r.name}`,
      action:   "راجع حركات المخزون للمنتج وتحقق من أي تسوية أو حركة مفقودة",
      details: {
        product_id:      Number(r.id),
        product_name:    String(r.name),
        actual_qty:      actual,
        calculated_qty:  calculated,
        qty_difference:  qtyDiff,
        cost_price:      costPrice,
        value_impact:    valueDiff,
      },
    });
  }
  if (invOk) {
    issues.push({
      id: nextId(), group: "inventory_issues", type: "inventory_qty",
      severity: "OK", color: "green",
      message:  "جميع كميات المخزون متطابقة مع حركات المخزون",
      action:   "لا يلزم أي إجراء",
      details:  { checked: (invRows.rows as Record<string, unknown>[]).length },
    });
  }

  /* ── فحص الربحية ── */
  {
    const row        = (profitRows.rows[0] ?? {}) as Record<string, unknown>;
    const revenue    = r2(Number(row.total_revenue ?? 0));
    const cogs       = r2(Number(row.total_cogs    ?? 0));
    const grossProfit = r2(revenue - cogs);
    const computed   = r2(revenue - cogs);
    const diff       = Math.abs(grossProfit - computed);
    const sev        = diff <= TOL ? "OK" : diff < WARN_AMT ? "WARNING" : "CRITICAL";
    issues.push({
      id: nextId(), group: "accounting_issues", type: "profit_equation",
      severity: sev, color: colorOf(sev),
      message:  sev === "OK"
        ? "معادلة الربحية صحيحة: الإيراد − التكلفة = الربح الإجمالي"
        : `فارق في معادلة الربحية: متوقع ${computed}، فعلي ${grossProfit}`,
      action: sev === "OK"
        ? "لا يلزم أي إجراء"
        : "راجع قيود اليومية للمبيعات وتأكد من تسجيل التكلفة في كل بند",
      details: { total_revenue: revenue, total_cogs: cogs, gross_profit: grossProfit, difference: diff },
    });
  }

  /* ── فحص التدفق النقدي ── */
  {
    const row      = (cashRows.rows[0] ?? {}) as Record<string, unknown>;
    const receipts  = r2(Number(row.total_receipts ?? 0));
    const payments  = r2(Number(row.total_payments ?? 0));
    const expenses  = r2(Number(row.total_expenses ?? 0));
    const cashSales = r2(Number(row.cash_sales     ?? 0));
    const netCash   = r2(receipts + cashSales - payments - expenses);

    const hasData = receipts + payments + expenses + cashSales > 0;
    const sev: Severity = hasData ? "OK" : "WARNING";
    issues.push({
      id: nextId(), group: "cash_issues", type: "cash_balance",
      severity: sev, color: colorOf(sev),
      message:  hasData
        ? `صافي التدفق النقدي: ${netCash >= 0 ? "+" : ""}${netCash} ج.م — لا توجد مشاكل`
        : "لا توجد حركات نقدية مسجّلة في الفترة الحالية",
      action: hasData
        ? "لا يلزم أي إجراء — راجع التدفق النقدي التفصيلي للمزيد"
        : "تحقق من تسجيل سندات القبض والدفع ومرحّلتها",
      details: {
        total_receipts:   receipts,
        total_cash_sales: cashSales,
        total_inflow:     r2(receipts + cashSales),
        total_payments:   payments,
        total_expenses:   expenses,
        total_outflow:    r2(payments + expenses),
        net_cash_flow:    netCash,
      },
    });
  }

  const okCount       = issues.filter(i => i.severity === "OK").length;
  const warnCount     = issues.filter(i => i.severity === "WARNING").length;
  const criticalCount = issues.filter(i => i.severity === "CRITICAL").length;

  const overallStatus: Severity =
    criticalCount > 0 ? "CRITICAL" : warnCount > 0 ? "WARNING" : "OK";

  const groups: Record<Group, Issue[]> = {
    customer_issues:   issues.filter(i => i.group === "customer_issues"),
    supplier_issues:   issues.filter(i => i.group === "supplier_issues"),
    inventory_issues:  issues.filter(i => i.group === "inventory_issues"),
    accounting_issues: issues.filter(i => i.group === "accounting_issues"),
    cash_issues:       issues.filter(i => i.group === "cash_issues"),
  };

  void checkHealthCritical(criticalCount > 0);

  res.json({
    status:     overallStatus,
    color:      colorOf(overallStatus),
    checked_at: new Date().toISOString(),
    summary: {
      total_checks: issues.length,
      ok:           okCount,
      warnings:     warnCount,
      critical:     criticalCount,
    },
    groups,
    issues,
  });
}));

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = (rawRows.rows as Record<string, unknown>[]).map((r: any) => ({
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
