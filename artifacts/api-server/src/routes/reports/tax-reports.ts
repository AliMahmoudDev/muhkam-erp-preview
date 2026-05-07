/**
 * reports/tax-reports.ts
 * Routes: vat-report
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { hasPermission } from "../../lib/permissions";
import { getTenant } from "../../middleware/auth";
import { safeDate } from "./shared";

const router: IRouter = Router();

/* ─────────────────────────────────────────────────────────────────────────── *
 * GET /api/reports/vat-report?date_from=&date_to=
 *
 * تقرير ضريبة القيمة المضافة (VAT)
 * ضريبة المخرجات (على المبيعات) — ضريبة المدخلات (على المشتريات)
 * ─────────────────────────────────────────────────────────────────────────── */
router.get("/reports/vat-report", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_accounts")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير المالية" }); return;
  }
  const companyId = getTenant(req);

  const dateFrom    = safeDate(req.query.date_from as string | undefined);
  const dateTo      = safeDate(req.query.date_to   as string | undefined);
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;

  const dateFilter = dateFrom && dateTo
    ? sql`AND s.date BETWEEN ${dateFrom} AND ${dateTo}`
    : dateFrom
      ? sql`AND s.date >= ${dateFrom}`
      : dateTo
        ? sql`AND s.date <= ${dateTo}`
        : sql``;

  const whFilter = warehouseId ? sql`AND s.warehouse_id = ${warehouseId}` : sql``;

  const purchaseDateFilter = dateFrom && dateTo
    ? sql`AND p.date BETWEEN ${dateFrom} AND ${dateTo}`
    : dateFrom
      ? sql`AND p.date >= ${dateFrom}`
      : dateTo
        ? sql`AND p.date <= ${dateTo}`
        : sql``;

  /* Output VAT (on sales) */
  const salesVatRaw = await db.execute(sql`
    SELECT
      COALESCE(SUM(s.total_amount), 0) AS total_sales,
      COALESCE(SUM(s.tax_amount), 0)   AS total_tax,
      COUNT(*)                          AS invoice_count
    FROM sales s
    WHERE s.company_id = ${companyId}
      AND s.posting_status = 'posted'
      ${dateFilter}
      ${whFilter}
  `);

  /* Input VAT (on purchases) */
  const purchasesVatRaw = await db.execute(sql`
    SELECT
      COALESCE(SUM(p.total_amount), 0) AS total_purchases,
      COALESCE(SUM(p.tax_amount), 0)   AS total_tax,
      COUNT(*)                          AS invoice_count
    FROM purchases p
    WHERE p.company_id = ${companyId}
      AND p.posting_status = 'posted'
      ${purchaseDateFilter}
  `);

  const sv = (salesVatRaw.rows as Record<string, unknown>[])[0] ?? {};
  const pv = (purchasesVatRaw.rows as Record<string, unknown>[])[0] ?? {};

  const outputVat = Number(sv.total_tax ?? 0);
  const inputVat  = Number(pv.total_tax ?? 0);
  const netVat    = outputVat - inputVat;

  res.json({
    output_vat: {
      total_sales:   Number(sv.total_sales ?? 0),
      tax_amount:    Number(outputVat.toFixed(2)),
      invoice_count: Number(sv.invoice_count ?? 0),
    },
    input_vat: {
      total_purchases: Number(pv.total_purchases ?? 0),
      tax_amount:      Number(inputVat.toFixed(2)),
      invoice_count:   Number(pv.invoice_count ?? 0),
    },
    net_vat_payable: Number(netVat.toFixed(2)),
    vat_status:      netVat >= 0 ? "مستحقة الدفع" : "مستحقة الاسترداد",
    period:          { date_from: dateFrom ?? null, date_to: dateTo ?? null },
    generated_at:    new Date().toISOString(),
  });
}));

export default router;
