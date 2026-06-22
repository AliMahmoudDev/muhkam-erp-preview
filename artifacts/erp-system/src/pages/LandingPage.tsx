/* eslint-disable erp/no-hardcoded-colors -- LandingPage v6: Qyam-structured clean Arabic SaaS landing */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { DashboardShot } from './landing/AppScreenshots';

/* ══════════════════════════════════════════════
   CSS
══════════════════════════════════════════════ */
const LP_CSS_ID = 'muhkam-lp-css';
const LP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;}

@keyframes lp-up   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
@keyframes lp-fade { from{opacity:0} to{opacity:1} }
@keyframes lp-spin { to{transform:rotate(360deg)} }

.lp-reveal{opacity:0;transform:translateY(20px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1);}
.lp-reveal.lp-in{opacity:1;transform:none;}
.lp-d1{transition-delay:.08s}.lp-d2{transition-delay:.16s}.lp-d3{transition-delay:.24s}.lp-d4{transition-delay:.32s}
.lp-d5{transition-delay:.08s}.lp-d6{transition-delay:.14s}.lp-d7{transition-delay:.20s}.lp-d8{transition-delay:.26s}

.lp-nav-link{font-family:'Tajawal',sans-serif;font-size:14px;font-weight:500;color:#475569;text-decoration:none;transition:color .15s;white-space:nowrap;}
.lp-nav-link:hover{color:#0F172A;}

.lp-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:46px;padding:0 28px;background:#2563EB;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;transition:background .15s,transform .1s;}
.lp-btn-primary:hover{background:#1D4ED8;}
.lp-btn-primary:active{transform:scale(.98);}
.lp-btn-primary-lg{height:52px;padding:0 36px;font-size:16px;border-radius:10px;}

.lp-btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:46px;padding:0 22px;background:transparent;color:#0F172A;border:1.5px solid #CBD5E1;border-radius:8px;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:500;white-space:nowrap;transition:border-color .15s,background .15s;}
.lp-btn-outline:hover{border-color:#94A3B8;background:#F8FAFC;}

.lp-btn-white{display:inline-flex;align-items:center;justify-content:center;height:46px;padding:0 26px;background:#fff;color:#0F172A;border:none;border-radius:8px;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:15px;font-weight:600;transition:background .15s;}
.lp-btn-white:hover{background:#F1F5F9;}

.lp-card{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:24px;transition:box-shadow .2s,transform .2s;}
.lp-card:hover{box-shadow:0 8px 28px rgba(15,23,42,.09);transform:translateY(-2px);}

.lp-feature-icon{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;flex-shrink:0;}

.lp-step-num{width:40px;height:40px;border-radius:50%;background:#EFF6FF;color:#2563EB;font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

.lp-pricing-card{background:#fff;border:1.5px solid #E2E8F0;border-radius:16px;padding:32px;position:relative;}
.lp-pricing-card-popular{border-color:#2563EB;box-shadow:0 8px 32px rgba(37,99,235,.14);}
.lp-popular-badge{position:absolute;top:-12px;right:50%;transform:translateX(50%);background:#2563EB;color:#fff;padding:4px 16px;border-radius:100px;font-size:12px;font-weight:700;white-space:nowrap;}

.lp-check{color:#059669;font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px;}
.lp-check::before{content:"✓";color:#059669;font-weight:700;flex-shrink:0;}

.lp-testimonial{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:28px;}

.lp-faq-btn{width:100%;background:none;border:none;padding:20px 0;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:16px;font-weight:600;color:#0F172A;display:flex;align-items:center;justify-content:space-between;gap:12;text-align:right;}
.lp-faq-btn:hover{color:#2563EB;}

.lp-input{width:100%;height:48px;padding:0 14px;border:1.5px solid #E2E8F0;border-radius:9px;background:#fff;color:#0F172A;font-family:'Tajawal',sans-serif;font-size:15px;outline:none;direction:rtl;text-align:right;transition:border-color .15s,box-shadow .15s;}
.lp-input::placeholder{color:#94A3B8;}
.lp-input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.lp-input:hover:not(:focus){border-color:#CBD5E1;}
.lp-input-error{border-color:#EF4444!important;}
.lp-input:-webkit-autofill,.lp-input:-webkit-autofill:hover,.lp-input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px #fff inset;-webkit-text-fill-color:#0F172A;}

.lp-submit{width:100%;height:50px;background:#2563EB;color:#fff;border:none;border-radius:9px;font-family:'Tajawal',sans-serif;font-size:16px;font-weight:600;cursor:pointer;transition:background .15s;}
.lp-submit:hover:not(:disabled){background:#1D4ED8;}
.lp-submit:disabled{opacity:.45;cursor:not-allowed;}

.lp-link{background:none;border:none;padding:0;cursor:pointer;font-family:'Tajawal',sans-serif;color:#2563EB;font-size:13px;font-weight:600;transition:opacity .15s;}
.lp-link:hover{opacity:.7;}

@media(max-width:1024px){
  .lp-hero-product{display:none!important;}
  .lp-hero-text{max-width:600px!important;text-align:center;align-items:center!important;}
  .lp-features-grid{grid-template-columns:repeat(2,1fr)!important;}
  .lp-how-grid{grid-template-columns:1fr!important;max-width:500px;margin:0 auto!important;}
  .lp-pricing-grid{grid-template-columns:1fr!important;max-width:400px;margin:0 auto!important;}
  .lp-testimonials-grid{grid-template-columns:1fr!important;max-width:560px;margin:0 auto!important;}
  .lp-nav-links{display:none!important;}
  .lp-footer-grid{grid-template-columns:repeat(2,1fr)!important;}
}
@media(max-width:640px){
  .lp-features-grid{grid-template-columns:1fr!important;}
  .lp-footer-grid{grid-template-columns:1fr!important;}
  .lp-hero-stats{flex-direction:column;align-items:center!important;}
  .lp-hero-checks{flex-direction:column;align-items:center!important;}
  .lp-trust-logos{gap:20px!important;}
}
`;

/* ══════════════════════════════════════════════
   Palette & Data
══════════════════════════════════════════════ */
const C = {
  bg:       '#FFFFFF',
  surface:  '#F8FAFC',
  border:   '#E2E8F0',
  primary:  '#2563EB',
  primaryBg:'#EFF6FF',
  text:     '#0F172A',
  sub:      '#475569',
  muted:    '#94A3B8',
  dark:     '#0F172A',
  green:    '#059669',
} as const;

const FEATURES = [
  { icon: '🏪', bg: '#EFF6FF', title: 'نقطة البيع',         desc: 'إصدار فواتير فوري وإدارة شاملة لعمليات البيع' },
  { icon: '📦', bg: '#F0FDF4', title: 'إدارة المخزون',      desc: 'تتبع دقيق للكميات والتكاليف مع تحذيرات نفاد المخزون' },
  { icon: '💰', bg: '#FFFBEB', title: 'المحاسبة والتقارير', desc: 'قيد مزدوج تلقائي وتقارير مالية شاملة في لحظات' },
  { icon: '👥', bg: '#FDF4FF', title: 'الموارد البشرية',    desc: 'إدارة الموظفين والرواتب والحضور والإجازات' },
  { icon: '🔧', bg: '#FFF1F2', title: 'إدارة الصيانة',      desc: 'تتبع طلبات الصيانة وقطع الغيار وإشعار العملاء' },
  { icon: '🤝', bg: '#F0FDF4', title: 'العملاء والموردون',  desc: 'بطاقات تفصيلية ومتابعة الديون والمستحقات' },
  { icon: '📊', bg: '#EFF6FF', title: 'التقارير والتحليلات','desc': 'رؤية شاملة لأداء عملك مع رسوم بيانية تفاعلية' },
  { icon: '🔔', bg: '#FFFBEB', title: 'التنبيهات الذكية',   desc: 'إشعارات فورية للمخزون المنخفض والديون والأحداث الهامة' },
] as const;


const PLANS_MONTHLY = [
  {
    name: 'الأساسية', price: '٩٩', unit: 'ر.س/شهر', popular: false,
    desc: 'للشركات الصغيرة والناشئة',
    features: ['حتى ٥ مستخدمين', 'مخزن واحد', 'نقطة بيع وفواتير', 'تقارير أساسية', 'دعم عبر البريد'],
  },
  {
    name: 'الاحترافية', price: '٢٤٩', unit: 'ر.س/شهر', popular: true,
    desc: 'للشركات المتنامية',
    features: ['حتى ٢٥ مستخدماً', 'حتى ٥ مخازن', 'جميع الوحدات', 'تقارير متقدمة', 'دعم أولوية ٢٤/٧', 'نسخ احتياطي يومي'],
  },
  {
    name: 'المتقدمة', price: '٤٩٩', unit: 'ر.س/شهر', popular: false,
    desc: 'للمؤسسات الكبيرة',
    features: ['مستخدمون غير محدودين', 'مخازن غير محدودة', 'جميع الوحدات', 'تقارير مخصصة', 'مدير حساب مخصص', 'SLA مضمون'],
  },
] as const;

const PLANS_ANNUAL = [
  { ...PLANS_MONTHLY[0], price: '٧٩' },
  { ...PLANS_MONTHLY[1], price: '١٩٩' },
  { ...PLANS_MONTHLY[2], price: '٣٩٩' },
] as const;


const FAQ_ITEMS = [
  { q: 'هل يدعم مُحكم إدارة متعددة الفروع؟', a: 'نعم، يمكنك إدارة فروع ومخازن متعددة من لوحة تحكم مركزية واحدة مع تقارير منفصلة لكل فرع.' },
  { q: 'هل بياناتي آمنة؟', a: 'نعم، نستخدم تشفير TLS لجميع الاتصالات، وكل شركة معزولة تماماً عن الأخرى، مع نسخ احتياطية يومية.' },
  { q: 'هل يمكنني استيراد البيانات من Excel؟', a: 'نعم، ندعم استيراد المنتجات والعملاء والموردين من ملفات Excel وCSV بشكل مباشر.' },
  { q: 'ما الفرق بين خطط الاشتراك؟', a: 'تختلف الخطط في عدد المستخدمين المسموح بهم، وعدد المخازن، وإمكانية الوصول للوحدات المتقدمة كالتقارير المخصصة.' },
  { q: 'هل هناك دعم فني متاح؟', a: 'نعم، نقدم دعماً فنياً عبر الواتساب والبريد الإلكتروني. خطة الاحترافية والمتقدمة تشمل دعم أولوية على مدار الساعة.' },
  { q: 'هل يعمل التطبيق على الجوال؟', a: 'نعم، تطبيق مُحكم متاح على iOS وAndroid، ومُحسّن بالكامل للاستخدام اليومي من الجوال.' },
  { q: 'هل يمكنني الإلغاء في أي وقت؟', a: 'نعم، يمكنك الإلغاء في أي وقت دون أي رسوم إلغاء. بياناتك متاحة للتصدير قبل الإلغاء.' },
] as const;



/* ══════════════════════════════════════════════
   Shared helpers
══════════════════════════════════════════════ */
function SectionHeader({ eyebrow, title, sub, center = false }: { eyebrow?: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div style={{ textAlign: center ? 'center' : 'right', marginBottom: 52 }}>
      {eyebrow && (
        <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontSize: 'clamp(26px,3.2vw,40px)', fontWeight: 700, color: C.text, letterSpacing: '-0.025em', margin: '0 0 14px', lineHeight: 1.2 }}>
        {title}
      </h2>
      {sub && (
        <p style={{ fontSize: 17, color: C.sub, lineHeight: 1.75, margin: center ? '0 auto' : '0', maxWidth: 560 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function BrowserFrame({ children, height = 480 }: { children: React.ReactNode; height?: number }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 64px rgba(15,23,42,.16), 0 4px 16px rgba(15,23,42,.08)', border: `1px solid ${C.border}` }}>
      <div style={{ height: 36, background: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FC5C65' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FED330' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#26DE81' }} />
        <div style={{ flex: 1, height: 22, background: '#E2E8F0', borderRadius: 100, maxWidth: 240, marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: C.muted, fontFamily: 'Inter, monospace' }}>app.muhkam.com</span>
        </div>
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Navbar
══════════════════════════════════════════════ */
function Navbar({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setOpen(false);
  };

  const links: [string, string][] = [['features', 'التطبيقات'], ['pricing', 'الأسعار'], ['faq', 'الأسئلة الشائعة']];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, padding: '14px 24px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div
          style={{
            background: scrolled ? 'rgba(255,255,255,.96)' : '#fff',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: open ? 18 : 100,
            border: `1px solid ${C.border}`,
            boxShadow: scrolled ? '0 4px 20px rgba(15,23,42,.08)' : '0 2px 10px rgba(15,23,42,.06)',
            transition: 'box-shadow .2s, border-radius .2s',
          }}
        >
          <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 8px 0 20px', gap: 20 }}>
            {/* Brand — first = RIGHT in RTL */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>مُحكم</span>
            </div>

            {/* Nav links */}
            <div className="lp-nav-links" style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: 4 }}>
              {links.map(([id, lbl]) => (
                <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="lp-nav-link" style={{ padding: '6px 14px', borderRadius: 100 }}>{lbl}</a>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* CTA — last = LEFT in RTL */}
            <div className="lp-nav-links" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={onLogin}    className="lp-btn-outline" style={{ height: 40, padding: '0 16px', fontSize: 13 }}>تسجيل الدخول</button>
              <button onClick={onRegister} className="lp-btn-primary" style={{ height: 40, padding: '0 18px', fontSize: 13 }}>سجّل الآن</button>
            </div>

            {/* Mobile menu */}
            <button
              onClick={() => setOpen((v) => !v)}
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8, flexDirection: 'column', gap: 4 }}
              className="lp-mobile-menu-btn"
              aria-label="القائمة"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 20, height: 1.5, background: C.text, borderRadius: 2 }} />
              ))}
            </button>
          </div>

          {open && (
            <div style={{ padding: '16px 20px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {links.map(([id, lbl]) => (
                <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="lp-nav-link" style={{ padding: '10px 4px', fontSize: 15, borderBottom: `1px solid ${C.border}` }}>{lbl}</a>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                <button onClick={onLogin}    className="lp-btn-outline" style={{ width: '100%' }}>تسجيل الدخول</button>
                <button onClick={onRegister} className="lp-btn-primary" style={{ width: '100%' }}>سجّل الآن</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Hero
══════════════════════════════════════════════ */
function HeroSection({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 100, paddingBottom: 80, background: C.bg }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>

          {/* Text — first = RIGHT in RTL */}
          <div className="lp-hero-text" style={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {/* Eyebrow badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: C.primaryBg, border: `1px solid #BFDBFE`, borderRadius: 100, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: C.primary, marginBottom: 28, animation: 'lp-up .5s ease both' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
              نظام واحد لإدارة عملك بالكامل
            </div>

            <h1 style={{ fontSize: 'clamp(38px,5vw,64px)', fontWeight: 800, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 22, textAlign: 'right', animation: 'lp-up .5s .06s ease both' }}>
              نظّم أعمالك.<br />
              <span style={{ color: C.primary }}>من البيع إلى الميزانية.</span>
            </h1>

            <p style={{ fontSize: 17, color: C.sub, lineHeight: 1.85, marginBottom: 36, maxWidth: 460, textAlign: 'right', animation: 'lp-up .5s .10s ease both' }}>
              مُحكم ERP منصة عربية متكاملة لإدارة المبيعات والمخزون والمحاسبة والموارد البشرية — تعمل من اليوم الأول.
            </p>

            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, animation: 'lp-up .5s .14s ease both', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={onRegister} className="lp-btn-primary lp-btn-primary-lg">ابدأ مجاناً — ٧ أيام</button>
              <button onClick={onLogin}    className="lp-btn-outline" style={{ height: 52, padding: '0 26px', fontSize: 15, borderRadius: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                شاهد العرض
              </button>
            </div>

            {/* Checks */}
            <div className="lp-hero-checks" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end', animation: 'lp-up .5s .18s ease both' }}>
              {['لا تحتاج بطاقة ائتمان', 'إعداد في دقائق', 'دعم على مدار الساعة'].map((c) => (
                <span key={c} className="lp-check" style={{ fontSize: 13 }}>{c}</span>
              ))}
            </div>

          </div>

          {/* Product — second = LEFT in RTL */}
          <div className="lp-hero-product" style={{ flex: 1, animation: 'lp-fade .7s .1s ease both' }}>
            <BrowserFrame height={480}>
              <DashboardShot />
            </BrowserFrame>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   Features grid
══════════════════════════════════════════════ */
function FeaturesSection() {
  return (
    <section id="features" style={{ padding: '96px 0', background: C.surface }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionHeader center eyebrow="التطبيقات" title="كل ما تحتاجه في منصة واحدة" sub="مُحكم يغطي جميع احتياجات إدارة شركتك من البيع إلى المحاسبة وما بينهما." />
        </div>
        <div className="lp-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className={`lp-card lp-reveal lp-d${((i % 4) + 1) as 1|2|3|4}`}>
              <div className="lp-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   Product showcase (full-width)
══════════════════════════════════════════════ */
function ShowcaseSection() {
  return (
    <section style={{ padding: '80px 0', background: '#0F172A', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>لوحة التحكم</div>
          <h2 style={{ fontSize: 'clamp(24px,3vw,38px)', fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.025em', margin: '0 0 14px' }}>
            رؤية كاملة لأعمالك في مكان واحد
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.75 }}>
            إيرادات، مصروفات، مبيعات، مخزون — كل شيء أمامك في لحظة.
          </p>
        </div>
        <div className="lp-reveal" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ height: 40, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            {[0,1,2].map((i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,.15)' }} />)}
            <div style={{ flex: 1, height: 22, background: 'rgba(255,255,255,.07)', borderRadius: 100, maxWidth: 260, marginRight: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#475569', fontFamily: 'Inter, monospace' }}>app.muhkam.com/dashboard</span>
            </div>
          </div>
          <div style={{ height: 520 }}><DashboardShot /></div>
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   Mobile app section
══════════════════════════════════════════════ */
function MobileSection() {
  return (
    <section style={{ padding: '80px 0', background: C.bg }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 64, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Text — first = RIGHT in RTL */}
          <div className="lp-reveal" style={{ flex: '0 0 44%', minWidth: 280 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>تطبيق الجوال</div>
            <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, color: C.text, letterSpacing: '-0.025em', marginBottom: 14 }}>
              مُحكم في جيبك — أينما كنت
            </h2>
            <p style={{ fontSize: 16, color: C.sub, lineHeight: 1.8, marginBottom: 32 }}>
              تطبيق مُحكم للجوال يتيح لك إدارة مبيعاتك وعرض التقارير ومتابعة الفريق من أي مكان.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
              {['عرض لوحة التحكم ومؤشرات الأداء', 'إصدار الفواتير من الجوال مباشرة', 'استعراض المخزون وإنشاء طلبات الشراء', 'متابعة حالة طلبات الصيانة'].map((f) => (
                <span key={f} className="lp-check" style={{ fontSize: 14 }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Mockup — second = LEFT in RTL */}
          <div className="lp-reveal lp-d2" style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 240 }}>
            <div style={{ width: 220, borderRadius: 32, overflow: 'hidden', boxShadow: '0 32px 64px rgba(15,23,42,.2)', border: '8px solid #1E293B', background: '#0F1117', position: 'relative' }}>
              {/* Status bar */}
              <div style={{ height: 28, background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 9, color: '#6B7280', fontFamily: 'Inter, monospace' }}>
                <span>٩:٤١</span>
                <span>● ● ▌</span>
              </div>
              {/* App content */}
              <div style={{ padding: 14, background: '#0F1117', minHeight: 360 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F4F4F5', marginBottom: 16, textAlign: 'right' }}>لوحة التحكم</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { l: 'الإيرادات', v: '١٢٤ ألف', c: '#22C55E' },
                    { l: 'الطلبات',   v: '٢٤١',     c: '#6366F1' },
                    { l: 'الأرباح',   v: '٧٦ ألف',  c: '#F59E0B' },
                    { l: 'العملاء',   v: '٨٤',       c: '#EC4899' },
                  ].map((k) => (
                    <div key={k.l} style={{ background: '#141418', borderRadius: 10, padding: '10px 12px', border: '1px solid #252530' }}>
                      <div style={{ fontSize: 8, color: '#71717A', marginBottom: 4 }}>{k.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: k.c }}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#141418', borderRadius: 10, padding: 12, border: '1px solid #252530', marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: '#71717A', marginBottom: 8 }}>آخر الفواتير</div>
                  {[
                    { n: 'iPhone 15 Pro', v: '٢٥٫٥٠٠', c: '#22C55E' },
                    { n: 'Samsung S24',   v: '١٨٫٩٠٠', c: '#22C55E' },
                    { n: 'MacBook Air',   v: '٣٢٫٠٠٠', c: '#F59E0B' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? '1px solid #252530' : 'none', fontSize: 9 }}>
                      <span style={{ color: '#A1A1AA' }}>{r.n}</span>
                      <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                {/* Bottom nav */}
                <div style={{ display: 'flex', justifyContent: 'space-around', background: '#141418', borderRadius: 12, padding: '8px 0', border: '1px solid #252530', marginTop: 8 }}>
                  {['🏠','📦','💰','👤'].map((ic) => (
                    <div key={ic} style={{ fontSize: 16, textAlign: 'center', padding: '4px 8px' }}>{ic}</div>
                  ))}
                </div>
              </div>
              {/* Home bar */}
              <div style={{ height: 20, background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 60, height: 4, background: '#374151', borderRadius: 2 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Pricing
══════════════════════════════════════════════ */
function PricingSection({ onRegister }: { onRegister: () => void }) {
  const [annual, setAnnual] = useState(false);
  const plans = annual ? PLANS_ANNUAL : PLANS_MONTHLY;

  return (
    <section id="pricing" style={{ padding: '96px 0', background: C.surface }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center' }}>
          <SectionHeader center eyebrow="الأسعار" title="خطط واضحة بلا رسوم خفية" sub="ابدأ مجاناً لمدة ٧ أيام. لا تحتاج بطاقة ائتمان." />
          {/* Toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 100, padding: '4px 6px', marginBottom: 48 }}>
            {[
              { v: false, l: 'شهري' },
              { v: true,  l: 'سنوي (وفّر ٢٠٪)' },
            ].map(({ v, l }) => (
              <button key={l} onClick={() => setAnnual(v)} style={{ height: 34, padding: '0 18px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: annual === v ? C.text : 'transparent', color: annual === v ? '#fff' : C.sub, transition: 'all .2s' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="lp-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {plans.map((p, i) => (
            <div key={i} className={`lp-pricing-card lp-reveal lp-d${(i + 1) as 1|2|3}${p.popular ? ' lp-pricing-card-popular' : ''}`}>
              {p.popular && <div className="lp-popular-badge">الأكثر شعبية</div>}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{p.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 28 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: p.popular ? C.primary : C.text, letterSpacing: '-0.03em' }}>{p.price}</span>
                <span style={{ fontSize: 14, color: C.sub }}>{p.unit}</span>
              </div>
              <button onClick={onRegister} className={p.popular ? 'lp-btn-primary' : 'lp-btn-outline'} style={{ width: '100%', height: 46, marginBottom: 24 }}>
                ابدأ مجاناً
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.features.map((f) => (
                  <span key={f} className="lp-check" style={{ fontSize: 13 }}>{f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ══════════════════════════════════════════════
   FAQ
══════════════════════════════════════════════ */
function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" style={{ padding: '96px 0', background: C.surface }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal">
          <SectionHeader center eyebrow="الأسئلة الشائعة" title="أجوبة على أكثر الأسئلة شيوعاً" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="lp-reveal" style={{ borderBottom: `1px solid ${C.border}` }}>
              <button className="lp-faq-btn" onClick={() => setOpen(open === i ? null : i)}>
                <span>{item.q}</span>
                <span style={{ color: C.muted, fontSize: 18, flexShrink: 0, transition: 'transform .2s', transform: open === i ? 'rotate(45deg)' : 'none', display: 'inline-block' }}>+</span>
              </button>
              {open === i && (
                <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.85, paddingBottom: 18, paddingRight: 4 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}



/* ══════════════════════════════════════════════
   Main export
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate] = useLocation();
  const obsRef = useRef<IntersectionObserver | null>(null);

  /* CSS */
  useEffect(() => {
    let el = document.getElementById(LP_CSS_ID) as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = LP_CSS_ID; document.head.appendChild(el); }
    el.textContent = LP_CSS;
    return () => { document.getElementById(LP_CSS_ID)?.remove(); };
  }, []);

  /* Scroll reveal */
  useEffect(() => {
    const timer = setTimeout(() => {
      obsRef.current = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('lp-in'); obsRef.current?.unobserve(e.target); } }),
        { threshold: 0.07 }
      );
      document.querySelectorAll('.lp-reveal').forEach((el) => obsRef.current?.observe(el));
    }, 100);
    return () => { clearTimeout(timer); obsRef.current?.disconnect(); };
  }, []);

  const goRegister = useCallback(() => navigate('/login?tab=register'), [navigate]);
  const goLogin    = useCallback(() => navigate('/login'), [navigate]);

  return (
    <div dir="rtl" style={{ background: C.bg, color: C.text, fontFamily: "'Tajawal', system-ui, sans-serif", minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}>
      <Navbar onLogin={goLogin} onRegister={goRegister} />

      <HeroSection onRegister={goRegister} onLogin={goLogin} />
      <FeaturesSection />
      <ShowcaseSection />
      <MobileSection />
      <PricingSection onRegister={goRegister} />
      <FAQSection />
    </div>
  );
}
