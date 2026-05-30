import { Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { TableSkeleton } from '@/components/skeletons';
import type { SalesReturn } from '../salesTypes';

interface SalesReturnsListProps {
  returns: SalesReturn[];
  isLoading: boolean;
  canDelete: boolean;
  onDelete: (id: number) => void;
}

export function SalesReturnsList({ returns: returns_, isLoading, canDelete, onDelete }: SalesReturnsListProps) {
  return (
    <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm whitespace-nowrap">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="p-4 text-white/60">رقم المرتجع</th>
              <th className="p-4 text-white/60">العميل</th>
              <th className="p-4 text-white/60">الإجمالي</th>
              <th className="p-4 text-white/60">نوع الاسترداد</th>
              <th className="p-4 text-white/60">السبب</th>
              <th className="p-4 text-white/60">التاريخ</th>
              <th className="p-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton cols={7} rows={5} />
            ) : returns_.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-white/40">لا توجد مرتجعات</td>
              </tr>
            ) : (
              returns_.map((r) => (
                <tr key={r.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-4 font-bold text-amber-400 font-mono">{r.return_no}</td>
                  <td className="p-4 text-white">{r.customer_name || 'عميل نقدي'}</td>
                  <td className="p-4 font-bold text-orange-400">{formatCurrency(r.total_amount)}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${r.refund_type === 'cash' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                    >
                      {r.refund_type === 'cash' ? `نقدي — ${r.safe_name || ''}` : 'خصم رصيد'}
                    </span>
                  </td>
                  <td className="p-4 text-white/50">{r.reason || '—'}</td>
                  <td className="p-4 text-white/40 text-xs">{r.date || formatDate(r.created_at)}</td>
                  <td className="p-4">
                    {canDelete && (
                      <button
                        onClick={() => onDelete(r.id)}
                        className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
