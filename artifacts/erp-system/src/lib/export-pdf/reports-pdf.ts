import { openPrintWindow } from '../print-utils';
import { getSettings, getNumSettings, fmtMoney, _applyNumFmt, _applyThousandsSep, PL_STYLES } from './_shared';

export interface PLReportData {
  dateFrom: string;
  dateTo: string;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  profit_margin: number;
  net_profit: number;
  total_expenses: number;
  invoice_count: number;
  item_count?: number;
  cash_sales?: number;
  credit_sales?: number;
  partial_sales?: number;
  return_amount?: number;
  by_product: Array<{
    product_name: string;
    qty_sold: number;
    revenue: number;
    cost: number;
    profit: number;
  }>;
  by_warehouse?: Array<{
    warehouse_name: string;
    revenue: number;
    cost: number;
    gross_profit: number;
    invoice_count: number;
  }>;
  by_expense_category?: Array<{ category: string; total: number }>;
}

export function printPLReport(data: PLReportData): void {
  const s = getSettings();
  const { dateLocale } = getNumSettings();
  const m = fmtMoney;
  const pct = (n: number) => `${n.toFixed(1)}%`;
  const now = new Date().toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isProfit = data.net_profit >= 0;
  const grossMargin = data.total_revenue > 0 ? (data.gross_profit / data.total_revenue) * 100 : 0;
  const netMargin = data.total_revenue > 0 ? (data.net_profit / data.total_revenue) * 100 : 0;

  const branches = (data.by_warehouse ?? []).filter((w) => w.revenue > 0);
  const expenses = data.by_expense_category ?? [];
  const retAmt = data.return_amount ?? 0;

  const expLines = expenses
    .slice(0, 8)
    .map(
      (e) =>
        `<tr class="sub"><td>(−) ${e.category}</td><td class="num red">(${m(e.total)})</td></tr>`
    )
    .join('');
  const otherExpAmt = expenses.slice(8).reduce((s, e) => s + e.total, 0);

  const html = `
<div class="page">

  <!-- Header -->
  <div class="pl-header">
    <div>
      <div class="pl-company">${s.companyName}</div>
      ${s.phone ? `<div class="pl-company-sub">📞 ${s.phone}</div>` : ''}
      ${s.address ? `<div class="pl-company-sub">📍 ${s.address}</div>` : ''}
    </div>
    <div class="pl-title-block">
      <div class="pl-title">قائمة الأرباح والخسائر</div>
      <div class="pl-subtitle">الفترة: ${data.dateFrom} — ${data.dateTo}</div>
    </div>
  </div>

  <!-- KPI Summary (3 only) -->
  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">إجمالي المبيعات</div>
      <div class="kpi-value dark">${m(data.total_revenue)}</div>
      <div class="kpi-sub">${data.invoice_count} فاتورة</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">إجمالي المصروفات</div>
      <div class="kpi-value red">${m(data.total_expenses)}</div>
    </div>
    <div class="kpi-box ${isProfit ? 'profit' : 'loss'}">
      <div class="kpi-label">صافي الربح</div>
      <div class="kpi-value ${isProfit ? 'green' : 'red'}">${m(data.net_profit)}</div>
      <div class="kpi-sub">${pct(netMargin)}</div>
    </div>
  </div>

  <!-- Accounting Statement -->
  <table class="stmt">
    <!-- الإيرادات -->
    <tr class="sec-hd"><td colspan="2">الإيرادات</td></tr>
    <tr><td>إجمالي المبيعات</td><td class="num green">${m(data.total_revenue)}</td></tr>
    ${
      retAmt > 0
        ? `<tr class="sub"><td>(−) مرتجعات المبيعات</td><td class="num red">(${m(retAmt)})</td></tr>
    <tr class="total"><td>صافي الإيرادات</td><td class="num">${m(data.total_revenue - retAmt)}</td></tr>`
        : ''
    }

    <!-- تكلفة البضاعة -->
    <tr class="sec-hd"><td colspan="2">تكلفة البضاعة المباعة</td></tr>
    <tr class="sub"><td>(−) تكلفة البضاعة المباعة</td><td class="num red">(${m(data.total_cost)})</td></tr>
    <tr class="gross">
      <td>= مجمل الربح</td>
      <td class="num ${data.gross_profit >= 0 ? 'amber' : 'red'}">${m(data.gross_profit)} <span style="font-size:11px;opacity:0.65">${pct(grossMargin)}</span></td>
    </tr>

    <!-- المصروفات -->
    <tr class="sec-hd"><td colspan="2">المصروفات التشغيلية</td></tr>
    ${expLines || (data.total_expenses > 0 ? `<tr class="sub"><td>(−) مصروفات تشغيلية</td><td class="num red">(${m(data.total_expenses)})</td></tr>` : `<tr><td colspan="2" style="color:#9ca3af;text-align:center;font-style:italic">لا توجد مصروفات</td></tr>`)}
    ${otherExpAmt > 0 ? `<tr class="sub"><td>(−) مصروفات أخرى</td><td class="num red">(${m(otherExpAmt)})</td></tr>` : ''}
    ${expenses.length > 0 ? `<tr class="total"><td>إجمالي المصروفات</td><td class="num red">(${m(data.total_expenses)})</td></tr>` : ''}

    <!-- صافي الربح -->
    <tr class="${isProfit ? 'net-pos' : 'net-neg'}">
      <td>= صافي الربح / الخسارة</td>
      <td class="num" style="font-size:16px">${m(data.net_profit)} <span style="font-size:11px;opacity:0.7">${pct(netMargin)}</span></td>
    </tr>
  </table>

  ${
    branches.length > 1
      ? `
  <!-- Branch Comparison -->
  <div class="sec-hd-bar">مقارنة الفروع · ${branches.length} فروع</div>
  <table class="data">
    <thead><tr><th>الفرع</th><th>المبيعات</th><th>التكلفة</th><th>مجمل الربح</th><th>الهامش</th><th>الفواتير</th></tr></thead>
    <tbody>${branches
      .map((w) => {
        const mg = w.revenue > 0 ? (w.gross_profit / w.revenue) * 100 : 0;
        return `<tr>
        <td style="font-weight:700">${w.warehouse_name}</td>
        <td>${m(w.revenue)}</td>
        <td style="color:#dc2626">${m(w.cost)}</td>
        <td style="font-weight:700;color:${w.gross_profit >= 0 ? '#059669' : '#dc2626'}">${m(w.gross_profit)}</td>
        <td>${mg.toFixed(1)}%</td>
        <td>${w.invoice_count}</td>
      </tr>`;
      })
      .join('')}</tbody>
    <tfoot><tr>
      <td>الإجمالي</td>
      <td>${m(branches.reduce((s, b) => s + b.revenue, 0))}</td>
      <td>${m(branches.reduce((s, b) => s + b.cost, 0))}</td>
      <td style="color:${branches.reduce((s, b) => s + b.gross_profit, 0) >= 0 ? '#059669' : '#dc2626'}">${m(branches.reduce((s, b) => s + b.gross_profit, 0))}</td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>`
      : ''
  }

  <!-- Footer -->
  <div class="pl-footer">
    <span>طُبع: ${now}</span>
    <span>عدد الفواتير: ${data.invoice_count}${data.item_count ? ` · ${data.item_count} صنف` : ''}</span>
    <span>${s.companyName}</span>
  </div>

</div>`;

  const fullHtml = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"><title>قائمة الأرباح والخسائر — ${s.companyName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>${PL_STYLES}</style>
</head>
<body>${html}
<script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),700));<\/script>
</body></html>`;
  if (!openPrintWindow(fullHtml, { width: 960, height: 750 })) {
    alert('يرجى السماح بالنوافذ المنبثقة ثم أعد المحاولة');
  }
}

export interface BalanceSheetPrintData {
  assets: { cash: number; receivables: number; inventory: number; total: number };
  liabilities: { payables: number; total: number };
  equity: { opening_capital: number; retained_earnings: number; total: number };
  total_liabilities_equity: number;
  balanced: boolean;
  as_of: string;
}

export function printBalanceSheet(data: BalanceSheetPrintData): void {
  const s = getSettings();
  const { dateLocale } = getNumSettings();
  const m = fmtMoney;
  const now = new Date().toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const asOf = new Date(data.as_of).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const retainedIsPos = data.equity.retained_earnings >= 0;
  const eqIsPos = data.equity.total >= 0;
  const eqColor = eqIsPos ? '#059669' : '#dc2626';
  const eqBg = eqIsPos ? '#f0fdf4' : '#fef2f2';
  const eqBdr = eqIsPos ? '#059669' : '#dc2626';

  const html = `
<div class="page">
  <div class="pl-header">
    <div>
      <div class="pl-company">${s.companyName}</div>
      ${s.phone ? `<div class="pl-company-sub">📞 ${s.phone}</div>` : ''}
      ${s.address ? `<div class="pl-company-sub">📍 ${s.address}</div>` : ''}
    </div>
    <div class="pl-title-block">
      <div class="pl-title">الميزانية العمومية</div>
      <div class="pl-subtitle">المركز المالي في: ${asOf}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box" style="border-color:#d97706;background:#fffbeb">
      <div class="kpi-label">إجمالي الأصول</div>
      <div class="kpi-value amber">${m(data.assets.total)}</div>
      <div class="kpi-sub">النقدية + الذمم + المخزون</div>
    </div>
    <div class="kpi-box" style="border-color:#dc2626;background:#fef2f2">
      <div class="kpi-label">إجمالي الخصوم</div>
      <div class="kpi-value red">${m(data.liabilities.total)}</div>
      <div class="kpi-sub">ذمم الموردين الدائنة</div>
    </div>
    <div class="kpi-box ${eqIsPos ? 'profit' : 'loss'}">
      <div class="kpi-label">حقوق الملكية</div>
      <div class="kpi-value ${eqIsPos ? 'green' : 'red'}">${m(data.equity.total)}</div>
      <div class="kpi-sub">رأس المال + الأرباح المحتجزة</div>
    </div>
  </div>

  <table class="stmt">

    <!-- ══ الأصول ══ -->
    <tr class="sec-hd"><td colspan="2">الأصول</td></tr>

    <tr style="background:#f3f4f6"><td colspan="2" style="padding:5px 16px;font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.05em">الأصول المتداولة</td></tr>
    <tr class="sub"><td>النقدية — أرصدة الخزن الحالية</td><td class="num">${m(data.assets.cash)}</td></tr>
    <tr class="sub"><td>ذمم العملاء المدينة</td><td class="num">${m(data.assets.receivables)}</td></tr>
    <tr class="sub"><td>المخزون — الكمية × سعر التكلفة</td><td class="num">${m(data.assets.inventory)}</td></tr>
    <tr class="total"><td>= إجمالي الأصول المتداولة</td><td class="num amber">${m(data.assets.total)}</td></tr>

    <tr style="background:#f3f4f6"><td colspan="2" style="padding:5px 16px;font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.05em">الأصول غير المتداولة</td></tr>
    <tr class="sub" style="color:#9ca3af"><td style="color:#9ca3af;font-style:italic">أصول ثابتة — لا توجد حالياً</td><td class="num" style="color:#9ca3af">—</td></tr>
    <tr class="total" style="color:#9ca3af"><td style="color:#9ca3af">= إجمالي الأصول غير المتداولة</td><td class="num" style="color:#9ca3af">0.00</td></tr>

    <tr class="total" style="background:#1e293b08;border-top:2px solid #1e293b30;border-bottom:2px solid #1e293b30">
      <td style="color:#1e293b;font-size:14px">= إجمالي الأصول</td>
      <td class="num amber" style="font-size:14px">${m(data.assets.total)}</td>
    </tr>

    <tr><td colspan="2" style="height:8px;background:#f9fafb"></td></tr>

    <!-- ══ الخصوم ══ -->
    <tr class="sec-hd"><td colspan="2">الخصوم</td></tr>

    <tr style="background:#f3f4f6"><td colspan="2" style="padding:5px 16px;font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.05em">الخصوم المتداولة</td></tr>
    <tr class="sub"><td>ذمم الموردين الدائنة</td><td class="num">${m(data.liabilities.payables)}</td></tr>
    <tr class="total" style="color:#6b7280"><td style="color:#6b7280">= إجمالي الخصوم المتداولة</td><td class="num" style="color:#6b7280">${m(data.liabilities.payables)}</td></tr>

    <tr style="background:#f3f4f6"><td colspan="2" style="padding:5px 16px;font-size:10px;font-weight:700;color:#6b7280;letter-spacing:0.05em">الخصوم طويلة الأجل</td></tr>
    <tr class="sub" style="color:#9ca3af"><td style="color:#9ca3af;font-style:italic">التزامات طويلة الأجل — لا توجد حالياً</td><td class="num" style="color:#9ca3af">—</td></tr>
    <tr class="total" style="color:#9ca3af"><td style="color:#9ca3af">= إجمالي الخصوم طويلة الأجل</td><td class="num" style="color:#9ca3af">0.00</td></tr>

    <tr class="total"><td style="color:#4b5563">= إجمالي الخصوم</td><td class="num" style="color:#4b5563">${m(data.liabilities.total)}</td></tr>

    <tr><td colspan="2" style="height:8px;background:#f9fafb"></td></tr>

    <!-- ══ حقوق الملكية ══ -->
    <tr class="sec-hd"><td colspan="2">حقوق الملكية</td></tr>
    <tr class="sub"><td>رأس المال المفتوح — الأرصدة الافتتاحية</td><td class="num">${m(data.equity.opening_capital)}</td></tr>
    <tr class="sub"><td>الأرباح المحتجزة — صافي الربح الكلي</td><td class="num ${retainedIsPos ? 'green' : 'red'}">${m(data.equity.retained_earnings)}</td></tr>
    <tr class="total" style="background:${eqBg};border-top-color:${eqBdr};border-bottom-color:${eqBdr}">
      <td style="color:${eqColor}">= إجمالي حقوق الملكية</td>
      <td class="num" style="color:${eqColor}">${m(data.equity.total)}</td>
    </tr>

    <tr><td colspan="2" style="height:4px;background:#f9fafb"></td></tr>

    <!-- ══ معادلة التوازن ══ -->
    <tr class="${data.balanced ? 'net-pos' : 'net-neg'}">
      <td style="font-size:15px">= إجمالي الخصوم + حقوق الملكية &nbsp;${data.balanced ? '✓' : '⚠'}</td>
      <td class="num" style="font-size:15px">${m(data.total_liabilities_equity)}</td>
    </tr>
    ${
      !data.balanced
        ? `
    <tr style="background:#fef2f2"><td colspan="2" style="padding:8px 16px;font-size:11px;color:#dc2626;font-weight:700">
      ⚠️ يوجد فرق: ${m(Math.abs(data.assets.total - data.total_liabilities_equity))} — الأصول (${m(data.assets.total)}) ≠ الخصوم + الملكية (${m(data.total_liabilities_equity)})
    </td></tr>`
        : ''
    }

  </table>

  <div class="pl-footer">
    <span>تاريخ الطباعة: ${now}</span>
    <span>مُحكم - MUHKAM ERP</span>
  </div>
</div>`;

  openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
  <meta charset="UTF-8"><title>الميزانية العمومية — ${s.companyName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>${PL_STYLES}</style>
</head>
<body>${html}
<script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),700));<\/script>
</body></html>`, { width: 960, height: 750 });
}

export interface CashFlowPrintData {
  total_in: number;
  total_out: number;
  net_cash_flow: number;
  customer_receipts: number;
  receipts_in: number;
  cash_sales: number;
  deposits_in: number;
  payments_out: number;
  expenses_out: number;
  dateFrom: string;
  dateTo: string;
  closingBalance?: number;
}

export function printCashFlow(data: CashFlowPrintData): void {
  const s = getSettings();
  const { dateLocale: dloc2, numFmt: nf2, dp: dp2, tSep: ts2 } = getNumSettings();
  const m = fmtMoney;
  const now = new Date().toLocaleDateString(dloc2, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const operatingNet = data.customer_receipts - data.payments_out - data.expenses_out;
  const hasInvesting = data.deposits_in > 0;
  const showSub = data.receipts_in > 0 && data.cash_sales > 0;
  const isPos = data.net_cash_flow >= 0;
  const closingBal = data.closingBalance ?? null;
  const openingBal = closingBal !== null ? closingBal - data.net_cash_flow : null;
  const fmtN = (n: number) => {
    const abs = Math.abs(n);
    const raw = abs.toLocaleString('en-US', { minimumFractionDigits: dp2, maximumFractionDigits: dp2 });
    const formatted = _applyNumFmt(_applyThousandsSep(raw, ts2), nf2);
    return n < 0 ? `(${formatted})` : formatted;
  };

  const investingSection = hasInvesting
    ? `
    <tr class="sec-hd"><td colspan="2">التدفقات الاستثمارية</td></tr>
    <tr class="sub"><td>إيداعات</td><td class="num" style="color:#4b5563">${m(data.deposits_in)}</td></tr>
    <tr class="total"><td>= صافي التدفقات الاستثمارية</td><td class="num" style="color:#4b5563">${m(data.deposits_in)}</td></tr>`
    : '';

  const html = `
<div class="page">
  <div class="pl-header">
    <div>
      <div class="pl-company">${s.companyName}</div>
      ${s.phone ? `<div class="pl-company-sub">📞 ${s.phone}</div>` : ''}
      ${s.address ? `<div class="pl-company-sub">📍 ${s.address}</div>` : ''}
    </div>
    <div class="pl-title-block">
      <div class="pl-title">قائمة التدفقات النقدية</div>
      <div class="pl-subtitle">الفترة: ${data.dateFrom} — ${data.dateTo}</div>
      <div class="pl-subtitle" style="font-size:10px;margin-top:2px">التحويلات بين الخزن مستثناة</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-box">
      <div class="kpi-label">إجمالي الداخل النقدي</div>
      <div class="kpi-value green">${m(data.total_in)}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-label">إجمالي الخارج النقدي</div>
      <div class="kpi-value red">${m(data.total_out)}</div>
    </div>
    <div class="kpi-box ${isPos ? 'profit' : 'loss'}">
      <div class="kpi-label">صافي التدفق النقدي</div>
      <div class="kpi-value ${isPos ? 'green' : 'red'}">${m(data.net_cash_flow)}</div>
    </div>
  </div>

  <table class="stmt">
    ${
      openingBal !== null
        ? `
    <tr style="background:#f9fafb"><td style="color:#6b7280;font-style:italic;padding:10px 16px;border-bottom:1px solid #f3f4f6;font-size:12px">رصيد أول الفترة (الخزينة)</td><td class="num" style="color:#6b7280;font-style:italic;font-size:12px;padding:10px 16px;border-bottom:1px solid #f3f4f6">${m(openingBal)}</td></tr>`
        : ''
    }
    <tr class="sec-hd"><td colspan="2">التدفقات التشغيلية</td></tr>
    <tr><td style="font-weight:600">مقبوضات من العملاء</td><td class="num green">${m(data.customer_receipts)}</td></tr>
    ${
      showSub
        ? `
    <tr class="sub"><td>· سندات القبض المرحّلة</td><td class="num">${m(data.receipts_in)}</td></tr>
    <tr class="sub"><td>· مبيعات نقدية مباشرة</td><td class="num">${m(data.cash_sales)}</td></tr>`
        : ''
    }
    <tr class="sub"><td>(−) مدفوعات للموردين</td><td class="num red">${data.payments_out > 0 ? `(${m(data.payments_out)})` : '—'}</td></tr>
    <tr class="sub"><td>(−) مصروفات تشغيلية</td><td class="num red">${data.expenses_out > 0 ? `(${m(data.expenses_out)})` : '—'}</td></tr>
    <tr class="total"><td>= صافي التدفق التشغيلي</td><td class="num ${operatingNet >= 0 ? 'green' : 'red'}">${fmtN(operatingNet)}</td></tr>
    ${investingSection}
    <tr class="${isPos ? 'net-pos' : 'net-neg'}">
      <td style="font-size:17px">= صافي التدفق النقدي</td>
      <td class="num" style="font-size:17px">${fmtN(data.net_cash_flow)}</td>
    </tr>
    ${
      closingBal !== null
        ? `
    <tr style="background:#f8fafc;border-top:1px solid #e5e7eb"><td style="font-weight:700;padding:12px 16px;border-bottom:none">= رصيد آخر الفترة (الخزينة)</td><td class="num" style="padding:12px 16px;border-bottom:none;font-weight:700">${m(closingBal)}</td></tr>`
        : ''
    }
  </table>

  <div class="pl-footer">
    <span>تاريخ الطباعة: ${now}</span>
    <span>مُحكم - MUHKAM ERP</span>
  </div>
</div>`;

  openPrintWindow(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
  <meta charset="UTF-8"><title>قائمة التدفقات النقدية — ${s.companyName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>${PL_STYLES}</style>
</head>
<body>${html}
<script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),700));<\/script>
</body></html>`, { width: 960, height: 750 });
}
