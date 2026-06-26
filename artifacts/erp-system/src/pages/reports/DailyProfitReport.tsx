import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  api,
  authFetch,
  formatCurrency,
  TableSkeleton,
  DateFilterBar,
  getDateRange,
  DateMode,
  thisMonthStart,
  todayStr,
} from './shared';
import { EmptyTable } from '@/components/ui/empty-table';

interface DailyProfitData {
  days: Array<{
    day: string;
    total_sales: number;
    total_returns: number;
    net_sales: number;
    total_cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
  }>;
  summary: {
    total_net_sales: number;
    total_cogs: number;
    total_gross_profit: number;
    total_expenses: number;
    total_net_profit: number;
  };
}

export default function DailyProfitReport() {
  const [mode, setMode] = useState<DateMode>('month');
  const [customFrom, setCustomFrom] = useState(thisMonthStart());
  const [customTo, setCustomTo] = useState(todayStr());
  const [dateFrom, dateTo] = getDateRange(mode, customFrom, customTo);

  const { data, isLoading } = useQuery<DailyProfitData>({
    queryKey: ['/api/reports/daily-profit', dateFrom, dateTo],
    queryFn: () =>
      authFetch(api(`/api/reports/daily-profit?date_from=${dateFrom}&date_to=${dateTo}`)).then(
        async (r) => {
          if (!r.ok) throw new Error(`API Error: ${r.status}`);
          return r.json();
        }
      ),
    staleTime: 60_000,
  });
  const days = data?.days ?? [];
  const summary = data?.summary ?? {
    total_net_sales: 0,
    total_cogs: 0,
    total_gross_profit: 0,
    total_expenses: 0,
    total_net_profit: 0,
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}>
      <DateFilterBar
        mode={mode}
        setMode={setMode}
        customFrom={customFrom}
        setCustomFrom={setCustomFrom}
        customTo={customTo}
        setCustomTo={setCustomTo}
      />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'صافي المبيعات', value: summary.total_net_sales, color: 'text-emerald-400' },
          { label: 'تكلفة البضاعة', value: summary.total_cogs, color: 'text-red-400' },
          { label: 'مجمل الربح', value: summary.total_gross_profit, color: 'text-amber-400' },
          { label: 'المصروفات', value: summary.total_expenses, color: 'text-orange-400' },
          {
            label: 'صافي الربح',
            value: summary.total_net_profit,
            color: summary.total_net_profit >= 0 ? 'text-blue-400' : 'text-red-400',
          },
        ].map((c) => (
          <div key={c.label} className="glass-panel rounded-2xl p-4 border border-line">
            <p className="text-ink/40 text-xs mb-1">{c.label}</p>
            <p className={`text-lg font-black ${c.color}`}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>
      <div className="glass-panel overflow-hidden border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-surface border-b border-line">
              <tr>
                <th className="p-3 text-ink/50">التاريخ</th>
                <th className="p-3 text-ink/50">المبيعات</th>
                <th className="p-3 text-ink/50">المرتجعات</th>
                <th className="p-3 text-ink/50">صافي المبيعات</th>
                <th className="p-3 text-ink/50">تكلفة البضاعة</th>
                <th className="p-3 text-ink/50">مجمل الربح</th>
                <th className="p-3 text-ink/50">المصروفات</th>
                <th className="p-3 text-ink/50">صافي الربح</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={8} rows={5} />
              ) : days.length === 0 ? (
                <tr className="erp-table-row">
                  <td colSpan={8}>
                    <EmptyTable variant="no-results" headline="لا توجد بيانات في هذه الفترة" />
                  </td>
                </tr>
              ) : (
                days.map((d) => (
                  <tr key={d.day} className="border-b border-line erp-table-row">
                    <td className="p-3 text-ink/70 font-mono">{d.day}</td>
                    <td className="p-3 text-emerald-400 font-bold">
                      {formatCurrency(d.total_sales)}
                    </td>
                    <td className="p-3 text-red-400">
                      {d.total_returns > 0 ? formatCurrency(d.total_returns) : '—'}
                    </td>
                    <td className="p-3 text-ink font-bold">{formatCurrency(d.net_sales)}</td>
                    <td className="p-3 text-red-400">{formatCurrency(d.total_cogs)}</td>
                    <td
                      className={`p-3 font-bold ${d.gross_profit >= 0 ? 'text-amber-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(d.gross_profit)}
                    </td>
                    <td className="p-3 text-orange-400">
                      {d.expenses > 0 ? formatCurrency(d.expenses) : '—'}
                    </td>
                    <td
                      className={`p-3 font-black ${d.net_profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(d.net_profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {days.length > 0 && (
              <tfoot className="bg-surface border-t border-line">
                <tr>
                  <td className="p-3 font-bold text-ink/50">الإجمالي</td>
                  <td className="p-3" />
                  <td className="p-3" />
                  <td className="p-3 font-black text-ink">
                    {formatCurrency(summary.total_net_sales)}
                  </td>
                  <td className="p-3 font-black text-red-400">
                    {formatCurrency(summary.total_cogs)}
                  </td>
                  <td className="p-3 font-black text-amber-400">
                    {formatCurrency(summary.total_gross_profit)}
                  </td>
                  <td className="p-3 font-black text-orange-400">
                    {formatCurrency(summary.total_expenses)}
                  </td>
                  <td
                    className={`p-3 font-black ${summary.total_net_profit >= 0 ? 'text-blue-400' : 'text-red-400'}`}
                  >
                    {formatCurrency(summary.total_net_profit)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
