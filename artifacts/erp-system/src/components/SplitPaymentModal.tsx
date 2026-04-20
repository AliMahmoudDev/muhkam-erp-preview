import { useState, useMemo, useRef, useEffect } from 'react';
import { X, CheckCircle2, Coins, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export type SplitPaymentEntry = {
  type: 'cash' | 'credit';
  safe_id: number | null;
  amount: number;
};

type PaymentRow = {
  id: string;
  type: 'cash' | 'credit';
  safe_id: number | null;
  amount: string;
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

  const [rows, setRows] = useState<PaymentRow[]>(() => {
    if (canCash) {
      return [{ id: '1', type: 'cash', safe_id: firstSafeId, amount: String(total.toFixed(2)) }];
    } else if (canCredit) {
      return [{ id: '1', type: 'credit', safe_id: null, amount: String(total.toFixed(2)) }];
    }
    return [];
  });

  const lastInputRef = useRef<HTMLInputElement | null>(null);

  const allocated = useMemo(
    () => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    [rows],
  );
  const remaining = Math.round((total - allocated) * 100) / 100;
  const isBalanced = Math.abs(remaining) < 0.01;
  const isOver = remaining < -0.01;

  const addRow = (type: 'cash' | 'credit') => {
    const fillAmt = Math.max(0, remaining);
    const newRow: PaymentRow = {
      id: Date.now().toString(),
      type,
      safe_id: type === 'cash' ? firstSafeId : null,
      amount: fillAmt > 0.001 ? fillAmt.toFixed(2) : '',
    };
    setRows(prev => [...prev, newRow]);
    setTimeout(() => lastInputRef.current?.focus(), 50);
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (id: string, patch: Partial<PaymentRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const cashRows = rows.filter(r => r.type === 'cash');
  const creditRows = rows.filter(r => r.type === 'credit');

  const showCreditWarning = creditRows.length > 0 && !hasCustomer;
  const canAddCash = canCash && (!isRestricted || cashRows.length === 0);
  const canAddCredit = canCredit;

  const canConfirm =
    isBalanced &&
    !isPending &&
    rows.length > 0 &&
    rows.every(r => parseFloat(r.amount) > 0.001) &&
    !showCreditWarning;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const payments: SplitPaymentEntry[] = rows
      .filter(r => parseFloat(r.amount) > 0.001)
      .map(r => ({
        type: r.type,
        safe_id: r.type === 'cash' ? (r.safe_id ?? firstSafeId) : null,
        amount: parseFloat(r.amount) || 0,
      }));
    onConfirm(payments);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleConfirm();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const pct = Math.min(100, total > 0 ? (allocated / total) * 100 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md glass-panel sm:rounded-3xl rounded-t-3xl border border-white/15 overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(145deg, rgba(15,15,25,0.98), rgba(8,8,16,0.99))' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="font-black text-white text-base">سداد الفاتورة</h2>
            <p className="text-white/35 text-xs mt-0.5">وزّع المبلغ على طرق الدفع</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left">
              <p className="text-white/30 text-xs">الإجمالي</p>
              <p className="font-black text-amber-400 text-lg tabular-nums leading-none">
                {formatCurrency(total)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="px-5 pt-3.5 pb-2">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/35">المُوزَّع</span>
            <span
              className={`font-bold tabular-nums transition-colors ${
                isOver ? 'text-red-400' : isBalanced ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatCurrency(allocated)}
              {isBalanced ? (
                <span className="mr-1 text-emerald-400">✓</span>
              ) : (
                <span className="text-white/25 font-normal"> / {formatCurrency(total)}</span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOver ? 'bg-red-500' : isBalanced ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {remaining > 0.01 && (
            <p className="text-white/25 text-xs mt-1 text-left tabular-nums">
              متبقي: <span className="text-amber-400 font-bold">{formatCurrency(remaining)}</span>
            </p>
          )}
          {isOver && (
            <p className="text-red-400 text-xs mt-1 font-bold text-left">
              ⚠ زيادة {formatCurrency(Math.abs(remaining))} عن الإجمالي
            </p>
          )}
        </div>

        {/* ── Payment rows ── */}
        <div className="px-5 space-y-2 py-2 max-h-56 overflow-y-auto">
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            return (
              <div key={row.id} className="flex items-center gap-2">
                {/* Type badge */}
                <div
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-black border ${
                    row.type === 'cash'
                      ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
                      : 'bg-violet-500/12 text-violet-400 border-violet-500/20'
                  }`}
                >
                  {row.type === 'cash' ? (
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" /> نقدي
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> آجل
                    </span>
                  )}
                </div>

                {/* Safe selector or label */}
                {row.type === 'cash' && !isRestricted && safes.length > 1 ? (
                  <select
                    value={row.safe_id ?? ''}
                    onChange={e =>
                      updateRow(row.id, { safe_id: parseInt(e.target.value) || null })
                    }
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                  >
                    {safes.map(s => (
                      <option key={s.id} value={s.id} className="bg-slate-900">
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : row.type === 'cash' ? (
                  <span className="flex-1 text-xs text-white/40 px-1 truncate">
                    {safes.find(s => s.id === (row.safe_id ?? firstSafeId))?.name ?? '—'}
                  </span>
                ) : (
                  <span className="flex-1 text-xs text-white/30 px-1">ائتمان العميل</span>
                )}

                {/* Amount input */}
                <input
                  ref={isLast ? lastInputRef : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={e => updateRow(row.id, { amount: e.target.value })}
                  onFocus={e => e.target.select()}
                  className="w-24 shrink-0 bg-white/8 border border-white/12 rounded-xl px-2.5 py-1.5 text-white text-xs text-left tabular-nums outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-all"
                  placeholder="0.00"
                  dir="ltr"
                />

                {/* Delete */}
                {rows.length > 1 ? (
                  <button
                    onClick={() => removeRow(row.id)}
                    className="shrink-0 w-7 h-7 rounded-lg bg-red-500/8 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 flex items-center justify-center transition-colors border border-transparent hover:border-red-500/20"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <div className="w-7 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Quick-add buttons ── */}
        <div className="px-5 pt-1 pb-2 flex gap-2">
          {canAddCash && (
            <button
              onClick={() => addRow('cash')}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/18 active:scale-95 transition-all"
            >
              + خزنة نقدية
            </button>
          )}
          {canAddCredit && (
            <button
              onClick={() => addRow('credit')}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold border border-violet-500/20 bg-violet-500/8 text-violet-400 hover:bg-violet-500/18 active:scale-95 transition-all"
            >
              + آجل / ائتمان
            </button>
          )}
        </div>

        {/* ── Customer warning ── */}
        {showCreditWarning && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold">
            ⚠ يجب اختيار العميل أولاً لإتمام البيع الآجل
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex gap-2 px-5 py-4 border-t border-white/10" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold border border-white/12 text-white/50 hover:bg-white/5 hover:text-white/70 transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-[2] py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
              canConfirm
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 active:scale-95 shadow-lg shadow-amber-500/10'
                : 'bg-white/4 border border-white/8 text-white/20 cursor-not-allowed'
            }`}
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
    </div>
  );
}
