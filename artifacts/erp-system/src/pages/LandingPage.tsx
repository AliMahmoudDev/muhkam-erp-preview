/* eslint-disable erp/no-hardcoded-colors -- LandingPage v4.1: standalone marketing page with intentional color palette. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { LANDING_CSS, mono, NAV_LINKS, LiveDashboard } from './landing';

const CSS = LANDING_CSS;

/* ── Palette ── */
const C = {
  bg:      '#09090B',
  surface: '#111115',
  border:  '#1C1C21',
  border2: '#27272A',
  text1:   '#F8F8FA',
  text2:   '#A1A1AA',
  text3:   '#71717A',
  text4:   '#52525B',
  text5:   '#3F3F46',
  accent:  '#6366F1',
} as const;

/* ── Shared ── */
const maxW: React.CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '0 40px' };

const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: C.accent,
  letterSpacing: '0.18em', textTransform: 'uppercase',
};

/* ══════════════════════════════════════════════
   Capability Mockups — large product screenshots
══════════════════════════════════════════════ */

function SalesMockup() {
  const items = [
    { name: 'iPhone 15 Pro Max',  price: '٢٥٫٥٠٠ ج' },
    { name: 'Apple Watch Series 9', price: '٨٫٩٠٠ ج' },
    { name: 'AirPods Pro 2',       price: '٣٫٢٠٠ ج' },
  ];
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', fontFamily: "'Tajawal', system-ui, sans-serif", color: C.text1 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>فاتورة مبيعات</div>
          <div style={{ fontSize: 12, color: C.text4, marginTop: 4 }}>الجمعة، ٢٢ يونيو ٢٠٢٦</div>
        </div>
        <div style={{ padding: '4px 12px', background: 'rgba(34,197,94,.1)', borderRadius: 6, fontSize: 12, color: '#22C55E', fontWeight: 600, border: '1px solid rgba(34,197,94,.2)' }}>
          مكتملة
        </div>
      </div>
      {/* Invoice number */}
      <div style={{ padding: '12px 24px', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 32 }}>
        <div>
          <div style={{ fontSize: 10, color: C.text4, marginBottom: 2 }}>رقم الفاتورة</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, fontFamily: "'Inter', monospace" }}>#INV-2419</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.text4, marginBottom: 2 }}>العميل</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>أحمد محمد علي</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.text4, marginBottom: 2 }}>المخزن</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>المعرض الرئيسي</div>
        </div>
      </div>
      {/* Items */}
      <div style={{ padding: '0 24px' }}>
        <div style={{ padding: '10px 0', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, fontSize: 10, color: C.text4, fontWeight: 600, letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>
          <span>الصنف</span>
          <span>الكمية</span>
          <span>الإجمالي</span>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ padding: '14px 0', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 16, borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <span style={{ fontWeight: 500 }}>{item.name}</span>
            <span style={{ color: C.text3 }}>١</span>
            <span style={{ color: C.accent, fontWeight: 600, direction: 'ltr' }}>{item.price}</span>
          </div>
        ))}
      </div>
      {/* Totals */}
      <div style={{ padding: '14px 24px', background: C.bg, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'المجموع', val: '٣٧٫٦٠٠ ج', muted: true },
          { label: 'ضريبة القيمة المضافة (١٥٪)', val: '٥٫٦٤٠ ج', muted: true },
          { label: 'الإجمالي النهائي', val: '٤٣٫٢٤٠ ج', muted: false },
        ].map(({ label, val, muted }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: muted ? 12 : 15, color: muted ? C.text3 : C.text1, fontWeight: muted ? 400 : 700 }}>
            <span>{label}</span>
            <span style={{ direction: 'ltr', color: muted ? C.text3 : C.accent }}>{val}</span>
          </div>
        ))}
      </div>
      {/* Actions */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 10, borderTop: `1px solid ${C.border}` }}>
        <div style={{ flex: 1, height: 42, background: C.accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'default' }}>
          تأكيد الفاتورة
        </div>
        <div style={{ height: 42, padding: '0 20px', border: `1px solid ${C.border2}`, borderRadius: 8, display: 'flex', alignItems: 'center', fontSize: 13, color: C.text2, cursor: 'default' }}>
          طباعة
        </div>
      </div>
    </div>
  );
}

function AccountingMockup() {
  const bars = [52, 68, 45, 82, 71, 95];
  const months = ['يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو'];
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', fontFamily: "'Tajawal', system-ui, sans-serif", color: C.text1 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>قائمة الدخل</div>
          <div style={{ fontSize: 12, color: C.text4, marginTop: 4 }}>يونيو ٢٠٢٦ · النصف الأول</div>
        </div>
        <div style={{ padding: '5px 14px', border: `1px solid ${C.border2}`, borderRadius: 7, fontSize: 11, color: C.text3, cursor: 'default' }}>تصدير PDF</div>
      </div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
        {[
          { label: 'الإيرادات',  val: '١٢٤٫٨ ألف', pct: '+١٢٪', c: '#22C55E' },
          { label: 'المصروفات', val: '٤٨٫٢ ألف',  pct: '−٣٪',  c: '#EF4444' },
          { label: 'صافي الربح', val: '٧٦٫٦ ألف',  pct: '+١٨٪', c: C.accent },
        ].map((k, i) => (
          <div key={i} style={{ padding: '18px 20px', borderLeft: i > 0 ? `1px solid ${C.border}` : 'none', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
            <div style={{ fontSize: 10, color: C.text4, marginBottom: 6, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 4 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: k.c, fontWeight: 600 }}>{k.pct} من العام الماضي</div>
          </div>
        ))}
      </div>
      {/* Bar chart */}
      <div style={{ padding: '20px 24px 24px' }}>
        <div style={{ fontSize: 12, color: C.text4, fontWeight: 600, marginBottom: 16 }}>الإيرادات الشهرية</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
          {bars.map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${v}%`, borderRadius: '4px 4px 0 0', background: i === 5 ? C.accent : `rgba(99,102,241,${0.2 + (v / 100) * 0.35})`, minHeight: 3 }} />
              <div style={{ fontSize: 9, color: C.text5, whiteSpace: 'nowrap' }}>{months[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RepairMockup() {
  const stages = ['مستلم', 'جاري الإصلاح', 'جاهز', 'مُسلَّم'];
  const activeStage = 1;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', fontFamily: "'Tajawal', system-ui, sans-serif", color: C.text1 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>بطاقة صيانة</div>
          <div style={{ fontSize: 12, color: C.accent, marginTop: 4, fontFamily: "'Inter', monospace", fontWeight: 600 }}>#REP-00421</div>
        </div>
        <div style={{ padding: '4px 12px', background: 'rgba(99,102,241,.1)', borderRadius: 6, fontSize: 12, color: C.accent, fontWeight: 600, border: `1px solid rgba(99,102,241,.2)` }}>
          جاري الإصلاح
        </div>
      </div>
      {/* Device info */}
      <div style={{ padding: '16px 24px', background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { label: 'الجهاز',   val: 'iPhone 15 Pro Max' },
          { label: 'العميل',   val: 'محمد عبدالله' },
          { label: 'IMEI',     val: '352099001761481', ltr: true },
          { label: 'تاريخ الاستلام', val: '٢٠ يونيو ٢٠٢٦' },
        ].map(({ label, val, ltr }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: C.text4, marginBottom: 3, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, direction: ltr ? 'ltr' : undefined, textAlign: ltr ? 'right' : undefined }}>{val}</div>
          </div>
        ))}
      </div>
      {/* Problem */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.text4, fontWeight: 600, marginBottom: 6 }}>المشكلة المُبلَّغة</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.65 }}>شاشة مكسورة وبطارية لا تشحن بشكل صحيح، الجهاز يتوقف فجأة.</div>
      </div>
      {/* Status pipeline */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.text4, fontWeight: 600, marginBottom: 14 }}>مسار الإصلاح</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
              {i < stages.length - 1 && (
                <div style={{ position: 'absolute', top: 9, right: '-50%', width: '100%', height: 1, background: i < activeStage ? C.accent : C.border2, zIndex: 0 }} />
              )}
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: i <= activeStage ? C.accent : C.border2, border: `2px solid ${i <= activeStage ? C.accent : C.border}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < activeStage && <div style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%' }} />}
                {i === activeStage && <div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%' }} />}
              </div>
              <div style={{ fontSize: 9, color: i <= activeStage ? C.text1 : C.text5, fontWeight: i === activeStage ? 700 : 400, textAlign: 'center', whiteSpace: 'nowrap' }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Footer */}
      <div style={{ padding: '14px 24px', background: C.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: C.text4, marginBottom: 2 }}>الفني المسؤول</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>أحمد عبد الرحمن</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.text4, marginBottom: 2 }}>التكلفة المقدرة</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>٨٫٥٠٠ ج</div>
          </div>
        </div>
        <div style={{ height: 36, padding: '0 18px', background: C.accent, borderRadius: 7, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'default' }}>
          تحديث الحالة
        </div>
      </div>
    </div>
  );
}

/* ── Capability section data ── */
type Capability = { num: string; title: string; sub: string; desc: string; Mockup: () => React.ReactElement };
const CAPS: Capability[] = [
  {
    num: '01',
    title: 'المبيعات الفورية',
    sub: 'من الطلب إلى الفاتورة في ثوانٍ',
    desc: 'نقطة بيع متكاملة. فواتير إلكترونية. خصومات ذكية. تقارير يومية تلقائية. كل شيء يعمل دون تدخل.',
    Mockup: SalesMockup,
  },
  {
    num: '02',
    title: 'محاسبة بلا محاسب',
    sub: 'قيد مزدوج تلقائي، صفر أخطاء',
    desc: 'قيود يومية تلقائية مع كل معاملة. ميزانية عمومية. قائمة الدخل. ميزان المراجعة. في مكان واحد.',
    Mockup: AccountingMockup,
  },
  {
    num: '03',
    title: 'تتبع الصيانة',
    sub: 'من الاستلام إلى التسليم بدقة',
    desc: 'بطاقة صيانة لكل جهاز. رمز QR للعملاء لمتابعة الإصلاح. تعيين فنيين. فواتير صيانة دقيقة.',
    Mockup: RepairMockup,
  },
];

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate] = useLocation();
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const obsRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (document.getElementById('muhkam-lp-css')) return;
    const el = document.createElement('style');
    el.id = 'muhkam-lp-css';
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    obsRef.current = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('v4-in'); obsRef.current?.unobserve(en.target); }
      }),
      { threshold: 0.06 }
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
          background: scrolled ? 'rgba(9,9,11,.94)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
          transition: 'background .25s, border-color .25s',
        }}
      >
        <div style={{ ...maxW, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.text1, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: '0.18em' }}>ERP</span>
          </div>

          <div className="v4-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="v4-nav-link">{lbl}</a>
            ))}
          </div>

          <div className="v4-nav-btns" style={{ display: 'flex', gap: 8 }}>
            <button onClick={goLogin}    className="v4-btn-ghost"   style={{ height: 38, padding: '0 18px', fontSize: 13 }}>تسجيل الدخول</button>
            <button onClick={goRegister} className="v4-btn-primary" style={{ height: 38, padding: '0 18px', fontSize: 13 }}>ابدأ مجاناً</button>
          </div>

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

        {menuOpen && (
          <div style={{ background: 'rgba(9,9,11,.98)', backdropFilter: 'blur(16px)', borderTop: `1px solid ${C.border}`, padding: '20px 40px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
        {/* Dot grid */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `radial-gradient(circle, ${C.border} 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${C.bg} 15%, transparent 100%)` }} />

        <div style={{ position: 'relative', textAlign: 'center', padding: '140px 28px 80px', width: '100%' }}>
          <div style={{ ...eyebrow, marginBottom: 32, animation: 'v4-up .55s ease both' }}>
            نظام إدارة الموارد المؤسسية · مُصمم للعربية
          </div>

          <h1
            className="v4-hero-title"
            style={{
              fontSize: 'clamp(56px, 9.5vw, 112px)',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-0.038em',
              marginBottom: 36,
              animation: 'v4-up .6s .05s ease both',
            }}
          >
            <span style={{ display: 'block', color: C.text1 }}>إدارة شركتك...</span>
            <span style={{ display: 'block', color: C.accent }}>كما يجب أن تكون.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(16px, 1.6vw, 20px)',
              color: C.text3,
              fontWeight: 400,
              lineHeight: 1.8,
              maxWidth: 520,
              margin: '0 auto 56px',
              animation: 'v4-up .6s .10s ease both',
            }}
          >
            نظام ERP عربي متكامل — محاسبة، مبيعات، موارد بشرية، وصيانة.<br />
            في مكان واحد. يعمل من اليوم الأول.
          </p>

          <div style={{ animation: 'v4-up .6s .15s ease both' }}>
            <button
              onClick={goRegister}
              className="v4-btn-primary"
              style={{ height: 56, padding: '0 40px', fontSize: 16, borderRadius: 10 }}
            >
              ابدأ تجربتك المجانية — ٧ أيام
            </button>
            <div style={{ marginTop: 16, fontSize: 12, color: C.text5 }}>بلا بطاقة ائتمان · إلغاء في أي وقت</div>
          </div>
        </div>

        <div aria-hidden="true" style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'v4-fade 1s .6s ease both' }}>
          <div style={{ width: 1, height: 48, background: `linear-gradient(to bottom, transparent, ${C.border2})` }} />
        </div>
      </section>

      {/* ════════════════ PRODUCT REVEAL ════════════════ */}
      <section style={{ padding: '0 0 120px', background: C.bg }}>
        <div style={{ ...maxW, textAlign: 'center', marginBottom: 56 }}>
          <div className="v4-reveal" style={{ ...eyebrow, marginBottom: 20 }}>النظام في العمل</div>
          <h2 className="v4-reveal v4-d1" style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.025em', color: C.text1 }}>
            لوحة تحكم تُبسّط كل شيء
          </h2>
        </div>

        {/* Dashboard frame */}
        <div style={{ ...maxW }}>
          <div className="v4-reveal v4-d2" style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 40px 120px rgba(0,0,0,.5)', background: C.surface }}>
            {/* Window chrome */}
            <div style={{ height: 40, background: '#0D0D12', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
              <div style={{ display: 'flex', gap: 7 }}>
                {['#FF5F57','#FEBC2E','#28C840'].map((c,i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: .65 }} />
                ))}
              </div>
              <div style={{ flex: 1, margin: '0 16px', maxWidth: 260, background: C.border, borderRadius: 5, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.border2 }} />
                <span style={{ fontSize: 10, color: C.text5, fontFamily: "'Inter', monospace", direction: 'ltr' }}>app.muhkam.sa</span>
              </div>
            </div>
            {/* Dashboard content */}
            <div style={{ height: 520 }}>
              <LiveDashboard />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ CAPABILITIES ════════════════ */}
      {CAPS.map(({ num, title, sub, desc, Mockup }, idx) => {
        const isEven = idx % 2 === 1;
        return (
          <section
            key={num}
            id={idx === 0 ? 'features' : undefined}
            style={{
              minHeight: '90vh',
              display: 'flex',
              alignItems: 'center',
              borderTop: `1px solid ${C.border}`,
              padding: '80px 0',
            }}
          >
            <div
              style={{
                ...maxW,
                display: 'flex',
                gap: 80,
                alignItems: 'center',
                flexDirection: isEven ? 'row-reverse' : 'row',
              }}
            >
              {/* Text block */}
              <div className="v4-reveal" style={{ flex: '0 0 40%' }}>
                <div style={{ fontSize: 72, fontWeight: 800, color: C.border2, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 24, fontFamily: "'Inter', monospace" }}>{num}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: '0.16em', marginBottom: 16, textTransform: 'uppercase' }}>{sub}</div>
                <h2 style={{ fontSize: 'clamp(32px, 3.5vw, 48px)', fontWeight: 700, color: C.text1, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 24 }}>
                  {title}
                </h2>
                <p style={{ fontSize: 16, color: C.text3, lineHeight: 1.85, marginBottom: 36 }}>{desc}</p>
                <button onClick={goRegister} className="v4-btn-ghost" style={{ height: 46, padding: '0 24px', fontSize: 14 }}>
                  جرّب مجاناً ←
                </button>
              </div>

              {/* Mockup block */}
              <div className={`v4-reveal v4-d2`} style={{ flex: 1, minWidth: 0 }}>
                <Mockup />
              </div>
            </div>
          </section>
        );
      })}

      {/* ════════════════ CTA ════════════════ */}
      <section id="pricing" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', borderTop: `1px solid ${C.border}`, padding: '80px 40px' }}>
        <div className="v4-reveal" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ ...eyebrow, marginBottom: 28 }}>ابدأ اليوم</div>
          <h2 style={{ fontSize: 'clamp(48px, 7vw, 80px)', fontWeight: 800, letterSpacing: '-0.04em', color: C.text1, marginBottom: 24, lineHeight: 1.05 }}>
            جاهز للبدء؟
          </h2>
          <p style={{ fontSize: 17, color: C.text3, lineHeight: 1.85, marginBottom: 48 }}>
            ٧ أيام مجاناً بدون قيود.<br />بلا بطاقة ائتمان. إلغاء في أي وقت.
          </p>
          <button onClick={goRegister} className="v4-btn-primary" style={{ height: 58, padding: '0 48px', fontSize: 16, borderRadius: 10 }}>
            ابدأ تجربتك المجانية
          </button>
          <div style={{ marginTop: 24, display: 'flex', gap: 32, justifyContent: 'center' }}>
            {['محاسبة كاملة', 'مبيعات ونقطة بيع', 'موارد بشرية', 'صيانة'].map((f) => (
              <div key={f} style={{ fontSize: 12, color: C.text5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.accent }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════ FOOTER ════════════════ */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '32px 0' }}>
        <div style={{ ...maxW, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }} className="v4-footer-inner">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text1, letterSpacing: '-0.025em' }}>مُحكم</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: '0.18em' }}>ERP</span>
          </div>
          <span style={{ fontSize: 12, color: C.text5 }}>© 2026 مُحكم ERP · جميع الحقوق محفوظة</span>
          <div style={{ display: 'flex', gap: 24 }}>
            {NAV_LINKS.map(([id, lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} className="v4-nav-link" style={{ fontSize: 13 }}>{lbl}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
