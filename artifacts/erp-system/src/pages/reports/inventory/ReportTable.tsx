/**
 * Inventory — ReportTable (extracted from InventoryReport)
 * Main product table with detail side panel.
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, authFetch, formatCurrency, TableSkeleton } from '../shared';

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search || !text) return <>{text}</>;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === search.toLowerCase() ? (
          <mark key={i} className="bg-amber-400/30 text-amber-300 rounded px-0.5 not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface ProductDetail {
  actual_qty: number;
  opening_qty: number;
  purchased_qty: number;
  sold_qty: number;
  sale_return_qty: number;
  purchase_return_qty: number;
  adjustment_qty: number;
  movements: Array<{
    id: number;
    movement_type: string;
    quantity: number;
    quantity_before: number;
    quantity_after: number;
    reference_no: string | null;
    unit_cost: number;
    notes: string | null;
    created_at: string;
  }>;
}
const MOVE_META: Record<string, { label: string; textCls: string; dotCls: string }> = {
  opening_balance: { label: 'رصيد أول المدة', textCls: 'text-amber-400', dotCls: 'bg-amber-500' },
  purchase: { label: 'مشترى', textCls: 'text-blue-400', dotCls: 'bg-blue-500' },
  sale: { label: 'مبيعة', textCls: 'text-emerald-400', dotCls: 'bg-emerald-500' },
  sale_return: { label: 'مرتجع مبيعات', textCls: 'text-orange-400', dotCls: 'bg-orange-500' },
  purchase_return: { label: 'مرتجع مشتريات', textCls: 'text-orange-400', dotCls: 'bg-orange-500' },
  adjustment: { label: 'تسوية', textCls: 'text-slate-400', dotCls: 'bg-slate-500' },
};

export interface ReportTableProps {
  products: Array<{
    id: number;
    name: string;
    category?: string | null;
    quantity: number;
    cost_price: number;
    sale_price: number;
    low_stock_threshold?: number | null;
  }>;
  filtered: Array<{
    id: number;
    name: string;
    category?: string | null;
    quantity: number;
    cost_price: number;
    sale_price: number;
    low_stock_threshold?: number | null;
  }>;
  isLoading: boolean;
  search: string;
  totalStockValue: number;
  isInventoryDark: boolean;
}

export default function ReportTable({
  products,
  filtered,
  isLoading,
  search,
  totalStockValue,
}: ReportTableProps) {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const { data: detail, isLoading: detailLoading } = useQuery<ProductDetail>({
    queryKey: ['/api/inventory/product', selectedProductId],
    enabled: !!selectedProductId,
    queryFn: () =>
      authFetch(api(`/api/inventory/product/${selectedProductId}`)).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 30_000,
  });
  const stockChartData = useMemo(() => {
    if (!detail) return [];
    return [...detail.movements]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({
        date: new Date(m.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
          month: 'short',
          day: 'numeric',
        }),
        qty: m.quantity_after,
      }));
  }, [detail]);

  return (
    <>
      <div className="glass-panel rounded-3xl overflow-hidden border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-surface border-b border-line">
              <tr>
                <th className="p-3 text-ink/50">المنتج</th>
                <th className="p-3 text-ink/50">التصنيف</th>
                <th className="p-3 text-ink/50">الكمية</th>
                <th className="p-3 text-ink/50">سعر التكلفة</th>
                <th className="p-3 text-ink/50">سعر البيع</th>
                <th className="p-3 text-ink/50">قيمة المخزون</th>
                <th className="p-3 text-ink/50">هامش%</th>
                <th className="p-3 text-ink/50">تفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={8} rows={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-ink/40">
                    {search ? `لا نتائج لـ "${search}"` : 'لا توجد منتجات'}
                  </td>
                </tr>
              ) : (
                filtered.map((product, rowIdx) => {
                  const margin =
                    product.sale_price > 0
                      ? ((product.sale_price - product.cost_price) / product.sale_price) * 100
                      : 0;
                  const stockValue = product.quantity * product.cost_price;
                  const threshold = product.low_stock_threshold ?? 5;
                  const isOut = product.quantity === 0;
                  const isLow = !isOut && product.quantity <= threshold;
                  const isSelected = selectedProductId === product.id;
                  return (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: rowIdx * 0.03 }}
                      className={`border-b border-line transition-colors cursor-pointer ${isSelected ? 'bg-amber-500/8' : isOut ? 'bg-red-500/4 hover:bg-red-500/8' : isLow ? 'bg-yellow-500/4 hover:bg-yellow-500/8' : 'hover:bg-surface'}`}
                    >
                      <td className="p-3 font-bold text-ink">
                        <HighlightText text={product.name} search={search} />
                      </td>
                      <td className="p-3">
                        {product.category ? (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                            <HighlightText text={product.category} search={search} />
                          </span>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${isOut ? 'bg-red-500/20 text-red-400 border-red-500/30' : isLow ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'}`}
                        >
                          {isOut && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                          )}
                          {isOut ? '⚠ نافذ' : isLow ? `⚠ ${product.quantity}` : product.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-ink/60">{formatCurrency(product.cost_price)}</td>
                      <td className="p-3 text-emerald-400">{formatCurrency(product.sale_price)}</td>
                      <td className="p-3 font-bold text-blue-400">{formatCurrency(stockValue)}</td>
                      <td className="p-3">
                        <span
                          className={`text-xs font-bold ${margin >= 30 ? 'text-emerald-400' : margin > 0 ? 'text-amber-400' : 'text-red-400'}`}
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setSelectedProductId(isSelected ? null : product.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${isSelected ? 'bg-amber-500/30 border-amber-500/50 text-amber-300' : 'bg-surface border-line text-ink/50 hover:bg-surface'}`}
                        >
                          {isSelected ? 'إغلاق' : 'تفاصيل ◀'}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-surface border-t border-line">
              <tr>
                <td colSpan={5} className="p-3 text-ink/40 text-xs">
                  الإجمالي ({filtered.length} صنف)
                </td>
                <td className="p-3 font-black text-blue-400 text-sm">
                  {formatCurrency(totalStockValue)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedProductId && (
          <motion.div
            className="fixed inset-0 z-40 flex items-start justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProductId(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="h-full w-full max-w-md overflow-y-auto shadow-2xl border-r border-line"
              style={{
                background: 'var(--bg-panel)',
                backdropFilter: 'blur(24px)',
                fontFamily: "'Tajawal','Cairo',sans-serif",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-line"
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div>
                  <h3 className="text-ink font-bold text-lg">{selectedProduct?.name}</h3>
                  {selectedProduct?.category && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 mt-1 inline-block">
                      {selectedProduct.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedProductId(null)}
                  className="p-2 rounded-xl bg-surface hover:bg-raised transition-colors"
                >
                  <X className="w-4 h-4 text-ink/70" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                {detailLoading ? (
                  <div className="text-center py-8 text-ink/40 text-sm">جاري التحميل...</div>
                ) : detail ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          label: 'الكمية الحالية',
                          value: String(detail.actual_qty),
                          color: 'text-ink text-2xl font-black',
                        },
                        {
                          label: 'متوسط التكلفة',
                          value: formatCurrency(selectedProduct?.cost_price ?? 0),
                          color: 'text-blue-400 text-lg font-black',
                        },
                        {
                          label: 'قيمة المخزون',
                          value: formatCurrency(
                            (selectedProduct?.cost_price ?? 0) * detail.actual_qty
                          ),
                          color: 'text-emerald-400 text-lg font-black',
                        },
                        {
                          label: 'الربح المتوقع',
                          value: formatCurrency(
                            ((selectedProduct?.sale_price ?? 0) -
                              (selectedProduct?.cost_price ?? 0)) *
                              detail.actual_qty
                          ),
                          color: 'text-amber-400 text-lg font-black',
                        },
                      ].map((s) => (
                        <div key={s.label} className="bg-surface rounded-xl p-3 border border-line">
                          <p className="text-ink/40 text-xs mb-1">{s.label}</p>
                          <p className={s.color}>{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {stockChartData.length > 1 && (
                      <div>
                        <p className="text-ink/40 text-xs font-bold mb-3">
                          مستوى المخزون عبر الزمن
                        </p>
                        <ResponsiveContainer width="100%" height={90}>
                          <AreaChart
                            data={stockChartData}
                            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="gStock" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                  offset="5%"
                                  stopColor="var(--status-warning)"
                                  stopOpacity={0.4}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="var(--status-warning)"
                                  stopOpacity={0.02}
                                />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="date"
                              tick={{ fill: 'var(--text-hint)', fontSize: 9 }}
                            />
                            <YAxis hide />
                            <Tooltip
                              contentStyle={{
                                background: 'rgba(10,18,35,0.95)',
                                border: '1px solid var(--edge-md)',
                                borderRadius: 8,
                                fontSize: 11,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="qty"
                              stroke="var(--status-warning)"
                              strokeWidth={1.5}
                              fill="url(#gStock)"
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {detail.movements.length > 0 && (
                      <div>
                        <p className="text-ink/40 text-xs font-bold mb-4">
                          سجل الحركات ({detail.movements.length})
                        </p>
                        <div className="space-y-0">
                          {[...detail.movements].reverse().map((m, i) => {
                            const mv = MOVE_META[m.movement_type] ?? {
                              label: m.movement_type,
                              textCls: 'text-ink/50',
                              dotCls: 'bg-slate-500',
                            };
                            const isAdd = m.quantity > 0;
                            return (
                              <motion.div
                                key={m.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex gap-3"
                              >
                                <div className="flex flex-col items-center flex-shrink-0">
                                  <div
                                    className={`w-3 h-3 rounded-full mt-1 ring-2 ring-black/60 ${mv.dotCls}`}
                                  />
                                  {i < detail.movements.length - 1 && (
                                    <div className="w-px flex-1 bg-surface mt-1 mb-0 min-h-6" />
                                  )}
                                </div>
                                <div
                                  className={`flex-1 ${i < detail.movements.length - 1 ? 'pb-4' : 'pb-2'}`}
                                >
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className={`font-bold text-sm ${mv.textCls}`}>
                                      {mv.label}
                                    </span>
                                    <span
                                      className={`text-sm font-black ${isAdd ? 'text-emerald-400' : 'text-red-400'}`}
                                    >
                                      {isAdd ? '+' : ''}
                                      {m.quantity} وحدة
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-ink/30">
                                    {m.reference_no && (
                                      <span className="font-mono text-ink/40">
                                        {m.reference_no}
                                      </span>
                                    )}
                                    {m.unit_cost > 0 && (
                                      <span>التكلفة: {formatCurrency(m.unit_cost)}</span>
                                    )}
                                    <span>
                                      {m.quantity_before} ← {m.quantity_after}
                                    </span>
                                  </div>
                                  <p className="text-ink/20 text-xs mt-0.5">
                                    {new Date(m.created_at).toLocaleDateString('ar-EG-u-nu-latn', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </p>
                                </div>
                              </motion.div>
                            );
                          })}
                          <div className="flex gap-3 pt-2">
                            <div className="flex-shrink-0">
                              <div className="w-4 h-4 rounded-full bg-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/20" />
                            </div>
                            <div>
                              <span className="text-amber-400 font-bold text-sm">
                                الرصيد الحالي:{' '}
                              </span>
                              <span className="text-ink font-black text-sm">
                                {detail.actual_qty} وحدة
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
