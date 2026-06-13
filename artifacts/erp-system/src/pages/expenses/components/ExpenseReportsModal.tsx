import { useState } from 'react';
import { BarChart2, X, Printer } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { ExpenseCategory, ExpenseReportRow } from '../types';
import { printExpenseReport } from '../utils/printExpenseReport';

interface ExpenseReportsModalProps {
  show: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  companyName: string;
}

export function ExpenseReportsModal({
  show,
  onClose,
  categories,
  companyName,
}: ExpenseReportsModalProps) {
  const { toast } = useToast();
  const [reportFilters, setReportFilters] = useState({ category: '', dateFrom: '', dateTo: '' });
  const [reportData, setReportData] = useState<ExpenseReportRow[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const handleFetchReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportFilters.category) params.set('category', reportFilters.category);
      if (reportFilters.dateFrom) params.set('date_from', reportFilters.dateFrom);
      if (reportFilters.dateTo) params.set('date_to', reportFilters.dateTo);
      const r = await authFetch(api(`/api/expense-reports?${params}`));
      if (!r.ok) {
        const e = await r.json();
        toast({ title: e.error ?? 'خطأ في التقرير', variant: 'destructive' });
        return;
      }
      setReportData(await r.json());
    } finally {
      setReportLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-4 px-4 bg-black/60 backdrop-blur-sm modal-overlay overflow-y-auto">
      <div className="glass-panel rounded-3xl w-full max-w-4xl border border-line flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-bold text-ink">تقارير المصروفات</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface text-ink/50 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-line">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-ink/50 text-xs mb-1">التصنيف</label>
              <select
                className="glass-input w-full text-sm appearance-none"
                value={reportFilters.category}
                onChange={(e) => setReportFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="" className="bg-gray-900">
                  كل التصنيفات
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name} className="bg-gray-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-ink/50 text-xs mb-1">من تاريخ</label>
              <input
                type="date"
                className="glass-input w-full text-sm"
                value={reportFilters.dateFrom}
                onChange={(e) => setReportFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-ink/50 text-xs mb-1">إلى تاريخ</label>
              <input
                type="date"
                className="glass-input w-full text-sm"
                value={reportFilters.dateTo}
                onChange={(e) => setReportFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleFetchReport}
              disabled={reportLoading}
              className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
            >
              {reportLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-line border-t-white rounded-full animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                <>
                  <BarChart2 className="w-4 h-4" />
                  عرض التقرير
                </>
              )}
            </button>
            {reportData && reportData.length > 0 && (
              <button
                onClick={() =>
                  printExpenseReport({
                    rows: reportData,
                    category: reportFilters.category,
                    dateFrom: reportFilters.dateFrom,
                    dateTo: reportFilters.dateTo,
                    companyName,
                  })
                }
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
              >
                <Printer className="w-4 h-4" /> طباعة
              </button>
            )}
          </div>
        </div>

        <div className="overflow-auto max-h-[55vh]">
          {reportData === null ? (
            <div className="flex items-center justify-center py-16 text-ink/30 text-sm">
              اضغط "عرض التقرير" لتحميل البيانات
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-ink/30 text-sm">
              لا توجد مصروفات بهذه الفلاتر
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-surface text-ink/50 text-xs">
                  <th className="px-4 py-2.5 text-right font-semibold">التاريخ</th>
                  <th className="px-4 py-2.5 text-right font-semibold">التصنيف</th>
                  <th className="px-4 py-2.5 text-right font-semibold">التفاصيل</th>
                  <th className="px-4 py-2.5 text-right font-semibold">الخزينة</th>
                  <th className="px-4 py-2.5 text-left font-semibold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-t border-line ${i % 2 === 0 ? '' : 'bg-surface'} hover:bg-surface transition-colors`}
                  >
                    <td className="px-4 py-2.5 text-ink/60 text-xs">{row.date}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-300 text-xs font-bold border border-orange-500/20">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink/60 text-xs">{row.description ?? '—'}</td>
                    <td className="px-4 py-2.5 text-blue-300/80 text-xs">{row.safe_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-left font-mono text-sm font-bold text-red-400">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line bg-surface font-bold text-sm">
                  <td colSpan={4} className="px-4 py-2.5 text-ink/60">
                    الإجمالي ({reportData.length} سجل)
                  </td>
                  <td className="px-4 py-2.5 text-left font-mono text-red-400">
                    {formatCurrency(reportData.reduce((s, r) => s + r.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
