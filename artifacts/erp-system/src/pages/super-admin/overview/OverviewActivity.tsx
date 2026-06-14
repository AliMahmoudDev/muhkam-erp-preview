import { C, FONT, type ActiveTab, type Stats } from '../types';
import type { OverviewAuditRow, SettingsCard, ActionMeta } from './overview-types';

interface Props {
  expiringSoon: Stats['expiringSoonList'];
  overviewAudit?: { count: number; rows: OverviewAuditRow[] };
  actionMap: Record<string, ActionMeta>;
  setActiveTab: (t: ActiveTab) => void;
  setSettingsActiveCard: (v: SettingsCard | null) => void;
}

/* Row 3 — Expiring soon + Recent audit (presentational; action labels passed in) */
export function OverviewActivity({
  expiringSoon,
  overviewAudit,
  actionMap,
  setActiveTab,
  setSettingsActiveCard,
}: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div
        style={{
          background: C.card,
          borderRadius: '18px',
          border: `1px solid ${C.border}`,
          padding: '22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>
            ⚠️ تنتهي قريباً
          </h3>
          <button
            onClick={() => setActiveTab('alerts')}
            style={{
              fontSize: '12px',
              color: C.orange,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            عرض الكل ←
          </button>
        </div>
        {expiringSoon.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>
            ✅ لا توجد اشتراكات تنتهي قريباً
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {expiringSoon.map((co) => (
              <div
                key={co.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: co.days_left <= 3 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                  border: `1px solid ${co.days_left <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{co.name}</div>
                  <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
                    {new Date(co.end_date).toLocaleDateString('ar-EG')}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 900,
                    color: co.days_left <= 3 ? 'var(--status-danger)' : 'var(--status-warning)',
                  }}
                >
                  {co.days_left} يوم
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          background: C.card,
          borderRadius: '18px',
          border: `1px solid ${C.border}`,
          padding: '22px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: C.text }}>
            📋 آخر الإجراءات
          </h3>
          <button
            onClick={() => {
              setActiveTab('settings');
              setSettingsActiveCard('audit_log');
            }}
            style={{
              fontSize: '12px',
              color: C.orange,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            سجل التدقيق ←
          </button>
        </div>
        {!overviewAudit?.rows.length ? (
          <div style={{ textAlign: 'center', padding: '20px', color: C.muted, fontSize: '13px' }}>
            لا توجد سجلات
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {overviewAudit.rows.map((row) => {
              const meta = actionMap[row.action] ?? { label: row.action, color: 'var(--text-2)' };
              const ts = new Date(row.created_at).toLocaleString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit',
                day: 'numeric',
                month: 'short',
              });
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'var(--surface)',
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: meta.color,
                      background: `${meta.color}15`,
                      border: `1px solid ${meta.color}30`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={{ fontSize: '12px', color: C.text, flex: 1 }}>
                    {row.username ?? '—'}
                  </span>
                  <span style={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>
                    {ts}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
