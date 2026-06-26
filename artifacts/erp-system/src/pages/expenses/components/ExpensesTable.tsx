import { Trash2, Eye } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { TableSkeleton } from '@/components/skeletons';
import type { Expense } from '../types';
import { EmptyTable } from '@/components/ui/empty-table';

interface ExpensesTableProps {
  filtered: Expense[];
  filteredTotal: number;
  hasFilter: boolean;
  isLoading: boolean;
  canDelete: boolean;
  onViewDetail: (expense: Expense) => void;
  onDelete: (id: number) => void;
}

export function ExpensesTable({
  filtered,
  filteredTotal,
  hasFilter,
  isLoading,
  canDelete,
  onViewDetail,
  onDelete,
}: ExpensesTableProps) {
  return (
    <div className="glass-panel overflow-hidden">
      {hasFilter && filtered.length > 0 && (
        <div className="px-5 py-3 border-b border-line bg-surface flex justify-between items-center">
          <span className="text-ink/50 text-sm">{filtered.length} نتيجة</span>
          <span className="text-red-400 font-bold text-sm">{formatCurrency(filteredTotal)}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-ink/80 whitespace-nowrap">
          <thead className="bg-surface border-b border-line">
            <tr>
              <th className="p-4 font-medium">التصنيف</th>
              <th className="p-4 font-medium">المبلغ</th>
              <th className="p-4 font-medium">الخزينة</th>
              <th className="p-4 font-medium">التفاصيل</th>
              <th className="p-4 font-medium">التاريخ</th>
              <th className="p-4 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton cols={6} rows={5} />
            ) : filtered.length === 0 ? (
              <tr className="erp-table-row">
                <td colSpan={6}>
                  <EmptyTable
                    variant={hasFilter ? 'no-results' : 'no-data'}
                    headline={hasFilter ? 'لا توجد نتائج بهذه الفلاتر' : 'لا توجد مصروفات'}
                  />
                </td>
              </tr>
            ) : (
              filtered.map((exp) => (
                <tr key={exp.id} className="border-b border-line erp-table-row">
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-300 text-xs font-bold border border-orange-500/20">
                      {exp.category}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-red-400">{formatCurrency(exp.amount)}</td>
                  <td className="p-4">
                    {exp.safe_name ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20">
                        {exp.safe_name}
                      </span>
                    ) : (
                      <span className="text-ink/30 text-sm">—</span>
                    )}
                  </td>
                  <td className="p-4 text-ink/70 text-sm max-w-[200px] truncate">
                    {exp.description || '—'}
                  </td>
                  <td className="p-4 text-sm text-ink/60">{formatDate(exp.created_at)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => onViewDetail(exp)}
                        className="btn-icon"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4 text-orange-400" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => onDelete(exp.id)}
                          className="btn-icon btn-icon-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
