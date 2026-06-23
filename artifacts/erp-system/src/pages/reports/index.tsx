/**
 * Reports — Analytics-only module
 * Sprint 10: Grouped IA — مالية / مبيعات ومخزون / إدارية
 *
 * Old: 10 flat tabs
 * New: 3 category sections → sub-tabs within each
 * All existing reports preserved; TopReportsTab added to إدارية.
 */
import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, TrendingUp, ShoppingCart, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { api, authFetch, formatCurrency } from './shared';
import { safeArray } from '@/lib/safe-data';

import HealthCheckReport from './HealthCheckReport';
import ProfitLossReport from './ProfitLossReport';
import CashFlowReport from './CashFlowReport';
import BalanceSheetReport from './BalanceSheetReport';
import ProductProfitReport from './ProductProfitReport';
import SalesAnalysisReport from './SalesAnalysisReport';
import TrialBalanceReport from './TrialBalanceReport';
import VatReport from './VatReport';
import AgingReport from './AgingReport';
import CashFlowIndirectReport from './CashFlowIndirectReport';
import TopReportsTab from './TopReportsTab';

interface Warehouse {
  id: number;
  name: string;
}

/* ── Warehouse filter selector ───────────────────────────────────────── */
function WarehouseFilter({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () => authFetch(api('/api/settings/warehouses')).then((r) => r.json()),
    staleTime: 300_000,
  });
  if (!warehouses.length) return null;
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="bg-surface border border-line rounded-xl px-3 py-2 text-sm font-bold text-ink/70 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
    >
      <option value="" className="bg-surface">
        🏪 كل الفروع
      </option>
      {warehouses.map((w) => (
        <option key={w.id} value={w.id} className="bg-surface">
          {w.name}
        </option>
      ))}
    </select>
  );
}

/* ── Types ─────────────────────────────────────────────────────────────── */
interface BsSnapshot {
  assets: { total: number };
  liabilities: { total: number };
  equity: { opening_capital: number; retained_earnings: number; total: number };
  total_liabilities_equity: number;
  balanced: boolean;
}
interface SafeRow {
  balance: string | number;
}

/* ── Financial Consistency Bar ──────────────────────────────────────────── */
function FinancialConsistencyBar() {
  const { data: bs } = useQuery<BsSnapshot>({
    queryKey: ['balance-sheet'],
    queryFn: () =>
      authFetch(api('/api/reports/balance-sheet')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 120_000,
  });
  const { data: safes } = useQuery<SafeRow[]>({
    queryKey: ['/api/settings/safes'],
    queryFn: () =>
      authFetch(api('/api/settings/safes')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 120_000,
  });

  if (!bs || !bs.assets) return null;

  const treasury = safeArray<SafeRow>(safes).reduce((s, safe) => s + Number(safe.balance ?? 0), 0);
  const diff = Math.abs(bs.assets.total - bs.total_liabilities_equity);
  const balanced = bs.balanced;

  const items = [
    {
      label: 'إجمالي الأصول',
      value: formatCurrency(bs.assets.total),
      color: 'var(--status-warning)',
    },
    {
      label: 'رأس المال + الأرباح',
      value: formatCurrency(bs.equity.total),
      color: 'var(--status-success)',
    },
    {
      label: 'الأرباح التراكمية',
      value: formatCurrency(bs.equity.retained_earnings),
      color: 'var(--status-info)',
    },
    { label: 'رصيد الخزينة', value: formatCurrency(treasury), color: '#0ea5e9' },
  ];

  return (
    <div
      className="no-print flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl px-4 py-2.5"
      style={{
        background: balanced ? 'rgba(5,150,105,0.06)' : 'rgba(220,38,38,0.06)',
        border: `1px solid ${balanced ? 'rgba(5,150,105,0.20)' : 'rgba(220,38,38,0.25)'}`,
        fontFamily: "'Tajawal','Cairo',sans-serif",
      }}
      dir="rtl"
    >
      <span
        className="flex items-center gap-1.5 text-xs font-bold shrink-0"
        style={{ color: balanced ? 'var(--status-success)' : 'var(--status-danger)' }}
      >
        {balanced ? (
          <>
            <CheckCircle className="w-3.5 h-3.5" /> الميزانية متوازنة
          </>
        ) : (
          <>
            <AlertTriangle className="w-3.5 h-3.5" /> فرق {formatCurrency(diff)}
          </>
        )}
      </span>
      <span style={{ color: 'var(--edge-md)', fontSize: 18 }}>|</span>
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs shrink-0">
          <span style={{ color: 'var(--text-hint)' }}>{it.label}:</span>
          <span style={{ color: it.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ── Tab & Group config ─────────────────────────────────────────────────── */
type Tab =
  | 'health'
  | 'pl'
  | 'cashflow'
  | 'cashflow-indirect'
  | 'balance'
  | 'products'
  | 'analysis'
  | 'trial-balance'
  | 'vat'
  | 'aging'
  | 'top-reports';

type CategoryId = 'financial' | 'sales' | 'admin';

interface TabDef {
  id: Tab;
  label: string;
  needsWarehouse?: boolean;
}

interface GroupDef {
  id: CategoryId;
  label: string;
  Icon: React.ElementType;
  tabs: TabDef[];
}

const GROUPS: GroupDef[] = [
  {
    id: 'financial',
    label: 'مالية',
    Icon: TrendingUp,
    tabs: [
      { id: 'pl',               label: 'الأرباح والخسائر' },
      { id: 'cashflow',         label: 'التدفق النقدي' },
      { id: 'cashflow-indirect',label: 'التدفق النقدي (غير مباشر)' },
      { id: 'balance',          label: 'الميزانية' },
      { id: 'trial-balance',    label: 'ميزان المراجعة' },
      { id: 'vat',              label: 'ضريبة القيمة المضافة', needsWarehouse: true },
      { id: 'aging',            label: 'أعمار الديون' },
    ],
  },
  {
    id: 'sales',
    label: 'مبيعات ومخزون',
    Icon: ShoppingCart,
    tabs: [
      { id: 'products', label: 'ربحية المنتجات', needsWarehouse: true },
      { id: 'analysis', label: 'تحليل المبيعات', needsWarehouse: true },
    ],
  },
  {
    id: 'admin',
    label: 'إدارية',
    Icon: LayoutGrid,
    tabs: [
      { id: 'health',      label: 'صحة النظام' },
      { id: 'top-reports', label: 'أعلى التقارير' },
    ],
  },
];

function groupOf(t: Tab): GroupDef {
  return GROUPS.find((g) => g.tabs.some((s) => s.id === t)) ?? GROUPS[0];
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function Reports() {
  const { user } = useAuth();
  const canView = hasPermission(user, 'can_view_reports') === true;
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(urlTab ?? 'health');
  const [warehouseId, setWarehouseId] = useState<number | null>(null);

  const activeGroup = groupOf(tab);
  const activeTabDef = activeGroup.tabs.find((t) => t.id === tab);

  const changeTab = (t: Tab) => {
    setTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  const changeGroup = (g: GroupDef) => {
    changeTab(g.tabs[0].id);
  };

  if (!canView)
    return (
      <div
        className="flex flex-col items-center justify-center py-20 text-center"
        style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }}
      >
        <svg
          className="w-14 h-14 text-red-400/40 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 115.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
        <p className="text-ink/60 font-bold text-lg">غير مصرح</p>
        <p className="text-ink/30 text-sm mt-1">
          غير مصرح لك بالوصول إلى التقارير — تواصل مع المدير لتفعيل الصلاحية
        </p>
      </div>
    );

  return (
    <div className="erp-page" style={{ fontFamily: "'Tajawal','Cairo',sans-serif" }} dir="rtl">

      {/* ── Page header ── */}
      <div className="erp-page-header no-print">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            التقارير
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-hint)', marginTop: 2 }}>
            تحليل الأداء المالي والتشغيلي — {activeGroup.label} / {activeTabDef?.label}
          </p>
        </div>
      </div>

      {/* ── Category navigation (Level 1) ── */}
      <div className="no-print flex gap-2 flex-wrap">
        {GROUPS.map((g) => {
          const active = activeGroup.id === g.id;
          return (
            <button
              key={g.id}
              onClick={() => changeGroup(g)}
              className={`erp-btn${active ? '' : ' erp-btn-ghost'} flex items-center gap-2`}
              style={active ? {} : { opacity: 0.65 }}
            >
              <g.Icon style={{ width: 15, height: 15 }} />
              {g.label}
            </button>
          );
        })}
      </div>

      {/* ── Sub-tab navigation (Level 2) ── */}
      <div className="no-print flex overflow-x-auto gap-1.5 bg-surface rounded-2xl p-1.5 border border-line items-center" style={{ scrollbarWidth: 'none' }}>
        {activeGroup.tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t.id
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'text-ink/50 hover:text-ink hover:bg-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
        {activeTabDef?.needsWarehouse && (
          <div className="mr-auto">
            <WarehouseFilter value={warehouseId} onChange={setWarehouseId} />
          </div>
        )}
      </div>

      {/* ── Financial Consistency Bar — always visible ── */}
      <FinancialConsistencyBar />

      {/* ── Report content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'health'            && <HealthCheckReport />}
          {tab === 'pl'               && <ProfitLossReport />}
          {tab === 'cashflow'          && <CashFlowReport />}
          {tab === 'cashflow-indirect' && <CashFlowIndirectReport />}
          {tab === 'balance'           && <BalanceSheetReport />}
          {tab === 'trial-balance'     && <TrialBalanceReport />}
          {tab === 'vat'              && <VatReport warehouseId={warehouseId} />}
          {tab === 'aging'            && <AgingReport />}
          {tab === 'products'         && <ProductProfitReport warehouseId={warehouseId} />}
          {tab === 'analysis'         && <SalesAnalysisReport warehouseId={warehouseId} />}
          {tab === 'top-reports'      && <TopReportsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
