import {
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  Bell,
  CreditCard,
  Megaphone,
  Activity,
  Shield,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { type ActiveTab, C, FONT } from '../types';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
}

const NAV_ITEMS: { key: ActiveTab; label: string; Icon: LucideIcon; accent: string }[] = [
  { key: 'overview', label: 'نظرة عامة', Icon: LayoutDashboard, accent: '#F97316' },
  { key: 'companies', label: 'الشركات', Icon: Building2, accent: '#3B82F6' },
  { key: 'managers', label: 'المديرون', Icon: Users, accent: '#F472B6' },
  { key: 'revenue', label: 'الإيرادات', Icon: TrendingUp, accent: '#10B981' },
  { key: 'alerts', label: 'التنبيهات', Icon: Bell, accent: '#EF4444' },
  { key: 'plans', label: 'الخطط', Icon: CreditCard, accent: '#F59E0B' },
  { key: 'announcements', label: 'الإعلانات', Icon: Megaphone, accent: '#8B5CF6' },
  { key: 'health', label: 'صحة السيرفر', Icon: Activity, accent: '#06B6D4' },
  { key: 'monitoring', label: 'مراقبة التجريبي', Icon: Shield, accent: '#6366F1' },
  { key: 'settings', label: 'الإعدادات', Icon: Settings2, accent: '#64748B' },
];

export function SANav({ activeTab, setActiveTab }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: '8px',
        marginBottom: '28px',
      }}
    >
      {NAV_ITEMS.map(({ key, label, Icon, accent }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '13px 6px 12px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'background 0.15s, border-color 0.15s',
              border: active ? `1.5px solid ${accent}55` : `1.5px solid ${C.border}`,
              background: active ? `${accent}12` : C.card,
              outline: 'none',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = C.card;
                e.currentTarget.style.borderColor = C.border;
              }
            }}
          >
            {/* Active indicator — top accent bar */}
            {active && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: accent,
                  borderRadius: '12px 12px 0 0',
                }}
              />
            )}
            <Icon size={18} color={active ? accent : C.muted} strokeWidth={active ? 2.2 : 1.8} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: active ? 800 : 600,
                color: active ? accent : C.text,
                lineHeight: 1.3,
                textAlign: 'center',
                letterSpacing: '0.01em',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
