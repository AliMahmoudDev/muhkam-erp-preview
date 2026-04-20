import { useState, useRef, useEffect } from 'react';
import { X, CheckCircle2, Coins, Clock, Vault } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export type SplitPaymentEntry = {
  type: 'cash' | 'credit';
  safe_id: number | null;
  amount: number;
};

type ConfirmedRow = {
  id: string;
  type: 'cash' | 'credit';
  safe_id: number | null;
  amount: number;
};

type Safe = { id: number; name: string };

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

  const [confirmed, setConfirmed] = useState<ConfirmedRow[]>([]);

  /* active-row state */
  const [activeType, setActiveType] = useState<'cash' | 'credit'>(canCash ? 'cash' : 'credit');
  const [activeSafe, setActiveSafe] = useState<number | null>(firstSafeId);
  const [activeAmount, setActiveAmount] = useState('');
  const [shake, setShake] = useState(false);
  const [rowKey, setRowKey] = useState(0);

  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 60);
  }, [rowKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  /* Derived */
  const paidSoFar = confirmed.reduce((s, r) => s + r.amount, 0);
  const remaining = Math.round((total - paidSoFar) * 100) / 100;
  const pct = Math.min(100, total > 0 ? (paidSoFar / total) * 100 : 0);
  const isDone = Math.abs(remaining) < 0.05;

  const creditRows = confirmed.filter(r => r.type === 'credit');
  const showCreditWarning = creditRows.length > 0 && !hasCustomer;
  const canConfirm = isDone && !isPending && confirmed.length > 0 && !showCreditWarning;

  /* Confirm active row */
  const confirmRow = () => {
    const amt = parseFloat(activeAmount);
    if (!amt || amt <= 0) { triggerShake(); return; }
    if (amt > remaining + 0.05) { triggerShake(); return; }

    setConfirmed(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: activeType,
        safe_id: activeType === 'cash' ? (activeSafe ?? firstSafeId) : null,
        amount: Math.min(amt, remaining),
      },
    ]);
    setActiveAmount('');
    setActiveSafe(firstSafeId);
    setActiveType(canCash ? 'cash' : 'credit');
    setRowKey(k => k + 1);
  };

  const fillRemaining = () => setActiveAmount(remaining.toFixed(0));

  const removeConfirmed = (id: string) =>
    setConfirmed(prev => prev.filter(r => r.id !== id));

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmRow(); }
  };

  const handleSubmit = () => {
    if (!canConfirm) return;
    const payments: SplitPaymentEntry[] = confirmed.map(r => ({
      type: r.type,
      safe_id: r.safe_id,
      amount: r.amount,
    }));
    onConfirm(payments);
  };

  /* Totals for summary */
  const totalCash = confirmed.filter(r => r.type === 'cash').reduce((s, r) => s + r.amount, 0);
  const totalCredit = confirmed.filter(r => r.type === 'credit').reduce((s, r) => s + r.amount, 0);

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
        {/* Amber top stripe */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }} />

        {/* ── Header ── */}
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
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.12)' }}
          >
            <Vault className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="px-5 pb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span
              className="font-bold tabular-nums transition-colors"
              style={{ color: isDone ? '#10B981' : '#F59E0B' }}
            >
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

        {/* ── Confirmed rows ── */}
        {confirmed.length > 0 && (
          <div className="px-4 pb-2 space-y-1.5 max-h-44 overflow-y-auto">
            {confirmed.map(row => (
              <div
                key={row.id}
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: row.type === 'credit'
                    ? 'rgba(99,102,241,0.08)'
                    : 'rgba(16,185,129,0.07)',
                  border: `1px solid ${row.type === 'credit' ? 'rgba(99,102,241,0.20)' : 'rgba(16,185,129,0.15)'}`,
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
                  <span className="font-bold text-sm tabular-nums text-white">
                    {formatCurrency(row.amount)}
                  </span>
                  <span className="text-xs text-white/35 truncate">
                    {row.type === 'credit'
                      ? 'ائتمان العميل'
                      : (safes.find(s => s.id === row.safe_id)?.name ?? '—')}
                  </span>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1"
                    style={{
                      background: row.type === 'credit' ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.10)',
                      color: row.type === 'credit' ? '#818CF8' : '#34D399',
                    }}
                  >
                    {row.type === 'cash'
                      ? <><Coins className="w-3 h-3" /> نقدي</>
                      : <><Clock className="w-3 h-3" /> آجل</>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Active entry row ── */}
        {!isDone && (
          <div className="px-4 pb-4">
            <div
              className={`rounded-2xl p-3 transition-all ${shake ? 'erp-shake' : ''}`}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(245,158,11,0.28)',
              }}
            >
              {/* Type toggle */}
              <div className="flex gap-1.5 mb-3">
                {canCash && (
                  <button
                    onClick={() => setActiveType('cash')}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    style={{
                      background: activeType === 'cash' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${activeType === 'cash' ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: activeType === 'cash' ? '#34D399' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    <Coins className="w-3.5 h-3.5" /> نقدي
                  </button>
                )}
                {canCredit && (
                  <button
                    onClick={() => setActiveType('credit')}
                    className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    style={{
                      background: activeType === 'credit' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${activeType === 'credit' ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`,
                      color: activeType === 'credit' ? '#818CF8' : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    <Clock className="w-3.5 h-3.5" /> آجل
                  </button>
                )}
              </div>

              {/* Dropdown + Amount */}
              <div className="flex gap-2 items-stretch">
                {/* Safe selector / credit label */}
                {activeType === 'cash' ? (
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
                      background: 'rgba(99,102,241,0.07)',
                      border: '1px solid rgba(99,102,241,0.18)',
                      color: '#818CF8',
                    }}
                  >
                    ائتمان العميل
                  </div>
                )}

                {/* Amount input */}
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
                  <span
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    ج.م
                  </span>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-between mt-2.5 gap-2">
                <button
                  onClick={confirmRow}
                  className="px-4 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                    color: '#0a0500',
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
                    color: '#F59E0B',
                  }}
                >
                  كل المتبقي ({formatCurrency(remaining)})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Credit warning ── */}
        {showCreditWarning && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
            ⚠ يجب اختيار العميل أولاً لإتمام البيع الآجل
          </div>
        )}

        {/* ── Summary ── */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
        <div className="px-5 py-3 space-y-1.5">
          {[
            { label: 'إجمالي الفاتورة', val: total, color: 'rgba(255,255,255,0.7)' },
            { label: 'نقدي', val: totalCash, color: '#34D399' },
            { label: 'آجل', val: totalCredit, color: '#818CF8' },
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

        {/* ── Footer ── */}
        <div
          className="flex gap-2 px-5 py-4 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}
        >
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
                ? {
                    background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
                    color: '#0a0500',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                  }
                : {
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.20)',
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
