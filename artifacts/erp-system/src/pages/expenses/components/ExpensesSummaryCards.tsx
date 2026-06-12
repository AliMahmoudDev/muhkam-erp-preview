import { TrendingDown, Calendar, AlertCircle, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface ExpensesSummaryCardsProps {
  totalAll: number;
  totalMonth: number;
  topCategory: { cat: string; amt: number } | undefined;
  totalRecords: number;
}

export function ExpensesSummaryCards({
  totalAll,
  totalMonth,
  topCategory,
  totalRecords,
}: ExpensesSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total all */}
      <div className="glass-panel rounded-2xl p-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
          <TrendingDown className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <div className="text-red-400 font-black text-lg leading-tight">{formatCurrency(totalAll)}</div>
          <div className="text-ink/40 text-xs mt-0.5">إجمالي المصروفات</div>
        </div>
      </div>

      {/* This month */}
      <div className="glass-panel rounded-2xl p-4 border border-orange-500/20 bg-orange-500/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <div className="text-orange-400 font-black text-lg leading-tight">{formatCurrency(totalMonth)}</div>
          <div className="text-ink/40 text-xs mt-0.5">مصروفات هذا الشهر</div>
        </div>
      </div>

      {/* Top category */}
      <div className="glass-panel rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="text-amber-300 font-black text-sm leading-tight truncate">
            {topCategory ? topCategory.cat : '—'}
          </div>
          <div className="text-ink/40 text-xs mt-0.5">
            {topCategory ? `أعلى تصنيف • ${formatCurrency(topCategory.amt)}` : 'لا توجد بيانات'}
          </div>
        </div>
      </div>

      {/* Total records */}
      <div className="glass-panel rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <Tag className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <div className="text-blue-400 font-black text-lg leading-tight">{totalRecords}</div>
          <div className="text-ink/40 text-xs mt-0.5">إجمالي السجلات</div>
        </div>
      </div>
    </div>
  );
}
