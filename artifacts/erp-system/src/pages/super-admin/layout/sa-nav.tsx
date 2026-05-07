import { type ActiveTab, C, FONT } from '../types';

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
}

const NAV_CARDS: { key: ActiveTab; label: string; icon: string; color: string; shadow: string; desc: string }[] = [
  { key: 'overview',      label: 'نظرة عامة',      icon: '🏠', color: '#F97316', shadow: 'rgba(249,115,22,0.45)',  desc: 'لوحة التحكم الرئيسية' },
  { key: 'companies',     label: 'الشركات',         icon: '🏢', color: '#3B82F6', shadow: 'rgba(59,130,246,0.45)',  desc: 'إدارة الشركات المشتركة' },
  { key: 'managers',      label: 'المديرون',         icon: '👑', color: '#F472B6', shadow: 'rgba(244,114,182,0.45)', desc: 'حسابات مديري النظام' },
  { key: 'revenue',       label: 'الإيرادات',        icon: '📊', color: '#10B981', shadow: 'rgba(16,185,129,0.45)',  desc: 'تقارير الإيرادات والمالية' },
  { key: 'alerts',        label: 'التنبيهات',        icon: '🔔', color: '#EF4444', shadow: 'rgba(239,68,68,0.45)',   desc: 'تنبيهات النظام والأحداث' },
  { key: 'plans',         label: 'الخطط',            icon: '💰', color: '#FBBF24', shadow: 'rgba(251,191,36,0.45)',  desc: 'إعداد خطط الاشتراك والأسعار' },
  { key: 'announcements', label: 'الإعلانات',        icon: '📢', color: '#8B5CF6', shadow: 'rgba(139,92,246,0.45)', desc: 'إشعارات للمستخدمين' },
  { key: 'health',        label: 'صحة السيرفر',      icon: '🌡️', color: '#06B6D4', shadow: 'rgba(6,182,212,0.45)',   desc: 'مراقبة أداء الخوادم' },
  { key: 'monitoring',    label: 'مراقبة التجريبي', icon: '🛡️', color: '#6366F1', shadow: 'rgba(99,102,241,0.45)',  desc: 'البيئة التجريبية' },
  { key: 'settings',      label: 'الإعدادات',        icon: '⚙️', color: '#64748B', shadow: 'rgba(100,116,139,0.45)', desc: 'إعدادات النظام والأمان' },
];

export function SANav({ activeTab, setActiveTab }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))',
      gap: '10px',
      marginBottom: '32px',
    }}>
      {NAV_CARDS.map((card) => {
        const active = activeTab === card.key;
        return (
          <button
            key={card.key}
            onClick={() => setActiveTab(card.key)}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.04)';
                e.currentTarget.style.boxShadow = `0 10px 28px ${card.shadow}`;
                e.currentTarget.style.borderColor = card.color;
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.12)`;
                e.currentTarget.style.borderColor = C.border;
              }
            }}
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '6px', padding: '14px 6px 12px', borderRadius: '14px',
              cursor: 'pointer', fontFamily: FONT,
              transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
              border: active ? `2px solid ${card.color}` : `1.5px solid ${C.border}`,
              background: active ? `linear-gradient(145deg, ${card.color}22 0%, ${card.color}08 100%)` : C.card,
              boxShadow: active ? `0 8px 24px ${card.shadow}, inset 0 1px 0 ${card.color}30` : `0 2px 8px rgba(0,0,0,0.12)`,
              transform: active ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
              outline: 'none', overflow: 'hidden', minWidth: 0,
            }}
          >
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: `linear-gradient(90deg, ${card.color}, ${card.color}99)`,
                borderRadius: '14px 14px 0 0',
              }} />
            )}
            <span style={{
              fontSize: '22px', lineHeight: 1,
              filter: active ? `drop-shadow(0 2px 6px ${card.shadow})` : 'none',
              transition: 'filter 0.2s',
            }}>
              {card.icon}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 800,
              color: active ? card.color : C.text,
              letterSpacing: '0.01em', transition: 'color 0.2s',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            }}>
              {card.label}
            </span>
            <span style={{
              fontSize: '9px', color: active ? card.color + 'bb' : C.muted,
              textAlign: 'center', lineHeight: 1.3, transition: 'color 0.2s',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            }}>
              {card.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
