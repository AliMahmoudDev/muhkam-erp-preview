import { openPrintWindow } from '../print-utils';
import { getTenantSettingsStorageKey } from '../tenant-storage';

export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getSettings(): { companyName: string; phone: string; address: string } {
  try {
    const raw = localStorage.getItem(getTenantSettingsStorageKey());
    if (raw) {
      const p = JSON.parse(raw);
      return {
        companyName: p.companyName ?? 'هالال تك',
        phone: p.phone ?? '',
        address: p.address ?? '',
      };
    }
  } catch {}
  return { companyName: 'هالال تك', phone: '', address: '' };
}

function _toWestern(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0630));
}
function _toArabicIndic(str: string): string {
  return str.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0x0630));
}
export function _applyNumFmt(str: string, fmt: string): string {
  if (fmt === 'arabic-indic') return _toArabicIndic(_toWestern(str));
  return _toWestern(str);
}
export function _applyThousandsSep(str: string, sep: string): string {
  if (sep === 'comma') return str;
  if (sep === 'none') return str.replace(/,/g, '');
  return str.replace(/,/g, sep === 'period' ? '.' : sep === 'space' ? '\u00a0' : '،');
}

export function getNumSettings(): {
  sym: string;
  numFmt: string;
  dp: number;
  tSep: string;
  dateLocale: string;
} {
  try {
    const raw = localStorage.getItem(getTenantSettingsStorageKey());
    if (raw) {
      const p = JSON.parse(raw);
      const currMap: Record<string, string> = { EGP: 'ج.م', USD: '$', CNY: '¥' };
      const numFmt = p.numberFormat === 'arabic-indic' ? 'arabic-indic' : 'western';
      const dp = [0, 2, 3].includes(p.decimalPlaces) ? p.decimalPlaces : 2;
      const tSep = ['comma', 'period', 'space', 'arabic-comma'].includes(p.thousandsSeparator)
        ? p.thousandsSeparator
        : 'comma';
      const dateLocale = numFmt === 'arabic-indic' ? 'ar-EG' : 'ar-EG-u-nu-latn';
      return { sym: currMap[p.currency] ?? 'ج.م', numFmt, dp, tSep, dateLocale };
    }
  } catch {}
  return { sym: 'ج.م', numFmt: 'western', dp: 2, tSep: 'comma', dateLocale: 'ar-EG-u-nu-latn' };
}

export function fmtMoney(n: number | null | undefined): string {
  const { sym, numFmt, dp, tSep } = getNumSettings();
  const val = Number(n ?? 0);
  const raw = val.toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  return _applyNumFmt(_applyThousandsSep(raw, tSep), numFmt) + ' ' + sym;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  const { dateLocale } = getNumSettings();
  return new Date(d).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function payLabel(t: string): string {
  return { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' }[t] ?? t;
}

export function statusLabel(s: string): string {
  return { paid: 'مدفوع', partial: 'جزئي', pending: 'معلق', unpaid: 'غير مدفوع' }[s] ?? s;
}

export const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', 'Arial', sans-serif; direction: rtl; background: white; color: #111827; font-size: 13px; }
  .page { padding: 28px 32px; max-width: 960px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #d97706; }
  .company-name { font-size: 20px; font-weight: 900; color: #1a1a1a; }
  .company-info { font-size: 11px; color: #6b7280; margin-top: 3px; }
  .report-info { text-align: left; }
  .report-title { font-size: 17px; font-weight: 900; color: #d97706; }
  .report-date { font-size: 11px; color: #6b7280; margin-top: 3px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; background: #fafafa; }
  .card-label { font-size: 10px; color: #6b7280; margin-bottom: 3px; }
  .card-value { font-size: 15px; font-weight: 900; color: #111827; }
  .card-value.green { color: #059669; }
  .card-value.red { color: #dc2626; }
  .card-value.amber { color: #d97706; }
  .section-title { font-size: 13px; font-weight: 700; margin: 18px 0 8px; padding: 5px 10px; background: #fef3c7; border-right: 3px solid #d97706; color: #92400e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
  thead th { background: #f3f4f6; padding: 8px 12px; text-align: right; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; }
  tbody td { padding: 7px 12px; text-align: right; border-bottom: 1px solid #f3f4f6; color: #374151; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tfoot td { padding: 8px 12px; text-align: right; font-weight: 700; background: #f3f4f6; border-top: 2px solid #e5e7eb; color: #111827; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .customer-info { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; background: #fafafa; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .info-item label { font-size: 10px; color: #6b7280; display: block; margin-bottom: 2px; }
  .info-item span { font-size: 13px; font-weight: 700; color: #111827; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
  .no-data { text-align: center; padding: 12px; color: #9ca3af; font-size: 12px; background: #f9fafb; border-radius: 6px; margin-bottom: 10px; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { margin: 12mm 15mm; size: A4; }
  }
`;

export function buildWindow(title: string, bodyHtml: string): void {
  const s = getSettings();
  const now = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const safeTitle = escapeHtml(title);
  const safeCompanyName = escapeHtml(s.companyName);
  const safePhone = escapeHtml(s.phone);
  const safeAddress = escapeHtml(s.address);

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>${PRINT_STYLES}</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="company-name">${safeCompanyName}</div>
      ${safePhone ? `<div class="company-info">هاتف: ${safePhone}</div>` : ''}
      ${safeAddress ? `<div class="company-info">عنوان: ${safeAddress}</div>` : ''}
    </div>
    <div class="report-info">
      <div class="report-title">${safeTitle}</div>
      <div class="report-date">تاريخ الطباعة: ${now}</div>
    </div>
  </div>
  ${bodyHtml}
  <div class="footer">${escapeHtml(s.companyName)} &bull; ${now}</div>
</div>
<script>
  document.fonts.ready.then(function() { setTimeout(function() { window.print(); }, 600); });
</script>
</body></html>`;

  if (!openPrintWindow(html, { width: 900, height: 700 })) {
    alert('يرجى السماح بالنوافذ المنبثقة في المتصفح ثم أعد المحاولة');
  }
}

export const INVOICE_STYLES = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo','Arial',sans-serif; direction:rtl; background:#fff; color:#111827; font-size:13px; }
  .inv { max-width:820px; margin:0 auto; padding:30px 36px; }
  .inv-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .co-name { font-size:22px; font-weight:900; color:#111; }
  .co-sub { font-size:11px; color:#6b7280; margin-top:3px; }
  .inv-meta { text-align:left; }
  .inv-title { font-size:18px; font-weight:900; color:#d97706; }
  .inv-no { font-size:14px; font-weight:700; color:#374151; margin-top:3px; }
  .inv-date { font-size:11px; color:#6b7280; margin-top:2px; }
  hr.gold { border:none; border-top:2px solid #d97706; margin:14px 0; }
  .party-box { background:#fafafa; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; margin-bottom:16px; }
  .party-title { font-size:11px; color:#6b7280; font-weight:700; margin-bottom:6px; text-transform:uppercase; }
  .party-name { font-size:14px; font-weight:900; color:#111; }
  .party-phone { font-size:12px; color:#6b7280; margin-top:2px; }
  table.items { width:100%; border-collapse:collapse; margin:14px 0; }
  table.items thead th { background:#1f2937; color:#fff; padding:9px 12px; text-align:right; font-size:12px; font-weight:700; }
  table.items tbody td { padding:9px 12px; text-align:right; border-bottom:1px solid #f3f4f6; font-size:13px; }
  table.items tbody tr:nth-child(even) { background:#fafafa; }
  table.items tfoot td { background:#f9fafb; padding:10px 12px; font-weight:700; border-top:2px solid #e5e7eb; font-size:13px; }
  .totals { display:flex; justify-content:flex-start; margin-top:14px; }
  .totals-inner { min-width:260px; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; }
  .t-row { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; border-bottom:1px solid #f3f4f6; font-size:13px; }
  .t-row.grand { background:#fef3c7; font-size:15px; font-weight:900; border-bottom:none; }
  .t-row.paid { color:#059669; font-weight:700; border-bottom:none; }
  .t-row.remaining { color:#dc2626; font-weight:700; }
  .foot-row { display:flex; justify-content:space-between; margin-top:18px; padding-top:14px; border-top:1px solid #e5e7eb; font-size:12px; color:#374151; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; }
  .badge-cash { background:#d1fae5; color:#065f46; }
  .badge-credit { background:#fee2e2; color:#991b1b; }
  .badge-partial { background:#fef3c7; color:#92400e; }
  .thank { text-align:center; margin-top:20px; padding:12px; font-size:13px; color:#6b7280; border-top:1px dashed #e5e7eb; }
  @media print {
    body { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    @page { margin:10mm 12mm; size:A4; }
  }
`;

export function invoiceWindow(title: string, body: string): void {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>${INVOICE_STYLES}</style>
</head><body>${body}
<script>document.fonts.ready.then(function(){setTimeout(function(){window.print();},700);});<\/script>
</body></html>`;
  if (!openPrintWindow(html, { width: 900, height: 750 })) {
    alert('يرجى السماح بالنوافذ المنبثقة في المتصفح');
  }
}

export const PL_STYLES = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo','Arial',sans-serif; direction:rtl; background:#fff; color:#111827; font-size:13px; line-height:1.6; }
  .page { padding:28px 32px; max-width:900px; margin:0 auto; }

  /* ── Header ── */
  .pl-header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:3px solid #111827; margin-bottom:22px; }
  .pl-company { font-size:20px; font-weight:900; color:#111827; }
  .pl-company-sub { font-size:11px; color:#6b7280; margin-top:3px; }
  .pl-title-block { text-align:left; }
  .pl-title { font-size:18px; font-weight:900; color:#111827; }
  .pl-subtitle { font-size:11px; color:#6b7280; margin-top:3px; }

  /* ── KPI boxes (3 only) ── */
  .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
  .kpi-box  { border:1.5px solid #e5e7eb; border-radius:6px; padding:14px 16px; }
  .kpi-box.profit { border-color:#059669; background:#f0fdf4; }
  .kpi-box.loss   { border-color:#dc2626; background:#fef2f2; }
  .kpi-label { font-size:10px; color:#6b7280; font-weight:700; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.04em; }
  .kpi-value { font-size:18px; font-weight:900; }
  .kpi-value.green  { color:#059669; }
  .kpi-value.red    { color:#dc2626; }
  .kpi-value.dark   { color:#111827; }
  .kpi-sub { font-size:10px; color:#9ca3af; margin-top:3px; }

  /* ── Accounting Statement ── */
  .stmt { width:100%; border-collapse:collapse; margin-bottom:24px; }
  .stmt td { padding:10px 16px; border-bottom:1px solid #f3f4f6; font-size:13px; color:#374151; }
  .stmt .sec-hd td { background:#1f2937; color:#fff; font-size:11px; font-weight:700; padding:7px 16px; letter-spacing:0.04em; border-bottom:none; }
  .stmt .sub td:first-child { padding-right:34px; color:#6b7280; font-size:12px; }
  .stmt .total td { font-weight:800; font-size:14px; background:#f8fafc; border-top:2px solid #e5e7eb; border-bottom:2px solid #e5e7eb; }
  .stmt .gross td { font-weight:800; font-size:14px; background:#fef9ec; border-top:2px solid #e5e7eb; border-bottom:2px solid #e5e7eb; }
  .stmt .net-pos td { font-weight:900; font-size:15px; background:#f0fdf4; color:#059669; border-top:2px solid #059669; padding-top:13px; padding-bottom:13px; }
  .stmt .net-neg td { font-weight:900; font-size:15px; background:#fef2f2; color:#dc2626; border-top:2px solid #dc2626; padding-top:13px; padding-bottom:13px; }
  .num { text-align:left; font-variant-numeric:tabular-nums; font-weight:700; }
  .num.green  { color:#059669; }
  .num.red    { color:#dc2626; }
  .num.amber  { color:#d97706; }

  /* ── Branch table ── */
  .sec-hd-bar { font-size:12px; font-weight:800; padding:7px 12px; background:#f3f4f6; border-right:3px solid #374151; color:#111827; margin:18px 0 8px; }
  table.data { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:14px; }
  table.data thead th { background:#374151; color:#fff; padding:8px 12px; text-align:right; font-weight:700; }
  table.data tbody td { padding:7px 12px; text-align:right; border-bottom:1px solid #f3f4f6; color:#374151; }
  table.data tbody tr:nth-child(even) { background:#fafafa; }
  table.data tfoot td { padding:8px 12px; font-weight:900; background:#f3f4f6; border-top:2px solid #e5e7eb; }

  /* ── Footer ── */
  .pl-footer { margin-top:24px; padding-top:10px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#9ca3af; }

  @media print {
    body { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    @page { margin:12mm 14mm; size:A4; }
  }
`;
