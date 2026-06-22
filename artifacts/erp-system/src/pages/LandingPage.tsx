/* eslint-disable erp/no-hardcoded-colors -- LandingPage v4: standalone marketing page with intentional color palette. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  LANDING_CSS,
  mono,
  NAV_LINKS,
  MiniAccounting,
  MiniSales,
  MiniInventory,
  MiniHR,
  MiniRepair,
  MiniReports,
} from './landing';

const CSS = LANDING_CSS;

/* ── Palette ── */
const C = {
  bg:       '#09090B',
  surface:  '#111115',
  border:   '#1C1C21',
  border2:  '#27272A',
  text1:    '#F8F8FA',
  text2:    '#A1A1AA',
  text3:    '#71717A',
  text4:    '#52525B',
  text5:    '#3F3F46',
  accent:   '#6366F1',
  accentHover: '#4F46E5',
} as const;

/* ── Static data ── */
const TRUST = [
  { value: 'ERP كامل',   label: 'حلّ موحّد لكل أقسام شركتك' },
  { value: 'عربي أصيل', label: 'واجهة RTL من الأساس، لا ترجمة' },
  { value: '٧ أيام',     label: 'تجربة مجانية بلا بطاقة ائتمان' },
  { value: '٢٤/٧',       label: 'دعم تقني متواصل' },
] as const;

type Feat = { num: string; title: string; desc: string; Mockup: () => React.ReactElement };
const FEATURES: Feat[] = [
  { num: '01', title: 'المحاسبة الكاملة',    desc: 'قيد مزدوج تلقائي. ميزان مراجعة. قائمة الدخل بضغطة واحدة.',      Mockup: MiniAccounting },
  { num: '02', title: 'المبيعات ونقطة البيع', desc: 'فواتير لحظية. POS متكامل. تقارير يومية تلقائية.',               Mockup: MiniSales },
  { num: '03', title: 'إدارة المخزون',        desc: 'تتبع الكميات في الوقت الفعلي. تنبيهات النفاد الفوري.',          Mockup: MiniInventory },
  { num: '04', title: 'الموارد البشرية',       desc: 'الرواتب والمكافآت والحضور والإجازات في مكان واحد.',             Mockup: MiniHR },
  { num: '05', title: 'وحدة الصيانة',         desc: 'بطاقات IMEI وتعيين الفنيين وتتبع حالات الإصلاح بدقة.',         Mockup: MiniRepair },
  { num: '06', title: 'التقارير والتحليلات',   desc: 'لوحة تحكم تفاعلية ومؤشرات أداء رئيسية فورية.',                Mockup: MiniReports },
];

/* ── Shared styles ── */
const s = {
  maxW: { maxWidth: 1120, margin: '0 auto', padding: '0 32px' } as React.CSSProperties,
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    color: C.accent,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
  },
  sectionTitle: {
    fontSize: 'clamp(28px, 3.5vw, 44px)',
    fontWeight: 700,
    color: C.text1,
    letterSpacing: '-0.025em',
    lineHeight: 1.2,
  } as React.CSSProperties,
};

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate]  = useLocation();
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const obsRef      = useRef<IntersectionObserver | null>(null);

  /* Inject CSS */
  useEffect(() => {
    if (document.getElementById('muhkam-lp-css')) return;
    const el = document.createElement('style');
    el.id = 'muhkam-lp-css';
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  /* Scroll detection */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* Scroll-reveal observer */
  useEffect(() => {
    obsRef.current = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('v4-in');
          obsRef.current?.unobserve(en.target);
        }
      }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.v4-reveal').forEach((el) => obsRef.current?.observe(el));
    return () => { obsRef.current?.disconnect(); };
  }, []);

  const goLogin    = () => navigate('/login');
  const goRegister = () => navigate('/login?tab=register');

  const scrollToId = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }, []);

  /* ─────────────────────────────── RENDER ─────────────────────────────── */
  return (
    <div dir="rtl" style={{ background: C.bg, color: C.text1, minHeight: '100vh', ...mono }}>

      {/* ════════════════ NAVBAR ════════════════ */}
      <nav
        style={{
          position: 'fixed', top: 0, insetInline: 0, zIndex: 100,
          transition: 'background .25s ease, border-color .25s ease',
          background: scrolled ? 'rgba(9,9,11,.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
        }}
      >
        <div style={{ ...s.maxW, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.text1, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: '0.18em' }}>ERP</span>
          </div>

          {/* Nav links */}
          <div className="v4-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="v4-nav-link">{lbl}</a>
            ))}
          </div>

          {/* Buttons */}
          <div className="v4-nav-btns" style={{ display: 'flex', gap: 8 }}>
            <button onClick={goLogin} className="v4-btn-ghost" style={{ height: 38, padding: '0 18px', fontSize: 13 }}>
              تسجيل الدخول
            </button>
            <button onClick={goRegister} className="v4-btn-primary" style={{ height: 38, padding: '0 18px', fontSize: 13 }}>
              ابدأ مجاناً
            </button>
          </div>

          {/* Hamburger */}
          <button
            className="v4-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={menuOpen}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text1, padding: 8, display: 'none', flexDirection: 'column', gap: 5 }}
          >
            {([
              { transform: menuOpen ? 'rotate(45deg) translate(5px,5px)' : 'none' },
              { transform: 'none', opacity: menuOpen ? '0' : '1' },
              { transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' },
            ] as React.CSSProperties[]).map((st, i) => (
              <div key={i} style={{ width: 20, height: 1.5, background: C.text1, borderRadius: 2, transition: 'all .25s', ...st }} />
            ))}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: 'rgba(9,9,11,.98)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${C.border}`, padding: '20px 32px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="v4-nav-link" style={{ fontSize: 16, color: C.text2 }}>{lbl}</a>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button onClick={goLogin}    className="v4-btn-ghost"   style={{ width: '100%', justifyContent: 'center' }}>تسجيل الدخول</button>
              <button onClick={goRegister} className="v4-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>ابدأ مجاناً</button>
            </div>
          </div>
        )}
      </nav>

      {/* ════════════════ HERO ════════════════ */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Dot grid texture */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `radial-gradient(circle, ${C.border} 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
        {/* Radial mask — fades dots in center */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${C.bg} 20%, transparent 100%)`,
          }}
        />

        {/* Content */}
        <div style={{ position: 'relative', textAlign: 'center', padding: '140px 28px 80px', width: '100%' }}>

          {/* Eyebrow */}
          <div
            style={{ ...s.eyebrow, marginBottom: 28, animation: 'v4-up .55s ease both', animationDelay: '.0s' }}
          >
            نظام إدارة الموارد المؤسسية · مُصمم للعربية
          </div>

          {/* Main headline */}
          <h1
            className="v4-hero-title"
            style={{
              fontSize: 'clamp(52px, 9vw, 108px)',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-0.035em',
              marginBottom: 32,
              animation: 'v4-up .6s .05s ease both',
            }}
          >
            <span style={{ display: 'block', color: C.text1 }}>كل شيء...</span>
            <span style={{ display: 'block', color: C.accent }}>تحت السيطرة.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="v4-hero-sub"
            style={{
              fontSize: 18,
              color: C.text3,
              fontWeight: 400,
              lineHeight: 1.75,
              maxWidth: 500,
              margin: '0 auto 52px',
              animation: 'v4-up .6s .10s ease both',
            }}
          >
            مُحكم ERP — النظام الذي تحتاجه لإدارة شركتك بثقة.<br />
            محاسبة · مبيعات · موارد بشرية · صيانة.
          </p>

          {/* CTAs */}
          <div
            className="v4-hero-cta"
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animation: 'v4-up .6s .15s ease both' }}
          >
            <button onClick={goRegister} className="v4-btn-primary" style={{ height: 52, padding: '0 32px', fontSize: 15, borderRadius: 10 }}>
              ابدأ تجربتك المجانية
            </button>
            <button onClick={goLogin} className="v4-btn-ghost" style={{ height: 52, padding: '0 28px', fontSize: 14, borderRadius: 10 }}>
              تسجيل الدخول
            </button>
          </div>
        </div>

        {/* Scroll hint */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            animation: 'v4-fade 1s .5s ease both',
          }}
        >
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, transparent, ${C.border2})` }} />
        </div>
      </section>

      {/* ════════════════ TRUST STRIP ════════════════ */}
      <div style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div
          className="v4-trust-grid"
          style={{ ...s.maxW, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}
        >
          {TRUST.map((t, i) => (
            <div
              key={i}
              style={{
                padding: '36px 24px',
                textAlign: 'center',
                borderRight: i < TRUST.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <div
                className="v4-trust-divider"
                style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 700, color: C.text1, letterSpacing: '-0.02em', marginBottom: 8 }}
              >
                {t.value}
              </div>
              <div style={{ fontSize: 13, color: C.text4, fontWeight: 500, lineHeight: 1.5 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════ FEATURES ════════════════ */}
      <section id="features" style={{ padding: '120px 0' }}>
        <div style={s.maxW}>

          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }} className="v4-reveal">
            <div style={{ ...s.eyebrow, marginBottom: 18 }}>الوحدات الأساسية</div>
            <h2 style={s.sectionTitle}>كل ما تحتاجه في نظام واحد</h2>
          </div>

          {/* Features grid */}
          <div
            className="v4-features-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}
          >
            {FEATURES.map(({ num, title, desc, Mockup }, i) => (
              <div
                key={num}
                className={`v4-feat-card v4-reveal v4-d${i + 1}`}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '28px 24px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text5, letterSpacing: '0.1em', marginBottom: 18 }}>{num}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.text1, letterSpacing: '-0.015em', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.75, marginBottom: 4 }}>{desc}</div>
                <Mockup />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ SYSTEM PREVIEW ════════════════ */}
      <section style={{ padding: '0 0 120px' }}>
        <div style={s.maxW}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 56 }} className="v4-reveal">
            <div style={{ ...s.eyebrow, marginBottom: 18 }}>معاينة النظام</div>
            <h2 style={s.sectionTitle}>النظام في العمل</h2>
            <p style={{ fontSize: 15, color: C.text3, marginTop: 14, lineHeight: 1.7 }}>
              واجهة حقيقية. لا تصميمات وهمية.
            </p>
          </div>

          {/* App window frame */}
          <div className="v4-reveal v4-d1 v4-preview-frame" style={{ borderRadius: 16, overflow: 'hidden', background: '#0D0D12' }}>

            {/* Window chrome */}
            <div
              style={{
                height: 44,
                background: '#111115',
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 7 }}>
                {['#FF5F57','#FEBC2E','#28C840'].map((c,i) => (
                  <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: .65 }} />
                ))}
              </div>
              <div
                style={{
                  flex: 1,
                  margin: '0 20px',
                  maxWidth: 300,
                  background: '#1C1C21',
                  borderRadius: 6,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  gap: 6,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#27272A' }} />
                <span style={{ fontSize: 11, color: C.text5, fontFamily: "'Inter', monospace", direction: 'ltr' }}>
                  app.muhkam.sa
                </span>
              </div>
            </div>

            {/* Mockup content */}
            <div
              className="v4-preview-grid"
              style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}
            >
              <MiniAccounting />
              <MiniSales />
              <MiniInventory />
              <MiniReports />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ CTA ════════════════ */}
      <section
        id="pricing"
        style={{ padding: '120px 32px', borderTop: `1px solid ${C.border}`, textAlign: 'center' }}
      >
        <div className="v4-reveal" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ ...s.eyebrow, marginBottom: 24 }}>ابدأ اليوم</div>
          <h2
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              color: C.text1,
              marginBottom: 20,
              lineHeight: 1.08,
            }}
          >
            جاهز للبدء؟
          </h2>
          <p style={{ fontSize: 16, color: C.text3, lineHeight: 1.75, marginBottom: 44 }}>
            ٧ أيام مجاناً — بلا قيود، بلا بطاقة ائتمان.<br />
            إلغاء في أي وقت.
          </p>
          <button
            onClick={goRegister}
            className="v4-btn-primary"
            style={{ height: 54, padding: '0 40px', fontSize: 15, borderRadius: 10 }}
          >
            ابدأ تجربتك المجانية
          </button>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '32px 0' }}>
        <div
          className="v4-footer-inner"
          style={{ ...s.maxW, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text1, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: '0.18em' }}>ERP</span>
          </div>

          {/* Copyright */}
          <span style={{ fontSize: 12, color: C.text5 }}>© 2026 مُحكم ERP · جميع الحقوق محفوظة</span>

          {/* Nav links */}
          <div style={{ display: 'flex', gap: 24 }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="v4-nav-link" style={{ fontSize: 13 }}>
                {lbl}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
