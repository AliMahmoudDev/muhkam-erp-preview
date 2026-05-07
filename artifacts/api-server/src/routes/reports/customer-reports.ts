/**
 * reports/customer-reports.ts
 * Routes: customer-statement, supplier-statement, aging
 */
import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { wrap } from "../../lib/async-handler";
import { getTenant } from "../../middleware/auth";
import { r2, buildValidation, cfSql, cfSimpleSql } from "./shared";

const router: IRouter = Router();

/* ─────────────────────────────────────────────────────────────────────────
 * 4. كشف حساب عميل
 * GET /api/reports/customer-statement?customer_id=&date_from=&date_to=
 * ───────────────────────────────────────────────────────────────────────── */
router.get("/reports/customer-statement", wrap(async (req, res) => {
  const { customer_id, date_from, date_to } = req.query as Record<string, string | undefined>;
  if (!customer_id) { res.status(400).json({ error: "يجب تحديد العميل" }); return; }
  const custId = parseInt(customer_id);
  if (isNaN(custId)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const companyId = getTenant(req);

  const custRow = await db.execute(sql`
    SELECT c.id, c.name, c.customer_code,
           COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0)
         - COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS balance
    FROM customers c
    LEFT JOIN journal_entry_lines jel ON jel.account_id = c.account_id
    LEFT JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    WHERE c.id = ${custId}
      ${cfSql("c", companyId)}
    GROUP BY c.id, c.name, c.customer_code
  `);
  if (!custRow.rows.length) { res.status(404).json({ error: "العميل غير موجود" }); return; }
  const customer = custRow.rows[0] as Record<string, unknown>;

  type StatRow = { date: string; type: string; description: string; debit: number; credit: number; reference_no?: string | null };
  const rows: StatRow[] = [];

  const openRows = await db.execute(sql`
    SELECT date, amount, description FROM transactions
    WHERE reference_type = 'customer_opening'
      AND customer_id = ${custId}
      ${cfSimpleSql(companyId)}
  `);
  for (const r of openRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date ?? "1900-01-01"), type: "opening_balance", description: String(r.description ?? "رصيد أول المدة"), debit: 0, credit: Number(r.amount) });
  }

  const salesRows = await db.execute(sql`
    SELECT date, invoice_no, CAST(total_amount AS FLOAT8) AS total_amount
    FROM sales
    WHERE customer_id = ${custId}
      AND posting_status = 'posted'
      ${cfSimpleSql(companyId)}
  `);
  for (const r of salesRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date), type: "sale", description: `فاتورة مبيعات ${r.invoice_no}`, debit: Number(r.total_amount), credit: 0, reference_no: r.invoice_no ? String(r.invoice_no) : undefined });
  }

  const rvRows = await db.execute(sql`
    SELECT date, voucher_no, CAST(amount AS FLOAT8) AS amount, notes
    FROM receipt_vouchers
    WHERE customer_id = ${custId}
      AND posting_status = 'posted'
      ${cfSimpleSql(companyId)}
  `);
  for (const r of rvRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date), type: "receipt", description: `سند قبض ${r.voucher_no}`, debit: 0, credit: Number(r.amount), reference_no: r.voucher_no ? String(r.voucher_no) : undefined });
  }

  const retRows = await db.execute(sql`
    SELECT date, return_no, CAST(total_amount AS FLOAT8) AS total_amount
    FROM sales_returns
    WHERE customer_id = ${custId}
      ${cfSimpleSql(companyId)}
  `);
  for (const r of retRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date), type: "sale_return", description: `مرتجع مبيعات ${r.return_no}`, debit: 0, credit: Number(r.total_amount), reference_no: r.return_no ? String(r.return_no) : undefined });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  let openingBalance = 0;
  const allRowsBeforePeriod = rows.filter(r => date_from ? r.date < date_from : false);
  for (const r of allRowsBeforePeriod) openingBalance += r.credit - r.debit;

  const periodRows = date_from || date_to
    ? rows.filter(r => {
        if (date_from && r.date < date_from && r.type !== "opening_balance") return false;
        if (date_to   && r.date > date_to)   return false;
        return true;
      })
    : rows;

  let runningBalance = openingBalance;
  const statement = periodRows.map(row => {
    runningBalance += row.credit - row.debit;
    return { ...row, balance: Math.round(runningBalance * 100) / 100 };
  });

  const periodDebits  = periodRows.filter(r => r.type === "sale")
    .reduce((s, r) => s + r.debit, 0);
  const periodCredits = periodRows.filter(r => r.type !== "sale" && r.type !== "opening_balance")
    .reduce((s, r) => s + r.credit, 0);
  const openingRowCredit = periodRows.filter(r => r.type === "opening_balance")
    .reduce((s, r) => s + r.credit, 0);

  const customerValidation = buildValidation([
    {
      name: "الافتتاح + الفواتير - المقبوضات - المرتجعات = رصيد الإغلاق",
      expected: r2(openingBalance) + r2(openingRowCredit) + r2(periodCredits) - r2(periodDebits),
      actual:   r2(runningBalance),
    },
    {
      name: "رصيد العميل في النظام = رصيد الإغلاق (بلا فلتر تاريخ)",
      expected: !(date_from || date_to) ? r2(Number(customer.balance)) : r2(runningBalance),
      actual:   r2(runningBalance),
    },
  ]);

  res.json({
    customer: { id: Number(customer.id), name: String(customer.name), balance: Number(customer.balance), customer_code: customer.customer_code },
    opening_balance: r2(openingBalance),
    statement,
    closing_balance: r2(runningBalance),
    validation: customerValidation,
  });
}));

/* ─────────────────────────────────────────────────────────────────────────
 * 5. كشف حساب مورد
 * GET /api/reports/supplier-statement?supplier_id=&date_from=&date_to=
 * ───────────────────────────────────────────────────────────────────────── */
router.get("/reports/supplier-statement", wrap(async (req, res) => {
  const { supplier_id, customer_id: qCustId, date_from, date_to } = req.query as Record<string, string | undefined>;
  const rawId = supplier_id ?? qCustId;
  if (!rawId) { res.status(400).json({ error: "يجب تحديد المورد" }); return; }
  const sid = parseInt(rawId);
  if (isNaN(sid)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  const companyId = getTenant(req);

  const custRow = await db.execute(sql`
    SELECT id, name, CAST(balance AS FLOAT8) AS balance
    FROM customers
    WHERE id = ${sid}
      ${cfSimpleSql(companyId)}
  `);
  if (!custRow.rows.length) { res.status(404).json({ error: "المورد غير موجود" }); return; }
  const supplier = custRow.rows[0] as Record<string, unknown>;

  type StatRow = { date: string; type: string; description: string; debit: number; credit: number; reference_no?: string | null };
  const rows: StatRow[] = [];

  const openRows = await db.execute(sql`
    SELECT date, amount FROM transactions
    WHERE reference_type = 'customer_opening'
      AND reference_id = ${sid}
      ${cfSimpleSql(companyId)}
  `);
  for (const r of openRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date ?? "1900-01-01"), type: "opening_balance", description: "رصيد أول المدة", debit: 0, credit: Number(r.amount) });
  }

  const purRows = await db.execute(sql`
    SELECT date, invoice_no, CAST(total_amount AS FLOAT8) AS total_amount
    FROM purchases
    WHERE customer_id = ${sid}
      AND posting_status = 'posted'
      ${cfSimpleSql(companyId)}
  `);
  for (const r of purRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date), type: "purchase", description: `فاتورة شراء ${r.invoice_no}`, debit: 0, credit: Number(r.total_amount), reference_no: r.invoice_no ? String(r.invoice_no) : undefined });
  }

  const retRows = await db.execute(sql`
    SELECT date, return_no, CAST(total_amount AS FLOAT8) AS total_amount
    FROM purchase_returns
    WHERE customer_id = ${sid}
      ${cfSimpleSql(companyId)}
  `);
  for (const r of retRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date), type: "purchase_return", description: `مرتجع مشتريات ${r.return_no}`, debit: Number(r.total_amount), credit: 0, reference_no: r.return_no ? String(r.return_no) : undefined });
  }

  const pvRows = await db.execute(sql`
    SELECT date, voucher_no, CAST(amount AS FLOAT8) AS amount
    FROM payment_vouchers
    WHERE customer_id = ${sid}
      AND posting_status = 'posted'
      ${cfSimpleSql(companyId)}
  `);
  for (const r of pvRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date), type: "payment", description: `سند دفع ${r.voucher_no}`, debit: Number(r.amount), credit: 0, reference_no: r.voucher_no ? String(r.voucher_no) : undefined });
  }

  const spRows = await db.execute(sql`
    SELECT date, CAST(amount AS FLOAT8) AS amount, description
    FROM transactions
    WHERE reference_type = 'supplier_payment'
      AND reference_id = ${sid}
      ${cfSimpleSql(companyId)}
  `);
  for (const r of spRows.rows as Record<string, unknown>[]) {
    rows.push({ date: String(r.date ?? "1900-01-01"), type: "supplier_payment", description: String(r.description ?? "سداد للمورد"), debit: Number(r.amount), credit: 0 });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  let openingBalance = 0;
  const allBeforePeriod = rows.filter(r => date_from ? r.date < date_from : false);
  for (const r of allBeforePeriod) openingBalance += r.credit - r.debit;

  const periodRows = date_from || date_to
    ? rows.filter(r => {
        if (date_from && r.date < date_from && r.type !== "opening_balance") return false;
        if (date_to   && r.date > date_to)   return false;
        return true;
      })
    : rows;

  let runningBalance = openingBalance;
  const statement = periodRows.map(row => {
    runningBalance += row.credit - row.debit;
    return { ...row, balance: Math.round(runningBalance * 100) / 100 };
  });

  const supPeriodPurchases = periodRows.filter(r => r.type === "purchase").reduce((s, r) => s + r.credit, 0);
  const supPeriodPayments  = periodRows.filter(r => r.type === "payment" || r.type === "supplier_payment").reduce((s, r) => s + r.debit, 0);
  const supPeriodReturns   = periodRows.filter(r => r.type === "purchase_return").reduce((s, r) => s + r.debit, 0);
  const supOpeningCredit   = periodRows.filter(r => r.type === "opening_balance").reduce((s, r) => s + r.credit, 0);

  const supplierValidation = buildValidation([
    {
      name: "الافتتاح + فواتير الشراء - المدفوعات - المرتجعات = رصيد الإغلاق",
      expected: r2(openingBalance) + r2(supOpeningCredit) + r2(supPeriodPurchases) - r2(supPeriodPayments) - r2(supPeriodReturns),
      actual:   r2(runningBalance),
    },
  ]);

  res.json({
    supplier: { id: Number(supplier.id), name: String(supplier.name), balance: Number(supplier.balance) },
    opening_balance: r2(openingBalance),
    statement,
    closing_balance: r2(runningBalance),
    validation: supplierValidation,
  });
}));

/* ─────────────────────────────────────────────────────────────────────────
 * تقرير أعمار الديون (العملاء والموردين)
 * GET /api/reports/aging?type=customers|suppliers&as_of=YYYY-MM-DD
 * ───────────────────────────────────────────────────────────────────────── */
router.get("/reports/aging", wrap(async (req, res) => {
  const companyId = getTenant(req);
  const { type = "customers", as_of } = req.query as Record<string, string | undefined>;
  const asOfDate = as_of ? new Date(as_of) : new Date();
  const asOfStr  = asOfDate.toISOString().split("T")[0];

  const condSales = sql`AND s.company_id = ${companyId}`;
  const condPurch = sql`AND p.company_id = ${companyId}`;

  let rows: Array<{ id: number; name: string; date: string; remaining: number; invoice_no: string }> = [];

  if (type === "customers") {
    const r = await db.execute(sql`
      SELECT s.id, s.customer_name AS name, s.date, CAST(s.remaining_amount AS FLOAT8) AS remaining, s.invoice_no
      FROM sales s
      WHERE s.payment_type IN ('credit','partial')
        AND CAST(s.remaining_amount AS FLOAT8) > 0
        AND s.date <= ${asOfStr}
        ${condSales}
      ORDER BY s.date ASC
    `);
    rows = (r.rows as Record<string, unknown>[]).map(x => ({
      id: Number(x.id),
      name: String(x.name ?? ""),
      date: String(x.date ?? ""),
      remaining: Number(x.remaining ?? 0),
      invoice_no: String(x.invoice_no ?? ""),
    }));
  } else {
    const r = await db.execute(sql`
      SELECT p.id, p.supplier_name AS name, p.date, CAST(p.remaining_amount AS FLOAT8) AS remaining, p.invoice_no
      FROM purchases p
      WHERE p.payment_type IN ('credit','partial')
        AND CAST(p.remaining_amount AS FLOAT8) > 0
        AND p.date <= ${asOfStr}
        ${condPurch}
      ORDER BY p.date ASC
    `);
    rows = (r.rows as Record<string, unknown>[]).map(x => ({
      id: Number(x.id),
      name: String(x.name ?? ""),
      date: String(x.date ?? ""),
      remaining: Number(x.remaining ?? 0),
      invoice_no: String(x.invoice_no ?? ""),
    }));
  }

  interface AgingItem {
    id: number; name: string; date: string; invoice_no: string; remaining: number; days: number;
    bucket: "0-30" | "31-60" | "61-90" | "90+";
  }
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const items: AgingItem[] = rows.map(row => {
    const invoiceDate = new Date(row.date);
    const days = Math.floor((asOfDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    let bucket: AgingItem["bucket"];
    if (days <= 30)       { bucket = "0-30";  buckets["0-30"]  += row.remaining; }
    else if (days <= 60)  { bucket = "31-60"; buckets["31-60"] += row.remaining; }
    else if (days <= 90)  { bucket = "61-90"; buckets["61-90"] += row.remaining; }
    else                  { bucket = "90+";   buckets["90+"]   += row.remaining; }
    return { ...row, days, bucket };
  });

  const total = items.reduce((s, r) => s + r.remaining, 0);

  res.json({
    type,
    as_of:   asOfStr,
    total:   Number(total.toFixed(2)),
    buckets: {
      "0-30":  Number(buckets["0-30"].toFixed(2)),
      "31-60": Number(buckets["31-60"].toFixed(2)),
      "61-90": Number(buckets["61-90"].toFixed(2)),
      "90+":   Number(buckets["90+"].toFixed(2)),
    },
    items,
    generated_at: new Date().toISOString(),
  });
}));

export default router;
