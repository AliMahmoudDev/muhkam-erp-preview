import { RotateCcw, Search, X, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
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
  cm,
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
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: cm ? '420px' : '380px',
        background: 'var(--erp-bg-soft)',
        borderRight: 'none',
        borderTop: 'none',
        borderBottom: 'none',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2 shrink-0"
        style={{
          borderBottom: '1px solid var(--erp-border)',
          background: 'rgba(239,68,68,0.08)',
        }}
      >
        <RotateCcw className="w-4 h-4 text-red-400" />
        <span className="erp-subtitle text-red-400">وضع المرتجع</span>
      </div>

      {/* Invoice search */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--erp-border)' }}
      >
        <p className="erp-label text-xs mb-1.5">رقم الفاتورة / اسم العميل / رمز العميل</p>
        <div className="relative">
          <div className="flex items-center gap-2 erp-input pr-3 pl-2 py-2">
            <Search
              className={`w-4 h-4 shrink-0 transition-colors ${
                returnSearchFetching || returnFetching ? 'text-amber-500 animate-pulse' : 'text-ink/30'
              }`}
              style={{
                color: returnSearchFetching || returnFetching ? undefined : 'var(--erp-text-3)',
              }}
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
              style={{ color: 'var(--erp-text)' }}
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
                className="text-ink/30 hover:text-ink/60 shrink-0"
                style={{ color: 'var(--erp-text-3)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results dropdown */}
          {!returnSale && returnInvoiceNo && (
            <div
              className="mt-1 rounded-xl overflow-hidden max-h-52 overflow-y-auto"
              style={{
                background: 'var(--erp-bg-elevated)',
                border: '1px solid var(--erp-border)',
              }}
            >
              {returnSearchFetching ? (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-3)' }}>
                  جاري البحث…
                </div>
              ) : returnSearchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-3)' }}>
                  لا توجد نتائج
                </div>
              ) : (
                returnSearchResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectReturnInvoice(s.id)}
                    className="w-full text-right px-4 py-2.5 text-sm transition-colors hover:opacity-80 flex justify-between items-center gap-2 border-b last:border-0"
                    style={{
                      borderColor: 'var(--erp-border)',
                      background: 'transparent',
                      color: 'var(--erp-text)',
                    }}
                  >
                    <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                      <span className="font-bold text-amber-500 text-xs" dir="ltr">
                        {s.invoice_no}
                      </span>
                      <span className="text-xs truncate" style={{ color: 'var(--erp-text-2)' }}>
                        {s.customer_name || 'نقدي'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-xs font-bold" style={{ color: 'var(--erp-text)' }}>
                        {s.payment_type === 'cash'
                          ? 'نقدي'
                          : s.payment_type === 'credit'
                            ? 'آجل'
                            : 'جزئي'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--erp-text-3)' }}>
                        {s.date || '—'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {!returnInvoiceNo && (
          <p className="text-xs mt-1.5" style={{ color: 'var(--erp-text-3)' }}>
            ابحث بالرقم أو الاسم أو رمز العميل
          </p>
        )}
      </div>

      {/* Sale info + items */}
      {returnSale && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div
            className="rounded-xl p-3 space-y-1"
            style={{
              background: 'var(--erp-bg-elevated)',
              border: '1px solid var(--erp-border)',
            }}
          >
            <div className="flex justify-between">
              <span className="erp-label text-xs">الفاتورة</span>
              <span className="erp-text font-bold text-sm" dir="ltr">
                {returnSale.invoice_no}
              </span>
            </div>
            {returnSale.customer_name && (
              <div className="flex justify-between">
                <span className="erp-label text-xs">العميل</span>
                <span className="erp-text text-sm">{returnSale.customer_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="erp-label text-xs">الإجمالي</span>
              <span className="text-amber-500 font-bold text-sm">
                {formatCurrency(returnSale.total_amount)}
              </span>
            </div>
          </div>

          <p className="erp-label text-xs">الأصناف المرتجعة</p>
          {returnItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl p-3"
              style={{
                background: 'var(--erp-bg-card)',
                border: '1px solid var(--erp-border)',
              }}
            >
              <p className="erp-text text-sm font-bold mb-2">{item.product_name}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="erp-label text-xs">الكمية (max {item.max_qty})</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setReturnItems((prev) =>
                        prev.map((it, i) =>
                          i !== idx ? it : { ...it, return_qty: Math.max(0, it.return_qty - 1) }
                        )
                      )
                    }
                    className="w-7 h-7 rounded-lg flex items-center justify-center erp-btn-ghost text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="erp-number w-6 text-center">{item.return_qty}</span>
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
                    className="w-7 h-7 rounded-lg flex items-center justify-center erp-btn-ghost text-lg font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="erp-number text-sm">
                  {formatCurrency(item.return_qty * item.unit_price)}
                </span>
              </div>
            </div>
          ))}

          {/* Reason */}
          <div>
            <p className="erp-label text-xs mb-1.5">سبب المرتجع</p>
            <input
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="اختياري..."
              className="erp-input w-full text-sm"
            />
          </div>

          {/* Refund type */}
          <div>
            <p className="erp-label text-xs mb-1.5">طريقة الاسترداد</p>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'credit'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setReturnRefundType(v)}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    returnRefundType === v
                      ? v === 'cash'
                        ? 'bg-emerald-500 text-ink'
                        : 'bg-blue-500 text-ink'
                      : 'erp-btn-ghost'
                  }`}
                >
                  {v === 'cash' ? 'نقدي' : 'رصيد'}
                </button>
              ))}
            </div>
          </div>

          {/* Total + submit */}
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="erp-label text-sm">إجمالي المرتجع</span>
              <span className="text-red-400 font-black text-lg">
                {formatCurrency(
                  returnItems
                    .filter((i) => i.return_qty > 0)
                    .reduce((s, i) => s + i.return_qty * i.unit_price, 0)
                )}
              </span>
            </div>
            <button
              onClick={handleReturn}
              disabled={isPending}
              className="w-full py-3 rounded-xl font-bold text-ink transition-all"
              style={{
                background: isPending ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.85)',
              }}
            >
              {isPending ? 'جارٍ التسجيل...' : 'تأكيد المرتجع'}
            </button>
          </div>
        </div>
      )}

      {!returnSale && !returnFetching && !returnInvoiceNo && (
        <div className="erp-empty flex-1">
          <RefreshCw
            className="w-10 h-10 mx-auto mb-3 opacity-20"
            style={{ color: 'var(--erp-text-3)' }}
          />
          <p className="erp-text-muted text-sm">ابحث بالرقم أو الاسم أو رمز العميل</p>
        </div>
      )}
      {returnFetching && !returnSale && (
        <div className="erp-empty flex-1">
          <RefreshCw
            className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40"
            style={{ color: 'var(--erp-text-3)' }}
          />
          <p className="erp-text-muted text-sm">جاري تحميل الفاتورة…</p>
        </div>
      )}
    </div>
  );
}
