import { useLocation } from 'wouter';
import { useGetSaleById } from '@workspace/api-client-react';
import { useVatSettings } from '@/hooks/useVatSettings';
import { useAppSettings } from '@/contexts/app-settings';
import { openPrintWindow } from '@/lib/print-utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { X, Receipt, Printer, RotateCcw } from 'lucide-react';
import type { SaleExtras } from './salesTypes';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    unpaid: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = { paid: 'مدفوع', partial: 'جزئي', unpaid: 'غير مدفوع' };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${map[status] || map.unpaid}`}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    cash: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    credit: 'bg-red-500/20 text-red-400 border-red-500/30',
    partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  const labels: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${map[type] || ''}`}>
      {labels[type] || type}
    </span>
  );
}

export default function SaleDetailModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { data: saleRaw, isLoading } = useGetSaleById(saleId);
  const sale = saleRaw as (typeof saleRaw & SaleExtras) | undefined;
  const { data: vatSettings } = useVatSettings();
  const vatEnabled = vatSettings?.vatEnabled ?? false;
  const { settings } = useAppSettings();

  const escHtml = (v: unknown): string => {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  const handlePrint = () => {
    if (!sale) return;
    const payLabel: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };
    const s = sale;
    const itemsHtml = (sale.items || [])
      .map(
        (item, i) =>
          `<tr><td>${i + 1}</td><td><strong>${escHtml(item.product_name)}</strong></td><td>${Number(item.quantity)}</td><td>${Number(item.unit_price).toFixed(2)} ج.م</td>${vatEnabled ? `<td>${s?.tax_rate != null ? `${Number(s.tax_rate).toFixed(0)}%` : '—'}</td>` : ''}<td><strong>${Number(item.total_price).toFixed(2)} ج.م</strong></td></tr>`
      )
      .join('');
    const taxAmount = Number(s.tax_amount ?? 0);
    const subtotal = Number(sale.total_amount) - taxAmount + Number(s.discount_amount ?? 0);
    const vatHtml =
      taxAmount > 0
        ? `
      <div class="total-row"><span>المجموع قبل الضريبة</span><span>${subtotal.toFixed(2)} ج.م</span></div>
      <div class="total-row" style="color:#c05621;background:#fff8e1;padding:6px 8px;border-radius:4px;font-weight:700"><span>ضريبة القيمة المضافة (${Number(s.tax_rate ?? 14).toFixed(0)}%)</span><span>${taxAmount.toFixed(2)} ج.م</span></div>`
        : '';
    const discountHtml =
      Number(s.discount_amount) > 0
        ? `
      <div class="total-row"><span>الخصم (${Number(s.discount_percent)}%)</span><span>- ${Number(s.discount_amount).toFixed(2)} ج.م</span></div>`
        : '';
    const remainHtml =
      Number(sale.remaining_amount) > 0
        ? `<div class="total-row" style="color:red"><span>المتبقي</span><span><strong>${Number(sale.remaining_amount).toFixed(2)} ج.م</strong></span></div>`
        : '';
    const extraMeta = [
      s.warehouse_name
        ? `<div class="meta-item"><span class="meta-label">المخزن:</span><span class="meta-value">${escHtml(s.warehouse_name)}</span></div>`
        : '',
      s.salesperson_name
        ? `<div class="meta-item"><span class="meta-label">المندوب:</span><span class="meta-value">${escHtml(s.salesperson_name)}</span></div>`
        : '',
    ].join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><title>فاتورة ${sale.invoice_no}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#111;background:#fff;padding:24px;direction:rtl}
  .header{text-align:center;border-bottom:3px double #333;padding-bottom:14px;margin-bottom:16px}
  .company-name{font-size:28px;font-weight:900;letter-spacing:2px}
  .company-slogan{font-size:13px;color:#666;margin:4px 0}
  .company-info{font-size:12px;color:#555;margin-top:6px}
  .invoice-title{text-align:center;font-size:19px;font-weight:bold;margin:14px 0;background:#f3f3f3;padding:9px;border-radius:6px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px;font-size:13px}
  .meta-item{display:flex;gap:6px}
  .meta-label{color:#777;font-weight:600;min-width:80px}
  .meta-value{font-weight:bold;color:#111}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px}
  thead{background:#222;color:#fff}
  th,td{padding:9px 10px;text-align:right}
  td{border-bottom:1px solid #e8e8e8}
  tbody tr:nth-child(even){background:#f7f7f7}
  .totals{border:2px solid #333;border-radius:6px;padding:12px 16px;font-size:13px}
  .total-row{display:flex;justify-content:space-between;padding:4px 0}
  .total-final{font-size:18px;font-weight:900;border-top:2px solid #333;padding-top:8px;margin-top:6px}
  .footer{text-align:center;margin-top:24px;font-size:12px;color:#999;border-top:1px dashed #ccc;padding-top:12px}
  @media print{body{padding:10px}}
</style></head>
<body>
<div class="header">
  <div class="company-name">${escHtml(settings.companyName)}</div>
  <div class="company-slogan">${escHtml(settings.companySlogan)}</div>
</div>
<div class="invoice-title">فاتورة مبيعات — ${escHtml(sale.invoice_no)}</div>
<div class="meta-grid">
  <div class="meta-item"><span class="meta-label">رقم الفاتورة:</span><span class="meta-value">${escHtml(sale.invoice_no)}</span></div>
  <div class="meta-item"><span class="meta-label">التاريخ:</span><span class="meta-value">${escHtml(formatDate(sale.created_at))}</span></div>
  <div class="meta-item"><span class="meta-label">العميل:</span><span class="meta-value">${escHtml(sale.customer_name) || 'عميل نقدي'}</span></div>
  <div class="meta-item"><span class="meta-label">طريقة الدفع:</span><span class="meta-value">${escHtml(payLabel[sale.payment_type] || sale.payment_type)}</span></div>
  ${extraMeta}
</div>
<table>
  <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th>${vatEnabled ? '<th>ضريبة%</th>' : ''}<th>الإجمالي</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  ${discountHtml}
  ${vatHtml}
  <div class="total-row total-final"><span>الإجمالي الكلي</span><span>${Number(sale.total_amount).toFixed(2)} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${Number(sale.paid_amount).toFixed(2)} ج.م</span></div>
  ${remainHtml}
</div>
<div class="footer">شكراً لتعاملكم معنا — ${escHtml(settings.companyName)}</div>
</body></html>`;
    openPrintWindow(html, { width: 820, height: 950, delay: 600, autoClose: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-2xl border border-line shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-400" /> تفاصيل الفاتورة
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || !sale}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 transition-colors text-sm font-bold"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            {sale && (
              <button
                onClick={() => { onClose(); navigate(`/returns?q=${encodeURIComponent(sale.invoice_no)}`); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-300 transition-colors text-sm font-bold"
              >
                <RotateCcw className="w-4 h-4" /> مرتجعات الفاتورة
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl bg-surface hover:bg-raised text-ink/70 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-8 rounded-xl" />
            ))}
          </div>
        ) : !sale ? (
          <div className="text-center py-12 text-ink/40">لم يتم العثور على الفاتورة</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-surface rounded-2xl border border-line">
              <div>
                <p className="text-ink/50 text-sm">رقم الفاتورة</p>
                <p className="text-amber-400 font-bold text-lg">{sale.invoice_no}</p>
              </div>
              <div>
                <p className="text-ink/50 text-sm">التاريخ</p>
                <p className="text-ink">{formatDate(sale.created_at)}</p>
              </div>
              <div>
                <p className="text-ink/50 text-sm">العميل</p>
                <p className="text-ink font-semibold">{sale.customer_name || 'عميل نقدي'}</p>
              </div>
              <div>
                <p className="text-ink/50 text-sm">طريقة الدفع</p>
                <PaymentBadge type={sale.payment_type} />
              </div>
              {sale.warehouse_name && (
                <div>
                  <p className="text-ink/50 text-sm">المخزن</p>
                  <p className="text-ink">{sale.warehouse_name}</p>
                </div>
              )}
              {sale.salesperson_name && (
                <div>
                  <p className="text-ink/50 text-sm">المندوب</p>
                  <p className="text-amber-300 font-semibold">{sale.salesperson_name}</p>
                </div>
              )}
            </div>
            <div>
              <h4 className="text-ink font-bold mb-3">أصناف الفاتورة</h4>
              <div className="rounded-2xl overflow-hidden border border-line">
                <table className="w-full text-right text-sm">
                  <thead className="bg-surface border-b border-line">
                    <tr>
                      <th className="p-3 text-ink/60">الصنف</th>
                      <th className="p-3 text-ink/60">الكمية</th>
                      <th className="p-3 text-ink/60">سعر الوحدة</th>
                      <th className="p-3 text-ink/60">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sale.items || []).map((item, i) => (
                      <tr key={item.id ?? `sale-item-${i}`} className="border-b border-line">
                        <td className="p-3 font-bold text-ink">{item.product_name}</td>
                        <td className="p-3 text-ink/70">{item.quantity}</td>
                        <td className="p-3 text-ink/70">{formatCurrency(item.unit_price)}</td>
                        <td className="p-3 font-bold text-emerald-400">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-5 bg-surface rounded-2xl border border-line space-y-3">
              {(sale.discount_amount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-ink/60">الإجمالي قبل الخصم</span>
                    <span className="text-ink">{formatCurrency(sale.total_amount + (sale.discount_amount ?? 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink/60">الخصم ({sale.discount_percent}%)</span>
                    <span className="text-red-400">- {formatCurrency(sale.discount_amount ?? 0)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-line pt-3">
                <span className="text-ink/60">الإجمالي</span>
                <span className="font-bold text-ink text-lg">{formatCurrency(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">المدفوع</span>
                <span className="font-bold text-emerald-400">{formatCurrency(sale.paid_amount)}</span>
              </div>
              {sale.remaining_amount > 0 && (
                <div className="flex justify-between border-t border-line pt-3">
                  <span className="text-ink/60">المتبقي</span>
                  <span className="font-bold text-red-400 text-lg">{formatCurrency(sale.remaining_amount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3">
                <span className="text-ink/60">الحالة</span>
                <StatusBadge status={sale.status} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
