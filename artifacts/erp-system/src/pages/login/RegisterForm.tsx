import { useState, useEffect, useRef } from 'react';

const BASE_REGISTER = import.meta.env.BASE_URL.replace(/\/$/, '');
const apiReg = (p: string) => `${BASE_REGISTER}${p}`;

interface RegisterFormProps {
  onSuccess: (
    user: { id:number; name:string; username:string; role:string; active?:boolean; warehouse_id?:number|null; safe_id?:number|null; permissions?:Record<string,boolean>; },
    companyId: number
  ) => void;
  onSwitch: () => void;
}

/* Password strength */
function pwStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { score:0, label:'',        color:'transparent' },
    { score:1, label:'ضعيفة',   color:'#ef4444' },
    { score:2, label:'متوسطة',  color:'#f97316' },
    { score:3, label:'جيدة',    color:'#eab308' },
    { score:4, label:'قوية',    color:'#22c55e' },
  ];
  return map[score];
}

export function RegisterForm({ onSuccess, onSwitch }: RegisterFormProps) {
  const [companyName, setCompanyName] = useState('');
  const [adminName,   setAdminName]   = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [createdUsername, setCreatedUsername] = useState('');
  const [focusedField, setFocusedField] = useState<string|null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const mono: React.CSSProperties = { fontFamily:'Tajawal,sans-serif' };

  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'll-shake .5s ease';
  }, [error]);

  const strength = pwStrength(password);

  const inputStyle = (fieldId: string): React.CSSProperties => ({
    width:'100%', padding:'13px 46px 13px 16px',
    borderRadius:12,
    border:`1.5px solid ${focusedField===fieldId ? 'rgba(245,158,11,.6)' : 'rgba(255,255,255,.1)'}`,
    fontSize:13.5, color:'#fff', background:'rgba(255,255,255,.06)',
    fontFamily:'Tajawal,sans-serif', outline:'none', height:48, boxSizing:'border-box',
    transition:'border-color .25s, box-shadow .25s, background .25s',
    boxShadow: focusedField===fieldId ? '0 0 0 3px rgba(245,158,11,.12)' : 'none',
  });

  const labelStyle: React.CSSProperties = {
    display:'block', fontSize:12, fontWeight:700,
    color:'rgba(255,255,255,.48)', marginBottom:6, ...mono,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim())          { setError('اسم الشركة مطلوب'); return; }
    if (!adminName.trim())            { setError('اسم المسؤول مطلوب'); return; }
    if (!email.includes('@'))         { setError('بريد إلكتروني صحيح مطلوب'); return; }
    if (password.length < 8)          { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return; }
    if (!/[A-Z]/.test(password))      { setError('يجب أن تحتوي كلمة المرور على حرف كبير'); return; }
    if (!/[0-9]/.test(password))      { setError('يجب أن تحتوي كلمة المرور على رقم'); return; }
    if (!/[^A-Za-z0-9]/.test(password)){ setError('يجب أن تحتوي كلمة المرور على رمز خاص'); return; }
    if (password !== confirmPw)        { setError('كلمتا المرور غير متطابقتين'); return; }

    setLoading(true);
    try {
      const res = await fetch(apiReg('/api/auth/register'), {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ company_name:companyName, admin_name:adminName, email, password }),
        credentials:'include',
      });
      const data = await res.json().catch(() => ({})) as Record<string,unknown>;
      if (!res.ok) { setError(String(data.error || 'فشل إنشاء الحساب')); return; }

      const userData = (data.user ?? {}) as { id:number; name:string; username:string; role:string; active?:boolean; warehouse_id?:number|null; safe_id?:number|null; permissions?:Record<string,boolean>; };
      const companyData = (data.company ?? {}) as { id:number };
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
      <div style={{ textAlign:'center', padding:'28px 0' }} dir="rtl">
        <div style={{ fontSize:52, marginBottom:14 }}>🎉</div>
        <h3 style={{ fontSize:20, fontWeight:900, color:'#fff', marginBottom:10, ...mono }}>تم إنشاء حسابك بنجاح!</h3>
        {createdUsername && (
          <div style={{ margin:'14px auto', maxWidth:300, padding:'14px 18px', borderRadius:14, background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.28)' }}>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.45)', fontWeight:700, marginBottom:4, ...mono }}>اسم المستخدم الخاص بك</p>
            <p style={{ fontSize:17, fontWeight:900, color:'#f59e0b', letterSpacing:'.5px', direction:'ltr' }}>{createdUsername}</p>
            <p style={{ fontSize:10, color:'rgba(255,255,255,.3)', marginTop:4, ...mono }}>احتفظ به — ستحتاجه لتسجيل الدخول</p>
          </div>
        )}
        <p style={{ fontSize:13, color:'rgba(255,255,255,.38)', ...mono }}>جاري تسجيل الدخول...</p>
      </div>
    );
  }

  const fields = [
    { id:'company', label:'اسم الشركة',        value:companyName, setter:setCompanyName, type:'text',  icon:'🏢', placeholder:'شركة المليجي للتجارة', dir:'rtl' },
    { id:'admin',   label:'اسم المسؤول',        value:adminName,   setter:setAdminName,   type:'text',  icon:'👤', placeholder:'صالح محمد', dir:'rtl' },
    { id:'email',   label:'البريد الإلكتروني',  value:email,       setter:setEmail,       type:'email', icon:'📧', placeholder:'admin@company.com', dir:'ltr' },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate dir="rtl">
      <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:14 }}>
        {fields.map(f => (
          <div key={f.id}>
            <label style={labelStyle}>{f.label}</label>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', top:'50%', right:14, transform:'translateY(-50%)', fontSize:14, pointerEvents:'none' }}>{f.icon}</span>
              <input
                type={f.type}
                value={f.value}
                onChange={e => { f.setter(e.target.value); setError(''); }}
                placeholder={f.placeholder}
                required
                style={{ ...inputStyle(f.id), paddingRight:44, direction: f.dir as 'rtl'|'ltr' }}
                onFocus={() => setFocusedField(f.id)}
                onBlur={() => setFocusedField(null)}
              />
            </div>
          </div>
        ))}

        {/* Password */}
        <div>
          <label style={labelStyle}>كلمة المرور</label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', top:'50%', right:14, transform:'translateY(-50%)', fontSize:14, pointerEvents:'none' }}>🔑</span>
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="مثال: MyPass@2024"
              required
              style={{ ...inputStyle('password'), paddingRight:44, paddingLeft:44, direction:'ltr' }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
              style={{ position:'absolute', top:'50%', left:14, transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'rgba(255,255,255,.35)', lineHeight:1, transition:'color .2s' }}
              onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.65)'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}
            >{showPw ? '🙈' : '👁'}</button>
          </div>
          {/* Strength indicator */}
          {password && (
            <div style={{ marginTop:6 }}>
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i<=strength.score ? strength.color : 'rgba(255,255,255,.1)', transition:'background .3s' }} />
                ))}
              </div>
              {strength.label && <div style={{ fontSize:10, color:strength.color, marginTop:3, fontWeight:700, ...mono }}>{strength.label}</div>}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label style={labelStyle}>تأكيد كلمة المرور</label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', top:'50%', right:14, transform:'translateY(-50%)', fontSize:14, pointerEvents:'none' }}>
              {confirmPw && confirmPw===password ? '✅' : '🔒'}
            </span>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setError(''); }}
              placeholder="أعد كتابة كلمة المرور"
              required
              style={{ ...inputStyle('confirm'), paddingRight:44, direction:'ltr', borderColor: confirmPw && confirmPw!==password ? 'rgba(239,68,68,.5)' : focusedField==='confirm' ? 'rgba(245,158,11,.6)' : 'rgba(255,255,255,.1)' }}
              onFocus={() => setFocusedField('confirm')}
              onBlur={() => setFocusedField(null)}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div ref={errorRef} style={{
          marginBottom:14, display:'flex', alignItems:'center', gap:8,
          padding:'10px 14px', background:'rgba(239,68,68,.1)',
          border:'1px solid rgba(239,68,68,.25)', borderRadius:10,
          fontSize:12.5, color:'#f87171', fontWeight:600, ...mono,
        }}>
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={loading} className="ll-btn-primary" style={{ marginBottom:14 }}>
        {loading
          ? <><span style={{ width:18,height:18,border:'2.5px solid rgba(0,0,0,.25)',borderTopColor:'#000',borderRadius:'50%',display:'inline-block',animation:'ll-spin .7s linear infinite' }} /><span style={{ ...mono }}>جاري الإنشاء...</span></>
          : <span style={{ ...mono }}>إنشاء الحساب مجاناً ←</span>}
      </button>

      {/* Switch to login */}
      <div style={{ textAlign:'center' }}>
        <span style={{ fontSize:12.5, color:'rgba(255,255,255,.3)', ...mono }}>لديك حساب بالفعل؟ </span>
        <button type="button" onClick={onSwitch} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12.5, color:'#f59e0b', fontWeight:800, padding:0, ...mono, transition:'color .2s' }}
          onMouseEnter={e => e.currentTarget.style.color='#fbbf24'}
          onMouseLeave={e => e.currentTarget.style.color='#f59e0b'}
        >سجّل الدخول</button>
      </div>
    </form>
  );
}
