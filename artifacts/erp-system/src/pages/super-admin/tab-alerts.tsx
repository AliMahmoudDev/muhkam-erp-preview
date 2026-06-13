import { C, FONT } from './types';

interface AlertItem {
  type: 'warning' | 'danger' | 'info' | 'success';
  category: string;
  title: string;
  body: string;
  company_id?: number;
  company_name?: string;
  days?: number;
}

interface AlertsData {
  alerts: AlertItem[];
  summary: { critical: number; warnings: number; info: number; successes: number; total: number };
}

type ActiveTab =
  | 'overview'
  | 'companies'
  | 'managers'
  | 'settings'
  | 'revenue'
  | 'alerts'
  | 'announcements'
  | 'health'
  | 'plans'
  | 'monitoring'
  | 'audit_log';

interface Props {
  alertsData?: AlertsData;
  alertsLoading: boolean;
  onRefetch: () => void;
  alertSearch: string;
  setAlertSearch: (v: string) => void;
  alertTypeFilter: 'all' | 'danger' | 'warning' | 'info' | 'success';
  setAlertTypeFilter: (v: 'all' | 'danger' | 'warning' | 'info' | 'success') => void;
  setActiveTab: (t: ActiveTab) => void;
  setSnapshotCompany: (id: number) => void;
}

export function TabAlerts({
  alertsData,
  alertsLoading,
  onRefetch,
  alertSearch,
  setAlertSearch,
  alertTypeFilter,
  setAlertTypeFilter,
  setActiveTab,
  setSnapshotCompany,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>
            🔔 مركز التنبيهات الذكية
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            يتجدد تلقائياً كل دقيقة
          </p>
        </div>
        <button
          onClick={() => void onRefetch()}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: `1px solid ${C.border}`,
            background: 'transparent',
            color: C.muted,
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          🔄 تحديث
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={alertSearch}
          onChange={(e) => setAlertSearch(e.target.value)}
          placeholder="🔍 ابحث في التنبيهات..."
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '10px 16px',
            borderRadius: '12px',
            border: `1.5px solid ${C.border}`,
            background: C.card,
            color: C.text,
            fontSize: '13px',
            fontFamily: FONT,
            outline: 'none',
          }}
        />
        {(['all', 'danger', 'warning', 'info', 'success'] as const).map((t) => {
          const typeLabels: Record<string, string> = {
            all: 'الكل',
            danger: '🚨 حرج',
            warning: '⚠️ تحذير',
            info: 'ℹ️ معلومات',
            success: '✅ إيجابي',
          };
          const typeColors: Record<string, string> = {
            all: C.orange,
            danger: 'var(--status-danger)',
            warning: 'var(--status-warning)',
            info: 'var(--status-info)',
            success: 'var(--status-success)',
          };
          const isActive = alertTypeFilter === t;
          return (
            <button
              key={t}
              onClick={() => setAlertTypeFilter(t)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'all 0.15s',
                border: isActive ? 'none' : `1.5px solid ${C.border}`,
                background: isActive ? typeColors[t] : 'transparent',
                color: isActive ? 'var(--text-1)' : C.muted,
              }}
            >
              {typeLabels[t]}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      {alertsData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            {
              label: 'حرجة',
              count: alertsData.summary.critical,
              color: 'var(--status-danger)',
              icon: '🚨',
            },
            {
              label: 'تحذيرات',
              count: alertsData.summary.warnings,
              color: 'var(--status-warning)',
              icon: '⚠️',
            },
            {
              label: 'معلومات',
              count: alertsData.summary.info,
              color: 'var(--status-info)',
              icon: 'ℹ️',
            },
            {
              label: 'إيجابية',
              count: alertsData.summary.successes,
              color: 'var(--status-success)',
              icon: '✅',
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: C.card,
                borderRadius: '14px',
                border: `1px solid ${s.color}33`,
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px' }}>{s.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts List */}
      {alertsLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
          ⏳ جارٍ التحميل...
        </div>
      ) : (
        (() => {
          const filtered = (alertsData?.alerts ?? []).filter(
            (a) =>
              (alertTypeFilter === 'all' || a.type === alertTypeFilter) &&
              (!alertSearch ||
                `${a.title} ${a.body} ${a.company_name ?? ''}`
                  .toLowerCase()
                  .includes(alertSearch.toLowerCase()))
          );
          if (filtered.length === 0 && alertsData)
            return (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px',
                  background: C.card,
                  borderRadius: '18px',
                  border: `1px solid ${C.border}`,
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: C.text }}>
                  {alertSearch || alertTypeFilter !== 'all' ? 'لا توجد نتائج' : 'لا توجد تنبيهات'}
                </div>
                <div style={{ fontSize: '13px', color: C.muted, marginTop: '8px' }}>
                  {alertSearch || alertTypeFilter !== 'all'
                    ? 'جرب تغيير الفلتر أو مسح البحث'
                    : 'كل شيء يسير بشكل طبيعي'}
                </div>
              </div>
            );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map((alert, i) => {
                const colors: Record<string, { bg: string; border: string; badge: string }> = {
                  danger: {
                    bg: 'rgba(239,68,68,0.07)',
                    border: 'rgba(239,68,68,0.25)',
                    badge: 'var(--status-danger)',
                  },
                  warning: {
                    bg: 'rgba(245,158,11,0.07)',
                    border: 'rgba(245,158,11,0.25)',
                    badge: 'var(--status-warning)',
                  },
                  success: {
                    bg: 'rgba(52,211,153,0.07)',
                    border: 'rgba(52,211,153,0.25)',
                    badge: 'var(--status-success)',
                  },
                  info: {
                    bg: 'rgba(96,165,250,0.07)',
                    border: 'rgba(96,165,250,0.25)',
                    badge: 'var(--status-info)',
                  },
                };
                const col = colors[alert.type] ?? colors.info;
                return (
                  <div
                    key={i}
                    style={{
                      background: col.bg,
                      borderRadius: '14px',
                      border: `1px solid ${col.border}`,
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                    }}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: col.badge,
                        flexShrink: 0,
                        marginTop: '6px',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: C.text,
                          marginBottom: '4px',
                        }}
                      >
                        {alert.title}
                      </div>
                      <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>
                        {alert.body}
                      </div>
                      {alert.company_name && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: C.muted,
                            marginTop: '4px',
                            opacity: 0.7,
                          }}
                        >
                          🏢 {alert.company_name}
                        </div>
                      )}
                    </div>
                    {alert.company_id && (
                      <button
                        onClick={() => {
                          setActiveTab('companies');
                          setSnapshotCompany(alert.company_id!);
                        }}
                        style={{
                          flexShrink: 0,
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${col.border}`,
                          background: 'transparent',
                          color: col.badge,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: FONT,
                        }}
                      >
                        عرض
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </div>
  );
}
