import { useState } from 'react';
  import { authFetch } from '@/lib/auth-fetch';
  import { useQuery, useQueryClient } from '@tanstack/react-query';
  import { useWarehouse } from '@/contexts/warehouse';
  import { useAuth } from '@/contexts/auth';
  import { hasPermission } from '@/lib/permissions';
  import { formatCurrency } from '@/lib/format';
  import {
    Package,
  AlertTriangle,
  TrendingDown,
  X,
  ShieldX,
  ClipboardList,
  Truck,
  Plus,
  Trash2,
  Warehouse,
  Loader2,
  Filter,
  BarChart3,
  Bell,
  LayoutDashboard,
  ArrowRight,
  } from 'lucide-react';
  import { useToast } from '@/hooks/use-toast';
  import { safeArray } from '@/lib/safe-data';
  import {
    useGetSettingsWarehouses,
    useCreateSettingsWarehouse,
    useDeleteSettingsWarehouse,
  } from '@workspace/api-client-react';
  import InventoryReport from './reports/InventoryReport';

  import { BASE, api } from './inventory/_shared';
  import type {
    AuditSummary,
    LowStockItem,
    WarehouseSummaryItem,
    TransferPrefill,
    Tab,
  } from './inventory/_shared';
  import { TabBtn, TabBtnBadge, StatCard } from './inventory/_components';
  import ReviewTab from './inventory/ReviewTab';
  import CountTab from './inventory/CountTab';
  import TransferTab from './inventory/TransferTab';
  import AlertsTab from './inventory/AlertsTab';

  /* ═══════════════════════════════════════════════════════════════════════════
 * Main Component
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function Inventory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWarehouseId } = useWarehouse();
  const currentWarehouseIdNum: number | null = currentWarehouseId
    ? Number(currentWarehouseId)
    : null;
  const canViewInventory = hasPermission(user, 'can_view_inventory') === true;
  const canAdjustInventory = hasPermission(user, 'can_adjust_inventory') === true;
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [transferPrefill, setTransferPrefill] = useState<TransferPrefill | null>(null);
  const [movementsFilter, setMovementsFilter] = useState<'all' | 'zero' | 'low'>('all');

  function handleQuickFilter(filter: 'zero' | 'low') {
    setMovementsFilter(filter);
    setActiveTab('movements');
  }

  /* ── warehouse CRUD ── */
  const { data: warehousesRaw, isLoading: loadingWH } = useGetSettingsWarehouses();
  const warehouses = safeArray(warehousesRaw) as {
    id: number; name: string; address: string | null; branch_id: number | null; created_at: string;
  }[];
  const createWH = useCreateSettingsWarehouse();
  const deleteWH = useDeleteSettingsWarehouse();

  /* branches for warehouse assignment */
  const { data: branchesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/branches'],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/branches`);
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

  function handleTransferPrefill(prefill: TransferPrefill) {
    setTransferPrefill(prefill);
    setActiveTab('transfer');
  }

  if (!canViewInventory) {
    return (
      <div
        className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center"
        dir="rtl"
      >
        <ShieldX className="w-16 h-16 text-red-400/50 mb-4" />
        <h2 className="text-xl font-bold text-white/80 mb-2">غير مصرح بالوصول</h2>
        <p className="text-white/40 text-sm">ليس لديك صلاحية لعرض صفحة المخزون</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 text-right" dir="rtl">
      {/* ══ Overview tab: stats + warehouses + quick filters ══════════════════ */}
      {activeTab === 'overview' && (
        <>
          {gs && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="إجمالي المنتجات"
                value={String(gs.total_products)}
                icon={<Package className="w-5 h-5 text-violet-400" />}
                color="text-white"
                bg="bg-violet-500/10 border-violet-500/20"
              />
              <StatCard
                label="قيمة المخزون الكلية"
                value={formatCurrency(grandTotal || gs.total_inventory_value)}
                icon={<BarChart3 className="w-5 h-5 text-emerald-400" />}
                color="text-emerald-400"
                bg="bg-emerald-500/10 border-emerald-500/20"
              />
              <StatCard
                label="تحت حد الطلب"
                value={String(gs.low_stock_count)}
                icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
                color={gs.low_stock_count > 0 ? 'text-amber-400' : 'text-white/40'}
                bg={
                  gs.low_stock_count > 0
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-white/5 border-white/5'
                }
              />
              <StatCard
                label="نفد المخزون"
                value={String(gs.zero_stock_count)}
                icon={<TrendingDown className="w-5 h-5 text-red-400" />}
                color={gs.zero_stock_count > 0 ? 'text-red-400' : 'text-white/40'}
                bg={
                  gs.zero_stock_count > 0
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-white/5 border-white/5'
                }
              />
            </div>
          )}
          {gs && (gs.low_stock_count > 0 || gs.zero_stock_count > 0) && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-white/40 text-xs flex items-center gap-1.5 me-1">
                <Filter className="w-3.5 h-3.5" /> فلاتر سريعة:
              </span>
              {gs.zero_stock_count > 0 && (
                <button
                  onClick={() => handleQuickFilter('zero')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
                >
                  <TrendingDown className="w-3.5 h-3.5" /> عرض نافد المخزون ({gs.zero_stock_count})
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </button>
              )}
              {gs.low_stock_count > 0 && (
                <button
                  onClick={() => handleQuickFilter('low')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> عرض تحت حد الطلب ({gs.low_stock_count})
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </button>
              )}
            </div>
          )}

          {/* ══ قسم إدارة المخازن ════════════════════════════════════════════════ */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">المخازن</h2>
                <p className="text-white/40 text-sm mt-0.5">
                  إدارة مواقع التخزين ومتابعة قيمة كل مخزن
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setWhForm({ name: '', address: '', branch_id: '' });
                    setShowAddWH(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
                >
                  <Plus className="w-4 h-4" /> إضافة مخزن
                </button>
              )}
            </div>

            {loadingWH ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-32 bg-white/5 border border-white/5 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : warehouses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center bg-white/3 border border-white/5 rounded-2xl">
                <Warehouse className="w-10 h-10 text-white/15 mb-3" />
                <p className="text-white/40 font-bold">لا توجد مخازن بعد</p>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setWhForm({ name: '', address: '', branch_id: '' });
                      setShowAddWH(true);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all"
                  >
                    إضافة أول مخزن
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {warehouses.map((w) => {
                  const ws = whSummaryMap.get(w.id);
                  return (
                    <div
                      key={w.id}
                      className="group relative bg-[#111827] border border-white/5 hover:border-violet-500/20 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                    >
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteWHTarget({ id: w.id, name: w.name })}
                          className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                          title="حذف المخزن"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-3">
                        <Warehouse className="w-5 h-5 text-violet-400" />
                      </div>
                      <p className="text-white font-bold text-sm mb-1">{w.name}</p>
                      {w.address && (
                        <p className="text-white/40 text-xs truncate">{w.address}</p>
                      )}
                      {/* الفرع */}
                      {isAdmin && branches.length > 0 ? (
                        <select
                          className="mt-1.5 mb-2 w-full text-[10px] rounded-lg px-2 py-1 bg-white/5 border border-white/10 text-white/50 hover:border-violet-500/30 transition-colors outline-none cursor-pointer"
                          value={w.branch_id ?? ''}
                          onChange={async (e) => {
                            const bid = e.target.value;
                            await authFetch(`${BASE}/api/settings/warehouses/${w.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ branch_id: bid ? Number(bid) : null }),
                            });
                            invalidateWH();
                            qc.invalidateQueries({ queryKey: ['/api/branches'] });
                          }}
                        >
                          <option value="">— بدون فرع —</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      ) : w.branch_id ? (
                        <p className="text-violet-400/70 text-[10px] mb-2">
                          {branches.find(b => b.id === w.branch_id)?.name ?? ''}
                        </p>
                      ) : <div className="mb-2" />}
                      {ws && (
                        <div className="space-y-1 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-white/40 text-xs">قيمة المخزون</span>
                            <span className="text-emerald-400 text-xs font-bold">
                              {formatCurrency(ws.total_value)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/40 text-xs">عدد المنتجات</span>
                            <span className="text-white/70 text-xs font-bold">{ws.item_count}</span>
                          </div>
                          {grandTotal > 0 && (
                            <div className="mt-1.5">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-white/30 text-xs">من الإجمالي</span>
                                <span className="text-violet-300 text-xs font-bold">
                                  {ws.pct_of_total}%
                                </span>
                              </div>
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-violet-400 rounded-full transition-all"
                                  style={{ width: `${ws.pct_of_total}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {currentWarehouseIdNum === w.id && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-lg text-xs bg-violet-500/20 text-violet-300 font-medium">
                          المخزن الحالي
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ══ تبويبات المخزون ══════════════════════════════════════════════════ */}
      <div>
        <div className="flex gap-2 border-b border-white/10 mb-6 flex-wrap">
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
            <TabBtn
              id="transfer"
              label="التحويلات"
              icon={<Truck className="w-4 h-4" />}
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
        </div>

        {activeTab === 'overview' && !gs && (
          <div className="text-center py-20 text-white/30 text-sm">
            جاري تحميل بيانات المخزون...
          </div>
        )}
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
        {activeTab === 'transfer' && (
          <TransferTab
            warehouses={warehouses}
            qc={qc}
            toast={toast}
            prefill={transferPrefill}
            onClearPrefill={() => setTransferPrefill(null)}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab
            warehouses={warehouses}
            currentWarehouseId={currentWarehouseIdNum}
            onTransferPrefill={handleTransferPrefill}
          />
        )}
        {activeTab === 'reports' && <InventoryReport />}
      </div>

      {/* ── Modal: إضافة مخزن ── */}
      {showAddWH && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddWH(false)}
        >
          <div
            className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-violet-400" /> إضافة مخزن جديد
              </h3>
              <button
                onClick={() => setShowAddWH(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-white/60 text-xs mb-1.5">
                  اسم المخزن <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="المخزن الرئيسي"
                  value={whForm.name}
                  onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs mb-1.5">العنوان (اختياري)</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="القاهرة، مصر"
                  value={whForm.address}
                  onChange={(e) => setWhForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              {branches.length > 0 && (
                <div>
                  <label className="block text-white/60 text-xs mb-1.5">الفرع (اختياري)</label>
                  <select
                    className="glass-input w-full"
                    value={whForm.branch_id}
                    onChange={(e) => setWhForm((f) => ({ ...f, branch_id: e.target.value }))}
                  >
                    <option value="">— بدون فرع —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                disabled={createWH.isPending}
                onClick={async () => {
                  if (!whForm.name.trim()) {
                    toast({ title: 'الاسم مطلوب', variant: 'destructive' });
                    return;
                  }
                  try {
                    const r = await authFetch(`${BASE}/api/settings/warehouses`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: whForm.name.trim(),
                        address: whForm.address.trim() || undefined,
                        branch_id: whForm.branch_id ? Number(whForm.branch_id) : undefined,
                      }),
                    });
                    if (!r.ok) throw new Error((await r.json()).error ?? 'فشل الإضافة');
                    invalidateWH();
                    qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
                    toast({ title: 'تم إضافة المخزن بنجاح' });
                    setWhForm({ name: '', address: '', branch_id: '' });
                    setShowAddWH(false);
                  } catch (e: any) {
                    toast({ title: e?.message ?? 'فشل الإضافة', variant: 'destructive' });
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {createWH.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة
              </button>
              <button
                onClick={() => setShowAddWH(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 font-bold text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: حذف مخزن ── */}
      {deleteWHTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteWHTarget(null)}
        >
          <div
            className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Warehouse className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">حذف المخزن</h3>
            <p className="text-white/50 text-sm mb-1">
              هل تريد حذف <span className="text-red-400 font-bold">"{deleteWHTarget.name}"</span>؟
            </p>
            <p className="text-white/30 text-xs mb-6">
              لا يمكن حذف مخزن له حركات أو جلسات جرد أو تحويلات مسجّلة
            </p>
            <div className="flex gap-3">
              <button
                disabled={deleteWH.isPending}
                onClick={() =>
                  deleteWH.mutate(deleteWHTarget.id, {
                    onSuccess: () => {
                      invalidateWH();
                      qc.invalidateQueries({ queryKey: ['inventory-warehouse-summary'] });
                      toast({ title: 'تم حذف المخزن' });
                      setDeleteWHTarget(null);
                    },
                    onError: (e: any) => {
                      toast({ title: e?.message ?? 'فشل الحذف', variant: 'destructive' });
                      setDeleteWHTarget(null);
                    },
                  })
                }
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {deleteWH.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                حذف
              </button>
              <button
                onClick={() => setDeleteWHTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 font-bold text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
  