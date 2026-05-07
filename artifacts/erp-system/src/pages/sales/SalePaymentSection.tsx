/**
 * SalePaymentSection.tsx
 * Cart footer: customer selector, quick-customer form, discount,
 * invoice note, total box, payment rows, payment input, and
 * the checkout button.
 */
import { X, User, UserPlus, Percent, FileText, Coins, Clock, Banknote } from 'lucide-react';
import { SearchableSelect } from '@/components/searchable-select';
import { formatCurrency } from '@/lib/format';
import { CartItem, PayRow } from './salesTypes';

interface SaleCustomer {
  id: number;
  name: string;
  phone?: string | null;
  balance?: unknown;
}

interface SaleSafe {
  id: number;
  name: string;
}

interface SalePaymentSectionProps {
  cart: CartItem[];
  customerSaleItems: { value: string; label: string; searchKeys: string[] }[];
  customerId: string;
  setCustomerId: React.Dispatch<React.SetStateAction<string>>;
  selectedCustomer: SaleCustomer | undefined;
  showQuickCustomer: boolean;
  setShowQuickCustomer: React.Dispatch<React.SetStateAction<boolean>>;
  quickCustName: string;
  setQuickCustName: React.Dispatch<React.SetStateAction<string>>;
  quickCustPhone: string;
  setQuickCustPhone: React.Dispatch<React.SetStateAction<string>>;
  quickCustLoading: boolean;
  createQuickCustomer: () => Promise<void>;
  invoiceNote: string;
  setInvoiceNote: React.Dispatch<React.SetStateAction<string>>;
  discountPct: string;
  setDiscountPct: React.Dispatch<React.SetStateAction<string>>;
  discountMode: 'pct' | 'amt';
  setDiscountMode: React.Dispatch<React.SetStateAction<'pct' | 'amt'>>;
  discountAmount: number;
  cartSubtotal: number;
  cartTotal: number;
  safes: SaleSafe[];
  payRows: PayRow[];
  setPayRows: React.Dispatch<React.SetStateAction<PayRow[]>>;
  payType: 'cash' | 'credit';
  setPayType: React.Dispatch<React.SetStateAction<'cash' | 'credit'>>;
  paySafe: number | null;
  setPaySafe: React.Dispatch<React.SetStateAction<number | null>>;
  payAmount: string;
  setPayAmount: React.Dispatch<React.SetStateAction<string>>;
  payShake: boolean;
  payRowKey: number;
  payAmountRef: React.RefObject<HTMLInputElement | null>;
  isRestricted: boolean;
  payPaidSoFar: number;
  payRemaining: number;
  payPct: number;
  payIsDone: boolean;
  payCreditWarn: boolean;
  canCheckout: boolean;
  checkoutError: string | null;
  checkoutMutationPending: boolean;
  confirmPayRow: () => void;
  fillPayRemaining: () => void;
  handleCheckout: () => void;
}

export function SalePaymentSection({
  cart,
  customerSaleItems,
  customerId,
  setCustomerId,
  selectedCustomer,
  showQuickCustomer,
  setShowQuickCustomer,
  quickCustName,
  setQuickCustName,
  quickCustPhone,
  setQuickCustPhone,
  quickCustLoading,
  createQuickCustomer,
  invoiceNote,
  setInvoiceNote,
  discountPct,
  setDiscountPct,
  discountMode,
  setDiscountMode,
  discountAmount,
  cartSubtotal,
  cartTotal,
  safes,
  payRows,
  setPayRows,
  payType,
  setPayType,
  paySafe,
  setPaySafe,
  payAmount,
  setPayAmount,
  payShake,
  payRowKey,
  payAmountRef,
  isRestricted,
  payPaidSoFar,
  payRemaining,
  payPct,
  payIsDone,
  payCreditWarn,
  canCheckout,
  checkoutError,
  checkoutMutationPending,
  confirmPayRow,
  fillPayRemaining,
  handleCheckout,
}: SalePaymentSectionProps) {
  return (
    <div className="sale-cart-footer p-3 space-y-2 shrink-0">
      {/* ─── العميل ─── */}
      <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
        <User className="w-3.5 h-3.5 sale-muted-text shrink-0" />
        <span className="sale-label-text text-xs shrink-0">العميل</span>
        <SearchableSelect
          items={customerSaleItems}
          value={customerId}
          onChange={setCustomerId}
          placeholder="ابحث باسم أو كود..."
          emptyLabel="عميل نقدي"
          className="w-full min-w-0"
          inputClassName="bg-transparent text-xs"
        />
        <button
          onClick={() => setShowQuickCustomer(true)}
          title="عميل جديد"
          className="shrink-0 sale-muted-text hover:text-emerald-400 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {showQuickCustomer && (
        <div className="sale-field-row rounded-xl px-3 py-2.5 space-y-2 border border-emerald-500/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <UserPlus className="w-3 h-3" />
              عميل جديد
            </span>
            <button
              onClick={() => {
                setShowQuickCustomer(false);
                setQuickCustName('');
                setQuickCustPhone('');
              }}
              className="sale-muted-text hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="اسم العميل *"
            autoFocus
            className="w-full bg-transparent text-xs sale-text-primary placeholder:opacity-40 outline-none border-b sale-border pb-1"
            value={quickCustName}
            onChange={(e) => setQuickCustName(e.target.value)}
          />
          <input
            type="text"
            placeholder="رقم الهاتف (اختياري)"
            className="w-full bg-transparent text-xs sale-text-primary placeholder:opacity-40 outline-none border-b sale-border pb-1"
            value={quickCustPhone}
            onChange={(e) => setQuickCustPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createQuickCustomer();
            }}
          />
          <button
            onClick={createQuickCustomer}
            disabled={quickCustLoading || !quickCustName.trim()}
            className="w-full text-xs font-black py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
          >
            {quickCustLoading ? 'جارٍ الإضافة...' : '+ إضافة العميل'}
          </button>
        </div>
      )}

      {selectedCustomer && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${
            Number(selectedCustomer.balance) > 0
              ? 'bg-red-500/10 border border-red-500/20'
              : Number(selectedCustomer.balance) < 0
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'sale-field-row'
          }`}
        >
          <span className="sale-muted-text">رصيد العميل</span>
          <span
            className={
              Number(selectedCustomer.balance) > 0
                ? 'text-red-400'
                : Number(selectedCustomer.balance) < 0
                  ? 'text-emerald-400'
                  : 'sale-muted-text'
            }
          >
            {Number(selectedCustomer.balance) === 0
              ? 'متسوّى ✓'
              : Number(selectedCustomer.balance) > 0
                ? `دين: ${formatCurrency(Number(selectedCustomer.balance))}`
                : `له: ${formatCurrency(Math.abs(Number(selectedCustomer.balance)))}`}
          </span>
        </div>
      )}

      {selectedCustomer?.phone && (
        <div className="text-xs text-[#25D366] flex items-center gap-1 px-1">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          {selectedCustomer.phone}
        </div>
      )}

      {/* ─── خصم الفاتورة ─── */}
      <div className="sale-field-row flex items-center gap-1.5 rounded-xl px-3 py-2">
        <Percent className="w-3 h-3 sale-muted-text shrink-0" />
        <span className="sale-label-text text-xs shrink-0">خصم الفاتورة</span>
        <input
          type="number"
          min="0"
          step="1"
          placeholder="0"
          className="bg-transparent outline-none flex-1 text-xs sale-text-primary placeholder:opacity-25"
          value={discountPct}
          onChange={(e) => setDiscountPct(e.target.value)}
        />
        <button
          onClick={() => {
            setDiscountMode((m) => (m === 'pct' ? 'amt' : 'pct'));
            setDiscountPct('');
          }}
          className="text-xs font-black sale-muted-text hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 shrink-0"
          title="تبديل بين % ومبلغ"
        >
          {discountMode === 'pct' ? '%' : 'ج'}
        </button>
        {discountAmount > 0 && (
          <span className="text-red-400 text-xs font-bold shrink-0">
            -{formatCurrency(discountAmount)}
          </span>
        )}
      </div>

      {/* ─── ملاحظات ─── */}
      <div className="sale-field-row flex items-center gap-1.5 rounded-xl px-3 py-2">
        <FileText className="w-3 h-3 sale-muted-text shrink-0" />
        <span className="sale-label-text text-xs shrink-0">ملاحظات</span>
        <input
          type="text"
          placeholder="ملاحظة على الفاتورة..."
          className="bg-transparent outline-none flex-1 text-xs sale-text-primary placeholder:opacity-25"
          value={invoiceNote}
          onChange={(e) => setInvoiceNote(e.target.value)}
        />
        {invoiceNote && (
          <button
            onClick={() => setInvoiceNote('')}
            className="shrink-0 sale-muted-text hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ─── إجمالي الفاتورة ─── */}
      <div className="sale-total-box rounded-2xl px-4 py-3 flex items-center justify-between">
        {discountAmount > 0 ? (
          <div className="text-left">
            <p className="text-[10px] sale-muted-text line-through tabular-nums">
              {formatCurrency(cartSubtotal)}
            </p>
            <p className="text-[10px] sale-label-text">
              {discountMode === 'pct'
                ? `بعد خصم ${discountPct}%`
                : `بعد خصم ${formatCurrency(discountAmount)}`}
            </p>
          </div>
        ) : (
          <span className="text-xs sale-label-text font-medium">إجمالي الفاتورة</span>
        )}
        <span
          className="font-black sale-text-primary tabular-nums"
          style={{ fontSize: '1.5rem', letterSpacing: '-0.5px', lineHeight: 1 }}
        >
          {formatCurrency(cartTotal)}
        </span>
      </div>

      {/* ─── قسم الدفع ─── */}
      <div className="sale-pay-box rounded-2xl overflow-hidden">
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span
              className="font-bold tabular-nums transition-colors"
              style={{
                color: payIsDone ? '#10B981' : cart.length === 0 ? '#94A3B8' : '#F59E0B',
              }}
            >
              {payIsDone
                ? '✓ مكتمل'
                : cart.length === 0
                  ? 'أضف منتجاً للبدء'
                  : payPaidSoFar > 0 // eslint-disable-line no-constant-binary-expression
                    ? `متبقي: ${formatCurrency(payRemaining)}`
                    : 'اختر طريقة الدفع'}
            </span>
            <span className="sale-muted-text">{Math.round(payPct)}%</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--erp-bg-hover)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${payPct}%`,
                background: payIsDone
                  ? 'linear-gradient(90deg,#10B981,#34D399)'
                  : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
              }}
            />
          </div>
        </div>

        {payRows.length > 0 && (
          <div className="px-2 pb-2 space-y-1">
            {payRows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 ${row.type === 'credit' ? 'sale-pay-row-credit' : 'sale-pay-row-cash'}`}
              >
                <button
                  onClick={() => setPayRows((prev) => prev.filter((r) => r.id !== row.id))}
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                  style={{ background: 'rgba(239,68,68,0.08)' }}
                >
                  <X className="w-3 h-3" />
                </button>
                <span
                  className={`text-xs shrink-0 flex items-center gap-1 ${row.type === 'credit' ? 'text-indigo-400' : 'text-emerald-400'}`}
                >
                  {row.type === 'cash' ? (
                    <Coins className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                  {row.type === 'cash'
                    ? (safes.find((s) => s.id === row.safe_id)?.name ?? '—')
                    : 'ائتمان'}
                </span>
                <span className="sale-text-primary font-black text-sm tabular-nums mr-auto">
                  {formatCurrency(row.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!payIsDone && (
          <div className={`px-2 pb-2.5 ${payShake ? 'erp-shake' : ''}`}>
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => setPayType('cash')}
                className={`sale-pay-btn flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${payType === 'cash' ? 'sale-pay-btn-cash-active' : 'sale-pay-btn-inactive'}`}
              >
                <Coins className="w-3 h-3" /> نقدي
              </button>
              <button
                onClick={() => setPayType('credit')}
                className={`sale-pay-btn flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${payType === 'credit' ? 'sale-pay-btn-credit-active' : 'sale-pay-btn-inactive'}`}
              >
                <Clock className="w-3 h-3" /> آجل
              </button>
            </div>

            <div className="flex gap-1.5 items-stretch mb-1.5">
              {payType === 'cash' ? (
                <select
                  value={paySafe ?? ''}
                  onChange={(e) => setPaySafe(parseInt(e.target.value) || null)}
                  disabled={isRestricted}
                  className="sale-pay-safe flex-1 min-w-0"
                  style={{ cursor: isRestricted ? 'not-allowed' : 'pointer' }}
                >
                  {safes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="sale-pay-credit-ph flex-1 flex items-center justify-end text-xs">
                  ائتمان العميل
                </div>
              )}
              <div className="relative shrink-0" style={{ width: 94 }}>
                <input
                  key={payRowKey}
                  ref={payAmountRef}
                  type="number"
                  min="0"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmPayRow();
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder={cart.length > 0 ? payRemaining.toFixed(0) : '0'}
                  disabled={cart.length === 0}
                  className="sale-pay-amount disabled:opacity-40"
                  dir="ltr"
                />
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none sale-muted-text">
                  ج.م
                </span>
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={confirmPayRow}
                disabled={cart.length === 0}
                className="sale-pay-confirm shrink-0"
              >
                ↵ تأكيد
              </button>
              <button
                onClick={fillPayRemaining}
                disabled={cart.length === 0}
                className="sale-pay-fill"
              >
                كل المتبقي {cart.length > 0 ? `(${formatCurrency(payRemaining)})` : ''}
              </button>
            </div>
          </div>
        )}

        {payCreditWarn && (
          <div
            className="mx-2 mb-2 px-3 py-2 rounded-xl text-xs font-bold"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#F59E0B',
            }}
          >
            ⚠ اختر العميل أولاً للبيع الآجل
          </div>
        )}
      </div>

      {checkoutError && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
          <p className="text-red-400 text-xs font-bold">❌ فشل التسجيل</p>
          <p className="text-red-300/70 text-xs mt-0.5">{checkoutError}</p>
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={!canCheckout}
        className="w-full py-3.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{
          background: canCheckout
            ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
            : undefined,
          color: canCheckout ? '#000' : undefined,
          boxShadow: canCheckout
            ? '0 6px 22px rgba(245,158,11,0.38), 0 1px 3px rgba(0,0,0,0.2)'
            : 'none',
          border: canCheckout ? 'none' : '1px solid rgba(255,255,255,0.08)',
          opacity: canCheckout ? 1 : 0.42,
        }}
      >
        {checkoutMutationPending ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />{' '}
            جارٍ التسجيل...
          </>
        ) : (
          <>
            <Banknote className="w-4 h-4" /> إتمام البيع{' '}
            <kbd className="text-[10px] font-bold opacity-60 bg-black/10 px-1.5 py-0.5 rounded">
              F9
            </kbd>
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-4 text-[11px] sale-muted-text opacity-40 pb-0.5">
        <span>⌨ Ctrl+S حفظ</span>
        <span>·</span>
        <span>Enter إضافة</span>
      </div>
    </div>
  );
}
