import { useState, useRef, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Coins,
  Clock,
  Vault,
  CreditCard,
  ArrowLeftRight,
  CalendarRange,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Combobox } from '@/components/ui/combobox';

/* ── أنواع طرق الدفع ── */
export type PaymentMethodKey = 'cash' | 'card' | 'bank_transfer' | 'installment';

export interface PaymentMethodConfig {
  enabled: boolean;
  label: string;
  note: string;
}

export type PaymentMethodsSettings = Record<PaymentMethodKey, PaymentMethodConfig>;

export const PAYMENT_METHODS_DEFAULTS: PaymentMethodsSettings = {
  cash: { enabled: true, label: 'نقدي', note: 'دفع نقدي مباشر' },
  card: { enabled: false, label: 'شبكة / بطاقة', note: 'بطاقة ائتمان أو مدى' },
  bank_transfer: { enabled: true, label: 'تحويل بنكي', note: 'تحويل عبر البنك أو المحفظة' },
  installment: { enabled: false, label: 'تقسيط', note: 'دفع على أقساط متفق عليها' },
};

/* ── شكل إدخال الدفع ── */
export type SplitPaymentEntry = {
  type: PaymentMethodKey | 'credit';
  safe_id: number | null;
  amount: number;
};

type ConfirmedRow = SplitPaymentEntry & { id: string };
type Safe = { id: number; name: string };

const METHOD_ICONS: Record<string, React.FC<{ className?: string }>> = {
  cash: Coins,
  card: CreditCard,
  bank_transfer: ArrowLeftRight,
  installment: CalendarRange,
  credit: Clock,
};

const METHOD_COLORS: Record<string, { active: string; border: string; text: string; bg: string }> =
  {
    cash: {
      active: 'rgba(16,185,129,0.15)',
      border: 'rgba(16,185,129,0.35)',
      text: 'var(--status-success)',
      bg: 'rgba(16,185,129,0.07)',
    },
    card: {
      active: 'rgba(59,130,246,0.15)',
      border: 'rgba(59,130,246,0.35)',
      text: 'var(--status-info)',
      bg: 'rgba(59,130,246,0.07)',
    },
    bank_transfer: {
      active: 'rgba(139,92,246,0.15)',
      border: 'rgba(139,92,246,0.35)',
      text: 'var(--status-info)',
      bg: 'rgba(139,92,246,0.07)',
    },
    installment: {
      active: 'rgba(245,158,11,0.15)',
      border: 'rgba(245,158,11,0.35)',
      text: '#FCD34D',
      bg: 'rgba(245,158,11,0.07)',
    },
    credit: {
      active: 'rgba(99,102,241,0.15)',
      border: 'rgba(99,102,241,0.35)',
      text: 'var(--status-info)',
      bg: 'rgba(99,102,241,0.07)',
    },
  };

interface Props {
  total: number;
  safes: Safe[];
  defaultSafeId?: number | null;
  isRestricted?: boolean;
  canCash?: boolean;
  canCredit?: boolean;
  hasCustomer?: boolean;
  isPending?: boolean;
  onConfirm: (payments: SplitPaymentEntry[]) => void;
  onClose: () => void;
}

export function SplitPaymentModal({
  total,
  safes,
  defaultSafeId,
  isRestricted,
  canCash = true,
  canCredit = true,
  hasCustomer,
  isPending,
  onConfirm,
  onClose,
}: Props) {
  const firstSafeId = defaultSafeId ?? (safes.length > 0 ? safes[0].id : null);

  /* بناء قائمة الأزرار المتاحة */
  const availableTypes = (Object.keys(PAYMENT_METHODS_DEFAULTS) as PaymentMethodKey[])
    .filter((k) => PAYMENT_METHODS_DEFAULTS[k].enabled && (k !== 'cash' || canCash))
    .map((k) => ({
      key: k as PaymentMethodKey | 'credit',
      label: PAYMENT_METHODS_DEFAULTS[k].label,
    }));

  if (canCredit) {
    availableTypes.push({ key: 'credit', label: 'آجل' });
  }

  /* state لصف الإدخال */
  const defaultType = availableTypes[0]?.key ?? 'cash';
  const [confirmed, setConfirmed] = useState<ConfirmedRow[]>([]);
  const [activeType, setActiveType] = useState<PaymentMethodKey | 'credit'>(defaultType);
  const [activeSafe, setActiveSafe] = useState<number | null>(firstSafeId);
  const [activeAmount, setActiveAmount] = useState('');
  const [shake, setShake] = useState(false);
  const [rowKey, setRowKey] = useState(0);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 60);
  }, [rowKey]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  /* مشتقات */
  const paidSoFar = confirmed.reduce((s, r) => s + r.amount, 0);
  const remaining = Math.round((total - paidSoFar) * 100) / 100;
  const pct = Math.min(100, total > 0 ? (paidSoFar / total) * 100 : 0);
  const isDone = Math.abs(remaining) < 0.05;

  const creditRows = confirmed.filter((r) => r.type === 'credit');
  const showCreditWarning = creditRows.length > 0 && !hasCustomer;
  const canConfirm = isDone && !isPending && confirmed.length > 0 && !showCreditWarning;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const confirmRow = () => {
    const amt = parseFloat(activeAmount);
    if (!amt || amt <= 0) {
      triggerShake();
      return;
    }
    if (amt > remaining + 0.05) {
      triggerShake();
      return;
    }
    const needsSafe = activeType !== 'credit' && activeType !== 'installment';
    setConfirmed((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: activeType,
        safe_id: needsSafe ? (activeSafe ?? firstSafeId) : null,
        amount: Math.min(amt, remaining),
      },
    ]);
    setActiveAmount('');
    setActiveSafe(firstSafeId);
    setActiveType(availableTypes[0]?.key ?? 'cash');
    setRowKey((k) => k + 1);
  };

  const fillRemaining = () => setActiveAmount(remaining.toFixed(0));
  const removeConfirmed = (id: string) => setConfirmed((prev) => prev.filter((r) => r.id !== id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmRow();
    }
  };

  const handleSubmit = () => {
    if (!canConfirm) return;
    onConfirm(confirmed.map((r) => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })));
  };

  /* ملخص الإجماليات */
  const totals = confirmed.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + r.amount;
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-line overflow-hidden shadow-2xl"
        style={{ background: 'var(--erp-bg-card)' }}
      >
        <div
          style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surface hover:bg-surface border border-line flex items-center justify-center text-ink/40 hover:text-ink/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-right">
            <h2 className="font-black text-ink text-base">تسوية الدفع</h2>
            <p className="text-ink/35 text-xs mt-0.5">
              إجمالي الفاتورة:&nbsp;
              <span className="text-amber-400 font-bold tabular-nums">{formatCurrency(total)}</span>
            </p>
          </div>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.12)' }}
          >
            <Vault className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span
              className="font-bold tabular-nums transition-colors"
              style={{ color: isDone ? 'var(--status-success)' : 'var(--status-warning)' }}
            >
              {isDone ? '✓ مكتمل' : `متبقي: ${formatCurrency(remaining)}`}
            </span>
            <span className="text-ink/30">{Math.round(pct)}%</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--erp-bg-hover)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: isDone
                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                  : 'linear-gradient(90deg, #F59E0B, #FBBF24)',
              }}
            />
          </div>
        </div>

        {/* Confirmed rows */}
        {confirmed.length > 0 && (
          <div className="px-4 pb-2 space-y-1.5 max-h-44 overflow-y-auto">
            {confirmed.map((row) => {
              const c = METHOD_COLORS[row.type] ?? METHOD_COLORS.cash;
              const Icon = METHOD_ICONS[row.type] ?? Coins;
              const lbl =
                row.type === 'credit'
                  ? 'ائتمان العميل'
                  : (PAYMENT_METHODS_DEFAULTS[row.type as PaymentMethodKey]?.label ?? row.type);
              const loc = row.safe_id
                ? (safes.find((s) => s.id === row.safe_id)?.name ?? '—')
                : null;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{
                    background: c.bg,
                    border: `1px solid ${c.border.replace('0.35', '0.20')}`,
                  }}
                >
                  <button
                    onClick={() => removeConfirmed(row.id)}
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    <span className="font-bold text-sm tabular-nums text-ink">
                      {formatCurrency(row.amount)}
                    </span>
                    {loc && <span className="text-xs text-ink/35 truncate">{loc}</span>}
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1"
                      style={{ background: c.active, color: c.text }}
                    >
                      <Icon className="w-3 h-3" /> {lbl}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active entry row */}
        {!isDone && (
          <div className="px-4 pb-4">
            <div
              className={`rounded-2xl p-3 transition-all ${shake ? 'erp-shake' : ''}`}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(245,158,11,0.28)',
              }}
            >
              {/* أزرار طريقة الدفع */}
              {availableTypes.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {availableTypes.map(({ key, label }) => {
                    const c = METHOD_COLORS[key] ?? METHOD_COLORS.cash;
                    const Icon = METHOD_ICONS[key] ?? Coins;
                    const active = activeType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveType(key)}
                        className="flex-1 min-w-[80px] py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        style={{
                          background: active ? c.active : 'var(--erp-bg-hover)',
                          border: `1px solid ${active ? c.border : 'var(--erp-border)'}`,
                          color: active ? c.text : 'var(--text-hint)',
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* اختيار الخزينة + المبلغ */}
              <div className="flex gap-2 items-stretch">
                {activeType !== 'credit' &&
                activeType !== 'installment' &&
                activeType !== 'bank_transfer' ? (
                  <Combobox
                    options={safes.map((s) => ({ value: String(s.id), label: s.name }))}
                    value={activeSafe ? String(activeSafe) : ''}
                    onChange={(v) => setActiveSafe(v ? parseInt(v) : null)}
                    disabled={isRestricted}
                    className="flex-1 min-w-0 text-sm"
                  />
                ) : (
                  <div
                    className="flex-1 rounded-xl px-3 flex items-center justify-end text-sm"
                    style={{
                      background: (METHOD_COLORS[activeType] ?? METHOD_COLORS.credit).bg,
                      border: `1px solid ${(METHOD_COLORS[activeType] ?? METHOD_COLORS.credit).border.replace('0.35', '0.18')}`,
                      color: (METHOD_COLORS[activeType] ?? METHOD_COLORS.credit).text,
                    }}
                  >
                    {activeType === 'credit'
                      ? 'ائتمان العميل'
                      : activeType === 'installment'
                        ? 'يُسجَّل كأقساط'
                        : 'تحويل بنكي'}
                  </div>
                )}

                {/* حقل المبلغ */}
                <div className="relative shrink-0" style={{ width: 112 }}>
                  <input
                    key={rowKey}
                    ref={amountRef}
                    type="number"
                    min="0"
                    step="any"
                    value={activeAmount}
                    onChange={(e) => setActiveAmount(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.target.select()}
                    placeholder={remaining.toFixed(0)}
                    className="w-full rounded-xl text-center text-sm font-bold outline-none transition-colors"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(245,158,11,0.30)',
                      color: 'var(--text-1)',
                      padding: '10px 26px 10px 6px',
                    }}
                    dir="ltr"
                  />
                  <span
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: 'var(--text-hint)' }}
                  >
                    ج.م
                  </span>
                </div>
              </div>

              {/* أزرار التأكيد */}
              <div className="flex items-center justify-between mt-2.5 gap-2">
                <button
                  onClick={confirmRow}
                  className="px-4 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                    color: 'var(--text-1)',
                    boxShadow: '0 2px 10px rgba(245,158,11,0.28)',
                  }}
                >
                  Enter ↵ تأكيد
                </button>
                <button
                  onClick={fillRemaining}
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl text-left transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.18)',
                    color: 'var(--status-warning)',
                  }}
                >
                  كل المتبقي ({formatCurrency(remaining)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* تحذير الآجل بدون عميل */}
        {showCreditWarning && (
          <div
            className="mx-4 mb-3 px-3 py-2 rounded-xl text-xs font-bold"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: 'var(--status-warning)',
            }}
          >
            ⚠ يجب اختيار العميل أولاً لإتمام البيع الآجل
          </div>
        )}

        {/* ملخص */}
        <div style={{ height: 1, background: 'var(--erp-border)' }} />
        <div className="px-5 py-3 space-y-1.5">
          {[
            { label: 'إجمالي الفاتورة', val: total, color: 'var(--text-1)' },
            ...Object.entries(totals).map(([type, val]) => ({
              label:
                type === 'credit'
                  ? 'آجل'
                  : (PAYMENT_METHODS_DEFAULTS[type as PaymentMethodKey]?.label ?? type),
              val,
              color: (METHOD_COLORS[type] ?? METHOD_COLORS.cash).text,
            })),
            {
              label: 'متبقي',
              val: remaining,
              color: isDone ? 'var(--status-success)' : 'var(--status-warning)',
            },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center">
              <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>
                {formatCurrency(item.val)}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-5 py-4 border-t"
          style={{ borderColor: 'var(--erp-border)', background: 'var(--bg-elevated)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold border transition-all"
            style={{ borderColor: 'var(--erp-border)', color: 'var(--text-2)' }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canConfirm}
            className="flex-[2] py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-95"
            style={
              canConfirm
                ? {
                    background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                    color: 'var(--text-1)',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                  }
                : {
                    background: 'var(--erp-bg-hover)',
                    border: '1px solid var(--erp-border)',
                    color: 'var(--text-hint)',
                    cursor: 'not-allowed',
                  }
            }
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                جارٍ التسجيل...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الفاتورة
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes erp-shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-5px)}
          40%{transform:translateX(5px)}
          60%{transform:translateX(-3px)}
          80%{transform:translateX(3px)}
        }
        .erp-shake { animation: erp-shake 0.35s ease; }
      `}</style>
    </div>
  );
}
