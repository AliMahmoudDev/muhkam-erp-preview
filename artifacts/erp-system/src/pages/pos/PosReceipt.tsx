import { useEffect } from 'react';
import { useAppSettings } from '@/contexts/app-settings';
import { openPrintWindow, escapeHtml } from '@/lib/print-utils';
import { formatCurrency } from '@/lib/format';
import { CheckCircle2, Printer } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
export interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  stock: number;
}

export interface SuccessInvoice {
  invoice_no: string;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  payment_type: string;
  items: CartItem[];
  warehouseName?: string;
  safeName?: string;
  cashierName?: string;
}

/* ─────────────────────────────────────────────────────────────
   THERMAL RECEIPT PRINT
───────────────────────────────────────────────────────────── */
export function printReceipt(invoice: SuccessInvoice, companyName: string) {
  const payLabel: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG-u-nu-latn');
  const timeStr = now.toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' });

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; max-width: 80mm; padding: 4mm; color: #000; }
  .center { text-align:center; }
  .bold { font-weight:bold; }
  .title { font-size:14px; font-weight:900; margin-bottom:2px; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display:flex; justify-content:space-between; margin: 2px 0; }
  .total-row { font-size:14px; font-weight:900; border-top:2px solid #000; padding-top:4px; margin-top:4px; }
  .footer { text-align:center; margin-top:6px; font-size:10px; }
  table { width:100%; border-collapse:collapse; }
  td { padding: 1px 0; vertical-align:top; }
  td:last-child { text-align:left; white-space:nowrap; }
  @media print { @page { margin:0; size: 80mm auto; } }
</style>
</head>
<body>
<div class="center bold title">${escapeHtml(companyName)}</div>
<div class="center" style="font-size:10px;">فاتورة مبيعات</div>
<div class="sep"></div>
<div class="row"><span>رقم الفاتورة:</span><span class="bold">${escapeHtml(invoice.invoice_no)}</span></div>
<div class="row"><span>التاريخ:</span><span>${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</span></div>
${invoice.cashierName ? `<div class="row"><span>الكاشير:</span><span>${escapeHtml(invoice.cashierName)}</span></div>` : ''}
${invoice.warehouseName ? `<div class="row"><span>الفرع:</span><span>${escapeHtml(invoice.warehouseName)}</span></div>` : ''}
${invoice.safeName ? `<div class="row"><span>الخزينة:</span><span>${escapeHtml(invoice.safeName)}</span></div>` : ''}
${invoice.customer_name ? `<div class="row"><span>العميل:</span><span>${escapeHtml(invoice.customer_name)}</span></div>` : ''}
<div class="sep"></div>
<table>
  <tr><td class="bold">الصنف</td><td class="bold" style="text-align:center;">كمية</td><td class="bold">سعر</td><td class="bold">إجمالي</td></tr>
  ${invoice.items.map((i) => `<tr><td>${escapeHtml(i.product_name)}</td><td style="text-align:center;">${i.quantity}</td><td>${i.unit_price.toFixed(2)}</td><td>${i.total_price.toFixed(2)}</td></tr>`).join('')}
</table>
<div class="sep"></div>
<div class="row total-row"><span>الإجمالي</span><span>${invoice.total_amount.toFixed(2)} ج.م</span></div>
<div class="row" style="margin-top:3px;"><span>طريقة الدفع:</span><span>${escapeHtml(payLabel[invoice.payment_type] ?? invoice.payment_type)}</span></div>
<div class="sep"></div>
<div class="footer">شكراً لتعاملكم معنا 🙏<br/>${escapeHtml(companyName)} © ${now.getFullYear()}</div>
</body></html>`;

  openPrintWindow(html, { width: 340, height: 600, delay: 250, autoClose: true });
}

/* ─────────────────────────────────────────────────────────────
   SUCCESS MODAL
───────────────────────────────────────────────────────────── */
export function SuccessModal({
  invoice,
  onClose,
}: {
  invoice: SuccessInvoice;
  onClose: () => void;
}) {
  const { settings } = useAppSettings();
  const payLabel: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };

  const waMsg = () => {
    const lines = [
      `🧾 *فاتورة مبيعات - ${settings.companyName}*`,
      `رقم الفاتورة: ${invoice.invoice_no}`,
      ``,
      `*الأصناف:*`,
      ...invoice.items.map(
        (i) => `• ${i.product_name} × ${i.quantity} = ${i.total_price.toFixed(2)} ج.م`
      ),
      ``,
      `*الإجمالي: ${invoice.total_amount.toFixed(2)} ج.م*`,
      `طريقة الدفع: ${payLabel[invoice.payment_type] || invoice.payment_type}`,
      ``,
      `شكراً لتعاملكم معنا 🙏`,
    ];
    return encodeURIComponent(lines.join('\n'));
  };

  const phoneRaw = invoice.customer_phone?.replace(/\D/g, '') ?? '';
  const phone = phoneRaw.startsWith('0')
    ? '2' + phoneRaw
    : phoneRaw.startsWith('2')
      ? phoneRaw
      : '2' + phoneRaw;
  const waUrl = `https://wa.me/${phone}?text=${waMsg()}`;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F9' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="erp-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="erp-modal w-full max-w-sm text-center space-y-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.30)' }}
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h3 className="erp-title text-2xl">تم إصدار الفاتورة</h3>
          <p className="text-amber-500 font-bold text-xl mt-1">{invoice.invoice_no}</p>
          <p className="erp-text-muted text-sm mt-2">
            الإجمالي:{' '}
            <span className="erp-number text-lg">{formatCurrency(invoice.total_amount)}</span>
          </p>
          {invoice.customer_name && (
            <p className="erp-label mt-1">
              العميل: <span className="erp-text font-semibold">{invoice.customer_name}</span>
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          {/* Print receipt */}
          <button
            onClick={() => printReceipt(invoice, settings.companyName)}
            className="erp-btn-secondary w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            طباعة الفاتورة
          </button>

          {/* WhatsApp */}
          {invoice.customer_phone && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3 rounded-2xl font-bold transition-all"
              style={{
                background: 'rgba(37,211,102,0.12)',
                border: '1px solid rgba(37,211,102,0.30)',
                // eslint-disable-next-line erp/no-hardcoded-colors -- WhatsApp brand green: intentional third-party brand color
                color: '#25D366',
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              إرسال واتساب
            </a>
          )}

          <button onClick={onClose} className="erp-btn-ghost w-full py-3 rounded-2xl font-bold">
            فاتورة جديدة (Enter / F9)
          </button>
        </div>
      </div>
    </div>
  );
}
