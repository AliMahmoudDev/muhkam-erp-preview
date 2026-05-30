import { X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface ExpenseCategoryPillsProps {
  categoryBreakdown: Array<{ cat: string; amt: number }>;
  catFilter: string;
  setCatFilter: (v: string) => void;
}

export function ExpenseCategoryPills({
  categoryBreakdown,
  catFilter,
  setCatFilter,
}: ExpenseCategoryPillsProps) {
  if (categoryBreakdown.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-white/25 text-xs font-medium shrink-0 ml-1">اختصارات الشهر:</span>
      {categoryBreakdown.slice(0, 6).map(({ cat, amt }) => {
        const active = catFilter === cat;
        return (
          <button
            key={cat}
            onClick={() => setCatFilter(active ? '' : cat)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 ${
              active
                ? 'bg-orange-500/25 text-orange-200 border-orange-400/40 shadow-[0_0_12px_rgba(249,115,22,0.2)]'
                : 'bg-white/[0.04] text-white/55 border-white/[0.08] hover:bg-white/[0.08] hover:text-white/80 hover:border-white/15'
            }`}
          >
            <span>{cat}</span>
            <span className={`font-black tabular-nums ${active ? 'text-orange-300' : 'text-red-400/60'}`}>
              {formatCurrency(amt)}
            </span>
          </button>
        );
      })}
      {catFilter && (
        <button
          onClick={() => setCatFilter('')}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-white/30 hover:text-white/60 border border-white/8 hover:border-white/15 transition-all"
        >
          <X className="w-3 h-3" /> إلغاء
        </button>
      )}
    </div>
  );
}
