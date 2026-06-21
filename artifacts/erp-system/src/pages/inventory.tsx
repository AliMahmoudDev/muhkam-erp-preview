import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWarehouse } from '@/contexts/warehouse';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { formatCurrency } from '@/lib/format';
import { exportToExcelMulti } from '@/lib/inventory-export';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  ClipboardList,
  Truck,
  BarChart3,
  Bell,
  LayoutDashboard,
  ArrowRight,
  Shield,
  Archive,
  Trash2,
} from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { safeArray } from '@/lib/safe-data';
import { useGetSettingsWarehouses } from '@workspace/api-client-react';
import InventoryReport from './reports/InventoryReport';
import ConsignmentPage from '@/pages/consignment';
import ScrapInventory from '@/pages/scrap-inventory';

import { api } from './inventory/_shared';
import type { AuditSummary, LowStockItem, WarehouseSummaryItem, Tab } from './inventory/_shared';
import { TabBtn, TabBtnBadge } from './inventory/_components';
import ReviewTab from './inventory/ReviewTab';
import CountTab from './inventory/count';
import AlertsTab from './inventory/AlertsTab';
import WarehouseSection from './inventory/WarehouseSection';

import { PageHeader } from '@/components/patterns';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════════════════
 * Main Component
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function Inventory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWarehouseId, setWarehouseId } = useWarehouse();
  const currentWarehouseIdNum: number | null = currentWarehouseId
    ? Number(currentWarehouseId)
    : null;
  const canViewInventory = hasPermission(user, 'can_view_inventory') === true;
  const canAdjustInventory = hasPermission(user, 'can_adjust_inventory') === true;
  const isAdmin = user?.role === 'admin';

  const [, navigate] = useLocation();
  const search = useSearch();
  const tabFromUrl = new URLSearchParams(search).get('tab') as Tab | null;
  const VALID_TABS: Tab[] = [
    'overview',
    'movements',
    'count',
    'alerts',
    'reports',
    'consignment',
    'scrap',
  ];
  const [activeTab, setActiveTab] = useState<Tab>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview'
  );
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [movementsFilter, setMovementsFilter] = useState<'all' | 'zero' | 'low'>('all');

  /* ── warehouse detail modal ── */
  const [warehouseDetailId, setWarehouseDetailId] = useState<number | null>(null);

  function handleQuickFilter(filter: 'zero' | 'low') {
    setMovementsFilter(filter);
    setActiveTab('movements');
  }

  /* ── warehouse CRUD ── */
  const { data: warehousesRaw, isLoading: loadingWH } = useGetSettingsWarehouses();
  const warehouses = safeArray(warehousesRaw) as {
    id: number;
    name: string;
    address: string | null;
    branch_id: number | null;
    created_at: string;
  }[];
  const createWH = useMutation({
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      const r = await authFetch(api('/api/settings/warehouses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const deleteWH = useMutation({
    mutationFn: async (id: number) => {
      const r = await authFetch(api(`/api/settings/warehouses/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });

  /* branches for warehouse assignment */
  const { data: branchesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/branches'],
    queryFn: async () => {
      const r = await authFetch(api('/api/branches'));
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : (j.branches ?? []);
    },
    staleTime: 120_000,
  });
  const branches = safeArray(branchesRaw) as { id: number; name: string }[];

  const [showAddWH, setShowAddWH] = useState(false);
  const [deleteWHTarget, setDeleteWHTarget] = useState<{ id: number; name: string } | null>(null);
  const [whForm, setWhForm] = useState({ name: '', address: '', branch_id: '' });
  const invalidateWH = () => qc.invalidateQueries({ queryKey: ['/api/settings/warehouses'] });

  /* ── per-warehouse summary ── */
  const { data: whSummaryData } = useQuery<{
    warehouses: WarehouseSummaryItem[];
    grand_total: number;
  }>({
    queryKey: ['inventory-warehouse-summary'],
    queryFn: () => authFetch(api('/api/inventory/warehouse-summary')).then((r) => r.json()),
    staleTime: 60_000,
    enabled: canViewInventory,
  });
  const whSummaryMap = new Map((whSummaryData?.warehouses ?? []).map((s) => [s.warehouse_id, s]));
  const grandTotal = whSummaryData?.grand_total ?? 0;

  /* ── global stats for header ── */
  const { data: globalAudit } = useQuery<{ summary: AuditSummary }>({
    queryKey: ['inventory-audit', null],
    queryFn: () => authFetch(api('/api/inventory/audit')).then((r) => r.json()),
    staleTime: 300_000,
    enabled: canViewInventory,
  });
  const gs = globalAudit?.summary;

  /* ── low-stock badge count ── */
  const { data: lowStockMeta } = useQuery<{
    items: LowStockItem[];
    zero_count: number;
    low_count: number;
  }>({
    queryKey: ['inventory-low-stock'],
    queryFn: () => authFetch(api('/api/inventory/low-stock')).then((r) => r.json()),
    staleTime: 60_000,
    enabled: canViewInventory,
  });
  const alertsBadge = (lowStockMeta?.zero_count ?? 0) + (lowStockMeta?.low_count ?? 0);

  /* ── products list for export (T4) + warehouse detail modal (T2) ── */
  interface AuditProductLite {
    id: number;
    name: string;
    sku: string | null;
    category: string | null;
    actual_qty: number;
    total_value: number;
    low_stock_threshold: number | null;
    cost_price: number;
    sale_price: number;
  }
  const { data: overviewAudit } = useQuery<{ products: AuditProductLite[] }>({
    queryKey: ['inventory-audit-products'],
    queryFn: () => authFetch(api('/api/inventory/audit')).then((r) => r.json()),
    staleTime: 300_000,
    enabled: canViewInventory,
  });
  const allProducts = overviewAudit?.products ?? [];

  /* ── warehouse detail products (T2) ── */
  const { data: whDetailAudit, isLoading: whDetailLoading } = useQuery<{
    products: AuditProductLite[];
  }>({
    queryKey: ['inventory-audit-products-wh', warehouseDetailId],
    queryFn: () =>
      authFetch(api(`/api/inventory/audit?warehouse_id=${warehouseDetailId!}`)).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
    enabled: warehouseDetailId !== null,
  });
  const whDetailProducts = whDetailAudit?.products ?? [];

  /* ── overview export (T4) ── */
  async function handleOverviewExport() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const whRows = (whSummaryData?.warehouses ?? []).map((w) => ({
      name: warehouses.find((x) => x.id === w.warehouse_id)?.name ?? String(w.warehouse_id),
      item_count: w.item_count,
      total_value: w.total_value,
      pct_of_total: w.pct_of_total,
    }));
    await exportToExcelMulti({
      filename: `inventory-overview-${dateStr}`,
      sheets: [
        {
          sheetName: 'الإحصائيات',
          title: `إحصائيات المخزون — ${dateStr}`,
          columns: [
            { header: 'البند', key: 'label', width: 28 },
            { header: 'القيمة', key: 'value', width: 22 },
          ],
          rows: gs
            ? [
                { label: 'إجمالي المنتجات', value: gs.total_products },
                {
                  label: 'قيمة المخزون الكلية',
                  value: formatCurrency(grandTotal || gs.total_inventory_value),
                },
                { label: 'تحت حد الطلب', value: gs.low_stock_count },
                { label: 'نفد المخزون', value: gs.zero_stock_count },
              ]
            : [],
        },
        {
          sheetName: 'المخازن',
          title: `تفاصيل المخازن — ${dateStr}`,
          columns: [
            { header: 'اسم المخزن', key: 'name', width: 25 },
            { header: 'عدد الأصناف', key: 'item_count', width: 14 },
            { header: 'قيمة المخزون', key: 'total_value', width: 18 },
            { header: 'نسبة من الإجمالي', key: 'pct_of_total', width: 18 },
          ],
          rows: whRows as Record<string, unknown>[],
        },
        {
          sheetName: 'المنتجات',
          title: `قائمة المنتجات — ${dateStr}`,
          columns: [
            { header: 'المنتج', key: 'name', width: 30 },
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'التصنيف', key: 'category', width: 18 },
            { header: 'الكمية الفعلية', key: 'actual_qty', width: 15 },
            { header: 'تكلفة الوحدة', key: 'cost_price', width: 15 },
            { header: 'قيمة المخزون', key: 'total_value', width: 18 },
          ],
          rows: allProducts as unknown as Record<string, unknown>[],
        },
      ],
    });
  }

  function handleTransferPrefill() {
    navigate('/transfers');
  }

  /* ── Permission gate ──────────────────────────────────────── */
  if (!canViewInventory) {
    return (
      <EmptyState
        variant="no-data"
        title="غير مصرح بالوصول"
        description="ليس لديك صلاحية لعرض صفحة المخزون"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ══ Page Header ═══════════════════════════════════════════════════════ */}
      <PageHeader
        title="المخزون"
        subtitle="إدارة المنتجات والكميات وحركات المخزون"
      />

      {/* ══ Tab bar ═══════════════════════════════════════════════════════════ */}
      <div
        className="erp-tab-bar erp-tab-bar--underline overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <TabBtn
          id="overview"
          label="نظرة عامة"
          icon={<LayoutDashboard className="w-4 h-4" />}
          active={activeTab}
          onClick={setActiveTab}
        />
        <TabBtn
          id="movements"
          label="الحركات"
          icon={<Package className="w-4 h-4" />}
          active={activeTab}
          onClick={setActiveTab}
        />
        {canAdjustInventory && (
          <TabBtn
            id="count"
            label="الجرد"
            icon={<ClipboardList className="w-4 h-4" />}
            active={activeTab}
            onClick={setActiveTab}
          />
        )}
        {canAdjustInventory && (
          <Link to="/transfers">
            <button className="erp-tab">
              <Truck className="w-4 h-4" />
              التحويلات بين الفروع
            </button>
          </Link>
        )}
        {canAdjustInventory && (
          <TabBtn
            id="consignment"
            label="الائتمان"
            icon={<Archive className="w-4 h-4" />}
            active={activeTab}
            onClick={setActiveTab}
          />
        )}
        <TabBtnBadge
          id="alerts"
          label="تنبيهات المخزون"
          icon={<Bell className="w-4 h-4" />}
          badge={alertsBadge}
          active={activeTab}
          onClick={setActiveTab}
        />
        <TabBtn
          id="reports"
          label="تقارير المخزون"
          icon={<BarChart3 className="w-4 h-4" />}
          active={activeTab}
          onClick={setActiveTab}
        />
        <TabBtn
          id="scrap"
          label="مخزن التوالف"
          icon={<Trash2 className="w-4 h-4" />}
          active={activeTab}
          onClick={setActiveTab}
        />
      </div>

      {/* ══ Overview tab ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && !gs && (
        <SkeletonTable rows={1} cols={4} />
      )}

      {activeTab === 'overview' && gs && (
        <>
          {/* ── KPI stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('reports')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('reports'); }}
              title="عرض تقارير المخزون"
              className="cursor-pointer"
            >
              <StatCard
                label="إجمالي المنتجات"
                value={String(gs.total_products)}
                icon={<Package className="w-5 h-5" />}
              />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('reports')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('reports'); }}
              title="عرض تقارير المخزون"
              className="cursor-pointer"
            >
              <StatCard
                label="قيمة المخزون الكلية"
                value={
                  <span className="text-emerald-400">
                    {formatCurrency(grandTotal || gs.total_inventory_value)}
                  </span>
                }
                icon={<BarChart3 className="w-5 h-5" />}
              />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('alerts')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('alerts'); }}
              title="عرض تنبيهات المخزون"
              className="cursor-pointer"
            >
              <StatCard
                label="تحت حد الطلب"
                value={
                  <span className={gs.low_stock_count > 0 ? 'text-amber-400' : 'opacity-40'}>
                    {String(gs.low_stock_count)}
                  </span>
                }
                icon={<AlertTriangle className="w-5 h-5" />}
              />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setActiveTab('alerts')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('alerts'); }}
              title="عرض تنبيهات المخزون"
              className="cursor-pointer"
            >
              <StatCard
                label="نفد المخزون"
                value={
                  <span className={gs.zero_stock_count > 0 ? 'text-red-400' : 'opacity-40'}>
                    {String(gs.zero_stock_count)}
                  </span>
                }
                icon={<TrendingDown className="w-5 h-5" />}
              />
            </div>
          </div>

          {/* ── Audit log link (admin only) ── */}
          {isAdmin && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link href={api('/audit-log')}>
                  <Shield className="w-3.5 h-3.5" /> سجل المراجعات الكامل
                </Link>
              </Button>
            </div>
          )}

          {/* ── Quick filter shortcuts ── */}
          {(gs.low_stock_count > 0 || gs.zero_stock_count > 0) && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs opacity-50 flex items-center gap-1 me-1">
                فلاتر سريعة:
              </span>
              {gs.zero_stock_count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFilter('zero')}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  عرض نافد المخزون ({gs.zero_stock_count})
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </Button>
              )}
              {gs.low_stock_count > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFilter('low')}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  عرض تحت حد الطلب ({gs.low_stock_count})
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </Button>
              )}
            </div>
          )}

          {/* ── Warehouse section ── */}
          <WarehouseSection
            warehouses={warehouses}
            branches={branches}
            whSummaryMap={whSummaryMap}
            grandTotal={grandTotal}
            currentWarehouseIdNum={currentWarehouseIdNum}
            isAdmin={isAdmin}
            canAdjustInventory={canAdjustInventory}
            loadingWH={loadingWH}
            allProducts={allProducts}
            whDetailProducts={whDetailProducts}
            whDetailLoading={whDetailLoading}
            setWarehouseId={setWarehouseId}
            createWH={createWH}
            deleteWH={deleteWH}
            invalidateWH={invalidateWH}
            qc={qc}
            toast={toast}
            handleOverviewExport={handleOverviewExport}
            showAddWH={showAddWH}
            setShowAddWH={setShowAddWH}
            deleteWHTarget={deleteWHTarget}
            setDeleteWHTarget={setDeleteWHTarget}
            warehouseDetailId={warehouseDetailId}
            setWarehouseDetailId={setWarehouseDetailId}
            whForm={whForm}
            setWhForm={setWhForm}
          />
        </>
      )}

      {/* ══ Other tabs ════════════════════════════════════════════════════════ */}
      {activeTab === 'movements' && (
        <ReviewTab
          currentWarehouseId={currentWarehouseIdNum}
          canAdjustInventory={canAdjustInventory}
          qc={qc}
          toast={toast}
          quickFilter={movementsFilter}
          onFilterApplied={() => setMovementsFilter('all')}
        />
      )}
      {activeTab === 'count' && (
        <CountTab
          warehouses={warehouses}
          currentWarehouseId={currentWarehouseIdNum}
          qc={qc}
          toast={toast}
        />
      )}
      {activeTab === 'alerts' && (
        <AlertsTab
          warehouses={warehouses}
          currentWarehouseId={currentWarehouseIdNum}
          onTransferPrefill={handleTransferPrefill}
        />
      )}
      {activeTab === 'consignment' && <ConsignmentPage />}
      {activeTab === 'reports' && <InventoryReport />}
      {activeTab === 'scrap' && <ScrapInventory embedded />}
    </div>
  );
}
