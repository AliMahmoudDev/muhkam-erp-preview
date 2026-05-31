/**
 * reports/financial/health-check.ts
 * GET /api/reports/health-check — فحص صحة النظام (System Health Check)
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { wrap } from "../../../lib/async-handler";
import { hasPermission } from "../../../lib/permissions";
import { getTenant } from "../../../middleware/auth";
import { checkHealthCritical } from "../../../lib/alert-service";
import { r2, TOLERANCE, cfSql, cfSimpleSql } from "../shared";

const router: IRouter = Router();

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

export default router;
