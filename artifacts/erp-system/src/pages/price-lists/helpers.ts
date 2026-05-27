import { formatCurrency } from "@/lib/format";
import { escapeHtml } from "@/lib/print-utils";
import type { PriceListDetail } from "./types";

/* ──────────────────────────────── Helpers ──────────────────────────────── */

export function safeNum(v: number | string | null | undefined) {
  return typeof v === "string" ? parseFloat(v) : (v ?? 0);
}

/* ── Print HTML generator ─────────────────────────────────────────────── */

export function buildPrintHtml(d: PriceListDetail): string {
  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
  const rows = d.items.map((item, idx) => {
    const markup = item.markup_percent;
    const rawPrice = markup != null && item.cost_price > 0
      ? item.cost_price * (1 + markup / 100)
      : item.sale_price;
    const priceFormatted = formatCurrency(rawPrice);
    return `
          <tr class="${idx % 2 === 0 ? "even" : "odd"}">
            <td class="num">${idx + 1}</td>
            <td class="product-name">${escapeHtml(item.product_name)}</td>
            <td class="price">${escapeHtml(priceFormatted)}</td>
          </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(d.name)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    direction: rtl;
    color: #1a1a2e;
    background: #fff;
    padding: 36px 40px;
    font-size: 13px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 3px solid #1a1a2e;
    padding-bottom: 18px;
    margin-bottom: 24px;
  }
  .header-left h1 {
    font-size: 24px;
    font-weight: 900;
    color: #1a1a2e;
    margin-bottom: 4px;
  }
  .header-left p { font-size: 12px; color: #666; }
  .header-right {
    text-align: left;
    font-size: 12px;
    color: #555;
    line-height: 1.8;
  }
  .header-right strong { color: #1a1a2e; font-size: 13px; }
  .badge {
    display: inline-block;
    background: #1a1a2e;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 6px;
  }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 0 0 1px #dde;
  }
  thead tr {
    background: #1a1a2e;
    color: #fff;
  }
  thead th {
    padding: 11px 16px;
    text-align: right;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  thead th.th-num { width: 48px; text-align: center; color: #aab; }
  thead th.th-price { width: 140px; text-align: center; }

  tbody tr.even { background: #f7f8fc; }
  tbody tr.odd  { background: #ffffff; }
  tbody tr:hover { background: #eef0fb; }

  tbody td { padding: 10px 16px; border-bottom: 1px solid #e8eaf0; }
  td.num { text-align: center; color: #aaa; font-size: 11px; }
  td.product-name { font-weight: 500; color: #1a1a2e; }
  td.price {
    text-align: center;
    font-weight: 800;
    font-size: 14px;
    color: #1a3a6e;
    letter-spacing: 0.01em;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 28px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }
  .note-box {
    border: 1px solid #f0c040;
    background: #fffbea;
    border-radius: 8px;
    padding: 10px 14px;
    max-width: 68%;
  }
  .note-box .note-title {
    font-weight: 800;
    font-size: 12px;
    color: #b45309;
    margin-bottom: 4px;
  }
  .note-box p { font-size: 11px; color: #78450a; line-height: 1.7; }
  .stamp {
    text-align: left;
    font-size: 11px;
    color: #999;
    line-height: 1.8;
  }
  .stamp strong { color: #555; }

  .summary {
    margin-top: 12px;
    font-size: 11px;
    color: #888;
    text-align: left;
  }

  @media print {
    body { padding: 10px 14px; }
    @page { margin: 1.2cm; size: A4; }
    table { box-shadow: none; border: 1px solid #ccc; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <div class="badge">قائمة أسعار</div>
    <h1>${escapeHtml(d.name)}</h1>
    ${d.description ? `<p>${escapeHtml(d.description)}</p>` : ""}
  </div>
  <div class="header-right">
    <div>تاريخ الإصدار: <strong>${dateStr}</strong></div>
    <div>عدد المنتجات: <strong>${d.items.length} منتج</strong></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th class="th-num">#</th>
      <th>اسم المنتج / الخدمة</th>
      <th class="th-price">السعر</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="summary">إجمالي العناصر: ${d.items.length} منتج / خدمة</div>

<div class="footer">
  <div class="note-box">
    <div class="note-title">⚠ تنبيه هام — الأسعار قابلة للتغيير</div>
    <p>
      هذه الأسعار قابلة للتغيير في أي وقت دون إشعار مسبق.<br/>
      يُرجى التواصل معنا للتأكد من الأسعار الحالية قبل إتمام أي طلب أو اتفاق.
    </p>
  </div>
  <div class="stamp">
    <div>طُبع بتاريخ: <strong>${dateStr}</strong></div>
  </div>
</div>

<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;
}
