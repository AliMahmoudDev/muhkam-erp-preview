import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';

/* ══════════════════════════════════════════════
   Enterprise Login — Split: dark brand left, light form right
   Inspired by Linear / Salesforce / Stripe / Oracle
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

/* ── Light form inputs ── */
.ent-input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 8px;
  background: var(--login-white);
  border: 1px solid #CBD5E1;
  color: var(--login-navy);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
  direction: rtl;
  text-align: right;
}
.ent-input::placeholder { color: var(--login-muted-on-navy); }
.ent-input:hover:not(:disabled):not(:focus) { border-color: var(--login-muted-on-navy); }
.ent-input:focus {
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.ent-input:disabled { opacity: .55; cursor: not-allowed; background: #F1F5F9; }
.ent-input.ent-input-error {
  border-color: #DC2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
}

.ent-input-pw { padding-right: 44px; padding-left: 14px; font-family: 'Inter', monospace; letter-spacing: .04em; }

/* ── Primary button (light surface) ── */
.ent-btn-primary {
  width: 100%;
  height: 48px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: #2563EB;
  color: var(--login-white);
  font-size: 14.5px;
  font-weight: 600;
  font-family: inherit;
  transition: background .15s ease, transform .05s ease, box-shadow .15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.15);
}
.ent-btn-primary:hover:not(:disabled) { background: #1D4ED8; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
.ent-btn-primary:active:not(:disabled) { transform: scale(0.995); }
.ent-btn-primary:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }

.ent-btn-secondary {
  width: 100%;
  height: 42px;
  border-radius: 8px;
  cursor: pointer;
  background: var(--login-white);
  color: #475569;
  border: 1px solid #CBD5E1;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  transition: color .15s ease, border-color .15s ease, background .15s ease;
}
.ent-btn-secondary:hover { color: var(--login-navy); border-color: var(--login-muted-on-navy); background: #F1F5F9; }

.ent-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: inherit;
  color: #2563EB; font-size: 13px; font-weight: 600;
  transition: color .15s ease;
}
.ent-link:hover { color: #1D4ED8; text-decoration: underline; }

.ent-pw-toggle {
  position: absolute; top: 50%; right: 14px; transform: translateY(-50%);
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: var(--login-muted-on-navy); border-radius: 6px;
  transition: color .15s ease, background .15s ease;
}
.ent-pw-toggle:hover { color: #334155; background: #F1F5F9; }

/* Override browser autofill background */
.ent-input:-webkit-autofill,
.ent-input:-webkit-autofill:hover,
.ent-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px var(--login-white) inset;
  -webkit-text-fill-color: var(--login-navy);
  box-shadow: 0 0 0 1000px var(--login-white) inset;
  transition: background-color 99999s ease-in-out 0s;
}

@media (max-width: 900px) {
  .ent-brand-panel { display: none !important; }
  .ent-form-panel  { width: 100% !important; }
}
`;

/* SVG icons — inline, no emoji */
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--status-info)"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* Module icons (stroke=currentColor so they inherit) */
const SalesIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
  </svg>
);
const AccountingIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 8h10M7 12h10M7 16h6" />
  </svg>
);
const HRIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const InventoryIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 8V21H3V8M1 3h22v5H1zM10 12h4" />
  </svg>
);

/* Brand panel data */
const PRODUCT_FACTS = [
  'نظام ERP عربي متكامل',
  'محاسبة + مبيعات + موارد بشرية + صيانة',
  'مصمم للسوق العربي',
];

const MODULES = [
  { label: 'المبيعات', Icon: SalesIcon },
  { label: 'المحاسبة', Icon: AccountingIcon },
  { label: 'الموارد البشرية', Icon: HRIcon },
  { label: 'المخزون', Icon: InventoryIcon },
];

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

  /* 2FA state */
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  /* Inject CSS once */
  useEffect(() => {
    if (document.getElementById('muhkam-login-css')) return;
    const s = document.createElement('style');
    s.id = 'muhkam-login-css';
    s.textContent = LOGIN_CSS;
    document.head.appendChild(s);
    return () => {
      s.remove();
    };
  }, []);

  useEffect(() => {
    if (!showRegister) setTimeout(() => usernameRef.current?.focus(), 100);
  }, [showRegister]);

  /* Subtle shake on error */
  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'ent-shake .35s ease';
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
        id: number;
        name: string;
        username: string;
        role: string;
        active?: boolean;
        warehouse_id?: number | null;
        safe_id?: number | null;
        permissions?: Record<string, boolean>;
        company_id?: number | null;
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
      if (!trimmed) {
        setError('أدخل رقم الهاتف أو اسم المستخدم');
        usernameRef.current?.focus();
        return;
      }
      if (!pin) {
        setError('أدخل الرقم السري');
        pinRef.current?.focus();
        return;
      }

      setLoading(true);
      try {
        const body = {
          username: trimmed.toLowerCase(),
          pin,
          ...(explicitCompanyId ? { company_id: explicitCompanyId } : {}),
        };
        const res = await fetch(api('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'الرقم السري غير صحيح');
          setPin('');
          pinRef.current?.focus();
          return;
        }
        const responseData = (await res.json()) as {
          requires_2fa?: boolean;
          temp_token?: string;
          message?: string;
          user?: {
            id: number;
            name: string;
            username: string;
            role: string;
            active?: boolean;
            warehouse_id?: number | null;
            safe_id?: number | null;
            permissions?: Record<string, boolean>;
            company_id?: number | null;
          };
        };
        if (responseData.requires_2fa && responseData.temp_token) {
          setTempToken(responseData.temp_token);
          setRequires2FA(true);
          setLoading(false);
          return;
        }
        const authedUser = responseData.user!;
        if (authedUser.role === 'cashier' || authedUser.role === 'salesperson') {
          if (!authedUser.warehouse_id) {
            setError('هذا المستخدم غير مرتبط بمخزن — راجع المدير');
            setLoading(false);
            return;
          }
          if (!authedUser.safe_id) {
            setError('هذا المستخدم غير مرتبط بخزنة — راجع المدير');
            setLoading(false);
            return;
          }
        }
        if (authedUser.company_id)
          localStorage.setItem('erp_company_id', String(authedUser.company_id));
        login(authedUser);
        setLocation('/');
      } catch {
        setError('تعذّر الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    },
    [username, pin, explicitCompanyId, login, setLocation]
  );

  const handleTotpSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (totpCode.length !== 6) {
        setError('أدخل 6 أرقام');
        return;
      }
      setTotpLoading(true);
      setError('');
      try {
        const res = await fetch(api('/api/auth/2fa/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ temp_token: tempToken, totp_code: totpCode }),
          credentials: 'include',
        });
        const data = (await res.json()) as {
          user?: {
            id: number;
            name: string;
            username: string;
            role: string;
            company_id?: number | null;
          };
          error?: string;
        };
        if (!res.ok || !data.user) {
          setError(data.error ?? 'رمز التحقق غير صحيح');
          setTotpCode('');
          return;
        }
        login(data.user as Parameters<typeof login>[0]);
        setLocation('/');
      } catch {
        setError('تعذّر الاتصال بالخادم');
      } finally {
        setTotpLoading(false);
      }
    },
    [totpCode, tempToken, login, setLocation]
  );

  /* ══ Brand panel — dark navy with logo, facts, modules ══ */
  const BrandPanel = () => (
    <div
      className="ent-brand-panel"
      style={{
        width: '46%',
        minHeight: '100vh',
        background: 'var(--login-navy)',
        borderLeft: '1px solid #1E293B',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 56px',
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial accent */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '70%',
          height: '70%',
          background:
            'radial-gradient(ellipse at center, rgba(59,130,246,0.10) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top — logo + tagline + 3 product facts */}
      <div
        style={{ position: 'relative', zIndex: 1, animation: 'ent-fade-up .5s ease both' }}
        dir="rtl"
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: 'var(--login-text-on-navy)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            مُحكم
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--status-info)',
              letterSpacing: '0.10em',
            }}
          >
            ERP
          </div>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            color: 'var(--login-muted-on-navy)',
            fontWeight: 500,
          }}
        >
          نظام إدارة موارد المؤسسات
        </div>

        {/* 3 product facts */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '32px 0 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {PRODUCT_FACTS.map((fact, i) => (
            <li
              key={fact}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13.5,
                color: 'var(--login-muted-on-navy)',
                fontWeight: 500,
                animation: `ent-fade-up .5s ${0.05 + i * 0.04}s ease both`,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--status-info)',
                  flexShrink: 0,
                }}
              />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Middle — modules grid (4 with icons) */}
      <div
        style={{ position: 'relative', zIndex: 1, animation: 'ent-fade-up .55s .1s ease both' }}
        dir="rtl"
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--login-muted-on-navy)',
            letterSpacing: '0.14em',
            marginBottom: 18,
            textTransform: 'uppercase' as const,
          }}
        >
          الوحدات الأساسية
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {MODULES.map((m, i) => (
            <div
              key={m.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #1E293B',
                borderRadius: 10,
                animation: `ent-fade-up .55s ${0.15 + i * 0.04}s ease both`,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--status-info)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <m.Icon />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--login-text-on-navy)' }}>
                  {m.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--login-muted-on-navy)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckIcon /> متاح
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom — copyright */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 12,
          color: 'var(--login-muted-on-navy)',
          fontWeight: 500,
        }}
      >
        © 2026 مُحكم ERP · جميع الحقوق محفوظة
      </div>
    </div>
  );

  /* ══ RENDER ══ */
  return (
    <div
      className="lp-login"
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'row',
        background: 'var(--login-white)',
        color: 'var(--login-navy)',
      }}
    >
      {/* Form panel — light */}
      <div
        className="ent-form-panel"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          minHeight: '100vh',
          background: 'var(--login-white)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            animation: 'ent-fade-up .4s ease both',
          }}
        >
          {/* Mobile-only logo (hidden on desktop) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 28,
            }}
            className="ent-mobile-logo"
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--login-navy)',
                letterSpacing: '-0.02em',
              }}
            >
              مُحكم
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--status-info)',
                letterSpacing: '0.10em',
              }}
            >
              ERP
            </div>
          </div>

          {/* Card */}
          <div
            style={{
              background: 'var(--login-white)',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '40px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05), 0 8px 32px rgba(15, 23, 42, 0.08)',
            }}
          >
            {/* ─── 2FA STEP ─── */}
            {requires2FA ? (
              <form onSubmit={handleTotpSubmit} noValidate aria-label="نموذج التحقق الثنائي">
                <div style={{ marginBottom: 28 }}>
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--login-navy)',
                      marginBottom: 8,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    التحقق الثنائي
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--login-muted)', lineHeight: 1.65 }}>
                    افتح{' '}
                    <span style={{ color: 'var(--login-navy)', fontWeight: 600 }}>
                      Google Authenticator
                    </span>{' '}
                    أو <span style={{ color: 'var(--login-navy)', fontWeight: 600 }}>Authy</span>{' '}
                    وأدخل الرمز المكوّن من 6 أرقام.
                  </p>
                </div>

                {error && (
                  <div
                    ref={errorRef}
                    role="alert"
                    aria-live="polite"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      marginBottom: 16,
                      background: 'var(--status-danger-bg)',
                      border: '1px solid var(--status-danger-border)',
                      color: 'var(--status-danger)',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {error}
                  </div>
                )}

                <input
                  value={totpCode}
                  onChange={(e) => {
                    setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && totpCode.length === 6)
                      void handleTotpSubmit(e as unknown as React.FormEvent);
                  }}
                  placeholder="000000"
                  inputMode="numeric"
                  autoFocus
                  aria-label="رمز التحقق الثنائي"
                  className="ent-input"
                  style={{
                    height: 56,
                    fontSize: 24,
                    fontFamily: 'Inter, monospace',
                    letterSpacing: '0.5em',
                    textAlign: 'center',
                    marginBottom: 16,
                    paddingRight: 0,
                  }}
                  maxLength={6}
                />
                <button
                  type="submit"
                  disabled={totpLoading || totpCode.length !== 6}
                  className="ent-btn-primary"
                  style={{ marginBottom: 12 }}
                >
                  {totpLoading ? (
                    <>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: '2px solid rgba(255,255,255,0.25)',
                          borderTopColor: 'var(--login-white)',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'ent-spin .7s linear infinite',
                        }}
                      />
                      <span>جاري التحقق…</span>
                    </>
                  ) : (
                    <span>تحقق</span>
                  )}
                </button>
                <button
                  type="button"
                  className="ent-btn-secondary"
                  onClick={() => {
                    setRequires2FA(false);
                    setTempToken('');
                    setTotpCode('');
                    setError('');
                    setPin('');
                  }}
                >
                  رجوع
                </button>
              </form>
            ) : showRegister ? (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h1
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: 'var(--login-navy)',
                      marginBottom: 6,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    إنشاء حساب جديد
                  </h1>
                  <p style={{ fontSize: 14, color: 'var(--login-muted)' }}>
                    تجربة مجانية لمدة 7 أيام — بدون بطاقة ائتمان
                  </p>
                </div>
                <RegisterForm
                  onSuccess={handleRegisterSuccess}
                  onSwitch={() => {
                    setShowRegister(false);
                    setError('');
                  }}
                />
              </>
            ) : (
              <>
                {/* Heading */}
                <div style={{ marginBottom: 28 }}>
                  <h1
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: 'var(--login-navy)',
                      marginBottom: 6,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    تسجيل الدخول
                  </h1>
                  <p style={{ fontSize: 14, color: 'var(--login-muted)' }}>
                    أدخل بياناتك للوصول إلى لوحة التحكم
                  </p>
                </div>

                <LoginFormFields
                  username={username}
                  setUsername={setUsername}
                  pin={pin}
                  setPin={setPin}
                  showPin={showPin}
                  setShowPin={setShowPin}
                  error={error}
                  setError={setError}
                  loading={loading}
                  usernameRef={usernameRef}
                  pinRef={pinRef}
                  errorRef={errorRef}
                  handleSubmit={handleSubmit}
                  onShowRegister={() => {
                    setShowRegister(true);
                    setError('');
                  }}
                />
              </>
            )}
          </div>

          {/* Footer with TLS lock icon */}
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12.5,
              color: 'var(--login-muted)',
              fontWeight: 500,
            }}
          >
            <LockIcon />
            <span>بحماية تشفير TLS · جميع البيانات معزولة لكل شركة</span>
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
  username,
  setUsername,
  pin,
  setPin,
  showPin,
  setShowPin,
  error,
  setError,
  loading,
  usernameRef,
  pinRef,
  errorRef,
  handleSubmit,
  onShowRegister,
}: {
  username: string;
  setUsername: (v: string) => void;
  pin: string;
  setPin: (v: string) => void;
  showPin: boolean;
  setShowPin: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  loading: boolean;
  usernameRef: React.RefObject<HTMLInputElement | null>;
  pinRef: React.RefObject<HTMLInputElement | null>;
  errorRef: React.RefObject<HTMLDivElement | null>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  onShowRegister: () => void;
}) {
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 8,
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
            background: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--status-danger)',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Username */}
      <div style={{ marginBottom: 18 }}>
        <label htmlFor="username" style={labelStyle}>
          رقم الهاتف أو اسم المستخدم
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
          onChange={(e) => {
            setUsername(e.target.value);
            setError('');
          }}
          aria-label="رقم الهاتف أو اسم المستخدم"
          aria-describedby="login-error"
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <label htmlFor="pin" style={{ ...labelStyle, marginBottom: 0 }}>
            الرقم السري
          </label>
          <button
            type="button"
            className="ent-link"
            style={{ fontSize: 12 }}
            onClick={() => {
              window.alert('للحصول على كلمة سر جديدة، يرجى التواصل مع مدير النظام في شركتك.');
            }}
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
            className={`ent-input ent-input-pw${error && !pin && username.trim() ? ' ent-input-error' : ''}`}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            aria-label="الرقم السري"
            aria-describedby="login-error"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPin(!showPin)}
            className="ent-pw-toggle"
            aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
          >
            <EyeIcon open={showPin} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }} />

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="ent-btn-primary"
        style={{ marginBottom: 16 }}
      >
        {loading ? (
          <>
            <span
              style={{
                width: 14,
                height: 14,
                border: '2px solid var(--edge-md)',
                borderTopColor: 'var(--login-white)',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'ent-spin .7s linear infinite',
              }}
            />
            <span>جاري التحقق…</span>
          </>
        ) : (
          <span>تسجيل الدخول</span>
        )}
      </button>

      {/* Register link */}
      <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--login-muted)' }}>
        ليس لديك حساب؟{' '}
        <button type="button" className="ent-link" onClick={onShowRegister}>
          إنشاء حساب جديد
        </button>
      </div>
    </form>
  );
}

export { RegisterForm } from './login/RegisterForm';
