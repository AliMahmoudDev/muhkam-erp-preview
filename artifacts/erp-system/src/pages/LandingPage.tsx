/* eslint-disable erp/no-hardcoded-colors -- LandingPage is a standalone marketing page with its own intentional color palette; tokens do not apply here. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  LANDING_CSS, mono, cardSurface,
  STATS, TICKER, NAV_LINKS,
  MiniAccounting, MiniSales, MiniInventory, MiniHR,
  MiniRepair, MiniReports, MiniBank, MiniMobile,
  type BentoItem,
} from './landing';

const CSS = LANDING_CSS;

/* ══════════════════════════════════════════════
   BENTO data (uses extracted mockup components)
══════════════════════════════════════════════ */

const BENTO: BentoItem[] = [
  { title: 'المحاسبة الكاملة', desc: 'قيد مزدوج تلقائي، ميزانية عمومية، وقائمة الدخل بضغطة واحدة.', cls: 'lp-wide', mockup: <MiniAccounting /> },
  { title: 'المبيعات ونقطة البيع', desc: 'فواتير لحظية، POS متكامل، خصومات وتقارير يومية.', cls: '', mockup: <MiniSales /> },
  { title: 'إدارة المخزون', desc: 'تتبع الكميات في الوقت الفعلي مع تنبيهات النفاد.', cls: '', mockup: <MiniInventory /> },
  { title: 'الموارد البشرية', desc: 'الرواتب، المكافآت، الحضور، والإجازات في مكان واحد.', cls: 'lp-wide', mockup: <MiniHR /> },
  { title: 'وحدة الصيانة', desc: 'بطاقات IMEI، تعيين الفنيين، وتتبع الحالات.', cls: '', mockup: <MiniRepair /> },
  { title: 'التقارير والتحليلات', desc: 'لوحة تحكم تفاعلية ومؤشرات أداء رئيسية.', cls: '', mockup: <MiniReports /> },
  { title: 'المطابقة البنكية', desc: 'ربط الحسابات البنكية ومطابقة تلقائية.', cls: '', mockup: <MiniBank /> },
  { title: 'تطبيق موبايل لفريقك بالكامل', desc: 'iOS و Android — حضور GPS، بطاقات صيانة، فواتير، ومتابعة الأداء.', cls: 'lp-full', mockup: <MiniMobile /> },
];

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState<number[]>(() => STATS.map(s => s.kind === 'num' ? 0 : 0));
  const countDone = useRef(false);
  const statsEl = useRef<HTMLDivElement>(null);
  const chartEl = useRef<HTMLDivElement>(null);
  const obsRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (document.getElementById('muhkam-lp-css')) return;
    const s = document.createElement('style');
    s.id = 'muhkam-lp-css';
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const startCount = useCallback(() => {
    if (countDone.current) return;
    countDone.current = true;
    const targets = STATS.map(s => s.kind === 'num' ? s.end : 0);
    const dur = 1800;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCounts(targets.map(v => Number((v * ease).toFixed(1))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    obsRef.current = new IntersectionObserver(
      entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('lp-in'); obsRef.current?.unobserve(en.target); }
      }), { threshold: 0.1 }
    );
    document.querySelectorAll('.lp-fade').forEach(el => obsRef.current?.observe(el));

    const so = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { startCount(); en.target.classList.add('lp-stats-live'); so.unobserve(en.target); }
    }), { threshold: 0.4 });
    if (statsEl.current) so.observe(statsEl.current);

    const co = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('lp-chart-live'); co.unobserve(en.target); }
    }), { threshold: 0.3 });
    if (chartEl.current) co.observe(chartEl.current);

    return () => { obsRef.current?.disconnect(); so.disconnect(); co.disconnect(); };
  }, [startCount]);

  const goLogin = () => navigate('/login');
  const goRegister = () => navigate('/login?tab=register');

  const scrollToId = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const fmtCount = (i: number) => String(Math.floor(counts[i]));

  return (
    <div style={{ background: '#0F172A', color: '#F8FAFC', minHeight: '100vh', ...mono }}>
      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        transition: 'all .25s ease',
        background: scrolled ? 'rgba(15, 23, 42, 0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid #1E293B' : '1px solid transparent',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>مُحكم</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', letterSpacing: '0.08em' }}>ERP</div>
          </div>

          <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="lp-link" style={{ fontSize: 14, fontWeight: 500 }}>{lbl}</a>
            ))}
          </div>

          <div className="lp-nav-btns" style={{ display: 'flex', gap: 10 }}>
            <button onClick={goLogin} className="lp-btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>تسجيل الدخول</button>
            <button onClick={goRegister} className="lp-btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>ابدأ مجاناً</button>
          </div>

          {/* Hamburger */}
          <button
            className="lp-hamburger"
            onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={menuOpen}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#F8FAFC', padding: 8,
              display: 'none', flexDirection: 'column', gap: 5,
            }}>
            {[
              { transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' },
              { transform: 'none', opacity: menuOpen ? '0' : '1' },
              { transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' },
            ].map((s, i) => (
              <div key={i} style={{ width: 22, height: 2, background: '#F8FAFC', borderRadius: 2, transition: 'all .25s', ...s }} />
            ))}
          </button>
        </div>

        {menuOpen && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(12px)',
            borderTop: '1px solid #1E293B', padding: '16px 28px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{
                color: '#CBD5E1', padding: '10px 0',
                borderBottom: '1px solid #1E293B',
                textDecoration: 'none', fontSize: 15, fontWeight: 500,
              }}>{lbl}</a>
            ))}
            <button onClick={goRegister} className="lp-btn-primary" style={{ marginTop: 4, height: 44 }}>ابدأ تجربتك المجانية</button>
          </div>
        )}
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section dir="rtl" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '128px 28px 96px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(180deg, #0F172A 0%, #0B1220 100%)',
      }}>
        {/* Subtle radial accents */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%', width: '60%', height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-15%', width: '60%', height: '60%',
          background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: 820, width: '100%' }}>
          {/* Eyebrow badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999,
            border: '1px solid #1E293B', background: '#0F172A',
            color: '#94A3B8', fontSize: 12, fontWeight: 600, marginBottom: 28,
            animation: 'lp-fade-up .5s ease both',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
            <span>نظام ERP عربي متكامل</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(2.1rem, 5.4vw, 3.9rem)',
            fontWeight: 800, lineHeight: 1.12, marginBottom: 24,
            letterSpacing: '-0.025em',
            animation: 'lp-fade-up .55s .05s ease both',
          }}>
            <span style={{ display: 'block', color: '#F8FAFC' }}>أدِر شركتك</span>
            <span style={{ display: 'block', color: '#60A5FA' }}>بمنصة موحّدة وذكية</span>
          </h1>

          <p style={{
            color: '#94A3B8', fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
            lineHeight: 1.7, maxWidth: 600, margin: '0 auto 36px',
            animation: 'lp-fade-up .6s .1s ease both',
          }}>
            مُحكم ERP — نظام متكامل للمبيعات، المحاسبة، الموارد البشرية، والصيانة.
            مصمم خصيصاً للشركات الصغيرة والمتوسطة في السوق العربي.
          </p>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 28,
            animation: 'lp-fade-up .65s .15s ease both',
          }}>
            <button onClick={goRegister} className="lp-btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
              ابدأ تجربتك المجانية
            </button>
            <button onClick={scrollToId('features') as unknown as React.MouseEventHandler<HTMLButtonElement>} className="lp-btn-secondary" style={{ padding: '14px 28px', fontSize: 15 }}>
              استكشف الميزات
            </button>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px',
            color: '#64748B', fontSize: 13,
            animation: 'lp-fade-up .7s .2s ease both',
          }}>
            {['7 أيام مجاناً', 'بدون بطاقة ائتمان', 'دعم عربي 24/7'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Hero mockup */}
        <div className="lp-hero-mockup" ref={chartEl} style={{
          position: 'relative', zIndex: 10, marginTop: 70, width: '100%', maxWidth: 880,
          animation: 'lp-fade-up .8s .3s ease both',
        }}>
          <div style={{
            ...cardSurface,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset',
            overflow: 'hidden',
          }}>
            {/* Window chrome */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 18px',
              background: '#0B1220',
              borderBottom: '1px solid #1E293B',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  background: '#0F172A', borderRadius: 6, padding: '4px 18px',
                  fontSize: 11, color: '#64748B', fontFamily: "'Inter', monospace",
                  border: '1px solid #1E293B',
                }}>dashboard.muhkam.app</div>
              </div>
            </div>
            {/* Mock dashboard */}
            <div style={{ display: 'flex', height: 320 }}>
              {/* Sidebar */}
              <div style={{
                width: 180, borderLeft: '1px solid #1E293B', padding: '18px 12px',
                display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0,
                background: '#0B1220',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14, padding: '0 6px' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#F8FAFC' }}>مُحكم</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#3B82F6', letterSpacing: '0.08em' }}>ERP</span>
                </div>
                {([['لوحة التحكم', true], ['المبيعات', false], ['المخزون', false], ['الصيانة', false], ['الموظفون', false], ['التقارير', false]] as [string, boolean][]).map(([lbl, active], i) => (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 6,
                    background: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    fontSize: 12, color: active ? '#60A5FA' : '#94A3B8',
                    fontWeight: active ? 600 : 500,
                  }}>{lbl}</div>
                ))}
              </div>
              {/* Main */}
              <div style={{ flex: 1, padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                  {([['المبيعات', '٨٥٬٣٠٠ ج', '+ ٢٣٪'], ['العملاء', '١٬٢٤٨', '+ ١٢٪'], ['الأرباح', '٢٩٬٤٠٠ ج', '+ ١٨٪']] as [string, string, string][]).map(([lbl, val, chg]) => (
                    <div key={lbl} style={{ background: '#0B1220', borderRadius: 8, border: '1px solid #1E293B', padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>{lbl}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 3 }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>{chg}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#0B1220', borderRadius: 8, border: '1px solid #1E293B', padding: '14px 18px' }}>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 14 }}>المبيعات — آخر 6 أشهر</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, height: 110 }}>
                    {[42, 65, 52, 78, 60, 95].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div className="lp-bar" style={{
                          width: '100%', height: `${h}%`, borderRadius: '4px 4px 0 0',
                          animationDelay: `${i * 0.08}s`,
                          background: i === 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.3)',
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TICKER ═══════════════ */}
      <div style={{ borderTop: '1px solid #1E293B', borderBottom: '1px solid #1E293B', background: '#0B1220', padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 32, whiteSpace: 'nowrap', animation: 'lp-marquee 24s linear infinite', width: 'max-content' }}>
          {[...TICKER, ...TICKER, ...TICKER].map((item, i) => (
            <span key={i} style={{ fontSize: 13, fontWeight: 600, color: item === '·' ? '#3B82F6' : '#64748B' }}>{item}</span>
          ))}
        </div>
      </div>

      {/* ═══════════════ STATS ═══════════════ */}
      <section dir="rtl" ref={statsEl} style={{ background: '#0F172A', borderBottom: '1px solid #1E293B', padding: '96px 28px' }}>
        <div className="lp-grid-4" style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 28, textAlign: 'center' }}>
          {STATS.map((s, i) => (
            <div key={i} className={`lp-fade lp-d${i + 1}`}>
              <div style={{ fontSize: 'clamp(1.6rem, 3.6vw, 2.6rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: 10, letterSpacing: '-0.02em' }}>
                {s.kind === 'num' ? (
                  <>
                    <span className="lp-stat-num" style={{ color: '#F8FAFC', animationDelay: `${i * 0.1}s` }}>{fmtCount(i)}</span>
                    <span style={{ color: '#3B82F6', fontSize: '0.65em' }}>{s.suffix}</span>
                  </>
                ) : (
                  <span style={{ color: '#F8FAFC' }}>{s.text}</span>
                )}
              </div>
              <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ BENTO FEATURES ═══════════════ */}
      <section id="features" dir="rtl" style={{ padding: '136px 28px', background: '#0F172A' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div className="lp-fade" style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 999,
              border: '1px solid #1E293B', background: '#0B1220',
              color: '#94A3B8', fontSize: 12, fontWeight: 600, marginBottom: 20,
            }}>كل ما تحتاجه شركتك</div>
            <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 800, color: '#F8FAFC', marginBottom: 16, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              نظام متكامل. منصة واحدة.
            </h2>
            <p style={{ color: '#94A3B8', fontSize: 16, maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>
              من إصدار الفواتير إلى احتساب الرواتب — كل وحدة مترابطة بإحكام لتمنحك صورة دقيقة عن أعمالك.
            </p>
          </div>

          <div className="lp-bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {BENTO.map((f, i) => (
              <div
                key={i}
                className={`lp-card lp-fade lp-d${(i % 6) + 1} ${f.cls}`}
                style={{
                  ...cardSurface,
                  padding: '24px 22px',
                  display: 'flex', flexDirection: 'column',
                  gridColumn: f.cls === 'lp-full' ? '1/-1' : f.cls === 'lp-wide' ? 'span 2' : 'span 1',
                }}
              >
                <h3 style={{
                  fontSize: f.cls === 'lp-full' ? 18 : 16,
                  fontWeight: 700, color: '#F8FAFC', marginBottom: 8, lineHeight: 1.3,
                  letterSpacing: '-0.01em',
                }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, color: '#94A3B8', lineHeight: 1.65 }}>{f.desc}</p>

                {/* Mini mockup preview */}
                {f.mockup}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURE SPOTLIGHT — Repair ═══════════════ */}
      <section dir="rtl" style={{ padding: '90px 28px', background: '#0B1220', borderTop: '1px solid #1E293B', borderBottom: '1px solid #1E293B' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 100 }}>

          <div className="lp-spotlight lp-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 999,
                background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#60A5FA', fontSize: 12, fontWeight: 600, marginBottom: 18,
              }}>وحدة الصيانة</div>
              <h2 style={{ fontSize: 'clamp(1.8rem, 3.6vw, 2.6rem)', fontWeight: 800, color: '#F8FAFC', marginBottom: 18, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                تتبّع كل جهاز.<br/>كل فني. كل لحظة.
              </h2>
              <p style={{ color: '#94A3B8', fontSize: 15, lineHeight: 1.75, marginBottom: 28 }}>
                بطاقات صيانة كاملة مع تتبّع IMEI، تعيين الفنيين، حالات متعددة، وتقارير PDF احترافية.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['تتبّع IMEI والسيريال', 'إشعارات WhatsApp تلقائية', 'بطاقات QR للعملاء', 'لوحة فنيين متكاملة'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#CBD5E1' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ ...cardSurface, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>بطاقة صيانة #1042</span>
                <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60A5FA', fontSize: 11, fontWeight: 600 }}>قيد الإصلاح</span>
              </div>
              {[['الجهاز', 'iPhone 15 Pro Max'], ['العميل', 'محمد عبد الرحمن'], ['الفني', 'أحمد حسن'], ['العطل', 'شاشة مكسورة'], ['التكلفة', '٨٥٠ جنية']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1E293B', fontSize: 13.5 }}>
                  <span style={{ color: '#64748B' }}>{k}</span>
                  <span style={{ color: '#E2E8F0', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#1E293B', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '65%', background: '#3B82F6', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: '#60A5FA', fontWeight: 600 }}>٦٥٪</span>
              </div>
            </div>
          </div>

          {/* Spotlight 2 — Accounting */}
          <div className="lp-spotlight lp-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', direction: 'ltr' }}>
            <div style={{ ...cardSurface, padding: 24, direction: 'rtl' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5 }}>إجمالي الإيرادات</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                  ١٢٤٬٨٠٠ <span style={{ fontSize: 14, color: '#64748B', fontWeight: 400 }}>جنية</span>
                </div>
                <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 4 }}>↑ ٢٣٪ من الشهر السابق</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {([['المصروفات', '٤٨٬٢٠٠ ج', '#EF4444'], ['صافي الربح', '٧٦٬٦٠٠ ج', '#10B981']] as [string, string, string][]).map(([l, v, c]) => (
                  <div key={l} style={{ background: '#0B1220', borderRadius: 8, padding: '12px 14px', border: '1px solid #1E293B' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 5 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              {([['المبيعات', 78], ['المشتريات', 45], ['المصاريف', 32]] as [string, number][]).map(([n, val]) => (
                <div key={n} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                    <span>{n}</span><span>{val}٪</span>
                  </div>
                  <div style={{ height: 5, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${val}%`, background: '#3B82F6', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ direction: 'rtl' }}>
              <div style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 999,
                background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
                color: '#60A5FA', fontSize: 12, fontWeight: 600, marginBottom: 18,
              }}>المحاسبة الكاملة</div>
              <h2 style={{ fontSize: 'clamp(1.8rem, 3.6vw, 2.6rem)', fontWeight: 800, color: '#F8FAFC', marginBottom: 18, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                محاسبة دقيقة.<br/>بدون تعقيد.
              </h2>
              <p style={{ color: '#94A3B8', fontSize: 15, lineHeight: 1.75, marginBottom: 28 }}>
                قيد مزدوج تلقائي، ميزانية عمومية، قائمة الدخل، ومراكز التكلفة. كل شيء بنقرة واحدة.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['قيد مزدوج تلقائي', 'ربط بنكي مباشر', 'تقارير ضريبية', 'مراكز التكلفة'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#CBD5E1' }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section id="pricing" dir="rtl" style={{ padding: '110px 28px', background: '#0F172A' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div className="lp-fade" style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.8rem)', fontWeight: 800, color: '#F8FAFC', marginBottom: 12, letterSpacing: '-0.02em' }}>
              خطة تناسب حجمك
            </h2>
            <p style={{ color: '#94A3B8', fontSize: 16 }}>ابدأ مجاناً لمدة 7 أيام — بدون بطاقة ائتمان</p>
          </div>

          <div className="lp-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            {/* Plan 1 — Pro */}
            <div className="lp-fade lp-d1" style={{
              ...cardSurface,
              padding: 32, display: 'flex', flexDirection: 'column',
            }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 6, letterSpacing: '-0.01em' }}>MUHKAM Pro</h3>
              <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 28 }}>للشركات الصغيرة والمتوسطة</p>
              <ul style={{ flex: 1, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {['المبيعات والمشتريات', 'إدارة المخزون', 'العملاء والموردون', 'التقارير الأساسية', 'نقطة البيع POS', 'دعم عربي'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#CBD5E1' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button onClick={goRegister} className="lp-btn-secondary" style={{ width: '100%', height: 44 }}>ابدأ مجاناً</button>
              <p style={{ textAlign: 'center', color: '#64748B', fontSize: 12, marginTop: 14 }}>7 أيام تجريبية — بدون بطاقة</p>
            </div>

            {/* Plan 2 — Advanced (highlighted) */}
            <div className="lp-fade lp-d2" style={{
              borderRadius: 14, padding: 1,
              background: 'linear-gradient(180deg, #3B82F6, #2563EB)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                padding: '4px 14px', borderRadius: 999,
                background: '#3B82F6', color: '#FFFFFF',
                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 1,
              }}>الأكثر طلباً</div>
              <div style={{
                background: '#0B1220', borderRadius: 13, padding: 32,
                display: 'flex', flexDirection: 'column', height: '100%',
              }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', marginBottom: 6, letterSpacing: '-0.01em' }}>MUHKAM Advanced</h3>
                <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 28 }}>للشركات التي تحتاج كل شيء</p>
                <ul style={{ flex: 1, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {['كل ما في Pro +', 'المحاسبة الكاملة + القيد المزدوج', 'الموارد البشرية والرواتب', 'وحدة الصيانة والأجهزة', 'تطبيق موبايل (iOS و Android)', 'المطابقة البنكية', 'الميزانيات ومراكز التكلفة'].map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: item === 'كل ما في Pro +' ? '#60A5FA' : '#E2E8F0', fontWeight: item === 'كل ما في Pro +' ? 600 : 500 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button onClick={goRegister} className="lp-btn-primary" style={{ width: '100%', height: 44 }}>ابدأ مجاناً</button>
                <p style={{ textAlign: 'center', color: '#64748B', fontSize: 12, marginTop: 14 }}>7 أيام تجريبية — بدون بطاقة</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section dir="rtl" style={{
        padding: '144px 28px', textAlign: 'center',
        background: 'linear-gradient(180deg, #0F172A 0%, #0B1220 100%)',
        borderTop: '1px solid #1E293B',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '70%', height: '70%',
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div className="lp-fade" style={{ position: 'relative', zIndex: 10, maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', fontWeight: 800, color: '#F8FAFC',
            marginBottom: 18, lineHeight: 1.15, letterSpacing: '-0.025em',
          }}>
            جاهز لتحويل <span style={{ color: '#60A5FA' }}>شركتك؟</span>
          </h2>
          <p style={{ color: '#94A3B8', fontSize: 17, marginBottom: 36, lineHeight: 1.6 }}>
            ابدأ رحلتك مع نظام ERP عربي متكامل — كل ما تحتاجه شركتك في منصة واحدة.
          </p>
          <button onClick={goRegister} className="lp-btn-primary" style={{ padding: '16px 40px', fontSize: 16 }}>
            ابدأ تجربتك المجانية الآن
          </button>
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', gap: 24, color: '#64748B', fontSize: 13, flexWrap: 'wrap' }}>
            {['7 أيام مجاناً', 'بدون بطاقة', 'إلغاء في أي وقت'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer dir="rtl" style={{
        padding: '36px 28px', background: '#0B1220',
        borderTop: '1px solid #1E293B', position: 'relative',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.02em' }}>مُحكم</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', letterSpacing: '0.08em' }}>ERP</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="lp-link" style={{ fontSize: 13 }}>{lbl}</a>
            ))}
            <button onClick={goLogin} className="lp-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, ...mono }}>تسجيل الدخول</button>
          </div>
          <p style={{ color: '#475569', fontSize: 12 }}>© 2026 مُحكم ERP — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
