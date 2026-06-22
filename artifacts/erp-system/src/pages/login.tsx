/* eslint-disable erp/no-hardcoded-colors -- Login v4: full dark control-center aesthetic */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';

/* ══════════════════════════════════════════════
   Login v4 — dark control-center aesthetic
   Both panels dark. Entrance to a workspace.
   All auth logic preserved 1:1.
══════════════════════════════════════════════ */

/* ── Palette (same as LandingPage v4) ── */
const C = {
  bg:      '#09090B',
  surface: '#0D0D12',
  surface2:'#111115',
  border:  '#1C1C21',
  border2: '#27272A',
  text1:   '#F8F8FA',
  text2:   '#A1A1AA',
  text3:   '#71717A',
  text4:   '#52525B',
  text5:   '#3F3F46',
  accent:  '#6366F1',
} as const;

const LOGIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

.v4-login *, .v4-login *::before, .v4-login *::after { box-sizing: border-box; }
.v4-login {
  font-family: 'Tajawal', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@keyframes v4-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}
@keyframes v4-spin { to { transform: rotate(360deg); } }
@keyframes v4-shake {
  0%,100% { transform: translateX(0); }
  25%     { transform: translateX(-4px); }
  75%     { transform: translateX(4px); }
}

/* ── Dark inputs ── */
.v4-input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 8px;
  background: ${C.surface2};
  border: 1px solid ${C.border2};
  color: ${C.text1};
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
  direction: rtl;
  text-align: right;
}
.v4-input::placeholder { color: ${C.text5}; }
.v4-input:hover:not(:disabled):not(:focus) { border-color: ${C.text5}; }
.v4-input:focus {
  border-color: ${C.accent};
  box-shadow: 0 0 0 3px rgba(99,102,241,.14);
}
.v4-input:disabled { opacity: .4; cursor: not-allowed; }
.v4-input-error { border-color: #EF4444 !important; box-shadow: 0 0 0 3px rgba(239,68,68,.10) !important; }
.v4-input-pw { padding-right: 44px; padding-left: 14px; font-family: 'Inter', monospace; letter-spacing: .06em; }

/* Autofill dark override */
.v4-input:-webkit-autofill,
.v4-input:-webkit-autofill:hover,
.v4-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px ${C.surface2} inset;
  -webkit-text-fill-color: ${C.text1};
  box-shadow: 0 0 0 1000px ${C.surface2} inset;
  transition: background-color 99999s ease-in-out 0s;
}

/* ── Password toggle ── */
.v4-pw-toggle {
  position: absolute; top: 50%; right: 14px; transform: translateY(-50%);
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: ${C.text4}; border-radius: 6px;
  transition: color .15s ease;
}
.v4-pw-toggle:hover { color: ${C.text2}; }

/* ── Text links ── */
.v4-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: inherit;
  color: ${C.accent};
  font-size: 13px; font-weight: 600;
  text-decoration: none;
  transition: opacity .15s ease;
}
.v4-link:hover { opacity: .75; }

/* ── Buttons (scoped to login panel) ── */
.v4-login .v4-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 48px;
  border-radius: 8px; border: none; cursor: pointer;
  background: ${C.accent}; color: #fff;
  font-size: 14.5px; font-weight: 600; font-family: inherit;
  transition: background .15s ease;
  margin-bottom: 12px;
}
.v4-login .v4-btn-primary:hover { background: #4F46E5; }
.v4-login .v4-btn-primary:active { transform: scale(0.99); }
.v4-login .v4-btn-primary:disabled { opacity: .45; cursor: not-allowed; }

.v4-login .v4-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 46px;
  border-radius: 8px; cursor: pointer;
  background: transparent; color: ${C.text2};
  border: 1px solid ${C.border2};
  font-size: 14px; font-weight: 500; font-family: inherit;
  transition: color .15s ease, border-color .15s ease;
}
.v4-login .v4-btn-ghost:hover { color: ${C.text1}; border-color: ${C.text5}; }

/* ── Responsive ── */
@media (max-width: 860px) {
  .v4-brand-panel { display: none !important; }
  .v4-form-panel  { flex: 1 !important; }
}
`;

/* ── Icons ── */
const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const isRegisterFromUrl =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('tab') === 'register';
  const [showRegister, setShowRegister] = useState(isRegisterFromUrl);

  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRef      = useRef<HTMLInputElement>(null);
  const errorRef    = useRef<HTMLDivElement>(null);

  /* Inject CSS once */
  useEffect(() => {
    if (document.getElementById('muhkam-login-css')) return;
    const el = document.createElement('style');
    el.id = 'muhkam-login-css';
    el.textContent = LOGIN_CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  useEffect(() => {
    if (!showRegister) setTimeout(() => usernameRef.current?.focus(), 100);
  }, [showRegister]);

  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'v4-shake .35s ease';
  }, [error]);

  const explicitCompanyId: number | null = (() => {
    if (typeof window === 'undefined') return null;
    const fromUrl = Number(new URLSearchParams(window.location.search).get('company_id'));
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;
    return null;
  })();

  const handleRegisterSuccess = useCallback(
    (
      user: {
        id: number; name: string; username: string; role: string;
        active?: boolean; warehouse_id?: number | null; safe_id?: number | null;
        permissions?: Record<string, boolean>; company_id?: number | null;
      },
      companyId: number
    ) => {
      const registeredUser = { ...user, company_id: companyId || user.company_id || null };
      if (registeredUser.company_id)
        localStorage.setItem('erp_company_id', String(registeredUser.company_id));
      login(registeredUser);
      setLocation('/');
    },
    [login, setLocation]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const trimmed = username.trim();
      if (!trimmed) { setError('أدخل رقم الهاتف أو اسم المستخدم'); usernameRef.current?.focus(); return; }
      if (!pin)      { setError('أدخل الرقم السري'); pinRef.current?.focus(); return; }

      setLoading(true);
      try {
        const body = {
          username: trimmed.toLowerCase(),
          pin,
          ...(explicitCompanyId ? { company_id: explicitCompanyId } : {}),
        };
        const res = await fetch(api('/api/auth/login'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'الرقم السري غير صحيح');
          setPin(''); pinRef.current?.focus(); return;
        }
        const responseData = (await res.json()) as {
          requires_2fa?: boolean; temp_token?: string; message?: string;
          user?: { id: number; name: string; username: string; role: string; active?: boolean; warehouse_id?: number | null; safe_id?: number | null; permissions?: Record<string, boolean>; company_id?: number | null; };
        };
        if (responseData.requires_2fa && responseData.temp_token) {
          setTempToken(responseData.temp_token); setRequires2FA(true); setLoading(false); return;
        }
        const authedUser = responseData.user!;
        if (authedUser.role === 'cashier' || authedUser.role === 'salesperson') {
          if (!authedUser.warehouse_id) { setError('هذا المستخدم غير مرتبط بمخزن — راجع المدير'); setLoading(false); return; }
          if (!authedUser.safe_id)      { setError('هذا المستخدم غير مرتبط بخزنة — راجع المدير'); setLoading(false); return; }
        }
        if (authedUser.company_id) localStorage.setItem('erp_company_id', String(authedUser.company_id));
        login(authedUser); setLocation('/');
      } catch { setError('تعذّر الاتصال بالخادم'); }
      finally  { setLoading(false); }
    },
    [username, pin, explicitCompanyId, login, setLocation]
  );

  const handleTotpSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (totpCode.length !== 6) { setError('أدخل 6 أرقام'); return; }
      setTotpLoading(true); setError('');
      try {
        const res = await fetch(api('/api/auth/2fa/login'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ temp_token: tempToken, totp_code: totpCode }),
          credentials: 'include',
        });
        const data = (await res.json()) as {
          user?: { id: number; name: string; username: string; role: string; company_id?: number | null; };
          error?: string;
        };
        if (!res.ok || !data.user) { setError(data.error ?? 'رمز التحقق غير صحيح'); setTotpCode(''); return; }
        login(data.user as Parameters<typeof login>[0]); setLocation('/');
      } catch { setError('تعذّر الاتصال بالخادم'); }
      finally  { setTotpLoading(false); }
    },
    [totpCode, tempToken, login, setLocation]
  );

  /* ── Shared error banner ── */
  const ErrorBanner = () => error ? (
    <div
      id="login-error"
      ref={errorRef}
      role="alert"
      aria-live="polite"
      style={{
        marginBottom: 20,
        padding: '11px 14px',
        background: 'rgba(239,68,68,.08)',
        border: '1px solid rgba(239,68,68,.25)',
        borderRadius: 8,
        fontSize: 13,
        color: '#F87171',
        fontWeight: 500,
      }}
    >
      {error}
    </div>
  ) : null;

  /* ── Brand panel (right in RTL) ── */
  const BrandPanel = () => (
    <div
      className="v4-brand-panel"
      style={{
        flex: '0 0 52%',
        minHeight: '100vh',
        background: C.bg,
        borderLeft: `1px solid ${C.border}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 72px',
        overflow: 'hidden',
      }}
    >
      {/* Dot grid */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle, ${C.border} 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          opacity: .5,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 65% 65% at 50% 50%, ${C.bg} 20%, transparent 100%)`,
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, animation: 'v4-up .55s ease both' }} dir="rtl">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 32 }}>
          <span style={{ fontSize: 72, fontWeight: 800, color: C.text1, letterSpacing: '-0.04em', lineHeight: 1 }}>مُحكم</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.accent, letterSpacing: '0.18em', alignSelf: 'flex-end', marginBottom: 8 }}>ERP</span>
        </div>

        {/* Divider */}
        <div style={{ width: 48, height: 1, background: C.border2, marginBottom: 28 }} />

        {/* Tagline */}
        <p style={{ fontSize: 18, color: C.text3, fontWeight: 400, lineHeight: 1.75, maxWidth: 380 }}>
          نظام إدارة موارد المؤسسات.<br />
          مُصمم للسوق العربي.
        </p>

        {/* Module tags */}
        <div style={{ marginTop: 52, display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
          {['المحاسبة','المبيعات','الموارد البشرية','المخزون','الصيانة','التقارير'].map((m) => (
            <span key={m} style={{ fontSize: 12, color: C.text5, fontWeight: 500 }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Copyright */}
      <div
        style={{
          position: 'absolute', bottom: 40,
          right: 72, left: 72,
          fontSize: 12, color: C.text5, fontWeight: 400,
        }}
        dir="rtl"
      >
        © 2026 مُحكم ERP · جميع الحقوق محفوظة
      </div>
    </div>
  );

  /* ─── RENDER ─── */
  return (
    <div
      className="v4-login"
      dir="rtl"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row', background: C.bg, color: C.text1 }}
    >
      {/* Brand panel — right in RTL (first in DOM = right visually) */}
      <BrandPanel />

      {/* Form panel — left in RTL */}
      <div
        className="v4-form-panel"
        style={{
          flex: 1,
          minHeight: '100vh',
          background: C.surface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380, animation: 'v4-up .45s .05s ease both' }}>

          {/* Mobile-only logo */}
          <div
            style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 40, justifyContent: 'center' }}
            className="v4-mobile-logo"
          >
            <span style={{ fontSize: 28, fontWeight: 800, color: C.text1, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.15em' }}>ERP</span>
          </div>

          {/* ─── 2FA STEP ─── */}
          {requires2FA ? (
            <form onSubmit={handleTotpSubmit} noValidate aria-label="نموذج التحقق الثنائي">
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text1, marginBottom: 8, letterSpacing: '-0.015em' }}>
                التحقق الثنائي
              </h2>
              <p style={{ fontSize: 14, color: C.text3, lineHeight: 1.7, marginBottom: 28 }}>
                افتح{' '}
                <span style={{ color: C.text1, fontWeight: 600 }}>Google Authenticator</span>{' '}
                أو <span style={{ color: C.text1, fontWeight: 600 }}>Authy</span>{' '}
                وأدخل الرمز المكوّن من 6 أرقام.
              </p>

              <ErrorBanner />

              <input
                value={totpCode}
                onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && totpCode.length === 6) void handleTotpSubmit(e as unknown as React.FormEvent); }}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                aria-label="رمز التحقق الثنائي"
                className="v4-input"
                style={{ height: 58, fontSize: 26, fontFamily: 'Inter, monospace', letterSpacing: '0.55em', textAlign: 'center', marginBottom: 16, paddingRight: 0, paddingLeft: 0 }}
                maxLength={6}
              />

              <button type="submit" disabled={totpLoading || totpCode.length !== 6} className="v4-btn-primary">
                {totpLoading ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.25)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'v4-spin .7s linear infinite' }} />
                    <span>جاري التحقق…</span>
                  </>
                ) : <span>تحقق</span>}
              </button>

              <button
                type="button"
                className="v4-btn-ghost"
                onClick={() => { setRequires2FA(false); setTempToken(''); setTotpCode(''); setError(''); setPin(''); }}
              >
                رجوع
              </button>
            </form>

          ) : showRegister ? (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text1, marginBottom: 6, letterSpacing: '-0.015em' }}>
                إنشاء حساب جديد
              </h1>
              <p style={{ fontSize: 14, color: C.text3, marginBottom: 28 }}>
                تجربة مجانية لمدة ٧ أيام — بدون بطاقة ائتمان
              </p>
              <RegisterForm
                onSuccess={handleRegisterSuccess}
                onSwitch={() => { setShowRegister(false); setError(''); }}
              />
            </>

          ) : (
            <LoginFormFields
              username={username} setUsername={setUsername}
              pin={pin} setPin={setPin}
              showPin={showPin} setShowPin={setShowPin}
              error={error} setError={setError}
              loading={loading}
              usernameRef={usernameRef} pinRef={pinRef} errorRef={errorRef}
              handleSubmit={handleSubmit}
              onShowRegister={() => { setShowRegister(true); setError(''); }}
            />
          )}

          {/* Security footer */}
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              color: C.text5,
              fontWeight: 400,
            }}
          >
            <LockIcon />
            <span>بحماية تشفير TLS · بيانات كل شركة معزولة تماماً</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Login form fields sub-component
═══════════════════════════════════════════════ */
function LoginFormFields({
  username, setUsername, pin, setPin,
  showPin, setShowPin, error, setError,
  loading, usernameRef, pinRef, errorRef,
  handleSubmit, onShowRegister,
}: {
  username: string; setUsername: (v: string) => void;
  pin: string; setPin: (v: string) => void;
  showPin: boolean; setShowPin: (v: boolean) => void;
  error: string; setError: (v: string) => void;
  loading: boolean;
  usernameRef: React.RefObject<HTMLInputElement | null>;
  pinRef: React.RefObject<HTMLInputElement | null>;
  errorRef: React.RefObject<HTMLDivElement | null>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  onShowRegister: () => void;
}) {
  const C2 = {
    text1: '#F8F8FA', text2: '#A1A1AA', text3: '#71717A', text5: '#3F3F46',
    accent: '#6366F1',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: C2.text2,
    marginBottom: 8,
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="نموذج تسجيل الدخول">
      {/* Heading */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C2.text1, marginBottom: 6, letterSpacing: '-0.015em' }}>
          أهلاً بعودتك
        </h1>
        <p style={{ fontSize: 14, color: C2.text3 }}>
          سجّل الدخول للوصول إلى لوحة التحكم
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div
          id="login-error"
          role="alert"
          aria-live="polite"
          ref={errorRef}
          style={{
            marginBottom: 20,
            padding: '11px 14px',
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 8,
            fontSize: 13,
            color: '#F87171',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Username */}
      <div style={{ marginBottom: 18 }}>
        <label htmlFor="username" style={labelStyle}>رقم الهاتف أو اسم المستخدم</label>
        <input
          ref={usernameRef}
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          placeholder="admin"
          disabled={loading}
          className={`v4-input${error && !username.trim() ? ' v4-input-error' : ''}`}
          onChange={(e) => { setUsername(e.target.value); setError(''); }}
          aria-label="رقم الهاتف أو اسم المستخدم"
          aria-describedby="login-error"
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <label htmlFor="pin" style={{ ...labelStyle, marginBottom: 0 }}>الرقم السري</label>
          <button
            type="button"
            className="v4-link"
            style={{ fontSize: 12 }}
            onClick={() => window.alert('للحصول على كلمة سر جديدة، يرجى التواصل مع مدير النظام في شركتك.')}
          >
            هل نسيت كلمة السر؟
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={pinRef}
            id="pin"
            type={showPin ? 'text' : 'password'}
            autoComplete="current-password"
            value={pin}
            placeholder="••••••"
            disabled={loading}
            className={`v4-input v4-input-pw${error && !pin && username.trim() ? ' v4-input-error' : ''}`}
            onChange={(e) => { setPin(e.target.value); setError(''); }}
            aria-label="الرقم السري"
            aria-describedby="login-error"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPin(!showPin)}
            className="v4-pw-toggle"
            aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
          >
            <EyeIcon open={showPin} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }} />

      {/* Submit */}
      <button type="submit" disabled={loading} className="v4-btn-primary">
        {loading ? (
          <>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.25)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'v4-spin .7s linear infinite' }} />
            <span>جاري التحقق…</span>
          </>
        ) : <span>تسجيل الدخول</span>}
      </button>

      {/* Register link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: C2.text3 }}>
        ليس لديك حساب؟{' '}
        <button type="button" className="v4-link" onClick={onShowRegister}>
          إنشاء حساب جديد
        </button>
      </div>
    </form>
  );
}

export { RegisterForm } from './login/RegisterForm';
