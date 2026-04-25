import { useState, useRef, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { X, CheckCircle2, Coins, Clock, Vault, CreditCard, ArrowLeftRight, CalendarRange } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
  type PaymentMethodKey,
  type PaymentMethodsSettings,
  PAYMENT_METHODS_DEFAULTS,
} from '@/pages/settings/payment-methods-tab';

/* ── شكل إدخال الدفع ── */
export type SplitPaymentEntry = {
  type:    PaymentMethodKey | 'credit';
  safe_id: number | null;
  amount:  number;
};

type ConfirmedRow = SplitPaymentEntry & { id: string };
type Safe = { id: number; name: string };

/* تحميل إعدادات طرق الدفع من السيرفر أو localStorage */
async function fetchPaymentSettings(): Promise<PaymentMethodsSettings> {
  try {
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
    const r = await authFetch(`${BASE}/api/settings/system`);
    if (!r.ok) return { ...PAYMENT_METHODS_DEFAULTS };
    const data = await r.json() as Record<string, string>;
    const raw  = data['payment_methods'];
    if (!raw) return { ...PAYMENT_METHODS_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PaymentMethodsSettings>;
    const merged: PaymentMethodsSettings = { ...PAYMENT_METHODS_DEFAULTS };
    (Object.keys(PAYMENT_METHODS_DEFAULTS) as PaymentMethodKey[]).forEach(k => {
      if (parsed[k]) merged[k] = { ...PAYMENT_METHODS_DEFAULTS[k], ...parsed[k] };
    });
    return merged;
  } catch {
    return { ...PAYMENT_METHODS_DEFAULTS };
  }
}

const METHOD_ICONS: Record<string, React.FC<{ className?: string }>> = {
  cash:          Coins,
  card:          CreditCard,
  bank_transfer: ArrowLeftRight,
  installment:   CalendarRange,
  credit:        Clock,
};

const METHOD_COLORS: Record<string, { active: string; border: string; text: string; bg: string }> = {
  cash:          { active: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)',  text: '#34D399', bg: 'rgba(16,185,129,0.07)'  },
  card:          { active: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)',  text: '#60A5FA', bg: 'rgba(59,130,246,0.07)'  },
  bank_transfer: { active: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA', bg: 'rgba(139,92,246,0.07)'  },
  installment:   { active: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)',  text: '#FCD34D', bg: 'rgba(245,158,11,0.07)'  },
  credit:        { active: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.35)',  text: '#818CF8', bg: 'rgba(99,102,241,0.07)'  },
};

interface Props {
  total:         number;
  safes:         Safe[];
  defaultSafeId?: number | null;
  isRestricted?:  boolean;
  canCash?:       boolean;
  canCredit?:     boolean;
  hasCustomer?:   boolean;
  isPending?:     boolean;
  onConfirm:     (payments: SplitPaymentEntry[]) => void;
  onClose:       () => void;
}

export function SplitPaymentModal({
  total,
  safes,
  defaultSafeId,
  isRestricted,
  canCash    = true,
  canCredit  = true,
  hasCustomer,
  isPending,
  onConfirm,
  onClose,
}: Props) {
  const firstSafeId = defaultSafeId ?? (safes.length > 0 ? safes[0].id : null);

  const [pmSettings, setPmSettings] = useState<PaymentMethodsSettings>({ ...PAYMENT_METHODS_DEFAULTS });
  const [loadingPM,  setLoadingPM]  = useState(true);

  /* تحميل الإعدادات */
  useEffect(() => {
    fetchPaymentSettings().then(s => { setPmSettings(s); setLoadingPM(false); });
  }, []);

  /* بناء قائمة الأزرار المتاحة */
  const availableTypes = (Object.keys(pmSettings) as PaymentMethodKey[])
    .filter(k => pmSettings[k].enabled && (k !== 'cash' || canCash))
    .map(k => ({ key: k as PaymentMethodKey | 'credit', label: pmSettings[k].label }));

  if (canCredit) {
    availableTypes.push({ key: 'credit', label: 'آجل' });
  }

  /* state لصف الإدخال */
  const defaultType = availableTypes[0]?.key ?? 'cash';
  const [confirmed,    setConfirmed]    = useState<ConfirmedRow[]>([]);
  const [activeType,   setActiveType]   = useState<PaymentMethodKey | 'credit'>(defaultType);
  const [activeSafe,   setActiveSafe]   = useState<number | null>(firstSafeId);
  const [activeAmount, setActiveAmount] = useState('');
  const [shake,        setShake]        = useState(false);
  const [rowKey,       setRowKey]       = useState(0);
  const amountRef = useRef<HTMLInputElement>(null);

  /* تحديث النوع الافتراضي بعد تحميل الإعدادات */
  useEffect(() => {
    if (!loadingPM) setActiveType(availableTypes[0]?.key ?? 'cash');
  }, [loadingPM, availableTypes]);

  useEffect(() => { setTimeout(() => amountRef.current?.focus(), 60); }, [rowKey]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  /* مشتقات */
  const paidSoFar = confirmed.reduce((s, r) => s + r.amount, 0);
  const remaining = Math.round((total - paidSoFar) * 100) / 100;
  const pct       = Math.min(100, total > 0 ? (paidSoFar / total) * 100 : 0);
  const isDone    = Math.abs(remaining) < 0.05;

  const creditRows        = confirmed.filter(r => r.type === 'credit');
  const showCreditWarning = creditRows.length > 0 && !hasCustomer;
  const canConfirm        = isDone && !isPending && confirmed.length > 0 && !showCreditWarning;

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 400); };

  const confirmRow = () => {
    const amt = parseFloat(activeAmount);
    if (!amt || amt <= 0)       { triggerShake(); return; }
    if (amt > remaining + 0.05) { triggerShake(); return; }
    const needsSafe = activeType !== 'credit' && activeType !== 'installment';
    setConfirmed(prev => [
      ...prev,
      {
        id:      `${Date.now()}-${Math.random()}`,
        type:    activeType,
        safe_id: needsSafe ? (activeSafe ?? firstSafeId) : null,
        amount:  Math.min(amt, remaining),
      },
    ]);
    setActiveAmount('');
    setActiveSafe(firstSafeId);
    setActiveType(availableTypes[0]?.key ?? 'cash');
    setRowKey(k => k + 1);
  };

  const fillRemaining   = () => setActiveAmount(remaining.toFixed(0));
  const removeConfirmed = (id: string) => setConfirmed(prev => prev.filter(r => r.id !== id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmRow(); }
  };

  const handleSubmit = () => {
    if (!canConfirm) return;
    onConfirm(confirmed.map(r => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })));
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
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/15 overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(145deg, rgba(15,15,25,0.99), rgba(8,8,18,0.99))' }}
      >
        <div style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-right">
            <h2 className="font-black text-white text-base">تسوية الدفع</h2>
            <p className="text-white/35 text-xs mt-0.5">
              إجمالي الفاتورة:&nbsp;
              <span className="text-amber-400 font-bold tabular-nums">{formatCurrency(total)}</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <Vault className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-bold tabular-nums transition-colors" style={{ color: isDone ? '#10B981' : '#F59E0B' }}>
              {isDone ? '✓ مكتمل' : `متبقي: ${formatCurrency(remaining)}`}
            </span>
            <span className="text-white/30">{Math.round(pct)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
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
            {confirmed.map(row => {
              const c    = METHOD_COLORS[row.type] ?? METHOD_COLORS.cash;
              const Icon = METHOD_ICONS[row.type]  ?? Coins;
              const lbl  = row.type === 'credit'
                ? 'ائتمان العميل'
                : pmSettings[row.type as PaymentMethodKey]?.label ?? row.type;
              const loc  = row.safe_id ? (safes.find(s => s.id === row.safe_id)?.name ?? '—') : null;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: c.bg, border: `1px solid ${c.border.replace('0.35', '0.20')}` }}
                >
                  <button
                    onClick={() => removeConfirmed(row.id)}
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    <span className="font-bold text-sm tabular-nums text-white">{formatCurrency(row.amount)}</span>
                    {loc && <span className="text-xs text-white/35 truncate">{loc}</span>}
                    <span className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1" style={{ background: c.active, color: c.text }}>
                      <Icon className="w-3 h-3" /> {lbl}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active entry row */}
        {!isDone && !loadingPM && (
          <div className="px-4 pb-4">
            <div
              className={`rounded-2xl p-3 transition-all ${shake ? 'erp-shake' : ''}`}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.28)' }}
            >
              {/* أزرار طريقة الدفع */}
              {availableTypes.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {availableTypes.map(({ key, label }) => {
                    const c    = METHOD_COLORS[key] ?? METHOD_COLORS.cash;
                    const Icon = METHOD_ICONS[key]  ?? Coins;
                    const active = activeType === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveType(key)}
                        className="flex-1 min-w-[80px] py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        style={{
                          background: active ? c.active : 'rgba(255,255,255,0.04)',
                          border:     `1px solid ${active ? c.border : 'rgba(255,255,255,0.08)'}`,
                          color:      active ? c.text   : 'rgba(255,255,255,0.35)',
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
                {activeType !== 'credit' && activeType !== 'installment' && activeType !== 'bank_transfer' ? (
                  <select
                    value={activeSafe ?? ''}
                    onChange={e => setActiveSafe(parseInt(e.target.value) || null)}
                    disabled={isRestricted}
                    className="flex-1 min-w-0 rounded-xl text-sm outline-none appearance-none transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: '#fff',
                      padding: '10px 12px',
                      direction: 'rtl',
                      cursor: isRestricted ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {safes.map(s => (
                      <option key={s.id} value={s.id} style={{ background: '#0f0f19', color: '#fff' }}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    className="flex-1 rounded-xl px-3 flex items-center justify-end text-sm"
                    style={{
                      background: (METHOD_COLORS[activeType] ?? METHOD_COLORS.credit).bg,
                      border:     `1px solid ${(METHOD_COLORS[activeType] ?? METHOD_COLORS.credit).border.replace('0.35','0.18')}`,
                      color:      (METHOD_COLORS[activeType] ?? METHOD_COLORS.credit).text,
                    }}
                  >
                    {activeType === 'credit'       ? 'ائتمان العميل'
                     : activeType === 'installment' ? 'يُسجَّل كأقساط'
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
                    onChange={e => setActiveAmount(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={e => e.target.select()}
                    placeholder={remaining.toFixed(0)}
                    className="w-full rounded-xl text-center text-sm font-bold outline-none transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(245,158,11,0.30)',
                      color: '#fff',
                      padding: '10px 26px 10px 6px',
                    }}
                    dir="ltr"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    ج.م
                  </span>
                </div>
              </div>

              {/* أزرار التأكيد */}
              <div className="flex items-center justify-between mt-2.5 gap-2">
                <button
                  onClick={confirmRow}
                  className="px-4 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 2px 10px rgba(245,158,11,0.28)' }}
                >
                  Enter ↵ تأكيد
                </button>
                <button
                  onClick={fillRemaining}
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl text-left transition-all hover:opacity-80"
                  style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#F59E0B' }}
                >
                  كل المتبقي ({formatCurrency(remaining)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* تحذير الآجل بدون عميل */}
        {showCreditWarning && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
            ⚠ يجب اختيار العميل أولاً لإتمام البيع الآجل
          </div>
        )}

        {/* ملخص */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div className="px-5 py-3 space-y-1.5">
          {[
            { label: 'إجمالي الفاتورة', val: total,     color: 'rgba(255,255,255,0.7)' },
            ...Object.entries(totals).map(([type, val]) => ({
              label: type === 'credit'
                ? 'آجل'
                : pmSettings[type as PaymentMethodKey]?.label ?? type,
              val,
              color: (METHOD_COLORS[type] ?? METHOD_COLORS.cash).text,
            })),
            { label: 'متبقي', val: remaining, color: isDone ? '#10B981' : '#F59E0B' },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center">
              <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>
                {formatCurrency(item.val)}
              </span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold border transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.40)' }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canConfirm}
            className="flex-[2] py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-95"
            style={
              canConfirm
                ? { background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 4px 20px rgba(245,158,11,0.35)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.20)', cursor: 'not-allowed' }
            }
          >
            {isPending ? (
              <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />جارٍ التسجيل...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" />تأكيد الفاتورة</>
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
