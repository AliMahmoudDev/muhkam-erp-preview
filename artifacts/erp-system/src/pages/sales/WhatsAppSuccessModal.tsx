import { formatCurrency } from '@/lib/format';
import { Receipt } from 'lucide-react';
import type { SuccessInvoice } from './salesTypes';

export default function WhatsAppSuccessModal({
  invoice,
  onClose,
}: {
  invoice: SuccessInvoice;
  onClose: () => void;
}) {
  const paymentLabel: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };

  const buildWhatsAppMsg = () => {
    const lines: string[] = [
      `🧾 *فاتورة مبيعات*`,
      `رقم الفاتورة: ${invoice.invoice_no}`,
      ``,
      `*الأصناف:*`,
      ...invoice.items.map(
        (i) => `• ${i.product_name} × ${i.quantity} = ${i.total_price.toFixed(2)} ج.م`
      ),
      ``,
      `*الإجمالي: ${invoice.total_amount.toFixed(2)} ج.م*`,
    ];

    if (invoice.payments && invoice.payments.length > 1) {
      lines.push(``, `*تفاصيل الدفع:*`);
      invoice.payments.forEach((p) =>
        lines.push(`• ${p.label}: ${p.amount.toFixed(2)} ج.م`)
      );
    } else {
      lines.push(`طريقة الدفع: ${paymentLabel[invoice.payment_type] || invoice.payment_type}`);
    }

    lines.push(``, `شكراً لتعاملكم معنا 🙏`);
    return encodeURIComponent(lines.join('\n'));
  };

  const phoneRaw = invoice.customer_phone?.replace(/\D/g, '') ?? '';
  const phone = phoneRaw.startsWith('0')
    ? '2' + phoneRaw
    : phoneRaw.startsWith('2')
      ? phoneRaw
      : '2' + phoneRaw;
  const waUrl = `https://wa.me/${phone}?text=${buildWhatsAppMsg()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-sm border border-emerald-500/30 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
          <Receipt className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-black text-ink">تم إصدار الفاتورة</h3>
          <p className="text-amber-400 font-bold text-lg mt-1">{invoice.invoice_no}</p>
          <p className="text-ink/50 text-sm mt-1">
            الإجمالي:{' '}
            <span className="text-ink font-bold">{formatCurrency(invoice.total_amount)}</span>
          </p>
          {invoice.customer_name && (
            <p className="text-ink/50 text-sm">
              العميل: <span className="text-ink">{invoice.customer_name}</span>
            </p>
          )}
        </div>
        <div className="space-y-3">
          {invoice.customer_phone && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] font-bold hover:bg-[#25D366]/30 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              إرسال الفاتورة عبر واتساب
            </a>
          )}
          <button onClick={onClose} className="w-full btn-secondary py-3">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
