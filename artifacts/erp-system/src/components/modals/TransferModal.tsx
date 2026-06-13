import { api } from '@/lib/api';
/**
 * TransferModal — تحويل بين الخزائن (مع دعم رسوم التحويل)
 * Purple theme | Calls /api/safe-transfers
 */
import { useState, useMemo } from 'react';
import { safeArray } from '@/lib/safe-data';
import { authFetch } from '@/lib/auth-fetch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeftRight, X, ArrowRight, AlertCircle } from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

type FeeType = 'none' | 'fixed' | 'percentage';

interface Props {
  onClose: () => void;
}

export default function TransferModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);

  const [form, setForm] = useState({
    from_safe_id: '',
    to_safe_id: '',
    amount: '',
    notes: '',
    date: today(),
    fee_type: 'none' as FeeType,
    fee_value: '',
  });

  const fromSafe = safes.find((s) => String(s.id) === form.from_safe_id);
  const toSafe = safes.find((s) => String(s.id) === form.to_safe_id);

  /* ── حساب الرسوم بشكل لحظي ──────────────────────────────── */
  const calc = useMemo(() => {
    const amt = parseFloat(form.amount) || 0;
    const feeVal = parseFloat(form.fee_value) || 0;
    let feeAmt = 0;
    if (form.fee_type === 'fixed') feeAmt = feeVal;
    else if (form.fee_type === 'percentage') feeAmt = (amt * feeVal) / 100;
    feeAmt = Math.max(0, Math.round(feeAmt * 100) / 100);
    const netAmt = Math.round((amt - feeAmt) * 100) / 100;
    return { amt, feeAmt, netAmt, invalid: netAmt < 0 && amt > 0 };
  }, [form.amount, form.fee_type, form.fee_value]);

  const isValid =
    !!form.from_safe_id &&
    !!form.to_safe_id &&
    form.from_safe_id !== form.to_safe_id &&
    calc.amt > 0 &&
    !calc.invalid;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['/api/safe-transfers'] });
    qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
  }

  const transferMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      authFetch(api('/api/safe-transfers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) {
          const e = await r.json();
          throw new Error(e.error || 'خطأ');
        }
        return r.json();
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: '✅ تم التحويل بنجاح' });
      onClose();
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    transferMut.mutate({
      from_safe_id: parseInt(form.from_safe_id),
      to_safe_id: parseInt(form.to_safe_id),
      amount: calc.amt,
      fee_type: form.fee_type,
      fee_rate: parseFloat(form.fee_value) || 0,
      notes: form.notes || undefined,
      date: form.date,
    });
  };

  const feeLabel = form.fee_type === 'percentage' ? 'نسبة الرسوم (%)' : 'قيمة الرسوم';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-3xl p-7 space-y-5 shadow-2xl border border-violet-500/30 bg-[var(--erp-bg-card)] max-h-[90vh] overflow-y-auto"
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 text-ink/30 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-violet-500/15 border border-violet-500/30">
            <ArrowLeftRight className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-black text-violet-400">تحويل بين الخزائن</h3>
            <p className="text-ink/30 text-xs">نقل رصيد من خزينة إلى أخرى</p>
          </div>
        </div>

        {/* Transfer visualization */}
        {(fromSafe || toSafe) && (
          <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-2xl px-4 py-3">
            <div className="flex-1 text-center">
              <p className="text-ink/40 text-xs">من</p>
              <p className="text-violet-400 font-bold text-sm">{fromSafe?.name || '—'}</p>
              {fromSafe && (
                <p className="text-ink/30 text-xs">{formatCurrency(Number(fromSafe.balance))}</p>
              )}
            </div>
            <ArrowRight className="w-5 h-5 text-violet-500 shrink-0" />
            <div className="flex-1 text-center">
              <p className="text-ink/40 text-xs">إلى</p>
              <p className="text-violet-400 font-bold text-sm">{toSafe?.name || '—'}</p>
              {toSafe && (
                <p className="text-ink/30 text-xs">{formatCurrency(Number(toSafe.balance))}</p>
              )}
            </div>
          </div>
        )}

        {/* From safe */}
        <div>
          <label className="block text-ink/50 text-xs mb-1.5 font-medium">من الخزينة *</label>
          <select
            required
            className="glass-input w-full text-sm"
            value={form.from_safe_id}
            onChange={(e) => setForm((f) => ({ ...f, from_safe_id: e.target.value }))}
          >
            <option value="">-- اختر الخزينة المُحوِّلة --</option>
            {safes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatCurrency(Number(s.balance))})
              </option>
            ))}
          </select>
        </div>

        {/* To safe */}
        <div>
          <label className="block text-ink/50 text-xs mb-1.5 font-medium">إلى الخزينة *</label>
          <select
            required
            className="glass-input w-full text-sm"
            value={form.to_safe_id}
            onChange={(e) => setForm((f) => ({ ...f, to_safe_id: e.target.value }))}
          >
            <option value="">-- اختر الخزينة المستقبِلة --</option>
            {safes
              .filter((s) => String(s.id) !== form.from_safe_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatCurrency(Number(s.balance))})
                </option>
              ))}
          </select>
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-ink/50 text-xs mb-1.5 font-medium">المبلغ (ج.م) *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              className="glass-input w-full text-sm"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-ink/50 text-xs mb-1.5 font-medium">التاريخ</label>
            <input
              type="date"
              className="glass-input w-full text-sm"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>

        {/* Fee Type */}
        <div>
          <label className="block text-ink/50 text-xs mb-1.5 font-medium">نوع الرسوم</label>
          <select
            className="glass-input w-full text-sm"
            value={form.fee_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, fee_type: e.target.value as FeeType, fee_value: '' }))
            }
          >
            <option value="none">بدون رسوم</option>
            <option value="fixed">رسوم ثابتة</option>
            <option value="percentage">رسوم نسبة</option>
          </select>
        </div>

        {/* Fee Value (conditional) */}
        {form.fee_type !== 'none' && (
          <div>
            <label className="block text-ink/50 text-xs mb-1.5 font-medium">{feeLabel}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="glass-input w-full text-sm"
              placeholder="0.00"
              value={form.fee_value}
              onChange={(e) => setForm((f) => ({ ...f, fee_value: e.target.value }))}
            />
          </div>
        )}

        {/* Live calculation */}
        {calc.amt > 0 && (
          <div
            className={`rounded-2xl border px-4 py-3 space-y-1.5 text-sm ${
              calc.invalid ? 'bg-red-500/10 border-red-500/30' : 'bg-surface border-line'
            }`}
          >
            <div className="flex justify-between">
              <span className="text-ink/40">المبلغ</span>
              <span className="text-ink font-bold">{formatCurrency(calc.amt)}</span>
            </div>
            {calc.feeAmt > 0 && (
              <div className="flex justify-between">
                <span className="text-ink/40">الرسوم</span>
                <span className="text-amber-400 font-bold">− {formatCurrency(calc.feeAmt)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5">
              <span className="text-ink/60 font-medium">الصافي المستلم</span>
              <span className={`font-black ${calc.invalid ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(calc.netAmt)}
              </span>
            </div>
            {calc.invalid && (
              <div className="flex items-center gap-2 text-red-400 text-xs pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>الرسوم أكبر من المبلغ</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-ink/50 text-xs mb-1.5 font-medium">ملاحظات</label>
          <input
            type="text"
            className="glass-input w-full text-sm"
            placeholder="اختياري..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <button
          type="submit"
          disabled={transferMut.isPending || !isValid}
          className="w-full py-3.5 rounded-2xl font-black text-sm transition-all bg-violet-500 text-ink hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
        >
          {transferMut.isPending ? 'جاري التحويل...' : 'تنفيذ التحويل'}
        </button>
      </form>
    </div>
  );
}
