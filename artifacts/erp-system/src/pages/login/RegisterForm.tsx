import { useState, useEffect, useRef } from 'react';

const BASE_REGISTER = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiReg = (p: string) => `${BASE_REGISTER}${p}`;

interface RegisterFormProps {
  onSuccess: (
    user: {
      id: number;
      name: string;
      username: string;
      role: string;
      active?: boolean;
      warehouse_id?: number | null;
      safe_id?: number | null;
      permissions?: Record<string, boolean>;
    }
  ) => void;
  onSwitch: () => void;
}

export function RegisterForm({ onSuccess, onSwitch }: RegisterFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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

  const inputStyle = (active: boolean) => ({
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '13px 16px',
    borderRadius: '12px',
    border: `1.5px solid ${active ? '#7c3aed' : '#e5e0f8'}`,
    fontSize: '14px',
    color: '#0f0c29',
    background: '#fefcff',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: active ? '0 0 0 4px rgba(124,58,237,0.12)' : 'none',
    height: '48px',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim()) { setError('اسم الشركة مطلوب'); return; }
    if (!adminName.trim())   { setError('اسم المسؤول مطلوب'); return; }
    if (!email.includes('@')){ setError('بريد إلكتروني صحيح مطلوب'); return; }
    if (password.length < 8)              { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (!/[A-Z]/.test(password))          { setError('يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل'); return; }
    if (!/[0-9]/.test(password))          { setError('يجب أن تحتوي كلمة المرور على رقم واحد على الأقل'); return; }
    if (!/[^A-Za-z0-9]/.test(password))   { setError('يجب أن تحتوي كلمة المرور على رمز خاص مثل @ # $ !'); return; }
    if (password !== confirmPw)            { setError('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      const res = await fetch(apiReg('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, admin_name: adminName, email, password }),
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) { setError(String(data.error || 'فشل إنشاء الحساب')); return; }
      setSuccess(true);
      setTimeout(() => {
        const { user } = data as {
          user: {
            id: number; name: string; username: string; role: string;
            active?: boolean; warehouse_id?: number | null; safe_id?: number | null;
            permissions?: Record<string, boolean>;
          };
        };
        onSuccess(user);
      }, 900);
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }} dir="rtl">
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
        <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#0f0c29', marginBottom: '10px' }}>
          تم إنشاء حسابك بنجاح!
        </h3>
        <p style={{ fontSize: '14px', color: '#7c6fa0' }}>جاري تسجيل الدخول...</p>
      </div>
    );
  }

  const fields = [
    { id: 'company', label: 'اسم الشركة',        value: companyName, setter: setCompanyName, type: 'text',  icon: '🏢', placeholder: 'شركة المليجي للتجارة' },
    { id: 'admin',   label: 'اسم المسؤول',        value: adminName,   setter: setAdminName,   type: 'text',  icon: '👤', placeholder: 'صالح محمد' },
    { id: 'email',   label: 'البريد الإلكتروني',  value: email,       setter: setEmail,       type: 'email', icon: '📧', placeholder: 'admin@company.com' },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate dir="rtl">
      <div style={{ marginBottom: '26px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f0c29', marginBottom: '6px', letterSpacing: '-0.3px' }}>
          أنشئ حسابك الآن
        </h2>
        <p style={{ fontSize: '13px', color: '#7c6fa0', lineHeight: 1.6 }}>
          تجربة مجانية 7 أيام — لا تحتاج بطاقة ائتمان
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '14px' }}>
        {fields.map((f) => {
          const [focused, setFocused] = [false, (_v: boolean) => {}];
          return (
            <div key={f.id}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#3b2d6e', marginBottom: '6px' }}>
                {f.label}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>
                  {f.icon}
                </span>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={(e) => f.setter(e.target.value)}
                  placeholder={f.placeholder}
                  required
                  className="lp-input"
                  style={{ ...inputStyle(focused), paddingRight: '42px' }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  dir={f.id === 'email' ? 'ltr' : 'rtl'}
                />
              </div>
            </div>
          );
        })}

        {/* Password */}
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#3b2d6e', marginBottom: '6px' }}>
            كلمة المرور
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>
              🔑
            </span>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="مثال: MyPass@2024"
              required
              className="lp-input"
              style={{ ...inputStyle(false), paddingRight: '42px', paddingLeft: '44px', direction: 'ltr' }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              tabIndex={-1}
              style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', color: '#c4b5fd', lineHeight: 1 }}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#3b2d6e', marginBottom: '6px' }}>
            تأكيد كلمة المرور
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)', fontSize: '15px', pointerEvents: 'none' }}>
              ✅
            </span>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="أعد كتابة كلمة المرور"
              required
              className="lp-input"
              style={{ ...inputStyle(false), paddingRight: '42px', direction: 'ltr' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          ref={errorRef}
          style={{
            marginBottom: '14px',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '11px 14px',
            background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: '10px',
            fontSize: '13px', color: '#dc2626', fontWeight: 600,
          }}
        >
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="lp-btn-primary"
        style={{
          width: '100%', height: '50px', borderRadius: '14px', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: '15px', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 50%, #7c3aed 100%)',
          boxShadow: '0 6px 20px rgba(99,57,206,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginBottom: '16px', fontFamily: 'inherit',
        }}
      >
        {loading ? (
          <>
            <span className="lp-spinner" style={{ width: '18px', height: '18px', border: '2.5px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
            <span>جاري الإنشاء...</span>
          </>
        ) : (
          <span>إنشاء الحساب مجاناً ←</span>
        )}
      </button>

      <button
        type="button"
        onClick={onSwitch}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#7c6fa0', fontFamily: 'inherit', fontWeight: 600 }}
      >
        لديك حساب بالفعل؟ <span style={{ color: '#6d28d9', fontWeight: 800 }}>سجّل الدخول</span>
      </button>
    </form>
  );
}
