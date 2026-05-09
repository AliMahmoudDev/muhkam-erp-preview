import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

/* ══════════════════════════════════════════════
   Enterprise Landing Page — Navy + Blue
   Inspired by Linear / Salesforce / Oracle
   No particles, no mouse parallax, no shimmer
══════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

@keyframes lp-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes lp-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes lp-bar-grow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes lp-count-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.lp-fade { opacity: 0; transform: translateY(16px); transition: opacity .55s ease, transform .55s ease; }
.lp-fade.lp-in { opacity: 1; transform: none; }
.lp-d1 { transition-delay: .04s } .lp-d2 { transition-delay: .09s } .lp-d3 { transition-delay: .14s }
.lp-d4 { transition-delay: .19s } .lp-d5 { transition-delay: .24s } .lp-d6 { transition-delay: .29s }

.lp-card {
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.lp-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.35) !important;
  box-shadow: 0 4px 24px rgba(59, 130, 246, 0.08), 0 1px 3px rgba(0,0,0,0.3);
}

.lp-bar { transform-origin: bottom; animation: lp-bar-grow 1s cubic-bezier(.34,1.56,.64,1) both; animation-play-state: paused; }
.lp-chart-live .lp-bar { animation-play-state: running; }

.lp-stat-num { display: inline-block; animation: lp-count-in .5s ease both; animation-play-state: paused; }
.lp-stats-live .lp-stat-num { animation-play-state: running; }

.lp-link {
  color: #94A3B8; transition: color .15s ease;
  text-decoration: none; cursor: pointer;
}
.lp-link:hover { color: #F8FAFC; }

.lp-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;
  background: #2563EB; color: #FFFFFF;
  font-size: 14px; font-weight: 600; font-family: inherit;
  transition: background .15s ease, transform .05s ease;
}
.lp-btn-primary:hover { background: #1D4ED8; }
.lp-btn-primary:active { transform: scale(0.985); }

.lp-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; cursor: pointer;
  background: transparent; color: #E2E8F0;
  border: 1px solid #334155;
  font-size: 14px; font-weight: 600; font-family: inherit;
  transition: background .15s ease, border-color .15s ease;
}
.lp-btn-secondary:hover { background: #1E293B; border-color: #475569; }

@media (max-width: 900px) {
  .lp-nav-links, .lp-nav-btns { display: none !important; }
  .lp-hamburger { display: flex !important; }
  .lp-grid-2, .lp-grid-3, .lp-grid-4 { grid-template-columns: 1fr !important; }
  .lp-bento { grid-template-columns: 1fr !important; }
  .lp-bento .lp-wide, .lp-bento .lp-full { grid-column: span 1 !important; }
  .lp-spotlight { grid-template-columns: 1fr !important; }
  .lp-hero-mockup { display: none !important; }
}
@media (min-width: 901px) { .lp-hamburger { display: none !important; } }
`;

/* ══════════════════════════════════════════════
   Mini mockup components — recolored for navy/blue
══════════════════════════════════════════════ */
function MiniAccounting() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {([['إيرادات', '١٢٤٫٨ك', '#10B981'], ['مصروفات', '٤٨٫٢ك', '#EF4444'], ['أرباح', '٧٦٫٦ك', '#3B82F6']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, background: '#0F172A', borderRadius: 6, padding: '7px 8px', border: '1px solid #1E293B' }}>
            <div style={{ fontSize: 9, color: '#64748B', marginBottom: 3 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 44 }}>
        {[55, 75, 48, 90, 62, 82, 70].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.3)' }} />
        ))}
      </div>
    </div>
  );
}

function MiniSales() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ fontSize: 9, color: '#64748B', marginBottom: 7 }}>فاتورة #٢٤١٩</div>
      {([['iPhone 15 Pro', '٢٥٫٥٠٠ ج'], ['Apple Watch', '٨٫٩٠٠ ج'], ['AirPods Pro', '٣٫٢٠٠ ج']] as [string, string][]).map(([name, price]) => (
        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1E293B', fontSize: 10 }}>
          <span style={{ color: '#94A3B8' }}>{name}</span>
          <span style={{ color: '#60A5FA', fontWeight: 600 }}>{price}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: '#64748B' }}>الإجمالي</span>
        <span style={{ color: '#3B82F6' }}>٣٧٫٦٠٠ ج</span>
      </div>
    </div>
  );
}

function MiniInventory() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      {([['iPhone 15', '٤٨', 88], ['Samsung S24', '١٢', 22], ['Xiaomi 14', '٨٩', 95]] as [string, string, number][]).map(([name, qty, pct]) => (
        <div key={name} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
            <span style={{ color: '#94A3B8' }}>{name}</span>
            <span style={{ color: '#10B981', fontWeight: 600 }}>{qty} وحدة</span>
          </div>
          <div style={{ height: 4, background: '#1E293B', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct < 30 ? '#EF4444' : '#10B981', borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniHR() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      {([['أحمد محمد', 'مدير مبيعات', [1, 1, 1, 1, 0]], ['سارة خالد', 'محاسبة', [1, 1, 1, 1, 1]], ['محمود علي', 'فني', [1, 1, 0, 1, 1]], ['نور حسن', 'كاشير', [1, 1, 1, 0, 1]]] as [string, string, number[]][]).map(([name, role, days]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, color: '#60A5FA', fontWeight: 700 }}>{name[0]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0', lineHeight: 1.2 }}>{name}</div>
            <div style={{ fontSize: 9, color: '#64748B' }}>{role}</div>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {days.map((d, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: d ? '#3B82F6' : '#1E293B' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniRepair() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: '#64748B' }}>#١٠٤٢ — iPhone 15</span>
        <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60A5FA', fontSize: 9, fontWeight: 600 }}>قيد الإصلاح</span>
      </div>
      {([['الفني', 'أحمد حسن'], ['العطل', 'شاشة مكسورة'], ['التكلفة', '٨٥٠ ج']] as [string, string][]).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10 }}>
          <span style={{ color: '#64748B' }}>{k}</span>
          <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, height: 4, background: '#1E293B', borderRadius: 2 }}>
        <div style={{ height: '100%', width: '65%', background: '#3B82F6', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function MiniReports() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      <div style={{ fontSize: 9, color: '#64748B', marginBottom: 8 }}>أداء المبيعات — هذا الشهر</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52, marginBottom: 6 }}>
        {[38, 55, 42, 70, 58, 88, 72].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', background: i === 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.25)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {(['س', 'أح', 'إث', 'ث', 'خ', 'ج', 'سب']).map(d => (
          <span key={d} style={{ fontSize: 8, color: '#475569', flex: 1, textAlign: 'center' }}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function MiniBank() {
  return (
    <div style={{ marginTop: 14, background: '#0B1220', borderRadius: 10, padding: '12px 14px', border: '1px solid #1E293B' }}>
      {([['دفع مورد', '-٨٫٥٠٠', '#EF4444'], ['تحصيل عميل', '+٢٢٫٠٠٠', '#10B981'], ['مصاريف إدارية', '-١٫٢٠٠', '#EF4444']] as [string, string, string][]).map(([desc, amount, color]) => (
        <div key={desc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#94A3B8' }}>{desc}</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, color }}>{amount} ج</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: '#64748B' }}>صافي</span>
        <span style={{ color: '#3B82F6' }}>+١٢٫٣٠٠ ج</span>
      </div>
    </div>
  );
}

function MiniMobile() {
  const phone = (content: React.ReactNode) => (
    <div style={{ width: 92, background: '#0B1220', borderRadius: 14, border: '1px solid #1E293B', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 22, height: 2, background: 'rgba(59, 130, 246, 0.5)', borderRadius: 1 }} />
      </div>
      <div style={{ padding: '7px 8px' }}>{content}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 14, display: 'flex', gap: 12, justifyContent: 'center' }}>
      {phone(
        <>
          <div style={{ fontSize: 8, color: '#64748B', marginBottom: 5 }}>الحضور GPS</div>
          <div style={{ width: '100%', height: 38, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 6, position: 'relative', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ position: 'absolute', bottom: 4, right: 4, width: 4, height: 4, borderRadius: '50%', background: '#3B82F6' }} />
          </div>
          <div style={{ marginTop: 4, fontSize: 8, color: '#3B82F6', fontWeight: 700, textAlign: 'center' }}>حضر ✓</div>
        </>
      )}
      {phone(
        <>
          <div style={{ fontSize: 8, color: '#64748B', marginBottom: 5 }}>فاتورة سريعة</div>
          {['منتج ١', 'منتج ٢'].map(p => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '2px 0', borderBottom: '1px solid #1E293B' }}>
              <span style={{ color: '#94A3B8' }}>{p}</span>
              <span style={{ color: '#60A5FA', fontWeight: 600 }}>٢٥٠ ج</span>
            </div>
          ))}
          <div style={{ marginTop: 4, padding: '3px 6px', borderRadius: 4, background: '#2563EB', textAlign: 'center', fontSize: 8, color: '#fff', fontWeight: 600 }}>إصدار</div>
        </>
      )}
      {phone(
        <>
          <div style={{ fontSize: 8, color: '#64748B', marginBottom: 5 }}>أداء اليوم</div>
          {[['مبيعات', '١٢'], ['مرتجع', '٢'], ['تحصيل', '٨٫٥ك']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '2px 0' }}>
              <span style={{ color: '#94A3B8' }}>{l}</span>
              <span style={{ color: '#60A5FA', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Data
══════════════════════════════════════════════ */
interface BentoItem {
  title: string; desc: string;
  cls: string;
  mockup: React.ReactNode;
}

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

type StatItem =
  | { kind: 'text'; text: string; label: string }
  | { kind: 'num'; end: number; suffix: string; label: string };

const STATS: StatItem[] = [
  { kind: 'text', text: 'نظام متكامل',  label: 'حلّ موحّد لكل أقسام شركتك' },
  { kind: 'text', text: 'دعم عربي كامل', label: 'واجهة عربية أصيلة من البداية' },
  { kind: 'num',  end: 7,  suffix: '',   label: 'أيام تجريبية مجانية' },
  { kind: 'num',  end: 24, suffix: '/7', label: 'دعم متواصل' },
];

const TICKER = [
  'محاسبة كاملة', '·', 'مبيعات', '·', 'مخزون', '·',
  'موارد بشرية', '·', 'صيانة', '·', 'تقارير', '·',
  'تطبيق موبايل', '·', 'مطابقة بنكية', '·', 'نقطة البيع', '·',
];

const NAV_LINKS = [['features', 'الميزات'], ['pricing', 'الأسعار']];

/* ══════════════════════════════════════════════
   Shared style helpers
══════════════════════════════════════════════ */
const mono: React.CSSProperties = { fontFamily: "'Tajawal', system-ui, sans-serif" };

const cardSurface: React.CSSProperties = {
  background: '#0F172A',
  border: '1px solid #1E293B',
  borderRadius: 12,
};

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
