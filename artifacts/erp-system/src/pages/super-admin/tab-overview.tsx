import { C, FONT, type ActiveTab, type Stats } from './types';
import type { HealthData, OverviewAuditRow, SettingsCard } from './overview/overview-types';
import { ACTION_AR } from './audit-actions';
import { OverviewKpiCards } from './overview/OverviewKpiCards';
import { OverviewHealthCards } from './overview/OverviewHealthCards';
import { OverviewActivity } from './overview/OverviewActivity';

interface Props {
  healthData?: HealthData;
  healthLoading: boolean;
  stats?: Stats;
  overviewAudit?: { count: number; rows: OverviewAuditRow[] };
  setActiveTab: (t: ActiveTab) => void;
  setStatusFilter: (v: string) => void;
  setSettingsActiveCard: (v: SettingsCard | null) => void;
}

export function TabOverview({ healthData, healthLoading, stats, overviewAudit, setActiveTab, setStatusFilter, setSettingsActiveCard }: Props) {
  const ovHealth  = healthData?.health;
  const healthColor = ovHealth?.status === 'healthy' ? '#34D399' : ovHealth?.status === 'degraded' ? '#F59E0B' : '#EF4444';
  const healthLabel = ovHealth?.status === 'healthy' ? 'يعمل بشكل طبيعي' : ovHealth?.status === 'degraded' ? 'أداء منخفض' : 'مشكلة حرجة';
  const expiringSoon = (stats?.expiringSoonList ?? []).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>🏠 نظرة عامة على النظام</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {ovHealth && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: `${healthColor}15`, border: `1px solid ${healthColor}40` }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, display: 'inline-block', boxShadow: `0 0 8px ${healthColor}` }} />
            <span style={{ color: healthColor, fontWeight: 800, fontSize: '13px' }}>{healthLabel}</span>
          </div>
        )}
      </div>

      {/* Row 1 — 4 big KPI cards */}
      <OverviewKpiCards
        stats={stats}
        setActiveTab={setActiveTab}
        setStatusFilter={setStatusFilter}
        setSettingsActiveCard={setSettingsActiveCard}
      />

      {/* Row 2 — Server Health + API metrics */}
      <OverviewHealthCards
        healthData={healthData}
        healthLoading={healthLoading}
        setActiveTab={setActiveTab}
      />

      {/* Row 3 — Expiring soon + Recent audit */}
      <OverviewActivity
        expiringSoon={expiringSoon}
        overviewAudit={overviewAudit}
        actionMap={ACTION_AR}
        setActiveTab={setActiveTab}
        setSettingsActiveCard={setSettingsActiveCard}
      />

      {/* Row 4 — Quick-access shortcuts */}
      <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
        <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>⚡ وصول سريع</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: '🏢 إدارة الشركات',       tab: 'companies' as const },
            { label: '📊 لوحة الإيرادات',       tab: 'revenue'   as const },
            { label: '🔔 مركز التنبيهات',       tab: 'alerts'    as const },
            { label: '⚙️ الإعدادات والأمان',    tab: 'settings'  as const },
          ].map(s => (
            <button key={s.tab} onClick={() => setActiveTab(s.tab)} style={{
              padding: '10px 18px', borderRadius: '10px', border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text, fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.orange; (e.currentTarget as HTMLButtonElement).style.color = C.orange; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
            >{s.label}</button>
          ))}
        </div>
      </div>

    </div>
  );
}
