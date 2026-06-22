/* eslint-disable erp/no-hardcoded-colors -- LandingPage v5: warm white editorial system. Standalone marketing page. */
/**
 * MUHKAM Landing Page — v5 (Blank slate)
 * Design: Warm white · Editorial typography · Product-first · Zero decoration
 * Inspired by: Apple, Linear, Stripe, Qyam — but unmistakably MUHKAM.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { DashboardShot, SalesShot, AccountingShot, RepairShot } from './landing/AppScreenshots';

/* ── CSS ── */
const LP_CSS_ID = 'muhkam-lp-css';
const LP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

@keyframes mh-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}
@keyframes mh-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.mh-reveal {
  opacity: 0;
  transform: translateY(22px);
  transition: opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1);
}
.mh-reveal.mh-in { opacity: 1; transform: none; }
.mh-d1 { transition-delay: .12s; }
.mh-d2 { transition-delay: .22s; }
.mh-d3 { transition-delay: .32s; }

.mh-nav-link {
  font-family: 'Tajawal', sans-serif;
  font-size: 14px; font-weight: 500; color: #7A756E;
  text-decoration: none; transition: color .15s ease;
  white-space: nowrap;
}
.mh-nav-link:hover { color: #151515; }

.mh-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 46px; padding: 0 28px;
  background: #151515; color: #FAF8F5;
  border: none; border-radius: 7px; cursor: pointer;
  font-family: 'Tajawal', sans-serif; font-size: 15px; font-weight: 600;
  letter-spacing: -0.01em; white-space: nowrap;
  transition: background .15s ease;
}
.mh-btn-primary:hover { background: #2A2A2A; }

.mh-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  height: 46px; padding: 0 22px;
  background: transparent; color: #151515;
  border: 1px solid #DDD9D3; border-radius: 7px; cursor: pointer;
  font-family: 'Tajawal', sans-serif; font-size: 14px; font-weight: 500;
  white-space: nowrap; transition: border-color .15s ease;
}
.mh-btn-ghost:hover { border-color: #A8A29E; }

@media (max-width: 900px) {
  .mh-hero-shot  { display: none !important; }
  .mh-cap-shot   { display: none !important; }
  .mh-hero-text  { padding: 120px 32px 80px !important; }
  .mh-nav-desktop { display: none !important; }
  .mh-hamburger  { display: flex !important; }
}
@media (min-width: 901px) {
  .mh-hamburger { display: none !important; }
}
`;

/* ── Palette ── */
const C = {
  bg:     '#FAF8F5',
  text:   '#151515',
  muted:  '#7A756E',
  faint:  '#A8A29E',
  border: '#E7E3DC',
  accent: '#1A56DB',
} as const;

const rule = { border: 'none', borderTop: `1px solid ${C.border}`, margin: 0 } as React.CSSProperties;
const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.18em', textTransform: 'uppercase' as const };

/* ════════════════════════════════════════════
   Component
════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate]  = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const obsRef = useRef<IntersectionObserver | null>(null);

  /* CSS injection */
  useEffect(() => {
    let el = document.getElementById(LP_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = LP_CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = LP_CSS;
    return () => { document.getElementById(LP_CSS_ID)?.remove(); };
  }, []);

  /* Navbar scroll */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* Scroll reveal */
  useEffect(() => {
    obsRef.current = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('mh-in'); obsRef.current?.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.mh-reveal').forEach((el) => obsRef.current?.observe(el));
    return () => { obsRef.current?.disconnect(); };
  }, []);

  const goRegister = () => navigate('/login?tab=register');
  const goLogin    = () => navigate('/login');

  const scrollTo = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  }, []);

  const navLinks: [string, string][] = [
    ['features', 'الميزات'],
    ['pricing',  'الأسعار'],
  ];

  /* ─── RENDER ─── */
  return (
    <div
      dir="rtl"
      style={{ background: C.bg, color: C.text, fontFamily: "'Tajawal', system-ui, sans-serif", minHeight: '100vh', WebkitFontSmoothing: 'antialiased' }}
    >
      {/* ═══════════ NAVBAR ═══════════ */}
      <nav
        style={{
          position: 'fixed', top: 0, insetInline: 0, zIndex: 100,
          height: 64,
          background: scrolled ? 'rgba(250,248,245,.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
          transition: 'background .2s, border-color .2s',
        }}
      >
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 40px', height: '100%', display: 'flex', alignItems: 'center', gap: 40 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>مُحكم</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: '0.17em' }}>ERP</span>
          </div>

          {/* Nav links */}
          <div className="mh-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {navLinks.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="mh-nav-link">{lbl}</a>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Auth buttons */}
          <div className="mh-nav-desktop" style={{ display: 'flex', gap: 8 }}>
            <button onClick={goLogin}    className="mh-btn-ghost"   style={{ height: 38, padding: '0 18px', fontSize: 13 }}>تسجيل الدخول</button>
            <button onClick={goRegister} className="mh-btn-primary" style={{ height: 38, padding: '0 18px', fontSize: 13 }}>ابدأ مجاناً</button>
          </div>

          {/* Hamburger */}
          <button
            className="mh-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'none', flexDirection: 'column', gap: 5 }}
            aria-label="القائمة"
          >
            {[
              { transform: menuOpen ? 'rotate(45deg) translate(5px,5px)'  : 'none' },
              { opacity: menuOpen ? '0' : '1' },
              { transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)' : 'none' },
            ].map((st, i) => (
              <div key={i} style={{ width: 20, height: 1.5, background: C.text, borderRadius: 2, transition: 'all .2s', ...st as React.CSSProperties }} />
            ))}
          </button>
        </div>

        {menuOpen && (
          <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: '20px 40px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {navLinks.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="mh-nav-link" style={{ fontSize: 17 }}>{lbl}</a>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${C.border}`, paddingTop: 20 }}>
              <button onClick={goLogin}    className="mh-btn-ghost"   style={{ width: '100%' }}>تسجيل الدخول</button>
              <button onClick={goRegister} className="mh-btn-primary" style={{ width: '100%' }}>ابدأ مجاناً</button>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>

        {/* Text — first in DOM = RIGHT in RTL */}
        <div
          className="mh-hero-text"
          style={{ flex: '0 0 44%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px 0 48px', paddingTop: 64 }}
        >
          <div style={{ ...eyebrow, marginBottom: 24, animation: 'mh-up .5s ease both' }}>
            منصة إدارة الموارد المؤسسية
          </div>

          <h1
            style={{
              fontSize: 'clamp(48px,7vw,88px)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.08,
              marginBottom: 28,
              animation: 'mh-up .55s .05s ease both',
            }}
          >
            إدارة شركتك.<br />
            <span style={{ color: '#3A3A3A' }}>بالكامل.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(15px,1.4vw,18px)',
              color: C.muted,
              lineHeight: 1.9,
              marginBottom: 44,
              maxWidth: 380,
              animation: 'mh-up .55s .10s ease both',
            }}
          >
            محاسبة، مبيعات، مخزون، موارد بشرية، وصيانة — في منظومة واحدة متكاملة. يعمل من اليوم الأول.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'mh-up .55s .15s ease both', alignItems: 'flex-start' }}>
            <button onClick={goRegister} className="mh-btn-primary" style={{ height: 52, padding: '0 40px', fontSize: 15 }}>
              ابدأ تجربتك المجانية — ٧ أيام
            </button>
            <span style={{ fontSize: 12, color: C.faint }}>بلا بطاقة ائتمان · إلغاء في أي وقت</span>
          </div>
        </div>

        {/* Screenshot — second in DOM = LEFT in RTL */}
        <div
          className="mh-hero-shot"
          style={{ flex: 1, overflow: 'hidden', paddingTop: 64, borderRight: `1px solid ${C.border}` }}
        >
          <DashboardShot />
        </div>
      </section>

      <hr style={rule} />

      {/* ═══════════ CAPABILITY 01: المبيعات ═══════════ */}
      <section id="features" style={{ display: 'flex', height: '80vh', overflow: 'hidden' }}>

        {/* Word — RIGHT */}
        <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px 0 40px' }}>
          <div className="mh-reveal" style={{ ...eyebrow, marginBottom: 20 }}>01</div>
          <div
            className="mh-reveal mh-d1"
            style={{ fontSize: 'clamp(80px,10vw,136px)', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.92, color: C.text }}
          >
            المبيعات
          </div>
          <p className="mh-reveal mh-d2" style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, marginTop: 24, maxWidth: 280 }}>
            نقطة بيع متكاملة. فاتورة في ٣٠ ثانية. تقارير يومية تلقائية.
          </p>
        </div>

        {/* Screenshot — LEFT */}
        <div
          className="mh-reveal mh-d2 mh-cap-shot"
          style={{ flex: 1, padding: '32px 0 32px 40px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}
        >
          <div style={{ height: '100%', borderRadius: '10px 0 0 10px', overflow: 'hidden', border: `1px solid ${C.border}`, borderRight: 'none' }}>
            <SalesShot />
          </div>
        </div>
      </section>

      <hr style={rule} />

      {/* ═══════════ CAPABILITY 02: المحاسبة ═══════════ */}
      <section style={{ display: 'flex', height: '80vh', overflow: 'hidden' }}>

        {/* Screenshot — RIGHT (first DOM = right in RTL) */}
        <div
          className="mh-reveal mh-cap-shot"
          style={{ flex: 1, padding: '32px 40px 32px 0', borderLeft: `1px solid ${C.border}`, overflow: 'hidden' }}
        >
          <div style={{ height: '100%', borderRadius: '0 10px 10px 0', overflow: 'hidden', border: `1px solid ${C.border}`, borderLeft: 'none' }}>
            <AccountingShot />
          </div>
        </div>

        {/* Word — LEFT (second DOM = left in RTL) */}
        <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px 0 64px' }}>
          <div className="mh-reveal" style={{ ...eyebrow, marginBottom: 20 }}>02</div>
          <div
            className="mh-reveal mh-d1"
            style={{ fontSize: 'clamp(72px,9.5vw,128px)', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.92, color: C.text }}
          >
            المحاسبة
          </div>
          <p className="mh-reveal mh-d2" style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, marginTop: 24, maxWidth: 280 }}>
            قيد مزدوج تلقائي. ميزان مراجعة. تقارير مالية كاملة.
          </p>
        </div>
      </section>

      <hr style={rule} />

      {/* ═══════════ CAPABILITY 03: الصيانة ═══════════ */}
      <section style={{ display: 'flex', height: '80vh', overflow: 'hidden' }}>

        {/* Word — RIGHT */}
        <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px 0 40px' }}>
          <div className="mh-reveal" style={{ ...eyebrow, marginBottom: 20 }}>03</div>
          <div
            className="mh-reveal mh-d1"
            style={{ fontSize: 'clamp(80px,10vw,136px)', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 0.92, color: C.text }}
          >
            الصيانة
          </div>
          <p className="mh-reveal mh-d2" style={{ fontSize: 15, color: C.muted, lineHeight: 1.85, marginTop: 24, maxWidth: 280 }}>
            بطاقة لكل جهاز. تتبع IMEI. إشعار العميل تلقائياً.
          </p>
        </div>

        {/* Screenshot — LEFT */}
        <div
          className="mh-reveal mh-d2 mh-cap-shot"
          style={{ flex: 1, padding: '32px 0 32px 40px', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}
        >
          <div style={{ height: '100%', borderRadius: '10px 0 0 10px', overflow: 'hidden', border: `1px solid ${C.border}`, borderRight: 'none' }}>
            <RepairShot />
          </div>
        </div>
      </section>

      <hr style={rule} />

      {/* ═══════════ CTA ═══════════ */}
      <section
        id="pricing"
        style={{ minHeight: '56vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', textAlign: 'center' }}
      >
        <div className="mh-reveal" style={{ ...eyebrow, marginBottom: 32 }}>ابدأ اليوم</div>
        <h2
          className="mh-reveal mh-d1"
          style={{ fontSize: 'clamp(52px,7vw,88px)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.05, marginBottom: 28 }}
        >
          جاهز للبدء؟
        </h2>
        <p
          className="mh-reveal mh-d2"
          style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, marginBottom: 48, maxWidth: 480 }}
        >
          ٧ أيام مجاناً بدون قيود. بلا بطاقة ائتمان. إلغاء في أي وقت.
        </p>
        <div className="mh-reveal mh-d3">
          <button onClick={goRegister} className="mh-btn-primary" style={{ height: 54, padding: '0 52px', fontSize: 16, borderRadius: 8 }}>
            ابدأ تجربتك المجانية
          </button>
        </div>
      </section>

      <hr style={rule} />

      {/* ═══════════ FOOTER ═══════════ */}
      <footer style={{ padding: '24px 0' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: C.accent, letterSpacing: '0.17em' }}>ERP</span>
          </div>
          <span style={{ fontSize: 12, color: C.faint }}>© 2026 مُحكم ERP · جميع الحقوق محفوظة</span>
          <div style={{ display: 'flex', gap: 24 }}>
            {navLinks.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="mh-nav-link" style={{ fontSize: 12 }}>{lbl}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
