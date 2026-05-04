import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

/* ══════════════════════════════════════════════
   CSS — all keyframes + utility classes
══════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@keyframes lp-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes lp-float {
  0%,100% { transform: translateY(0)   scale(1);   opacity:.45; }
  50%      { transform: translateY(-22px) scale(1.12); opacity:.85; }
}
@keyframes lp-gradient-pan {
  0%,100% { background-position:0%   50%; }
  50%     { background-position:100% 50%; }
}
@keyframes lp-pulse-glow {
  0%,100% { box-shadow:0 0 28px rgba(245,158,11,.45),0 8px 32px rgba(0,0,0,.3); }
  50%     { box-shadow:0 0 60px rgba(245,158,11,.75),0 16px 48px rgba(0,0,0,.4); }
}
@keyframes lp-ping {
  0%        { transform:scale(1);   opacity:.55; }
  70%,100%  { transform:scale(2.2); opacity:0;   }
}
@keyframes lp-marquee {
  from { transform:translateX(0); }
  to   { transform:translateX(-50%); }
}
@keyframes lp-bar-grow {
  from { transform:scaleY(0); }
  to   { transform:scaleY(1); }
}
@keyframes lp-slide-up {
  from { opacity:0; transform:translateY(36px); }
  to   { opacity:1; transform:none; }
}
@keyframes lp-spin-slow {
  to { transform:rotate(360deg); }
}
@keyframes lp-breathe {
  0%,100% { opacity:.06; }
  50%     { opacity:.12; }
}

/* Scroll-reveal */
.lp-fade { opacity:0; transform:translateY(32px); transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1); }
.lp-fade.lp-in { opacity:1; transform:none; }
.lp-d1{transition-delay:.05s}.lp-d2{transition-delay:.13s}.lp-d3{transition-delay:.21s}
.lp-d4{transition-delay:.29s}.lp-d5{transition-delay:.37s}.lp-d6{transition-delay:.45s}
.lp-d7{transition-delay:.53s}.lp-d8{transition-delay:.61s}.lp-d9{transition-delay:.69s}

/* Shimmer sweep */
.lp-shim { position:relative; overflow:hidden; }
.lp-shim::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.22) 50%,transparent 65%);
  background-size:200% 100%; background-position:-200% center;
}
.lp-shim:hover::after { animation:lp-shimmer .55s ease forwards; }

/* Feature cards */
.lp-card {
  transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s ease,border-color .3s ease;
  cursor:default;
}
.lp-card:hover {
  transform:translateY(-8px);
  box-shadow:0 0 0 1px rgba(245,158,11,.35),0 24px 64px rgba(245,158,11,.1),inset 0 0 80px rgba(245,158,11,.03);
  border-color:rgba(245,158,11,.38) !important;
}

/* Chart bars */
.lp-bar { transform-origin:bottom; animation:lp-bar-grow 1.2s cubic-bezier(.34,1.56,.64,1) both; animation-play-state:paused; }
.lp-chart-live .lp-bar { animation-play-state:running; }

/* Stats count-in */
@keyframes lp-count-in {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:none; }
}
.lp-stat-num { display:inline-block; animation:lp-count-in .6s ease both; animation-play-state:paused; }
.lp-stats-live .lp-stat-num { animation-play-state:running; }

/* Responsive */
@media(max-width:768px){
  .lp-nav-links,.lp-nav-btns { display:none !important; }
  .lp-hamburger { display:flex !important; }
  .lp-grid-2,.lp-grid-3,.lp-grid-4 { grid-template-columns:1fr !important; }
  .lp-grid-bento { grid-template-columns:1fr 1fr !important; }
  .lp-span2,.lp-span3 { grid-column:span 1 !important; }
  .lp-hero-mockup { display:none !important; }
  .lp-spotlight { grid-template-columns:1fr !important; }
}
@media(min-width:769px){
  .lp-hamburger { display:none !important; }
}
`;

/* ══════════════════════════════════════════════
   Static data
══════════════════════════════════════════════ */
const BENTO: {
  icon: string; title: string; desc: string;
  grad: string; accent: string; tags?: string[];
  wide?: boolean; full?: boolean;
}[] = [
  { icon:'📊', title:'المحاسبة الكاملة', desc:'قيد مزدوج تلقائي، ميزانية عمومية، تقارير مالية، مراكز التكلفة',
    grad:'linear-gradient(135deg,rgba(99,102,241,.14),rgba(168,85,247,.07))', accent:'#6366f1', wide:true },
  { icon:'🛒', title:'المبيعات ونقطة البيع', desc:'فواتير سريعة، POS متكامل، خصومات وعروض',
    grad:'linear-gradient(135deg,rgba(245,158,11,.13),rgba(249,115,22,.07))', accent:'#f59e0b' },
  { icon:'📦', title:'إدارة المخزون', desc:'تتبع الكميات، تنبيهات النفاد، جرد دوري',
    grad:'linear-gradient(135deg,rgba(16,185,129,.13),rgba(5,150,105,.07))', accent:'#10b981' },
  { icon:'👥', title:'الموارد البشرية', desc:'الرواتب، الحضور، الإجازات، ملفات الموظفين الكاملة',
    grad:'linear-gradient(135deg,rgba(59,130,246,.14),rgba(99,102,241,.07))', accent:'#3b82f6', wide:true },
  { icon:'🔧', title:'وحدة الصيانة', desc:'بطاقات IMEI، تتبع الأجهزة، إشعارات WhatsApp',
    grad:'linear-gradient(135deg,rgba(239,68,68,.13),rgba(220,38,38,.07))', accent:'#ef4444' },
  { icon:'📈', title:'التقارير والتحليلات', desc:'لوحة تحكم تفاعلية، تقارير PDF، مؤشرات الأداء',
    grad:'linear-gradient(135deg,rgba(245,158,11,.13),rgba(251,191,36,.07))', accent:'#f59e0b' },
  { icon:'📱', title:'تطبيق موبايل لفريقك', desc:'iOS وAndroid — حضور GPS، بطاقات صيانة، فواتير في راحة يدك أينما كنت',
    grad:'linear-gradient(135deg,rgba(6,182,212,.13),rgba(99,102,241,.07))', accent:'#06b6d4',
    full:true, tags:['iOS','Android','حضور GPS','بطاقات صيانة','فواتير'] },
];

const STATS = [
  { end:500,  suffix:'+',  label:'شركة تثق بنا' },
  { end:99.9, suffix:'%',  label:'وقت التشغيل' },
  { end:7,    suffix:'',   label:'أيام تجريبية مجانية' },
  { end:24,   suffix:'/7', label:'دعم عربي متواصل' },
];

const TESTIMONIALS = [
  { q:'مُحكم حوّل طريقة عمل شركتي كلياً. الفواتير والمخزون والرواتب في مكان واحد بواجهة رائعة.',
    name:'أحمد الشهري', role:'مدير عام — شركة التقنية المتقدمة', av:'أ', c:'#f59e0b' },
  { q:'أفضل نظام ERP عربي استخدمته. واجهة نظيفة ودعم فني استثنائي على مدار الساعة.',
    name:'سارة العمري', role:'مديرة مالية — مجموعة الأندلس', av:'س', c:'#10b981' },
  { q:'وحدة الصيانة وحدها تستحق الاشتراك. تتبع كل جهاز وكل فني بدقة مذهلة.',
    name:'خالد الدوسري', role:'مدير تشغيل — تك كير للصيانة', av:'خ', c:'#6366f1' },
];

const TICKER = ['المحاسبة الكاملة','✦','المبيعات','✦','إدارة المخزون','✦',
  'الموارد البشرية','✦','وحدة الصيانة','✦','التقارير','✦',
  'تطبيق الموبايل','✦','المطابقة البنكية','✦','نقطة البيع POS','✦'];

const PARTICLES = [
  {top:'17%',left:'9%', s:4,d:'0s',  dur:'6.5s'},
  {top:'32%',left:'87%',s:6,d:'1.2s',dur:'8s'  },
  {top:'58%',left:'6%', s:3,d:'2.1s',dur:'7s'  },
  {top:'72%',left:'78%',s:5,d:'.6s', dur:'9s'  },
  {top:'21%',left:'64%',s:3,d:'3s',  dur:'6s'  },
  {top:'44%',left:'93%',s:4,d:'1.7s',dur:'7.5s'},
  {top:'80%',left:'42%',s:6,d:'2.5s',dur:'8.5s'},
  {top:'11%',left:'37%',s:3,d:'4s',  dur:'6.2s'},
];

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate]   = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mx, setMx]   = useState(50);
  const [my, setMy]   = useState(38);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const countDone = useRef(false);
  const statsEl   = useRef<HTMLDivElement>(null);
  const chartEl   = useRef<HTMLDivElement>(null);
  const obsRef    = useRef<IntersectionObserver | null>(null);

  /* Inject styles once */
  useEffect(() => {
    const s = document.createElement('style');
    s.id = 'muhkam-lp-css';
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  /* Scroll / mouse */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 52);
    const onMove   = (e: MouseEvent) => {
      setMx((e.clientX / window.innerWidth)  * 100);
      setMy((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener('scroll',    onScroll, { passive: true });
    window.addEventListener('mousemove', onMove,   { passive: true });
    return () => {
      window.removeEventListener('scroll',    onScroll);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  /* Count-up */
  const startCount = useCallback(() => {
    if (countDone.current) return;
    countDone.current = true;
    const targets = [500, 99.9, 7, 24];
    const dur     = 2200;
    const t0      = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCounts(targets.map(v => Number((v * e).toFixed(1))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  /* Intersection observers */
  useEffect(() => {
    /* Fade-in observer */
    obsRef.current = new IntersectionObserver(
      entries => entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('lp-in');
          obsRef.current?.unobserve(en.target);
        }
      }), { threshold: 0.1 }
    );
    document.querySelectorAll('.lp-fade').forEach(el => obsRef.current?.observe(el));

    /* Stats observer */
    const so = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { startCount(); en.target.classList.add('lp-stats-live'); so.unobserve(en.target); }
    }), { threshold: 0.4 });
    if (statsEl.current) so.observe(statsEl.current);

    /* Chart observer */
    const co = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('lp-chart-live'); co.unobserve(en.target); }
    }), { threshold: 0.3 });
    if (chartEl.current) co.observe(chartEl.current);

    return () => { obsRef.current?.disconnect(); so.disconnect(); co.disconnect(); };
  }, [startCount]);

  const goLogin = () => navigate('/login');

  const scrollToId = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const fmtCount = (i: number) => {
    if (i === 1) return counts[i].toFixed(1);
    return String(Math.floor(counts[i]));
  };

  /* ── Shared style fragments ── */
  const S = {
    glass: {
      background: 'rgba(255,255,255,0.035)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.07)',
    } as React.CSSProperties,
    amberBtn: {
      padding: '14px 36px', borderRadius: 14, border: 'none', cursor: 'pointer',
      background: 'linear-gradient(135deg,#f59e0b,#f97316)',
      color: '#000', fontWeight: 900, fontFamily: 'inherit',
      animation: 'lp-pulse-glow 2.5s ease-in-out infinite',
      transition: 'transform .2s',
    } as React.CSSProperties,
    ghostBtn: {
      padding: '14px 36px', borderRadius: 14, cursor: 'pointer',
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
      color: '#fff', fontWeight: 700, fontFamily: 'inherit',
      backdropFilter: 'blur(10px)', transition: 'all .2s',
    } as React.CSSProperties,
  };

  return (
    <>
      {/* ──────────────────────────── NAVBAR ──────────────────────────── */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        transition:'all .4s cubic-bezier(.16,1,.3,1)',
        background: scrolled ? 'rgba(0,0,0,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(245,158,11,.12)' : '1px solid transparent',
      }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 28px', height:68, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:38, height:38, borderRadius:11,
              background:'linear-gradient(135deg,#f59e0b,#f97316)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:900, fontSize:20, color:'#000',
              boxShadow:'0 0 20px rgba(245,158,11,.45)',
            }}>م</div>
            <div>
              <div style={{ fontWeight:900, fontSize:19, lineHeight:1, color:'#fff', fontFamily:'Tajawal,sans-serif' }}>مُحكم</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.38)', lineHeight:1, marginTop:2 }}>نظام ERP عربي</div>
            </div>
          </div>

          {/* Desktop links */}
          <div className="lp-nav-links" style={{ display:'flex', alignItems:'center', gap:32 }}>
            {[['features','الميزات'],['pricing','الأسعار'],['testimonials','آراء العملاء']].map(([id,lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{
                color:'rgba(255,255,255,.5)', fontSize:14, fontWeight:600, textDecoration:'none',
                transition:'color .2s', cursor:'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.color='#fff'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.5)'}
              >{lbl}</a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="lp-nav-btns" style={{ display:'flex', gap:10 }}>
            <button onClick={goLogin} style={{
              padding:'9px 22px', borderRadius:11, border:'1px solid rgba(255,255,255,.14)',
              background:'transparent', color:'#fff', fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit', transition:'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,.5)'; e.currentTarget.style.color='#f59e0b'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.14)'; e.currentTarget.style.color='#fff'; }}
            >تسجيل الدخول</button>
            <button onClick={goLogin} className="lp-shim" style={{
              padding:'9px 22px', borderRadius:11, border:'none',
              background:'linear-gradient(135deg,#f59e0b,#f97316)',
              color:'#000', fontSize:13, fontWeight:900, cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 0 22px rgba(245,158,11,.4)', transition:'transform .2s, box-shadow .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.boxShadow='0 0 40px rgba(245,158,11,.65)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 0 22px rgba(245,158,11,.4)'; }}
            >ابدأ مجاناً ←</button>
          </div>

          {/* Hamburger */}
          <button className="lp-hamburger" onClick={() => setMenuOpen(v => !v)} style={{
            background:'none', border:'none', cursor:'pointer', color:'#fff', padding:8,
            display:'none', flexDirection:'column', gap:5,
          }}>
            {[
              { rotate: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' },
              { opacity: menuOpen ? '0' : '1' },
              { rotate: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' },
            ].map((s, i) => (
              <div key={i} style={{
                width:22, height:2, background:'#fff', borderRadius:2, transition:'all .3s',
                transform: (s as { rotate?: string }).rotate,
                opacity: (s as { opacity?: string }).opacity,
              }} />
            ))}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{
            background:'rgba(0,0,0,0.96)', backdropFilter:'blur(24px)',
            borderTop:'1px solid rgba(255,255,255,.07)', padding:'18px 28px',
            display:'flex', flexDirection:'column', gap:14,
          }}>
            {[['features','الميزات'],['pricing','الأسعار'],['testimonials','آراء العملاء']].map(([id,lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{
                color:'rgba(255,255,255,.7)', padding:'10px 0',
                borderBottom:'1px solid rgba(255,255,255,.06)', textDecoration:'none', fontSize:15, fontWeight:600,
              }}>{lbl}</a>
            ))}
            <button onClick={goLogin} style={{
              marginTop:4, padding:14, borderRadius:13,
              background:'linear-gradient(135deg,#f59e0b,#f97316)',
              color:'#000', fontWeight:900, fontSize:15, cursor:'pointer', border:'none', fontFamily:'inherit',
            }}>ابدأ تجربتك المجانية ←</button>
          </div>
        )}
      </nav>

      {/* ────────────────────────────── HERO ──────────────────────────── */}
      <section dir="rtl" style={{
        minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'108px 28px 72px', textAlign:'center',
        position:'relative', overflow:'hidden', background:'#000',
        fontFamily:'Tajawal,sans-serif',
      }}>
        {/* Mouse-parallax amber orb */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(ellipse 68% 54% at ${mx}% ${my}%, rgba(245,158,11,.14) 0%, rgba(249,115,22,.06) 42%, transparent 68%)`,
          transition:'background .25s ease',
        }} />
        {/* Counter-orb (cool indigo) */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:`radial-gradient(ellipse 50% 40% at ${100-mx}% ${100-my}%, rgba(99,102,241,.09) 0%, transparent 58%)`,
          transition:'background .4s ease',
        }} />
        {/* Animated grid */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(245,158,11,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.028) 1px,transparent 1px)',
          backgroundSize:'64px 64px',
          animation:'lp-breathe 6s ease-in-out infinite',
        }} />
        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position:'absolute', top:p.top, left:p.left,
            width:p.s, height:p.s, borderRadius:'50%', pointerEvents:'none',
            background: i%3===0 ? '#f59e0b' : i%3===1 ? '#f97316' : '#fbbf24',
            animation:`lp-float ${p.dur} ${p.d} ease-in-out infinite`,
          }} />
        ))}

        {/* ── Hero content ── */}
        <div style={{ position:'relative', zIndex:10, maxWidth:780, width:'100%' }}>
          {/* Shimmer pill badge */}
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'6px 20px', borderRadius:999,
            border:'1px solid rgba(245,158,11,.4)',
            background:'rgba(245,158,11,.08)',
            color:'#f59e0b', fontSize:13, fontWeight:700,
            marginBottom:32, position:'relative', overflow:'hidden',
            animation:'lp-slide-up .8s ease both',
          }}>
            <span style={{
              position:'absolute', inset:0,
              background:'linear-gradient(90deg,transparent,rgba(245,158,11,.22),transparent)',
              backgroundSize:'200% 100%', animation:'lp-shimmer 2.8s ease infinite',
            }} />
            <span style={{ position:'relative', zIndex:1 }}>✦ نظام ERP عربي #1</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize:'clamp(3rem,8.5vw,6.2rem)', fontWeight:900, lineHeight:1.08,
            marginBottom:24, letterSpacing:'-.02em',
            animation:'lp-slide-up .9s .08s ease both',
          }}>
            <span style={{ display:'block', color:'#fff' }}>أدِر شركتك</span>
            <span style={{
              display:'block',
              background:'linear-gradient(135deg,#f59e0b 0%,#f97316 38%,#ef4444 75%,#f59e0b 100%)',
              backgroundSize:'200% 200%',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              animation:'lp-gradient-pan 4s ease infinite',
            }}>بذكاء حقيقي</span>
          </h1>

          {/* Subtitle */}
          <p style={{
            color:'rgba(255,255,255,.52)', fontSize:'clamp(1rem,2vw,1.2rem)',
            lineHeight:1.75, maxWidth:560, margin:'0 auto 38px',
            animation:'lp-slide-up .95s .16s ease both',
          }}>
            مُحكم ERP — النظام الأول عربياً للمبيعات والمحاسبة والموارد البشرية والصيانة. كل ما تحتاجه في مكان واحد.
          </p>

          {/* CTA buttons */}
          <div style={{
            display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center', marginBottom:28,
            animation:'lp-slide-up 1s .24s ease both',
          }}>
            <button onClick={goLogin} className="lp-shim" style={{ ...S.amberBtn, fontSize:16 }}
              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.06) translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='scale(1) translateY(0)'; }}
            >ابدأ تجربتك المجانية ←</button>

            <button style={{ ...S.ghostBtn, fontSize:16 }}
              onClick={scrollToId('features') as unknown as React.MouseEventHandler<HTMLButtonElement>}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,.14)'; }}
            >شاهد كيف يعمل ↓</button>
          </div>

          {/* Trust line */}
          <div style={{
            display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'8px 22px',
            color:'rgba(255,255,255,.32)', fontSize:13,
            animation:'lp-slide-up 1s .32s ease both',
          }}>
            {['✓ 7 أيام مجاناً','✓ بدون بطاقة ائتمان','✓ دعم عربي 24/7'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>

        {/* ── Hero dashboard mockup ── */}
        <div className="lp-hero-mockup" ref={chartEl} style={{
          position:'relative', zIndex:10, marginTop:70, width:'100%', maxWidth:820,
          animation:'lp-slide-up 1.1s .45s ease both',
        }}>
          {/* Glow under card */}
          <div style={{
            position:'absolute', bottom:-50, left:'8%', right:'8%', height:120,
            background:'radial-gradient(ellipse,rgba(245,158,11,.3) 0%,transparent 70%)',
            filter:'blur(24px)', pointerEvents:'none',
          }} />
          {/* Card */}
          <div style={{
            background:'rgba(10,10,10,0.94)', borderRadius:22,
            border:'1px solid rgba(255,255,255,.07)',
            boxShadow:'0 0 0 1px rgba(255,255,255,.03),0 48px 140px rgba(0,0,0,.85)',
            overflow:'hidden',
          }}>
            {/* Window chrome */}
            <div style={{
              display:'flex', alignItems:'center', gap:8, padding:'11px 18px',
              background:'rgba(255,255,255,.025)', borderBottom:'1px solid rgba(255,255,255,.055)',
            }}>
              <div style={{ display:'flex', gap:6 }}>
                {['#ff5f57','#febc2e','#28c840'].map((c,i) => (
                  <div key={i} style={{ width:11, height:11, borderRadius:'50%', background:c }} />
                ))}
              </div>
              <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
                <div style={{ background:'rgba(255,255,255,.05)', borderRadius:7, padding:'3px 18px', fontSize:11, color:'rgba(255,255,255,.28)', fontFamily:'monospace' }}>
                  dashboard.muhkam.sa
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ display:'flex', height:290 }}>
              {/* Sidebar */}
              <div style={{ width:170, borderLeft:'1px solid rgba(255,255,255,.055)', padding:'16px 12px', display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#f59e0b,#f97316)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:'#000', flexShrink:0 }}>م</div>
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff', fontFamily:'Tajawal,sans-serif' }}>مُحكم ERP</span>
                </div>
                {([['🏠','لوحة التحكم',true],['💰','المبيعات',false],['📦','المخزون',false],['🔧','الصيانة',false],['👥','الموظفون',false]] as [string,string,boolean][]).map(([icon,lbl,active], i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:9,
                    background: active ? 'rgba(245,158,11,.15)' : 'transparent',
                    border: active ? '1px solid rgba(245,158,11,.22)' : '1px solid transparent',
                  }}>
                    <span style={{ fontSize:12 }}>{icon}</span>
                    <span style={{ fontSize:11, color: active ? '#f59e0b' : 'rgba(255,255,255,.32)', fontWeight: active ? 700 : 400, fontFamily:'Tajawal,sans-serif' }}>{lbl}</span>
                  </div>
                ))}
              </div>

              {/* Main area */}
              <div style={{ flex:1, padding:'18px 22px' }}>
                {/* KPI row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
                  {([['المبيعات','٨٥,٣٠٠','↑ ٢٣٪','#10b981'],['العملاء','١,٢٤٨','↑ ١٢٪','#3b82f6'],['الأرباح','٢٩,٤٠٠','↑ ١٨٪','#f59e0b']] as [string,string,string,string][]).map(([lbl,val,chg,clr]) => (
                    <div key={lbl} style={{ background:'rgba(255,255,255,.04)', borderRadius:11, border:'1px solid rgba(255,255,255,.055)', padding:'10px 13px' }}>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,.32)', marginBottom:4, fontFamily:'Tajawal,sans-serif' }}>{lbl}</div>
                      <div style={{ fontSize:16, fontWeight:900, color:'#fff', fontFamily:'Tajawal,sans-serif', marginBottom:2 }}>{val}</div>
                      <div style={{ fontSize:10, color:clr, fontWeight:700 }}>{chg}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, border:'1px solid rgba(255,255,255,.055)', padding:'13px 18px' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.28)', marginBottom:14, fontFamily:'Tajawal,sans-serif' }}>المبيعات — آخر 6 أشهر</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:9, height:92 }}>
                    {[42,65,52,78,60,95].map((h, i) => (
                      <div key={i} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                        <div className="lp-bar" style={{
                          width:'100%', height:`${h}%`, borderRadius:'5px 5px 0 0',
                          background: i===5
                            ? 'linear-gradient(to top,#f59e0b,#fbbf24)'
                            : `rgba(245,158,11,${0.18+i*.04})`,
                          animationDelay:`${i*.09}s`,
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position:'absolute', bottom:26, left:'50%', transform:'translateX(-50%)',
          display:'flex', flexDirection:'column', alignItems:'center', gap:6,
          animation:'lp-float 2.5s ease-in-out infinite',
        }}>
          <div style={{ width:1, height:44, background:'linear-gradient(to bottom,transparent,rgba(245,158,11,.55))', borderRadius:1 }} />
          <div style={{ fontSize:9, color:'rgba(255,255,255,.22)', letterSpacing:3 }}>SCROLL</div>
        </div>
      </section>

      {/* ────────────────────────── TICKER ──────────────────────────── */}
      <div style={{
        borderTop:'1px solid rgba(255,255,255,.055)',
        borderBottom:'1px solid rgba(255,255,255,.055)',
        background:'rgba(255,255,255,.018)',
        padding:'13px 0', overflow:'hidden',
      }}>
        <div style={{ display:'flex', gap:30, whiteSpace:'nowrap', animation:'lp-marquee 22s linear infinite', width:'max-content' }}>
          {[...TICKER,...TICKER,...TICKER].map((item, i) => (
            <span key={i} style={{
              fontSize:13, fontWeight:700,
              color: item==='✦' ? '#f59e0b' : 'rgba(255,255,255,.32)',
              fontFamily:'Tajawal,sans-serif',
            }}>{item}</span>
          ))}
        </div>
      </div>

      {/* ────────────────────────── STATS ──────────────────────────── */}
      <section dir="rtl" ref={statsEl} style={{
        background:'rgba(255,255,255,.018)',
        borderBottom:'1px solid rgba(255,255,255,.055)',
        padding:'72px 28px', fontFamily:'Tajawal,sans-serif',
      }}>
        <div className="lp-grid-4" style={{ maxWidth:940, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:28, textAlign:'center' }}>
          {STATS.map((s, i) => (
            <div key={i} className={`lp-fade lp-d${i+1}`}>
              <div style={{ fontSize:'clamp(2rem,5vw,3.8rem)', fontWeight:900, lineHeight:1, marginBottom:8 }}>
                <span className="lp-stat-num" style={{ color:'#f59e0b', animationDelay:`${i*.1}s` }}>
                  {fmtCount(i)}
                </span>
                <span style={{ color:'#f97316', fontSize:'0.7em' }}>{s.suffix}</span>
              </div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,.42)', fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────── BENTO FEATURES ─────────────────────── */}
      <section id="features" dir="rtl" style={{ padding:'110px 28px', background:'#000', fontFamily:'Tajawal,sans-serif' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div className="lp-fade" style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8, padding:'4px 18px', borderRadius:999,
              border:'1px solid rgba(255,255,255,.09)', background:'rgba(255,255,255,.04)',
              color:'rgba(255,255,255,.48)', fontSize:12, fontWeight:700, marginBottom:20,
            }}>كل ما تحتاجه</div>
            <h2 style={{ fontSize:'clamp(2rem,5.5vw,3.6rem)', fontWeight:900, color:'#fff', marginBottom:16, lineHeight:1.1 }}>
              نظام متكامل. منصة واحدة.
            </h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:17, maxWidth:480, margin:'0 auto' }}>
              من الفواتير إلى الرواتب — كل وحدة مترابطة بذكاء
            </p>
          </div>

          <div className="lp-grid-bento" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
            {BENTO.map((f, i) => (
              <div key={i}
                className={`lp-card lp-fade lp-d${(i%6)+1}`}
                style={{
                  ...S.glass,
                  background: f.grad,
                  borderRadius:20, padding:28,
                  gridColumn: f.full ? '1/-1' : f.wide ? 'span 2' : 'span 1',
                }}
              >
                <div style={{ fontSize: f.full ? 38 : 30, marginBottom:14 }}>{f.icon}</div>
                <h3 style={{ fontSize: f.full ? 22 : 17, fontWeight:800, color:'#fff', marginBottom:8 }}>{f.title}</h3>
                <p style={{ fontSize:13, color:'rgba(255,255,255,.48)', lineHeight:1.7 }}>{f.desc}</p>
                {f.tags && (
                  <div style={{ marginTop:18, display:'flex', gap:8, flexWrap:'wrap' }}>
                    {f.tags.map(tag => (
                      <span key={tag} style={{
                        padding:'4px 13px', borderRadius:999,
                        background:`rgba(6,182,212,.14)`, border:'1px solid rgba(6,182,212,.28)',
                        color:'#06b6d4', fontSize:12, fontWeight:700,
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
                {/* Accent glow dot */}
                <div style={{
                  position:'absolute', bottom:0, left:0, width:'100%', height:'100%',
                  borderRadius:20, pointerEvents:'none', overflow:'hidden',
                  background:`radial-gradient(ellipse 60% 40% at 90% 110%,${f.accent}18,transparent 70%)`,
                }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── FEATURE SPOTLIGHT ─────────────────────── */}
      <section dir="rtl" style={{ padding:'80px 28px', background:'rgba(255,255,255,.012)', fontFamily:'Tajawal,sans-serif' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', flexDirection:'column', gap:110 }}>

          {/* Row 1: Repair (mockup right in RTL, text left) */}
          <div className="lp-spotlight lp-fade" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>
            {/* Text */}
            <div>
              <div style={{
                display:'inline-block', padding:'3px 13px', borderRadius:999,
                background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.22)',
                color:'#ef4444', fontSize:12, fontWeight:700, marginBottom:18,
              }}>🔧 وحدة الصيانة</div>
              <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.9rem)', fontWeight:900, color:'#fff', marginBottom:16, lineHeight:1.18 }}>
                تتبع كل جهاز.<br/>كل فني. كل لحظة.
              </h2>
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:15, lineHeight:1.85, marginBottom:26 }}>
                بطاقات صيانة كاملة مع تتبع IMEI، تعيين الفنيين، حالات متعددة، وتقارير PDF احترافية.
              </p>
              <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:12 }}>
                {['تتبع IMEI والسيريال','إشعارات WhatsApp تلقائية','بطاقات QR للعملاء','لوحة فنيين متكاملة'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.72)' }}>
                    <span style={{
                      width:22, height:22, borderRadius:'50%', flexShrink:0,
                      background:'rgba(239,68,68,.14)', border:'1px solid rgba(239,68,68,.28)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#ef4444',
                    }}>✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Mockup */}
            <div style={{
              ...S.glass, borderRadius:18, padding:24,
              boxShadow:'0 0 80px rgba(239,68,68,.07)',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.3)' }}>بطاقة صيانة #1042</span>
                <span style={{ padding:'3px 11px', borderRadius:999, background:'rgba(245,158,11,.15)', border:'1px solid rgba(245,158,11,.3)', color:'#f59e0b', fontSize:11, fontWeight:700 }}>قيد الإصلاح</span>
              </div>
              {[['الجهاز','iPhone 15 Pro Max'],['العميل','محمد العمري'],['الفني','أحمد السالم'],['العطل','شاشة مكسورة'],['التكلفة','٨٥٠ ريال']].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
                  <span style={{ color:'rgba(255,255,255,.35)' }}>{k}</span>
                  <span style={{ color:'#fff', fontWeight:600 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, height:6, borderRadius:3, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:'65%', background:'linear-gradient(90deg,#f59e0b,#f97316)', borderRadius:3 }} />
                </div>
                <span style={{ fontSize:11, color:'#f59e0b', fontWeight:700 }}>٦٥٪</span>
              </div>
            </div>
          </div>

          {/* Row 2: Accounting (flip: text right, mockup left) */}
          <div className="lp-spotlight lp-fade" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center', direction:'ltr' }}>
            {/* Mockup (first in DOM = left in LTR) */}
            <div style={{
              ...S.glass, borderRadius:18, padding:24, direction:'rtl',
              boxShadow:'0 0 80px rgba(99,102,241,.07)',
            }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.32)', marginBottom:5 }}>إجمالي الإيرادات</div>
                <div style={{ fontSize:30, fontWeight:900, color:'#fff' }}>١٢٤,٨٠٠ <span style={{ fontSize:14, color:'rgba(255,255,255,.38)', fontWeight:400 }}>ريال</span></div>
                <div style={{ fontSize:12, color:'#10b981', fontWeight:700, marginTop:3 }}>↑ ٢٣٪ من الشهر السابق</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {([['المصروفات','٤٨,٢٠٠','#ef4444'],['صافي الربح','٧٦,٦٠٠','#10b981']] as [string,string,string][]).map(([l,v,c]) => (
                  <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:11, padding:'12px 14px', border:'1px solid rgba(255,255,255,.055)' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.32)', marginBottom:5 }}>{l}</div>
                    <div style={{ fontSize:19, fontWeight:900, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
              {[['المبيعات',78,'#6366f1'],['المشتريات',45,'#f59e0b'],['المصاريف',32,'#ef4444']].map(([n,val,c]) => (
                <div key={n as string} style={{ marginBottom:11 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,.38)', marginBottom:4 }}>
                    <span>{n}</span><span>{val}٪</span>
                  </div>
                  <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${val}%`, background:c as string, borderRadius:3 }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Text */}
            <div style={{ direction:'rtl' }}>
              <div style={{
                display:'inline-block', padding:'3px 13px', borderRadius:999,
                background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.22)',
                color:'#6366f1', fontSize:12, fontWeight:700, marginBottom:18,
              }}>📊 المحاسبة الكاملة</div>
              <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.9rem)', fontWeight:900, color:'#fff', marginBottom:16, lineHeight:1.18 }}>
                محاسبة دقيقة.<br/>بدون تعقيد.
              </h2>
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:15, lineHeight:1.85, marginBottom:26 }}>
                قيد مزدوج تلقائي، ميزانية عمومية، قائمة الدخل، مراكز التكلفة. كل شيء بلمسة واحدة.
              </p>
              <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:12 }}>
                {['قيد مزدوج تلقائي','ربط بنكي مباشر','تقارير ضريبية','مراكز التكلفة'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.72)' }}>
                    <span style={{
                      width:22, height:22, borderRadius:'50%', flexShrink:0,
                      background:'rgba(99,102,241,.14)', border:'1px solid rgba(99,102,241,.28)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#6366f1',
                    }}>✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── TESTIMONIALS ──────────────────────────── */}
      <section id="testimonials" dir="rtl" style={{ padding:'110px 28px', background:'#000', fontFamily:'Tajawal,sans-serif' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div className="lp-fade" style={{ textAlign:'center', marginBottom:64 }}>
            <h2 style={{ fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:900, color:'#fff', marginBottom:12 }}>ماذا يقول عملاؤنا</h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:16 }}>+500 شركة تثق في مُحكم يومياً</p>
          </div>
          <div className="lp-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`lp-fade lp-d${i+1}`} style={{
                ...S.glass, borderRadius:20, padding:28, position:'relative', overflow:'hidden',
                transition:'transform .3s cubic-bezier(.16,1,.3,1),border-color .3s,box-shadow .3s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform='translateY(-7px)';
                e.currentTarget.style.borderColor=`${t.c}44`;
                e.currentTarget.style.boxShadow=`0 24px 64px rgba(0,0,0,.35),0 0 0 1px ${t.c}22`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform='translateY(0)';
                e.currentTarget.style.borderColor='rgba(255,255,255,.07)';
                e.currentTarget.style.boxShadow='none';
              }}
              >
                <div style={{ position:'absolute', top:0, right:0, width:90, height:90, background:`radial-gradient(circle at top right,${t.c}16,transparent 70%)`, pointerEvents:'none' }} />
                <div style={{ display:'flex', gap:2, marginBottom:16 }}>
                  {Array(5).fill(0).map((_,si) => <span key={si} style={{ color:'#f59e0b', fontSize:15 }}>★</span>)}
                </div>
                <p style={{ color:'rgba(255,255,255,.75)', fontSize:14, lineHeight:1.85, marginBottom:22, fontStyle:'italic' }}>"{t.q}"</p>
                <div style={{ display:'flex', alignItems:'center', gap:13 }}>
                  <div style={{
                    width:42, height:42, borderRadius:'50%', flexShrink:0,
                    background:`linear-gradient(135deg,${t.c},${t.c}88)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:900, fontSize:17, color:'#000',
                  }}>{t.av}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{t.name}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.35)', marginTop:2 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── PRICING ─────────────────────────── */}
      <section id="pricing" dir="rtl" style={{ padding:'110px 28px', background:'rgba(255,255,255,.012)', fontFamily:'Tajawal,sans-serif' }}>
        <div style={{ maxWidth:880, margin:'0 auto' }}>
          <div className="lp-fade" style={{ textAlign:'center', marginBottom:64 }}>
            <h2 style={{ fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:900, color:'#fff', marginBottom:12 }}>خطة تناسب حجمك</h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:16 }}>ابدأ مجاناً لمدة 7 أيام — بدون بطاقة ائتمان</p>
          </div>

          <div className="lp-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:22 }}>
            {/* Pro card */}
            <div className="lp-fade lp-d1" style={{
              ...S.glass, borderRadius:24, padding:34, display:'flex', flexDirection:'column',
              transition:'border-color .3s, box-shadow .3s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.07)'; }}
            >
              <div style={{ fontSize:30, marginBottom:10 }}>⭐</div>
              <h3 style={{ fontSize:23, fontWeight:900, color:'#fff', marginBottom:4 }}>MuhKam Pro</h3>
              <p style={{ color:'rgba(255,255,255,.4)', fontSize:13, marginBottom:26 }}>للشركات الصغيرة والمتوسطة</p>
              <ul style={{ flex:1, listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:14, marginBottom:30 }}>
                {['المبيعات والمشتريات','إدارة المخزون','العملاء والموردون','التقارير الأساسية','نقطة البيع POS','دعم عربي'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.7)' }}>
                    <span style={{ color:'#f59e0b', fontWeight:700, fontSize:16 }}>✓</span>{item}
                  </li>
                ))}
              </ul>
              <button onClick={goLogin} style={{
                padding:14, borderRadius:13, border:'1px solid rgba(255,255,255,.16)',
                background:'transparent', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                transition:'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,.45)'; e.currentTarget.style.background='rgba(245,158,11,.08)'; e.currentTarget.style.color='#f59e0b'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.16)'; e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#fff'; }}
              >ابدأ مجاناً</button>
              <p style={{ textAlign:'center', color:'rgba(255,255,255,.28)', fontSize:12, marginTop:13 }}>7 أيام تجريبية — بدون بطاقة</p>
            </div>

            {/* Advanced card */}
            <div className="lp-fade lp-d2" style={{
              borderRadius:26, padding:3, position:'relative',
              background:'linear-gradient(135deg,#f59e0b,#f97316,#ef4444,#f59e0b)',
              backgroundSize:'200% 200%', animation:'lp-gradient-pan 4s ease infinite',
            }}>
              {/* Most popular badge */}
              <div style={{
                position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)',
                padding:'4px 18px', borderRadius:999,
                background:'linear-gradient(135deg,#f59e0b,#f97316)',
                color:'#000', fontSize:11, fontWeight:900, whiteSpace:'nowrap', zIndex:1,
              }}>⚡ الأكثر طلباً</div>

              <div style={{
                background:'rgba(8,8,8,.96)', borderRadius:23, padding:32,
                display:'flex', flexDirection:'column', height:'100%', boxSizing:'border-box',
                backdropFilter:'blur(20px)',
              }}>
                <div style={{ fontSize:30, marginBottom:10 }}>🚀</div>
                <h3 style={{ fontSize:23, fontWeight:900, color:'#fff', marginBottom:4 }}>MuhKam Advanced</h3>
                <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginBottom:26 }}>للشركات التي تحتاج كل شيء</p>
                <ul style={{ flex:1, listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:14, marginBottom:30 }}>
                  {['كل ما في Pro +','المحاسبة الكاملة + القيد المزدوج','الموارد البشرية والرواتب','وحدة الصيانة والأجهزة','تطبيق موبايل (iOS & Android)','المطابقة البنكية','الميزانيات ومراكز التكلفة'].map(item => (
                    <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color: item==='كل ما في Pro +' ? '#f59e0b' : 'rgba(255,255,255,.8)' }}>
                      <span style={{ color:'#f59e0b', fontWeight:700, fontSize:16 }}>✓</span>{item}
                    </li>
                  ))}
                </ul>
                <button onClick={goLogin} className="lp-shim" style={{
                  padding:14, borderRadius:13, border:'none', cursor:'pointer', fontFamily:'inherit',
                  background:'linear-gradient(135deg,#f59e0b,#f97316)',
                  color:'#000', fontSize:14, fontWeight:900,
                  boxShadow:'0 0 32px rgba(245,158,11,.45)',
                  transition:'transform .2s, box-shadow .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 0 55px rgba(245,158,11,.65)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 0 32px rgba(245,158,11,.45)'; }}
                >ابدأ مجاناً</button>
                <p style={{ textAlign:'center', color:'rgba(255,255,255,.28)', fontSize:12, marginTop:13 }}>7 أيام تجريبية — بدون بطاقة</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────── FINAL CTA ─────────────────────────── */}
      <section dir="rtl" style={{
        padding:'132px 28px', textAlign:'center', background:'#000',
        position:'relative', overflow:'hidden', fontFamily:'Tajawal,sans-serif',
      }}>
        {/* Background glow */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(ellipse 75% 55% at 50% 50%,rgba(245,158,11,.14) 0%,rgba(249,115,22,.05) 45%,transparent 68%)',
        }} />
        {/* Pulse rings */}
        {[1,2,3].map(i => (
          <div key={i} style={{
            position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            width:i*220, height:i*130, borderRadius:'50%',
            border:'1px solid rgba(245,158,11,.12)', pointerEvents:'none',
            animation:`lp-ping ${1.4+i*.9}s ${i*.55}s ease-out infinite`,
          }} />
        ))}
        {/* Spinning decorative ring */}
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:600, height:600, borderRadius:'50%',
          border:'1px solid rgba(245,158,11,.04)',
          animation:'lp-spin-slow 30s linear infinite', pointerEvents:'none',
        }} />

        <div className="lp-fade" style={{ position:'relative', zIndex:10, maxWidth:640, margin:'0 auto' }}>
          <h2 style={{
            fontSize:'clamp(2.2rem,6.5vw,4.2rem)', fontWeight:900,
            color:'#fff', marginBottom:18, lineHeight:1.12,
          }}>
            جاهز لتحويل{' '}
            <span style={{
              background:'linear-gradient(135deg,#f59e0b,#f97316,#ef4444)',
              backgroundSize:'200%', WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent', backgroundClip:'text',
              animation:'lp-gradient-pan 3s ease infinite',
            }}>شركتك؟</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:18, marginBottom:44 }}>
            انضم لـ +500 شركة تثق في مُحكم يومياً
          </p>
          <button onClick={goLogin} className="lp-shim" style={{ ...S.amberBtn, fontSize:18, padding:'18px 56px' }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.07) translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1) translateY(0)'; }}
          >ابدأ تجربتك المجانية الآن ←</button>
          <div style={{ marginTop:22, display:'flex', justifyContent:'center', gap:22, color:'rgba(255,255,255,.28)', fontSize:13 }}>
            <span>✓ 7 أيام مجاناً</span>
            <span>✓ بدون بطاقة</span>
            <span>✓ إلغاء في أي وقت</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────── FOOTER ─────────────────────────────── */}
      <footer dir="rtl" style={{
        padding:'36px 28px', background:'#000',
        borderTop:'1px solid rgba(255,255,255,.055)',
        position:'relative', fontFamily:'Tajawal,sans-serif',
      }}>
        {/* Amber gradient line */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:1,
          background:'linear-gradient(90deg,transparent,rgba(245,158,11,.45),transparent)',
        }} />
        <div style={{
          maxWidth:1100, margin:'0 auto',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:18,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:11 }}>
            <div style={{
              width:34, height:34, borderRadius:10,
              background:'linear-gradient(135deg,#f59e0b,#f97316)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:900, fontSize:17, color:'#000',
              boxShadow:'0 0 14px rgba(245,158,11,.35)',
            }}>م</div>
            <div>
              <div style={{ fontWeight:900, color:'#fff', fontSize:16 }}>مُحكم ERP</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>نظام إدارة عربي متكامل</div>
            </div>
          </div>

          <div style={{ display:'flex', gap:26, flexWrap:'wrap' }}>
            {[['features','الميزات'],['pricing','الأسعار'],['testimonials','العملاء']].map(([id,lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{
                color:'rgba(255,255,255,.35)', fontSize:13, textDecoration:'none', transition:'color .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color='#f59e0b'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}
              >{lbl}</a>
            ))}
            <button onClick={goLogin} style={{
              background:'none', border:'none', color:'rgba(255,255,255,.35)', fontSize:13,
              cursor:'pointer', padding:0, fontFamily:'inherit', transition:'color .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color='#f59e0b'}
            onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}
            >تسجيل الدخول</button>
          </div>

          <p style={{ color:'rgba(255,255,255,.2)', fontSize:12 }}>© 2026 مُحكم ERP — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </>
  );
}
