import { C, FONT } from '../types';

interface RedisHealth {
  status: 'ok' | 'down';
  latency_ms?: number;
  message?: string;
}

interface Props {
  today: string;
  redisHealth: RedisHealth | undefined;
  logout: () => void;
}

export function SAHeader({ today, redisHealth, logout }: Props) {
  return (
    <div
      style={{
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: C.orangeDim,
            border: '1px solid rgba(249,115,22,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
          }}
        >
          🛡️
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
            لوحة تحكم المدير العام
          </div>
          <div style={{ fontSize: '11px', color: C.muted }}>{today}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          title={
            redisHealth?.status === 'ok'
              ? `Redis يعمل — ${redisHealth.latency_ms ?? 0}ms`
              : 'Redis متوقف'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '20px',
            background:
              redisHealth?.status === 'ok' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${redisHealth?.status === 'ok' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: '12px',
            fontWeight: 700,
            color: redisHealth?.status === 'ok' ? 'var(--status-success)' : 'var(--status-danger)',
            cursor: 'default',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background:
                redisHealth?.status === 'ok' ? 'var(--status-success)' : 'var(--status-danger)',
              display: 'inline-block',
              boxShadow: redisHealth?.status === 'ok' ? '0 0 6px #34D399' : '0 0 6px #EF4444',
            }}
          />
          Redis
        </div>

        <button
          onClick={logout}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: '10px',
            color: C.muted,
            padding: '8px 18px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: FONT,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.danger;
            e.currentTarget.style.color = C.danger;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.color = C.muted;
          }}
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
