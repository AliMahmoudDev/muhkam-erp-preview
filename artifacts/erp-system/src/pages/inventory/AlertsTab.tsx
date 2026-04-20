import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { AlertTriangle, TrendingDown, RefreshCw, CheckCircle, Filter, Bell, ArrowRightLeft } from 'lucide-react';
import { api } from './_shared';
import type {
  LowStockItem,
  TransferPrefill,
} from './_shared';

function AlertsTab({
  warehouses: _warehouses,
  currentWarehouseId: _currentWarehouseId,
  onTransferPrefill,
}: {
  warehouses: { id: number; name: string }[];
  currentWarehouseId: number | null;
  onTransferPrefill: (prefill: TransferPrefill) => void;
}) {
  const [filterWH, setFilterWH] = useState<number | 'all'>('all');
  const [showZeroOnly, setShowZeroOnly] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    items: LowStockItem[];
    zero_count: number;
    low_count: number;
  }>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => authFetch(api('/api/inventory/low-stock')).then((r) => r.json()),
    staleTime: 30_000,
  });

  const allItems = data?.items ?? [];
  const zeroCount = data?.zero_count ?? 0;
  const lowCount = data?.low_count ?? 0;

  const uniqueWarehouses = Array.from(
    new Map(allItems.map((i) => [i.warehouse_id, i.warehouse_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filtered = allItems
    .filter((i) => filterWH === 'all' || i.warehouse_id === filterWH)
    .filter((i) => !showZeroOnly || i.is_zero);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`rounded-2xl p-4 border flex items-center gap-3 ${zeroCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/5'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <TrendingDown
              className={`w-5 h-5 ${zeroCount > 0 ? 'text-red-400' : 'text-white/20'}`}
            />
          </div>
          <div>
            <p className="text-white/40 text-xs">نفد المخزون</p>
            <p className={`text-2xl font-bold ${zeroCount > 0 ? 'text-red-400' : 'text-white/30'}`}>
              {zeroCount}
            </p>
          </div>
        </div>
        <div
          className={`rounded-2xl p-4 border flex items-center gap-3 ${lowCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <AlertTriangle
              className={`w-5 h-5 ${lowCount > 0 ? 'text-amber-400' : 'text-white/20'}`}
            />
          </div>
          <div>
            <p className="text-white/40 text-xs">تحت حد الطلب</p>
            <p
              className={`text-2xl font-bold ${lowCount > 0 ? 'text-amber-400' : 'text-white/30'}`}
            >
              {lowCount}
            </p>
          </div>
        </div>
        <div className="rounded-2xl p-4 border bg-white/5 border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-white/20" />
          </div>
          <div>
            <p className="text-white/40 text-xs">إجمالي التنبيهات</p>
            <p
              className={`text-2xl font-bold ${zeroCount + lowCount > 0 ? 'text-white' : 'text-white/30'}`}
            >
              {zeroCount + lowCount}
            </p>
          </div>
        </div>
      </div>

      {/* لا توجد تنبيهات */}
      {allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
          <CheckCircle className="w-14 h-14 text-emerald-500/30 mb-4" />
          <h3 className="text-white font-bold text-lg mb-1">المخزون في حالة ممتازة</h3>
          <p className="text-white/40 text-sm">لا توجد منتجات تحت حد الطلب الدنى في أي مخزن</p>
          <button
            onClick={() => refetch()}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> تحديث
          </button>
        </div>
      )}

      {allItems.length > 0 && (
        <>
          {/* فلاتر */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1 text-white/50 text-xs">
              <Filter className="w-3.5 h-3.5" /> تصفية:
            </div>
            <select
              value={filterWH}
              onChange={(e) =>
                setFilterWH(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/40"
            >
              <option value="all" className="bg-[#1a1a2e]">
                جميع المخازن
              </option>
              {uniqueWarehouses.map((w) => (
                <option key={w.id} value={w.id} className="bg-[#1a1a2e]">
                  {w.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowZeroOnly((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                showZeroOnly
                  ? 'bg-red-500/20 border-red-500/30 text-red-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3 h-3" /> نافد فقط
            </button>
            <div className="flex-1" />
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded-xl transition-colors border border-white/10"
            >
              <RefreshCw className="w-3 h-3" /> تحديث
            </button>
          </div>

          {/* جدول التنبيهات */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-3 text-right text-white/60 font-medium">المنتج</th>
                  <th className="p-3 text-right text-white/60 font-medium">المخزن</th>
                  <th className="p-3 text-right text-white/60 font-medium">الكمية الحالية</th>
                  <th className="p-3 text-right text-white/60 font-medium">الحد الدنى</th>
                  <th className="p-3 text-right text-white/60 font-medium">العجز</th>
                  <th className="p-3 text-right text-white/60 font-medium">مقترح الطلب</th>
                  <th className="p-3 text-right text-white/60 font-medium">متاح في مخازن أخرى</th>
                  <th className="p-3 text-right text-white/60 font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-white/30 py-10">
                      {showZeroOnly
                        ? 'لا توجد منتجات نافدة في هذا المخزن'
                        : 'لا توجد تنبيهات بهذه الفلاتر'}
                    </td>
                  </tr>
                )}
                {filtered.map((item, idx) => (
                  <tr
                    key={`${item.product_id}-${item.warehouse_id}-${idx}`}
                    className={`border-b border-white/5 erp-table-row ${item.is_zero ? 'bg-red-500/5' : 'bg-amber-500/5'}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {item.is_zero ? (
                          <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-white font-medium">{item.product_name}</div>
                          {item.sku && <div className="text-white/40 text-xs">{item.sku}</div>}
                          {item.category && (
                            <div className="text-white/30 text-xs">{item.category}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-lg text-xs bg-white/5 text-white/60 font-medium">
                        {item.warehouse_name}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`font-bold font-mono text-sm ${item.is_zero ? 'text-red-400' : 'text-amber-400'}`}
                      >
                        {item.current_qty.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-white/60 font-mono text-sm">{item.min_stock}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-red-400 text-sm font-bold">
                        {item.shortage > 0 ? `-${item.shortage.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-300 font-bold font-mono">
                        {item.suggested_qty} وحدة
                      </span>
                    </td>
                    <td className="p-3">
                      {item.available_elsewhere.length > 0 ? (
                        <div className="space-y-1">
                          {item.available_elsewhere.slice(0, 2).map((aw) => (
                            <div key={aw.warehouse_id} className="flex items-center gap-2">
                              <span className="text-xs text-emerald-300 font-medium">
                                {aw.warehouse_name}
                              </span>
                              <span className="text-emerald-400 font-mono text-xs font-bold">
                                {aw.qty.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {item.available_elsewhere.length > 2 && (
                            <div className="text-white/30 text-xs">
                              +{item.available_elsewhere.length - 2} أخرى
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/25 text-xs">غير متاح</span>
                      )}
                    </td>
                    <td className="p-3">
                      {item.available_elsewhere.length > 0 ? (
                        <button
                          onClick={() => {
                            const best = item.available_elsewhere[0];
                            onTransferPrefill({
                              fromWH: best.warehouse_id,
                              toWH: item.warehouse_id,
                              productId: item.product_id,
                              productName: item.product_name,
                              qty: Math.min(item.suggested_qty, best.qty),
                            });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors whitespace-nowrap"
                        >
                          <ArrowRightLeft className="w-3 h-3" /> نقل من{' '}
                          {item.available_elsewhere[0].warehouse_name}
                        </button>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AlertsTab;
