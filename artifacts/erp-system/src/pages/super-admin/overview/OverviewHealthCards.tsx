import { Server, BarChart3, type LucideIcon } from 'lucide-react';
import { C, FONT, type ActiveTab } from '../types';
import type { HealthData } from './overview-types';

interface Props {
  healthData?: HealthData;
  healthLoading: boolean;
  setActiveTab: (t: ActiveTab) => void;
}

function SectionHeader({ Icon, title }: { Icon: LucideIcon; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'rgba(249,115,22,0.12)',
          border: '1px solid rgba(249,115,22,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} color="#F97316" strokeWidth={2} />
      </div>
      <h3 style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: C.text }}>{title}</h3>
    </div>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: C.muted }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

/* Row 2 — Server Health + API metrics (presentational) */
export function OverviewHealthCards({ healthData, healthLoading, setActiveTab }: Props) {
  const ovHealth = healthData?.health;
  const ovMetrics = healthData?.metrics;
  const totalR = ovMetrics?.total_requests ?? 0;
  const ok2xx = (ovMetrics?.status_codes?.['200'] ?? 0) + (ovMetrics?.status_codes?.['201'] ?? 0);
  const err5xx = Object.entries(ovMetrics?.status_codes ?? {})
    .filter(([k]) => k.startsWith('5'))
    .reduce((s, [, v]) => s + v, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {/* Server Health */}
      <div
        style={{
          background: C.card,
          borderRadius: '18px',
          border: `1px solid ${C.border}`,
          padding: '22px',
        }}
      >
        <SectionHeader Icon={Server} title="صحة السيرفر" />
        {healthLoading ? (
          <div style={{ color: C.muted, fontSize: '13px' }}>جارٍ الفحص...</div>
        ) : ovHealth ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <StatusRow
              label="قاعدة البيانات"
              value={ovHealth.db ? 'متصلة' : 'منقطعة'}
              color={ovHealth.db ? 'var(--status-success)' : 'var(--status-danger)'}
            />
            <StatusRow
              label="استهلاك الذاكرة"
              value={`${ovHealth.memory_mb} MB`}
              color={ovHealth.memory_mb > 400 ? 'var(--status-warning)' : 'var(--status-success)'}
            />
            <StatusRow
              label="وقت التشغيل"
              value={`${ovHealth.uptime_hours} ساعة`}
              color="var(--status-info)"
            />
            <StatusRow
              label="استجابة DB"
              value={
                ovHealth.db_read_latency_ms >= 0 ? `${ovHealth.db_read_latency_ms} ms` : 'غير متاح'
              }
              color={
                (ovHealth.db_read_latency_ms ?? 0) > 200
                  ? 'var(--status-warning)'
                  : 'var(--status-success)'
              }
            />
            <button
              onClick={() => setActiveTab('health')}
              style={{
                marginTop: '8px',
                padding: '8px',
                borderRadius: '8px',
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.muted,
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              عرض التفاصيل الكاملة ←
            </button>
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: '13px' }}>البيانات غير متاحة</div>
        )}
      </div>

      {/* API Metrics */}
      <div
        style={{
          background: C.card,
          borderRadius: '18px',
          border: `1px solid ${C.border}`,
          padding: '22px',
        }}
      >
        <SectionHeader Icon={BarChart3} title="مؤشرات الـ API" />
        {ovMetrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <StatusRow
              label="إجمالي الطلبات"
              value={totalR.toLocaleString('ar-EG')}
              color="var(--status-info)"
            />
            <StatusRow
              label="طلبات ناجحة (2xx)"
              value={ok2xx.toLocaleString('ar-EG')}
              color="var(--status-success)"
            />
            <StatusRow
              label="أخطاء سيرفر (5xx)"
              value={err5xx.toLocaleString('ar-EG')}
              color={err5xx > 0 ? 'var(--status-danger)' : 'var(--status-success)'}
            />
            <StatusRow
              label="زمن الاستجابة p95"
              value={`${ovMetrics.latency_ms?.p95 ?? 0} ms`}
              color={
                (ovMetrics.latency_ms?.p95 ?? 0) > 500
                  ? 'var(--status-warning)'
                  : 'var(--status-success)'
              }
            />
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: '13px' }}>جارٍ التحميل...</div>
        )}
      </div>
    </div>
  );
}
