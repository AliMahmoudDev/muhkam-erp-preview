import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type DashboardStats } from '@workspace/api-client-react';
import { authFetch } from '@/lib/auth-fetch';
import { useWarehouse } from '@/contexts/warehouse';
import { useAppSettings } from '@/contexts/app-settings';
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
import { SalesTargetsWidget } from './dashboard/SalesTargetsWidget';
import { EmptyState } from './dashboard/EmptyState';

export default function Dashboard() {
  const { currentWarehouseId } = useWarehouse();
  const { settings } = useAppSettings();
  const isDark = (settings.theme ?? 'dark') === 'dark';
  const warehouseParam = currentWarehouseId ? `?warehouse_id=${currentWarehouseId}` : '';
  const [, navigate] = useLocation();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const queryClient = useQueryClient();

  /* ── Shortcuts query ─────────────────────────────────────── */
  const { data: shortcutsData } = useQuery<{ shortcuts: string[] }>({
    queryKey: ['/api/dashboard/shortcuts'],
    queryFn: () =>
      authFetch(api('/api/dashboard/shortcuts')).then((r) => {
        if (!r.ok) throw new Error('خطأ في جلب الاختصارات');
        return r.json();
      }),
    staleTime: 1000 * 60 * 5,
  });
  const shortcuts = shortcutsData?.shortcuts ?? DEFAULT_SHORTCUTS;

  /* ── Save shortcuts mutation ──────────────────────────────── */
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

  /* ── Chart colors — theme-aware ─────────────────────────── */
  const chartGridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
  const chartAxisStroke = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
  const chartTickColor = isDark ? 'rgba(255,255,255,0.55)' : 'var(--text-2)';
  const chartTickColorY = isDark ? 'rgba(255,255,255,0.40)' : 'var(--text-2)';
  const tooltipBg = isDark ? 'hsla(240,30%,8%,0.96)' : 'var(--text-1)';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const tooltipLabelClr = isDark ? 'rgba(255,255,255,0.55)' : 'var(--text-2)';

  /* ── Loading skeleton ─────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="db-grid-kpi">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="db-skeleton"
              style={{ height: '148px', animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <div className="db-skeleton" style={{ height: '280px' }} />
        <div className="db-grid-bottom">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="db-skeleton"
              style={{ height: '260px', animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────── */
  if (isError || !stats) {
    return (
      <div className="db-error-state" dir="rtl">
        <AlertTriangle
          style={{
            width: 44,
            height: 44,
            color: 'var(--status-warning)',
            margin: '0 auto 16px',
            opacity: 0.7,
          }}
        />
        <p className="db-error-msg">حدث خطأ في تحميل البيانات</p>
      </div>
    );
  }

  const netIsPositive = stats.net_profit >= 0;

  /* ── Chart data ─────────────────────────────────────────── */
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

  /* ── KPI card definitions ────────────────────────────────── */
  const kpiCards = [
    {
      label: 'مبيعات اليوم',
      value: stats.total_sales_today,
      icon: ShoppingCart,
      gradient: 'linear-gradient(135deg, #92400e 0%, #b45309 40%, #d97706 100%)',
      glow: 'rgba(245,158,11,0.30)',
      iconBg: 'rgba(245,158,11,0.20)',
      iconClr: '#fcd34d',
      badge: { up: true, label: 'اليوم' },
    },
    {
      label: 'صافي الربح',
      value: stats.net_profit,
      icon: netIsPositive ? TrendingUp : TrendingDown,
      gradient: netIsPositive
        ? 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #059669 100%)'
        : 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #dc2626 100%)',
      glow: netIsPositive ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)',
      iconBg: netIsPositive ? 'rgba(52,211,153,0.20)' : 'rgba(248,113,113,0.20)',
      iconClr: netIsPositive ? 'var(--status-success)' : 'var(--status-danger)',
      badge: { up: netIsPositive, label: netIsPositive ? 'ربح' : 'خسارة' },
    },
    {
      label: 'ديون العملاء',
      value: stats.total_customer_debts,
      icon: Users,
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
      glow: 'rgba(99,102,241,0.28)',
      iconBg: 'rgba(129,140,248,0.20)',
      iconClr: '#a5b4fc',
      badge: { up: false, label: 'مستحقة' },
    },
    {
      label: 'مستحقات لعملاء',
      value: stats.total_supplier_debts ?? 0,
      icon: Truck,
      gradient: 'linear-gradient(135deg, #164e63 0%, #155e75 40%, #0e7490 100%)',
      glow: 'rgba(6,182,212,0.28)',
      iconBg: 'rgba(6,182,212,0.20)',
      iconClr: '#67e8f9',
      badge: {
        up: (stats.total_supplier_debts ?? 0) === 0,
        label: (stats.total_supplier_debts ?? 0) === 0 ? 'لا ديون' : 'مستحقة',
      },
    },
    {
      label: 'تنبيهات المخزون',
      value: stats.low_stock_products?.length ?? 0,
      icon: Package,
      gradient: 'linear-gradient(135deg, #3b0764 0%, #581c87 40%, #7e22ce 100%)',
      glow: 'rgba(167,139,250,0.28)',
      iconBg: 'rgba(167,139,250,0.20)',
      iconClr: '#e9d5ff',
      badge: {
        up: (stats.low_stock_products?.length ?? 0) === 0,
        label: (stats.low_stock_products?.length ?? 0) === 0 ? 'لا تنبيهات' : 'منتج ناقص',
      },
      rawValue: true,
    },
  ];

  const totalRevenue = stats.total_sales_today + stats.total_income_today;
  const totalOut = stats.total_expenses_today;

  return (
    <div dir="rtl" className="page-enter">
      <OnboardingPanel />

      {/* ══════════════════════════════════════════════════════
          QUICK ACTIONS
      ══════════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {shortcuts.map((id) => {
          const def = ALL_SHORTCUTS.find((s) => s.id === id);
          if (!def) return null;
          const Icon = def.icon;
          return (
            <button
              key={id}
              onClick={() => navigate(def.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 12,
                border: `1px solid ${def.color}33`,
                background: isDark ? `${def.color}14` : `${def.color}11`,
                cursor: 'pointer',
                color: isDark ? 'var(--text-1)' : 'var(--bg-elevated)',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${def.color}28`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${def.color}66`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = isDark
                  ? `${def.color}14`
                  : `${def.color}11`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${def.color}33`;
              }}
            >
              <Icon style={{ width: 15, height: 15, color: def.color }} />
              {def.label}
            </button>
          );
        })}
        <button
          onClick={() => setCustomizerOpen(true)}
          title="تخصيص الاختصارات"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 12,
            transition: 'all 0.18s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          }}
        >
          <Settings2 style={{ width: 14, height: 14 }} />
          تخصيص
        </button>
      </div>

      {/* Shortcuts customizer modal */}
      {customizerOpen && (
        <ShortcutsCustomizer
          current={shortcuts}
          onSave={handleSaveShortcuts}
          onClose={() => setCustomizerOpen(false)}
          saving={saveMutation.isPending}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          HERO SUMMARY STRIP
      ══════════════════════════════════════════════════════ */}
      <div className="erp-hero-strip erp-hero-strip--4col">
        <div className="erp-hero-cell">
          <div
            className="hero-icon-wrap"
            style={{
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.22)',
            }}
          >
            <ShoppingCart style={{ width: 16, height: 16, color: 'var(--status-warning)' }} />
          </div>
          <div>
            <p className="hero-label">إجمالي الإيرادات اليوم</p>
            <p className="hero-value">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="erp-hero-cell">
          <div
            className="hero-icon-wrap"
            style={{
              background: 'rgba(248,113,113,0.15)',
              border: '1px solid rgba(248,113,113,0.22)',
            }}
          >
            <TrendingDown style={{ width: 16, height: 16, color: 'var(--status-danger)' }} />
          </div>
          <div>
            <p className="hero-label">إجمالي المصروفات اليوم</p>
            <p className="hero-value">{formatCurrency(totalOut)}</p>
          </div>
        </div>
        <div className="erp-hero-cell">
          <div
            className="hero-icon-wrap"
            style={{
              background: netIsPositive ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              border: `1px solid ${netIsPositive ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)'}`,
            }}
          >
            {netIsPositive ? (
              <TrendingUp style={{ width: 16, height: 16, color: 'var(--status-success)' }} />
            ) : (
              <TrendingDown style={{ width: 16, height: 16, color: 'var(--status-danger)' }} />
            )}
          </div>
          <div>
            <p className="hero-label">صافي الربح</p>
            <p
              className="hero-value"
              style={{ color: netIsPositive ? 'var(--status-success)' : 'var(--status-danger)' }}
            >
              {formatCurrency(stats.net_profit)}
            </p>
          </div>
        </div>
        <div className="erp-hero-cell">
          <div
            className="hero-icon-wrap"
            style={{
              background:
                (stats.low_stock_products?.length ?? 0) === 0
                  ? 'rgba(52,211,153,0.15)'
                  : 'rgba(245,158,11,0.15)',
              border: `1px solid ${(stats.low_stock_products?.length ?? 0) === 0 ? 'rgba(52,211,153,0.22)' : 'rgba(245,158,11,0.22)'}`,
            }}
          >
            <Package
              style={{
                width: 16,
                height: 16,
                color:
                  (stats.low_stock_products?.length ?? 0) === 0
                    ? 'var(--status-success)'
                    : 'var(--status-warning)',
              }}
            />
          </div>
          <div>
            <p className="hero-label">تنبيهات المخزون</p>
            <p className="hero-value">
              {(stats.low_stock_products?.length ?? 0) === 0
                ? 'المخزون بخير ✓'
                : `${stats.low_stock_products?.length} منتج`}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          KPI CARDS
      ══════════════════════════════════════════════════════ */}
      <div className="db-grid-kpi">
        {kpiCards.map((card, i) => (
          <KpiCard key={card.label} card={card} index={i} />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          BIG CHART — full width
      ══════════════════════════════════════════════════════ */}
      <div className="db-card db-card--chart">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="db-chart-title">النظرة المالية اليوم</h3>
            <p className="db-chart-sub">مقارنة المبيعات والمصروفات والأرباح</p>
          </div>
          <div className="flex gap-5">
            {barData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: d.fill,
                    flexShrink: 0,
                  }}
                />
                <span className="db-legend-label">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {barData.every((d) => d.amount === 0) ? (
          <EmptyState msg="لا توجد بيانات بعد — ابدأ بإضافة أول عملية" height={240} />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barSize={52} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 4" stroke={chartGridStroke} vertical={false} />
              <XAxis
                dataKey="name"
                stroke={chartAxisStroke}
                tick={{ fontSize: 13, fontFamily: 'Tajawal, sans-serif', fill: chartTickColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke={chartAxisStroke}
                tick={{ fontSize: 11, fill: chartTickColorY }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              />
              <Tooltip
                cursor={{
                  fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                  radius: 10,
                }}
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 14,
                  fontSize: 13,
                  fontFamily: 'Tajawal, sans-serif',
                  boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
                }}
                labelStyle={{ color: tooltipLabelClr, marginBottom: 6, fontWeight: 700 }}
                itemStyle={{ color: isDark ? 'var(--text-1)' : 'var(--bg-app)' }}
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

      {/* ══════════════════════════════════════════════════════
          BOTTOM  — 2 columns
      ══════════════════════════════════════════════════════ */}
      <div className="db-grid-bottom">
        {/* ── Recent transactions ──────────────────────── */}
        <div className="db-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="db-card-title">آخر العمليات</h3>
              <p className="db-card-sub">أحدث الحركات المالية</p>
            </div>
            <div className="db-section-badge-blue">
              {stats.recent_transactions?.length ?? 0} حركة
            </div>
          </div>

          {!stats.recent_transactions?.length ? (
            <EmptyState msg="لا توجد عمليات بعد — ابدأ بإضافة أول عملية" />
          ) : (
            <div className="flex flex-col gap-1">
              {stats.recent_transactions
                .slice(0, 7)
                .map((tx: { id: number; type: string; amount: number; created_at: string }) => {
                  const isIncome = TX_IS_INCOME.has(tx.type);
                  const TxIcon = TX_ICONS[tx.type] || DollarSign;
                  const dt = new Date(tx.created_at);
                  const time = dt.toLocaleTimeString('ar-EG-u-nu-latn', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div key={tx.id} className="db-tx-row">
                      <div
                        className="db-tx-icon"
                        style={{
                          background: isIncome ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                          border: `1px solid ${isIncome ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                        }}
                      >
                        <TxIcon
                          style={{
                            width: 16,
                            height: 16,
                            color: isIncome ? 'var(--status-success)' : 'var(--status-danger)',
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="db-tx-label">{TX_LABELS[tx.type] || tx.type}</p>
                        <p className="db-tx-time">{time}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isIncome ? (
                          <ArrowUpRight
                            style={{ width: 14, height: 14, color: 'var(--status-success)' }}
                          />
                        ) : (
                          <ArrowDownRight
                            style={{ width: 14, height: 14, color: 'var(--status-danger)' }}
                          />
                        )}
                        <span
                          className="db-tx-amount"
                          style={{
                            color: isIncome ? 'var(--status-success)' : 'var(--status-danger)',
                          }}
                        >
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* ── Low stock products ───────────────────────── */}
        <div className="db-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="db-card-title">تنبيهات المخزون</h3>
              <p className="db-card-sub">منتجات تحتاج تجديداً</p>
            </div>
            {(stats.low_stock_products?.length ?? 0) > 0 && (
              <div className="db-section-badge-amber">{stats.low_stock_products.length} منتج</div>
            )}
          </div>

          {!stats.low_stock_products?.length ? (
            <div className="erp-empty-state" style={{ padding: '32px 0' }}>
              <div
                className="db-empty-icon"
                style={{
                  background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.20)',
                }}
              >
                <PackageX style={{ width: 24, height: 24, color: 'var(--status-success)' }} />
              </div>
              <div className="text-center">
                <p className="db-tx-label mb-1">المخزون بخير ✓</p>
                <p className="db-tx-time">لا توجد منتجات منخفضة المخزون</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {stats.low_stock_products.slice(0, 7).map((prod) => {
                const outOfStock = Number(prod.quantity) === 0;
                return (
                  <div key={prod.id} className="db-tx-row">
                    <div
                      className="hero-icon-wrap"
                      style={{
                        background: outOfStock ? 'rgba(248,113,113,0.12)' : 'rgba(245,158,11,0.12)',
                        border: `1px solid ${outOfStock ? 'rgba(248,113,113,0.20)' : 'rgba(245,158,11,0.20)'}`,
                      }}
                    >
                      <Package
                        style={{
                          width: 16,
                          height: 16,
                          color: outOfStock ? 'var(--status-danger)' : 'var(--status-warning)',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="db-product-name truncate mb-0.5">{prod.name}</p>
                      <p className="db-product-cat">
                        {outOfStock ? 'نفد من المخزون' : 'مخزون منخفض'}
                      </p>
                    </div>
                    <div
                      className="db-stock-badge"
                      style={{
                        background: outOfStock ? 'rgba(248,113,113,0.15)' : 'rgba(245,158,11,0.15)',
                        color: outOfStock ? 'var(--status-danger)' : 'var(--status-warning)',
                        border: `1px solid ${outOfStock ? 'rgba(248,113,113,0.22)' : 'rgba(245,158,11,0.22)'}`,
                      }}
                    >
                      {outOfStock ? 'نفد' : `${prod.quantity} قطعة`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SALES TARGETS
      ══════════════════════════════════════════════════════ */}
      <SalesTargetsWidget />
    </div>
  );
}
