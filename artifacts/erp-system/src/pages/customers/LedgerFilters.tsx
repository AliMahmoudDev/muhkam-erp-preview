import { formatCurrency } from '@/lib/format';
import {
  TX_TYPE_CONFIG,
  REPORT_TYPE_MAP,
  type TxRow,
  type ReportData,
  type ReportStmtRow,
} from './hooks/useCustomerLedger';

interface LedgerFiltersProps {
  activeTab: string;
  setActiveTab: (tab: 'statement' | 'ledger' | 'report') => void;
  rowsWithBalance: TxRow[];
  isSupplier: boolean;
  customerBalance: number;
  reportFrom: string;
  setReportFrom: (v: string) => void;
  reportTo: string;
  setReportTo: (v: string) => void;
  reportData: ReportData | undefined;
  reportLoading: boolean;
  reportStmt: ReportStmtRow[];
}

export function LedgerFilters({
  activeTab,
  setActiveTab,
  rowsWithBalance,
  isSupplier,
  customerBalance,
  reportFrom,
  setReportFrom,
  reportTo,
  setReportTo,
  reportData,
  reportLoading,
  reportStmt,
}: LedgerFiltersProps) {
  return (
    <>
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ledger' ? 'bg-violet-600 text-ink' : 'text-ink/50 hover:text-ink'}`}
        >
          📒 دفتر الأستاذ
        </button>
        <button
          onClick={() => setActiveTab('statement')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'statement' ? 'bg-violet-600 text-ink' : 'text-ink/50 hover:text-ink'}`}
        >
          📋 كشف تفصيلي
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'report' ? 'bg-amber-500 text-black' : 'text-ink/50 hover:text-ink'}`}
        >
          📊 تقرير بالفترة
        </button>
      </div>

      {activeTab === 'statement' && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(TX_TYPE_CONFIG).map(([key, cfg]) => (
              <span key={key} className={`px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}{' '}
                {key === 'sale'
                  ? 'مبيعات'
                  : key === 'purchase'
                    ? 'مشتريات'
                    : key === 'receipt'
                      ? 'قبض'
                      : key === 'payment'
                        ? 'توريد'
                        : key === 'supplier_payment'
                          ? 'تسديد دفعة'
                          : key === 'purchase_return'
                            ? 'مرتجع مشتريات'
                            : key === 'return_credit'
                              ? 'مرتجع مبيعات'
                              : 'مرتجع نقدي'}
              </span>
            ))}
          </div>
          {rowsWithBalance.length === 0 ? (
            <div className="text-center py-12 text-ink/30">لا توجد حركات مسجلة لهذا العميل</div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-line">
              <table className="w-full text-right text-sm">
                <thead className="bg-surface border-b border-line">
                  <tr>
                    <th className="p-3 text-ink/60 font-semibold">التاريخ</th>
                    <th className="p-3 text-ink/60 font-semibold">البيان</th>
                    <th className="p-3 text-ink/60 font-semibold">المرجع</th>
                    <th className="p-3 text-ink/60 font-semibold text-center">مدين</th>
                    <th className="p-3 text-ink/60 font-semibold text-center">دائن</th>
                    <th className="p-3 text-ink/60 font-semibold text-center">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithBalance.map((r, i) => {
                    const cfg = TX_TYPE_CONFIG[r.type] || TX_TYPE_CONFIG['sale'];
                    return (
                      <tr
                        key={`${r.type}-${r.ref ?? ''}-${i}`}
                        className="border-b border-line erp-table-row"
                      >
                        <td className="p-3 text-ink/50 text-xs whitespace-nowrap">
                          {r.date ? r.date.split('T')[0] : '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.color}`}
                          >
                            {cfg.icon} {r.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-ink/60 text-xs">{r.ref}</td>
                        <td className="p-3 text-center font-bold text-amber-400">
                          {r.debit > 0 ? formatCurrency(r.debit) : '—'}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-400">
                          {r.credit > 0 ? formatCurrency(r.credit) : '—'}
                        </td>
                        <td className="p-3 text-center font-black">
                          {isSupplier ? (
                            <span
                              className={
                                r.balance > 0
                                  ? 'text-green-400'
                                  : r.balance < 0
                                    ? 'text-red-400'
                                    : 'text-ink/40'
                              }
                            >
                              {r.balance !== 0
                                ? `${formatCurrency(Math.abs(r.balance))} ${r.balance > 0 ? 'عليه لنا' : 'له علينا'}`
                                : 'صفر'}
                            </span>
                          ) : (
                            <span
                              className={
                                r.balance > 0
                                  ? 'text-yellow-400'
                                  : r.balance < 0
                                    ? 'text-blue-400'
                                    : 'text-ink/40'
                              }
                            >
                              {r.balance !== 0
                                ? `${formatCurrency(Math.abs(r.balance))} ${r.balance > 0 ? 'عليه' : 'دائن'}`
                                : 'صفر'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-surface border-t border-line">
                  <tr>
                    <td colSpan={3} className="p-3 text-ink/60 font-bold text-right">
                      الإجمالي
                    </td>
                    <td className="p-3 text-center font-black text-amber-400">
                      {formatCurrency(rowsWithBalance.reduce((s, r) => s + r.debit, 0))}
                    </td>
                    <td className="p-3 text-center font-black text-emerald-400">
                      {formatCurrency(rowsWithBalance.reduce((s, r) => s + r.credit, 0))}
                    </td>
                    <td className="p-3 text-center font-black">
                      {isSupplier ? (
                        <span
                          className={
                            customerBalance > 0
                              ? 'text-green-400'
                              : customerBalance < 0
                                ? 'text-red-400'
                                : 'text-ink/40'
                          }
                        >
                          {formatCurrency(Math.abs(customerBalance))}{' '}
                          {customerBalance > 0 ? 'عليه لنا' : customerBalance < 0 ? 'له علينا' : ''}
                        </span>
                      ) : (
                        <span
                          className={
                            customerBalance > 0
                              ? 'text-yellow-400'
                              : customerBalance < 0
                                ? 'text-blue-400'
                                : 'text-ink/40'
                          }
                        >
                          {formatCurrency(Math.abs(customerBalance))}{' '}
                          {customerBalance > 0 ? 'عليه' : customerBalance < 0 ? 'دائن' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink/40 text-xs font-bold">من</span>
            <input
              type="date"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
              className="glass-input rounded-xl px-3 py-1.5 text-sm text-ink"
            />
            <span className="text-ink/40 text-xs font-bold">إلى</span>
            <input
              type="date"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
              className="glass-input rounded-xl px-3 py-1.5 text-sm text-ink"
            />
          </div>

          {reportData && (
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-panel rounded-2xl p-4 border border-line">
                <p className="text-ink/40 text-xs mb-1">رصيد أول المدة</p>
                <p
                  className={`text-lg font-black ${reportData.opening_balance >= 0 ? 'text-amber-400' : 'text-red-400'}`}
                >
                  {formatCurrency(reportData.opening_balance)}
                </p>
              </div>
              <div className="glass-panel rounded-2xl p-4 border border-line">
                <p className="text-ink/40 text-xs mb-1">رصيد الختام</p>
                <p
                  className={`text-lg font-black ${reportData.closing_balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatCurrency(reportData.closing_balance)}
                </p>
              </div>
              <div className="glass-panel rounded-2xl p-4 border border-line">
                <p className="text-ink/40 text-xs mb-1">الرصيد الفعلي (الدفتر)</p>
                <p
                  className={`text-lg font-black ${reportData.customer.balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}
                >
                  {formatCurrency(reportData.customer.balance)}
                </p>
              </div>
            </div>
          )}

          <div className="glass-panel rounded-2xl overflow-hidden border border-line">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm whitespace-nowrap">
                <thead className="bg-surface border-b border-line">
                  <tr>
                    <th className="p-3 text-ink/50">التاريخ</th>
                    <th className="p-3 text-ink/50">النوع</th>
                    <th className="p-3 text-ink/50">البيان</th>
                    <th className="p-3 text-ink/50">مدين (له)</th>
                    <th className="p-3 text-ink/50">دائن (عليه)</th>
                    <th className="p-3 text-ink/50">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-ink/40 text-xs">
                        جاري التحميل...
                      </td>
                    </tr>
                  ) : reportStmt.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-ink/40">
                        لا توجد حركات في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    reportStmt.map((row, i) => {
                      const meta = REPORT_TYPE_MAP[row.type] ?? {
                        label: row.type,
                        cls: 'text-ink/50',
                      };
                      return (
                        <tr
                          key={`${row.date ?? ''}-${row.type}-${row.reference_no ?? ''}-${i}`}
                          className="border-b border-line erp-table-row"
                        >
                          <td className="p-3 font-mono text-ink/60 text-xs">{row.date}</td>
                          <td className="p-3">
                            <span className={`text-xs font-bold ${meta.cls}`}>{meta.label}</span>
                          </td>
                          <td className="p-3 text-ink/70">
                            {row.description}
                            {row.reference_no && (
                              <span className="text-ink/30 text-xs mr-2">{row.reference_no}</span>
                            )}
                          </td>
                          <td className="p-3 text-blue-400 font-bold">
                            {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                          </td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                          </td>
                          <td
                            className={`p-3 font-black ${row.balance >= 0 ? 'text-ink' : 'text-red-400'}`}
                          >
                            {formatCurrency(row.balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
