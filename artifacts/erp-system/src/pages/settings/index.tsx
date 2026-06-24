import { lazy, Suspense, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import {
  Users,
  BookOpen,
  Lock,
  Store,
  Settings,
  Building2,
  FileText,
  HardDrive,
  Database,
  Cpu,
  Percent,
  TrendingUp,
  AlertTriangle,
  Shield,
} from 'lucide-react';

/* ─── Lazy-load each tab ─── */
const UsersTab = lazy(() => import('./users-tab'));
const OpeningBalanceTab = lazy(() => import('./opening-balance-tab'));
const FinancialLockTab = lazy(() => import('./financial-lock-tab'));
const CurrencyTab = lazy(() => import('./currency-tab'));
const CompanyTab = lazy(() => import('./company-tab'));
const InvoiceTab = lazy(() => import('./invoice-tab'));
const BackupTab = lazy(() => import('./backup-tab'));
const DataTab = lazy(() => import('./data-tab'));
const SecurityTab = lazy(() => import('./security-tab'));
const VatTab = lazy(() => import('./vat-tab'));
const PricingTab = lazy(() => import('./pricing-tab').then((m) => ({ default: m.PricingTab })));

/* ─── Tab types ─── */
type Tab =
  | 'users'
  | 'opening-balance'
  | 'financial-lock'
  | 'currency'
  | 'company'
  | 'invoice'
  | 'vat'
  | 'pricing'
  | 'backup'
  | 'system'
  | 'security';

/* ─── Section config ─────────────────────────────────────────────────────
   Sprint 11 IA refactor:
   Old groups: الإدارة / المالية / التخصيص / النظام
   New groups: إعدادات أساسية / الفواتير والتشغيل / المحاسبة والفترات / النظام والأمان
   All 10 tabs preserved; NظامAndأمان gets danger flag for risky ops.
───────────────────────────────────────────────────────────────────────── */
const TAB_SECTIONS: {
  section: string;
  subtitle?: string;
  danger?: boolean;
  tabs: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[];
}[] = [
  {
    section: 'إعدادات أساسية',
    tabs: [
      { id: 'company', label: 'بيانات الشركة', icon: Building2 },
      { id: 'users',   label: 'المستخدمون',    icon: Users },
      { id: 'currency',label: 'إعدادات المتجر', icon: Store },
    ],
  },
  {
    section: 'الفواتير والتشغيل',
    tabs: [
      { id: 'invoice', label: 'الفاتورة',             icon: FileText },
      { id: 'pricing', label: 'تسعير المنتجات',       icon: TrendingUp },
      { id: 'vat',     label: 'ضريبة القيمة المضافة', icon: Percent },
    ],
  },
  {
    section: 'المحاسبة والفترات',
    tabs: [
      { id: 'opening-balance', label: 'أول المدة',      icon: BookOpen },
      { id: 'financial-lock',  label: 'إغلاق الفترات', icon: Lock },
    ],
  },
  {
    section: 'النظام والأمان',
    subtitle: 'عمليات حساسة — راجع قبل التنفيذ',
    danger: true,
    tabs: [
      { id: 'backup',    label: 'النسخ الاحتياطي', icon: HardDrive },
      { id: 'system',    label: 'إدارة البيانات',  icon: Database },
      { id: 'security',  label: 'أمان الحساب',     icon: Shield },
    ],
  },
];

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-surface rounded-xl" />
      <div className="h-4 w-64 bg-surface rounded-lg" />
      <div className="grid grid-cols-2 gap-4 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-surface rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ─── System Info Card (sidebar bottom) ─── */
function SystemInfoCard() {
  return (
    <div className="mx-3 mb-4 rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
        <Cpu className="w-3 h-3 text-ink/20" />
        <p className="text-ink/20 text-[10px] font-bold uppercase tracking-wider">معلومات النظام</p>
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-ink/25 text-[10px]">الإصدار</span>
          <span className="text-ink/50 text-[10px] font-mono font-bold">v2.1.0</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink/25 text-[10px]">المنصة</span>
          <span className="text-ink/50 text-[10px] font-bold">MUHKAM ERP</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink/25 text-[10px]">الدعم</span>
          <span className="text-emerald-400/70 text-[10px] font-bold">نشط</span>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(urlTab ?? 'users');

  const changeTab = (t: Tab) => {
    setActiveTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  const allTabs = TAB_SECTIONS.flatMap((s) => s.tabs);
  const activeLabel = allTabs.find((t) => t.id === activeTab)?.label ?? '';

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden" dir="rtl">
      {/* ─────────── Sidebar ─────────── */}
      <aside className="settings-sidebar hidden lg:flex flex-col w-56 shrink-0 border-l border-line overflow-y-auto">
        <div className="px-4 pt-6 pb-2 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-ink/60 text-xs font-black uppercase tracking-widest">الإعدادات</p>
        </div>

        <nav className="flex-1 px-3 pb-3 space-y-5 mt-3 overflow-y-auto">
          {TAB_SECTIONS.map((section) => (
            <div key={section.section}>
              <div className="flex items-center gap-1.5 px-2 mb-0.5">
                {section.danger && (
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-red-400/50" />
                )}
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    section.danger ? 'text-red-400/50' : 'text-ink/25'
                  }`}
                >
                  {section.section}
                </p>
              </div>
              {section.subtitle && (
                <p className="text-[9px] text-red-400/40 font-medium px-2 mb-1.5">
                  {section.subtitle}
                </p>
              )}
              {!section.subtitle && <div className="mb-1.5" />}
              <div className="space-y-0.5">
                {section.tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => changeTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-right ${
                        active
                          ? 'bg-amber-500/15 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                          : 'text-ink/40 hover:text-ink hover:bg-surface'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-ink/30'}`}
                      />
                      <span className="truncate">{tab.label}</span>
                      {active && (
                        <div className="mr-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ─── System info card ─── */}
        <SystemInfoCard />
      </aside>

      {/* ─────────── Mobile Tab Bar ─────────── */}
      <div
        className="settings-sidebar lg:hidden fixed bottom-14 left-0 right-0 z-40 border-t border-line px-2 py-1 flex gap-1 overflow-x-auto"
        style={{ background: 'var(--bg-topbar)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        {allTabs.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                active ? 'text-amber-400' : 'text-ink/30 hover:text-ink/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─────────── Main Content ─────────── */}
      <main className="flex-1 overflow-y-auto pb-32 lg:pb-8">
        {/* Mobile header */}
        <div className="settings-sidebar-main lg:hidden sticky top-0 z-30 px-4 py-3 border-b border-line flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-400" />
          <p className="text-ink font-bold text-sm">{activeLabel}</p>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'company' && <CompanyTab />}
            {activeTab === 'opening-balance' && <OpeningBalanceTab />}
            {activeTab === 'financial-lock' && <FinancialLockTab />}
            {activeTab === 'currency' && <CurrencyTab />}
            {activeTab === 'vat' && <VatTab />}
            {activeTab === 'invoice' && <InvoiceTab />}
            {activeTab === 'pricing' && <PricingTab />}
            {activeTab === 'backup' && <BackupTab />}
            {activeTab === 'system' && <DataTab />}
            {activeTab === 'security' && <Suspense fallback={<TabSkeleton />}><SecurityTab /></Suspense>}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
