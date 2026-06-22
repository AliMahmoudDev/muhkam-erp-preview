import { Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ErrorText } from '@/components/ui/error-text';
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
    <div className="p-3 space-y-3 shrink-0 border-t border-[var(--line)] bg-[var(--raised)]">
      {/* Discount */}
      <div className="flex items-center gap-2">
        <label className="opacity-50 shrink-0 text-xs">خصم %</label>
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
          <span className="text-red-400 text-xs font-bold shrink-0">
            -{formatCurrency(discountAmt)}
          </span>
        )}
      </div>

      {/* Customer picker */}
      <PosCustomerPicker items={customerItems} value={customerId} onChange={setCustomerId} />

      {/* Totals */}
      <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
        {discountAmt > 0 && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-50">المجموع قبل الخصم</span>
              <span className="text-sm">{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-red-400">خصم {discountPct}%</span>
              <span className="text-red-400 text-sm font-bold">-{formatCurrency(discountAmt)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm">الإجمالي</span>
          <span
            className="tabular-nums font-black text-[var(--brand)]"
            style={{ fontSize: cm ? '2rem' : '1.5rem' }}
          >
            {formatCurrency(cartTotal)}
          </span>
        </div>
      </div>

      {/* Checkout error */}
      {checkoutError && <ErrorText>{checkoutError}</ErrorText>}

      {/* CHECKOUT BUTTON */}
      <button
        onClick={onCheckout}
        disabled={cartLength === 0 || isPending}
        className={`w-full rounded-2xl font-black flex items-center justify-center gap-3 transition-all ${
          cartLength === 0
            ? 'bg-[var(--surface)] border border-[var(--line)] opacity-40 cursor-not-allowed'
            : 'bg-[var(--brand)] hover:opacity-90 text-black'
        }`}
        style={{
          paddingTop: cm ? '1.125rem' : '0.875rem',
          paddingBottom: cm ? '1.125rem' : '0.875rem',
          fontSize: cm ? '1.0625rem' : '0.9375rem',
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
