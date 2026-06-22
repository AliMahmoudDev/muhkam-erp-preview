/* eslint-disable erp/no-hardcoded-colors -- RegisterForm is a standalone auth component with intentional dark color palette for v4 redesign; tokens do not apply here. */
import { useEffect, useRef, useState } from 'react';

const BASE_REGISTER = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiReg = (p: string) => `${BASE_REGISTER}${p}`;

interface RegisterFormProps {
  onSuccess: (
    user: {
      id: number;
      name: string;
      username: string;
      phone?: string | null;
      role: string;
      active?: boolean;
      warehouse_id?: number | null;
      safe_id?: number | null;
      permissions?: Record<string, boolean>;
    },
    companyId: number
  ) => void;
  onSwitch: () => void;
}

function pwStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { score: 0, label: '',      color: 'transparent' },
    { score: 1, label: 'ضعيفة', color: '#EF4444' },
    { score: 2, label: 'متوسطة',color: '#F59E0B' },
    { score: 3, label: 'جيدة',  color: '#EAB308' },
    { score: 4, label: 'قوية',  color: '#22C55E' },
  ];
  return map[score];
}

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

export function RegisterForm({ onSuccess, onSwitch }: RegisterFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [adminName,   setAdminName]   = useState('');
  const [email,       setEmail]       = useState('');
  const [phone,       setPhone]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [createdUsername, setCreatedUsername] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'v4-shake .35s ease';
  }, [error]);

  const strength = pwStrength(password);

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#A1A1AA',
    marginBottom: 8,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim()) { setError('اسم الشركة مطلوب'); return; }
    if (!adminName.trim())   { setError('اسم المسؤول مطلوب'); return; }
    if (!email.includes('@')){ setError('بريد إلكتروني صحيح مطلوب'); return; }
    if (!/^01[0125]\d{8}$/.test(phone.trim())) { setError('رقم الهاتف يجب أن يكون 11 رقم مصري صحيح'); return; }
    if (password.length < 8)        { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (!/[A-Z]/.test(password))    { setError('يجب أن تحتوي كلمة المرور على حرف كبير'); return; }
    if (!/[0-9]/.test(password))    { setError('يجب أن تحتوي كلمة المرور على رقم'); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError('يجب أن تحتوي كلمة المرور على رمز خاص'); return; }
    if (password !== confirmPw)     { setError('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      const res = await fetch(apiReg('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, admin_name: adminName, email, phone: phone.trim(), password }),
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { setError(String(data.error || 'فشل إنشاء الحساب')); return; }

      const userData = (data.user ?? {}) as {
        id: number; name: string; username: string; phone?: string | null;
        role: string; active?: boolean; warehouse_id?: number | null;
        safe_id?: number | null; permissions?: Record<string, boolean>;
      };
      const companyData = (data.company ?? {}) as { id: number };
      setCreatedUsername(userData.username ?? '');
      setSuccess(true);
      setTimeout(() => { onSuccess(userData, companyData.id); }, 1800);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success screen ── */
  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }} dir="rtl">
        <div
          style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px',
            background: 'rgba(99,102,241,.12)',
            border: '1px solid rgba(99,102,241,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F8F8FA', marginBottom: 8, letterSpacing: '-0.01em' }}>
          تم إنشاء حسابك بنجاح
        </h3>
        {createdUsername && (
          <div
            style={{
              margin: '14px auto', maxWidth: 320, padding: '14px 16px',
              borderRadius: 8, background: '#0D0D12', border: '1px solid #1C1C21',
            }}
          >
            <p style={{ fontSize: 12, color: '#71717A', fontWeight: 600, marginBottom: 4 }}>رقم الدخول الخاص بك</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#6366F1', letterSpacing: '0.04em', direction: 'ltr', fontFamily: "'Inter', monospace" }}>
              {createdUsername}
            </p>
            <p style={{ fontSize: 11, color: '#52525B', marginTop: 6 }}>استخدم هذا الرقم لتسجيل الدخول</p>
          </div>
        )}
        <p style={{ fontSize: 13, color: '#71717A' }}>جاري تسجيل الدخول…</p>
      </div>
    );
  }

  const fields = [
    { id: 'company', label: 'اسم الشركة',              value: companyName, setter: setCompanyName, type: 'text',  placeholder: 'شركة المليجي للتجارة', dir: 'rtl' as const },
    { id: 'admin',   label: 'اسم المسؤول',              value: adminName,   setter: setAdminName,   type: 'text',  placeholder: 'صالح محمد',           dir: 'rtl' as const },
    { id: 'phone',   label: 'رقم الهاتف / اسم الدخول', value: phone,       setter: setPhone,       type: 'tel',   placeholder: '01012345678',          dir: 'ltr' as const },
    { id: 'email',   label: 'البريد الإلكتروني',        value: email,       setter: setEmail,       type: 'email', placeholder: 'admin@company.com',    dir: 'ltr' as const },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate dir="rtl" aria-label="نموذج إنشاء حساب جديد">

      {/* Error banner */}
      {error && (
        <div
          ref={errorRef}
          role="alert"
          aria-live="polite"
          style={{
            marginBottom: 16, padding: '10px 12px',
            background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
            borderRadius: 8, fontSize: 13, color: '#F87171', fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
        {fields.map((f) => (
          <div key={f.id}>
            <label htmlFor={`reg-${f.id}`} style={labelStyle}>{f.label}</label>
            <input
              id={`reg-${f.id}`}
              type={f.type}
              value={f.value}
              onChange={(e) => { f.setter(e.target.value); setError(''); }}
              placeholder={f.placeholder}
              required
              className="v4-input"
              style={{ direction: f.dir, textAlign: f.dir === 'ltr' ? 'left' : 'right' }}
            />
          </div>
        ))}

        {/* Password */}
        <div>
          <label htmlFor="reg-password" style={labelStyle}>كلمة المرور</label>
          <div style={{ position: 'relative' }}>
            <input
              id="reg-password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="مثال: MyPass@2024"
              required
              autoComplete="new-password"
              className="v4-input v4-input-pw"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw(!showPw)}
              className="v4-pw-toggle"
              aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
          {password && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4].map((i) => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : '#27272A', transition: 'background .25s ease' }} />
                ))}
              </div>
              {strength.label && (
                <div style={{ fontSize: 11, color: strength.color, marginTop: 4, fontWeight: 600 }}>{strength.label}</div>
              )}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="reg-confirm" style={labelStyle}>تأكيد كلمة المرور</label>
          <input
            id="reg-confirm"
            type={showPw ? 'text' : 'password'}
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setError(''); }}
            placeholder="أعد كتابة كلمة المرور"
            required
            autoComplete="new-password"
            className={`v4-input v4-input-pw${confirmPw && confirmPw !== password ? ' v4-input-error' : ''}`}
          />
        </div>
      </div>

      {/* Submit */}
      <button type="submit" disabled={loading} className="v4-btn-primary" style={{ width: '100%', height: 48, marginBottom: 14 }}>
        {loading ? (
          <>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.25)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'v4-spin .7s linear infinite' }} />
            <span>جاري الإنشاء…</span>
          </>
        ) : <span>إنشاء الحساب مجاناً</span>}
      </button>

      {/* Switch to login */}
      <div style={{ textAlign: 'center', fontSize: 13, color: '#71717A' }}>
        لديك حساب بالفعل؟{' '}
        <button type="button" onClick={onSwitch} className="v4-link">سجّل الدخول</button>
      </div>
    </form>
  );
}
