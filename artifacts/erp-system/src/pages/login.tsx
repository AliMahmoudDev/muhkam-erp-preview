/* eslint-disable erp/no-hardcoded-colors -- Login v5: premium Arabic document experience. Warm white, editorial inputs, product screenshot left panel. */
/**
 * MUHKAM Login — v5 (Blank slate)
 * RTL: Form on RIGHT (first DOM child), Brand + Screenshot on LEFT (second DOM child).
 * Inputs: bottom-border only. No rounded boxes. No shadows. No dashboard mockup.
 * Left panel: مُحكم brand + one sentence + real product screenshot.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';
import { DashboardShot } from './landing/AppScreenshots';

/* ── CSS ── */
const LG_CSS_ID = 'muhkam-lg-css';
const LG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

.mh-lg-wrap {
  font-family: 'Tajawal', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@keyframes mh-lg-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
@keyframes mh-spin { to { transform: rotate(360deg); } }
@keyframes mh-shake {
  0%,100% { transform: translateX(0); }
  25%     { transform: translateX(-4px); }
  75%     { transform: translateX(4px); }
}

/* Bottom-border-only input — no box, no radius */
.mh-input {
  width: 100%;
  height: 52px;
  padding: 0 2px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #D8D4CE;
  color: #151515;
  font-family: 'Tajawal', sans-serif;
  font-size: 16px;
  outline: none;
  border-radius: 0;
  direction: rtl;
  text-align: right;
  transition: border-color .15s ease;
  -webkit-appearance: none;
}
.mh-input::placeholder { color: #C2BDB6; font-size: 15px; }
.mh-input:focus { border-bottom-color: #1A56DB; }
.mh-input:hover:not(:focus):not(:disabled) { border-bottom-color: #A8A29E; }
.mh-input:disabled { opacity: .4; cursor: not-allowed; }
.mh-input-error { border-bottom-color: #EF4444 !important; }
.mh-input-pw { padding-left: 40px; font-family: 'Inter', monospace; letter-spacing: .04em; }

/* Autofill — preserve warm white */
.mh-input:-webkit-autofill,
.mh-input:-webkit-autofill:hover,
.mh-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #FAF8F5 inset;
  -webkit-text-fill-color: #151515;
  transition: background-color 99999s ease-in-out 0s;
}

/* Password toggle */
.mh-pw-btn {
  position: absolute; top: 50%; left: 0; transform: translateY(-50%);
  width: 40px; height: 40px;
  background: none; border: none; cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  color: #C2BDB6; transition: color .15s;
}
.mh-pw-btn:hover { color: #7A756E; }

/* Submit button */
.mh-lg-submit {
  width: 100%; height: 52px;
  background: #151515; color: #FAF8F5;
  border: none; border-radius: 7px; cursor: pointer;
  font-family: 'Tajawal', sans-serif; font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
  transition: background .15s ease;
}
.mh-lg-submit:hover:not(:disabled) { background: #2A2A2A; }
.mh-lg-submit:disabled { opacity: .4; cursor: not-allowed; }

/* Text link */
.mh-lg-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: 'Tajawal', sans-serif;
  color: #1A56DB; font-size: 13px; font-weight: 600;
  transition: opacity .15s;
}
.mh-lg-link:hover { opacity: .7; }

/* Responsive */
@media (max-width: 860px) {
  .mh-lg-product-panel { display: none !important; }
  .mh-lg-form-panel    { flex: 1 !important; }
  .mh-lg-mobile-brand  { display: flex !important; }
}
@media (min-width: 861px) {
  .mh-lg-mobile-brand { display: none !important; }
}
`;

/* ── Palette ── */
const C = {
  bg:      '#FAF8F5',
  bgAlt:   '#F2EDE6',
  text:    '#151515',
  muted:   '#7A756E',
  faint:   '#A8A29E',
  border:  '#E7E3DC',
  accent:  '#1A56DB',
} as const;

/* ── Icons ── */
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

const LockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ════════════════════════════════════════════
   Login form fields sub-component
════════════════════════════════════════════ */
function LoginFields({
  username, setUsername, pin, setPin,
  showPin, setShowPin,
  error, setError, loading,
  usernameRef, pinRef, errorRef,
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
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 0 };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="نموذج تسجيل الدخول" style={{ animation: 'mh-lg-up .45s .05s ease both' }}>
      <div style={{ marginBottom: 44 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: C.text, letterSpacing: '-0.03em', marginBottom: 10, lineHeight: 1 }}>
          أهلاً بعودتك
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
          سجّل الدخول للوصول إلى لوحة التحكم
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          id="lg-error"
          ref={errorRef}
          role="alert"
          aria-live="polite"
          style={{
            marginBottom: 32,
            padding: '11px 14px',
            background: 'rgba(239,68,68,.05)',
            border: '1px solid rgba(239,68,68,.18)',
            borderRadius: 6,
            fontSize: 13,
            color: '#B91C1C',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Username */}
      <div style={{ marginBottom: 32 }}>
        <label htmlFor="lg-user" style={labelStyle}>رقم الهاتف أو اسم المستخدم</label>
        <input
          ref={usernameRef}
          id="lg-user" type="text" autoComplete="username"
          value={username} placeholder="admin" disabled={loading}
          className={`mh-input${error && !username.trim() ? ' mh-input-error' : ''}`}
          onChange={(e) => { setUsername(e.target.value); setError(''); }}
          aria-describedby="lg-error"
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label htmlFor="lg-pin" style={labelStyle}>الرقم السري</label>
          <button
            type="button" className="mh-lg-link" style={{ fontSize: 12 }}
            onClick={() => window.alert('للحصول على كلمة سر جديدة، يرجى التواصل مع مدير النظام في شركتك.')}
          >
            نسيت؟
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={pinRef}
            id="lg-pin" type={showPin ? 'text' : 'password'} autoComplete="current-password"
            value={pin} placeholder="••••••" disabled={loading}
            className={`mh-input mh-input-pw${error && !pin && username.trim() ? ' mh-input-error' : ''}`}
            onChange={(e) => { setPin(e.target.value); setError(''); }}
            aria-describedby="lg-error"
          />
          <button type="button" tabIndex={-1} className="mh-pw-btn" onClick={() => setShowPin(!showPin)} aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}>
            <EyeIcon open={showPin} />
          </button>
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading} className="mh-lg-submit" style={{ marginBottom: 20 }}>
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, border: '1.5px solid rgba(250,248,245,.3)', borderTopColor: '#FAF8F5', borderRadius: '50%', display: 'inline-block', animation: 'mh-spin .7s linear infinite' }} />
            جاري التحقق…
          </span>
        ) : 'تسجيل الدخول'}
      </button>

      {/* Register link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: C.muted }}>
        ليس لديك حساب؟{' '}
        <button type="button" className="mh-lg-link" onClick={onShowRegister}>إنشاء حساب جديد</button>
      </div>
    </form>
  );
}

/* ════════════════════════════════════════════
   Main Login component
════════════════════════════════════════════ */
export default function Login() {
  const { login }    = useAuth();
  const [, setLocation] = useLocation();

  const isRegisterFromUrl =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('tab') === 'register';
  const [showRegister, setShowRegister] = useState(isRegisterFromUrl);

  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [showPin,  setShowPin]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken,   setTempToken]   = useState('');
  const [totpCode,    setTotpCode]    = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const pinRef      = useRef<HTMLInputElement | null>(null);
  const errorRef    = useRef<HTMLDivElement | null>(null);

  /* CSS injection */
  useEffect(() => {
    let el = document.getElementById(LG_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = LG_CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = LG_CSS;
    return () => { document.getElementById(LG_CSS_ID)?.remove(); };
  }, []);

  useEffect(() => {
    if (!showRegister) setTimeout(() => usernameRef.current?.focus(), 80);
  }, [showRegister]);

  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'mh-shake .32s ease';
  }, [error]);

  const explicitCompanyId: number | null = (() => {
    if (typeof window === 'undefined') return null;
    const v = Number(new URLSearchParams(window.location.search).get('company_id'));
    return Number.isFinite(v) && v > 0 ? v : null;
  })();

  const handleRegisterSuccess = useCallback(
    (
      user: { id: number; name: string; username: string; role: string; active?: boolean; warehouse_id?: number | null; safe_id?: number | null; permissions?: Record<string, boolean>; company_id?: number | null },
      companyId: number
    ) => {
      const u = { ...user, company_id: companyId || user.company_id || null };
      if (u.company_id) localStorage.setItem('erp_company_id', String(u.company_id));
      login(u);
      setLocation('/');
    },
    [login, setLocation]
  );

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = username.trim();
    if (!trimmed) { setError('أدخل رقم الهاتف أو اسم المستخدم'); usernameRef.current?.focus(); return; }
    if (!pin)      { setError('أدخل الرقم السري'); pinRef.current?.focus(); return; }
    setLoading(true);
    try {
      const body = { username: trimmed.toLowerCase(), pin, ...(explicitCompanyId ? { company_id: explicitCompanyId } : {}) };
      const res = await fetch(api('/api/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'الرقم السري غير صحيح');
        setPin(''); pinRef.current?.focus(); return;
      }
      const responseData = await res.json() as { requires_2fa?: boolean; temp_token?: string; user?: { id: number; name: string; username: string; role: string; active?: boolean; warehouse_id?: number | null; safe_id?: number | null; permissions?: Record<string, boolean>; company_id?: number | null } };
      if (responseData.requires_2fa && responseData.temp_token) {
        setTempToken(responseData.temp_token); setRequires2FA(true); setLoading(false); return;
      }
      const u = responseData.user!;
      if ((u.role === 'cashier' || u.role === 'salesperson') && !u.warehouse_id) { setError('هذا المستخدم غير مرتبط بمخزن — راجع المدير'); setLoading(false); return; }
      if ((u.role === 'cashier' || u.role === 'salesperson') && !u.safe_id)      { setError('هذا المستخدم غير مرتبط بخزنة — راجع المدير'); setLoading(false); return; }
      if (u.company_id) localStorage.setItem('erp_company_id', String(u.company_id));
      login(u); setLocation('/');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally  { setLoading(false); }
  }, [username, pin, explicitCompanyId, login, setLocation]);

  const handleTotpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) { setError('أدخل 6 أرقام'); return; }
    setTotpLoading(true); setError('');
    try {
      const res = await fetch(api('/api/auth/2fa/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temp_token: tempToken, totp_code: totpCode }), credentials: 'include' });
      const data = await res.json() as { user?: { id: number; name: string; username: string; role: string; company_id?: number | null }; error?: string };
      if (!res.ok || !data.user) { setError(data.error ?? 'رمز التحقق غير صحيح'); setTotpCode(''); return; }
      login(data.user as Parameters<typeof login>[0]); setLocation('/');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally  { setTotpLoading(false); }
  }, [totpCode, tempToken, login, setLocation]);

  /* ─── RENDER ─── */
  return (
    <div
      className="mh-lg-wrap"
      dir="rtl"
      style={{ minHeight: '100vh', display: 'flex', background: C.bg, color: C.text }}
    >
      {/* ═══════════ FORM PANEL — first DOM child = RIGHT in RTL ═══════════ */}
      <div
        className="mh-lg-form-panel"
        style={{
          flex: '0 0 44%',
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 52px',
          borderLeft: `1px solid ${C.border}`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ width: '100%', maxWidth: 340 }}>
          {/* Mobile-only brand */}
          <div className="mh-lg-mobile-brand" style={{ display: 'none', alignItems: 'baseline', gap: 6, marginBottom: 48, justifyContent: 'center' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>مُحكم</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: '0.17em' }}>ERP</span>
          </div>

          {/* ── 2FA ── */}
          {requires2FA ? (
            <form onSubmit={handleTotpSubmit} noValidate aria-label="التحقق الثنائي" style={{ animation: 'mh-lg-up .45s ease both' }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 10 }}>التحقق الثنائي</h2>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.75, marginBottom: 40 }}>
                افتح <strong style={{ color: C.text, fontWeight: 600 }}>Google Authenticator</strong> وأدخل الرمز المكوّن من ٦ أرقام.
              </p>
              {error && <div role="alert" ref={errorRef} style={{ marginBottom: 28, padding: '10px 14px', background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.18)', borderRadius: 6, fontSize: 13, color: '#B91C1C' }}>{error}</div>}
              <input
                value={totpCode}
                onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="000 000"
                inputMode="numeric" autoFocus maxLength={6}
                aria-label="رمز التحقق"
                className="mh-input"
                style={{ fontSize: 28, fontFamily: "'Inter', monospace", letterSpacing: '0.5em', textAlign: 'center', marginBottom: 40, paddingLeft: 0, paddingRight: 0 }}
              />
              <button type="submit" disabled={totpLoading || totpCode.length !== 6} className="mh-lg-submit" style={{ marginBottom: 16 }}>
                {totpLoading ? 'جاري التحقق…' : 'تحقق'}
              </button>
              <button type="button" onClick={() => { setRequires2FA(false); setTempToken(''); setTotpCode(''); setError(''); setPin(''); }} style={{ width: '100%', height: 44, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: C.muted }}>
                رجوع
              </button>
            </form>

          ) : showRegister ? (
            <div style={{ animation: 'mh-lg-up .45s ease both' }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>إنشاء حساب جديد</h1>
              <p style={{ fontSize: 14, color: C.muted, marginBottom: 36 }}>تجربة مجانية لمدة ٧ أيام — بدون بطاقة ائتمان</p>
              <RegisterForm onSuccess={handleRegisterSuccess} onSwitch={() => { setShowRegister(false); setError(''); }} />
            </div>

          ) : (
            <LoginFields
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

          {/* Security note */}
          <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: C.faint }}>
            <LockIcon />
            <span>بحماية TLS · بيانات كل شركة معزولة تماماً</span>
          </div>
        </div>
      </div>

      {/* ═══════════ PRODUCT PANEL — second DOM child = LEFT in RTL ═══════════ */}
      <div
        className="mh-lg-product-panel"
        style={{
          flex: 1,
          minHeight: '100vh',
          background: C.bgAlt,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Brand area */}
        <div style={{ padding: '52px 52px 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 16 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: C.text, letterSpacing: '-0.04em', lineHeight: 1 }}>مُحكم</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.17em', marginBottom: 4 }}>ERP</span>
          </div>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.75, maxWidth: 340 }}>
            النظام الأول في إدارة الموارد المؤسسية للمنشآت العربية — من المبيعات إلى المحاسبة.
          </p>
          <div style={{ width: 40, height: 1, background: C.border, marginTop: 28 }} />
        </div>

        {/* Screenshot */}
        <div
          style={{
            flex: 1,
            margin: '0 52px 52px',
            overflow: 'hidden',
            borderRadius: '10px 10px 0 0',
            border: `1px solid rgba(0,0,0,.08)`,
            borderBottom: 'none',
            minHeight: 0,
          }}
        >
          <DashboardShot />
        </div>
      </div>
    </div>
  );
}

export { RegisterForm } from './login/RegisterForm';
