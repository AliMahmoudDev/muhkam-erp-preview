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
    return <div className="text-center py-16 text-ink/30">اختر مخزناً لعرض المنتجات</div>;
  }

  if (countMode === 'partial' && selectedProductIds.size === 0) {
    return (
      <div className="text-center py-16 text-ink/30">
        <Filter className="w-8 h-8 text-ink/10 mx-auto mb-3" />
        <p>حدد المنتجات من القائمة أعلاه</p>
      </div>
    );
  }

  if (loadingProducts) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <tbody>
            <TableSkeleton cols={5} rows={6} />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface">
            <th className="p-3 text-right text-ink/60 font-medium">المنتج</th>
            <th className="p-3 text-right text-ink/60 font-medium">
              <span title="الكمية في هذا المخزن من حركات المخزون">كمية المخزن (نظام)</span>
            </th>
            <th className="p-3 text-right text-ink/60 font-medium">
              الكمية الفعلية (يُدخلها المستخدم)
            </th>
            <th className="p-3 text-center text-ink/60 font-medium w-28">الفرق</th>
            <th className="p-3 text-right text-ink/60 font-medium">سبب الفرق</th>
          </tr>
        </thead>
        <tbody>
          {visibleCountRows.map((p) => {
            const rawPhys = physicalQtys[p.id];
            const physQty = rawPhys !== undefined && rawPhys !== '' ? parseFloat(rawPhys) : null;
            const sysQty = p.calculated_qty;
            const diff = physQty !== null ? physQty - sysQty : null;
            const hasDiff = diff !== null && Math.abs(diff) > 0.001;
            return (
              <tr
                key={p.id}
                className={`border-b border-line erp-table-row ${hasDiff ? 'bg-amber-500/5' : ''}`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '60px' }}
              >
                <td className="p-3">
                  <div className="text-ink font-medium">{p.name}</div>
                  {p.sku && <div className="text-ink/40 text-xs">{p.sku}</div>}
                  {p.category && <div className="text-ink/30 text-xs">{p.category}</div>}
                </td>
                <td className="p-3">
                  <span className="font-mono text-ink/80 font-bold text-sm">
                    {sysQty.toFixed(2)}
                  </span>
                  <span className="text-ink/30 text-xs ms-1">وحدة</span>
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
                    className="w-32 bg-surface border border-line rounded-lg px-2 py-1.5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50 text-sm font-mono"
                  />
                </td>
                <td className="p-3 text-center font-mono w-28">
                  {diff === null ? (
                    <span className="text-ink/20">—</span>
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
                          className={`w-44 bg-surface rounded-lg px-2 py-1 text-ink focus:outline-none text-xs border ${
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
              <td colSpan={5} className="py-3 text-center bg-surface">
                <button
                  onClick={() => setChunkLimit((c) => c + ROWS_PER_CHUNK)}
                  className="px-4 py-1.5 text-xs bg-surface hover:bg-raised text-ink/50 rounded-lg transition-colors border border-line"
                >
                  عرض المزيد ({countTableProducts.length - chunkLimit} متبقي)
                </button>
              </td>
            </tr>
          )}
          {countTableProducts.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-ink/40 py-12">
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
