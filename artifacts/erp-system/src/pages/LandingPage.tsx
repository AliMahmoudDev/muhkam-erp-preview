import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

const features = [
  { icon: '📊', title: 'المحاسبة الكاملة',       desc: 'قيد مزدوج، ميزانية، تقارير مالية' },
  { icon: '🛒', title: 'المبيعات ونقطة البيع',    desc: 'فواتير سريعة، POS متكامل' },
  { icon: '📦', title: 'إدارة المخزون',           desc: 'تتبع الكميات، تنبيهات النفاد' },
  { icon: '👥', title: 'الموارد البشرية',         desc: 'الرواتب، الحضور، الإجازات' },
  { icon: '🔧', title: 'وحدة الصيانة',           desc: 'بطاقات صيانة، تتبع الأجهزة' },
  { icon: '🏦', title: 'المطابقة البنكية',        desc: 'ربط الحسابات، مطابقة تلقائية' },
  { icon: '📱', title: 'تطبيق موبايل',           desc: 'iOS وAndroid، حضور GPS' },
  { icon: '🛡️', title: 'الأمان والصلاحيات',      desc: 'تعدد المستخدمين، RLS' },
  { icon: '📈', title: 'التقارير والتحليلات',     desc: 'لوحة تحكم، تقارير PDF' },
];

const stats = [
  { value: '+500',  label: 'شركة' },
  { value: '99.9%', label: 'وقت التشغيل' },
  { value: '7',     label: 'أيام تجريبية' },
  { value: '24/7',  label: 'دعم عربي' },
];

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  /* ── Navbar scroll effect ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Intersection observer for scroll animations ── */
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observerRef.current?.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
      observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const goLogin = () => navigate('/login');
  const scrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div dir="rtl" className="min-h-screen font-sans overflow-x-hidden">

      {/* ══════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-md bg-[hsl(225,25%,5%)]/90 border-b border-white/10 shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-black font-black text-lg">م</div>
            <div>
              <div className="font-black text-white text-lg leading-none">مُحكم</div>
              <div className="text-white/40 text-xs leading-none">نظام ERP عربي</div>
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a href="#features" onClick={scrollToFeatures} className="text-white/60 hover:text-white text-sm transition-colors">الميزات</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-white/60 hover:text-white text-sm transition-colors">الأسعار</a>
            <button
              onClick={goLogin}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all"
            >
              تسجيل الدخول ←
            </button>
          </div>

          {/* Hamburger */}
          <button className="md:hidden text-white/70 p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <div className={`w-5 h-0.5 bg-current mb-1 transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <div className={`w-5 h-0.5 bg-current mb-1 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-0.5 bg-current transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-[hsl(225,25%,8%)]/95 backdrop-blur-md border-t border-white/10 px-6 py-4 flex flex-col gap-3">
            <a href="#features" onClick={(e) => { setMenuOpen(false); scrollToFeatures(e); }} className="text-white/70 py-2 border-b border-white/10">الميزات</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); setMenuOpen(false); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-white/70 py-2 border-b border-white/10">الأسعار</a>
            <button onClick={goLogin} className="mt-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm">تسجيل الدخول ←</button>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 pb-12"
        style={{ background: 'hsl(225,25%,5%)' }}>

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Amber radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 60%, rgba(245,158,11,0.12) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-bold mb-8 animate-on-scroll">
            🚀 نظام ERP عربي متكامل
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 animate-on-scroll">
            أدِر شركتك{' '}
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #f59e0b, #fbbf24, #f97316)' }}>
              بذكاء
            </span>
            <br />
            من مكان واحد
          </h1>

          {/* Subtitle */}
          <p className="text-white/60 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto animate-on-scroll">
            مُحكم ERP — نظام متكامل للمبيعات والمخزون والمحاسبة والموارد البشرية والصيانة.
            مصمم للشركات العربية.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 animate-on-scroll">
            <button
              onClick={goLogin}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-black text-base transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 0 32px rgba(245,158,11,0.4)' }}
            >
              ابدأ تجربتك المجانية 7 أيام ←
            </button>
            <a
              href="#features"
              onClick={scrollToFeatures}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-white text-base border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all text-center"
            >
              شاهد المميزات ↓
            </a>
          </div>

          {/* Trust line */}
          <p className="text-white/40 text-sm animate-on-scroll flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <span>✓ بدون بطاقة ائتمان</span>
            <span>✓ إعداد في دقائق</span>
            <span>✓ دعم عربي</span>
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20 animate-bounce">
          <div className="w-0.5 h-8 bg-white/20 rounded-full" />
          <div className="text-xs">↓</div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════ */}
      <section style={{ background: 'hsl(225,25%,7%)' }} className="border-y border-white/10 py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className={`text-center animate-on-scroll stagger-${i + 1}`}>
              <div className="text-3xl md:text-4xl font-black text-amber-400 mb-1">{s.value}</div>
              <div className="text-white/50 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════ */}
      <section id="features" style={{ background: 'hsl(225,25%,6%)' }} className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 animate-on-scroll">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">⚡ كل ما تحتاجه في مكان واحد</h2>
            <p className="text-white/40 text-base max-w-xl mx-auto">من الفواتير إلى الرواتب — كل وحدة مترابطة بذكاء</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className={`group relative p-6 rounded-2xl border border-white/10 cursor-default transition-all duration-300 hover:-translate-y-1 animate-on-scroll stagger-${i + 1}`}
                style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
              >
                {/* Amber glow on hover */}
                <div className="absolute inset-0 rounded-2xl border border-amber-500/0 group-hover:border-amber-500/40 transition-all duration-300 pointer-events-none"
                  style={{ boxShadow: '0 0 0 0 rgba(245,158,11,0)', transition: 'box-shadow 0.3s ease, border-color 0.3s ease' }}
                />
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white text-base mb-1">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          PRICING
      ══════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 px-6 transition-colors"
        style={{ background: 'linear-gradient(180deg, hsl(225,25%,6%) 0%, #e8eaf0 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 animate-on-scroll">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">خطة تناسب حجمك</h2>
            <p className="text-white/50 text-base">ابدأ مجاناً لمدة 7 أيام — بدون بطاقة ائتمان</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pro */}
            <div className="animate-on-scroll stagger-1 rounded-2xl border border-white/15 p-8 flex flex-col"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
              <div className="text-2xl mb-1">⭐</div>
              <h3 className="text-xl font-black text-white mb-1">MuhKam Pro</h3>
              <p className="text-white/40 text-sm mb-6">للشركات الصغيرة</p>
              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {['المبيعات والمشتريات', 'إدارة المخزون', 'العملاء والموردون', 'التقارير الأساسية', 'نقطة البيع POS'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-amber-400">✓</span> {item}
                  </li>
                ))}
              </ul>
              <button onClick={goLogin}
                className="w-full py-3 rounded-xl font-bold text-white border border-white/20 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all text-sm">
                ابدأ مجاناً
              </button>
              <p className="text-center text-white/30 text-xs mt-3">7 أيام تجريبية — بدون بطاقة ائتمان</p>
            </div>

            {/* Advanced */}
            <div className="animate-on-scroll stagger-2 rounded-2xl p-8 flex flex-col relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.1))',
                border: '1px solid rgba(245,158,11,0.5)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 48px rgba(245,158,11,0.15)',
              }}>
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500 text-black text-xs font-black">الأكثر طلباً</div>
              <div className="text-2xl mb-1">🚀</div>
              <h3 className="text-xl font-black text-white mb-1">MuhKam Advanced</h3>
              <p className="text-white/60 text-sm mb-6">للشركات التي تحتاج كل شيء</p>
              <ul className="flex flex-col gap-2 mb-8 flex-1">
                {[
                  'كل ما في Pro',
                  'المحاسبة الكاملة + القيد المزدوج',
                  'الموارد البشرية والرواتب',
                  'وحدة الصيانة والأجهزة',
                  'تطبيق موبايل (iOS & Android)',
                  'المطابقة البنكية',
                  'الميزانيات ومراكز التكلفة',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <span className="text-amber-400 font-bold">✓</span> {item}
                  </li>
                ))}
              </ul>
              <button onClick={goLogin}
                className="w-full py-3 rounded-xl font-black text-black transition-all hover:scale-105 active:scale-95 text-sm"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}>
                ابدأ مجاناً
              </button>
              <p className="text-center text-white/40 text-xs mt-3">7 أيام تجريبية — بدون بطاقة ائتمان</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CTA SECTION
      ══════════════════════════════════════════════ */}
      <section className="py-24 px-6 text-center" style={{ background: '#f0f2f7' }}>
        <div className="max-w-2xl mx-auto animate-on-scroll">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">
            جاهز لتحويل طريقة إدارة شركتك؟
          </h2>
          <p className="text-gray-500 text-base mb-10">انضم لأكثر من 500 شركة تثق في مُحكم</p>
          <button
            onClick={goLogin}
            className="px-10 py-4 rounded-2xl font-black text-black text-base transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', boxShadow: '0 8px 32px rgba(245,158,11,0.4)' }}
          >
            ابدأ تجربتك المجانية الآن ←
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer style={{ background: 'hsl(225,25%,5%)' }} className="py-12 px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-black font-black">م</div>
            <div>
              <div className="font-black text-white">مُحكم ERP</div>
              <div className="text-white/30 text-xs">نظام إدارة عربي متكامل</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#features" onClick={scrollToFeatures} className="hover:text-white/70 transition-colors">الميزات</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white/70 transition-colors">الأسعار</a>
            <button onClick={goLogin} className="hover:text-white/70 transition-colors">تسجيل الدخول</button>
          </div>

          <p className="text-white/25 text-xs">© 2026 مُحكم ERP — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
