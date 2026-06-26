/**
 * TrialBalanceReport — ميزان المراجعة
 * يُظهر مجموع المدين والدائن لكل حساب محاسبي مع التحقق من التوازن.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { api, authFetch, formatCurrency } from './shared';

interface TrialAccount {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

interface TrialBalanceData {
  accounts: TrialAccount[];
  summary: {
    grand_debit: number;
    grand_credit: number;
    difference: number;
    is_balanced: boolean;
  };
  period: { date_from: string | null; date_to: string | null };
  generated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'أصول',
  liability: 'التزامات',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
};

export default function TrialBalanceReport() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfYear = `${new Date().getFullYear()}-01-01`;
  const [dateFrom, setDateFrom] = useState(firstOfYear);
  const [dateTo, setDateTo] = useState(today);
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, refetch } = useQuery<TrialBalanceData>({
    queryKey: ['trial-balance', dateFrom, dateTo],
    queryFn: () =>
      authFetch(api(`/api/reports/trial-balance?date_from=${dateFrom}&date_to=${dateTo}`)).then(
        async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        }
      ),
    enabled,
    staleTime: 30_000,
  });

  const handleGenerate = () => {
    setEnabled(true);
    void refetch();
  };

  const handlePrint = () => window.print();

  const handleCsvExport = () => {
    if (!data) return;
    const rows = [
      ['كود الحساب', 'اسم الحساب', 'نوع الحساب', 'إجمالي المدين', 'إجمالي الدائن', 'الرصيد'],
      ...data.accounts.map((a) => [
        a.account_code,
        a.account_name,
        TYPE_LABELS[a.account_type] ?? a.account_type,
        Number(a.total_debit).toFixed(2),
        Number(a.total_credit).toFixed(2),
        Number(a.balance).toFixed(2),
      ]),
      [],
      [
        '',
        'الإجمالي',
        '',
        Number(data.summary.grand_debit).toFixed(2),
        Number(data.summary.grand_credit).toFixed(2),
        '',
      ],
      ['', 'الفرق', '', '', '', Number(data.summary.difference).toFixed(2)],
    ];
    const csv =
      '\uFEFF' +
      rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trial-balance-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped =
    data?.accounts.reduce<Record<string, TrialAccount[]>>((acc, item) => {
      const t = item.account_type;
      if (!acc[t]) acc[t] = [];
      acc[t].push(item);
      return acc;
    }, {}) ?? {};

  return (
    <div className="space-y-4" dir="rtl" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 bg-surface rounded-2xl p-4 border border-line no-print">
        <div className="flex flex-col gap-1">
          <label className="erp-label">من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-amber-400/50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="erp-label">إلى تاريخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-amber-400/50"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all text-sm disabled:opacity-50"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          توليد الميزان
        </button>
        {data && (
          <>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-raised text-ink rounded-xl text-sm transition-all border border-line"
            >
              <Download className="w-4 h-4" />
              طباعة
            </button>
            <button
              onClick={handleCsvExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 rounded-xl text-sm transition-all font-bold"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </button>
          </>
        )}
      </div>

      {/* Summary Bar */}
      {data && (
        <div
          className={`flex flex-wrap items-center gap-4 p-4 rounded-2xl border ${
            data.summary.is_balanced
              ? 'bg-emerald-500/8 border-emerald-500/20'
              : 'bg-red-500/8 border-red-500/25'
          }`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-sm ${data.summary.is_balanced ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {data.summary.is_balanced ? (
              <>
                <CheckCircle className="w-5 h-5" /> الميزان متوازن
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" /> الميزان غير متوازن — فرق{' '}
                {formatCurrency(data.summary.difference)}
              </>
            )}
          </div>
          <div className="flex gap-6 mr-auto text-sm">
            <span className="text-ink/50">
              إجمالي المدين:{' '}
              <span className="text-blue-300 font-bold">
                {formatCurrency(data.summary.grand_debit)}
              </span>
            </span>
            <span className="text-ink/50">
              إجمالي الدائن:{' '}
              <span className="text-amber-300 font-bold">
                {formatCurrency(data.summary.grand_credit)}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-12 rounded-xl" />
          ))}
        </div>
      )}

      {/* Accounts Table */}
      {data && !isLoading && (
        <div className="bg-surface border border-line rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface text-ink/50 text-xs">
                <th className="p-3 text-right font-semibold">كود الحساب</th>
                <th className="p-3 text-right font-semibold">اسم الحساب</th>
                <th className="p-3 text-right font-semibold">نوع الحساب</th>
                <th className="p-3 text-left font-semibold">مدين</th>
                <th className="p-3 text-left font-semibold">دائن</th>
                <th className="p-3 text-left font-semibold">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([type, accounts]) => (
                <React.Fragment key={type}>
                  <tr className="bg-surface">
                    <td colSpan={6} className="px-3 py-2">
                      <span className="text-xs font-bold text-amber-400/80">
                        {TYPE_LABELS[type] ?? type}
                      </span>
                    </td>
                  </tr>
                  {accounts.map((acc) => (
                    <tr
                      key={acc.account_id}
                      className="border-t border-line hover:bg-surface transition-colors"
                    >
                      <td className="p-3 font-mono text-xs text-ink/60">{acc.account_code}</td>
                      <td className="p-3 text-ink/90">{acc.account_name}</td>
                      <td className="p-3 text-ink/40 text-xs">
                        {TYPE_LABELS[acc.account_type] ?? acc.account_type}
                      </td>
                      <td className="p-3 text-left font-mono text-blue-300/90 text-xs">
                        {acc.total_debit > 0 ? formatCurrency(acc.total_debit) : '—'}
                      </td>
                      <td className="p-3 text-left font-mono text-amber-300/90 text-xs">
                        {acc.total_credit > 0 ? formatCurrency(acc.total_credit) : '—'}
                      </td>
                      <td
                        className={`p-3 text-left font-mono text-xs font-bold ${
                          acc.balance > 0
                            ? 'text-emerald-400'
                            : acc.balance < 0
                              ? 'text-red-400'
                              : 'text-ink/40'
                        }`}
                      >
                        {acc.balance !== 0 ? formatCurrency(Math.abs(acc.balance)) : '—'}
                        {acc.balance < 0 ? ' د' : acc.balance > 0 ? ' م' : ''}
                      </td>
                    </tr>
                  ))}
                  {/* Subtotal per type */}
                  <tr className="bg-surface border-t border-line">
                    <td colSpan={3} className="px-3 py-2 text-xs text-ink/40 text-left">
                      إجمالي {TYPE_LABELS[type] ?? type}
                    </td>
                    <td className="px-3 py-2 text-left font-mono text-xs font-bold text-blue-300">
                      {formatCurrency(accounts.reduce((s, a) => s + a.total_debit, 0))}
                    </td>
                    <td className="px-3 py-2 text-left font-mono text-xs font-bold text-amber-300">
                      {formatCurrency(accounts.reduce((s, a) => s + a.total_credit, 0))}
                    </td>
                    <td />
                  </tr>
                </React.Fragment>
              ))}
              {/* Grand Total */}
              <tr className="bg-amber-500/10 border-t-2 border-amber-500/30">
                <td colSpan={3} className="px-3 py-3 text-sm font-bold text-amber-300">
                  الإجمالي العام
                </td>
                <td className="px-3 py-3 text-left font-mono text-sm font-bold text-blue-300">
                  {formatCurrency(data.summary.grand_debit)}
                </td>
                <td className="px-3 py-3 text-left font-mono text-sm font-bold text-amber-300">
                  {formatCurrency(data.summary.grand_credit)}
                </td>
                <td
                  className={`px-3 py-3 text-left font-mono text-sm font-bold ${
                    data.summary.is_balanced ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {data.summary.is_balanced ? '✓ متوازن' : formatCurrency(data.summary.difference)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!data && !isLoading && (
        <div className="text-center py-16 text-ink/30">
          <p className="text-lg font-bold mb-1">اختر فترة وانقر «توليد الميزان»</p>
          <p className="text-sm">سيُعرض ميزان المراجعة مع إجمالي المدين والدائن لكل حساب</p>
        </div>
      )}
    </div>
  );
}
