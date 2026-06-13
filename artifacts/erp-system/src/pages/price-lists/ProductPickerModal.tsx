import { useState, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { safeNum } from './helpers';
import type { Product } from './types';

/* ──────────────────────────────── Product Picker Modal ─────────────────── */

export function ProductPickerModal({
  products,
  selectedIds,
  onConfirm,
  onClose,
}: {
  products: Product[];
  selectedIds: Set<number>;
  onConfirm: (ids: Set<number>) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set(selectedIds));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col"
        style={{
          background: 'var(--erp-bg-card)',
          border: '1px solid var(--erp-border-md)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <p className="font-bold text-ink">اختر المنتجات</p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink/40 hover:text-ink transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-3 border-b border-line">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الباركود..."
              className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 pr-10 text-sm text-ink outline-none"
              autoFocus
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-amber-500/15 border border-amber-500/30'
                    : 'border border-transparent hover:bg-surface'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-amber-500 border-amber-500' : 'border-line'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{p.name}</p>
                  <p className="text-xs text-ink/40">
                    تكلفة: {formatCurrency(safeNum(p.cost_price))}
                  </p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-ink/30 text-sm">لا توجد منتجات</div>
          )}
        </div>
        {/* Footer */}
        <div className="px-5 py-4 border-t border-line flex justify-between items-center">
          <span className="text-ink/50 text-sm">{selected.size} منتج محدد</span>
          <button
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition"
          >
            تأكيد الاختيار
          </button>
        </div>
      </div>
    </div>
  );
}
