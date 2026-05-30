import { Search, X } from 'lucide-react';
import type { ExpenseCategory } from '../types';

interface ExpensesFilterToolbarProps {
  search: string;
  setSearch: (v: string) => void;
  catFilter: string;
  setCatFilter: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  categories: ExpenseCategory[];
  hasFilter: boolean;
  onClearAll: () => void;
}

export function ExpensesFilterToolbar({
  search,
  setSearch,
  catFilter,
  setCatFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  categories,
  hasFilter,
  onClearAll,
}: ExpensesFilterToolbarProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
      {/* Search */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/30 text-xs font-medium pr-1">بحث</label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالتصنيف أو التفاصيل..."
            className="glass-input w-full icon-pr text-sm py-2.5"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/30 text-xs font-medium pr-1">التصنيف</label>
        <select
          value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="glass-input text-sm py-2.5 w-36"
        >
          <option value="" className="bg-gray-900">الكل</option>
          {categories.map(c => <option key={c.id} value={c.name} className="bg-gray-900">{c.name}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/30 text-xs font-medium pr-1">من تاريخ</label>
        <input
          type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="glass-input text-sm py-2.5 w-36 [color-scheme:dark]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-white/30 text-xs font-medium pr-1">إلى تاريخ</label>
        <div className="flex items-center gap-2">
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="glass-input text-sm py-2.5 w-36 [color-scheme:dark]"
          />
          {hasFilter && (
            <button
              onClick={onClearAll}
              title="مسح كل الفلاتر"
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
