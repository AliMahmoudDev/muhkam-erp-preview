/**
 * Inventory — FilterPanel (extracted from InventoryReport)
 * Search input, low-stock toggle, sort selector, category tabs, and PDF export.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, FileDown } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { exportTableToPDF } from '@/lib/pdf-export';
import { formatCurrency } from '../shared';

type SortMode = 'value' | 'profit' | 'lowStock' | 'default';

export interface FilterPanelProps {
  search: string;
  setSearch: (s: string) => void;
  lowStockOnly: boolean;
  setLowStockOnly: (v: boolean) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  catFilter: string;
  setCatFilter: (c: string) => void;
  categories: string[];
  products: Array<{
    id: number;
    name: string;
    category?: string | null;
    quantity: number;
    cost_price: number;
    sale_price: number;
  }>;
  filtered: Array<{
    id: number;
    name: string;
    category?: string | null;
    quantity: number;
    cost_price: number;
    sale_price: number;
  }>;
  companyName?: string;
}

export default function FilterPanel({
  search,
  setSearch,
  lowStockOnly,
  setLowStockOnly,
  sortMode,
  setSortMode,
  catFilter,
  setCatFilter,
  categories,
  products,
  filtered,
  companyName,
}: FilterPanelProps) {
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30" />
          <input
            className="glass-input w-full icon-pr text-sm"
            placeholder="ابحث عن منتج أو صنف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${lowStockOnly ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'glass-panel border-line text-ink/50'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> نافدة فقط
        </button>
        <div className="relative">
          <Combobox
            options={[
              { value: 'default', label: 'الترتيب الافتراضي' },
              { value: 'value', label: 'الأعلى قيمة' },
              { value: 'profit', label: 'الأعلى ربحاً' },
              { value: 'lowStock', label: 'الأقل مخزوناً' },
            ]}
            value={sortMode}
            onChange={(v) => setSortMode(v as SortMode)}
          />
        </div>
        <button
          onClick={() =>
            exportTableToPDF({
              title: 'تقرير المخزون',
              columns: [
                'المنتج',
                'التصنيف',
                'الكمية',
                'سعر التكلفة',
                'سعر البيع',
                'قيمة المخزون',
                'هامش%',
              ],
              rows: filtered.map((p) => {
                const margin =
                  p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price) * 100 : 0;
                return [
                  p.name,
                  p.category || '—',
                  p.quantity,
                  formatCurrency(p.cost_price),
                  formatCurrency(p.sale_price),
                  formatCurrency(p.quantity * p.cost_price),
                  `${margin.toFixed(1)}%`,
                ];
              }),
              filename: 'تقرير_المخزون',
              companyName,
            })
          }
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all"
        >
          <FileDown className="w-3.5 h-3.5" /> تصدير PDF
        </button>
      </div>

      <div className="flex items-center gap-1 flex-wrap border-b border-line pb-2">
        {(
          [
            { id: '', label: `الكل (${products.length})` },
            ...categories.map((c) => ({
              id: c,
              label: `${c} (${products.filter((p) => p.category === c).length})`,
            })),
          ] as { id: string; label: string }[]
        ).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCatFilter(cat.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition-all relative ${catFilter === cat.id ? 'text-amber-400' : 'text-ink/40 hover:text-ink/70'}`}
          >
            {cat.label}
            {catFilter === cat.id && (
              <motion.div
                layoutId="cat-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full"
              />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
