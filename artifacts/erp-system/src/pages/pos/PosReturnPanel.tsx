import { RotateCcw, Search, X, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import type { ReturnSale, ReturnItem } from './pos-types';

interface PosReturnPanelProps {
  cm: boolean;
  returnInvoiceNo: string;
  setReturnInvoiceNo: (v: string) => void;
  returnSearchFetching: boolean;
  returnFetching: boolean;
  returnSale: ReturnSale | null;
  setReturnSale: (s: ReturnSale | null) => void;
  returnItems: ReturnItem[];
  setReturnItems: React.Dispatch<React.SetStateAction<ReturnItem[]>>;
  returnSearchResults: ReturnSale[];
  setReturnSearchResults: (r: ReturnSale[]) => void;
  returnReason: string;
  setReturnReason: (v: string) => void;
  returnRefundType: 'cash' | 'credit';
  setReturnRefundType: (v: 'cash' | 'credit') => void;
  handleReturn: () => void;
  selectReturnInvoice: (saleId: number) => void;
  isPending: boolean;
}

export function PosReturnPanel({
  returnInvoiceNo,
  setReturnInvoiceNo,
  returnSearchFetching,
  returnFetching,
  returnSale,
  setReturnSale,
  returnItems,
  setReturnItems,
  returnSearchResults,
  setReturnSearchResults,
  returnReason,
  setReturnReason,
  returnRefundType,
  setReturnRefundType,
  handleReturn,
  selectReturnInvoice,
  isPending,
}: PosReturnPanelProps) {
  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-b border-[var(--line)] bg-red-500/10">
        <RotateCcw className="w-4 h-4 text-red-400" />
        <span className="font-bold text-sm text-red-400">وضع المرتجع</span>
      </div>

      {/* Invoice search */}
      <div className="px-4 py-3 shrink-0 border-b border-[var(--line)]">
        <p className="text-xs opacity-50 mb-1.5">رقم الفاتورة / اسم العميل / رمز العميل</p>
        <div className="relative">
          <div className="flex items-center gap-2 erp-input px-3 py-2">
            <Search
              className={`w-4 h-4 shrink-0 transition-colors ${
                returnSearchFetching || returnFetching ? 'text-[var(--brand)] animate-pulse' : 'opacity-30'
              }`}
            />
            <input
              value={returnInvoiceNo}
              onChange={(e) => {
                setReturnInvoiceNo(e.target.value);
                if (returnSale) {
                  setReturnSale(null);
                  setReturnItems([]);
                }
              }}
              placeholder="رقم الفاتورة / اسم العميل / رمز العميل..."
              className="flex-1 bg-transparent outline-none text-sm"
              dir="rtl"
            />
            {returnInvoiceNo && (
              <button
                onClick={() => {
                  setReturnInvoiceNo('');
                  setReturnSale(null);
                  setReturnItems([]);
                  setReturnSearchResults([]);
                }}
                className="opacity-30 hover:opacity-60 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {!returnSale && returnInvoiceNo && (
            <div className="mt-1 rounded-xl overflow-hidden max-h-52 overflow-y-auto bg-[var(--raised)] border border-[var(--line)]">
              {returnSearchFetching ? (
                <div className="px-4 py-3 text-xs opacity-50">جاري البحث…</div>
              ) : returnSearchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs opacity-50">لا توجد نتائج</div>
              ) : (
                returnSearchResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectReturnInvoice(s.id)}
                    className="w-full text-right px-4 py-2.5 text-sm transition-colors hover:bg-[var(--surface)] flex justify-between items-center gap-2 border-b border-[var(--line)] last:border-0"
                  >
                    <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                      <span className="font-bold text-[var(--brand)] text-xs" dir="ltr">
                        {s.invoice_no}
                      </span>
                      <span className="text-xs opacity-60 truncate">
                        {s.customer_name || 'نقدي'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-xs font-bold">
                        {s.payment_type === 'cash'
                          ? 'نقدي'
                          : s.payment_type === 'credit'
                            ? 'آجل'
                            : 'جزئي'}
                      </span>
                      <span className="text-xs opacity-50">{s.date || '—'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {!returnInvoiceNo && (
          <p className="text-xs mt-1.5 opacity-50">ابحث بالرقم أو الاسم أو رمز العميل</p>
        )}
      </div>

      {/* Sale info + items */}
      {returnSale && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Invoice summary */}
          <div className="rounded-xl p-3 space-y-1 bg-[var(--raised)] border border-[var(--line)]">
            <div className="flex justify-between">
              <span className="text-xs opacity-50">الفاتورة</span>
              <span className="font-bold text-sm" dir="ltr">{returnSale.invoice_no}</span>
            </div>
            {returnSale.customer_name && (
              <div className="flex justify-between">
                <span className="text-xs opacity-50">العميل</span>
                <span className="text-sm">{returnSale.customer_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs opacity-50">الإجمالي</span>
              <span className="text-[var(--brand)] font-bold text-sm">
                {formatCurrency(returnSale.total_amount)}
              </span>
            </div>
          </div>

          <p className="text-xs opacity-50">الأصناف المرتجعة</p>

          {returnItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl p-3 bg-[var(--surface)] border border-[var(--line)]"
            >
              <p className="text-sm font-bold mb-2">{item.product_name}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs opacity-50">الكمية (max {item.max_qty})</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setReturnItems((prev) =>
                        prev.map((it, i) =>
                          i !== idx ? it : { ...it, return_qty: Math.max(0, it.return_qty - 1) }
                        )
                      )
                    }
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="tabular-nums font-bold w-6 text-center">{item.return_qty}</span>
                  <button
                    onClick={() =>
                      setReturnItems((prev) =>
                        prev.map((it, i) =>
                          i !== idx
                            ? it
                            : { ...it, return_qty: Math.min(it.max_qty, it.return_qty + 1) }
                        )
                      )
                    }
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--surface)] hover:bg-[var(--raised)] border border-[var(--line)] text-lg font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="tabular-nums font-bold text-sm">
                  {formatCurrency(item.return_qty * item.unit_price)}
                </span>
              </div>
            </div>
          ))}

          {/* Reason */}
          <div>
            <p className="text-xs opacity-50 mb-1.5">سبب المرتجع</p>
            <input
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="اختياري..."
              className="erp-input w-full text-sm"
            />
          </div>

          {/* Refund type */}
          <div>
            <p className="text-xs opacity-50 mb-1.5">طريقة الاسترداد</p>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'credit'] as const).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={returnRefundType === v ? 'default' : 'ghost'}
                  className={
                    returnRefundType === v
                      ? v === 'cash'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-black'
                        : 'bg-blue-500 hover:bg-blue-600 text-ink'
                      : ''
                  }
                  onClick={() => setReturnRefundType(v)}
                >
                  {v === 'cash' ? 'نقدي' : 'رصيد'}
                </Button>
              ))}
            </div>
          </div>

          {/* Total + submit */}
          <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/25">
            <div className="flex justify-between items-center mb-3">
              <span className="opacity-60 text-sm">إجمالي المرتجع</span>
              <span className="text-red-400 font-black text-lg">
                {formatCurrency(
                  returnItems
                    .filter((i) => i.return_qty > 0)
                    .reduce((s, i) => s + i.return_qty * i.unit_price, 0)
                )}
              </span>
            </div>
            <Button
              className="w-full bg-red-500 hover:bg-red-600 text-ink"
              onClick={handleReturn}
              disabled={isPending}
              loading={isPending}
            >
              {isPending ? 'جارٍ التسجيل...' : 'تأكيد المرتجع'}
            </Button>
          </div>
        </div>
      )}

      {!returnSale && !returnFetching && !returnInvoiceNo && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-30">
          <RefreshCw className="w-10 h-10 mx-auto" />
          <p className="text-sm">ابحث بالرقم أو الاسم أو رمز العميل</p>
        </div>
      )}
      {returnFetching && !returnSale && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin" />
          <p className="text-sm">جاري تحميل الفاتورة…</p>
        </div>
      )}
    </div>
  );
}
