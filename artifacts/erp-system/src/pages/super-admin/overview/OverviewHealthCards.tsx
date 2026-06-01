import { C, FONT, type ActiveTab } from '../types';
import type { HealthData } from './overview-types';

interface Props {
  healthData?: HealthData;
  healthLoading: boolean;
  setActiveTab: (t: ActiveTab) => void;
}

/* Row 2 — Server Health + API metrics (presentational) */
export function OverviewHealthCards({ healthData, healthLoading, setActiveTab }: Props) {
  const ovHealth  = healthData?.health;
  const ovMetrics = healthData?.metrics;
  const totalR  = ovMetrics?.total_requests ?? 0;
  const ok2xx   = (ovMetrics?.status_codes?.['200'] ?? 0) + (ovMetrics?.status_codes?.['201'] ?? 0);
  const err5xx  = Object.entries(ovMetrics?.status_codes ?? {}).filter(([k]) => k.startsWith('5')).reduce((s, [, v]) => s + v, 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
        <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>🌡️ صحة السيرفر</h3>
        {healthLoading ? (
          <div style={{ color: C.muted, fontSize: '13px' }}>⏳ جارٍ الفحص...</div>
        ) : ovHealth ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'قاعدة البيانات', value: ovHealth.db ? '✅ متصلة' : '❌ منقطعة', color: ovHealth.db ? '#34D399' : '#EF4444' },
              { label: 'استهلاك الذاكرة', value: `${ovHealth.memory_mb} MB`, color: ovHealth.memory_mb > 400 ? '#F59E0B' : '#34D399' },
              { label: 'وقت التشغيل', value: `${ovHealth.uptime_hours} ساعة`, color: '#60A5FA' },
              { label: 'استجابة DB', value: ovHealth.db_read_latency_ms >= 0 ? `${ovHealth.db_read_latency_ms} ms` : 'غير متاح', color: (ovHealth.db_read_latency_ms ?? 0) > 200 ? '#F59E0B' : '#34D399' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: C.muted }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
            <button onClick={() => setActiveTab('health')}
              style={{ marginTop: '8px', padding: '8px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}>
              عرض التفاصيل الكاملة ←
            </button>
          </div>
        ) : <div style={{ color: C.muted, fontSize: '13px' }}>البيانات غير متاحة</div>}
      </div>

      <div style={{ background: C.card, borderRadius: '18px', border: `1px solid ${C.border}`, padding: '22px' }}>
        <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '15px', color: C.text }}>📡 مؤشرات الـ API</h3>
        {ovMetrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'إجمالي الطلبات',         value: totalR.toLocaleString('ar-EG'),                                           color: '#60A5FA' },
              { label: 'طلبات ناجحة (2xx)',       value: ok2xx.toLocaleString('ar-EG'),                                             color: '#34D399' },
              { label: 'أخطاء سيرفر (5xx)',       value: err5xx.toLocaleString('ar-EG'),                                            color: err5xx > 0 ? '#EF4444' : '#34D399' },
              { label: 'زمن الاستجابة p95',       value: `${ovMetrics.latency_ms?.p95 ?? 0} ms`,                                    color: (ovMetrics.latency_ms?.p95 ?? 0) > 500 ? '#F59E0B' : '#34D399' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: C.muted }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        ) : <div style={{ color: C.muted, fontSize: '13px' }}>⏳ جارٍ التحميل...</div>}
      </div>
    </div>
  );
}
