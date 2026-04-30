import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';
import { useLocation } from 'wouter';
import { translateRole } from '@/lib/roles';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';


interface ErpUser {
  id: number;
  name: string;
  username: string;
  pinLength: number;
  role: string;
  active: boolean;
}

const FEATURES = [
  { icon: '⚡', label: 'مبيعات فورية', desc: 'وحماية منكاملة' },
  { icon: '📊', label: 'تحليلات ذكية', desc: 'ونوقعات دقيقة' },
  { icon: '🔑', label: 'أمان متطور', desc: 'وصلاحيات مخصصة' },
  { icon: '📦', label: 'إدارة المخزون', desc: 'والخدمات اللوجستية' },
];

export default function Login() {
  const { login } = useAuth();
  const { settings } = useAppSettings();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'username' | 'pin' | null>(null);

  /* ── 2FA state ─── */
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

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
      },
      companyId: number
    ) => {
      if (companyId) {
        localStorage.setItem('erp_company_id', String(companyId));
      }
      login(user);
      setLocation('/');
    },
    [login, setLocation]
  );

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  const logoSrc = settings.customLogo || `${import.meta.env.BASE_URL}muhkam-logo.png`;

  /* company_id: explicit URL param ONLY. NEVER fall back to a hard-coded
     company id — that silently routes credentials to the wrong tenant. */
  const storedCompanyId: number | null = (() => {
    if (typeof window === 'undefined') return null;
    const fromUrl = Number(new URLSearchParams(window.location.search).get('company_id'));
    if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;
    const fromStorage = Number(localStorage.getItem('erp_company_id'));
    if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
    return null;
  })();

  const { data: users = [] } = useQuery<ErpUser[]>({
    queryKey: ['/api/auth/users', storedCompanyId],
    enabled: storedCompanyId !== null,
    queryFn: () =>
      fetch(api(`/api/auth/users?company_id=${storedCompanyId}`)).then((r) => {
        if (!r.ok) throw new Error('فشل جلب المستخدمين');
        return r.json();
      }),
  });

  const activeUsers = users.filter((u) => u.active !== false);

  useEffect(() => {
    setTimeout(() => usernameRef.current?.focus(), 400);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const trimmed = username.trim();
      if (!trimmed) {
        setError('أدخل اسم المستخدم');
        usernameRef.current?.focus();
        return;
      }
      if (!pin) {
        setError('أدخل الرقم السري');
        pinRef.current?.focus();
        return;
      }

      const matchedUser = activeUsers.find(
        (u) => u.username.toLowerCase() === trimmed.toLowerCase() || u.name === trimmed
      );

      setLoading(true);
      try {
        const body = matchedUser
          ? { userId: matchedUser.id, pin }
          : { username: trimmed.toLowerCase(), pin };
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

        /* ── 2FA required — switch to TOTP step ─── */
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
        /* Store company_id for future login-page user-list fetches */
        if (authedUser.company_id) {
          localStorage.setItem('erp_company_id', String(authedUser.company_id));
        }
        login(authedUser);
        setLocation('/');
      } catch {
        setError('تعذّر الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    },
    [username, pin, activeUsers, login, setLocation]
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

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'row-reverse',
        fontFamily: 'inherit',
        background: '#f8faff',
      }}
    >
      {/* ════════════════════════════════════════════════════
          BRAND PANEL  (deep purple + Islamic geometric)
      ════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex"
        style={{
          width: '46%',
          position: 'relative',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #1a0a3c 0%, #2d1060 35%, #3d1878 65%, #1f0a40 100%)',
        }}
      >
        {/* ── Islamic arabesque pattern overlay ─────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.12,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d='M40 0 L80 40 L40 80 L0 40Z' fill='none' stroke='%23d4af37' stroke-width='0.8'/%3E%3Cpath d='M40 10 L70 40 L40 70 L10 40Z' fill='none' stroke='%23d4af37' stroke-width='0.6'/%3E%3Ccircle cx='40' cy='40' r='12' fill='none' stroke='%23d4af37' stroke-width='0.5'/%3E%3Cpath d='M0 0 L20 20 M80 0 L60 20 M0 80 L20 60 M80 80 L60 60' stroke='%23d4af37' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px',
          }}
        />

        {/* ── Glowing blobs ─────────────────────────────── */}
        <div className="lp-blob lp-blob-1" />
        <div className="lp-blob lp-blob-2" />
        <div className="lp-blob lp-blob-3" />

        {/* ── Gold radial glow center ───────────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '380px',
            height: '380px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Content ───────────────────────────────────── */}
        <div
          className="relative z-10 flex flex-col items-center text-center px-10"
          style={{ maxWidth: '420px', width: '100%' }}
          dir="rtl"
        >
          {/* Logo */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 30% 30%, rgba(212,175,55,0.25), rgba(0,0,0,0.4))',
              border: '2px solid rgba(212,175,55,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '22px',
              boxShadow:
                '0 0 0 8px rgba(212,175,55,0.08),' +
                '0 0 50px rgba(212,175,55,0.3),' +
                '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <img
              src={logoSrc}
              alt="MUHKAM Logo"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const p = (e.target as HTMLImageElement).parentElement;
                if (p) p.innerHTML = '<span style="font-size:52px">🛡️</span>';
              }}
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5)) brightness(1.1)',
              }}
              className="border-t-[0px] border-r-[0px] border-b-[0px] border-l-[0px]"
            />
          </div>

          {/* Brand name */}
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#f5e09a',
              marginBottom: '6px',
              letterSpacing: '0.5px',
              textShadow: '0 2px 20px rgba(212,175,55,0.6), 0 0 60px rgba(212,175,55,0.2)',
              lineHeight: 1.1,
              fontFamily: 'inherit',
            }}
          >
            {settings.companyName || 'مُحكم | MUHKAM'}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '14px',
              color: 'rgba(212,175,55,0.75)',
              marginBottom: '38px',
              lineHeight: 1.7,
              fontWeight: 500,
            }}
          >
            {settings.companySlogan || 'نظام إدارة مُحكم، لمستقبل أحكم'}
          </p>

          {/* Feature 2×2 grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              width: '100%',
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(212,175,55,0.2)',
                  borderRadius: '18px',
                  padding: '18px 12px',
                  textAlign: 'center',
                  transition: 'background 0.25s, border-color 0.25s, transform 0.25s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(212,175,55,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.45)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    filter: 'drop-shadow(0 4px 10px rgba(212,175,55,0.6))',
                    display: 'block',
                  }}
                >
                  {f.icon}
                </span>
                <div>
                  <div
                    style={{ fontSize: '13px', fontWeight: 800, color: '#f5e09a', lineHeight: 1.3 }}
                  >
                    {f.label}
                  </div>
                  <div
                    style={{ fontSize: '11px', color: 'rgba(212,175,55,0.6)', marginTop: '3px' }}
                  >
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Version badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '22px',
            fontSize: '11px',
            color: 'rgba(212,175,55,0.4)',
            letterSpacing: '0.18em',
            fontWeight: 600,
          }}
        >
          MUHKAM ERP v2.0 &nbsp;|&nbsp; Cairo, Egypt
        </div>
      </div>
      {/* ════════════════════════════════════════════════════
          FORM PANEL  (right in LTR, left in RTL)
      ════════════════════════════════════════════════════ */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          minHeight: '100vh',
          background: 'linear-gradient(160deg, #fffdf5 0%, #fef9e7 35%, #fff8e1 65%, #fdf6e3 100%)',
          colorScheme: 'light',
          color: '#0f0c29',
        }}
      >
        {/* Mobile logo */}
        <div className="flex lg:hidden flex-col items-center" style={{ marginBottom: '32px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #2d1060, #3d1878)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
              border: '2px solid rgba(212,175,55,0.4)',
              boxShadow: '0 0 30px rgba(212,175,55,0.25),' + '0 8px 24px rgba(0,0,0,0.15)',
            }}
          >
            <img
              src={logoSrc}
              alt="Logo"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const p = (e.target as HTMLImageElement).parentElement;
                if (p) p.innerHTML = '<span style="font-size:32px">🛡️</span>';
              }}
              style={{ width: '52px', height: '52px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#3d1878' }}>
            {settings.companyName || 'مُحكم | MUHKAM'}
          </div>
        </div>

        {/* ── Card ──────────────────────────────────────── */}
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            borderRadius: '28px',
            border: '1px solid rgba(212,175,55,0.25)',
            boxShadow:
              '0 0 0 1px rgba(212,175,55,0.08),' +
              '0 4px 8px rgba(0,0,0,0.04),' +
              '0 28px 80px rgba(61,24,120,0.12),' +
              '0 8px 40px rgba(0,0,0,0.06)',
            padding: '40px 38px',
          }}
        >
          {/* ── 2FA Step ─── */}
          {requires2FA ? (
            <form onSubmit={handleTotpSubmit} noValidate aria-label="نموذج التحقق الثنائي">
              <div style={{ marginBottom: '28px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔐</div>
                <h2
                  style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#0f0c29',
                    marginBottom: '8px',
                  }}
                >
                  التحقق الثنائي
                </h2>
                <p style={{ fontSize: '13px', color: '#7c6fa0', lineHeight: 1.6 }}>
                  افتح تطبيق <strong>Google Authenticator</strong> أو <strong>Authy</strong>
                  <br />
                  وأدخل الرمز المكون من 6 أرقام
                </p>
              </div>

              {error && (
                <div
                  id="totp-error"
                  role="alert"
                  aria-live="polite"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    marginBottom: '16px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#EF4444',
                    fontSize: '13px',
                    fontWeight: 700,
                    textAlign: 'center',
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
                placeholder="• • • • • •"
                inputMode="numeric"
                autoFocus
                aria-label="رمز التحقق الثنائي"
                aria-describedby="totp-error"
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1.5px solid rgba(124,58,237,0.3)',
                  fontSize: '32px',
                  letterSpacing: '14px',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  color: '#0f0c29',
                  background: '#fdfbff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '16px',
                }}
                maxLength={6}
              />

              <button
                type="submit"
                disabled={totpLoading || totpCode.length !== 6}
                className="lp-btn-primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  border: 'none',
                  background:
                    totpCode.length === 6 ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#e5e7eb',
                  color: totpCode.length === 6 ? '#fff' : '#9ca3af',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: totpCode.length !== 6 ? 'not-allowed' : 'pointer',
                  marginBottom: '14px',
                }}
              >
                {totpLoading ? 'جاري التحقق...' : 'تحقق →'}
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
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid #e0d9f0',
                  background: 'transparent',
                  color: '#7c6fa0',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ← رجوع لإدخال الرقم السري
              </button>
            </form>
          ) : (
            <>
              {/* Tab toggle */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(61,24,120,0.08)',
                  borderRadius: '14px',
                  padding: '5px',
                  marginBottom: '28px',
                  gap: '5px',
                  border: '1px solid rgba(212,175,55,0.15)',
                }}
              >
                {(
                  [
                    ['login', 'تسجيل الدخول'],
                    ['register', 'مستخدم جديد'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: '10px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      background:
                        mode === m
                          ? 'linear-gradient(135deg, #2d1060 0%, #4a1a90 100%)'
                          : 'transparent',
                      color: mode === m ? '#f5e09a' : '#8b6914',
                      boxShadow:
                        mode === m
                          ? '0 4px 12px rgba(61,24,120,0.3), 0 1px 4px rgba(0,0,0,0.1)'
                          : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'login' ? (
                <LoginForm
                  users={activeUsers}
                  username={username}
                  setUsername={setUsername}
                  pin={pin}
                  setPin={setPin}
                  showPin={showPin}
                  setShowPin={setShowPin}
                  error={error}
                  setError={setError}
                  loading={loading}
                  focused={focused}
                  setFocused={setFocused}
                  usernameRef={usernameRef}
                  pinRef={pinRef}
                  onSubmit={handleSubmit}
                />
              ) : (
                <RegisterForm onSuccess={handleRegisterSuccess} onSwitch={() => setMode('login')} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: '24px',
            fontSize: '11.5px',
            color: '#b8860b',
            textAlign: 'center',
            letterSpacing: '0.02em',
            opacity: 0.7,
          }}
        >
          &copy; {new Date().getFullYear()} MUHKAM Enterprise Solutions &nbsp;-&nbsp; جميع الحقوق
          محفوظة
        </p>
      </div>
      {/* ════════════════════════════════════════════════════
          Global styles
      ════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes lp-shake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-8px); }
          30%      { transform: translateX(7px); }
          45%      { transform: translateX(-6px); }
          60%      { transform: translateX(5px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(2px); }
        }
        @keyframes lp-float-1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%     { transform: translate(30px,-40px) scale(1.08); }
          66%     { transform: translate(-20px,20px) scale(0.95); }
        }
        @keyframes lp-float-2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%     { transform: translate(-40px,30px) scale(1.1); }
          70%     { transform: translate(20px,-20px) scale(0.92); }
        }
        @keyframes lp-float-3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(20px,40px) scale(1.06); }
        }
        @keyframes lp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .lp-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
        }
        .lp-blob-1 {
          width: 420px; height: 420px;
          top: -120px; right: -80px;
          background: radial-gradient(circle, rgba(124,58,237,0.45) 0%, transparent 70%);
          animation: lp-float-1 12s ease-in-out infinite;
        }
        .lp-blob-2 {
          width: 360px; height: 360px;
          bottom: -100px; left: -80px;
          background: radial-gradient(circle, rgba(79,70,229,0.4) 0%, transparent 70%);
          animation: lp-float-2 15s ease-in-out infinite;
        }
        .lp-blob-3 {
          width: 260px; height: 260px;
          top: 45%; left: 30%;
          background: radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%);
          animation: lp-float-3 10s ease-in-out infinite;
        }

        /* Input base */
        .lp-input {
          transition: border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
          color: #0f0c29 !important;
          -webkit-text-fill-color: #0f0c29 !important;
          caret-color: #4a1a90;
          color-scheme: light;
        }
        .lp-input:focus {
          outline: none;
          border-color: #4a1a90 !important;
          box-shadow: 0 0 0 4px rgba(61,24,120,0.12), 0 4px 20px rgba(212,175,55,0.08) !important;
          background: #fffdf8 !important;
        }
        .lp-input::placeholder {
          color: #9a8fb8 !important;
          opacity: 1;
        }
        /* Override browser autofill styling that turns text white */
        .lp-input:-webkit-autofill,
        .lp-input:-webkit-autofill:hover,
        .lp-input:-webkit-autofill:focus,
        .lp-input:-webkit-autofill:active {
          -webkit-text-fill-color: #0f0c29 !important;
          -webkit-box-shadow: 0 0 0 1000px #fefcff inset !important;
          box-shadow: 0 0 0 1000px #fefcff inset !important;
          caret-color: #0f0c29 !important;
          transition: background-color 9999s ease-in-out 0s;
        }

        /* Primary button */
        .lp-btn-primary {
          position: relative;
          overflow: hidden;
          transition: transform 0.18s cubic-bezier(.34,1.56,.64,1),
                      box-shadow 0.20s ease,
                      filter 0.18s ease;
        }
        .lp-btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(255,255,255,0.22) 40%,
            rgba(255,255,255,0.36) 50%,
            rgba(255,255,255,0.22) 60%,
            transparent 100%
          );
          transform: translateX(-150%);
          transition: transform 0s;
          pointer-events: none;
        }
        .lp-btn-primary:hover:not(:disabled)::after {
          transform: translateX(150%);
          transition: transform 0.55s ease;
        }
        .lp-btn-primary:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 16px 40px rgba(99,57,206,0.55), 0 4px 16px rgba(0,0,0,0.12) !important;
          filter: brightness(1.06);
        }
        .lp-btn-primary:active:not(:disabled) {
          transform: translateY(0) scale(0.97);
          box-shadow: 0 4px 12px rgba(99,57,206,0.28) !important;
          filter: brightness(0.96);
        }
        .lp-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @keyframes lp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .lp-spinner {
          animation: lp-spin 0.75s linear infinite;
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   LOGIN FORM
────────────────────────────────────────────────────────── */
interface LoginFormProps {
  users: ErpUser[];
  username: string;
  setUsername: (v: string) => void;
  pin: string;
  setPin: (v: string) => void;
  showPin: boolean;
  setShowPin: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
  loading: boolean;
  focused: 'username' | 'pin' | null;
  setFocused: (v: 'username' | 'pin' | null) => void;
  usernameRef: React.RefObject<HTMLInputElement | null>;
  pinRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: React.FormEvent) => void;
}

function LoginForm({
  users,
  username,
  setUsername,
  pin,
  setPin,
  showPin,
  setShowPin,
  error,
  setError,
  loading,
  focused,
  setFocused,
  usernameRef,
  pinRef,
  onSubmit,
}: LoginFormProps) {
  const matchedUser = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() || u.name === username.trim()
  );

  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    const el = errorRef.current;
    if (el) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'lp-shake 0.5s ease';
    }
  }, [error]);

  return (
    <form onSubmit={onSubmit} noValidate aria-label="نموذج تسجيل الدخول">
      {/* Heading */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '6px' }}>🤩</div>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 900,
            color: '#2d1060',
            marginBottom: '6px',
            letterSpacing: '-0.3px',
            lineHeight: 1.2,
          }}
        >
          ابدأ رحلة النجاح معنا!
        </h2>
        <p style={{ fontSize: '13px', color: '#8b6914', lineHeight: 1.6, opacity: 0.8 }}>
          سجّل دخولك للوصول إلى لوحة التحكم
        </p>
      </div>
      {/* ── Username ─────────────────────────────────── */}
      <div style={{ marginBottom: '18px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 700,
            color: '#3b2d6e',
            marginBottom: '8px',
          }}
        >
          اسم المستخدم أو البريد الإلكتروني
        </label>
        <div style={{ position: 'relative' }}>
          {/* Icon */}
          <span
            style={{
              position: 'absolute',
              top: '50%',
              right: '16px',
              transform: 'translateY(-50%)',
              fontSize: '17px',
              color: focused === 'username' ? '#7c3aed' : '#c4b5fd',
              pointerEvents: 'none',
              transition: 'color 0.2s',
            }}
          >
            👤
          </span>
          <input
            id="login-username"
            ref={usernameRef}
            type="text"
            value={username}
            autoComplete="username"
            placeholder="اسم المستخدم أو البريد الإلكتروني"
            aria-label="اسم المستخدم أو البريد الإلكتروني"
            aria-describedby="login-error"
            disabled={loading}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            onFocus={() => setFocused('username')}
            onBlur={() => setFocused(null)}
            className="lp-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '15px 50px 15px 46px',
              borderRadius: '14px',
              border: `1.5px solid ${focused === 'username' ? '#7c3aed' : '#e5e0f8'}`,
              fontSize: '14.5px',
              color: '#0f0c29',
              WebkitTextFillColor: '#0f0c29',
              background: loading ? '#f9f8ff' : '#fefcff',
              backgroundColor: loading ? '#f9f8ff' : '#fefcff',
              fontFamily: 'inherit',
              direction: 'rtl',
              height: '54px',
              colorScheme: 'light',
            }}
          />
          {/* Match indicator — only show ✅ when user found in list */}
          {username.trim() && matchedUser && (
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '16px',
                transform: 'translateY(-50%)',
                fontSize: '15px',
              }}
            >
              ✅
            </span>
          )}
        </div>

        {/* Matched user pill */}
        {matchedUser && (
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 14px',
              background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
              border: '1px solid #ddd6fe',
              borderRadius: '12px',
              fontSize: '12.5px',
              color: '#5b21b6',
            }}
          >
            <span
              style={{
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color: '#fff',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {matchedUser.name.charAt(0)}
            </span>
            <span style={{ fontWeight: 600 }}>{matchedUser.name}</span>
            <span
              style={{
                marginRight: 'auto',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color: '#fff',
                borderRadius: '7px',
                padding: '2px 10px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {translateRole(matchedUser.role)}
            </span>
          </div>
        )}
      </div>
      {/* ── PIN ──────────────────────────────────────── */}
      <div style={{ marginBottom: '22px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 700,
            color: '#3b2d6e',
            marginBottom: '8px',
          }}
        >
          الرقم السري
        </label>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              top: '50%',
              right: '16px',
              transform: 'translateY(-50%)',
              fontSize: '17px',
              color: focused === 'pin' ? '#7c3aed' : '#c4b5fd',
              pointerEvents: 'none',
              transition: 'color 0.2s',
            }}
          >
            🔒
          </span>
          <input
            id="login-pin"
            ref={pinRef}
            type={showPin ? 'text' : 'password'}
            value={pin}
            autoComplete="current-password"
            placeholder="أدخل الرقم السري"
            aria-label="الرقم السري"
            aria-describedby="login-error"
            disabled={loading}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            onFocus={() => setFocused('pin')}
            onBlur={() => setFocused(null)}
            className="lp-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '15px 50px 15px 50px',
              borderRadius: '14px',
              border: `1.5px solid ${focused === 'pin' ? '#7c3aed' : '#e5e0f8'}`,
              fontSize: '14.5px',
              color: '#0f0c29',
              WebkitTextFillColor: '#0f0c29',
              background: loading ? '#f9f8ff' : '#fefcff',
              backgroundColor: loading ? '#f9f8ff' : '#fefcff',
              fontFamily: 'inherit',
              direction: 'ltr',
              letterSpacing: pin && !showPin ? '0.35em' : 'normal',
              height: '54px',
              colorScheme: 'light',
            }}
          />
          {/* Show/hide */}
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            tabIndex={-1}
            style={{
              position: 'absolute',
              top: '50%',
              left: '16px',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '17px',
              color: '#c4b5fd',
              padding: '2px',
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#7c3aed')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#c4b5fd')}
            title={showPin ? 'إخفاء' : 'إظهار'}
          >
            {showPin ? '🙈' : '👁'}
          </button>
        </div>
      </div>
      {/* ── Error ────────────────────────────────────── */}
      {error && (
        <div
          id="login-error"
          role="alert"
          aria-live="polite"
          ref={errorRef}
          style={{
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            background: '#fff5f5',
            border: '1.5px solid #fecaca',
            borderRadius: '12px',
            fontSize: '13.5px',
            color: '#dc2626',
            fontWeight: 600,
          }}
        >
          <span style={{ flexShrink: 0, fontSize: '16px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {/* ── Submit button ─────────────────────────────── */}
      <button
        type="submit"
        disabled={loading}
        className="lp-btn-primary"
        style={{
          width: '100%',
          height: '54px',
          borderRadius: '14px',
          border: '1px solid rgba(212,175,55,0.3)',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '15.5px',
          fontWeight: 800,
          color: '#fff',
          background: 'linear-gradient(135deg, #2d1060 0%, #4a1a90 50%, #3d1878 100%)',
          boxShadow: '0 6px 20px rgba(61,24,120,0.4), 0 2px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '22px',
          letterSpacing: '0.02em',
        }}
      >
        {loading ? (
          <>
            <span
              className="lp-spinner"
              style={{
                width: '20px',
                height: '20px',
                border: '2.5px solid rgba(255,255,255,0.25)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
              }}
            />
            <span>جاري التحقق...</span>
          </>
        ) : (
          <span>🔐 دخول آمن (مُحكم) ←</span>
        )}
      </button>
      {/* ── Quick-select avatars ───────────────────────── */}
      {users.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(212,175,55,0.2)', paddingTop: '18px' }}>
          <div
            style={{
              fontSize: '11.5px',
              color: '#8b6914',
              textAlign: 'center',
              marginBottom: '14px',
              fontWeight: 600,
              opacity: 0.8,
            }}
          >
            اختر مستتك بسرعة
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
            }}
          >
            {users.slice(0, 6).map((u) => {
              const isActive = username === u.username;
              const initials = u.name.charAt(0);
              return (
                <button
                  key={u.id}
                  type="button"
                  title={u.name}
                  onClick={() => {
                    setUsername(u.username);
                    pinRef.current?.focus();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isActive
                        ? 'linear-gradient(135deg, #2d1060, #4a1a90)'
                        : 'linear-gradient(135deg, #3d1878, #6b21a8)',
                      border: `2.5px solid ${isActive ? '#d4af37' : 'rgba(212,175,55,0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      fontWeight: 800,
                      color: '#f5e09a',
                      boxShadow: isActive ? '0 0 14px rgba(212,175,55,0.4)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {initials}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: isActive ? '#2d1060' : '#8b6914',
                      fontWeight: 700,
                      maxWidth: '48px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {u.name}
                  </span>
                </button>
              );
            })}
          </div>
          {users.length > 0 && (
            <div
              style={{
                textAlign: 'center',
                marginTop: '10px',
                fontSize: '10.5px',
                color: '#b8860b',
                opacity: 0.6,
              }}
            >
              العودة سريعاً لمستخدم سابق
            </div>
          )}
        </div>
      )}
    </form>
  );
}

/* ──────────────────────────────────────────────────────────
   REGISTER FORM — imported from login/RegisterForm.tsx
────────────────────────────────────────────────────────── */
export { RegisterForm } from './login/RegisterForm';
