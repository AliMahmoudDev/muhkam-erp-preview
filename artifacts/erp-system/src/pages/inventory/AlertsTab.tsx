import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { AlertSettingBanner } from '@/components/AlertSettingBanner';
import {
  TrendingDown,
  RefreshCw,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/inventory-export';
import { api } from './_shared';
import type { LowStockItem, TransferPrefill } from './_shared';
import type { ReorderSuggestion } from './alerts/types';
import { POModal } from './alerts/components/POModal';
import { AlertStatsCards } from './alerts/components/AlertStatsCards';
import { AlertsTable } from './alerts/components/AlertsTable';
import { ReorderPanel } from './alerts/components/ReorderPanel';

import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';

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
  const [showReorder, setShowReorder] = useState(false);
  const [selectedForPO, setSelectedForPO] = useState<Set<number>>(new Set());
  const [showPOModal, setShowPOModal] = useState(false);

  const { data, isLoading, refetch } = useQuery<{
    items: LowStockItem[];
    zero_count: number;
    low_count: number;
  }>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => authFetch(api('/api/inventory/low-stock')).then((r) => r.json()),
    staleTime: 30_000,
  });

  const {
    data: reorderData,
    isLoading: loadingReorder,
    refetch: refetchReorder,
  } = useQuery<{
    suggestions: ReorderSuggestion[];
    total_cost: number;
    days_analyzed: number;
    cover_days: number;
  }>({
    queryKey: ['inventory-reorder-suggestions'],
    queryFn: () => authFetch(api('/api/inventory/reorder-suggestions')).then((r) => r.json()),
    enabled: showReorder,
    staleTime: 60_000,
  });

  function handleExportExcel() {
    void exportToExcel({
      filename: `inventory-alerts-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'تنبيهات المخزون',
      title: `تنبيهات المخزون — ${filtered.length} صنف`,
      columns: [
        { header: 'المنتج', key: 'product_name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        { header: 'المخزن', key: 'warehouse_name', width: 18 },
        { header: 'الكمية الحالية', key: 'current_qty', width: 14 },
        { header: 'الحد الأدنى', key: 'min_stock', width: 12 },
        { header: 'العجز', key: 'shortage', width: 12 },
        { header: 'مقترح الطلب', key: 'suggested_qty', width: 14 },
      ],
      rows: filtered,
    });
  }

  function handleExportPDF() {
    exportToPDF({
      filename: 'inventory-alerts',
      title: `تنبيهات المخزون — ${filtered.length} صنف`,
      columns: [
        { header: 'المنتج', key: 'product_name' },
        { header: 'المخزن', key: 'warehouse_name' },
        { header: 'الحالي', key: 'current_qty', format: (r) => r.current_qty.toFixed(2) },
        { header: 'الحد', key: 'min_stock' },
        { header: 'مقترح', key: 'suggested_qty' },
      ],
      rows: filtered,
    });
  }

  function handleExportReorderExcel() {
    if (!reorderData) return;
    void exportToExcel({
      filename: `reorder-suggestions-${new Date().toISOString().slice(0, 10)}`,
      sheetName: 'مقترحات التوريد',
      title: `مقترحات إعادة الطلب — ${reorderData.suggestions.length} صنف — ${formatCurrency(reorderData.total_cost)}`,
      columns: [
        { header: 'المنتج', key: 'product_name', width: 30 },
        { header: 'SKU', key: 'sku', width: 14 },
        {
          header: 'الكمية الحالية',
          key: 'current_qty',
          width: 12,
          format: (r) => r.current_qty.toFixed(2),
        },
        {
          header: 'مبيعات 30 يوم',
          key: 'sold_qty_30d',
          width: 14,
          format: (r) => r.sold_qty_30d.toFixed(2),
        },
        {
          header: 'تغطية (يوم)',
          key: 'coverage_days',
          width: 12,
          format: (r) => r.coverage_days?.toFixed(1) ?? '∞',
        },
        { header: 'مقترح الكمية', key: 'suggested_qty', width: 14 },
        {
          header: 'تكلفة مقدّرة',
          key: 'suggested_cost',
          width: 14,
          format: (r) => r.suggested_cost.toFixed(2),
        },
        { header: 'الأولوية', key: 'priority', width: 10 },
        { header: 'السبب', key: 'reason', width: 30 },
      ],
      rows: reorderData.suggestions,
    });
  }

  function toggleSelectPO(productId: number) {
    setSelectedForPO((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }
  function selectAllPO() {
    const allIds = new Set((reorderData?.suggestions ?? []).map((s) => s.product_id));
    setSelectedForPO(allIds);
  }
  function clearSelectPO() {
    setSelectedForPO(new Set());
  }

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
    return <SkeletonTable rows={4} cols={6} />;
  }

  const reorderSuggestions = reorderData?.suggestions ?? [];
  const poSelectedCount = selectedForPO.size;

  return (
    <div className="space-y-5">
      <AlertSettingBanner
        enabledKey="alert_low_stock_enabled"
        thresholdKey="alert_low_stock_qty"
        title="تنبيه انخفاض المخزون"
        thresholdLabel="حد الكمية"
        thresholdUnit="قطعة"
        icon="📦"
        color="orange"
        defaultThreshold="5"
      />

      {/* Quick stats — clickable for filtering */}
      <AlertStatsCards
        zeroCount={zeroCount}
        lowCount={lowCount}
        showZeroOnly={showZeroOnly}
        setShowZeroOnly={setShowZeroOnly}
        setFilterWH={setFilterWH}
      />

      {/* All good state */}
      {allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
          <CheckCircle className="w-14 h-14 text-emerald-500/30 mb-4" />
          <h3 className="font-bold text-lg mb-1">المخزون في حالة ممتازة</h3>
          <p className="opacity-40 text-sm">لا توجد منتجات تحت حد الطلب الدنى في أي مخزن</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => refetch()}>
            <RefreshCw /> تحديث
          </Button>
        </div>
      )}

      {allItems.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="opacity-50 text-xs">تصفية:</span>

            <select
              value={filterWH}
              onChange={(e) =>
                setFilterWH(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="erp-input h-8 w-auto cursor-pointer text-xs"
              aria-label="تصفية حسب المخزن"
            >
              <option value="all">جميع المخازن</option>
              {uniqueWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <Button
              variant={showZeroOnly ? 'outline' : 'ghost'}
              size="sm"
              className={showZeroOnly ? 'border-[var(--brand)] text-[var(--brand)]' : ''}
              onClick={() => setShowZeroOnly((p) => !p)}
            >
              <TrendingDown /> نافد فقط
            </Button>

            <div className="flex-1" />

            <Button
              variant={showReorder ? 'outline' : 'ghost'}
              size="sm"
              className={showReorder ? 'border-[var(--brand)] text-[var(--brand)]' : ''}
              onClick={() => {
                setShowReorder((p) => !p);
                if (showReorder) setSelectedForPO(new Set());
              }}
            >
              <ShoppingCart /> مقترحات التوريد
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
            >
              <FileSpreadsheet /> Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={filtered.length === 0}
            >
              <FileText /> PDF
            </Button>

            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw /> تحديث
            </Button>
          </div>

          {/* Reorder suggestions panel */}
          {showReorder && (
            <ReorderPanel
              reorderData={reorderData}
              loadingReorder={loadingReorder}
              reorderSuggestions={reorderSuggestions}
              selectedForPO={selectedForPO}
              poSelectedCount={poSelectedCount}
              toggleSelectPO={toggleSelectPO}
              selectAllPO={selectAllPO}
              clearSelectPO={clearSelectPO}
              setShowPOModal={setShowPOModal}
              handleExportReorderExcel={handleExportReorderExcel}
              refetchReorder={() => refetchReorder()}
            />
          )}

          {/* Alerts table */}
          <AlertsTable
            filtered={filtered}
            showZeroOnly={showZeroOnly}
            onTransferPrefill={onTransferPrefill}
          />
        </>
      )}

      {showPOModal && reorderSuggestions.length > 0 && (
        <POModal
          selected={selectedForPO}
          suggestions={reorderSuggestions}
          onClose={() => setShowPOModal(false)}
        />
      )}
    </div>
  );
}

export default AlertsTab;
