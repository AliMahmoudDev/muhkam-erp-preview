import { TableSkeleton } from '@/components/skeletons';
import { Filter } from 'lucide-react';
import type { AuditProduct } from '../_shared';
import type { CountMode } from './types';

const ROWS_PER_CHUNK = 200;

export function CountItemsTable({
  selectedWarehouse,
  countMode,
  selectedProductIds,
  loadingProducts,
  countTableProducts,
  visibleCountRows,
  chunkLimit,
  setChunkLimit,
  physicalQtys,
  setPhysicalQtys,
  itemNotes,
  setItemNotes,
}: {
  selectedWarehouse: number;
  countMode: CountMode;
  selectedProductIds: Set<number>;
  loadingProducts: boolean;
  countTableProducts: AuditProduct[];
  visibleCountRows: AuditProduct[];
  chunkLimit: number;
  setChunkLimit: (fn: (c: number) => number) => void;
  physicalQtys: Record<number, string>;
  setPhysicalQtys: (fn: (prev: Record<number, string>) => Record<number, string>) => void;
  itemNotes: Record<number, string>;
  setItemNotes: (fn: (prev: Record<number, string>) => Record<number, string>) => void;
}) {
  if (selectedWarehouse === 0) {
    return <div className="text-center py-16 text-white/30">اختر مخزناً لعرض المنتجات</div>;
  }

  if (countMode === 'partial' && selectedProductIds.size === 0) {
    return (
      <div className="text-center py-16 text-white/30">
        <Filter className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p>حدد المنتجات من القائمة أعلاه</p>
      </div>
    );
  }

  if (loadingProducts) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <tbody>
            <TableSkeleton cols={5} rows={6} />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="p-3 text-right text-white/60 font-medium">المنتج</th>
            <th className="p-3 text-right text-white/60 font-medium">
              <span title="الكمية في هذا المخزن من حركات المخزون">كمية المخزن (نظام)</span>
            </th>
            <th className="p-3 text-right text-white/60 font-medium">
              الكمية الفعلية (يُدخلها المستخدم)
            </th>
            <th className="p-3 text-center text-white/60 font-medium w-28">الفرق</th>
            <th className="p-3 text-right text-white/60 font-medium">سبب الفرق</th>
          </tr>
        </thead>
        <tbody>
          {visibleCountRows.map((p) => {
            const rawPhys = physicalQtys[p.id];
            const physQty =
              rawPhys !== undefined && rawPhys !== '' ? parseFloat(rawPhys) : null;
            const sysQty = p.calculated_qty;
            const diff = physQty !== null ? physQty - sysQty : null;
            const hasDiff = diff !== null && Math.abs(diff) > 0.001;
            return (
              <tr
                key={p.id}
                className={`border-b border-white/5 erp-table-row ${hasDiff ? 'bg-amber-500/5' : ''}`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
              >
                <td className="p-3">
                  <div className="text-white font-medium">{p.name}</div>
                  {p.sku && <div className="text-white/40 text-xs">{p.sku}</div>}
                  {p.category && <div className="text-white/30 text-xs">{p.category}</div>}
                </td>
                <td className="p-3">
                  <span className="font-mono text-white/80 font-bold text-sm">
                    {sysQty.toFixed(2)}
                  </span>
                  <span className="text-white/30 text-xs ms-1">وحدة</span>
                </td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    data-qty-input={p.id}
                    value={physicalQtys[p.id] ?? ''}
                    onChange={(e) =>
                      setPhysicalQtys((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const idx = countTableProducts.findIndex((x) => x.id === p.id);
                        const next = countTableProducts[idx + 1];
                        if (next) {
                          e.preventDefault();
                          const nextEl = document.querySelector<HTMLInputElement>(
                            `input[data-qty-input="${next.id}"]`
                          );
                          if (nextEl) {
                            nextEl.scrollIntoView({ block: 'nearest' });
                            nextEl.focus();
                            nextEl.select();
                          }
                        }
                      }
                    }}
                    placeholder="أدخل الكمية"
                    className="w-32 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-sm font-mono"
                  />
                </td>
                <td className="p-3 text-center font-mono w-28">
                  {diff === null ? (
                    <span className="text-white/20">—</span>
                  ) : diff === 0 ? (
                    <span className="text-emerald-400 font-bold text-sm">✓ صفر</span>
                  ) : diff > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-sm">
                      +{diff.toFixed(3)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-400 font-bold text-sm">
                      {diff.toFixed(3)}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {hasDiff &&
                    (() => {
                      const noteMissing = !itemNotes[p.id]?.trim();
                      return (
                        <input
                          type="text"
                          value={itemNotes[p.id] ?? ''}
                          onChange={(e) =>
                            setItemNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="سبب الفرق (مطلوب) *"
                          className={`w-44 bg-white/10 rounded-lg px-2 py-1 text-white focus:outline-none text-xs border ${
                            noteMissing
                              ? 'border-red-500/50 placeholder:text-red-400/60 focus:ring-1 focus:ring-red-400/40'
                              : 'border-emerald-500/30 placeholder:text-amber-500/50 focus:ring-1 focus:ring-amber-400/40'
                          }`}
                        />
                      );
                    })()}
                </td>
              </tr>
            );
          })}
          {countTableProducts.length > chunkLimit && (
            <tr>
              <td colSpan={5} className="py-3 text-center bg-white/[0.03]">
                <button
                  onClick={() => setChunkLimit((c) => c + ROWS_PER_CHUNK)}
                  className="px-4 py-1.5 text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-lg transition-colors"
                >
                  عرض المزيد ({countTableProducts.length - chunkLimit} متبقي)
                </button>
              </td>
            </tr>
          )}
          {countTableProducts.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-white/40 py-12">
                {countMode === 'partial'
                  ? 'لم تُحدَّد منتجات للجرد الجزئي'
                  : 'لا توجد منتجات في هذا المخزن'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
