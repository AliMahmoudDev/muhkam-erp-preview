import { lazy, Suspense, useState } from 'react';
import {
  Users,
  BookOpen,
  Lock,
  Store,
  Settings,
  Building2,
  Bell,
  FileText,
  HardDrive,
  Percent,
  Banknote,
} from 'lucide-react';

const UsersTab          = lazy(() => import('./users-tab'));
const OpeningBalanceTab = lazy(() => import('./opening-balance-tab'));
const FinancialLockTab  = lazy(() => import('./financial-lock-tab'));
const CurrencyTab       = lazy(() => import('./currency-tab'));
const CompanyTab        = lazy(() => import('./company-tab'));
const AlertsTab         = lazy(() => import('./alerts-tab'));
const InvoiceTab        = lazy(() => import('./invoice-tab'));
const SystemTab         = lazy(() => import('./system-tab'));
const VatTab            = lazy(() => import('./vat-tab'));
const SalaryAdvanceTab  = lazy(() => import('./salary-advance-tab'));

type Tab =
  | 'users' | 'opening-balance' | 'financial-lock' | 'currency'
  | 'company' | 'alerts' | 'invoice' | 'vat' | 'salary-advance' | 'system';

const TABS: {
  id: Tab;
  label: string;
  icon: React.FC<{ size?: number; color?: string }>;
  color: string;
}[] = [
  { id: 'company',         label: 'بيانات الشركة',          icon: Building2, color: '#f59e0b' },
  { id: 'users',           label: 'المستخدمون',               icon: Users,     color: '#6366f1' },
  { id: 'currency',        label: 'إعدادات المتجر',           icon: Store,     color: '#10b981' },
  { id: 'invoice',         label: 'الفاتورة',                icon: FileText,  color: '#3b82f6' },
  { id: 'vat',             label: 'ضريبة القيمة المضافة',     icon: Percent,   color: '#ec4899' },
  { id: 'alerts',          label: 'التنبيهات',                icon: Bell,      color: '#f97316' },
  { id: 'opening-balance', label: 'أرصدة أول المدة',         icon: BookOpen,  color: '#8b5cf6' },
  { id: 'financial-lock',  label: 'إغلاق الفترات المالية',   icon: Lock,      color: '#ef4444' },
  { id: 'salary-advance',  label: 'السلف والاقتطاعات',       icon: Banknote,  color: '#14b8a6' },
  { id: 'system',          label: 'النسخ الاحتياطي',         icon: HardDrive, color: '#64748b' },
];

function TabSkeleton() {
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: '60px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }} />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div dir="rtl" style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--erp-bg-main, #0D1424)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Page header ── */}
      <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={17} color="#f59e0b" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#f1f5f9' }}>الإعدادات</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '1px' }}>{active.label}</p>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '2px',
        overflowX: 'auto',
        padding: '16px 24px 0',
        scrollbarWidth: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 14px 10px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2.5px solid ${isActive ? tab.color : 'transparent'}`,
                color: isActive ? tab.color : '#64748b',
                fontSize: '13px',
                fontWeight: isActive ? 800 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                outline: 'none',
                borderRadius: '0',
                marginBottom: '-1px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                  (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'rgba(255,255,255,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
                  (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'transparent';
                }
              }}
            >
              <Icon size={15} color={isActive ? tab.color : undefined} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: '28px 24px 60px', animation: 'settings-fade-in 0.18s ease' }} key={activeTab}>
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'company'         && <CompanyTab />}
          {activeTab === 'users'           && <UsersTab />}
          {activeTab === 'currency'        && <CurrencyTab />}
          {activeTab === 'invoice'         && <InvoiceTab />}
          {activeTab === 'vat'             && <VatTab />}
          {activeTab === 'alerts'          && <AlertsTab />}
          {activeTab === 'opening-balance' && <OpeningBalanceTab />}
          {activeTab === 'financial-lock'  && <FinancialLockTab />}
          {activeTab === 'salary-advance'  && <SalaryAdvanceTab />}
          {activeTab === 'system'          && <SystemTab />}
        </Suspense>
      </div>

      <style>{`
        @keyframes settings-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        div[dir="rtl"] button::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
