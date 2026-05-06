import { Receipt, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { PosCustomerPicker, type CustomerPickerItem } from './PosCustomerPicker';

interface Props {
  cm: boolean;
  cartLength: number;
  cartSubtotal: number;
  cartTotal: number;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  discountAmt: number;
  customerItems: CustomerPickerItem[];
  customerId: string;
  setCustomerId: (v: string) => void;
  checkoutError: string | null;
  isPending: boolean;
  onCheckout: () => void;
}

export function PosPayment({
  cm,
  cartLength,
  cartSubtotal,
  cartTotal,
  discountPct,
  setDiscountPct,
  discountAmt,
  customerItems,
  customerId,
  setCustomerId,
  checkoutError,
  isPending,
  onCheckout,
}: Props) {
  return (
    <div
      className="erp-divider p-3 space-y-3 shrink-0"
      style={{
        borderBottom: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        background: 'var(--erp-bg-panel)',
      }}
    >
      {/* Discount */}
      <div className="flex items-center gap-2">
        <label className="erp-label shrink-0 text-xs">خصم %</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={discountPct}
          onChange={(e) => setDiscountPct(e.target.value)}
          placeholder="0"
          className="erp-input flex-1 text-center text-sm"
          style={{ padding: '0.375rem 0.5rem' }}
        />
        {discountAmt > 0 && (
          <span className="text-red-500 text-xs font-bold shrink-0">
            -{formatCurrency(discountAmt)}
          </span>
        )}
      </div>

      {/* Customer select — always visible for convenience */}
      <PosCustomerPicker items={customerItems} value={customerId} onChange={setCustomerId} />

      {/* Totals */}
      <div
        className="space-y-1.5 pt-2 erp-divider"
        style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}
      >
        {discountAmt > 0 && (
          <>
            <div className="flex justify-between items-center">
              <span className="erp-label">المجموع قبل الخصم</span>
              <span className="erp-text text-sm">{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="erp-label text-red-500">خصم {discountPct}%</span>
              <span className="text-red-500 text-sm font-bold">
                -{formatCurrency(discountAmt)}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center">
          <span className="erp-subtitle">الإجمالي</span>
          <span
            className="erp-number text-amber-500"
            style={{ fontSize: cm ? '2rem' : '1.5rem' }}
          >
            {formatCurrency(cartTotal)}
          </span>
        </div>
      </div>

      {/* Error */}
      {checkoutError && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{
            color: '#ef4444',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.20)',
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {checkoutError}
        </div>
      )}

      {/* CHECKOUT BUTTON */}
      <button
        onClick={onCheckout}
        disabled={cartLength === 0}
        className={`w-full rounded-2xl font-black flex items-center justify-center gap-3 transition-all ${
          cartLength === 0 ? 'erp-btn-disabled' : 'erp-btn-primary'
        }`}
        style={{
          paddingTop: cm ? '1.125rem' : '0.875rem',
          paddingBottom: cm ? '1.125rem' : '0.875rem',
          fontSize: cm ? '1.0625rem' : '0.9375rem',
          boxShadow:
            cartLength > 0 && !isPending
              ? '0 4px 18px rgba(245,158,11,0.30)'
              : undefined,
        }}
      >
        {isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
            جارٍ التسجيل...
          </>
        ) : (
          <>
            <Receipt className={cm ? 'w-6 h-6' : 'w-5 h-5'} />
            إصدار الفاتورة
            <kbd className="text-[11px] font-bold opacity-50 bg-black/10 px-1.5 py-0.5 rounded">
              F9
            </kbd>
          </>
        )}
      </button>
    </div>
  );
}
