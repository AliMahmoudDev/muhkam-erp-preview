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
  ChevronDown,
} from 'lucide-react';

/* ─── Lazy-load each tab ─── */
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

/* ─── Cards config ─── */
const CARDS: {
  id: Tab;
  label: string;
  desc: string;
  icon: React.FC<{ style?: React.CSSProperties }>;
  color: string;
  glow: string;
}[] = [
  { id: 'company',          label: 'بيانات الشركة',         desc: 'الاسم والشعار والمعلومات الأساسية', icon: Building2, color: '#f59e0b', glow: 'rgba(245,158,11,0.18)' },
  { id: 'users',            label: 'المستخدمون',              desc: 'إدارة الحسابات والصلاحيات',         icon: Users,     color: '#6366f1', glow: 'rgba(99,102,241,0.18)'  },
  { id: 'currency',         label: 'إعدادات المتجر',          desc: 'العملة والمظهر والتفضيلات',         icon: Store,     color: '#10b981', glow: 'rgba(16,185,129,0.18)'  },
  { id: 'invoice',          label: 'الفاتورة',               desc: 'نموذج الطباعة والبيانات المطبوعة',  icon: FileText,  color: '#3b82f6', glow: 'rgba(59,130,246,0.18)'  },
  { id: 'vat',              label: 'ضريبة القيمة المضافة',    desc: 'نسبة الضريبة وطريقة احتسابها',      icon: Percent,   color: '#ec4899', glow: 'rgba(236,72,153,0.18)'  },
  { id: 'alerts',           label: 'التنبيهات',               desc: 'تنبيهات المخزون والمدفوعات',        icon: Bell,      color: '#f97316', glow: 'rgba(249,115,22,0.18)'  },
  { id: 'opening-balance',  label: 'أرصدة أول المدة',        desc: 'الأرصدة الافتتاحية للحسابات',       icon: BookOpen,  color: '#8b5cf6', glow: 'rgba(139,92,246,0.18)'  },
  { id: 'financial-lock',   label: 'إغلاق الفترات المالية',  desc: 'تأمين الفترات المحاسبية المنتهية',  icon: Lock,      color: '#ef4444', glow: 'rgba(239,68,68,0.18)'   },
  { id: 'salary-advance',   label: 'السلف والاقتطاعات',      desc: 'سياسة السلف للموظفين',              icon: Banknote,  color: '#14b8a6', glow: 'rgba(20,184,166,0.18)'  },
  { id: 'system',           label: 'النسخ الاحتياطي والبيانات', desc: 'تصدير واستيراد وحذف البيانات',   icon: HardDrive, color: '#64748b', glow: 'rgba(100,116,139,0.18)' },
];

function TabSkeleton() {
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: '60px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const active = CARDS.find((c) => c.id === activeTab);

  return (
    <div dir="rtl" style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--erp-bg-main, #0D1424)', padding: '28px 24px 60px' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '11px', background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings style={{ width: 18, height: 18, color: '#f59e0b' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#f1f5f9' }}>الإعدادات</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>اختر القسم الذي تريد تعديله</p>
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: '14px',
        marginBottom: activeTab ? '28px' : '0',
      }}>
        {CARDS.map((card) => {
          const isActive = activeTab === card.id;
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => setActiveTab(isActive ? null : card.id)}
              style={{
                background: isActive ? card.glow : 'rgba(255,255,255,0.03)',
                border: `2px solid ${isActive ? card.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '16px',
                padding: '18px 16px',
                cursor: 'pointer',
                textAlign: 'right',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                transition: 'all 0.2s ease',
                position: 'relative',
                boxShadow: isActive ? `0 0 20px ${card.glow}` : 'none',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = card.color + '55';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                }
              }}
            >
              {/* Active indicator */}
              {isActive && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', width: '8px', height: '8px', borderRadius: '50%', background: card.color, boxShadow: `0 0 8px ${card.color}` }} />
              )}

              {/* Icon */}
              <div style={{ width: 40, height: 40, borderRadius: '11px', background: isActive ? card.color + '30' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${isActive ? card.color + '60' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 18, height: 18, color: isActive ? card.color : '#94a3b8' }} />
              </div>

              {/* Text */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: isActive ? card.color : '#e2e8f0', marginBottom: '3px', lineHeight: 1.3 }}>{card.label}</div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>{card.desc}</div>
              </div>

              {/* Arrow indicator */}
              <ChevronDown style={{ position: 'absolute', bottom: '12px', left: '12px', width: 14, height: 14, color: isActive ? card.color : '#475569', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>
          );
        })}
      </div>

      {/* ── Content panel ── */}
      {activeTab && active && (
        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: `1.5px solid ${active.color}33`,
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: `0 0 30px ${active.glow}`,
          animation: 'settings-fade-in 0.2s ease',
        }}>
          {/* Panel header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: active.glow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '9px', background: active.color + '25', border: `1.5px solid ${active.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <active.icon style={{ width: 15, height: 15, color: active.color }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#f1f5f9' }}>{active.label}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{active.desc}</div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#64748b', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontFamily: 'inherit' }}
            >✕</button>
          </div>

          {/* Tab content */}
          <div style={{ padding: '24px' }}>
            <Suspense fallback={<TabSkeleton />}>
              {activeTab === 'users'           && <UsersTab />}
              {activeTab === 'company'         && <CompanyTab />}
              {activeTab === 'opening-balance' && <OpeningBalanceTab />}
              {activeTab === 'financial-lock'  && <FinancialLockTab />}
              {activeTab === 'currency'        && <CurrencyTab />}
              {activeTab === 'vat'             && <VatTab />}
              {activeTab === 'alerts'          && <AlertsTab />}
              {activeTab === 'invoice'         && <InvoiceTab />}
              {activeTab === 'salary-advance'  && <SalaryAdvanceTab />}
              {activeTab === 'system'          && <SystemTab />}
            </Suspense>
          </div>
        </div>
      )}

      <style>{`
        @keyframes settings-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
