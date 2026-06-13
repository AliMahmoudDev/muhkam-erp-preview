import { C, FONT } from './types';

interface HealthData {
  health: {
    status: string;
    db: boolean;
    memory_mb: number;
    uptime_hours: number;
    db_read_latency_ms: number;
    db_write_latency_ms: number;
    pool_ok: boolean;
    node_version: string;
  };
  metrics: {
    uptime_seconds: number;
    total_requests: number;
    status_codes: Record<string, number>;
    latency_ms: { p50: number; p95: number; p99: number; samples: number };
  };
  pool: { total: number; idle: number; waiting: number };
  memory: { heap_used_mb: number; heap_total_mb: number; rss_mb: number; external_mb: number };
  process: { uptime_hours: number; node_version: string; pid: number; env: string };
  timestamp: string;
}

interface RedisHealthData {
  status: 'ok' | 'down';
  latency_ms?: number;
  message?: string;
}

interface Props {
  healthData?: HealthData;
  healthLoading: boolean;
  onRefetch: () => void;
  healthUpdated: number;
  redisHealth?: RedisHealthData;
}

export function TabHealth({
  healthData,
  healthLoading,
  onRefetch,
  healthUpdated,
  redisHealth,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>
            🌡️ صحة السيرفر والنظام
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            يتجدد كل 15 ثانية
            {healthUpdated
              ? ` • آخر تحديث: ${new Date(healthUpdated).toLocaleTimeString('ar-EG')}`
              : ''}
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
          🔄 تحديث فوري
        </button>
      </div>

      {healthLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
          ⏳ جارٍ جلب بيانات السيرفر...
        </div>
      ) : healthData ? (
        <>
          {/* Status Banner */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '16px',
              background:
                healthData.health.status === 'healthy'
                  ? 'rgba(52,211,153,0.1)'
                  : healthData.health.status === 'degraded'
                    ? 'rgba(245,158,11,0.1)'
                    : 'rgba(239,68,68,0.1)',
              border: `1px solid ${healthData.health.status === 'healthy' ? 'rgba(52,211,153,0.3)' : healthData.health.status === 'degraded' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <span style={{ fontSize: '36px' }}>
              {healthData.health.status === 'healthy'
                ? '✅'
                : healthData.health.status === 'degraded'
                  ? '⚠️'
                  : '🚨'}
            </span>
            <div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color:
                    healthData.health.status === 'healthy'
                      ? 'var(--status-success)'
                      : healthData.health.status === 'degraded'
                        ? 'var(--status-warning)'
                        : 'var(--status-danger)',
                }}
              >
                {healthData.health.status === 'healthy'
                  ? 'النظام يعمل بشكل مثالي'
                  : healthData.health.status === 'degraded'
                    ? 'أداء منخفض'
                    : 'النظام يواجه مشكلة'}
              </div>
              <div style={{ fontSize: '13px', color: C.muted, marginTop: '2px' }}>
                Node.js {healthData.process.node_version} • PID {healthData.process.pid} •{' '}
                {healthData.process.env}
              </div>
            </div>
          </div>

          {/* KPI Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '14px',
            }}
          >
            {[
              {
                label: 'وقت التشغيل',
                value: `${healthData.process.uptime_hours}h`,
                icon: '⏱️',
                color: 'var(--status-info)',
              },
              {
                label: 'ذاكرة Heap',
                value: `${healthData.memory.heap_used_mb} MB`,
                icon: '💾',
                color:
                  healthData.memory.heap_used_mb > 400
                    ? 'var(--status-danger)'
                    : 'var(--status-success)',
              },
              {
                label: 'RSS الكلي',
                value: `${healthData.memory.rss_mb} MB`,
                icon: '📊',
                color: 'var(--status-info)',
              },
              {
                label: 'قاعدة البيانات',
                value: healthData.health.db ? '✓ متصل' : '✗ منقطع',
                icon: '🗄️',
                color: healthData.health.db ? 'var(--status-success)' : 'var(--status-danger)',
              },
              {
                label: 'زمن قراءة DB',
                value: `${healthData.health.db_read_latency_ms}ms`,
                icon: '📖',
                color:
                  healthData.health.db_read_latency_ms > 200
                    ? 'var(--status-warning)'
                    : 'var(--status-success)',
              },
              {
                label: 'زمن كتابة DB',
                value: `${healthData.health.db_write_latency_ms}ms`,
                icon: '✏️',
                color:
                  healthData.health.db_write_latency_ms > 500
                    ? 'var(--status-warning)'
                    : 'var(--status-success)',
              },
              {
                label: 'طلبات API',
                value: healthData.metrics.total_requests.toLocaleString('ar-EG'),
                icon: '🌐',
                color: '#FB923C',
              },
              {
                label: 'اتصالات DB',
                value: `${healthData.pool.total}/${healthData.pool.idle} نشط`,
                icon: '🔌',
                color: '#F472B6',
              },
            ].map((k) => (
              <div
                key={k.label}
                style={{
                  background: C.card,
                  borderRadius: '14px',
                  border: `1px solid ${k.color}22`,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '20px' }}>{k.icon}</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '11px', color: C.muted }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* API Latency + Status Codes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div
              style={{
                background: C.card,
                borderRadius: '16px',
                border: `1px solid ${C.border}`,
                padding: '20px',
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '14px', color: C.text }}>
                ⚡ زمن استجابة API
              </h3>
              {[
                {
                  label: 'P50 (متوسط)',
                  value: healthData.metrics.latency_ms.p50,
                  good: 200,
                  warn: 500,
                },
                {
                  label: 'P95 (95% من الطلبات)',
                  value: healthData.metrics.latency_ms.p95,
                  good: 500,
                  warn: 1000,
                },
                {
                  label: 'P99 (أبطأ الطلبات)',
                  value: healthData.metrics.latency_ms.p99,
                  good: 1000,
                  warn: 2000,
                },
              ].map((l) => {
                const col =
                  l.value <= l.good
                    ? 'var(--status-success)'
                    : l.value <= l.warn
                      ? 'var(--status-warning)'
                      : 'var(--status-danger)';
                return (
                  <div
                    key={l.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: C.muted }}>{l.label}</span>
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: col,
                        fontFamily: 'monospace',
                      }}
                    >
                      {l.value}ms
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: '11px', color: C.muted, marginTop: '8px' }}>
                إجمالي العينات: {healthData.metrics.latency_ms.samples.toLocaleString('ar-EG')}
              </div>
            </div>

            <div
              style={{
                background: C.card,
                borderRadius: '16px',
                border: `1px solid ${C.border}`,
                padding: '20px',
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '14px', color: C.text }}>
                📊 رموز الاستجابة
              </h3>
              {Object.entries(healthData.metrics.status_codes)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([code, count]) => {
                  const col = code.startsWith('2')
                    ? 'var(--status-success)'
                    : code.startsWith('4')
                      ? 'var(--status-warning)'
                      : code.startsWith('5')
                        ? 'var(--status-danger)'
                        : 'var(--text-2)';
                  const total = Object.values(healthData.metrics.status_codes).reduce(
                    (s, v) => s + v,
                    0
                  );
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={code} style={{ marginBottom: '10px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            color: col,
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}
                        >
                          {code}
                        </span>
                        <span style={{ fontSize: '12px', color: C.muted }}>
                          {count.toLocaleString('ar-EG')} ({pct}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          borderRadius: '3px',
                          background: 'rgba(255,255,255,0.05)',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '3px',
                            background: col,
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              {!Object.keys(healthData.metrics.status_codes).length && (
                <div style={{ color: C.muted, fontSize: '13px' }}>لا توجد بيانات بعد</div>
              )}
            </div>
          </div>

          {/* DB Pool */}
          <div
            style={{
              background: C.card,
              borderRadius: '16px',
              border: `1px solid ${C.border}`,
              padding: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: '14px', color: C.text }}>
              🔌 اتصالات قاعدة البيانات (Connection Pool)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {[
                {
                  label: 'إجمالي الاتصالات',
                  value: healthData.pool.total,
                  color: 'var(--status-info)',
                  max: 50,
                },
                {
                  label: 'اتصالات خاملة',
                  value: healthData.pool.idle,
                  color: 'var(--status-success)',
                  max: healthData.pool.total || 1,
                },
                {
                  label: 'طلبات في الانتظار',
                  value: healthData.pool.waiting,
                  color: healthData.pool.waiting > 5 ? 'var(--status-danger)' : 'var(--text-2)',
                  max: 20,
                },
              ].map((p) => (
                <div key={p.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: C.muted }}>{p.label}</span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: p.color }}>
                      {p.value}
                    </span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: '4px',
                        background: p.color,
                        width: `${Math.min((p.value / p.max) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Redis Health */}
          {(() => {
            const ok = redisHealth?.status === 'ok';
            const color = redisHealth
              ? ok
                ? 'var(--status-success)'
                : 'var(--status-danger)'
              : 'var(--text-2)';
            const bgColor = redisHealth
              ? ok
                ? 'rgba(52,211,153,0.08)'
                : 'rgba(239,68,68,0.08)'
              : 'rgba(148,163,184,0.06)';
            const label = !redisHealth ? '⚠️ غير متاح حالياً' : ok ? '🟢 يعمل' : '🔴 متوقف';
            return (
              <div
                style={{
                  background: bgColor,
                  borderRadius: '16px',
                  border: `1px solid ${color}33`,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>🗄️</span>
                  <div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 900,
                        color: C.text,
                        marginBottom: '2px',
                      }}
                    >
                      حالة Redis
                    </div>
                    <div style={{ fontSize: '13px', color: C.muted }}>يتجدد كل 10 ثوانٍ</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>
                      الحالة
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color }}>{label}</div>
                  </div>
                  {redisHealth?.status === 'ok' && redisHealth.latency_ms !== undefined && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>
                        الاستجابة
                      </div>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: 900,
                          fontFamily: 'monospace',
                          color:
                            redisHealth.latency_ms > 50
                              ? 'var(--status-warning)'
                              : 'var(--status-success)',
                        }}
                      >
                        {redisHealth.latency_ms}ms
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 8px ${color}`,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </div>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}
