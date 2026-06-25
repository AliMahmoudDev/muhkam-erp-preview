import type { Dispatch, SetStateAction } from 'react';
import { formatCurrency } from '@/lib/format';
import { Combobox } from '@/components/ui/combobox';
import { LEDGER_TYPE_LABELS, type CustomerLedgerData } from './hooks/useCustomerLedger';

interface DirectPayForm {
  amount: string;
  safe_id: string;
  notes: string;
}

interface LedgerTableProps {
  ledgerData: CustomerLedgerData | undefined;
  ledgerLoading: boolean;
  isSupplier: boolean;
  safes: Array<{ id: number; name: string; balance: number }>;
  showDirectPayment: boolean;
  setShowDirectPayment: Dispatch<SetStateAction<boolean>>;
  directPayForm: DirectPayForm;
  setDirectPayForm: Dispatch<SetStateAction<DirectPayForm>>;
  onDirectPaySubmit: (form: DirectPayForm) => void;
  directPayPending: boolean;
}

export function LedgerTable({
  ledgerData,
  ledgerLoading,
  isSupplier,
  safes,
  showDirectPayment,
  setShowDirectPayment,
  directPayForm,
  setDirectPayForm,
  onDirectPaySubmit,
  directPayPending,
}: LedgerTableProps) {
  return (
    <div className="space-y-4">
      {!isSupplier && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowDirectPayment((v) => !v)}
            className="erp-btn erp-btn-primary text-sm px-4 py-2"
          >
            💳 تسجيل سداد مباشر
          </button>
        </div>
      )}

      {showDirectPayment && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDirectPaySubmit(directPayForm);
          }}
          className="bg-surface rounded-2xl p-4 border border-line space-y-3"
        >
          <p className="font-bold text-ink">تسجيل سداد مباشر في دفتر الأستاذ</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink/60 mb-1 block">المبلغ (ج.م)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={directPayForm.amount}
                onChange={(e) => setDirectPayForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="text-xs text-ink/60 mb-1 block">الخزينة (اختياري)</label>
              <Combobox
                options={safes.map((s) => ({ value: String(s.id), label: s.name }))}
                value={directPayForm.safe_id}
                onChange={(v) => setDirectPayForm((f) => ({ ...f, safe_id: v }))}
                placeholder="— بدون خزينة —"
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-ink/60 mb-1 block">ملاحظات</label>
            <input
              type="text"
              value={directPayForm.notes}
              onChange={(e) => setDirectPayForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="سبب السداد..."
              className="erp-input w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={directPayPending}
              className="erp-btn erp-btn-primary flex-1"
            >
              {directPayPending ? 'جاري التسجيل...' : 'تأكيد السداد'}
            </button>
            <button
              type="button"
              onClick={() => setShowDirectPayment(false)}
              className="erp-btn flex-1"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {ledgerLoading ? (
        <div className="text-center py-8 text-ink/40">جاري تحميل دفتر الأستاذ...</div>
      ) : !ledgerData || ledgerData.entries.length === 0 ? (
        <div className="text-center py-12 text-ink/30">
          <p className="text-4xl mb-2">📒</p>
          <p>لا توجد حركات مسجلة في دفتر الأستاذ</p>
          <p className="text-xs mt-1 text-ink/20">
            ستظهر هنا الفواتير والإيصالات والمرتجعات تلقائياً
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-line">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface border-b border-line">
              <tr>
                <th className="p-3 text-ink/60 font-semibold">التاريخ</th>
                <th className="p-3 text-ink/60 font-semibold">نوع الحركة</th>
                <th className="p-3 text-ink/60 font-semibold">البيان</th>
                <th className="p-3 text-ink/60 font-semibold text-center">مدين</th>
                <th className="p-3 text-ink/60 font-semibold text-center">دائن</th>
                <th className="p-3 text-ink/60 font-semibold text-center">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData.entries.map((entry) => {
                const cfg = LEDGER_TYPE_LABELS[entry.type] ?? {
                  label: entry.type,
                  color: 'text-ink/60',
                  bg: 'bg-surface border-line',
                };
                const isDebit = entry.amount > 0;
                return (
                  <tr key={entry.id} className="border-b border-line erp-table-row">
                    <td className="p-3 text-ink/50 text-xs whitespace-nowrap">
                      {entry.date ?? '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="p-3 text-ink/60 text-xs">
                      {entry.description ?? entry.reference_no ?? '—'}
                    </td>
                    <td className="p-3 text-center font-bold text-amber-400">
                      {isDebit ? formatCurrency(entry.amount) : '—'}
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-400">
                      {!isDebit ? formatCurrency(Math.abs(entry.amount)) : '—'}
                    </td>
                    <td className="p-3 text-center font-black">
                      <span
                        className={
                          entry.balance_after > 0
                            ? 'text-amber-400'
                            : entry.balance_after < 0
                              ? 'text-blue-400'
                              : 'text-ink/40'
                        }
                      >
                        {entry.balance_after !== 0
                          ? `${formatCurrency(Math.abs(entry.balance_after))} ${entry.balance_after > 0 ? 'عليه' : 'دائن'}`
                          : 'صفر'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-surface border-t border-line">
              <tr>
                <td colSpan={3} className="p-3 text-ink/60 font-bold text-right">
                  الرصيد الحالي
                </td>
                <td className="p-3 text-center font-black text-amber-400">
                  {formatCurrency(
                    ledgerData.entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
                  )}
                </td>
                <td className="p-3 text-center font-black text-emerald-400">
                  {formatCurrency(
                    Math.abs(
                      ledgerData.entries
                        .filter((e) => e.amount < 0)
                        .reduce((s, e) => s + e.amount, 0)
                    )
                  )}
                </td>
                <td className="p-3 text-center font-black">
                  <span
                    className={
                      ledgerData.balance > 0
                        ? 'text-amber-400'
                        : ledgerData.balance < 0
                          ? 'text-blue-400'
                          : 'text-ink/40'
                    }
                  >
                    {ledgerData.balance !== 0
                      ? `${formatCurrency(Math.abs(ledgerData.balance))} ${ledgerData.balance > 0 ? 'عليه' : 'دائن'}`
                      : 'صفر'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
