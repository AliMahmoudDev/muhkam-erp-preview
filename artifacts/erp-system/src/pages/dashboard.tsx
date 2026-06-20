/**
 * Dashboard v2 — Sprint 08: Information Architecture Implementation
 *
 * Structure:
 *   HEADER  — title + date + quick actions (erp-btn system)
 *   ZONE 1  — Business Pulse: 4 KPI cards (sales, profit, treasury, targets)
 *   ZONE 2  — Business Alerts: low stock · customer debts · supplier payables
 *   ZONE 3  — Trends: daily bar chart (TODO → weekly line chart)
 *   ZONE 4  — Recent Activity: last 7 transactions
 *
 * Removed:
 *   - Hero strip (erp-hero-strip) — data duplicated from KPI cards
 *   - 5-card KPI grid with gradients/glow — replaced by clean 4-card zone
 *   - Bottom duplicate low-stock panel — moved to Zone 2
 *   - Duplicate net-profit / stock KPI cards — each metric appears once
 *   - SalesTargetsWidget at page bottom — moved to Zone 1 (compact)
 *
 * Fixed:
 *   - "مستحقات لعملاء" (supplier debts mislabelled as customer receivables)
 *     → "مستحقات الموردين" (what the company owes suppliers)
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
  Users,
  AlertTriangle,
  PackageX,
  ShoppingCart,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Truck,
  Settings2,
  Landmark,
  Target,
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
import { KpiCard } from './dashboard/KpiCard';
import { EmptyState } from './dashboard/EmptyState';

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

/* ── Zone section label ───────────────────────────────────── */
function ZoneLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: 'var(--text-hint)',
        marginBottom: -8,
      }}
    >
      {label}
    </p>
  );
}

/* ── Inline loading shimmer (no new CSS class needed) ────── */
function KpiSkeleton({ index }: { index: number }) {
  return (
    <div
      className="erp-kpi"
      style={{ animationDelay: `${index * 0.08}s`, minHeight: 148 }}
      aria-hidden="true"
    >
      <div
        style={{
          height: 12,
          width: '55%',
          borderRadius: 6,
          background: 'var(--edge)',
          animation: 'erp-shimmer-wave 1.6s ease-in-out infinite',
          marginBottom: 16,
        }}
      />
      <div
        style={{
          height: 32,
          width: '75%',
          borderRadius: 8,
          background: 'var(--edge)',
          animation: 'erp-shimmer-wave 1.6s ease-in-out infinite',
          animationDelay: `${index * 0.12 + 0.15}s`,
          marginBottom: 12,
        }}
      />
      <div
        style={{
          height: 10,
          width: '40%',
          borderRadius: 4,
          background: 'var(--edge)',
          animation: 'erp-shimmer-wave 1.6s ease-in-out infinite',
          animationDelay: `${index * 0.12 + 0.3}s`,
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD v2
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
    [saveMutation]
  );

  /* ── Dashboard stats ───────────────────────────────────── */
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', currentWarehouseId],
    queryFn: () =>
      authFetch(api(`/api/dashboard/stats${warehouseParam}`)).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        return r.json();
      }),
  });

  /* ── Treasury balance (existing endpoint — no new API needed) ── */
  const { data: safes, isLoading: safesLoading } = useQuery<Safe[]>({
    queryKey: ['/api/settings/safes'],
    queryFn: () =>
      authFetch(api('/api/settings/safes')).then((r) => (r.ok ? r.json() : [])),
    staleTime: 60_000,
  });
  const treasuryTotal = Array.isArray(safes)
    ? safes.reduce((sum, s) => sum + Number(s.balance ?? 0), 0)
    : 0;

  /* ── Sales targets (existing endpoint) ──────────────────── */
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
  const totalTarget = activeTargets.reduce((sum, r) => sum + r.target_amount, 0);
  const overallPct =
    activeTargets.length > 0 && totalTarget > 0
      ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100))
      : null;

  /* ── Chart colors — theme-aware tokens ─────────────────── */
  const chartGridStroke = 'var(--edge)';
  const chartAxisStroke = 'var(--text-hint)';
  const chartTickColor = 'var(--text-2)';
  const tooltipBg = 'var(--bg-panel)';
  const tooltipBorder = 'var(--edge-md)';
  const tooltipLabelClr = 'var(--text-2)';

  /* ── Loading state ─────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="erp-page" dir="rtl">
        <div
          style={{
            height: 56,
            borderRadius: 12,
            background: 'var(--edge)',
            animation: 'erp-shimmer-wave 1.6s ease-in-out infinite',
          }}
        />
        <div className="erp-kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} index={i} />
          ))}
        </div>
        <div className="erp-card-grid--3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="erp-card"
              style={{
                height: 180,
                animation: 'erp-shimmer-wave 1.6s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <div
          className="erp-card"
          style={{
            height: 300,
            animation: 'erp-shimmer-wave 1.6s ease-in-out infinite',
            animationDelay: '0.2s',
          }}
        />
      </div>
    );
  }

  /* ── Error state ───────────────────────────────────────── */
  if (isError || !stats) {
    return (
      <div
        className="erp-empty-state"
        dir="rtl"
        style={{ padding: '80px 0' }}
        role="alert"
      >
        <AlertTriangle
          style={{
            width: 44,
            height: 44,
            color: 'var(--status-warning)',
            margin: '0 auto 16px',
            opacity: 0.7,
          }}
        />
        <p style={{ color: 'var(--text-2)', fontSize: 15 }}>حدث خطأ في تحميل البيانات</p>
      </div>
    );
  }

  const netIsPositive = stats.net_profit >= 0;

  /* ── Chart data (TODO: replace with /api/dashboard/weekly for 7-day line chart) ── */
  const barData = [
    { name: 'المبيعات', amount: stats.total_sales_today, fill: 'var(--status-warning)' },
    { name: 'المصروفات', amount: stats.total_expenses_today, fill: 'var(--status-danger)' },
    { name: 'الإيرادات', amount: stats.total_income_today, fill: 'var(--status-info)' },
    {
      name: 'صافي الربح',
      amount: Math.abs(stats.net_profit),
      fill: stats.net_profit >= 0 ? 'var(--status-success)' : 'var(--status-danger)',
    },
  ];

  const lowStockCount = stats.low_stock_products?.length ?? 0;
  const supplierDebts = stats.total_supplier_debts ?? 0;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" className="erp-page page-enter">
      <OnboardingPanel />

      {/* ════════════════════════════════════════
          HEADER — title · date · quick actions
      ════════════════════════════════════════ */}
      <div className="erp-page-header">
        <div>
          <h1 className="erp-page-title">لوحة التحكم</h1>
          <p className="erp-page-subtitle">{todayLabel}</p>
        </div>
        <div className="erp-page-actions">
          {shortcuts.map((id) => {
            const def = ALL_SHORTCUTS.find((s) => s.id === id);
            if (!def) return null;
            const Icon = def.icon;
            return (
              <button
                key={id}
                onClick={() => navigate(def.path)}
                className="erp-btn erp-btn-ghost erp-btn-sm"
                style={{ borderColor: `${def.color}33`, color: 'var(--text-1)' }}
              >
                <Icon style={{ width: 14, height: 14, color: def.color, flexShrink: 0 }} />
                {def.label}
              </button>
            );
          })}
          <button
            onClick={() => setCustomizerOpen(true)}
            className="erp-btn erp-btn-ghost erp-btn-sm"
            title="تخصيص الاختصارات"
            aria-label="تخصيص الاختصارات"
          >
            <Settings2 style={{ width: 14, height: 14 }} />
            تخصيص
          </button>
        </div>
      </div>

      {customizerOpen && (
        <ShortcutsCustomizer
          current={shortcuts}
          onSave={handleSaveShortcuts}
          onClose={() => setCustomizerOpen(false)}
          saving={saveMutation.isPending}
        />
      )}

      {/* ════════════════════════════════════════
          ZONE 1 — BUSINESS PULSE
          4 KPIs: sales · profit · treasury · targets
      ════════════════════════════════════════ */}
      <div>
        <ZoneLabel label="نبض الأعمال" />
        <div className="erp-kpi-grid">

          {/* KPI 1 — Sales Today */}
          <KpiCard
            card={{
              label: 'مبيعات اليوم',
              value: stats.total_sales_today,
              icon: ShoppingCart,
              badge: { up: true, label: 'اليوم' },
            }}
            index={0}
          />

          {/* KPI 2 — Net Profit */}
          <KpiCard
            card={{
              label: 'صافي الربح',
              value: stats.net_profit,
              icon: netIsPositive ? TrendingUp : TrendingDown,
              badge: {
                up: netIsPositive,
                label: netIsPositive ? 'ربح' : 'خسارة',
              },
            }}
            index={1}
          />

          {/* KPI 3 — Treasury Balance (from /api/settings/safes) */}
          {safesLoading ? (
            <KpiSkeleton index={2} />
          ) : (
            <KpiCard
              card={{
                label: 'رصيد الخزينة',
                value: treasuryTotal,
                icon: Landmark,
                badge: {
                  up: treasuryTotal >= 0,
                  label: `${safes?.length ?? 0} خزائن`,
                },
              }}
              index={2}
            />
          )}

          {/* KPI 4 — Sales Targets (compact — from /api/sales-targets) */}
          {targetsLoading ? (
            <KpiSkeleton index={3} />
          ) : (
            <div className="erp-kpi" style={{ animationDelay: '0.24s' }}>
              <div className="erp-kpi-header">
                <p className="erp-kpi-label">أهداف المبيعات</p>
                <div className="erp-kpi-icon">
                  <Target />
                </div>
              </div>

              {overallPct !== null ? (
                <>
                  <p className="erp-kpi-value">{overallPct}%</p>
                  {/* Progress bar */}
                  <div
                    role="progressbar"
                    aria-valuenow={overallPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`تقدم الهدف: ${overallPct}%`}
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--edge)',
                      overflow: 'hidden',
                      margin: '6px 0 8px',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${overallPct}%`,
                        background:
                          overallPct >= 100
                            ? 'var(--status-success)'
                            : overallPct >= 60
                              ? 'var(--status-warning)'
                              : 'var(--status-danger)',
                        borderRadius: 2,
                        transition: 'width 0.7s ease',
                      }}
                    />
                  </div>
                  <div
                    className={`erp-kpi-trend ${overallPct >= 100 ? 'erp-kpi-trend--up' : 'erp-kpi-trend--down'}`}
                  >
                    {overallPct >= 100 ? <ArrowUpRight /> : <ArrowDownRight />}
                    <span>{activeTargets.length} مستخدمون نشطون</span>
                  </div>
                </>
              ) : (
                <>
                  <p
                    className="erp-kpi-value"
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: 'var(--text-hint)',
                    }}
                  >
                    لا أهداف مُعيَّنة
                  </p>
                  <div className="erp-kpi-trend erp-kpi-trend--neutral">
                    <span>هذا الشهر</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          ZONE 2 — BUSINESS ALERTS
          Low stock · customer debts · supplier payables
          Each metric appears ONCE.
      ════════════════════════════════════════ */}
      <div>
        <ZoneLabel label="تنبيهات الأعمال" />
        <div className="erp-card-grid--3">

          {/* Alert 1 — Low Stock */}
          <div className="erp-card" style={{ padding: '20px 20px 16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 8,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  تنبيهات المخزون
                </h3>
                <p
                  style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '3px 0 0' }}
                >
                  منتجات تحتاج تجديداً
                </p>
              </div>
              {lowStockCount > 0 && (
                <span className="erp-status erp-status-pending">
                  {lowStockCount} منتج
                </span>
              )}
            </div>

            {lowStockCount === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 0',
                  gap: 8,
                }}
              >
                <PackageX
                  style={{
                    width: 28,
                    height: 28,
                    color: 'var(--status-success)',
                    opacity: 0.7,
                  }}
                />
                <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>المخزون بخير ✓</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {stats.low_stock_products.slice(0, 5).map((prod) => {
                  const outOfStock = Number(prod.quantity) === 0;
                  return (
                    <div
                      key={prod.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 0',
                        borderBottom: '1px solid var(--edge)',
                      }}
                    >
                      <Package
                        style={{
                          width: 13,
                          height: 13,
                          color: outOfStock
                            ? 'var(--status-danger)'
                            : 'var(--status-warning)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12.5,
                          color: 'var(--text-1)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {prod.name}
                      </span>
                      <span
                        className={`erp-status ${outOfStock ? 'erp-status-unpaid' : 'erp-status-pending'}`}
                        style={{ fontSize: 10.5, flexShrink: 0 }}
                      >
                        {outOfStock ? 'نفد' : `${prod.quantity}`}
                      </span>
                    </div>
                  );
                })}
                {lowStockCount > 5 && (
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--text-hint)',
                      textAlign: 'center',
                      marginTop: 8,
                    }}
                  >
                    +{lowStockCount - 5} منتجات أخرى
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Alert 2 — Customer Debts */}
          <div className="erp-card" style={{ padding: '20px 20px 16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 8,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  ديون العملاء
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '3px 0 0' }}>
                  مستحق على العملاء للشركة
                </p>
              </div>
              <Users
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--status-info)',
                  opacity: 0.65,
                  flexShrink: 0,
                }}
              />
            </div>
            <p
              style={{
                fontSize: 26,
                fontWeight: 800,
                color:
                  stats.total_customer_debts > 0
                    ? 'var(--status-danger)'
                    : 'var(--text-1)',
                margin: '4px 0 12px',
                lineHeight: 1.15,
              }}
            >
              {formatCurrency(stats.total_customer_debts)}
            </p>
            <div
              className={`erp-kpi-trend ${stats.total_customer_debts === 0 ? 'erp-kpi-trend--up' : 'erp-kpi-trend--down'}`}
            >
              {stats.total_customer_debts === 0 ? (
                <ArrowUpRight />
              ) : (
                <ArrowDownRight />
              )}
              <span>
                {stats.total_customer_debts === 0
                  ? 'لا ديون مستحقة'
                  : 'مستحق التحصيل'}
              </span>
            </div>
          </div>

          {/* Alert 3 — Supplier Payables — FIXED: was "مستحقات لعملاء" (wrong) */}
          <div className="erp-card" style={{ padding: '20px 20px 16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 8,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                >
                  مستحقات الموردين
                </h3>
                <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '3px 0 0' }}>
                  ديون على الشركة للموردين
                </p>
              </div>
              <Truck
                style={{
                  width: 18,
                  height: 18,
                  color: 'var(--status-warning)',
                  opacity: 0.65,
                  flexShrink: 0,
                }}
              />
            </div>
            <p
              style={{
                fontSize: 26,
                fontWeight: 800,
                color:
                  supplierDebts > 0
                    ? 'var(--status-warning)'
                    : 'var(--text-1)',
                margin: '4px 0 12px',
                lineHeight: 1.15,
              }}
            >
              {formatCurrency(supplierDebts)}
            </p>
            <div
              className={`erp-kpi-trend ${supplierDebts === 0 ? 'erp-kpi-trend--up' : 'erp-kpi-trend--down'}`}
            >
              {supplierDebts === 0 ? <ArrowUpRight /> : <ArrowDownRight />}
              <span>
                {supplierDebts === 0 ? 'لا مستحقات للموردين' : 'مستحق الدفع'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          ZONE 3 — TRENDS
          Daily bar chart.
          TODO: Replace with 7-day line chart when
          /api/dashboard/weekly endpoint is available.
          Required fields: date, sales, expenses, profit (array of 7 days)
      ════════════════════════════════════════ */}
      <div>
        <ZoneLabel label="الاتجاهات" />
        <div className="erp-card" style={{ padding: '20px 24px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: 'var(--text-1)',
                  margin: 0,
                }}
              >
                النظرة المالية اليوم
              </h3>
              <p
                style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}
              >
                مقارنة المبيعات والمصروفات والأرباح
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {barData.map((d) => (
                <div
                  key={d.name}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: d.fill,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {barData.every((d) => d.amount === 0) ? (
            <div style={{ padding: '32px 0' }}>
              <EmptyState msg="لا توجد بيانات بعد — ابدأ بإضافة أول عملية" height={180} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barSize={52} barCategoryGap="35%">
                <CartesianGrid
                  strokeDasharray="3 4"
                  stroke={chartGridStroke}
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke={chartAxisStroke}
                  tick={{
                    fontSize: 13,
                    fontFamily: 'Tajawal, sans-serif',
                    fill: chartTickColor,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke={chartAxisStroke}
                  tick={{ fontSize: 11, fill: chartTickColor }}
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
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 14,
                    fontSize: 13,
                    fontFamily: 'Tajawal, sans-serif',
                    boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
                  }}
                  labelStyle={{
                    color: tooltipLabelClr,
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
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          ZONE 4 — RECENT ACTIVITY
          Last 7 financial transactions.
      ════════════════════════════════════════ */}
      <div>
        <ZoneLabel label="آخر النشاط" />
        <div className="erp-card" style={{ padding: '20px 24px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: 'var(--text-1)',
                  margin: 0,
                }}
              >
                آخر العمليات
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>
                أحدث الحركات المالية
              </p>
            </div>
            <span className="erp-status erp-status-info">
              {stats.recent_transactions?.length ?? 0} حركة
            </span>
          </div>

          {!stats.recent_transactions?.length ? (
            <EmptyState msg="لا توجد عمليات بعد — ابدأ بإضافة أول عملية" height={120} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                    const dt = new Date(tx.created_at);
                    const time = dt.toLocaleTimeString('ar-EG-u-nu-latn', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div
                        key={tx.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 0',
                          borderBottom: '1px solid var(--edge)',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: isIncome
                              ? 'rgba(52,211,153,0.10)'
                              : 'rgba(248,113,113,0.10)',
                            border: `1px solid ${isIncome ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        >
                          <TxIcon
                            style={{
                              width: 15,
                              height: 15,
                              color: isIncome
                                ? 'var(--status-success)'
                                : 'var(--status-danger)',
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-1)',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {TX_LABELS[tx.type] || tx.type}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              color: 'var(--text-4)',
                              margin: '2px 0 0',
                            }}
                          >
                            {time}
                          </p>
                        </div>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          {isIncome ? (
                            <ArrowUpRight
                              style={{
                                width: 14,
                                height: 14,
                                color: 'var(--status-success)',
                              }}
                            />
                          ) : (
                            <ArrowDownRight
                              style={{
                                width: 14,
                                height: 14,
                                color: 'var(--status-danger)',
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isIncome
                                ? 'var(--status-success)'
                                : 'var(--status-danger)',
                            }}
                          >
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
