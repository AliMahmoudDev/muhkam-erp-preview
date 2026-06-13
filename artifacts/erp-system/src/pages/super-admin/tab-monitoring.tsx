import React from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { C, FONT } from './types';

interface TrialMonitoringData {
  redis_ok: boolean;
  status: 'normal' | 'warning' | 'paused';
  registrations_in_window: number;
  alert_threshold: number;
  block_threshold: number;
  pause_until: string | null;
  pause_remaining_seconds: number;
  warning_fired_at: string | null;
  pause_reason: string | null;
  top_ips: { ip: string; count: number }[];
  top_fingerprints: { fingerprint: string; count: number }[];
  suspicious_companies: {
    id: number;
    name: string;
    email: string | null;
    trial_score: number;
    is_suspicious: boolean;
    verification_status: string;
  }[];
  recent_blocks: { email: string; ip: string; reason: string; created_at: string }[];
}

interface UnblockResult {
  active_blocks: number;
  overridden_blocks: number;
  rows: {
    id: number;
    email: string;
    ip: string;
    fingerprint: string | null;
    override_reason: string | null;
    created_at: string;
  }[];
}

interface Props {
  monData?: TrialMonitoringData;
  monLoading: boolean;
  monError: boolean;
  onRefetch: () => void;
  unblockIP: string;
  setUnblockIP: (v: string) => void;
  unblockEmail: string;
  setUnblockEmail: (v: string) => void;
  unblockResult: UnblockResult | null;
  setUnblockResult: (v: UnblockResult | null) => void;
  unblockLoading: boolean;
  setUnblockLoading: (v: boolean) => void;
  unblockMsg: { ok: boolean; text: string } | null;
  setUnblockMsg: (v: { ok: boolean; text: string } | null) => void;
}

const MON_ST: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: string;
    glow: string;
    grad: string;
  }
> = {
  normal: {
    label: 'طبيعي',
    color: 'var(--status-success)',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.3)',
    icon: '✅',
    glow: 'rgba(52,211,153,0.2)',
    grad: 'linear-gradient(135deg,rgba(52,211,153,0.12),rgba(16,185,129,0.04))',
  },
  warning: {
    label: 'تحذير',
    color: 'var(--status-warning)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.35)',
    icon: '⚠️',
    glow: 'rgba(245,158,11,0.2)',
    grad: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,88,12,0.04))',
  },
  paused: {
    label: 'متوقف مؤقتاً',
    color: 'var(--status-danger)',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.35)',
    icon: '🚫',
    glow: 'rgba(239,68,68,0.2)',
    grad: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.04))',
  },
};

const Pill = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 11px',
      borderRadius: '30px',
      fontSize: '11px',
      fontWeight: 700,
      color,
      background: bg,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
    }}
  >
    {label}
  </span>
);

const SectionCard = ({
  id,
  children,
  accentColor,
}: {
  id: string;
  children: React.ReactNode;
  accentColor?: string;
}) => (
  <div
    id={id}
    style={{
      background: C.card,
      border: `1px solid ${accentColor ? accentColor + '22' : C.border}`,
      borderRadius: '16px',
      overflow: 'hidden',
      position: 'relative',
      borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
    }}
  >
    {children}
  </div>
);

const SectionHead = ({
  icon,
  title,
  sub,
  extra,
}: {
  icon: string;
  title: string;
  sub?: string;
  extra?: React.ReactNode;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 24px',
      borderBottom: `1px solid ${C.border}`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{title}</div>
        {sub && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
    {extra}
  </div>
);

export function TabMonitoring({
  monData,
  monLoading,
  monError,
  onRefetch,
  unblockIP,
  setUnblockIP,
  unblockEmail,
  setUnblockEmail,
  unblockResult,
  setUnblockResult,
  unblockLoading,
  setUnblockLoading,
  unblockMsg,
  setUnblockMsg,
}: Props) {
  const st = MON_ST[monData?.status ?? 'normal'] ?? MON_ST['normal'];
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const inputSt: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '14px',
    border: `1.5px solid ${C.border}`,
    background: 'rgba(255,255,255,0.04)',
    color: C.text,
    fontFamily: 'monospace',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const doLookup = async () => {
    if (!unblockIP.trim() && !unblockEmail.trim()) return;
    setUnblockLoading(true);
    setUnblockResult(null);
    setUnblockMsg(null);
    try {
      const p = new URLSearchParams();
      if (unblockIP.trim()) p.set('ip', unblockIP.trim());
      if (unblockEmail.trim()) p.set('email', unblockEmail.trim());
      const r = await authFetch(`/api/super/trial-abuse/lookup?${p}`);
      setUnblockResult(await r.json());
    } catch {
      setUnblockMsg({ ok: false, text: 'فشل الفحص — تحقق من الاتصال' });
    } finally {
      setUnblockLoading(false);
    }
  };

  const doUnblockAll = async () => {
    if (!unblockIP.trim() && !unblockEmail.trim()) return;
    if (
      !window.confirm(
        `رفع جميع الحجوبات عن:\nIP: ${unblockIP || 'غير محدد'}\nEmail: ${unblockEmail || 'غير محدد'}\n\nهل أنت متأكد؟`
      )
    )
      return;
    setUnblockLoading(true);
    setUnblockMsg(null);
    try {
      const dbRes = await authFetch('/api/super/trial-abuse/bulk-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: unblockIP.trim() || undefined,
          email: unblockEmail.trim() || undefined,
          reason: 'رفع يدوي من السوبر أدمن',
        }),
      });
      const dbData = await dbRes.json();
      let redisPart = '';
      if (unblockIP.trim()) {
        try {
          await authFetch('/api/super/trial-monitoring/unblock-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: unblockIP.trim() }),
          });
          redisPart = ' + Redis ✓';
        } catch {
          redisPart = ' (Redis غير متاح)';
        }
      }
      const p = new URLSearchParams();
      if (unblockIP.trim()) p.set('ip', unblockIP.trim());
      if (unblockEmail.trim()) p.set('email', unblockEmail.trim());
      setUnblockResult(await (await authFetch(`/api/super/trial-abuse/lookup?${p}`)).json());
      setUnblockMsg({
        ok: true,
        text: `✅ تم رفع ${dbData.overridden_count ?? 0} حجب من قاعدة البيانات${redisPart} — العميل يستطيع التسجيل الآن`,
      });
      void onRefetch();
    } catch {
      setUnblockMsg({ ok: false, text: 'فشل رفع الحجب — تحقق من اللوجز' });
    } finally {
      setUnblockLoading(false);
    }
  };

  const maxCount = Math.max(...(monData?.top_ips ?? []).map((e) => e.count), 1);
  const maxFPCount = Math.max(...(monData?.top_fingerprints ?? []).map((e) => e.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Animations */}
      <style>{`
        @keyframes mon-fade-up   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mon-pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        @keyframes mon-spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes mon-glow-beat { 0%,100%{box-shadow:0 0 18px var(--glow)} 50%{box-shadow:0 0 36px var(--glow)} }
        @keyframes mon-bar-in    { from{width:0} to{width:var(--w)} }
        .mon-nav-card { cursor:pointer; transition:all 0.2s; border-top:3px solid transparent; }
        .mon-nav-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.3) !important; }
        .mon-nav-card:active { transform:translateY(-1px); }
        .mon-sec { animation:mon-fade-up 0.45s ease both; }
        .mon-sec:nth-child(2){animation-delay:0.05s} .mon-sec:nth-child(3){animation-delay:0.10s}
        .mon-sec:nth-child(4){animation-delay:0.15s} .mon-sec:nth-child(5){animation-delay:0.20s}
        .mon-sec:nth-child(6){animation-delay:0.25s} .mon-sec:nth-child(7){animation-delay:0.30s}
        .mon-btn { transition:all 0.18s; }
        .mon-btn:hover { filter:brightness(1.12); transform:translateY(-1px); }
        .mon-btn:active { transform:translateY(0); }
        .mon-input:focus { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.14) !important; }
        .mon-row:hover { background:rgba(255,255,255,0.035) !important; }
        .mon-bar { animation:mon-bar-in 0.7s cubic-bezier(.34,1.56,.64,1) both; }
        .mon-stat:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.28) !important; }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '22px', color: C.text }}>
            🛡️ مراقبة التسجيلات التجريبية
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.muted }}>
            تحكم شامل في حماية التسجيلات — يتجدد كل 30 ثانية تلقائياً
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {monData && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: monData.redis_ok ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${monData.redis_ok ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
                fontSize: '12px',
                fontWeight: 700,
                color: monData.redis_ok ? 'var(--status-success)' : 'var(--status-warning)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: monData.redis_ok ? 'var(--status-success)' : 'var(--status-warning)',
                  display: 'inline-block',
                  animation: 'mon-pulse-dot 2s infinite',
                }}
              />
              {monData.redis_ok ? 'Redis متصل' : 'Redis غير متصل'}
            </div>
          )}
          <button
            onClick={() => void onRefetch()}
            className="mon-btn"
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: `1px solid ${C.border}`,
              background: 'rgba(34,197,94,0.1)',
              color: 'var(--status-success)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* Quick Nav */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px' }}>
        {[
          { id: 'mon-status', icon: '🟢', label: 'حالة النظام', color: st.color },
          { id: 'mon-stats', icon: '📊', label: 'الإحصائيات', color: 'var(--status-info)' },
          { id: 'mon-unblock', icon: '🔓', label: 'رفع الحجب', color: 'var(--status-success)' },
          { id: 'mon-ips', icon: '🌐', label: 'أعلى IPs', color: 'var(--status-info)' },
          { id: 'mon-suspects', icon: '🚨', label: 'المشبوهون', color: 'var(--status-danger)' },
          { id: 'mon-blocks', icon: '🔒', label: 'آخر الحجوبات', color: 'var(--status-warning)' },
        ].map((n) => (
          <div
            key={n.id}
            className="mon-nav-card"
            onClick={() => scrollTo(n.id)}
            style={{
              padding: '12px 10px',
              borderRadius: '14px',
              textAlign: 'center',
              background: C.card,
              border: `1px solid ${C.border}`,
              borderTop: `3px solid ${n.color}`,
            }}
          >
            <div style={{ fontSize: '18px', marginBottom: '5px' }}>{n.icon}</div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: n.color }}>{n.label}</div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {monLoading && (
        <div style={{ textAlign: 'center', padding: '60px', color: C.muted }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid rgba(99,102,241,0.2)',
              borderTopColor: 'var(--status-info)',
              margin: '0 auto 16px',
              animation: 'mon-spin 0.8s linear infinite',
            }}
          />
          <div style={{ fontWeight: 700 }}>جارٍ تحميل بيانات المراقبة...</div>
        </div>
      )}

      {/* Error */}
      {monError && !monLoading && (
        <div
          style={{
            background: 'rgba(239,68,68,0.05)',
            border: `1px solid rgba(239,68,68,0.2)`,
            borderRadius: '16px',
            padding: '48px 40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔴</div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 900,
              color: 'var(--status-danger)',
              marginBottom: '8px',
            }}
          >
            تعذّر تحميل بيانات المراقبة
          </div>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '20px' }}>
            تحقق من اتصال السيرفر وأعد المحاولة
          </div>
          <button
            onClick={() => void onRefetch()}
            className="mon-btn"
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: `1px solid rgba(239,68,68,0.3)`,
              background: 'rgba(239,68,68,0.1)',
              color: 'var(--status-danger)',
              cursor: 'pointer',
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      )}

      {monData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Redis Warning */}
          {!monData.redis_ok && (
            <div
              className="mon-sec"
              style={{
                background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(234,88,12,0.06))',
                border: '1.5px solid rgba(245,158,11,0.35)',
                borderRadius: '18px',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(245,158,11,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 900,
                    color: 'var(--status-warning)',
                    fontSize: '14px',
                    marginBottom: '4px',
                  }}
                >
                  Redis غير متاح — المراقبة المتقدمة معطلة جزئياً
                </div>
                <div style={{ fontSize: '12px', color: C.muted, lineHeight: 1.7 }}>
                  التسجيل يعمل عادياً. لتفعيل المراقبة الكاملة:{' '}
                  <code
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      color: 'var(--status-success)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  >
                    REDIS_URL=redis://127.0.0.1:6379
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* §1 STATUS HERO */}
          <div
            id="mon-status"
            className="mon-sec"
            style={{
              background: C.card,
              border: `1px solid ${st.border}`,
              borderTop: `3px solid ${st.color}`,
              borderRadius: '16px',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: st.grad,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div
                  style={
                    {
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      background: st.bg,
                      border: `1px solid ${st.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '30px',
                      animation: 'mon-glow-beat 3s ease infinite',
                      '--glow': st.glow,
                    } as React.CSSProperties
                  }
                >
                  {st.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: C.muted,
                      marginBottom: '4px',
                    }}
                  >
                    حالة نظام الحماية
                  </div>
                  <div
                    style={{ fontSize: '28px', fontWeight: 900, color: st.color, lineHeight: 1 }}
                  >
                    {st.label}
                  </div>
                  {monData.pause_reason && (
                    <div style={{ fontSize: '12px', color: C.muted, marginTop: '4px' }}>
                      📝 {monData.pause_reason}
                    </div>
                  )}
                  {monData.pause_until && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--status-warning)',
                        marginTop: '4px',
                        fontWeight: 700,
                      }}
                    >
                      ⏱️ متوقف حتى: {new Date(monData.pause_until).toLocaleString('ar-EG')}
                      {monData.pause_remaining_seconds > 0 &&
                        ` — ${Math.ceil(monData.pause_remaining_seconds / 60)} دقيقة متبقية`}
                    </div>
                  )}
                  {monData.warning_fired_at && monData.status === 'warning' && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--status-warning)',
                        marginTop: '4px',
                        fontWeight: 700,
                      }}
                    >
                      ⚡ تحذير نشط منذ: {new Date(monData.warning_fired_at).toLocaleString('ar-EG')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {monData.status === 'warning' && (
                  <button
                    className="mon-btn"
                    onClick={async () => {
                      await authFetch('/api/super/trial-monitoring/clear-warning', {
                        method: 'POST',
                      });
                      void onRefetch();
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '10px',
                      border: '1px solid rgba(245,158,11,0.4)',
                      background: 'rgba(245,158,11,0.1)',
                      color: 'var(--status-warning)',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    🧹 مسح التحذير
                  </button>
                )}
                {monData.status !== 'paused' ? (
                  <button
                    className="mon-btn"
                    onClick={async () => {
                      const mins = prompt('مدة الإيقاف بالدقائق (1-1440):');
                      if (!mins || isNaN(Number(mins))) return;
                      const reason = prompt('سبب الإيقاف:') || 'إيقاف يدوي من المشرف';
                      await authFetch('/api/super/trial-monitoring/pause', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ minutes: Number(mins), reason }),
                      });
                      void onRefetch();
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '10px',
                      border: '1px solid rgba(239,68,68,0.4)',
                      background: 'rgba(239,68,68,0.1)',
                      color: 'var(--status-danger)',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    ⏸️ إيقاف مؤقت
                  </button>
                ) : (
                  <button
                    className="mon-btn"
                    onClick={async () => {
                      await authFetch('/api/super/trial-monitoring/resume', { method: 'POST' });
                      void onRefetch();
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '10px',
                      border: '1px solid rgba(52,211,153,0.4)',
                      background: 'rgba(52,211,153,0.12)',
                      color: 'var(--status-success)',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    ▶️ استئناف التسجيلات
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* §2 STATS GRID */}
          <div
            id="mon-stats"
            className="mon-sec"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
              gap: '16px',
            }}
          >
            {(() => {
              const reg = monData.registrations_in_window;
              const regColor =
                reg >= monData.block_threshold
                  ? 'var(--status-danger)'
                  : reg >= monData.alert_threshold
                    ? 'var(--status-warning)'
                    : 'var(--status-success)';
              const regGlow =
                reg >= monData.block_threshold
                  ? 'rgba(239,68,68,0.2)'
                  : reg >= monData.alert_threshold
                    ? 'rgba(245,158,11,0.2)'
                    : 'rgba(52,211,153,0.2)';
              const pct = Math.min(100, Math.round((reg / monData.block_threshold) * 100));
              return [
                {
                  icon: '📈',
                  label: 'تسجيلات في النافذة',
                  value: reg,
                  sub: 'آخر 15 دقيقة',
                  color: regColor,
                  glow: regGlow,
                  bar: pct,
                  barMax: 100,
                  barColor: regColor,
                },
                {
                  icon: '⚠️',
                  label: 'حد التحذير',
                  value: monData.alert_threshold,
                  sub: 'تسجيل / نافذة',
                  color: 'var(--status-warning)',
                  glow: 'rgba(245,158,11,0.15)',
                  bar: null,
                  barMax: 0,
                  barColor: '',
                },
                {
                  icon: '🚫',
                  label: 'حد الإيقاف',
                  value: monData.block_threshold,
                  sub: 'تسجيل / نافذة',
                  color: 'var(--status-danger)',
                  glow: 'rgba(239,68,68,0.15)',
                  bar: null,
                  barMax: 0,
                  barColor: '',
                },
                {
                  icon: '⏱️',
                  label: 'وقت الإيقاف',
                  value:
                    monData.pause_remaining_seconds > 0
                      ? `${Math.ceil(monData.pause_remaining_seconds / 60)} د`
                      : '—',
                  sub: 'متبقي',
                  color: monData.pause_remaining_seconds > 0 ? 'var(--status-danger)' : C.muted,
                  glow: 'rgba(99,102,241,0.15)',
                  bar: null,
                  barMax: 0,
                  barColor: '',
                },
              ];
            })().map((m) => (
              <div
                key={m.label}
                className="mon-stat"
                style={{
                  background: C.card,
                  borderRadius: '16px',
                  border: `1px solid ${m.color}22`,
                  borderTop: `3px solid ${m.color}`,
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'default',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: '22px' }}>{m.icon}</span>
                  <span style={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>{m.sub}</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: '11px', color: C.muted }}>{m.label}</div>
                {m.bar !== null && (
                  <div
                    style={{
                      height: '4px',
                      borderRadius: '2px',
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                      marginTop: '4px',
                    }}
                  >
                    <div
                      className="mon-bar"
                      style={
                        {
                          height: '100%',
                          borderRadius: '2px',
                          background: m.barColor,
                          '--w': `${m.bar}%`,
                          width: `${m.bar}%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* §3 UNBLOCK TOOL */}
          <SectionCard id="mon-unblock" accentColor="var(--status-success)">
            <div className="mon-sec">
              <SectionHead
                icon="🔓"
                title="أداة رفع الحجب الشاملة"
                sub="رفع فوري من قاعدة البيانات + Redis في خطوة واحدة"
                extra={
                  <Pill
                    label="DB + Redis"
                    color="var(--status-success)"
                    bg="rgba(16,185,129,0.12)"
                  />
                }
              />
              <div style={{ padding: '20px 24px' }}>
                <div
                  style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}
                >
                  {[
                    { n: '1', t: 'أدخل IP أو البريد' },
                    { n: '2', t: 'اضغط فحص' },
                    { n: '3', t: 'ارفع الحجب' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'rgba(16,185,129,0.2)',
                          border: '1.5px solid rgba(16,185,129,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 900,
                          color: 'var(--status-success)',
                        }}
                      >
                        {s.n}
                      </div>
                      <span style={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>
                        {s.t}
                      </span>
                      {i < 2 && (
                        <span style={{ color: C.muted, fontSize: '12px', margin: '0 2px' }}>←</span>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: '12px',
                    alignItems: 'flex-end',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: C.muted,
                        fontWeight: 700,
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      🌐 عنوان IP
                    </div>
                    <input
                      value={unblockIP}
                      onChange={(e) => setUnblockIP(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void doLookup()}
                      placeholder="41.234.56.78"
                      dir="ltr"
                      className="mon-input"
                      style={inputSt}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: C.muted,
                        fontWeight: 700,
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      ✉️ البريد الإلكتروني
                    </div>
                    <input
                      value={unblockEmail}
                      onChange={(e) => setUnblockEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void doLookup()}
                      placeholder="customer@email.com"
                      dir="ltr"
                      className="mon-input"
                      style={inputSt}
                    />
                  </div>
                  <button
                    className="mon-btn"
                    disabled={unblockLoading || (!unblockIP.trim() && !unblockEmail.trim())}
                    onClick={() => void doLookup()}
                    style={{
                      padding: '12px 22px',
                      borderRadius: '14px',
                      border: '1.5px solid rgba(6,182,212,0.45)',
                      background: 'rgba(6,182,212,0.12)',
                      color: 'var(--status-info)',
                      cursor: 'pointer',
                      fontFamily: FONT,
                      fontWeight: 800,
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      opacity: !unblockIP.trim() && !unblockEmail.trim() ? 0.4 : 1,
                    }}
                  >
                    🔍 فحص
                  </button>
                </div>
                <div
                  style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}
                >
                  <button
                    className="mon-btn"
                    disabled={unblockLoading || (!unblockIP.trim() && !unblockEmail.trim())}
                    onClick={() => void doUnblockAll()}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '14px 28px',
                      borderRadius: '16px',
                      background: unblockLoading
                        ? 'rgba(16,185,129,0.1)'
                        : 'linear-gradient(135deg,#10B981,#06B6D4)',
                      border: 'none',
                      color: 'var(--text-1)',
                      cursor: unblockLoading ? 'not-allowed' : 'pointer',
                      fontFamily: FONT,
                      fontWeight: 900,
                      fontSize: '15px',
                      opacity: !unblockIP.trim() && !unblockEmail.trim() ? 0.4 : 1,
                      boxShadow:
                        !unblockIP.trim() && !unblockEmail.trim()
                          ? 'none'
                          : '0 6px 24px rgba(16,185,129,0.35)',
                    }}
                  >
                    {unblockLoading ? '⏳ جارٍ رفع الحجب...' : '🔓 رفع جميع الحجوبات (DB + Redis)'}
                  </button>
                  <button
                    className="mon-btn"
                    onClick={() => {
                      setUnblockIP('');
                      setUnblockEmail('');
                      setUnblockResult(null);
                      setUnblockMsg(null);
                    }}
                    style={{
                      padding: '14px 20px',
                      borderRadius: '16px',
                      border: `1.5px solid ${C.border}`,
                      background: 'transparent',
                      color: C.muted,
                      cursor: 'pointer',
                      fontFamily: FONT,
                      fontWeight: 700,
                      fontSize: '14px',
                    }}
                  >
                    🗑️ مسح
                  </button>
                </div>
                {unblockMsg && (
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: '16px',
                      marginBottom: '16px',
                      background: unblockMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
                      border: `1.5px solid ${unblockMsg.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                      color: unblockMsg.ok ? 'var(--status-success)' : 'var(--status-danger)',
                      fontSize: '14px',
                      fontWeight: 800,
                    }}
                  >
                    {unblockMsg.text}
                  </div>
                )}
                {unblockResult && (
                  <div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
                        gap: '12px',
                        marginBottom: '16px',
                      }}
                    >
                      {[
                        {
                          label: 'حجوبات نشطة',
                          value: unblockResult.active_blocks ?? 0,
                          color:
                            (unblockResult.active_blocks ?? 0) > 0
                              ? 'var(--status-danger)'
                              : 'var(--status-success)',
                          bg:
                            (unblockResult.active_blocks ?? 0) > 0
                              ? 'rgba(239,68,68,0.08)'
                              : 'rgba(52,211,153,0.08)',
                          border:
                            (unblockResult.active_blocks ?? 0) > 0
                              ? 'rgba(239,68,68,0.3)'
                              : 'rgba(52,211,153,0.3)',
                        },
                        {
                          label: 'تم رفع حجبها',
                          value: unblockResult.overridden_blocks ?? 0,
                          color: 'var(--status-success)',
                          bg: 'rgba(52,211,153,0.08)',
                          border: 'rgba(52,211,153,0.25)',
                        },
                        {
                          label: 'إجمالي السجلات',
                          value: (unblockResult.rows ?? []).length,
                          color: C.text,
                          bg: 'rgba(255,255,255,0.04)',
                          border: C.border,
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          style={{
                            padding: '16px',
                            borderRadius: '16px',
                            background: s.bg,
                            border: `1.5px solid ${s.border}`,
                            textAlign: 'center',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '11px',
                              color: C.muted,
                              fontWeight: 700,
                              marginBottom: '8px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {s.label}
                          </div>
                          <div style={{ fontSize: '32px', fontWeight: 900, color: s.color }}>
                            {s.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    {(unblockResult.active_blocks ?? 0) === 0 &&
                      (unblockResult.rows ?? []).length === 0 && (
                        <div
                          style={{
                            padding: '14px 18px',
                            borderRadius: '14px',
                            background: 'rgba(245,158,11,0.08)',
                            border: '1.5px solid rgba(245,158,11,0.3)',
                            color: 'var(--status-warning)',
                            fontSize: '13px',
                            fontWeight: 700,
                            marginBottom: '12px',
                          }}
                        >
                          ⚠️ لا توجد سجلات في قاعدة البيانات — تحقق من Redis أو IP مختلف
                        </div>
                      )}
                    {(unblockResult.rows ?? []).length > 0 && (
                      <div
                        style={{
                          overflowX: 'auto',
                          borderRadius: '14px',
                          border: `1px solid ${C.border}`,
                        }}
                      >
                        <table
                          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}
                        >
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                              {['البريد', 'IP', 'البصمة', 'الحالة', 'التاريخ'].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    padding: '10px 14px',
                                    textAlign: 'right',
                                    color: C.muted,
                                    fontWeight: 700,
                                    borderBottom: `1px solid ${C.border}`,
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(unblockResult.rows ?? []).map((r) => (
                              <tr
                                key={r.id}
                                className="mon-row"
                                style={{
                                  borderBottom: `1px solid ${C.border}`,
                                  transition: 'background 0.15s',
                                }}
                              >
                                <td
                                  style={{
                                    padding: '10px 14px',
                                    color: C.text,
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {r.email}
                                </td>
                                <td
                                  style={{
                                    padding: '10px 14px',
                                    color: C.muted,
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {r.ip}
                                </td>
                                <td
                                  style={{
                                    padding: '10px 14px',
                                    color: C.muted,
                                    fontFamily: 'monospace',
                                    fontSize: '11px',
                                  }}
                                >
                                  {r.fingerprint ? r.fingerprint.slice(0, 10) + '…' : '—'}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {r.override_reason ? (
                                    <Pill
                                      label="✓ مرفوع"
                                      color="var(--status-success)"
                                      bg="rgba(52,211,153,0.1)"
                                    />
                                  ) : (
                                    <Pill
                                      label="🚫 محجوب"
                                      color="var(--status-danger)"
                                      bg="rgba(239,68,68,0.1)"
                                    />
                                  )}
                                </td>
                                <td
                                  style={{ padding: '10px 14px', color: C.muted, fontSize: '11px' }}
                                >
                                  {new Date(r.created_at).toLocaleDateString('ar-EG')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* §4 TOP IPs + FPs */}
          <div
            id="mon-ips"
            className="mon-sec"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}
          >
            <SectionCard id="mon-ips-inner2" accentColor="var(--status-info)">
              <SectionHead
                icon="🌐"
                title="أعلى عناوين IP"
                sub={`${(monData.top_ips ?? []).length} عنوان مشبوه`}
              />
              <div style={{ padding: '20px 24px' }}>
                {(monData.top_ips ?? []).length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: C.muted,
                      fontSize: '13px',
                    }}
                  >
                    {monData.redis_ok
                      ? '✅ لا توجد بيانات في النافذة الحالية'
                      : '⚠️ Redis غير متاح'}
                  </div>
                ) : (
                  (monData.top_ips ?? []).map((e, i) => {
                    const pct = Math.round((e.count / maxCount) * 100);
                    const danger = e.count >= 5;
                    return (
                      <div
                        key={e.ip}
                        style={{
                          marginBottom: i < (monData.top_ips ?? []).length - 1 ? '14px' : '0',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: C.muted,
                                minWidth: '16px',
                                textAlign: 'center',
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span
                              style={{ fontFamily: 'monospace', fontSize: '13px', color: C.text }}
                            >
                              {e.ip}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 900,
                                color: danger ? 'var(--status-danger)' : 'var(--status-warning)',
                              }}
                            >
                              {e.count}
                            </span>
                            <button
                              className="mon-btn"
                              onClick={() => {
                                setUnblockIP(e.ip);
                                setUnblockResult(null);
                                setUnblockMsg(null);
                                scrollTo('mon-unblock');
                              }}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(16,185,129,0.4)',
                                background: 'rgba(16,185,129,0.1)',
                                color: 'var(--status-success)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: FONT,
                              }}
                            >
                              رفع
                            </button>
                          </div>
                        </div>
                        <div
                          style={{
                            height: '6px',
                            borderRadius: '3px',
                            background: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            className="mon-bar"
                            style={
                              {
                                height: '100%',
                                borderRadius: '3px',
                                background: danger
                                  ? 'linear-gradient(90deg,#EF4444,#F97316)'
                                  : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
                                '--w': `${pct}%`,
                                width: `${pct}%`,
                                animationDelay: `${i * 0.07}s`,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard id="mon-fps-inner2" accentColor="var(--status-info)">
              <SectionHead
                icon="🖥️"
                title="أعلى بصمات الأجهزة"
                sub={`${(monData.top_fingerprints ?? []).length} جهاز مشبوه`}
              />
              <div style={{ padding: '20px 24px' }}>
                {(monData.top_fingerprints ?? []).length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 0',
                      color: C.muted,
                      fontSize: '13px',
                    }}
                  >
                    {monData.redis_ok
                      ? '✅ لا توجد بيانات في النافذة الحالية'
                      : '⚠️ Redis غير متاح'}
                  </div>
                ) : (
                  (monData.top_fingerprints ?? []).map((e, i) => {
                    const pct = Math.round((e.count / maxFPCount) * 100);
                    const danger = e.count >= 3;
                    return (
                      <div
                        key={e.fingerprint}
                        style={{
                          marginBottom:
                            i < (monData.top_fingerprints ?? []).length - 1 ? '14px' : '0',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: C.muted,
                                minWidth: '16px',
                                textAlign: 'center',
                              }}
                            >
                              #{i + 1}
                            </span>
                            <span
                              style={{ fontFamily: 'monospace', fontSize: '11px', color: C.muted }}
                            >
                              {e.fingerprint.slice(0, 18)}…
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 900,
                              color: danger ? 'var(--status-danger)' : 'var(--status-warning)',
                            }}
                          >
                            {e.count}
                          </span>
                        </div>
                        <div
                          style={{
                            height: '6px',
                            borderRadius: '3px',
                            background: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            className="mon-bar"
                            style={
                              {
                                height: '100%',
                                borderRadius: '3px',
                                background: danger
                                  ? 'linear-gradient(90deg,#8B5CF6,#EF4444)'
                                  : 'linear-gradient(90deg,#8B5CF6,#A78BFA)',
                                '--w': `${pct}%`,
                                width: `${pct}%`,
                                animationDelay: `${i * 0.07}s`,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>
          </div>

          {/* §5 SUSPICIOUS COMPANIES */}
          <div id="mon-suspects" className="mon-sec">
            <SectionCard id="mon-suspects-inner2" accentColor="var(--status-danger)">
              <SectionHead
                icon="🚨"
                title="الحسابات المشبوهة"
                sub={`${(monData.suspicious_companies ?? []).length} حساب يستحق المراجعة`}
                extra={
                  (monData.suspicious_companies ?? []).length > 0 ? (
                    <Pill
                      label={`${(monData.suspicious_companies ?? []).length} مشبوه`}
                      color="var(--status-danger)"
                      bg="rgba(239,68,68,0.1)"
                    />
                  ) : (
                    <Pill
                      label="✅ لا شيء"
                      color="var(--status-success)"
                      bg="rgba(52,211,153,0.1)"
                    />
                  )
                }
              />
              <div style={{ padding: '16px 24px 24px' }}>
                {(monData.suspicious_companies ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      لا توجد حسابات مشبوهة حالياً
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(monData.suspicious_companies ?? []).map((c) => {
                      const sc =
                        c.trial_score < 30
                          ? 'var(--status-danger)'
                          : c.trial_score < 60
                            ? 'var(--status-warning)'
                            : 'var(--status-success)';
                      return (
                        <div
                          key={c.id}
                          className="mon-row"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto auto',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '14px 18px',
                            borderRadius: '14px',
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${C.border}`,
                            transition: 'background 0.15s',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '14px', color: C.text }}>
                              {c.name}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: C.muted,
                                fontFamily: 'monospace',
                                marginTop: '2px',
                              }}
                            >
                              {c.email ?? '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div
                              style={{
                                fontSize: '10px',
                                color: C.muted,
                                fontWeight: 700,
                                marginBottom: '3px',
                              }}
                            >
                              درجة الثقة
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: 900, color: sc }}>
                              {c.trial_score}
                            </div>
                          </div>
                          <Pill
                            label={
                              c.verification_status === 'verified'
                                ? '✓ موثق'
                                : c.verification_status === 'pending'
                                  ? '⏳ معلق'
                                  : c.verification_status
                            }
                            color={
                              c.verification_status === 'verified'
                                ? 'var(--status-success)'
                                : 'var(--status-warning)'
                            }
                            bg={
                              c.verification_status === 'verified'
                                ? 'rgba(52,211,153,0.1)'
                                : 'rgba(245,158,11,0.1)'
                            }
                          />
                          <Pill
                            label="🚨 مشبوه"
                            color="var(--status-danger)"
                            bg="rgba(239,68,68,0.1)"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* §6 RECENT BLOCKS */}
          <div id="mon-blocks" className="mon-sec">
            <SectionCard id="mon-blocks-inner2" accentColor="var(--status-warning)">
              <SectionHead
                icon="🔒"
                title="آخر محاولات محجوبة"
                sub="الـ 20 محاولة الأخيرة في الوقت الفعلي"
                extra={
                  (monData.recent_blocks ?? []).length > 0 ? (
                    <Pill
                      label={`${(monData.recent_blocks ?? []).length} محاولة`}
                      color="var(--status-warning)"
                      bg="rgba(245,158,11,0.1)"
                    />
                  ) : (
                    <Pill
                      label="✅ لا شيء"
                      color="var(--status-success)"
                      bg="rgba(52,211,153,0.1)"
                    />
                  )
                }
              />
              <div style={{ padding: '16px 24px 24px' }}>
                {(monData.recent_blocks ?? []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      لم يتم حجب أي محاولة مؤخراً
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(monData.recent_blocks ?? []).map((b, i) => (
                      <div
                        key={i}
                        className="mon-row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr auto auto',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '13px 18px',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${C.border}`,
                          transition: 'background 0.15s',
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: C.text }}>
                            {b.email}
                          </div>
                          <div
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              color: C.muted,
                              marginTop: '2px',
                            }}
                          >
                            {b.ip}
                          </div>
                        </div>
                        <div>
                          <Pill
                            label={b.reason}
                            color="var(--status-danger)"
                            bg="rgba(239,68,68,0.1)"
                          />
                          <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>
                            {new Date(b.created_at).toLocaleString('ar-EG')}
                          </div>
                        </div>
                        <Pill
                          label="🚫 محجوب"
                          color="var(--status-danger)"
                          bg="rgba(239,68,68,0.08)"
                        />
                        <button
                          className="mon-btn"
                          onClick={() => {
                            setUnblockIP(b.ip);
                            setUnblockEmail(b.email ?? '');
                            setUnblockResult(null);
                            setUnblockMsg(null);
                            scrollTo('mon-unblock');
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '12px',
                            border: '1.5px solid rgba(16,185,129,0.45)',
                            background:
                              'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1))',
                            color: 'var(--status-success)',
                            cursor: 'pointer',
                            fontFamily: FONT,
                            fontWeight: 800,
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🔓 رفع الحجب
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
