import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth';
import { useLocation } from 'wouter';
import { RegisterForm } from './login/RegisterForm';
import { api } from '@/lib/api';

/* ══════════════════════════════════════════════
   CSS — injected once, matches landing page
══════════════════════════════════════════════ */
const LOGIN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

.lp-login *, .lp-login *::before, .lp-login *::after { box-sizing: border-box; }

@keyframes ll-float {
  0%,100% { transform: translateY(0) scale(1);    opacity:.5; }
  50%      { transform: translateY(-20px) scale(1.1); opacity:.9; }
}
@keyframes ll-breathe {
  0%,100% { opacity: .04; }
  50%      { opacity: .10; }
}
@keyframes ll-gradient-pan {
  0%,100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
@keyframes ll-pulse {
  0%,100% { box-shadow: 0 0 32px rgba(245,158,11,.5), 0 8px 40px rgba(0,0,0,.4); }
  50%      { box-shadow: 0 0 64px rgba(245,158,11,.8), 0 16px 60px rgba(0,0,0,.5); }
}
@keyframes ll-slide-up {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:none; }
}
@keyframes ll-shake {
  0%,100% { transform:translateX(0); }
  20%     { transform:translateX(-8px); }
  40%     { transform:translateX(8px); }
  60%     { transform:translateX(-5px); }
  80%     { transform:translateX(5px); }
}
@keyframes ll-spin {
  to { transform: rotate(360deg); }
}
@keyframes ll-fade-in {
  from { opacity:0; } to { opacity:1; }
}
@keyframes ll-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}

.ll-input {
  width:100%; padding:15px 50px 15px 18px;
  border-radius:14px;
  background: rgba(255,255,255,.06);
  border: 1.5px solid rgba(255,255,255,.1);
  color:#fff; font-size:14.5px; font-family:Tajawal,sans-serif;
  outline:none; transition: border-color .25s, box-shadow .25s, background .25s;
  height:54px; direction:ltr;
}
.ll-input::placeholder { color: rgba(255,255,255,.28); direction:rtl; }
.ll-input:focus {
  border-color: rgba(245,158,11,.7);
  box-shadow: 0 0 0 4px rgba(245,158,11,.12);
  background: rgba(255,255,255,.09);
}
.ll-input:disabled { opacity:.5; cursor:not-allowed; }

.ll-input-rtl { direction:rtl !important; }

.ll-btn-primary {
  width:100%; height:54px; border-radius:14px; border:none; cursor:pointer;
  background: linear-gradient(135deg,#f59e0b,#f97316);
  color:#000; font-size:15px; font-weight:900; font-family:Tajawal,sans-serif;
  box-shadow: 0 0 28px rgba(245,158,11,.45), 0 8px 24px rgba(0,0,0,.3);
  transition: transform .2s, box-shadow .2s;
  display:flex; align-items:center; justify-content:center; gap:10px;
  position:relative; overflow:hidden;
}
.ll-btn-primary::after {
  content:''; position:absolute; inset:0;
  background: linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);
  background-size:200% 100%; background-position:-200% center; pointer-events:none;
}
.ll-btn-primary:hover:not(:disabled)::after { animation:ll-shimmer .5s ease forwards; }
.ll-btn-primary:hover:not(:disabled) {
  transform:translateY(-2px);
  box-shadow: 0 0 48px rgba(245,158,11,.65), 0 16px 40px rgba(0,0,0,.4);
}
.ll-btn-primary:disabled { opacity:.55; cursor:not-allowed; transform:none !important; }

.ll-tab {
  flex:1; padding:10px; border-radius:10px; border:none; cursor:pointer;
  font-size:13px; font-weight:700; font-family:Tajawal,sans-serif;
  transition: all .25s;
}
.ll-tab-active {
  background: rgba(245,158,11,.18);
  border: 1px solid rgba(245,158,11,.35);
  color:#f59e0b;
}
.ll-tab-inactive {
  background:transparent; border:1px solid transparent;
  color:rgba(255,255,255,.38);
}
.ll-tab-inactive:hover { color:rgba(255,255,255,.65); }

@media(max-width:900px) {
  .ll-brand-panel { display:none !important; }
  .ll-form-panel   { width:100% !important; }
}
`;

/* ══════════════════════════════════════════════
   Particles config
══════════════════════════════════════════════ */
const PARTICLES = [
  {top:'12%',left:'8%', s:4, d:'0s',   dur:'6.5s'},
  {top:'28%',left:'88%',s:6, d:'1.1s', dur:'8s'  },
  {top:'55%',left:'5%', s:3, d:'2s',   dur:'7s'  },
  {top:'75%',left:'80%',s:5, d:'.7s',  dur:'9s'  },
  {top:'20%',left:'62%',s:3, d:'3.2s', dur:'6s'  },
  {top:'42%',left:'92%',s:4, d:'1.8s', dur:'7.5s'},
  {top:'82%',left:'38%',s:6, d:'2.4s', dur:'8.5s'},
];

const LOGO_SRC = `${import.meta.env.BASE_URL}muhkam-logo-main.png`;

const FEATURES_LEFT = [
  { icon:'📊', label:'محاسبة كاملة', desc:'قيد مزدوج تلقائي' },
  { icon:'🛒', label:'مبيعات وPOS',  desc:'فواتير لحظية' },
  { icon:'🔧', label:'وحدة صيانة',  desc:'تتبع IMEI' },
  { icon:'👥', label:'موارد بشرية',  desc:'رواتب وحضور' },
];

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const defaultTab = new URLSearchParams(window.location.search).get('tab') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<'login' | 'register'>(defaultTab);

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [showPin, setShowPin]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<'username' | 'pin' | null>(null);

  /* 2FA state */
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken]     = useState('');
  const [totpCode, setTotpCode]       = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  /* Mouse parallax */
  const [mx, setMx] = useState(50);
  const [my, setMy] = useState(42);

  const usernameRef = useRef<HTMLInputElement>(null);
  const pinRef      = useRef<HTMLInputElement>(null);
  const errorRef    = useRef<HTMLDivElement>(null);

  /* Inject CSS */
  useEffect(() => {
    const s = document.createElement('style');
    s.id = 'muhkam-login-css';
    s.textContent = LOGIN_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  /* Mouse move */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMx((e.clientX / window.innerWidth)  * 100);
      setMy((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener('mousemove', onMove, { passive:true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    if (mode === 'login') setTimeout(() => usernameRef.current?.focus(), 400);
  }, [mode]);

  /* Shake error */
  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'll-shake .5s ease';
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

  const mono: React.CSSProperties = { fontFamily:'Tajawal,sans-serif' };

  /* ══ Brand left panel ══ */
  const BrandPanel = () => (
    <div className="ll-brand-panel" style={{
      width:'46%', minHeight:'100vh', position:'relative',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      overflow:'hidden', background:'#000',
      borderLeft:'1px solid rgba(255,255,255,.06)',
    }}>
      {/* Grid */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        backgroundImage:'linear-gradient(rgba(245,158,11,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.03) 1px,transparent 1px)',
        backgroundSize:'56px 56px', animation:'ll-breathe 7s ease-in-out infinite',
      }} />
      {/* Amber orb */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', transition:'background .3s ease',
        background:`radial-gradient(ellipse 70% 55% at ${mx}% ${my}%,rgba(245,158,11,.16) 0%,rgba(249,115,22,.07) 42%,transparent 68%)`,
      }} />
      {/* Indigo orb */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 50% 40% at ${100-mx}% ${100-my}%,rgba(99,102,241,.09) 0%,transparent 58%)`,
      }} />
      {/* Particles */}
      {PARTICLES.map((p, i) => (
        <div key={i} style={{
          position:'absolute', top:p.top, left:p.left, width:p.s, height:p.s,
          borderRadius:'50%', pointerEvents:'none',
          background: i%3===0 ? '#f59e0b' : i%3===1 ? '#f97316' : '#fbbf24',
          animation:`ll-float ${p.dur} ${p.d} ease-in-out infinite`,
        }} />
      ))}

      {/* Content */}
      <div style={{ position:'relative', zIndex:10, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'0 48px', maxWidth:420 }} dir="rtl">
        {/* Logo */}
        <img src={LOGO_SRC} alt="مُحكم" style={{
          width:108, height:108, borderRadius:24, objectFit:'cover', flexShrink:0,
          boxShadow:'0 0 60px rgba(245,158,11,.55), 0 20px 60px rgba(0,0,0,.5)',
          marginBottom:22, animation:'ll-pulse 3s ease-in-out infinite',
        }} />

        <div style={{ fontSize:30, fontWeight:900, color:'#fff', marginBottom:6, letterSpacing:'-.01em', animation:'ll-slide-up .7s ease both', ...mono }}>مُحكم ERP</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,.4)', marginBottom:48, lineHeight:1.7, animation:'ll-slide-up .75s .05s ease both', ...mono }}>نظام إدارة عربي متكامل<br/>لمستقبل أكثر ذكاءً</div>

        {/* Feature cards 2×2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, width:'100%' }}>
          {FEATURES_LEFT.map((f, i) => (
            <div key={f.label} style={{
              background:'rgba(255,255,255,.04)', backdropFilter:'blur(20px)',
              border:'1px solid rgba(255,255,255,.08)', borderRadius:16, padding:'16px 14px',
              textAlign:'center', transition:'all .25s', cursor:'default',
              animation:`ll-slide-up .8s ${.1+i*.07}s ease both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(245,158,11,.08)'; e.currentTarget.style.borderColor='rgba(245,158,11,.25)'; e.currentTarget.style.transform='translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,.08)'; e.currentTarget.style.transform='translateY(0)'; }}
            >
              <div style={{ fontSize:26, marginBottom:7, filter:'drop-shadow(0 3px 8px rgba(245,158,11,.5))' }}>{f.icon}</div>
              <div style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,.85)', ...mono, lineHeight:1.3 }}>{f.label}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', marginTop:3, ...mono }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div style={{ marginTop:36, display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
          {['✓ 7 أيام مجاناً','✓ دعم عربي 24/7','✓ بدون بطاقة'].map(t => (
            <span key={t} style={{ fontSize:11, color:'rgba(255,255,255,.28)', fontWeight:600, ...mono }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Version badge */}
      <div style={{ position:'absolute', bottom:22, fontSize:11, color:'rgba(255,255,255,.18)', letterSpacing:'.15em', fontWeight:600 }}>
        MUHKAM ERP v2.0 · القاهرة، مصر
      </div>
    </div>
  );

  /* ══ Form card ══ */
  const cardStyle: React.CSSProperties = {
    width:'100%', maxWidth:460,
    background:'rgba(255,255,255,.05)',
    backdropFilter:'blur(32px)',
    borderRadius:28, border:'1px solid rgba(255,255,255,.1)',
    boxShadow:'0 0 0 1px rgba(245,158,11,.06), 0 40px 100px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08)',
    padding:'38px 36px',
  };

  const labelStyle: React.CSSProperties = {
    display:'block', fontSize:12.5, fontWeight:700,
    color:'rgba(255,255,255,.55)', marginBottom:7, ...mono,
  };

  /* ══ RENDER ══ */
  return (
    <div className="lp-login" dir="rtl" style={{
      minHeight:'100vh', display:'flex', flexDirection:'row',
      background:'#000', fontFamily:'Tajawal,sans-serif',
    }}>
      {/* Form panel */}
      <div className="ll-form-panel" style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'40px 24px', minHeight:'100vh', position:'relative', overflow:'hidden',
      }}>
        {/* Subtle grid */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)',
          backgroundSize:'48px 48px',
        }} />
        {/* Amber glow */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 60% 50% at 50% 50%,rgba(245,158,11,.07) 0%,transparent 65%)' }} />

        {/* Mobile logo (hidden on desktop) */}
        <div className="ll-brand-panel" style={{ display:'none' }} />
        <div style={{
          display:'none', flexDirection:'column', alignItems:'center', marginBottom:32,
          animation:'ll-slide-up .6s ease both',
        }}>
          <img src={LOGO_SRC} alt="مُحكم" style={{ width:58, height:58, borderRadius:16, objectFit:'cover', boxShadow:'0 0 28px rgba(245,158,11,.45)', marginBottom:10 }} />
          <div style={{ fontSize:18, fontWeight:900, color:'#fff', ...mono }}>مُحكم ERP</div>
        </div>

        {/* Card */}
        <div style={{ ...cardStyle, position:'relative', zIndex:10, animation:'ll-slide-up .65s .08s ease both' }}>

          {/* ─── 2FA STEP ─── */}
          {requires2FA ? (
            <form onSubmit={handleTotpSubmit} noValidate aria-label="نموذج التحقق الثنائي">
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <div style={{ fontSize:48, marginBottom:14 }}>🔐</div>
                <h2 style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:8, ...mono }}>التحقق الثنائي</h2>
                <p style={{ fontSize:13, color:'rgba(255,255,255,.42)', lineHeight:1.7, ...mono }}>
                  افتح <strong style={{ color:'rgba(255,255,255,.65)' }}>Google Authenticator</strong> أو <strong style={{ color:'rgba(255,255,255,.65)' }}>Authy</strong>
                  <br />وأدخل الرمز المكون من 6 أرقام
                </p>
              </div>

              {error && (
                <div ref={errorRef} role="alert" aria-live="polite" style={{
                  padding:'11px 14px', borderRadius:12, marginBottom:16,
                  background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)',
                  color:'#f87171', fontSize:13, fontWeight:700, textAlign:'center', ...mono,
                }}>{error}</div>
              )}

              <input
                value={totpCode}
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6)); setError(''); }}
                onKeyDown={e => { if (e.key==='Enter' && totpCode.length===6) void handleTotpSubmit(e as unknown as React.FormEvent); }}
                placeholder="• • • • • •"
                inputMode="numeric"
                autoFocus
                aria-label="رمز التحقق الثنائي"
                style={{
                  width:'100%', padding:'16px', borderRadius:14,
                  border:`1.5px solid ${totpCode.length===6?'rgba(245,158,11,.6)':'rgba(255,255,255,.12)'}`,
                  fontSize:30, letterSpacing:16, textAlign:'center', fontFamily:'monospace',
                  color:'#fff', background:'rgba(255,255,255,.06)', outline:'none',
                  boxSizing:'border-box', marginBottom:16, transition:'border-color .25s',
                }}
                maxLength={6}
              />
              <button type="submit" disabled={totpLoading || totpCode.length!==6} className="ll-btn-primary" style={{ marginBottom:12 }}>
                {totpLoading
                  ? <><span style={{ width:18,height:18,border:'2.5px solid rgba(0,0,0,.25)',borderTopColor:'#000',borderRadius:'50%',display:'inline-block',animation:'ll-spin .7s linear infinite' }} /><span style={{ ...mono }}>جاري التحقق...</span></>
                  : <span style={{ ...mono }}>تحقق ←</span>}
              </button>
              <button type="button" onClick={() => { setRequires2FA(false); setTempToken(''); setTotpCode(''); setError(''); setPin(''); }} style={{
                width:'100%', padding:'10px', borderRadius:12,
                border:'1px solid rgba(255,255,255,.1)', background:'transparent',
                color:'rgba(255,255,255,.4)', fontSize:13, fontWeight:700, cursor:'pointer', ...mono,
                transition:'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,.7)'; e.currentTarget.style.borderColor='rgba(255,255,255,.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,.4)'; e.currentTarget.style.borderColor='rgba(255,255,255,.1)'; }}
              >← رجوع</button>
            </form>
          ) : (
            <>
              {/* Logo inside card (mobile) + heading */}
              <div style={{ textAlign:'center', marginBottom:26 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:14 }}>
                  <img src={LOGO_SRC} alt="مُحكم" style={{ width:38, height:38, borderRadius:11, objectFit:'cover', boxShadow:'0 0 20px rgba(245,158,11,.45)' }} />
                  <div style={{ fontWeight:900, fontSize:18, color:'#fff', ...mono }}>مُحكم ERP</div>
                </div>
                <h1 style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4, ...mono }}>
                  {mode==='login' ? 'أهلاً بعودتك' : 'إنشاء حساب جديد'}
                </h1>
                <p style={{ fontSize:13, color:'rgba(255,255,255,.38)', ...mono }}>
                  {mode==='login' ? 'سجّل دخولك للمتابعة' : 'تجربة مجانية 7 أيام — بلا بطاقة'}
                </p>
              </div>

              {/* Tab toggle */}
              <div style={{
                display:'flex', background:'rgba(255,255,255,.05)',
                borderRadius:14, padding:'4px', marginBottom:28, gap:4,
                border:'1px solid rgba(255,255,255,.08)',
              }}>
                {(['login','register'] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); setError(''); }} className={`ll-tab ${mode===m?'ll-tab-active':'ll-tab-inactive'}`}>
                    {m==='login' ? 'تسجيل الدخول' : 'مستخدم جديد'}
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
                /* Login form */
                <LoginFormFields
                  username={username} setUsername={setUsername}
                  pin={pin} setPin={setPin}
                  showPin={showPin} setShowPin={setShowPin}
                  focused={focused} setFocused={setFocused}
                  error={error} setError={setError}
                  loading={loading}
                  usernameRef={usernameRef} pinRef={pinRef} errorRef={errorRef}
                  handleSubmit={handleSubmit}
                  labelStyle={labelStyle}
                  mono={mono}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ position:'relative', zIndex:10, marginTop:22, fontSize:11, color:'rgba(255,255,255,.18)', letterSpacing:'.12em', textAlign:'center', animation:'ll-fade-in 1s .5s ease both', opacity:0 }}>
          © 2026 مُحكم ERP · جميع الحقوق محفوظة
        </div>
      </div>

      {/* Brand panel */}
      <BrandPanel />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Login form sub-component (keeps render clean)
═══════════════════════════════════════════════ */
function LoginFormFields({
  username, setUsername, pin, setPin,
  showPin, setShowPin, focused, setFocused,
  error, setError, loading,
  usernameRef, pinRef, errorRef,
  handleSubmit, labelStyle, mono,
}: {
  username:string; setUsername:(v:string)=>void;
  pin:string; setPin:(v:string)=>void;
  showPin:boolean; setShowPin:(v:boolean)=>void;
  focused:'username'|'pin'|null; setFocused:(v:'username'|'pin'|null)=>void;
  error:string; setError:(v:string)=>void;
  loading:boolean;
  usernameRef:React.RefObject<HTMLInputElement|null>; pinRef:React.RefObject<HTMLInputElement|null>; errorRef:React.RefObject<HTMLDivElement|null>;
  handleSubmit:(e:React.FormEvent)=>Promise<void>;
  labelStyle:React.CSSProperties; mono:React.CSSProperties;
}) {
  return (
    <form onSubmit={handleSubmit} noValidate aria-label="نموذج تسجيل الدخول">
      {/* Username */}
      <div style={{ marginBottom:18 }}>
        <label htmlFor="username" style={labelStyle}>اسم المستخدم أو البريد الإلكتروني</label>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', top:'50%', right:16, transform:'translateY(-50%)', fontSize:16, pointerEvents:'none' }}>👤</span>
          <input
            ref={usernameRef}
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            placeholder="admin"
            disabled={loading}
            className={`ll-input ll-input-rtl${focused==='username'?' ll-focused':''}`}
            style={{ paddingRight:48, direction:'ltr', textAlign:'right' }}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            onFocus={() => setFocused('username')}
            onBlur={() => setFocused(null)}
            aria-label="اسم المستخدم أو البريد الإلكتروني"
            aria-describedby="login-error"
          />
        </div>
      </div>

      {/* PIN */}
      <div style={{ marginBottom:24 }}>
        <label style={labelStyle}>الرقم السري</label>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', top:'50%', right:16, transform:'translateY(-50%)', fontSize:16, pointerEvents:'none' }}>🔒</span>
          <input
            ref={pinRef}
            id="pin"
            type={showPin ? 'text' : 'password'}
            autoComplete="current-password"
            value={pin}
            placeholder="••••••"
            disabled={loading}
            className="ll-input"
            style={{
              paddingRight:48, paddingLeft:48, direction:'ltr',
              letterSpacing: pin && !showPin ? '.35em' : 'normal',
            }}
            onChange={e => { setPin(e.target.value); setError(''); }}
            onFocus={() => setFocused('pin')}
            onBlur={() => setFocused(null)}
            aria-label="الرقم السري"
            aria-describedby="login-error"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPin(!showPin)}
            style={{ position:'absolute', top:'50%', left:16, transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'rgba(255,255,255,.35)', padding:2, lineHeight:1, transition:'color .2s' }}
            onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.65)'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}
            title={showPin ? 'إخفاء' : 'إظهار'}
          >{showPin ? '🙈' : '👁'}</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div id="login-error" role="alert" aria-live="polite" ref={errorRef} style={{
          marginBottom:18, display:'flex', alignItems:'center', gap:10,
          padding:'12px 16px', background:'rgba(239,68,68,.1)',
          border:'1px solid rgba(239,68,68,.25)', borderRadius:12,
          fontSize:13, color:'#f87171', fontWeight:600, ...mono,
        }}>
          <span style={{ flexShrink:0 }}>⚠️</span><span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={loading} className="ll-btn-primary" style={{ marginBottom:20 }}>
        {loading
          ? <><span style={{ width:20,height:20,border:'2.5px solid rgba(0,0,0,.25)',borderTopColor:'#000',borderRadius:'50%',display:'inline-block',animation:'ll-spin .7s linear infinite' }} /><span style={{ ...mono }}>جاري التحقق...</span></>
          : <span style={{ ...mono }}>دخول آمن ←</span>}
      </button>

      {/* Register link */}
      <div style={{ textAlign:'center' }}>
        <span style={{ fontSize:13, color:'rgba(255,255,255,.3)', ...mono }}>ليس لديك حساب؟ </span>
        <button type="button" style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'#f59e0b', fontWeight:800, padding:0, ...mono, transition:'color .2s' }}
          onMouseEnter={e => e.currentTarget.style.color='#fbbf24'}
          onMouseLeave={e => e.currentTarget.style.color='#f59e0b'}
          onClick={() => { /* switch to register tab handled by parent */ window.history.pushState({}, '', '/login?tab=register'); window.dispatchEvent(new Event('popstate')); location.href='/login?tab=register'; }}
        >ابدأ مجاناً ←</button>
      </div>
    </form>
  );
}

export { RegisterForm } from './login/RegisterForm';
