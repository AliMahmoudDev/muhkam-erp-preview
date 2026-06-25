import { X } from 'lucide-react';
import type { ExpenseCategory } from '../types';
import { Combobox } from '@/components/ui/combobox';
import { PageToolbar } from '@/components/patterns';
import { SearchInput } from '@/components/ui/search-input';

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
    <PageToolbar
      searchSlot={
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="بحث بالتصنيف أو التفاصيل..."
          aria-label="بحث في المصروفات"
        />
      }
      filtersSlot={
        <>
          <Combobox
            options={categories.map((c) => ({ value: c.name, label: c.name }))}
            value={catFilter}
            onChange={(v) => setCatFilter(v)}
            placeholder="كل التصنيفات"
            clearable
            className="w-36"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="erp-input text-sm py-2 w-36 [color-scheme:dark]"
            aria-label="من تاريخ"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="erp-input text-sm py-2 w-36 [color-scheme:dark]"
            aria-label="إلى تاريخ"
          />
          {hasFilter && (
            <button
              onClick={onClearAll}
              title="مسح كل الفلاتر"
              aria-label="مسح كل الفلاتر"
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-surface border border-line flex items-center justify-center text-ink/30 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </>
      }
    />
  );
}
