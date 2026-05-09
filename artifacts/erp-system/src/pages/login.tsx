import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';

/* ══════════════════════════════════════════════
   Enterprise Login — Dark navy palette
   Inspired by Linear / Salesforce / Oracle
══════════════════════════════════════════════ */
const LOGIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

.lp-login *, .lp-login *::before, .lp-login *::after { box-sizing: border-box; }

.lp-login {
  font-family: 'Tajawal', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@keyframes ent-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ent-spin {
  to { transform: rotate(360deg); }
}
@keyframes ent-shake {
  0%,100% { transform: translateX(0); }
  25%     { transform: translateX(-4px); }
  75%     { transform: translateX(4px); }
}

.ent-input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 8px;
  background: #0B1220;
  border: 1px solid #1E293B;
  color: #F8FAFC;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
  direction: ltr;
  text-align: left;
}
.ent-input::placeholder { color: #475569; }
.ent-input:hover:not(:disabled):not(:focus) { border-color: #334155; }
.ent-input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background: #0B1220;
}
.ent-input:disabled { opacity: .55; cursor: not-allowed; }
.ent-input.ent-input-error {
  border-color: #EF4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.ent-input-pw { padding-right: 44px; font-family: 'Inter', monospace; letter-spacing: .04em; }

.ent-btn-primary {
  width: 100%;
  height: 46px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: #2563EB;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  transition: background .15s ease, transform .05s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.ent-btn-primary:hover:not(:disabled) { background: #1D4ED8; }
.ent-btn-primary:active:not(:disabled) { transform: scale(0.995); }
.ent-btn-primary:disabled { opacity: .55; cursor: not-allowed; }

.ent-btn-secondary {
  width: 100%;
  height: 42px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  color: #94A3B8;
  border: 1px solid #1E293B;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.ent-btn-secondary:hover { color: #F8FAFC; border-color: #334155; background: #0B1220; }

.ent-tab {
  flex: 1;
  height: 36px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: background .15s ease, color .15s ease;
}
.ent-tab-active   { background: #1E293B; color: #F8FAFC; }
.ent-tab-inactive { background: transparent; color: #64748B; }
.ent-tab-inactive:hover { color: #94A3B8; }

.ent-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: inherit;
  color: #60A5FA; font-size: 13px; font-weight: 600;
  transition: color .15s ease;
}
.ent-link:hover { color: #93C5FD; text-decoration: underline; }

.ent-pw-toggle {
  position: absolute; top: 50%; left: 10px; transform: translateY(-50%);
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: #64748B; border-radius: 6px;
  transition: color .15s ease, background .15s ease;
}
.ent-pw-toggle:hover { color: #CBD5E1; background: #1E293B; }

@media (max-width: 900px) {
  .ent-brand-panel { display: none !important; }
  .ent-form-panel  { width: 100% !important; }
}
`;

/* SVG icons — inline, no emoji */
const EyeIcon = ({ open }: { open: boolean }) => (
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const FEATURES = [
  { title: 'محاسبة كاملة',     desc: 'قيد مزدوج تلقائي وتقارير مالية شاملة' },
  { title: 'مبيعات ونقطة بيع',  desc: 'فواتير لحظية مع دعم QR وباركود' },
  { title: 'إدارة مخزون',      desc: 'تتبع متعدد المخازن بالتكلفة المتوسطة' },
  { title: 'موارد بشرية',      desc: 'رواتب وحضور وإجازات بإجراءات احترافية' },
];

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const defaultTab = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(defaultTab);

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [showPin, setShowPin]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  /* 2FA state */
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken]     = useState('');
  const [totpCode, setTotpCode]       = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRef      = useRef<HTMLInputElement>(null);
  const errorRef    = useRef<HTMLDivElement>(null);

  /* Inject CSS once */
  useEffect(() => {
    if (document.getElementById('muhkam-login-css')) return;
    const s = document.createElement('style');
    s.id = 'muhkam-login-css';
    s.textContent = LOGIN_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  useEffect(() => {
    if (mode === 'login') setTimeout(() => usernameRef.current?.focus(), 100);
  }, [mode]);

  /* Subtle shake on error */
  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'ent-shake .35s ease';
  }, [error]);

  const storedCompanyId: number | null = (() => {
    if (typeof window === 'undefined') return null;
    const fromUrl = Number(new URLSearchParams(window.location.search).get('company_id'));
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;
    const fromStorage = Number(localStorage.getItem('erp_company_id'));
    if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
    return null;
  })();

  const handleRegisterSuccess = useCallback((
    user: { id:number; name:string; username:string; role:string; active?:boolean; warehouse_id?:number|null; safe_id?:number|null; permissions?:Record<string,boolean>; },
    companyId: number
  ) => {
    if (companyId) localStorage.setItem('erp_company_id', String(companyId));
    login(user);
    setLocation('/');
  }, [login, setLocation]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = username.trim();
    if (!trimmed) { setError('أدخل اسم المستخدم'); usernameRef.current?.focus(); return; }
    if (!pin)     { setError('أدخل الرقم السري');  pinRef.current?.focus(); return; }

    setLoading(true);
    try {
      const body = { username: trimmed.toLowerCase(), pin, ...(storedCompanyId ? { company_id: storedCompanyId } : {}) };
      const res = await fetch(api('/api/auth/login'), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body), credentials:'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'الرقم السري غير صحيح');
        setPin(''); pinRef.current?.focus();
        return;
      }
      const responseData = await res.json() as {
        requires_2fa?:boolean; temp_token?:string; message?:string;
        user?:{ id:number; name:string; username:string; role:string; active?:boolean; warehouse_id?:number|null; safe_id?:number|null; permissions?:Record<string,boolean>; company_id?:number|null; };
      };
      if (responseData.requires_2fa && responseData.temp_token) {
        setTempToken(responseData.temp_token);
        setRequires2FA(true);
        setLoading(false);
        return;
      }
      const authedUser = responseData.user!;
      if (authedUser.role === 'cashier' || authedUser.role === 'salesperson') {
        if (!authedUser.warehouse_id) { setError('هذا المستخدم غير مرتبط بمخزن — راجع المدير'); setLoading(false); return; }
        if (!authedUser.safe_id)      { setError('هذا المستخدم غير مرتبط بخزنة — راجع المدير'); setLoading(false); return; }
      }
      if (authedUser.company_id) localStorage.setItem('erp_company_id', String(authedUser.company_id));
      login(authedUser);
      setLocation('/');
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [username, pin, storedCompanyId, login, setLocation]);

  const handleTotpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) { setError('أدخل 6 أرقام'); return; }
    setTotpLoading(true); setError('');
    try {
      const res = await fetch(api('/api/auth/2fa/login'), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ temp_token:tempToken, totp_code:totpCode }), credentials:'include',
      });
      const data = await res.json() as { user?:{ id:number; name:string; username:string; role:string; company_id?:number|null; }; error?:string; };
      if (!res.ok || !data.user) { setError(data.error ?? 'رمز التحقق غير صحيح'); setTotpCode(''); return; }
      login(data.user as Parameters<typeof login>[0]);
      setLocation('/');
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setTotpLoading(false);
    }
  }, [totpCode, tempToken, login, setLocation]);

  /* ══ Brand panel — text-only logo, clean enterprise look ══ */
  const BrandPanel = () => (
    <div className="ent-brand-panel" style={{
      width: '46%', minHeight: '100vh',
      background: 'linear-gradient(180deg, #0F172A 0%, #0B1220 100%)',
      borderLeft: '1px solid #1E293B',
      position: 'relative',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '48px 56px',
      overflow: 'hidden',
    }}>
      {/* Subtle radial accent */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%', width: '70%', height: '70%',
        background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Top — text logo */}
      <div style={{ position: 'relative', zIndex: 1, animation: 'ent-fade-up .5s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{
            fontSize: 32, fontWeight: 800, color: '#F8FAFC',
            letterSpacing: '-0.02em', lineHeight: 1,
          }}>مُحكم</div>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#3B82F6',
            letterSpacing: '0.08em',
          }}>ERP</div>
        </div>
        <div style={{
          marginTop: 8, fontSize: 13, color: '#64748B', fontWeight: 500,
        }}>نظام إدارة موارد المؤسسات</div>
      </div>

      {/* Middle — value proposition + features */}
      <div style={{ position: 'relative', zIndex: 1, animation: 'ent-fade-up .55s .05s ease both' }} dir="rtl">
        <h2 style={{
          fontSize: 28, fontWeight: 700, color: '#F8FAFC',
          lineHeight: 1.4, letterSpacing: '-0.01em', marginBottom: 18,
        }}>
          منصة موحدة لإدارة<br/>
          <span style={{ color: '#60A5FA' }}>أعمالك بثقة وكفاءة</span>
        </h2>
        <p style={{
          fontSize: 15, color: '#94A3B8', lineHeight: 1.75, marginBottom: 36, maxWidth: 420,
        }}>
          محاسبة، مبيعات، مخزون، موارد بشرية، وصيانة — في نظام واحد متكامل
          مصمم خصيصاً للسوق العربي.
        </p>

        {/* Feature list */}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <li key={f.title} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              animation: `ent-fade-up .6s ${0.1 + i * 0.05}s ease both`,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
              }}>
                <CheckIcon />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom — version */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12, color: '#475569', fontWeight: 500,
        }}
        className="text-center">
        <span className="text-center">مٌحـكم جميع الحقوق محفوظة MUHKAM © 2026</span>
        <span>© 2026 جميع الحقوق محفوظة</span>
      </div>
    </div>
  );

  /* ══ RENDER ══ */
  return (
    <div className="lp-login" dir="rtl" style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'row',
      background: '#0F172A', color: '#F8FAFC',
    }}>
      {/* Form panel */}
      <div className="ent-form-panel" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', minHeight: '100vh',
      }}>
        <div style={{
          width: '100%', maxWidth: 420,
          animation: 'ent-fade-up .4s ease both',
        }}>
          {/* Mobile-only logo (hidden on desktop where brand panel shows) */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8,
            marginBottom: 32,
          }} className="ent-mobile-logo">
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>مُحكم</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', letterSpacing: '0.08em' }}>ERP</div>
          </div>

          {/* Card */}
          <div style={{
            background: '#0B1220',
            border: '1px solid #1E293B',
            borderRadius: 12,
            padding: '36px 32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2)',
          }}>

            {/* ─── 2FA STEP ─── */}
            {requires2FA ? (
              <form onSubmit={handleTotpSubmit} noValidate aria-label="نموذج التحقق الثنائي">
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 8, letterSpacing: '-0.01em' }}>
                    التحقق الثنائي
                  </h2>
                  <p style={{ fontSize: 13.5, color: '#94A3B8', lineHeight: 1.65 }}>
                    افتح <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Google Authenticator</span> أو <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Authy</span> وأدخل الرمز المكوّن من 6 أرقام.
                  </p>
                </div>

                {error && (
                  <div ref={errorRef} role="alert" aria-live="polite" style={{
                    padding: '10px 12px', borderRadius: 8, marginBottom: 16,
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#FCA5A5', fontSize: 13, fontWeight: 500,
                  }}>{error}</div>
                )}

                <input
                  value={totpCode}
                  onChange={e => { setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6)); setError(''); }}
                  onKeyDown={e => { if (e.key==='Enter' && totpCode.length===6) void handleTotpSubmit(e as unknown as React.FormEvent); }}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                  aria-label="رمز التحقق الثنائي"
                  className="ent-input"
                  style={{
                    height: 56, fontSize: 24, fontFamily: 'Inter, monospace',
                    letterSpacing: '0.5em', textAlign: 'center', marginBottom: 16,
                    paddingRight: 0,
                  }}
                  maxLength={6}
                />
                <button type="submit" disabled={totpLoading || totpCode.length!==6} className="ent-btn-primary" style={{ marginBottom: 12 }}>
                  {totpLoading ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'ent-spin .7s linear infinite' }} />
                      <span>جاري التحقق…</span>
                    </>
                  ) : <span>تحقق</span>}
                </button>
                <button type="button" className="ent-btn-secondary" onClick={() => {
                  setRequires2FA(false); setTempToken(''); setTotpCode(''); setError(''); setPin('');
                }}>رجوع</button>
              </form>
            ) : (
              <>
                {/* Heading */}
                <div style={{ marginBottom: 28 }}>
                  <h1 style={{
                    fontSize: 22, fontWeight: 700, color: '#F8FAFC',
                    marginBottom: 6, letterSpacing: '-0.01em',
                  }}>
                    {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                  </h1>
                  <p style={{ fontSize: 13.5, color: '#94A3B8' }}>
                    {mode === 'login'
                      ? 'أدخل بياناتك للوصول إلى لوحة التحكم'
                      : 'تجربة مجانية لمدة 7 أيام — بدون بطاقة ائتمان'}
                  </p>
                </div>

                {/* Tab toggle */}
                <div style={{
                  display: 'flex', gap: 4, padding: 4,
                  background: '#0F172A', border: '1px solid #1E293B',
                  borderRadius: 8, marginBottom: 24,
                }}>
                  {(['login','register'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMode(m); setError(''); }}
                      className={`ent-tab ${mode === m ? 'ent-tab-active' : 'ent-tab-inactive'}`}
                    >
                      {m === 'login' ? 'تسجيل الدخول' : 'مستخدم جديد'}
                    </button>
                  ))}
                </div>

                {/* Register form */}
                {mode === 'register' ? (
                  <RegisterForm
                    onSuccess={handleRegisterSuccess}
                    onSwitch={() => { setMode('login'); setError(''); }}
                  />
                ) : (
                  <LoginFormFields
                    username={username} setUsername={setUsername}
                    pin={pin} setPin={setPin}
                    showPin={showPin} setShowPin={setShowPin}
                    error={error} setError={setError}
                    loading={loading}
                    usernameRef={usernameRef} pinRef={pinRef} errorRef={errorRef}
                    handleSubmit={handleSubmit}
                  />
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 24, textAlign: 'center',
            fontSize: 12, color: '#475569', letterSpacing: '0.04em',
          }}>
            بحماية مشفّرة عبر TLS · جميع البيانات معزولة لكل شركة
          </div>
        </div>
      </div>
      {/* Brand panel */}
      <BrandPanel />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Login form sub-component
═══════════════════════════════════════════════ */
function LoginFormFields({
  username, setUsername, pin, setPin,
  showPin, setShowPin,
  error, setError, loading,
  usernameRef, pinRef, errorRef,
  handleSubmit,
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
}) {
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#CBD5E1', marginBottom: 8,
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="نموذج تسجيل الدخول">
      {/* Error banner */}
      {error && (
        <div
          id="login-error"
          role="alert"
          aria-live="polite"
          ref={errorRef}
          style={{
            marginBottom: 18,
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 8,
            fontSize: 13, color: '#FCA5A5', fontWeight: 500,
          }}
        >{error}</div>
      )}

      {/* Username */}
      <div style={{ marginBottom: 18 }}>
        <label htmlFor="username" style={labelStyle}>
          اسم المستخدم أو البريد الإلكتروني
        </label>
        <input
          ref={usernameRef}
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          placeholder="admin"
          disabled={loading}
          className={`ent-input${error && !username.trim() ? ' ent-input-error' : ''}`}
          onChange={e => { setUsername(e.target.value); setError(''); }}
          aria-label="اسم المستخدم أو البريد الإلكتروني"
          aria-describedby="login-error"
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <label htmlFor="pin" style={{ ...labelStyle, marginBottom: 0 }}>الرقم السري</label>
          <button
            type="button"
            className="ent-link"
            style={{ fontSize: 12 }}
            onClick={() => {
              window.alert('للحصول على كلمة سر جديدة، يرجى التواصل مع مدير النظام في شركتك.');
            }}
          >هل نسيت كلمة السر؟</button>
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
            className={`ent-input ent-input-pw${error && !pin && username.trim() ? ' ent-input-error' : ''}`}
            onChange={e => { setPin(e.target.value); setError(''); }}
            aria-label="الرقم السري"
            aria-describedby="login-error"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPin(!showPin)}
            className="ent-pw-toggle"
            aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
            title={showPin ? 'إخفاء' : 'إظهار'}
          >
            <EyeIcon open={showPin} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }} />

      {/* Submit */}
      <button type="submit" disabled={loading} className="ent-btn-primary" style={{ marginBottom: 16 }}>
        {loading ? (
          <>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'ent-spin .7s linear infinite' }} />
            <span>جاري التحقق…</span>
          </>
        ) : <span>تسجيل الدخول</span>}
      </button>

      {/* Register link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: '#64748B' }}>
        ليس لديك حساب؟{' '}
        <button
          type="button"
          className="ent-link"
          onClick={() => {
            window.history.pushState({}, '', '/login?tab=register');
            window.dispatchEvent(new Event('popstate'));
            location.href = '/login?tab=register';
          }}
        >إنشاء حساب جديد</button>
      </div>
    </form>
  );
}

export { RegisterForm } from './login/RegisterForm';
