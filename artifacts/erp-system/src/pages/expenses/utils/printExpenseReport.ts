import { openPrintWindow } from '@/lib/print-utils';
import type { ExpenseReportRow } from '../types';

/* ─── طباعة تقرير المصروفات ─── */
export function printExpenseReport(opts: {
  rows: ExpenseReportRow[];
  category: string;
  dateFrom: string;
  dateTo: string;
  companyName: string;
}) {
  const { rows, category, dateFrom, dateTo, companyName } = opts;
  const esc = (s: unknown) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
    );
  const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const rowsHtml = rows.map((r, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${esc(r.date)}</td>
      <td>${esc(r.category)}</td>
      <td>${r.description ? esc(r.description) : '—'}</td>
      <td>${r.safe_name ? esc(r.safe_name) : '—'}</td>
      <td class="num amount">${r.amount.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} ج.م</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
    <title>تقرير المصروفات</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Cairo', 'Segoe UI', Arial, sans-serif; direction: rtl; color: #1a1a2e; background: #fff; padding: 24px; font-size: 13px; }
      .header { text-align: center; margin-bottom: 20px; }
      .company { font-size: 22px; font-weight: 900; color: #1a1a2e; }
      .title { font-size: 16px; font-weight: 700; color: #1f2937; margin-top: 6px; }
      .meta { display: flex; justify-content: center; gap: 32px; margin: 12px 0 18px; font-size: 12px; color: #555; }
      .meta span { background: #f3f4f6; padding: 4px 12px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #1f2937; color: #fff; padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; text-align: right; }
      tr.even { background: #fafafa; }
      tr.odd  { background: #fff; }
      .num { text-align: left; font-family: monospace; }
      .amount { font-weight: 700; color: #dc2626; }
      tfoot td { font-weight: 800; background: #f3f4f6; border-top: 2px solid #1f2937; color: #1a1a2e; }
      .footer { margin-top: 20px; font-size: 11px; color: #888; text-align: center; }
      @media print { body { padding: 0; } @page { size: A4; margin: 12mm 15mm; } }
    </style></head><body>
    <div class="header">
      <div class="company">${esc(companyName)}</div>
      <div class="title">تقرير المصروفات</div>
      <div class="meta">
        ${category ? `<span>التصنيف: ${esc(category)}</span>` : '<span>كل التصنيفات</span>'}
        ${dateFrom ? `<span>من: ${esc(dateFrom)}</span>` : ''}
        ${dateTo ? `<span>إلى: ${esc(dateTo)}</span>` : ''}
        <span>تاريخ الطباعة: ${today}</span>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>التاريخ</th><th>التصنيف</th><th>التفاصيل</th><th>الخزينة</th><th>المبلغ</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr>
        <td colspan="4">الإجمالي (${rows.length} سجل)</td>
        <td class="num amount">${total.toLocaleString('ar-EG-u-nu-latn', { minimumFractionDigits: 2 })} ج.م</td>
      </tr></tfoot>
    </table>
    <div class="footer">نظام مُحكم - MUHKAM ERP — تم الطباعة بتاريخ ${today}</div>
    </body></html>`;

  openPrintWindow(html, { width: 900, height: 700, delay: 400 });
}
