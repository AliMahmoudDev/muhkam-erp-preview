import { Search, X, Filter } from 'lucide-react';
import type { AuditProduct } from '../_shared';

export function PartialProductSelector({
  allProducts,
  filteredForSelector,
  selectedProductIds,
  setSelectedProductIds,
  partialSearch,
  setPartialSearch,
  partialCategory,
  setPartialCategory,
  categories,
  loadingProducts,
}: {
  allProducts: AuditProduct[];
  filteredForSelector: AuditProduct[];
  selectedProductIds: Set<number>;
  setSelectedProductIds: (v: Set<number>) => void;
  partialSearch: string;
  setPartialSearch: (v: string) => void;
  partialCategory: string;
  setPartialCategory: (v: string) => void;
  categories: string[];
  loadingProducts: boolean;
}) {
  return (
    <div className="bg-[#111827] border border-violet-500/20 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2">
          <Filter className="w-4 h-4" /> اختر المنتجات للجرد
          {selectedProductIds.size > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-violet-500/30 text-violet-200 text-xs font-bold">
              {selectedProductIds.size} محدد
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedProductIds(new Set(allProducts.map((p) => p.id)))}
            className="text-xs text-violet-400 hover:text-violet-200 transition-colors"
          >
            تحديد الكل
          </button>
          <span className="text-ink/20">|</span>
          <button
            onClick={() => setSelectedProductIds(new Set())}
            className="text-xs text-ink/40 hover:text-ink/70 transition-colors"
          >
            مسح الكل
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/30" />
          <input
            value={partialSearch}
            onChange={(e) => setPartialSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full bg-surface border border-line rounded-xl px-3 py-2 icon-pr text-ink text-sm placeholder:text-ink/30 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
          />
          {partialSearch && (
            <button
              onClick={() => setPartialSearch('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <select
            value={partialCategory}
            onChange={(e) => setPartialCategory(e.target.value)}
            className="bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm focus:outline-none focus:ring-1 focus:ring-violet-400/40"
          >
            <option value="all" className="bg-[#1a1a2e]">
              جميع الفئات
            </option>
            {categories.map((c) => (
              <option key={c} value={c} className="bg-[#1a1a2e]">
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="max-h-52 overflow-y-auto rounded-xl border border-line divide-y divide-white/5">
        {loadingProducts ? (
          <div className="p-4 text-center text-ink/40 text-sm">جاري التحميل...</div>
        ) : filteredForSelector.length === 0 ? (
          <div className="p-4 text-center text-ink/30 text-sm">لا توجد منتجات</div>
        ) : (
          filteredForSelector.map((p) => {
            const isChecked = selectedProductIds.has(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isChecked ? 'bg-violet-500/10' : 'hover:bg-surface'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const next = new Set(selectedProductIds);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    setSelectedProductIds(next);
                  }}
                  className="w-4 h-4 rounded border-line accent-violet-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm font-medium ${isChecked ? 'text-ink' : 'text-ink/70'}`}
                  >
                    {p.name}
                  </span>
                  {p.sku && <span className="text-ink/30 text-xs ms-2">{p.sku}</span>}
                  {p.category && (
                    <span className="text-ink/20 text-xs ms-2">({p.category})</span>
                  )}
                </div>
                <span className="text-ink/40 text-xs font-mono shrink-0">
                  {p.calculated_qty.toFixed(2)} في المخزن
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
