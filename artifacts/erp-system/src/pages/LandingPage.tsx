/* eslint-disable erp/no-hardcoded-colors -- landing page and modal decorative colors: intentional fixed palette */
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

.lp-card{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:24px;transition:box-shadow .2s,transform .2s;}
.lp-card:hover{box-shadow:0 8px 28px rgba(15,23,42,.09);transform:translateY(-2px);}

.lp-feature-icon{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;flex-shrink:0;}

.lp-pricing-card{background:#fff;border:1.5px solid #E2E8F0;border-radius:16px;padding:28px;position:relative;}
.lp-pricing-card-popular{border-color:#2563EB;box-shadow:0 8px 32px rgba(37,99,235,.14);}
.lp-popular-badge{position:absolute;top:-12px;right:50%;transform:translateX(50%);background:#2563EB;color:#fff;padding:4px 14px;border-radius:100px;font-size:11px;font-weight:700;white-space:nowrap;}

.lp-check{color:#059669;font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px;}
.lp-check::before{content:"✓";color:#059669;font-weight:700;flex-shrink:0;}

.lp-faq-btn{width:100%;background:none;border:none;padding:20px 0;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:16px;font-weight:600;color:#0F172A;display:flex;align-items:center;justify-content:space-between;gap:12;text-align:right;}
.lp-faq-btn:hover{color:#2563EB;}

@media(max-width:1024px){
  .lp-hero-product{display:none!important;}
  .lp-hero-text{max-width:600px!important;text-align:center;align-items:center!important;}
  .lp-features-grid{grid-template-columns:repeat(2,1fr)!important;}
  .lp-pricing-grid{grid-template-columns:repeat(2,1fr)!important;max-width:680px;margin:0 auto!important;}
  .lp-nav-links{display:none!important;}
  .lp-footer-grid{grid-template-columns:repeat(2,1fr)!important;}
}
@media(max-width:640px){
  .lp-features-grid{grid-template-columns:1fr!important;}
  .lp-pricing-grid{grid-template-columns:1fr!important;max-width:380px;margin:0 auto!important;}
  .lp-footer-grid{grid-template-columns:1fr!important;}
  .lp-hero-checks{flex-direction:column;align-items:center!important;}
}
`;

/* ══════════════════════════════════════════════
   Palette & Data
══════════════════════════════════════════════ */
const C = {
  bg:        '#FFFFFF',
  surface:   '#F8FAFC',
  border:    '#E2E8F0',
  primary:   '#2563EB',
  primaryBg: '#EFF6FF',
  text:      '#0F172A',
  sub:       '#475569',
  muted:     '#94A3B8',
  green:     '#059669',
} as const;

const FEATURES = [
  { icon: '🏪', bg: '#EFF6FF', title: 'نقطة البيع',         desc: 'إصدار الفواتير فوري لمحلات الجوال ونقاط البيع والتجار بكل سهولة' },
  { icon: '📦', bg: '#F0FDF4', title: 'إدارة المخزون',      desc: 'تتبع الأصناف والكميات لكل المخازن مع تنبيهات نفاد المخزون تلقائياً' },
  { icon: '💰', bg: '#FFFBEB', title: 'المحاسبة والتقارير', desc: 'قيد محاسبي تلقائي وتقارير أرباح وخسارة وميزانية في ثوانٍ' },
  { icon: '👥', bg: '#FDF4FF', title: 'الموارد البشرية',    desc: 'رواتب وحضور وإجازات موظفيك من مكان واحد بدون تعقيد' },
  { icon: '🔧', bg: '#FFF1F2', title: 'إدارة الصيانة',      desc: 'تتبع طلبات الصيانة وقطع الغيار وإشعار العملاء فوراً عند الانتهاء' },
  { icon: '🤝', bg: '#F0FDF4', title: 'العملاء والموردون',  desc: 'سجلات تفصيلية ومتابعة الديون والأرصدة لكل عميل وموّرد' },
  { icon: '📊', bg: '#EFF6FF', title: 'التقارير والتحليلات', desc: 'تقارير يومية وشهرية لأداء المبيعات والمخزون والأرباح بشكل مرئي' },
  { icon: '🔔', bg: '#FFFBEB', title: 'التنبيهات الذكية',   desc: 'تنبيهات فورية للمخزون المنخفض والديون والفواتير المتأخرة' },
] as const;

interface Plan {
  name: string;
  price: string | null;
  unit: string;
  popular: boolean;
  enterprise: boolean;
  desc: string;
  features: readonly string[];
}

const PLANS: Plan[] = [
  {
    name: 'البداية', price: '٢٩٩', unit: 'ج.م/شهر', popular: false, enterprise: false,
    desc: 'للمحلات والشركات الناشئة',
    features: ['حتى ٣ مستخدمين', 'مخزن واحد', 'نقطة بيع وفواتير', 'تقارير أساسية', 'دعم عبر واتساب'],
  },
  {
    name: 'المتوسطة', price: '٥٩٠', unit: 'ج.م/شهر', popular: true, enterprise: false,
    desc: 'للشركات المتنامية',
    features: ['حتى ١٥ مستخدماً', 'حتى ٣ مخازن', 'جميع الوحدات', 'تقارير متقدمة', 'دعم أولوية', 'نسخ احتياطي يومي'],
  },
  {
    name: 'الأعمال', price: '٩٩٠', unit: 'ج.م/شهر', popular: false, enterprise: false,
    desc: 'للمؤسسات والتجار الكبار',
    features: ['حتى ٥٠ مستخدماً', 'مخازن غير محدودة', 'جميع الوحدات', 'تقارير مخصصة', 'مدير حساب مخصص', 'SLA مضمون'],
  },
  {
    name: 'المؤسسات', price: null, unit: '', popular: false, enterprise: true,
    desc: 'للمجموعات والسلاسل التجارية',
    features: ['مستخدمون غير محدودين', 'فروع ومخازن غير محدودة', 'تكاملات مخصصة', 'تدريب وإعداد مخصص', 'عقد SLA مضمون', 'دعم على مدار الساعة'],
  },
];

const FAQ_ITEMS = [
  { q: 'هل يدعم مُحكم إدارة متعددة الفروع؟', a: 'نعم، يمكنك إدارة فروع ومخازن متعددة من لوحة تحكم مركزية واحدة مع تقارير منفصلة لكل فرع.' },
  { q: 'هل بياناتي آمنة؟', a: 'نعم، نستخدم تشفير TLS لجميع الاتصالات، وكل شركة معزولة تماماً عن الأخرى، مع نسخ احتياطية يومية.' },
  { q: 'هل يمكنني استيراد البيانات من Excel؟', a: 'نعم، ندعم استيراد المنتجات والعملاء والموردين من ملفات Excel وCSV بشكل مباشر.' },
  { q: 'ما الفرق بين خطط الاشتراك؟', a: 'تختلف الخطط في عدد المستخدمين المسموح بهم، وعدد المخازن، وإمكانية الوصول للوحدات المتقدمة كالتقارير المخصصة.' },
  { q: 'هل هناك دعم فني متاح؟', a: 'نعم، نقدم دعماً فنياً عبر الواتساب مباشرة. خطة المتوسطة والأعمال تشمل دعم أولوية على مدار الساعة.' },
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
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>مُحكم</span>
            </div>

            <div className="lp-nav-links" style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: 4 }}>
              {links.map(([id, lbl]) => (
                <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="lp-nav-link" style={{ padding: '6px 14px', borderRadius: 100 }}>{lbl}</a>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <div className="lp-nav-links" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={onLogin}    className="lp-btn-outline" style={{ height: 40, padding: '0 16px', fontSize: 13 }}>تسجيل الدخول</button>
              <button onClick={onRegister} className="lp-btn-primary" style={{ height: 40, padding: '0 18px', fontSize: 13 }}>سجّل الآن</button>
            </div>

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
    <section style={{ paddingTop: 84, paddingBottom: 72, background: C.bg }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>

          {/* Text — first = RIGHT in RTL */}
          <div className="lp-hero-text" style={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: C.primaryBg, border: `1px solid #BFDBFE`, borderRadius: 100, padding: '5px 14px', fontSize: 13, fontWeight: 600, color: C.primary, marginBottom: 24, animation: 'lp-up .5s ease both' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
              نظام واحد لإدارة عملك بالكامل
            </div>

            <h1 style={{ fontSize: 'clamp(36px,4.8vw,62px)', fontWeight: 800, color: C.text, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 20, textAlign: 'right', animation: 'lp-up .5s .06s ease both' }}>
              نظّم أعمالك...<br />
              <span style={{ color: C.primary }}>من البيع إلى الميزانية.</span>
            </h1>

            <p style={{ fontSize: 17, color: C.sub, lineHeight: 1.85, marginBottom: 32, maxWidth: 460, textAlign: 'right', animation: 'lp-up .5s .10s ease both' }}>
              محكم منصة ERP عربية لإدارة المبيعات، المخزون، الحسابات، الصيانة والموظفين من مكان واحد.
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, animation: 'lp-up .5s .14s ease both', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={onRegister} className="lp-btn-primary lp-btn-primary-lg">ابدأ مجانًا — ٧ أيام</button>
              <button onClick={onLogin}    className="lp-btn-outline" style={{ height: 52, padding: '0 26px', fontSize: 15, borderRadius: 10 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                شاهد النظام
              </button>
            </div>

            <div className="lp-hero-checks" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end', animation: 'lp-up .5s .18s ease both' }}>
              {['لا تحتاج بطاقة ائتمان', 'إعداد سريع', 'دعم مباشر'].map((c) => (
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
    <section id="features" style={{ padding: '88px 0', background: C.surface }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionHeader
            center
            eyebrow="التطبيقات"
            title="كل ما تحتاجه في منصة واحدة"
            sub="مُحكم يغطي جميع احتياجات إدارة محلك أو شركتك — من المبيعات والمخزون وحتى الحسابات والموظفين."
          />
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
    <section style={{ padding: '72px 0', background: '#0F172A', overflow: 'hidden' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
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
    <section style={{ padding: '72px 0', background: C.bg }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 64, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Text — first = RIGHT in RTL */}
          <div className="lp-reveal" style={{ flex: '0 0 44%', minWidth: 280 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>تطبيق الجوال</div>
            <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, color: C.text, letterSpacing: '-0.025em', marginBottom: 14 }}>
              مُحكم في جيبك — أينما كنت
            </h2>
            <p style={{ fontSize: 16, color: C.sub, lineHeight: 1.8, marginBottom: 28 }}>
              تطبيق مُحكم للجوال يتيح لك إدارة مبيعاتك وعرض التقارير ومتابعة فريقك من أي مكان.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['عرض لوحة التحكم ومؤشرات الأداء', 'إصدار الفواتير من الجوال مباشرة', 'استعراض المخزون وإنشاء طلبات الشراء', 'متابعة حالة طلبات الصيانة'].map((f) => (
                <span key={f} className="lp-check" style={{ fontSize: 14 }}>{f}</span>
              ))}
            </div>
          </div>

          {/* Mockup — second = LEFT in RTL */}
          <div className="lp-reveal lp-d2" style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 240 }}>
            <div style={{ width: 220, borderRadius: 32, overflow: 'hidden', boxShadow: '0 32px 64px rgba(15,23,42,.2)', border: '8px solid #1E293B', background: '#0F1117', position: 'relative' }}>
              <div style={{ height: 28, background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 9, color: '#6B7280', fontFamily: 'Inter, monospace' }}>
                <span>٩:٤١</span>
                <span>● ● ▌</span>
              </div>
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
                    { n: 'iPhone 15 Pro', v: '٢٥٫٥٠٠ ج.م', c: '#22C55E' },
                    { n: 'Samsung S24',   v: '١٨٫٩٠٠ ج.م', c: '#22C55E' },
                    { n: 'MacBook Air',   v: '٣٢٫٠٠٠ ج.م', c: '#F59E0B' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? '1px solid #252530' : 'none', fontSize: 9 }}>
                      <span style={{ color: '#A1A1AA' }}>{r.n}</span>
                      <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', background: '#141418', borderRadius: 12, padding: '8px 0', border: '1px solid #252530', marginTop: 8 }}>
                  {['🏠','📦','💰','👤'].map((ic) => (
                    <div key={ic} style={{ fontSize: 16, textAlign: 'center', padding: '4px 8px' }}>{ic}</div>
                  ))}
                </div>
              </div>
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
  return (
    <section id="pricing" style={{ padding: '88px 0', background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center' }}>
          <SectionHeader center eyebrow="الأسعار" title="خطط واضحة بلا رسوم خفية" sub="ابدأ مجاناً لمدة ٧ أيام. لا تحتاج بطاقة ائتمان." />
        </div>
        <div className="lp-pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          {PLANS.map((p, i) => (
            <div key={i} className={`lp-pricing-card lp-reveal lp-d${Math.min(i + 1, 4) as 1|2|3|4}${p.popular ? ' lp-pricing-card-popular' : ''}`}>
              {p.popular && <div className="lp-popular-badge">الأكثر شعبية</div>}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{p.desc}</div>
              </div>

              {p.enterprise ? (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', marginBottom: 4 }}>تواصل معنا</div>
                  <div style={{ fontSize: 12, color: C.muted }}>سعر مخصص حسب الاحتياج</div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: p.popular ? C.primary : C.text, letterSpacing: '-0.03em' }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: C.sub }}>{p.unit}</span>
                </div>
              )}

              {p.enterprise ? (
                <a href="https://wa.me/201080902020" target="_blank" rel="noopener noreferrer"
                  className="lp-btn-outline"
                  style={{ width: '100%', height: 46, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                  واتساب: 01080902020
                </a>
              ) : (
                <button onClick={onRegister} className={p.popular ? 'lp-btn-primary' : 'lp-btn-outline'} style={{ width: '100%', height: 46, marginBottom: 20 }}>
                  ابدأ مجاناً
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.features.map((f) => (
                  <span key={f} className="lp-check" style={{ fontSize: 12 }}>{f}</span>
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
    <section id="faq" style={{ padding: '88px 0', background: C.bg }}>
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
   Footer
══════════════════════════════════════════════ */
function FooterSection({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer style={{ background: '#0F172A', color: '#94A3B8', padding: '56px 0 32px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 48, marginBottom: 48 }}>

          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 14 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.03em' }}>مُحكم</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: '#64748B', maxWidth: 300 }}>
              منصة ERP عربية لإدارة أعمالك من البيع إلى الحسابات.
            </p>
            <a
              href="https://wa.me/201080902020"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, color: '#22C55E', fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'opacity .15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '.8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#22C55E" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              واتساب: 01080902020
            </a>
          </div>

          {/* Links column */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 18, letterSpacing: '0.05em' }}>روابط سريعة</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'التطبيقات', action: scrollTo('features') },
                { label: 'الأسعار',   action: scrollTo('pricing') },
              ].map(({ label, action }) => (
                <a key={label} href="#" onClick={action}
                  style={{ color: '#64748B', fontSize: 14, textDecoration: 'none', transition: 'color .15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#94A3B8'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748B'; }}
                >{label}</a>
              ))}
            </div>
          </div>

          {/* Account column */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 18, letterSpacing: '0.05em' }}>الحساب</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={onLogin}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748B', fontSize: 14, fontFamily: 'inherit', textAlign: 'right', transition: 'color .15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; }}
              >تسجيل الدخول</button>
              <button onClick={onRegister}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#64748B', fontSize: 14, fontFamily: 'inherit', textAlign: 'right', transition: 'color .15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; }}
              >ابدأ الآن</button>
            </div>
          </div>

        </div>

        {/* Divider + copyright */}
        <div style={{ borderTop: '1px solid #1E293B', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: '#334155' }}>© 2026 محكم. جميع الحقوق محفوظة.</span>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════
   WhatsApp floating button
══════════════════════════════════════════════ */
function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/201080902020"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      style={{
        position: 'fixed',
        bottom: 28,
        left: 28,
        zIndex: 9999,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: '#25D366',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(37,211,102,.4)',
        transition: 'transform .15s, box-shadow .15s',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'scale(1.08)';
        el.style.boxShadow = '0 6px 28px rgba(37,211,102,.55)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 20px rgba(37,211,102,.4)';
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </a>
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
      <FooterSection onLogin={goLogin} onRegister={goRegister} />

      <WhatsAppButton />
    </div>
  );
}
