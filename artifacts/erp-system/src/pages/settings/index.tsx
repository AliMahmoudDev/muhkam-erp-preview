import { lazy, Suspense, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import {
  Users,
  BookOpen,
  Lock,
  Store,
  Building2,
  FileText,
  HardDrive,
  Database,
  Percent,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { SettingsPattern } from '@/components/patterns';

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
   New groups: إعدادات أساسية / الفواتير والتشغيل / المحاسبة والفترات / النظام
   All 11 tabs preserved; النظام والأمان gets danger flag for risky ops.
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

  /* ─────────── Desktop category nav ─────────── */
  const navSlot = TAB_SECTIONS.map((section) => (
    <div key={section.section} className="space-y-0.5">
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
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-ink/30'}`} />
            <span className="truncate">{tab.label}</span>
            {active && (
              <div className="mr-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  ));

  /* ─────────── Mobile horizontal tab strip ─────────── */
  const mobileTabSlot = (
    <div className="flex gap-1 overflow-x-auto pb-1">
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
  );

  /* ─────────── Active tab content ─────────── */
  const contentSlot = (
    <div className="max-w-4xl mx-auto w-full">
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
        {activeTab === 'security' && (
          <Suspense fallback={<TabSkeleton />}>
            <SecurityTab />
          </Suspense>
        )}
      </Suspense>
    </div>
  );

  return (
    <SettingsPattern
      navSlot={navSlot}
      mobileTabSlot={mobileTabSlot}
      contentSlot={contentSlot}
    />
  );
}
