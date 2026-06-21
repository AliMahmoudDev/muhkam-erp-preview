/**
 * Dashboard V3 — Phase 05 Step 01
 *
 * Rebuilt with DashboardPattern + V3 ui/ components.
 * All business logic, queries, and calculations preserved verbatim from V2.
 *
 * Structure:
 *   1. Header    — title · date · shortcut actions
 *   2. Status    — system health signal (StatusBadge)
 *   3. Alerts    — low-stock · customer debts · supplier payables
 *   4. KPI row   — 4 cards: sales · profit · treasury · targets
 *   5. Chart     — daily bar chart (ChartContainer)
 *   6. Table     — last 7 financial transactions
 *
 * CSS classes used:
 *   erp-* system classes from card.css / data.css / dashboard.css
 *   Tailwind utilities for fine-grained internal layout (flex, gap, truncate …)
 *   No hardcoded colours. No inline visual styles (except Recharts API props).
 *   Physical CSS avoided; inline layout uses flex/gap which are direction-agnostic.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type DashboardStats } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { useWarehouse } from '@/contexts/warehouse';
import { formatCurrency } from '@/lib/format';
import { OnboardingPanel } from '@/components/onboarding';
import ShortcutsCustomizer, { ALL_SHORTCUTS } from '@/components/ShortcutsCustomizer';
import { useLocation } from 'wouter';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  PackageX,
  Truck,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Target,
  Settings2,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { api } from '@/lib/api';
import { TX_LABELS, TX_ICONS, TX_IS_INCOME, DEFAULT_SHORTCUTS } from './dashboard/constants';

/* ── V3 Patterns ───────────────────────────────────────────── */
import { DashboardPattern, PageHeader } from '@/components/patterns';

/* ── V3 UI components ──────────────────────────────────────── */
import { KPICard } from '@/components/ui/kpi-card';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart-container';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

/* ── Local types ───────────────────────────────────────────── */
interface Safe {
  id: number;
  name: string;
  balance: string | number;
}

interface TargetItem {
  user_id: number;
  user_name: string;
  role: string;
  target_amount: number;
  achieved_amount: number;
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD V3
══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { currentWarehouseId } = useWarehouse();
  const warehouseParam = currentWarehouseId ? `?warehouse_id=${currentWarehouseId}` : '';
  const [, navigate] = useLocation();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const queryClient = useQueryClient();

  const todayLabel = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  /* ── Shortcuts ─────────────────────────────────────────── */
  const { data: shortcutsData } = useQuery<{ shortcuts: string[] }>({
    queryKey: ['/api/dashboard/shortcuts'],
    queryFn: () =>
      authFetch(api('/api/dashboard/shortcuts')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب الاختصارات');
        return r.json();
      }),
    staleTime: 300_000,
  });
  const shortcuts = shortcutsData?.shortcuts ?? DEFAULT_SHORTCUTS;

  const saveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const r = await authFetch(api('/api/dashboard/shortcuts'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcuts: ids }),
      });
      if (!r.ok) throw new Error('فشل الحفظ');
      return r.json() as Promise<{ shortcuts: string[] }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/dashboard/shortcuts'], data);
      setCustomizerOpen(false);
    },
  });

  const handleSaveShortcuts = useCallback(
    (ids: string[]) => saveMutation.mutateAsync(ids),
    [saveMutation],
  );

  /* ── Dashboard stats ───────────────────────────────────── */
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', currentWarehouseId],
    queryFn: () =>
      authFetch(api(`/api/dashboard/stats${warehouseParam}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });

  /* ── Treasury balance ───────────────────────────────────── */
  const { data: safes, isLoading: safesLoading } = useQuery<Safe[]>({
    queryKey: ['/api/settings/safes'],
    queryFn: () =>
      authFetch(api('/api/settings/safes')).then((r) => (r.ok ? r.json() : [])),
    staleTime: 60_000,
  });
  const treasuryTotal = Array.isArray(safes)
    ? safes.reduce((sum, s) => sum + Number(s.balance ?? 0), 0)
    : 0;

  /* ── Sales targets ──────────────────────────────────────── */
  const ym = new Date().toISOString().slice(0, 7);
  const { data: targetsData, isLoading: targetsLoading } = useQuery<{
    month: string;
    items: TargetItem[];
  }>({
    queryKey: ['/api/sales-targets', ym],
    queryFn: () =>
      authFetch(api(`/api/sales-targets?month=${ym}`)).then((r) => r.json()),
    staleTime: 60_000,
  });
  const activeTargets = (targetsData?.items ?? []).filter((r) => r.target_amount > 0);
  const totalAchieved = activeTargets.reduce((sum, r) => sum + r.achieved_amount, 0);
  const totalTarget   = activeTargets.reduce((sum, r) => sum + r.target_amount, 0);
  const overallPct =
    activeTargets.length > 0 && totalTarget > 0
      ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100))
      : null;

  /* ── Loading skeleton ───────────────────────────────────── */
  if (isLoading) {
    return (
      <DashboardPattern
        kpiSlot={
          <div className="erp-kpi-grid">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        }
        primaryChartSlot={<Skeleton variant="block" />}
      />
    );
  }

  /* ── Error state ────────────────────────────────────────── */
  if (isError || !stats) {
    return (
      <DashboardPattern
        headerSlot={<PageHeader title="لوحة التحكم" subtitle={todayLabel} />}
        kpiSlot={
          <ErrorState
            variant="server"
            title="حدث خطأ في تحميل البيانات"
            onRetry={() => void refetch()}
          />
        }
      />
    );
  }

  /* ── Derived values ─────────────────────────────────────── */
  const netIsPositive = stats.net_profit >= 0;
  const lowStockCount = stats.low_stock_products?.length ?? 0;
  const supplierDebts = stats.total_supplier_debts ?? 0;

  /* ── Chart data ─────────────────────────────────────────── */
  const barData = [
    { name: 'المبيعات',  amount: stats.total_sales_today,    fill: 'var(--status-warning)' },
    { name: 'المصروفات', amount: stats.total_expenses_today, fill: 'var(--status-danger)'  },
    { name: 'الإيرادات', amount: stats.total_income_today,   fill: 'var(--status-info)'    },
    {
      name: 'صافي الربح',
      amount: Math.abs(stats.net_profit),
      fill: stats.net_profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
    },
  ];

  /* ── System health ──────────────────────────────────────── */
  const hasCriticalAlert = lowStockCount > 0;
  const statusVariant: 'positive' | 'critical' | 'neutral' =
    hasCriticalAlert ? 'critical' : !netIsPositive ? 'neutral' : 'positive';
  const statusLabel =
    hasCriticalAlert
      ? `${lowStockCount} منتج بمخزون منخفض`
      : !netIsPositive
      ? 'لا توجد ربحية اليوم'
      : 'كل شيء على ما يرام';

  /* ── Target progress intent ─────────────────────────────── */
  const targetIntent =
    overallPct === null ? 'default'
    : overallPct >= 100 ? 'positive'
    : overallPct < 60   ? 'negative'
    : 'default';

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <OnboardingPanel />

      {customizerOpen && (
        <ShortcutsCustomizer
          current={shortcuts}
          onSave={handleSaveShortcuts}
          onClose={() => setCustomizerOpen(false)}
          saving={saveMutation.isPending}
        />
      )}

      <DashboardPattern
        className="page-enter"

        /* ── 1. Header ──────────────────────────────────────── */
        headerSlot={
          <PageHeader
            title="لوحة التحكم"
            subtitle={todayLabel}
            actionsSlot={
              <>
                {shortcuts.map((id) => {
                  const def = ALL_SHORTCUTS.find((s) => s.id === id);
                  if (!def) return null;
                  const Icon = def.icon;
                  return (
                    <button
                      key={id}
                      onClick={() => navigate(def.path)}
                      className="erp-btn erp-btn-ghost erp-btn-sm"
                    >
                      <Icon aria-hidden="true" />
                      {def.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCustomizerOpen(true)}
                  className="erp-btn erp-btn-ghost erp-btn-sm"
                  aria-label="تخصيص الاختصارات"
                >
                  <Settings2 aria-hidden="true" />
                  تخصيص
                </button>
              </>
            }
          />
        }

        /* ── 2. Status strip ────────────────────────────────── */
        statusSlot={
          <StatusBadge
            variant={statusVariant}
            label={statusLabel}
            aria-label={`حالة النظام: ${statusLabel}`}
          />
        }

        /* ── 3. Business alert cards — 3-column grid ────────── */
        alertsSlot={
          <div className="erp-card-grid--3">

            {/* A — Inventory alerts */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>تنبيهات المخزون</CardTitle>
                  <CardDescription>منتجات تحتاج تجديداً</CardDescription>
                </div>
                {lowStockCount > 0 && (
                  <StatusBadge variant="critical" label={`${lowStockCount} منتج`} />
                )}
              </CardHeader>
              <CardContent>
                {lowStockCount === 0 ? (
                  <EmptyState
                    icon={<PackageX aria-hidden="true" />}
                    title="المخزون بخير ✓"
                    description="لا توجد منتجات بمخزون منخفض"
                  />
                ) : (
                  <ul role="list" aria-label="منتجات بمخزون منخفض">
                    {stats.low_stock_products.slice(0, 5).map((prod) => {
                      const outOfStock = Number(prod.quantity) === 0;
                      return (
                        <li
                          key={prod.id}
                          className="flex items-center gap-2 py-1.5"
                        >
                          <span className="flex-1 min-w-0 erp-kpi-label truncate">
                            {prod.name}
                          </span>
                          <StatusBadge
                            variant={outOfStock ? 'negative' : 'critical'}
                            label={outOfStock ? 'نفد' : String(prod.quantity)}
                          />
                        </li>
                      );
                    })}
                    {lowStockCount > 5 && (
                      <li className="erp-kpi-period text-center pt-2">
                        +{lowStockCount - 5} منتجات أخرى
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* B — Customer debts */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>ديون العملاء</CardTitle>
                  <CardDescription>مستحق على العملاء للشركة</CardDescription>
                </div>
                <div className="erp-kpi-icon" aria-hidden="true">
                  <Users />
                </div>
              </CardHeader>
              <CardContent>
                <div className="erp-kpi-body">
                  <p className="erp-kpi-value">
                    {formatCurrency(stats.total_customer_debts)}
                  </p>
                  <div
                    className={
                      stats.total_customer_debts === 0
                        ? 'erp-kpi-trend erp-kpi-trend--up'
                        : 'erp-kpi-trend erp-kpi-trend--down'
                    }
                  >
                    {stats.total_customer_debts === 0
                      ? <ArrowUpRight aria-hidden="true" />
                      : <ArrowDownRight aria-hidden="true" />
                    }
                    <span>
                      {stats.total_customer_debts === 0
                        ? 'لا ديون مستحقة'
                        : 'مستحق التحصيل'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C — Supplier payables */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>مستحقات الموردين</CardTitle>
                  <CardDescription>ديون على الشركة للموردين</CardDescription>
                </div>
                <div className="erp-kpi-icon" aria-hidden="true">
                  <Truck />
                </div>
              </CardHeader>
              <CardContent>
                <div className="erp-kpi-body">
                  <p className="erp-kpi-value">
                    {formatCurrency(supplierDebts)}
                  </p>
                  <div
                    className={
                      supplierDebts === 0
                        ? 'erp-kpi-trend erp-kpi-trend--up'
                        : 'erp-kpi-trend erp-kpi-trend--down'
                    }
                  >
                    {supplierDebts === 0
                      ? <ArrowUpRight aria-hidden="true" />
                      : <ArrowDownRight aria-hidden="true" />
                    }
                    <span>
                      {supplierDebts === 0 ? 'لا مستحقات للموردين' : 'مستحق الدفع'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        }

        /* ── 4. KPI row ─────────────────────────────────────── */
        kpiSlot={
          <div className="erp-kpi-grid">

            {/* KPI 1 — Sales today */}
            <KPICard
              label="مبيعات اليوم"
              value={formatCurrency(stats.total_sales_today)}
              icon={<ShoppingCart aria-hidden="true" />}
              comparisonLabel="اليوم"
            />

            {/* KPI 2 — Net profit */}
            <KPICard
              label="صافي الربح"
              value={formatCurrency(stats.net_profit)}
              icon={
                netIsPositive
                  ? <TrendingUp aria-hidden="true" />
                  : <TrendingDown aria-hidden="true" />
              }
              comparisonLabel={netIsPositive ? 'ربح' : 'خسارة'}
            />

            {/* KPI 3 — Treasury (own async loader) */}
            {safesLoading ? (
              <Skeleton variant="card" />
            ) : (
              <KPICard
                label="رصيد الخزينة"
                value={formatCurrency(treasuryTotal)}
                icon={<Landmark aria-hidden="true" />}
                comparisonLabel={`${safes?.length ?? 0} خزائن`}
              />
            )}

            {/* KPI 4 — Sales targets with progress bar */}
            {targetsLoading ? (
              <Skeleton variant="card" />
            ) : (
              <div className="erp-kpi-card">
                <div className="erp-kpi-icon" aria-hidden="true">
                  <Target />
                </div>
                <div className="erp-kpi-body">
                  <p className="erp-kpi-label">أهداف المبيعات</p>
                  {overallPct !== null ? (
                    <>
                      <p className="erp-kpi-value">{overallPct}%</p>
                      <Progress
                        value={overallPct}
                        size="xs"
                        intent={targetIntent}
                        aria-label={`تقدم الهدف: ${overallPct}%`}
                      />
                      <div
                        className={
                          overallPct >= 100
                            ? 'erp-kpi-delta erp-kpi-delta--positive'
                            : 'erp-kpi-delta erp-kpi-delta--negative'
                        }
                      >
                        {overallPct >= 100
                          ? <TrendingUp aria-hidden="true" />
                          : <TrendingDown aria-hidden="true" />
                        }
                        <span>{activeTargets.length} مستخدمون نشطون</span>
                      </div>
                    </>
                  ) : (
                    <p className="erp-kpi-period">لا أهداف مُعيَّنة هذا الشهر</p>
                  )}
                </div>
              </div>
            )}

          </div>
        }

        /* ── 5. Primary chart ───────────────────────────────── */
        primaryChartSlot={
          <ChartContainer
            title="النظرة المالية اليوم"
            legend={
              /* Legend colour swatches are dynamically coloured from CSS token strings.
                 The style prop here only references var(--token) values, never raw hex. */
              <div className="flex flex-wrap gap-4">
                {barData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded shrink-0"
                      style={{ background: d.fill }}
                      aria-hidden="true"
                    />
                    <span className="erp-kpi-label">{d.name}</span>
                  </div>
                ))}
              </div>
            }
            empty={barData.every((d) => d.amount === 0)}
            emptyMessage="لا توجد بيانات بعد — ابدأ بإضافة أول عملية"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barSize={52} barCategoryGap="35%">
                <CartesianGrid
                  strokeDasharray="3 4"
                  stroke="var(--edge)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--text-hint)"
                  tick={{
                    fontSize: 13,
                    fontFamily: 'Tajawal, sans-serif',
                    fill: 'var(--text-2)',
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="var(--text-hint)"
                  tick={{ fontSize: 11, fill: 'var(--text-2)' }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  cursor={{ fill: 'var(--surface)', radius: 10 }}
                  contentStyle={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--edge-md)',
                    borderRadius: 14,
                    fontSize: 13,
                    fontFamily: 'Tajawal, sans-serif',
                  }}
                  labelStyle={{
                    color: 'var(--text-2)',
                    marginBottom: 6,
                    fontWeight: 700,
                  }}
                  itemStyle={{ color: 'var(--text-1)' }}
                  formatter={(v: number) => [formatCurrency(v), '']}
                />
                <Bar dataKey="amount" radius={[10, 10, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} fillOpacity={0.88} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        }

        /* ── 6. Recent transactions ─────────────────────────── */
        tableSlot={
          <Card>
            <CardHeader>
              <div>
                <CardTitle>آخر العمليات</CardTitle>
                <CardDescription>أحدث الحركات المالية</CardDescription>
              </div>
              <span className="erp-status erp-status-info">
                {stats.recent_transactions?.length ?? 0} حركة
              </span>
            </CardHeader>
            <CardContent>
              {!stats.recent_transactions?.length ? (
                <EmptyState
                  title="لا توجد عمليات بعد"
                  description="ابدأ بإضافة أول عملية مالية"
                />
              ) : (
                <ul role="list" aria-label="آخر العمليات المالية">
                  {stats.recent_transactions
                    .slice(0, 7)
                    .map(
                      (tx: {
                        id: number;
                        type: string;
                        amount: number;
                        created_at: string;
                      }) => {
                        const isIncome = TX_IS_INCOME.has(tx.type);
                        const TxIcon = TX_ICONS[tx.type] || DollarSign;
                        const time = new Date(tx.created_at).toLocaleTimeString(
                          'ar-EG-u-nu-latn',
                          { hour: '2-digit', minute: '2-digit' },
                        );
                        return (
                          <li
                            key={tx.id}
                            className="flex items-center gap-3 py-2.5"
                          >
                            <div
                              className="erp-kpi-icon shrink-0"
                              aria-hidden="true"
                            >
                              <TxIcon />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="erp-kpi-label truncate">
                                {TX_LABELS[tx.type] || tx.type}
                              </p>
                              <p className="erp-kpi-period">{time}</p>
                            </div>
                            <div
                              className={
                                isIncome
                                  ? 'erp-kpi-trend erp-kpi-trend--up shrink-0'
                                  : 'erp-kpi-trend erp-kpi-trend--down shrink-0'
                              }
                            >
                              {isIncome
                                ? <ArrowUpRight aria-hidden="true" />
                                : <ArrowDownRight aria-hidden="true" />
                              }
                              <span>{formatCurrency(tx.amount)}</span>
                            </div>
                          </li>
                        );
                      },
                    )}
                </ul>
              )}
            </CardContent>
          </Card>
        }
      />
    </>
  );
}
