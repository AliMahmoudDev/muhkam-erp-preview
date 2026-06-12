import { C, type ActiveTab, type Stats } from '../types';
import type { SettingsCard } from './overview-types';

interface Props {
  stats?: Stats;
  setActiveTab: (t: ActiveTab) => void;
  setStatusFilter: (v: string) => void;
  setSettingsActiveCard: (v: SettingsCard | null) => void;
}

/* Row 1 — 4 big KPI cards (presentational; navigation handlers come from parent) */
export function OverviewKpiCards({ stats, setActiveTab, setStatusFilter, setSettingsActiveCard }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
      {[
        { icon: '🏢', label: 'الشركات النشطة',    value: stats?.active ?? '—',       sub: `من إجمالي ${stats?.total ?? '—'} شركة`,                      color: 'var(--status-success)', action: () => { setActiveTab('companies'); setStatusFilter('active'); } },
        { icon: '⚠️', label: 'تنتهي خلال 7 أيام', value: stats?.expiringSoon ?? '—',  sub: 'تحتاج تجديد عاجل',                                           color: 'var(--status-warning)', action: () => setActiveTab('alerts') },
        { icon: '👥', label: 'إجمالي المستخدمين',  value: stats?.totalUsers ?? '—',    sub: `${stats?.recentSignups ?? 0} انضموا هذا الشهر`,               color: 'var(--status-info)', action: () => { setActiveTab('settings'); setSettingsActiveCard('managers'); } },
        { icon: (stats?.expired ?? 0) > 0 ? '⛔' : '✅', label: 'اشتراكات منتهية', value: stats?.expired ?? '—', sub: `${stats?.suspended ?? 0} موقوفة إضافياً`, color: (stats?.expired ?? 0) > 0 ? 'var(--status-danger)' : 'var(--status-success)', action: () => { setActiveTab('companies'); setStatusFilter('expired'); } },
      ].map(kpi => (
        <div key={kpi.label} onClick={kpi.action} style={{
          background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, borderTop: `3px solid ${kpi.color}`,
          padding: '22px 20px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${kpi.color}20`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
        >
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>{kpi.icon}</div>
          <div style={{ fontSize: '32px', fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginTop: '8px' }}>{kpi.label}</div>
          <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{kpi.sub}</div>
        </div>
      ))}
    </div>
  );
}
