import { X, Search, Receipt } from 'lucide-react';
import type { InvoiceSummary } from '../salesTypes';

interface InvoiceSearchModalProps {
  invoiceSearch: string;
  setInvoiceSearch: (v: string) => void;
  filteredSales: InvoiceSummary[];
  salesFetching: boolean;
  onSelectInvoice: (sale: InvoiceSummary) => void;
  onClose: () => void;
}

function ptLabel(pt: string) {
  return pt === 'cash'
    ? { label: 'نقدي', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
    : pt === 'credit'
      ? { label: 'آجل', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
      : { label: 'جزئي', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
}

export function InvoiceSearchModal({
  invoiceSearch,
  setInvoiceSearch,
  filteredSales,
  salesFetching,
  onSelectInvoice,
  onClose,
}: InvoiceSearchModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white">اختر الفاتورة المراد إرجاعها</h3>
            <p className="text-white/40 text-xs mt-0.5">ابحث بالرقم أو اسم العميل</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
        <div className="p-4 border-b border-white/10 shrink-0">
          <div className="relative">
            <Search
              className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${salesFetching ? 'text-amber-400 animate-pulse' : 'text-white/30'}`}
            />
            <input
              autoFocus
              type="text"
              className="glass-input icon-pr w-full"
              placeholder="رقم الفاتورة / اسم العميل / رمز العميل..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
            {invoiceSearch && (
              <button
                onClick={() => setInvoiceSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!invoiceSearch && (
            <p className="text-white/30 text-xs mt-2 text-center">
              آخر 40 فاتورة — ابحث للعثور على المزيد
            </p>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {salesFetching && filteredSales.length === 0 ? (
            <div className="p-10 text-center text-white/40">جاري البحث…</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-10 text-center text-white/40">لا توجد نتائج</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  <th className="p-3 text-white/50 font-medium">رقم الفاتورة</th>
                  <th className="p-3 text-white/50 font-medium">العميل</th>
                  <th className="p-3 text-white/50 font-medium">نوع الدفع</th>
                  <th className="p-3 text-white/50 font-medium">التاريخ</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const pt = ptLabel(sale.payment_type);
                  return (
                    <tr
                      key={sale.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => onSelectInvoice(sale)}
                    >
                      <td className="p-3 font-mono font-bold text-amber-400">{sale.invoice_no}</td>
                      <td className="p-3 text-white">
                        {sale.customer_name || <span className="text-white/30">نقدي</span>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${pt.cls}`}>
                          {pt.label}
                        </span>
                      </td>
                      <td className="p-3 text-white/40 text-xs">{sale.date || '—'}</td>
                      <td className="p-3">
                        <button className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
