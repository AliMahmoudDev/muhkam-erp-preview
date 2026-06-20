import { AlertTriangle, TrendingDown, ArrowRightLeft } from 'lucide-react';
import type { LowStockItem, TransferPrefill } from '../../_shared';

interface AlertsTableProps {
  filtered: LowStockItem[];
  showZeroOnly: boolean;
  onTransferPrefill: (prefill: TransferPrefill) => void;
}

export function AlertsTable({ filtered, showZeroOnly, onTransferPrefill }: AlertsTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-line bg-surface">
            <th className="p-3 text-right text-ink/60 font-medium">المنتج</th>
            <th className="p-3 text-right text-ink/60 font-medium">المخزن</th>
            <th className="p-3 text-right text-ink/60 font-medium">الكمية الحالية</th>
            <th className="p-3 text-right text-ink/60 font-medium">الحد الدنى</th>
            <th className="p-3 text-right text-ink/60 font-medium">العجز</th>
            <th className="p-3 text-right text-ink/60 font-medium">مقترح الطلب</th>
            <th className="p-3 text-right text-ink/60 font-medium">متاح في مخازن أخرى</th>
            <th className="p-3 text-right text-ink/60 font-medium">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-ink/30 py-10">
                {showZeroOnly
                  ? 'لا توجد منتجات نافدة في هذا المخزن'
                  : 'لا توجد تنبيهات بهذه الفلاتر'}
              </td>
            </tr>
          )}
          {filtered.map((item, idx) => (
            <tr
              key={`${item.product_id}-${item.warehouse_id}-${idx}`}
              className={`border-b border-line erp-table-row ${item.is_zero ? 'bg-red-500/5' : 'bg-amber-500/5'}`}
            >
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {item.is_zero ? (
                    <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-ink font-medium">{item.product_name}</div>
                    {item.sku && <div className="text-ink/40 text-xs">{item.sku}</div>}
                    {item.category && <div className="text-ink/30 text-xs">{item.category}</div>}
                  </div>
                </div>
              </td>
              <td className="p-3">
                <span className="px-2 py-1 rounded-lg text-xs bg-surface text-ink/60 font-medium">
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
                <span className="text-ink/60 font-mono text-sm">{item.min_stock}</span>
              </td>
              <td className="p-3">
                <span className="font-mono text-red-400 text-sm font-bold">
                  {item.shortage > 0 ? `-${item.shortage.toFixed(2)}` : '—'}
                </span>
              </td>
              <td className="p-3">
                <span className="px-2 py-1 rounded-lg text-xs bg-amber-500/10 text-amber-300 font-bold font-mono">
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
                      <div className="text-ink/30 text-xs">
                        +{item.available_elsewhere.length - 2} أخرى
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-ink/25 text-xs">غير متاح</span>
                )}
              </td>
              <td className="p-3">
                <div className="flex flex-col gap-1.5">
                  {item.available_elsewhere.length > 0 && (
                    <button
                      onClick={() =>
                        onTransferPrefill({
                          fromWH: item.available_elsewhere[0].warehouse_id,
                          toWH: item.warehouse_id,
                          productId: item.product_id,
                          productName: item.product_name,
                          qty: Math.min(item.suggested_qty, item.available_elsewhere[0].qty),
                        })
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 transition-all"
                    >
                      <ArrowRightLeft className="w-3 h-3" /> تحويل داخلي
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
