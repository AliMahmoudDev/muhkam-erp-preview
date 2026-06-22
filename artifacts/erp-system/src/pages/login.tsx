/* eslint-disable erp/no-hardcoded-colors -- Login v6: clean white RTL form + dark product panel */
/**
 * MUHKAM Login — v6
 * RTL: Form panel on RIGHT (first DOM child), Product panel on LEFT (second DOM child, dark).
 * Standard rounded inputs, blue primary button.
 * All auth logic preserved 1:1.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';

/* ── CSS ── */
const LG_CSS_ID = 'muhkam-lg-css';
const LG_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;}

.lp-login-wrap{font-family:'Tajawal',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}

@keyframes lg-up   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
@keyframes lg-spin { to{transform:rotate(360deg)} }
@keyframes lg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}

.lg-input{
  width:100%;height:48px;padding:0 14px;
  border:1.5px solid #E2E8F0;border-radius:9px;
  background:#fff;color:#0F172A;
  font-family:'Tajawal',sans-serif;font-size:15px;
  outline:none;direction:rtl;text-align:right;
  transition:border-color .15s,box-shadow .15s;
  -webkit-appearance:none;
}
.lg-input::placeholder{color:#94A3B8;}
.lg-input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.lg-input:hover:not(:focus):not(:disabled){border-color:#CBD5E1;}
.lg-input:disabled{opacity:.4;cursor:not-allowed;}
.lg-input-error{border-color:#EF4444!important;box-shadow:0 0 0 3px rgba(239,68,68,.08)!important;}
.lg-input-pw{padding-left:44px;}

.lg-input:-webkit-autofill,
.lg-input:-webkit-autofill:hover,
.lg-input:-webkit-autofill:focus{
  -webkit-box-shadow:0 0 0 1000px #fff inset;
  -webkit-text-fill-color:#0F172A;
}

.lg-pw-btn{
  position:absolute;top:50%;left:10px;transform:translateY(-50%);
  width:32px;height:32px;background:none;border:none;cursor:pointer;padding:0;
  display:flex;align-items:center;justify-content:center;
  color:#94A3B8;transition:color .15s;
}
.lg-pw-btn:hover{color:#475569;}

.lg-submit{
  width:100%;height:50px;
  background:#2563EB;color:#fff;
  border:none;border-radius:9px;cursor:pointer;
  font-family:'Tajawal',sans-serif;font-size:16px;font-weight:600;
  transition:background .15s;
}
.lg-submit:hover:not(:disabled){background:#1D4ED8;}
.lg-submit:disabled{opacity:.4;cursor:not-allowed;}

.lg-link{
  background:none;border:none;padding:0;cursor:pointer;
  font-family:'Tajawal',sans-serif;color:#2563EB;font-size:13px;font-weight:600;
  transition:opacity .15s;
}
.lg-link:hover{opacity:.7;}

.lg-label{
  display:block;font-size:13px;font-weight:600;color:#374151;
  margin-bottom:6px;
}

@media(max-width:860px){
  .lg-product-panel{display:none!important;}
  .lg-form-panel{flex:1!important;}
}
`;

/* ── Palette ── */
const C = {
  bg:      '#FFFFFF',
  dark:    '#0F172A',
  border:  '#E2E8F0',
  primary: '#2563EB',
  text:    '#0F172A',
  sub:     '#475569',
  muted:   '#94A3B8',
} as const;

/* ── Icons ── */
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

const LockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

/* ── Product panel (dark) ── */
function ProductPanel() {
  const features = [
    { icon: '🏪', label: 'نقطة البيع والفواتير' },
    { icon: '💰', label: 'محاسبة تلقائية' },
    { icon: '📦', label: 'إدارة المخزون' },
    { icon: '🔧', label: 'تتبع الصيانة' },
  ];

  /* Mini KPIs */
  const kpis = [
    { l: 'الإيرادات', v: '١٢٤٫٨ ألف', d: '+١٢٪', up: true },
    { l: 'الطلبات',   v: '٢٤١',        d: '+٧٪',  up: true },
    { l: 'الأرباح',   v: '٧٦٫٦ ألف',  d: '+١٨٪', up: true },
  ];

  return (
    <div
      className="lg-product-panel"
      style={{
        flex: 1,
        minHeight: '100vh',
        background: C.dark,
        display: 'flex',
        flexDirection: 'column',
        padding: '52px 44px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Subtle grid bg */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 0)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

      {/* Brand */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.03em' }}>مُحكم</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#60A5FA', letterSpacing: '.15em' }}>ERP</span>
        </div>
        <p style={{ fontSize: 15, color: '#94A3B8', lineHeight: 1.75, marginBottom: 40, maxWidth: 320 }}>
          منصة ERP عربية متكاملة لإدارة مبيعاتك ومحاسبتك ومخزونك — من مكان واحد.
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 44 }}>
          {features.map((f) => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}>{f.label}</span>
              <span style={{ marginRight: 'auto', fontSize: 10, color: '#22C55E', fontWeight: 600 }}>✓</span>
            </div>
          ))}
        </div>

        {/* Mini KPI card (product preview) */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>لوحة التحكم — اليوم</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            {kpis.map((k) => (
              <div key={k.l} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: '#52525B', marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>{k.v}</div>
                <div style={{ fontSize: 9, color: k.up ? '#22C55E' : '#EF4444', fontWeight: 600, marginTop: 2 }}>{k.d}</div>
              </div>
            ))}
          </div>
          {/* Mini chart bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
            {[40, 65, 50, 80, 60, 90, 72].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 5 ? '#2563EB' : 'rgba(99,102,241,.3)', transition: 'height .3s' }} />
            ))}
          </div>
        </div>

        {/* Trust */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
          <LockIcon />
          <span>بيانات مشفرة · كل شركة معزولة تماماً</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Login form
════════════════════════════════════════════ */
function LoginForm({
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
  return (
    <form onSubmit={handleSubmit} noValidate aria-label="نموذج تسجيل الدخول" style={{ animation: 'lg-up .4s .05s ease both' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.025em', marginBottom: 8, lineHeight: 1.1 }}>
        أهلاً بعودتك
      </h1>
      <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginBottom: 32 }}>
        سجّل دخولك للوصول إلى لوحة التحكم
      </p>

      {/* Error */}
      {error && (
        <div
          ref={errorRef} role="alert" aria-live="polite"
          id="lg-error"
          style={{ marginBottom: 20, padding: '11px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#B91C1C', fontWeight: 500 }}
        >
          {error}
        </div>
      )}

      {/* Username */}
      <div style={{ marginBottom: 18 }}>
        <label htmlFor="lg-username" className="lg-label">رقم الهاتف أو اسم المستخدم</label>
        <input
          ref={usernameRef} id="lg-username" type="text" autoComplete="username"
          value={username} placeholder="admin" disabled={loading}
          className={`lg-input${error && !username.trim() ? ' lg-input-error' : ''}`}
          onChange={(e) => { setUsername(e.target.value); setError(''); }}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label htmlFor="lg-pin" className="lg-label" style={{ margin: 0 }}>الرقم السري</label>
          <button type="button" className="lg-link" style={{ fontSize: 12 }}
            onClick={() => window.alert('للحصول على كلمة سر جديدة، يرجى التواصل مع مدير النظام في شركتك.')}>
            نسيت الرقم السري؟
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={pinRef} id="lg-pin"
            type={showPin ? 'text' : 'password'} autoComplete="current-password"
            value={pin} placeholder="••••••" disabled={loading}
            className={`lg-input lg-input-pw${error && !pin && username.trim() ? ' lg-input-error' : ''}`}
            onChange={(e) => { setPin(e.target.value); setError(''); }}
          />
          <button type="button" tabIndex={-1} className="lg-pw-btn" onClick={() => setShowPin(!showPin)}
            aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}>
            <EyeIcon open={showPin} />
          </button>
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading} className="lg-submit" style={{ marginBottom: 16 }}>
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'lg-spin .7s linear infinite' }} />
            جاري التحقق…
          </span>
        ) : 'تسجيل الدخول'}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 12, color: C.muted }}>أو</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>

      {/* Register */}
      <button type="button" onClick={onShowRegister} style={{ width: '100%', height: 46, background: 'transparent', border: `1.5px solid ${C.border}`, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: C.text, transition: 'border-color .15s, background .15s' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
        إنشاء حساب جديد
      </button>
    </form>
  );
}

/* ════════════════════════════════════════════
   Main Login component
════════════════════════════════════════════ */
export default function Login() {
  const { login }       = useAuth();
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
    if (!el) { el = document.createElement('style'); el.id = LG_CSS_ID; document.head.appendChild(el); }
    el.textContent = LG_CSS;
    return () => { document.getElementById(LG_CSS_ID)?.remove(); };
  }, []);

  useEffect(() => {
    if (!showRegister && !requires2FA) setTimeout(() => usernameRef.current?.focus(), 80);
  }, [showRegister, requires2FA]);

  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'lg-shake .3s ease';
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
      login(u); setLocation('/');
    },
    [login, setLocation]
  );

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const trimmed = username.trim();
    if (!trimmed) { setError('أدخل رقم الهاتف أو اسم المستخدم'); usernameRef.current?.focus(); return; }
    if (!pin)      { setError('أدخل الرقم السري'); pinRef.current?.focus(); return; }
    setLoading(true);
    try {
      const body = { username: trimmed.toLowerCase(), pin, ...(explicitCompanyId ? { company_id: explicitCompanyId } : {}) };
      const res  = await fetch(api('/api/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'الرقم السري غير صحيح');
        setPin(''); pinRef.current?.focus(); return;
      }
      const data = await res.json() as { requires_2fa?: boolean; temp_token?: string; user?: { id: number; name: string; username: string; role: string; active?: boolean; warehouse_id?: number | null; safe_id?: number | null; permissions?: Record<string, boolean>; company_id?: number | null } };
      if (data.requires_2fa && data.temp_token) { setTempToken(data.temp_token); setRequires2FA(true); setLoading(false); return; }
      const u = data.user!;
      if ((u.role === 'cashier' || u.role === 'salesperson') && !u.warehouse_id) { setError('هذا المستخدم غير مرتبط بمخزن — راجع المدير'); setLoading(false); return; }
      if ((u.role === 'cashier' || u.role === 'salesperson') && !u.safe_id)      { setError('هذا المستخدم غير مرتبط بخزنة — راجع المدير'); setLoading(false); return; }
      if (u.company_id) localStorage.setItem('erp_company_id', String(u.company_id));
      login(u); setLocation('/');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally  { setLoading(false); }
  }, [username, pin, explicitCompanyId, login, setLocation]);

  const handleTotpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) { setError('أدخل ٦ أرقام'); return; }
    setTotpLoading(true); setError('');
    try {
      const res  = await fetch(api('/api/auth/2fa/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ temp_token: tempToken, totp_code: totpCode }), credentials: 'include' });
      const data = await res.json() as { user?: { id: number; name: string; username: string; role: string; company_id?: number | null }; error?: string };
      if (!res.ok || !data.user) { setError(data.error ?? 'رمز التحقق غير صحيح'); setTotpCode(''); return; }
      login(data.user as Parameters<typeof login>[0]); setLocation('/');
    } catch { setError('تعذّر الاتصال بالخادم'); }
    finally  { setTotpLoading(false); }
  }, [totpCode, tempToken, login, setLocation]);

  /* ─── RENDER ─── */
  return (
    <div dir="rtl" className="lp-login-wrap" style={{ minHeight: '100vh', display: 'flex', color: C.text, background: C.bg }}>
      {/* ═══ FORM PANEL — first DOM = RIGHT in RTL ═══ */}
      <div
        className="lg-form-panel"
        style={{
          flex: '0 0 44%',
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 48px',
          borderLeft: `1px solid ${C.border}`,
        }}
      >
        <div style={{ width: '100%', maxWidth: 360 }}>
          {/* Brand (mobile-only or small screens) */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 40, justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: C.primary, letterSpacing: '.15em' }}>ERP</span>
          </div>

          {/* 2FA */}
          {requires2FA ? (
            <form onSubmit={handleTotpSubmit} noValidate style={{ animation: 'lg-up .4s ease both' }}>
              <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>التحقق الثنائي</h2>
              <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginBottom: 28 }}>
                افتح <strong style={{ color: C.text }}>Google Authenticator</strong> وأدخل الرمز المكوّن من ٦ أرقام.
              </p>
              {error && <div ref={errorRef} role="alert" style={{ marginBottom: 20, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#B91C1C' }}>{error}</div>}
              <input
                value={totpCode}
                onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="000 000" inputMode="numeric" autoFocus maxLength={6}
                className="lg-input"
                style={{ fontSize: 24, fontFamily: "'Inter', monospace", letterSpacing: '0.5em', textAlign: 'center', marginBottom: 20, paddingLeft: 0, paddingRight: 0, height: 64 }}
              />
              <button type="submit" disabled={totpLoading || totpCode.length !== 6} className="lg-submit" style={{ marginBottom: 12 }}>
                {totpLoading ? 'جاري التحقق…' : 'تحقق'}
              </button>
              <button type="button" onClick={() => { setRequires2FA(false); setTempToken(''); setTotpCode(''); setError(''); setPin(''); }} style={{ width: '100%', height: 44, background: 'transparent', border: `1.5px solid ${C.border}`, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: C.sub }}>
                رجوع
              </button>
            </form>

          ) : showRegister ? (
            <div style={{ animation: 'lg-up .4s ease both' }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>إنشاء حساب جديد</h1>
              <p style={{ fontSize: 14, color: C.sub, marginBottom: 28 }}>تجربة مجانية لمدة ٧ أيام — بدون بطاقة ائتمان</p>
              <RegisterForm onSuccess={handleRegisterSuccess} onSwitch={() => { setShowRegister(false); setError(''); }} />
            </div>

          ) : (
            <LoginForm
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
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: C.muted }}>
            <LockIcon />
            <span>بحماية TLS · بيانات كل شركة معزولة تماماً</span>
          </div>
        </div>
      </div>

      {/* ═══ PRODUCT PANEL — second DOM = LEFT in RTL ═══ */}
      <ProductPanel />
    </div>
  );
}

export { RegisterForm } from './login/RegisterForm';
