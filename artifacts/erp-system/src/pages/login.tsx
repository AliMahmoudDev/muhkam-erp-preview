/* eslint-disable erp/no-hardcoded-colors -- login page decorative colors: intentional fixed palette */
/**
 * MUHKAM Login — v8
 * Amber/gold theme with glassmorphism + split-screen layout.
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
@keyframes lg-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes lg-orb-1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.1)} }
@keyframes lg-orb-2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,40px) scale(1.15)} }
@keyframes lg-gradient { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

.lg-input{
  width:100%;height:52px;padding:0 16px;
  border:1.5px solid #E0E0E0;border-radius:12px;
  background:#fff;color:#333333;
  font-family:'Tajawal',sans-serif;font-size:15px;
  outline:none;direction:rtl;text-align:right;
  transition:border-color .15s,box-shadow .15s;
  -webkit-appearance:none;
}
.lg-input::placeholder{color:#999999;}
.lg-input:focus{border-color:#F59E0B;box-shadow:0 0 0 4px rgba(245,158,11,.1);}
.lg-input:hover:not(:focus):not(:disabled){border-color:#BDBDBD;}
.lg-input:disabled{opacity:.4;cursor:not-allowed;}
.lg-input-error{border-color:#EF4444!important;box-shadow:0 0 0 4px rgba(239,68,68,.08)!important;}
.lg-input-pw{padding-left:48px;}

.lg-input:-webkit-autofill,
.lg-input:-webkit-autofill:hover,
.lg-input:-webkit-autofill:focus{
  -webkit-box-shadow:0 0 0 1000px #fff inset;
  -webkit-text-fill-color:#333333;
}

.lg-pw-btn{
  position:absolute;top:50%;left:12px;transform:translateY(-50%);
  width:36px;height:36px;background:none;border:none;cursor:pointer;padding:0;
  display:flex;align-items:center;justify-content:center;
  color:#999999;transition:color .15s;border-radius:8px;
}
.lg-pw-btn:hover{color:#666666;background:#F5F5F5;}

.lg-submit{
  width:100%;height:54px;
  background:linear-gradient(135deg,#F59E0B 0%,#F57F17 100%);
  color:#fff;
  border:none;border-radius:12px;cursor:pointer;
  font-family:'Tajawal',sans-serif;font-size:16px;font-weight:700;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:all .2s;
  box-shadow:0 4px 16px rgba(245,158,11,.3);
}
.lg-submit:hover:not(:disabled){background:linear-gradient(135deg,#F57F17 0%,#E65100 100%);box-shadow:0 6px 24px rgba(245,158,11,.45);transform:translateY(-1px);}
.lg-submit:active:not(:disabled){transform:translateY(0);}
.lg-submit:disabled{opacity:.5;cursor:not-allowed;}

.lg-link{
  background:none;border:none;padding:0;cursor:pointer;
  font-family:'Tajawal',sans-serif;color:#F59E0B;font-size:13px;font-weight:600;
  transition:opacity .15s;
}
.lg-link:hover{opacity:.7;}

.lg-label{
  display:block;font-size:13px;font-weight:600;color:#666666;
  margin-bottom:8px;
}

.lg-outline-btn{
  width:100%;height:50px;
  background:transparent;color:#333333;
  border:1.5px solid #E0E0E0;border-radius:12px;cursor:pointer;
  font-family:'Tajawal',sans-serif;font-size:14px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:all .15s;
}
.lg-outline-btn:hover{border-color:#F59E0B;color:#F59E0B;background:#FFF9E6;}

.lg-gradient-text{background:linear-gradient(135deg,#F59E0B 0%,#FFD700 50%,#FFB300 100%);background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:lg-gradient 6s ease infinite;}
`;

/* ── Icons ── */
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const LockIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* ═══ MuhkamLogo for login ═══ */
function LoginLogo({ size = 48 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: 'linear-gradient(135deg, #F59E0B 0%, #FFB300 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: "'Tajawal','SF Pro Display',sans-serif",
          fontSize: size * 0.55,
          fontWeight: 800,
          boxShadow: '0 8px 24px rgba(245,158,11,.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,.3) 0%, transparent 50%)',
          }}
        />
        <span style={{ position: 'relative', zIndex: 1, lineHeight: 1 }}>م</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span
          style={{
            fontFamily: "'Tajawal','SF Pro Display',sans-serif",
            fontSize: 24,
            fontWeight: 800,
            color: '#333333',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          مُحكم
        </span>
        <span
          style={{
            fontFamily: "'Inter','Tajawal',sans-serif",
            fontSize: 9,
            fontWeight: 600,
            color: '#999999',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          MUHKAM ERP
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Login form
════════════════════════════════════════════ */
function LoginForm({
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
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="نموذج تسجيل الدخول"
      style={{ animation: 'lg-up .4s .05s ease both' }}
    >
      <h1
        style={{
          fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
          fontSize: 32,
          fontWeight: 800,
          color: '#333333',
          letterSpacing: '-0.03em',
          marginBottom: 8,
          lineHeight: 1.1,
        }}
      >
        أهلاً بعودتك
      </h1>
      <p style={{ fontSize: 15, color: '#666666', lineHeight: 1.6, marginBottom: 32 }}>
        سجّل دخولك للوصول إلى لوحة التحكم
      </p>

      {/* Error */}
      {error && (
        <div
          ref={errorRef}
          role="alert"
          aria-live="polite"
          id="lg-error"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.2)',
            borderRadius: 12,
            fontSize: 13,
            color: '#EF4444',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Username */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="lg-username" className="lg-label">
          رقم الهاتف أو اسم المستخدم
        </label>
        <input
          ref={usernameRef}
          id="lg-username"
          type="text"
          autoComplete="username"
          aria-label="رقم الهاتف أو اسم المستخدم"
          value={username}
          placeholder="admin"
          disabled={loading}
          className={`lg-input${error && !username.trim() ? ' lg-input-error' : ''}`}
          onChange={(e) => {
            setUsername(e.target.value);
            setError('');
          }}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <label htmlFor="lg-pin" className="lg-label" style={{ margin: 0 }}>
            الرقم السري
          </label>
          <button
            type="button"
            className="lg-link"
            style={{ fontSize: 12 }}
            onClick={() =>
              window.alert('للحصول على كلمة سر جديدة، يرجى التواصل مع مدير النظام في شركتك.')
            }
          >
            نسيت الرقم السري؟
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={pinRef}
            id="lg-pin"
            type={showPin ? 'text' : 'password'}
            autoComplete="current-password"
            aria-label="الرقم السري"
            value={pin}
            placeholder="••••••"
            disabled={loading}
            className={`lg-input lg-input-pw${error && !pin && username.trim() ? ' lg-input-error' : ''}`}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            className="lg-pw-btn"
            onClick={() => setShowPin(!showPin)}
            aria-label={showPin ? 'إخفاء الرقم السري' : 'إظهار الرقم السري'}
          >
            <EyeIcon open={showPin} />
          </button>
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading} className="lg-submit" style={{ marginBottom: 20 }}>
        {loading ? (
          <>
            <span
              style={{
                width: 16,
                height: 16,
                border: '2px solid rgba(255,255,255,.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'lg-spin .7s linear infinite',
              }}
            />
            <span>جاري التحقق…</span>
          </>
        ) : (
          'تسجيل الدخول'
        )}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: '#E0E0E0' }} />
        <span style={{ fontSize: 12, color: '#999999' }}>أو</span>
        <div style={{ flex: 1, height: 1, background: '#E0E0E0' }} />
      </div>

      {/* Register */}
      <button type="button" onClick={onShowRegister} className="lg-outline-btn">
        إنشاء حساب جديد
      </button>
    </form>
  );
}

/* ════════════════════════════════════════════
   Main Login component — split screen with brand panel
════════════════════════════════════════════ */
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

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const pinRef = useRef<HTMLInputElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  /* CSS injection */
  useEffect(() => {
    let el = document.getElementById(LG_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = LG_CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = LG_CSS;
    return () => {
      document.getElementById(LG_CSS_ID)?.remove();
    };
  }, []);

  useEffect(() => {
    if (!showRegister && !requires2FA) setTimeout(() => usernameRef.current?.focus(), 80);
  }, [showRegister, requires2FA]);

  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'lg-shake .3s ease';
  }, [error]);

  const explicitCompanyId: number | null = (() => {
    if (typeof window === 'undefined') return null;
    const v = Number(new URLSearchParams(window.location.search).get('company_id'));
    return Number.isFinite(v) && v > 0 ? v : null;
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
      const u = { ...user, company_id: companyId || user.company_id || null };
      if (u.company_id) localStorage.setItem('erp_company_id', String(u.company_id));
      login(u);
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
        const data = (await res.json()) as {
          requires_2fa?: boolean;
          temp_token?: string;
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
        if (data.requires_2fa && data.temp_token) {
          setTempToken(data.temp_token);
          setRequires2FA(true);
          setLoading(false);
          return;
        }
        const u = data.user!;
        if ((u.role === 'cashier' || u.role === 'salesperson') && !u.warehouse_id) {
          setError('هذا المستخدم غير مرتبط بمخزن — راجع المدير');
          setLoading(false);
          return;
        }
        if ((u.role === 'cashier' || u.role === 'salesperson') && !u.safe_id) {
          setError('هذا المستخدم غير مرتبط بخزنة — راجع المدير');
          setLoading(false);
          return;
        }
        if (u.company_id) localStorage.setItem('erp_company_id', String(u.company_id));
        login(u);
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
        setError('أدخل ٦ أرقام');
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

  /* ─── RENDER ─── */
  return (
    <div
      dir="rtl"
      className="lp-login-wrap"
      style={{ minHeight: '100vh', display: 'flex', background: '#F5F5F5' }}
    >
      {/* ── Left panel: Brand showcase (hidden on mobile) ── */}
      <div
        className="lg-brand-panel"
        style={{
          flex: '1 1 50%',
          background: 'linear-gradient(135deg, #F59E0B 0%, #F57F17 60%, #E65100 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative orbs */}
        <div
          style={{
            position: 'absolute',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,215,0,.3) 0%, transparent 70%)',
            filter: 'blur(60px)',
            top: '10%',
            right: '5%',
            animation: 'lg-orb-1 12s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
            bottom: '5%',
            left: '0%',
            animation: 'lg-orb-2 15s ease-in-out infinite',
          }}
        />
        {/* Grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 60% 60% at 50% 40%, black 0%, transparent 80%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 60% 60% at 50% 40%, black 0%, transparent 80%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 420 }}>
          {/* Logo */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              background: 'rgba(255,255,255,.15)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: "'Tajawal','SF Pro Display',sans-serif",
              fontSize: 44,
              fontWeight: 800,
              margin: '0 auto 32px',
              boxShadow: '0 8px 32px rgba(0,0,0,.15)',
            }}
          >
            م
          </div>

          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(28px,3.5vw,40px)',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: '0 0 16px',
            }}
          >
            نظام ERP عربي
            <br />
            لإدارة محلات الموبايلات
          </h2>
          <p
            style={{
              fontSize: 17,
              color: 'rgba(255,255,255,.85)',
              lineHeight: 1.6,
              marginBottom: 40,
              maxWidth: 380,
              margin: '0 auto 40px',
            }}
          >
            من نقطة البيع إلى الميزانية — كل ما تحتاجه في منصة واحدة متكاملة.
          </p>

          {/* Features list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              textAlign: 'right',
              maxWidth: 340,
              margin: '0 auto',
            }}
          >
            {[
              'نقطة بيع سريعة وفواتير فورية',
              'إدارة مخزون متعدد المخازن',
              'تتبع صيانة الأجهزة والقطع',
              'تقارير مالية شاملة لحظية',
            ].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>
                  {f}
                </span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: 48 }}>
            {[
              { v: '+١٥٠', l: 'محل موبايلات' },
              { v: '٤.٩★', l: 'تقييم العملاء' },
              { v: '٢٤/٧', l: 'دعم عربي' },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: "'Inter','Tajawal',sans-serif",
                    fontSize: 28,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {s.v}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: Auth form ── */}
      <div
        style={{
          flex: '1 1 50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          position: 'relative',
        }}
      >
        {/* Subtle background orbs */}
        <div
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,158,11,.08) 0%, transparent 70%)',
            filter: 'blur(60px)',
            top: '20%',
            right: '10%',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 250,
            height: 250,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,215,0,.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
            bottom: '15%',
            left: '5%',
            pointerEvents: 'none',
          }}
        />

        <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
          {/* Back to home button */}
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 980,
              background: 'rgba(255,255,255,.7)',
              backdropFilter: 'blur(10px)',
              border: '1px solid #E0E0E0',
              color: '#666666',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all .2s',
              marginBottom: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FFF9E6';
              e.currentTarget.style.borderColor = '#F59E0B';
              e.currentTarget.style.color = '#F59E0B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.7)';
              e.currentTarget.style.borderColor = '#E0E0E0';
              e.currentTarget.style.color = '#666666';
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            العودة للرئيسية
          </a>

          {/* Mobile logo (hidden on desktop) */}
          <div className="lg-mobile-logo" style={{ display: 'none', marginBottom: 32 }}>
            <LoginLogo size={56} />
          </div>

          {/* Desktop logo (hidden on mobile) */}
          <div
            className="lg-desktop-logo"
            style={{ marginBottom: 40, display: 'flex', justifyContent: 'center' }}
          >
            <LoginLogo size={48} />
          </div>

          {/* 2FA */}
          {requires2FA ? (
            <form
              onSubmit={handleTotpSubmit}
              noValidate
              style={{ animation: 'lg-up .4s ease both' }}
            >
              <h2
                style={{
                  fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#333333',
                  letterSpacing: '-0.025em',
                  marginBottom: 8,
                }}
              >
                التحقق الثنائي
              </h2>
              <p style={{ fontSize: 14, color: '#666666', lineHeight: 1.7, marginBottom: 28 }}>
                افتح <strong style={{ color: '#333333' }}>Google Authenticator</strong> وأدخل الرمز
                المكوّن من ٦ أرقام.
              </p>
              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  style={{
                    marginBottom: 20,
                    padding: '12px 16px',
                    background: 'rgba(239,68,68,.08)',
                    border: '1px solid rgba(239,68,68,.2)',
                    borderRadius: 12,
                    fontSize: 13,
                    color: '#EF4444',
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
                placeholder="000 000"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                className="lg-input"
                style={{
                  fontSize: 24,
                  fontFamily: "'Inter', monospace",
                  letterSpacing: '0.5em',
                  textAlign: 'center',
                  marginBottom: 20,
                  paddingLeft: 0,
                  paddingRight: 0,
                  height: 64,
                }}
              />
              <button
                type="submit"
                disabled={totpLoading || totpCode.length !== 6}
                className="lg-submit"
                style={{ marginBottom: 12 }}
              >
                {totpLoading ? 'جاري التحقق…' : 'تحقق'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setTempToken('');
                  setTotpCode('');
                  setError('');
                  setPin('');
                }}
                className="lg-outline-btn"
              >
                رجوع
              </button>
            </form>
          ) : showRegister ? (
            <div style={{ animation: 'lg-up .4s ease both' }}>
              <h1
                style={{
                  fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#333333',
                  letterSpacing: '-0.025em',
                  marginBottom: 8,
                }}
              >
                إنشاء حساب <span className="lg-gradient-text">جديد</span>
              </h1>
              <p style={{ fontSize: 14, color: '#666666', marginBottom: 28 }}>
                تجربة مجانية لمدة ٧ أيام — بدون بطاقة ائتمان
              </p>
              <RegisterForm
                onSuccess={handleRegisterSuccess}
                onSwitch={() => {
                  setShowRegister(false);
                  setError('');
                }}
              />
            </div>
          ) : (
            <LoginForm
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
          )}

          {/* Security note */}
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 11,
              color: '#999999',
            }}
          >
            <LockIcon />
            <span>بحماية TLS · بيانات كل شركة معزولة تماماً</span>
          </div>
        </div>
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          .lg-brand-panel { display: none !important; }
          .lg-mobile-logo { display: flex !important; justify-content: center; }
          .lg-desktop-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export { RegisterForm } from './login/RegisterForm';
