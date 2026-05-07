/**
 * reports/sales-reports.ts
 * Routes: product-profit, daily-profit, sales-analysis, top, manager-sales
 */
import { Router, type IRouter } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { wrap } from '../../lib/async-handler';
import { getTenant } from '../../middleware/auth';
import { safeDate, r2, buildValidation, TOLERANCE, cfSql, dfSql, wfSql } from './shared';

const router: IRouter = Router();

/* ─────────────────────────────────────────────────────────────────────────
 * 1. تقرير ربحية المنتجات
 * GET /api/reports/product-profit?date_from=&date_to=&warehouse_id=
 * ───────────────────────────────────────────────────────────────────────── */
router.get(
  '/reports/product-profit',
  wrap(async (req, res) => {
    const { date_from, date_to, warehouse_id } = req.query as Record<string, string | undefined>;
    const companyId = getTenant(req);

    const rows = await db.execute(sql`
    SELECT
      si.product_id,
      si.product_name,
      COALESCE(SUM(CAST(si.quantity   AS FLOAT8)), 0) AS qty_sold,
      COALESCE(SUM(CAST(si.total_price AS FLOAT8)), 0) AS revenue,
      COALESCE(SUM(CAST(si.cost_total  AS FLOAT8)), 0) AS cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
      ${wfSql('s', warehouse_id)}
    GROUP BY si.product_id, si.product_name
    ORDER BY revenue DESC
  `);

    const retRows = await db.execute(sql`
    SELECT
      sri.product_id,
      COALESCE(SUM(CAST(sri.quantity            AS FLOAT8)), 0) AS ret_qty,
      COALESCE(SUM(CAST(sri.total_price          AS FLOAT8)), 0) AS ret_revenue,
      COALESCE(SUM(CAST(sri.total_cost_at_return AS FLOAT8)), 0) AS ret_cogs
    FROM sale_return_items sri
    JOIN sales_returns sr ON sr.id = sri.return_id
    WHERE 1=1
      ${dfSql('sr', 'date', date_from, date_to)}
      ${cfSql('sr', companyId)}
    GROUP BY sri.product_id
  `);

    const retMap = new Map<number, { ret_qty: number; ret_revenue: number; ret_cogs: number }>();
    for (const r of retRows.rows as Record<string, unknown>[]) {
      retMap.set(Number(r.product_id), {
        ret_qty: Number(r.ret_qty),
        ret_revenue: Number(r.ret_revenue),
        ret_cogs: Number(r.ret_cogs),
      });
    }

    const products = (rows.rows as Record<string, unknown>[])
      .map((r) => {
        const pid = Number(r.product_id);
        const ret = retMap.get(pid) ?? { ret_qty: 0, ret_revenue: 0, ret_cogs: 0 };
        const qty = Number(r.qty_sold) - ret.ret_qty;
        const revenue = Number(r.revenue) - ret.ret_revenue;
        const cogs = Number(r.cogs) - ret.ret_cogs;
        const profit = revenue - cogs;
        return {
          product_id: pid,
          product_name: String(r.product_name),
          qty_sold: Math.round(qty * 1000) / 1000,
          revenue: Math.round(revenue * 100) / 100,
          cogs: Math.round(cogs * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          profit_margin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
        };
      })
      .filter((p) => p.qty_sold !== 0 || p.revenue !== 0);

    const totRevenue = products.reduce((s, p) => s + p.revenue, 0);
    const totCogs = products.reduce((s, p) => s + p.cogs, 0);
    const totProfit = totRevenue - totCogs;

    const productValidation = buildValidation([
      {
        name: 'إجمالي الإيراد - إجمالي التكلفة = إجمالي الربح',
        expected: r2(totRevenue) - r2(totCogs),
        actual: r2(totProfit),
      },
      {
        name: 'مجموع أرباح الأصناف = إجمالي الربح',
        expected: r2(products.reduce((s, p) => s + p.profit, 0)),
        actual: r2(totProfit),
      },
    ]);

    res.json({
      products,
      summary: {
        total_revenue: r2(totRevenue),
        total_cogs: r2(totCogs),
        total_profit: r2(totProfit),
        overall_margin: totRevenue > 0 ? Math.round((totProfit / totRevenue) * 10000) / 100 : 0,
      },
      validation: productValidation,
    });
  })
);

/* ─────────────────────────────────────────────────────────────────────────
 * 2. التقرير اليومي للأرباح
 * GET /api/reports/daily-profit?date_from=&date_to=
 * ───────────────────────────────────────────────────────────────────────── */
router.get(
  '/reports/daily-profit',
  wrap(async (req, res) => {
    const { date_from, date_to } = req.query as Record<string, string | undefined>;
    const companyId = getTenant(req);
    const sfrom = safeDate(date_from);
    const sto = safeDate(date_to);

    const salesRows = await db.execute(sql`
    SELECT s.date AS day,
      COALESCE(SUM(CAST(si.total_price AS FLOAT8)), 0) AS sales_revenue,
      COALESCE(SUM(CAST(si.cost_total  AS FLOAT8)), 0) AS sales_cogs
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
    GROUP BY s.date
  `);

    const retRows = await db.execute(sql`
    SELECT sr.date AS day,
      COALESCE(SUM(CAST(sri.total_price          AS FLOAT8)), 0) AS ret_revenue,
      COALESCE(SUM(CAST(sri.total_cost_at_return AS FLOAT8)), 0) AS ret_cogs
    FROM sales_returns sr
    JOIN sale_return_items sri ON sri.return_id = sr.id
    WHERE 1=1
      ${dfSql('sr', 'date', date_from, date_to)}
      ${cfSql('sr', companyId)}
    GROUP BY sr.date
  `);

    const expRows = await db.execute(sql`
    SELECT e.created_at::date AS day,
      COALESCE(SUM(CAST(e.amount AS FLOAT8)), 0) AS total_expenses
    FROM expenses e
    WHERE 1=1
      ${sfrom ? sql`AND e.created_at::date >= ${sfrom}` : sql``}
      ${sto ? sql`AND e.created_at::date <= ${sto}` : sql``}
      ${cfSql('e', companyId)}
    GROUP BY e.created_at::date
  `);

    const dayMap = new Map<
      string,
      {
        sales_revenue: number;
        sales_cogs: number;
        ret_revenue: number;
        ret_cogs: number;
        expenses: number;
      }
    >();

    const ensure = (day: string) => {
      if (!dayMap.has(day))
        dayMap.set(day, {
          sales_revenue: 0,
          sales_cogs: 0,
          ret_revenue: 0,
          ret_cogs: 0,
          expenses: 0,
        });
      return dayMap.get(day)!;
    };

    for (const r of salesRows.rows as Record<string, unknown>[]) {
      const d = ensure(String(r.day));
      d.sales_revenue += Number(r.sales_revenue);
      d.sales_cogs += Number(r.sales_cogs);
    }
    for (const r of retRows.rows as Record<string, unknown>[]) {
      const d = ensure(String(r.day));
      d.ret_revenue += Number(r.ret_revenue);
      d.ret_cogs += Number(r.ret_cogs);
    }
    for (const r of expRows.rows as Record<string, unknown>[]) {
      const d = ensure(String(r.day));
      d.expenses += Number(r.total_expenses);
    }

    const days = Array.from(dayMap.entries())
      .map(([day, v]) => {
        const net_sales = v.sales_revenue - v.ret_revenue;
        const net_cogs = v.sales_cogs - v.ret_cogs;
        const gross_profit = net_sales - net_cogs;
        const net_profit = gross_profit - v.expenses;
        return {
          day,
          total_sales: Math.round(v.sales_revenue * 100) / 100,
          total_returns: Math.round(v.ret_revenue * 100) / 100,
          net_sales: Math.round(net_sales * 100) / 100,
          total_cogs: Math.round(net_cogs * 100) / 100,
          gross_profit: Math.round(gross_profit * 100) / 100,
          expenses: Math.round(v.expenses * 100) / 100,
          net_profit: Math.round(net_profit * 100) / 100,
        };
      })
      .sort((a, b) => a.day.localeCompare(b.day));

    const totNetSales = days.reduce((s, d) => s + d.net_sales, 0);
    const totNetCogs = days.reduce((s, d) => s + d.total_cogs, 0);
    const totGross = days.reduce((s, d) => s + d.gross_profit, 0);
    const totExpenses = days.reduce((s, d) => s + d.expenses, 0);
    const totNet = days.reduce((s, d) => s + d.net_profit, 0);

    const dayWarnings: string[] = [];
    for (const d of days) {
      const expectedGross = r2(d.net_sales) - r2(d.total_cogs);
      const expectedNet = r2(d.gross_profit) - r2(d.expenses);
      if (Math.abs(expectedGross - r2(d.gross_profit)) > TOLERANCE)
        dayWarnings.push(
          `${d.day}: الإيراد الصافي - التكلفة ≠ الربح الإجمالي (${expectedGross} ≠ ${r2(d.gross_profit)})`
        );
      if (Math.abs(expectedNet - r2(d.net_profit)) > TOLERANCE)
        dayWarnings.push(
          `${d.day}: الربح الإجمالي - المصروفات ≠ صافي الربح (${expectedNet} ≠ ${r2(d.net_profit)})`
        );
    }

    const dailyValidation = buildValidation([
      {
        name: 'إجمالي الإيرادات الصافية - إجمالي التكلفة = إجمالي الربح الإجمالي',
        expected: r2(totNetSales) - r2(totNetCogs),
        actual: r2(totGross),
      },
      {
        name: 'إجمالي الربح الإجمالي - إجمالي المصروفات = صافي الربح الإجمالي',
        expected: r2(totGross) - r2(totExpenses),
        actual: r2(totNet),
      },
      {
        name: 'مجموع الأيام - صافي الربح = إجمالي صافي الربح',
        expected: r2(days.reduce((s, d) => s + d.net_profit, 0)),
        actual: r2(totNet),
      },
    ]);

    if (dayWarnings.length > 0) {
      dailyValidation.status = 'WARNING';
      dailyValidation.validation_message = [
        ...(dailyValidation.validation_message ? [dailyValidation.validation_message] : []),
        ...dayWarnings,
      ].join(' | ');
    }

    res.json({
      days,
      summary: {
        total_net_sales: r2(totNetSales),
        total_cogs: r2(totNetCogs),
        total_gross_profit: r2(totGross),
        total_expenses: r2(totExpenses),
        total_net_profit: r2(totNet),
      },
      validation: dailyValidation,
    });
  })
);

/* ─────────────────────────────────────────────────────────────────────────
 * 3. تحليل المبيعات
 * GET /api/reports/sales-analysis?date_from=&date_to=
 * ───────────────────────────────────────────────────────────────────────── */
router.get(
  '/reports/sales-analysis',
  wrap(async (req, res) => {
    const { date_from, date_to, warehouse_id } = req.query as Record<string, string | undefined>;
    const companyId = getTenant(req);

    const byProduct = await db.execute(sql`
    SELECT
      si.product_id,
      si.product_name,
      COALESCE(SUM(CAST(si.quantity    AS FLOAT8)), 0) AS total_qty,
      COALESCE(SUM(CAST(si.total_price AS FLOAT8)), 0) AS total_revenue,
      COUNT(DISTINCT s.id)                              AS invoice_count
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
      ${wfSql('s', warehouse_id)}
    GROUP BY si.product_id, si.product_name
    ORDER BY total_revenue DESC
  `);

    const byCustomer = await db.execute(sql`
    SELECT
      s.customer_id,
      COALESCE(s.customer_name, 'عميل نقدي') AS customer_name,
      COALESCE(SUM(CAST(s.total_amount AS FLOAT8)), 0) AS total_revenue,
      COUNT(*)                                          AS invoice_count
    FROM sales s
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
      ${wfSql('s', warehouse_id)}
    GROUP BY s.customer_id, s.customer_name
    ORDER BY total_revenue DESC
  `);

    res.json({
      by_product: (byProduct.rows as Record<string, unknown>[]).map((r) => ({
        product_id: Number(r.product_id),
        product_name: String(r.product_name),
        total_qty: Math.round(Number(r.total_qty) * 1000) / 1000,
        total_revenue: Math.round(Number(r.total_revenue) * 100) / 100,
        avg_price:
          Number(r.total_qty) > 0
            ? Math.round((Number(r.total_revenue) / Number(r.total_qty)) * 100) / 100
            : 0,
        invoice_count: Number(r.invoice_count),
      })),
      by_customer: (byCustomer.rows as Record<string, unknown>[]).map((r) => ({
        customer_id: r.customer_id ? Number(r.customer_id) : null,
        customer_name: String(r.customer_name),
        total_revenue: Math.round(Number(r.total_revenue) * 100) / 100,
        invoice_count: Number(r.invoice_count),
      })),
    });
  })
);

/* ─────────────────────────────────────────────────────────────────────────
 * 7. تقارير الأعلى (أفضل المنتجات / العملاء / الموردين)
 * GET /api/reports/top?date_from=&date_to=&limit=10
 * ───────────────────────────────────────────────────────────────────────── */
router.get(
  '/reports/top',
  wrap(async (req, res) => {
    const { date_from, date_to, limit: lim } = req.query as Record<string, string | undefined>;
    const LIMIT = Math.min(parseInt(lim ?? '10'), 50);
    const companyId = getTenant(req);

    const topProducts = await db.execute(sql`
    SELECT si.product_id, si.product_name,
      COALESCE(SUM(CAST(si.quantity    AS FLOAT8)), 0) AS total_qty,
      COALESCE(SUM(CAST(si.total_price AS FLOAT8)), 0) AS total_revenue,
      COALESCE(SUM(CAST(si.cost_total  AS FLOAT8)), 0) AS total_cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
    GROUP BY si.product_id, si.product_name
    ORDER BY total_revenue DESC
    LIMIT ${LIMIT}
  `);

    const topCustomers = await db.execute(sql`
    SELECT s.customer_id, COALESCE(s.customer_name, 'عميل نقدي') AS customer_name,
      COALESCE(SUM(CAST(s.total_amount AS FLOAT8)), 0) AS total_revenue,
      COUNT(*) AS invoice_count
    FROM sales s
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
    GROUP BY s.customer_id, s.customer_name
    ORDER BY total_revenue DESC
    LIMIT ${LIMIT}
  `);

    const topSuppliers = await db.execute(sql`
    SELECT p.customer_id AS supplier_id, COALESCE(p.customer_name, 'مورد') AS supplier_name,
      COALESCE(SUM(CAST(p.total_amount AS FLOAT8)), 0) AS total_purchases,
      COUNT(*) AS invoice_count
    FROM purchases p
    WHERE p.posting_status = 'posted'
      ${dfSql('p', 'date', date_from, date_to)}
      ${cfSql('p', companyId)}
    GROUP BY p.customer_id, p.customer_name
    ORDER BY total_purchases DESC
    LIMIT ${LIMIT}
  `);

    res.json({
      top_products: (topProducts.rows as Record<string, unknown>[]).map((r) => ({
        product_id: Number(r.product_id),
        product_name: String(r.product_name),
        total_qty: Math.round(Number(r.total_qty) * 1000) / 1000,
        total_revenue: Math.round(Number(r.total_revenue) * 100) / 100,
        total_profit: Math.round((Number(r.total_revenue) - Number(r.total_cogs)) * 100) / 100,
      })),
      top_customers: (topCustomers.rows as Record<string, unknown>[]).map((r) => ({
        customer_id: r.customer_id ? Number(r.customer_id) : null,
        customer_name: String(r.customer_name),
        total_revenue: Math.round(Number(r.total_revenue) * 100) / 100,
        invoice_count: Number(r.invoice_count),
      })),
      top_suppliers: (topSuppliers.rows as Record<string, unknown>[]).map((r) => ({
        supplier_id: r.supplier_id ? Number(r.supplier_id) : null,
        supplier_name: String(r.supplier_name),
        total_purchases: Math.round(Number(r.total_purchases) * 100) / 100,
        invoice_count: Number(r.invoice_count),
      })),
    });
  })
);

/* ─────────────────────────────────────────────────────────────────────────
 * 9. تقارير المدير — المبيعات حسب المخزن / المستخدم / المندوب
 * GET /api/reports/manager-sales?date_from=&date_to=
 * ───────────────────────────────────────────────────────────────────────── */
router.get(
  '/reports/manager-sales',
  wrap(async (req, res) => {
    const { date_from, date_to } = req.query as Record<string, string | undefined>;
    const companyId = getTenant(req);

    const byWarehouse = await db.execute(sql`
    SELECT
      s.warehouse_id,
      COALESCE(s.warehouse_name, 'غير محدد') AS warehouse_name,
      COUNT(s.id)::int                         AS sale_count,
      COALESCE(SUM(CAST(s.total_amount  AS FLOAT8)), 0) AS total_sales,
      COALESCE(SUM(CAST(s.paid_amount   AS FLOAT8)), 0) AS total_collected,
      COALESCE(SUM(CAST(s.remaining_amount AS FLOAT8)), 0) AS total_remaining
    FROM sales s
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
    GROUP BY s.warehouse_id, s.warehouse_name
    ORDER BY total_sales DESC
  `);

    const byUser = await db.execute(sql`
    SELECT
      s.user_id,
      COALESCE(u.name, 'غير محدد')             AS user_name,
      COALESCE(u.role, 'unknown')               AS user_role,
      COUNT(s.id)::int                          AS sale_count,
      COALESCE(SUM(CAST(s.total_amount AS FLOAT8)), 0) AS total_sales
    FROM sales s
    LEFT JOIN erp_users u ON u.id = s.user_id
    WHERE s.posting_status = 'posted'
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
    GROUP BY s.user_id, u.name, u.role
    ORDER BY total_sales DESC
  `);

    const topSellerByWarehouse = await db.execute(sql`
    SELECT DISTINCT ON (warehouse_id)
      s.warehouse_id,
      COALESCE(s.warehouse_name, 'غير محدد')      AS warehouse_name,
      s.salesperson_id,
      COALESCE(s.salesperson_name, 'غير محدد')    AS salesperson_name,
      COUNT(s.id)::int                             AS sale_count,
      COALESCE(SUM(CAST(s.total_amount AS FLOAT8)), 0) AS total_sales
    FROM sales s
    WHERE s.posting_status = 'posted'
      AND s.salesperson_id IS NOT NULL
      ${dfSql('s', 'date', date_from, date_to)}
      ${cfSql('s', companyId)}
    GROUP BY s.warehouse_id, s.warehouse_name, s.salesperson_id, s.salesperson_name
    ORDER BY s.warehouse_id, total_sales DESC
  `);

    const returnsByWarehouse = await db.execute(sql`
    SELECT
      sr.warehouse_id,
      COALESCE(w.name, 'غير محدد')              AS warehouse_name,
      COUNT(sr.id)::int                          AS return_count,
      COALESCE(SUM(CAST(sr.total_amount AS FLOAT8)), 0) AS total_returns
    FROM sales_returns sr
    LEFT JOIN warehouses w ON w.id = sr.warehouse_id
    WHERE 1=1
      ${dfSql('sr', 'date', date_from, date_to)}
      ${cfSql('sr', companyId)}
    GROUP BY sr.warehouse_id, w.name
    ORDER BY total_returns DESC
  `);

    const netByWarehouse = await db.execute(sql`
    SELECT
      warehouse_id,
      warehouse_name,
      COALESCE(SUM(CASE WHEN type='sale' THEN amount ELSE -amount END), 0) AS net_sales
    FROM (
      SELECT
        s.warehouse_id,
        COALESCE(s.warehouse_name, 'غير محدد') AS warehouse_name,
        'sale'   AS type,
        CAST(s.total_amount AS FLOAT8)           AS amount
      FROM sales s
      WHERE s.posting_status = 'posted'
        ${dfSql('s', 'date', date_from, date_to)}
        ${cfSql('s', companyId)}
      UNION ALL
      SELECT
        sr.warehouse_id,
        COALESCE(w.name, 'غير محدد') AS warehouse_name,
        'return' AS type,
        CAST(sr.total_amount AS FLOAT8) AS amount
      FROM sales_returns sr
      LEFT JOIN warehouses w ON w.id = sr.warehouse_id
      WHERE 1=1
        ${dfSql('sr', 'date', date_from, date_to)}
        ${cfSql('sr', companyId)}
    ) combined
    GROUP BY warehouse_id, warehouse_name
    ORDER BY net_sales DESC
  `);

    res.json({
      by_warehouse: byWarehouse.rows,
      by_user: byUser.rows,
      top_seller_by_warehouse: topSellerByWarehouse.rows,
      returns_by_warehouse: returnsByWarehouse.rows,
      net_by_warehouse: netByWarehouse.rows,
      filters: { date_from: date_from ?? null, date_to: date_to ?? null },
    });
  })
);

export default router;
