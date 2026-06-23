import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { Plus, Banknote, X } from 'lucide-react';
import type { AnyRec } from './types';

function fmt(v: unknown) {
  return v != null ? Number(Number(v).toFixed(2)).toLocaleString('ar-EG-u-nu-latn') : '0';
}

const LEDGER_TYPE_AR: Record<string, { label: string; color: string }> = {
  commission_earned: { label: 'عمولة محققة', color: 'text-emerald-300' },
  payout: { label: 'صرف', color: 'text-red-300' },
  reversal: { label: 'استرداد', color: 'text-orange-300' },
  bonus: { label: 'حافز', color: 'text-amber-300' },
  adjustment: { label: 'تعديل', color: 'text-blue-300' },
  incentive: { label: 'إنسنتف', color: 'text-teal-300' },
};


export function CommissionLedgerSection({
  employeeId,
  canManage,
}: {
  employeeId: number;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CommissionLedgerData>({
    queryKey: ['/api/employees', employeeId, 'commission-ledger'],
    queryFn: async () => {
      const r = await authFetch(`/api/employees/${employeeId}/commission-ledger`);
      if (!r.ok) throw new Error('failed');
      return r.json() as Promise<CommissionLedgerData>;
    },
    enabled: !!employeeId,
  });

  const openModal = () => {
    setShowModal(true);
    setPayoutError(null);
    setPayoutAmount('');
    setPayoutNotes('');
  };
  const closeModal = () => setShowModal(false);

  const handlePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayoutError('أدخل مبلغاً صحيحاً أكبر من صفر');
      return;
    }
    if (data && amount > data.balance + 0.01) {
      setPayoutError(`يتجاوز الرصيد المتاح (${fmt(data.balance)})`);
      return;
    }
    setPayoutLoading(true);
    setPayoutError(null);
    try {
      const r = await authFetch(`/api/employees/${employeeId}/commission-ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: 'payout',
          amount,
          date: new Date().toISOString().split('T')[0],
          notes: payoutNotes || undefined,
          description: 'صرف عمولة',
        }),
      });
      if (!r.ok) {
        const err = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(String(err['error'] ?? 'فشل الحفظ'));
      }
      await qc.invalidateQueries({ queryKey: ['/api/employees', employeeId, 'commission-ledger'] });
      closeModal();
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : 'خطأ غير متوقع');
    } finally {
      setPayoutLoading(false);
    }
  };

  if (isLoading) return <div className="h-16 rounded-xl bg-surface animate-pulse mt-2" />;
  if (!data) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-line mt-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink/50">العمولات والصرف</p>
        {canManage && data.balance > 0 && (
          <button
            onClick={openModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            <Banknote size={11} />
            اعتماد وصرف
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { label: 'إجمالي المحققة', value: fmt(data.total_earned), color: 'text-emerald-300' },
            { label: 'إجمالي المصروف', value: fmt(data.total_paid), color: 'text-red-300' },
            {
              label: 'الرصيد المستحق',
              value: fmt(data.balance),
              color: data.balance > 0 ? 'text-amber-300' : 'text-ink/40',
            },
          ] as const
        ).map((c) => (
          <div key={c.label} className="bg-surface border border-line rounded-xl p-2.5 text-center">
            <div className={`text-sm font-bold font-mono ${c.color}`}>{c.value}</div>
            <div className="text-[10px] text-ink/35 mt-0.5 leading-tight">{c.label}</div>
          </div>
        ))}
      </div>

      {data.entries.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[10px]">
            <thead className="bg-surface text-ink/40">
              <tr>
                {['التاريخ', 'النوع', 'المبلغ', 'المرجع', 'البيان'].map((h) => (
                  <th
                    key={h}
                    className="text-right px-2 py-2 font-semibold whitespace-nowrap border-b border-line"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => {
                const ti = LEDGER_TYPE_AR[e.entry_type] ?? {
                  label: e.entry_type,
                  color: 'text-ink/60',
                };
                const isDebit = e.amount < 0;
                return (
                  <tr key={e.id} className="border-t border-line hover:bg-surface">
                    <td className="px-2 py-1.5 font-mono text-ink/40 whitespace-nowrap">
                      {e.date}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[9px] font-semibold ${ti.color}`}>{ti.label}</span>
                    </td>
                    <td
                      className={`px-2 py-1.5 font-mono font-semibold whitespace-nowrap ${isDebit ? 'text-red-300' : 'text-emerald-300'}`}
                    >
                      {isDebit ? '−' : '+'}
                      {fmt(Math.abs(e.amount))}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-amber-300/70 whitespace-nowrap">
                      {e.reference_no ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-ink/50 max-w-[100px] truncate">
                      {e.description ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-ink/30 text-center py-4 bg-surface rounded-xl border border-line">
          لا توجد حركات بعد
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-surface border border-line rounded-2xl p-5 w-80 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">اعتماد وصرف العمولة</h3>
              <button onClick={closeModal} className="text-ink/40 hover:text-ink/70">
                <X size={16} />
              </button>
            </div>
            <div className="bg-surface rounded-xl p-3 text-center">
              <div className="text-[10px] text-ink/40 mb-0.5">الرصيد المتاح</div>
              <div className="text-xl font-bold font-mono text-amber-300">{fmt(data.balance)}</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-ink/50 block mb-1">المبلغ المراد صرفه</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => {
                    setPayoutAmount(e.target.value);
                    setPayoutError(null);
                  }}
                  placeholder={`الحد الأقصى ${fmt(data.balance)}`}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-white/25 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink/50 block mb-1">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="سبب الصرف…"
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-white/25 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              {payoutError && (
                <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {payoutError}
                </div>
              )}
              <button
                onClick={handlePayout}
                disabled={payoutLoading || !payoutAmount}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {payoutLoading ? 'جارٍ الحفظ…' : 'تأكيد الصرف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
