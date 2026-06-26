/* eslint-disable erp/no-hardcoded-colors -- landing page and modal decorative colors: intentional fixed palette */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';

// Real screenshots from muhkampro.com production app
import dashboardImg from '@/assets/screenshots/dashboard.png';
import salesImg from '@/assets/screenshots/sales.png';
import inventoryImg from '@/assets/screenshots/inventory.png';
import repairsImg from '@/assets/screenshots/repairs.png';
import reportsImg from '@/assets/screenshots/reports.png';

// Customer portraits (AI-generated for testimonials)
import ahmedImg from '@/assets/testimonials/ahmed.png';
import mohamedImg from '@/assets/testimonials/mohamed.png';
import khaledImg from '@/assets/testimonials/khaled.png';

/* ══════════════════════════════════════════════
   CSS
══════════════════════════════════════════════ */
const LP_CSS_ID = 'muhkam-lp-css';
const LP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}

@keyframes lp-up   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
@keyframes lp-fade { from{opacity:0} to{opacity:1} }

@keyframes lp-orb-1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(80px,-60px) scale(1.15)} 66%{transform:translate(-60px,40px) scale(0.9)} }
@keyframes lp-orb-2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-100px,80px) scale(1.2)} }
@keyframes lp-orb-3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-80px) scale(1.1)} }
@keyframes lp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
@keyframes lp-float-slow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
@keyframes lp-marquee-rtl { from{transform:translateX(-50%)} to{transform:translateX(0)} }
@keyframes lp-gradient { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }

.lp-gradient-text{background:linear-gradient(135deg,#F59E0B 0%,#FFD700 50%,#FFB300 100%);background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:lp-gradient 6s ease infinite;}
.lp-orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;}
.lp-glass{background:rgba(255,255,255,.7);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,.06);}
.lp-float{animation:lp-float 4s ease-in-out infinite;}
.lp-float-slow{animation:lp-float-slow 6s ease-in-out infinite;}
.lp-marquee-track{display:flex;animation:lp-marquee-rtl 30s linear infinite;width:max-content;animation-delay:-15s;will-change:transform;}
.lp-marquee-track:hover{animation-play-state:paused;}

.lp-tab{padding:10px 18px;border-radius:980px;font-family:'Tajawal','SF Pro Display','Inter',sans-serif;font-size:14px;font-weight:500;color:#666;background:transparent;border:1px solid transparent;cursor:pointer;transition:all .2s;white-space:nowrap;}
.lp-tab:hover{color:#1A1A1A;}
.lp-tab.lp-tab-active{background:#F59E0B;color:#fff;border-color:#F59E0B;}

.lp-stat-num{font-family:'Inter','Tajawal',sans-serif;font-weight:700;letter-spacing:-0.04em;line-height:1;}

.lp-testimonial{background:#fff;border:1px solid #E8E8EB;border-radius:20px;padding:32px;transition:all .3s;box-shadow:0 1px 3px rgba(0,0,0,.04);}
.lp-testimonial:hover{box-shadow:0 12px 36px rgba(0,0,0,.08);transform:translateY(-4px);}

.lp-reveal{opacity:0;transform:translateY(20px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1);}
.lp-reveal.lp-in{opacity:1;transform:none;}
.lp-d1{transition-delay:.08s}.lp-d2{transition-delay:.16s}.lp-d3{transition-delay:.24s}.lp-d4{transition-delay:.32s}
.lp-d5{transition-delay:.08s}.lp-d6{transition-delay:.14s}.lp-d7{transition-delay:.20s}.lp-d8{transition-delay:.26s}

.lp-nav-link{font-family:'Tajawal','SF Pro Display','Inter',sans-serif;font-size:14px;font-weight:500;color:#666;text-decoration:none;transition:color .15s;white-space:nowrap;}
.lp-nav-link:hover{color:#1A1A1A;}

.lp-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:46px;padding:0 28px;background:linear-gradient(135deg,#F59E0B 0%,#F57F17 100%);color:#fff;border:none;border-radius:980px;cursor:pointer;font-family:'Tajawal','SF Pro Display','Inter',sans-serif;font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;transition:all .15s;box-shadow:0 4px 14px rgba(245,158,11,.3);}
.lp-btn-primary:hover{background:linear-gradient(135deg,#F57F17 0%,#E65100 100%);box-shadow:0 6px 20px rgba(245,158,11,.45);}
.lp-btn-primary:active{transform:scale(.98);}
.lp-btn-primary-lg{height:52px;padding:0 36px;font-size:16px;}

.lp-btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:46px;padding:0 22px;background:#fff;color:#1A1A1A;border:1px solid #E8E8EB;border-radius:980px;cursor:pointer;font-family:'Tajawal','SF Pro Display','Inter',sans-serif;font-size:14px;font-weight:500;white-space:nowrap;transition:all .15s;}
.lp-btn-outline:hover{border-color:#1A1A1A;background:#F5F5F7;}

.lp-card{background:#fff;border:1px solid #E8E8EB;border-radius:18px;padding:24px;transition:all .2s;}
.lp-card:hover{box-shadow:0 12px 36px rgba(0,0,0,.06);transform:translateY(-2px);}

.lp-pricing-card{background:#fff;border:1px solid #E8E8EB;border-radius:18px;padding:28px;position:relative;}
.lp-pricing-card-popular{border-color:#F59E0B;box-shadow:0 12px 40px rgba(245,158,11,.15);}
.lp-popular-badge{position:absolute;top:-12px;right:50%;transform:translateX(50%);background:linear-gradient(135deg,#F59E0B,#F57F17);color:#fff;padding:4px 14px;border-radius:980px;font-size:11px;font-weight:600;white-space:nowrap;}

.lp-check{color:#4CAF50;font-size:14px;font-weight:500;display:flex;align-items:center;gap:6px;}
.lp-check::before{content:"✓";color:#4CAF50;font-weight:700;flex-shrink:0;}

.lp-faq-btn{width:100%;background:none;border:none;padding:20px 0;cursor:pointer;font-family:'Tajawal','SF Pro Display','Inter',sans-serif;font-size:16px;font-weight:500;color:#1A1A1A;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:right;}
.lp-faq-btn:hover{color:#F59E0B;}

/* ═══ Glass Navbar — stronger frosted glass ═══ */
.lp-glass-nav{background:rgba(255,255,255,.3);backdrop-filter:blur(30px) saturate(200%);-webkit-backdrop-filter:blur(30px) saturate(200%);border:1px solid rgba(255,255,255,.35);box-shadow:0 4px 24px rgba(0,0,0,.06);}
.lp-glass-nav-scrolled{background:rgba(255,255,255,.6);box-shadow:0 8px 36px rgba(0,0,0,.1);}

/* ═══ Mobile responsive ═══ */
@media(max-width:768px){
  .lp-hero-h1{font-size:clamp(38px,11vw,56px)!important;line-height:1.05!important;}
  .lp-hero-sub{font-size:16px!important;line-height:1.6!important;margin-bottom:32px!important;}
  .lp-hero-cta{flex-direction:column;width:100%;max-width:320px;}
  .lp-hero-cta button{width:100%!important;}
  .lp-hero-checks{flex-direction:column;gap:10px!important;margin-bottom:40px!important;}
  .lp-floating-card{display:none!important;}
  .lp-hero-screenshot{transform:none!important;}
  .lp-stats-grid{grid-template-columns:repeat(2,1fr)!important;gap:24px!important;}
  .lp-stat-divider{border-right:none!important;border-bottom:1px solid #E8E8EB;}
  .lp-features-bento{grid-template-columns:1fr!important;grid-auto-rows:auto!important;gap:12px!important;}
  .lp-features-bento > div{grid-column:span 1!important;grid-row:span 1!important;padding:20px!important;}
  .lp-tab-row{flex-wrap:wrap;gap:6px!important;}
  .lp-tab{padding:8px 14px;font-size:12px!important;}
  .lp-showcase-grid{grid-template-columns:1fr!important;gap:32px!important;}
  .lp-showcase-img{height:320px!important;}
  .lp-testimonials-grid{grid-template-columns:1fr!important;gap:16px!important;}
  .lp-pricing-grid{grid-template-columns:1fr!important;max-width:380px;margin:0 auto!important;}
  .lp-footer-grid{grid-template-columns:1fr!important;gap:24px!important;}
  .lp-nav-links-desktop{display:none!important;}
  .lp-nav-mobile{display:flex!important;}
  .lp-nav-bar{padding:8px 16px!important;}
  .lp-section-pad{padding:64px 0!important;}
  .lp-marquee-track{animation-duration:20s!important;}
}
@media(max-width:480px){
  .lp-hero-h1{font-size:clamp(32px,10vw,42px)!important;}
  .lp-stats-grid{grid-template-columns:1fr!important;}
}
`;

/* ══════════════════════════════════════════════
   Warm palette — extracted from Dribbble ERP/POS reference
   Gold/amber primary + pastel card backgrounds
══════════════════════════════════════════════ */
const C = {
  bg: '#F5F5F5',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  primary: '#F59E0B', // Amber/gold (replaces Apple blue)
  primaryBg: '#FFF9C4', // Pale yellow tint
  accent: '#FFD700', // Gold
  accentBg: '#FFF9E6',
  text: '#333333', // Dark gray (matches reference)
  sub: '#666666',
  muted: '#999999',
  green: '#4CAF50', // Material green
  purple: '#A855F7',
  purpleBg: '#F3E5F5', // Light purple (reference)
  blueBg: '#E0F7FA', // Light cyan (reference)
  orangeBg: '#FFF3E0', // Light orange (reference)
} as const;

/* ══════════════════════════════════════════════
   FeatureIcon — SVG icons inside gradient square
══════════════════════════════════════════════ */
function FeatureIcon({
  gradient,
  icon,
  size = 44,
}: {
  gradient: string;
  icon: React.ReactNode;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 4px 14px rgba(0,0,0,.12)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 30% 20%, rgba(255,255,255,.3) 0%, transparent 50%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
    </div>
  );
}

// SVG icon set
const Icon = {
  POS: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14h3" />
      <circle cx="16" cy="14.5" r="1.5" />
    </svg>
  ),
  Inventory: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 8V21H3V8" />
      <path d="M1 3h22v5H1z" />
      <path d="M10 12h4" />
    </svg>
  ),
  Accounting: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  HR: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Repair: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  Customers: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-6" />
      <path d="M19 8v6" />
    </svg>
  ),
  Reports: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  ),
  Alerts: ({ size = 22 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const FEATURES = [
  {
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #F57F17 100%)',
    icon: <Icon.POS />,
    title: 'نقطة البيع',
    desc: 'إصدار الفواتير فوري لمحلات الجوال ونقاط البيع والتجار بكل سهولة',
  },
  {
    gradient: 'linear-gradient(135deg, #34C759 0%, #22C55E 100%)',
    icon: <Icon.Inventory />,
    title: 'إدارة المخزون',
    desc: 'تتبع الأصناف والكميات لكل المخازن مع تنبيهات نفاد المخزون تلقائياً',
  },
  {
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
    icon: <Icon.Accounting />,
    title: 'المحاسبة والتقارير',
    desc: 'قيد محاسبي تلقائي وتقارير أرباح وخسارة وميزانية في ثوانٍ',
  },
  {
    gradient: 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)',
    icon: <Icon.HR />,
    title: 'الموارد البشرية',
    desc: 'رواتب وحضور وإجازات موظفيك من مكان واحد بدون تعقيد',
  },
  {
    gradient: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
    icon: <Icon.Repair />,
    title: 'إدارة الصيانة',
    desc: 'تتبع طلبات الصيانة وقطع الغيار وإشعار العملاء فوراً عند الانتهاء',
  },
  {
    gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
    icon: <Icon.Customers />,
    title: 'العملاء والموردون',
    desc: 'سجلات تفصيلية ومتابعة الديون والأرصدة لكل عميل وموّرد',
  },
  {
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
    icon: <Icon.Reports />,
    title: 'التقارير والتحليلات',
    desc: 'تقارير يومية وشهرية لأداء المبيعات والمخزون والأرباح بشكل مرئي',
  },
  {
    gradient: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
    icon: <Icon.Alerts />,
    title: 'التنبيهات الذكية',
    desc: 'تنبيهات فورية للمخزون المنخفض والديون والفواتير المتأخرة',
  },
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
    name: 'البداية',
    price: '٢٩٩',
    unit: 'ج.م/شهر',
    popular: false,
    enterprise: false,
    desc: 'للمحلات والشركات الناشئة',
    features: [
      'حتى ٣ مستخدمين',
      'مخزن واحد',
      'نقطة بيع وفواتير',
      'تقارير أساسية',
      'دعم عبر واتساب',
    ],
  },
  {
    name: 'المتوسطة',
    price: '٥٩٠',
    unit: 'ج.م/شهر',
    popular: true,
    enterprise: false,
    desc: 'للشركات المتنامية',
    features: [
      'حتى ١٥ مستخدماً',
      'حتى ٣ مخازن',
      'جميع الوحدات',
      'تقارير متقدمة',
      'دعم أولوية',
      'نسخ احتياطي يومي',
    ],
  },
  {
    name: 'الأعمال',
    price: '٩٩٠',
    unit: 'ج.م/شهر',
    popular: false,
    enterprise: false,
    desc: 'للمؤسسات والتجار الكبار',
    features: [
      'حتى ٥٠ مستخدماً',
      'مخازن غير محدودة',
      'جميع الوحدات',
      'تقارير مخصصة',
      'مدير حساب مخصص',
      'SLA مضمون',
    ],
  },
  {
    name: 'المؤسسات',
    price: null,
    unit: '',
    popular: false,
    enterprise: true,
    desc: 'للمجموعات والسلاسل التجارية',
    features: [
      'مستخدمون غير محدودين',
      'فروع ومخازن غير محدودة',
      'تكاملات مخصصة',
      'تدريب وإعداد مخصص',
      'عقد SLA مضمون',
      'دعم على مدار الساعة',
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: 'هل يدعم مُحكم إدارة متعددة الفروع؟',
    a: 'نعم، يمكنك إدارة فروع ومخازن متعددة من لوحة تحكم مركزية واحدة مع تقارير منفصلة لكل فرع.',
  },
  {
    q: 'هل بياناتي آمنة؟',
    a: 'نعم، نستخدم تشفير TLS لجميع الاتصالات، وكل شركة معزولة تماماً عن الأخرى، مع نسخ احتياطية يومية.',
  },
  {
    q: 'هل يمكنني استيراد البيانات من Excel؟',
    a: 'نعم، ندعم استيراد المنتجات والعملاء والموردين من ملفات Excel وCSV بشكل مباشر.',
  },
  {
    q: 'ما الفرق بين خطط الاشتراك؟',
    a: 'تختلف الخطط في عدد المستخدمين المسموح بهم، وعدد المخازن، وإمكانية الوصول للوحدات المتقدمة كالتقارير المخصصة.',
  },
  {
    q: 'هل هناك دعم فني متاح؟',
    a: 'نعم، نقدم دعماً فنياً عبر الواتساب مباشرة. خطة المتوسطة والأعمال تشمل دعم أولوية على مدار الساعة.',
  },
  {
    q: 'هل يعمل التطبيق على الجوال؟',
    a: 'نعم، تطبيق مُحكم متاح على iOS وAndroid، ومُحسّن بالكامل للاستخدام اليومي من الجوال.',
  },
  {
    q: 'هل يمكنني الإلغاء في أي وقت؟',
    a: 'نعم، يمكنك الإلغاء في أي وقت دون أي رسوم إلغاء. بياناتك متاحة للتصدير قبل الإلغاء.',
  },
] as const;

/* ══════════════════════════════════════════════
   MuhkamLogo + Glass Navbar
══════════════════════════════════════════════ */
function MuhkamLogo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: 'linear-gradient(135deg, #F59E0B 0%, #FFB300 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: "'Tajawal','SF Pro Display',sans-serif",
          fontSize: size * 0.55,
          fontWeight: 800,
          boxShadow: '0 4px 14px rgba(245,158,11,.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,.3) 0%, transparent 50%)',
          }}
        />
        <span style={{ position: 'relative', zIndex: 1, lineHeight: 1 }}>م</span>
      </div>
      {withText && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span
            style={{
              fontFamily: "'Tajawal','SF Pro Display',sans-serif",
              fontSize: 19,
              fontWeight: 800,
              color: C.text,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            مُحكم
          </span>
          <span
            style={{
              fontFamily: "'Inter','Tajawal',sans-serif",
              fontSize: 9,
              fontWeight: 600,
              color: C.muted,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            MUHKAM ERP
          </span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Lightbox — Reusable image viewer
══════════════════════════════════════════════ */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(245,245,247,.95)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'lp-fade .2s ease',
      }}
    >
      <button
        onClick={onClose}
        aria-label="إغلاق"
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#fff',
          border: `1px solid ${C.border}`,
          color: C.text,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .2s',
          boxShadow: '0 4px 12px rgba(0,0,0,.08)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = C.text;
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.transform = 'rotate(90deg)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fff';
          e.currentTarget.style.color = C.text;
          e.currentTarget.style.transform = 'rotate(0deg)';
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          borderRadius: 12,
          boxShadow: '0 40px 100px rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.04)',
          objectFit: 'contain',
          cursor: 'default',
          animation: 'lp-up .3s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          color: C.muted,
          fontSize: 13,
          fontFamily: "'Tajawal','Inter',sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        اضغط في أي مكان فارغ أو ESC للإغلاق
      </div>
    </div>
  );
}

function ClickableImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ ...style, cursor: 'pointer' }}
        onClick={() => setOpen(true)}
      />
      {open && <Lightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ══════════════════════════════════════════════
   Glass Navbar — frosted glass effect with scroll detection
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
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setOpen(false);
  };

  const links: [string, string][] = [
    ['features', 'المميزات'],
    ['pricing', 'الأسعار'],
    ['faq', 'الأسئلة الشائعة'],
  ];

  return (
    <div
      className="lp-nav-bar"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, padding: '12px 20px' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          className={scrolled ? 'lp-glass-nav lp-glass-nav-scrolled' : 'lp-glass-nav'}
          style={{
            borderRadius: open ? 18 : 16,
            transition: 'all .25s cubic-bezier(.16,1,.3,1)',
          }}
        >
          <div
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px 0 18px',
              gap: 16,
            }}
          >
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ textDecoration: 'none' }}
            >
              <MuhkamLogo size={36} />
            </a>

            <div
              className="lp-nav-links-desktop"
              style={{ display: 'flex', flex: 1, justifyContent: 'center', gap: 4 }}
            >
              {links.map(([id, lbl]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={scrollTo(id)}
                  className="lp-nav-link"
                  style={{ padding: '8px 16px', borderRadius: 980 }}
                >
                  {lbl}
                </a>
              ))}
            </div>

            <div style={{ flex: 1 }} className="lp-nav-links-desktop" />

            <div
              className="lp-nav-links-desktop"
              style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}
            >
              <button
                onClick={onLogin}
                style={{
                  height: 40,
                  padding: '0 18px',
                  background: 'transparent',
                  color: C.sub,
                  border: '1px solid rgba(0,0,0,.08)',
                  borderRadius: 980,
                  cursor: 'pointer',
                  fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'all .2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = C.text;
                  e.currentTarget.style.borderColor = C.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = C.sub;
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,.08)';
                }}
              >
                تسجيل الدخول
              </button>
              <button
                onClick={onRegister}
                style={{
                  height: 40,
                  padding: '0 20px',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #F57F17 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 980,
                  cursor: 'pointer',
                  fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all .2s',
                  boxShadow: '0 4px 14px rgba(245,158,11,.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,158,11,.3)';
                }}
              >
                ابدأ مجاناً
              </button>
            </div>

            <button
              onClick={() => setOpen((v) => !v)}
              className="lp-nav-mobile"
              style={{
                display: 'none',
                flex: 1,
                justifyContent: 'flex-end',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 8,
                alignItems: 'center',
              }}
              aria-label="القائمة"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 22,
                      height: 2,
                      background: C.text,
                      borderRadius: 2,
                      transition: 'transform .2s',
                      transform: open
                        ? i === 0
                          ? 'translateY(7px) rotate(45deg)'
                          : i === 1
                            ? 'none'
                            : 'translateY(-7px) rotate(-45deg)'
                        : 'none',
                      opacity: open && i === 1 ? 0 : 1,
                    }}
                  />
                ))}
              </div>
            </button>
          </div>

          {open && (
            <div
              style={{
                padding: '16px 18px 20px',
                borderTop: '1px solid rgba(0,0,0,.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {links.map(([id, lbl]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={scrollTo(id)}
                  className="lp-nav-link"
                  style={{
                    padding: '12px 12px',
                    fontSize: 16,
                    borderBottom: '1px solid rgba(0,0,0,.06)',
                  }}
                >
                  {lbl}
                </a>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                <button
                  onClick={onLogin}
                  style={{
                    height: 48,
                    background: 'transparent',
                    color: C.text,
                    border: '1px solid #E8E8EB',
                    borderRadius: 980,
                    cursor: 'pointer',
                    fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  تسجيل الدخول
                </button>
                <button
                  onClick={onRegister}
                  style={{
                    height: 48,
                    background: 'linear-gradient(135deg, #F59E0B 0%, #F57F17 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 980,
                    cursor: 'pointer',
                    fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                    fontSize: 15,
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(245,158,11,.3)',
                  }}
                >
                  ابدأ مجاناً — ٧ أيام
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Hero — Light with soft pastel orbs
══════════════════════════════════════════════ */
function HeroSection({ onRegister, onLogin }: { onRegister: () => void; onLogin: () => void }) {
  return (
    <section
      style={{
        paddingTop: 140,
        paddingBottom: 80,
        background: C.bg,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="lp-orb"
        style={{
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(245,158,11,.2) 0%, transparent 70%)',
          top: '5%',
          right: '5%',
          animation: 'lp-orb-1 18s ease-in-out infinite',
        }}
      />
      <div
        className="lp-orb"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(255,179,0,.15) 0%, transparent 70%)',
          bottom: '5%',
          left: '0%',
          animation: 'lp-orb-2 22s ease-in-out infinite',
        }}
      />
      <div
        className="lp-orb"
        style={{
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(255,215,0,.2) 0%, transparent 70%)',
          top: '40%',
          left: '40%',
          animation: 'lp-orb-3 16s ease-in-out infinite',
        }}
      />

      <div
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          padding: '0 24px',
          width: '100%',
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          className="lp-glass"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            borderRadius: 980,
            padding: '6px 16px 6px 8px',
            fontSize: 13,
            fontWeight: 500,
            color: C.sub,
            marginBottom: 32,
            animation: 'lp-up .5s ease both',
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #FFB300)',
              color: '#fff',
              padding: '3px 10px',
              borderRadius: 980,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            جديد
          </span>
          <span style={{ color: C.sub }}>الإصدار ٣ — أسرع وأقوى من أي وقت</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5, transform: 'scaleX(-1)' }}
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        <h1
          className="lp-hero-h1"
          style={{
            fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
            fontSize: 'clamp(44px,6.5vw,80px)',
            fontWeight: 800,
            color: C.text,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            margin: '0 0 28px',
            textAlign: 'center',
            animation: 'lp-up .5s .06s ease both',
            maxWidth: 880,
          }}
        >
          نظام ERP عربي
          <br />
          <span className="lp-gradient-text">يحوّل محلك لمؤسسة</span>
        </h1>

        <p
          className="lp-hero-sub"
          style={{
            fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
            fontSize: 'clamp(17px,2vw,21px)',
            color: C.sub,
            lineHeight: 1.55,
            marginBottom: 40,
            maxWidth: 620,
            textAlign: 'center',
            animation: 'lp-up .5s .12s ease both',
            fontWeight: 400,
          }}
        >
          من نقطة البيع إلى الميزانية — كل ما يحتاجه محل الموبايلات في منصة واحدة.
          <br />
          <span style={{ color: C.text, fontWeight: 500 }}>
            بياناتك آمنة. فواتيرك دقيقة. أعمالك تنمو.
          </span>
        </p>

        <div
          className="lp-hero-cta"
          style={{
            display: 'flex',
            gap: 14,
            marginBottom: 28,
            animation: 'lp-up .5s .18s ease both',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button onClick={onRegister} className="lp-btn-primary lp-btn-primary-lg">
            ابدأ مجانًا — ٧ أيام
          </button>
          <button
            onClick={onLogin}
            className="lp-btn-outline"
            style={{ height: 52, padding: '0 26px', fontSize: 15 }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            شاهد النظام
          </button>
        </div>

        <div
          className="lp-hero-checks"
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            justifyContent: 'center',
            animation: 'lp-up .5s .24s ease both',
            marginBottom: 64,
            color: C.muted,
            fontSize: 13,
          }}
        >
          {['لا بطاقة ائتمان', 'إعداد في ٥ دقائق', 'دعم عربي ٢٤/٧', 'إلغاء في أي وقت'].map((c) => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34C759"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {c}
            </span>
          ))}
        </div>

        <div
          className="lp-hero-screenshot"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 1080,
            animation: 'lp-up .8s .3s ease both',
          }}
        >
          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              boxShadow: '0 40px 100px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)',
              transform: 'perspective(2000px) rotateX(2deg)',
              transformOrigin: 'center top',
              background: '#fff',
            }}
          >
            <div
              style={{
                height: 44,
                background: '#F5F5F7',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 16px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
              <div
                style={{
                  flex: 1,
                  height: 26,
                  background: '#E8E8EB',
                  borderRadius: 980,
                  maxWidth: 280,
                  marginRight: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: C.muted, fontFamily: 'Inter, monospace' }}>
                  app.muhkam.com/dashboard
                </span>
              </div>
            </div>
            <img
              src={dashboardImg}
              alt="MUHKAM ERP Dashboard"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
            />
          </div>

          <div
            className="lp-glass lp-float lp-floating-card"
            style={{
              position: 'absolute',
              top: '15%',
              right: '-3%',
              width: 200,
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 20px 50px rgba(0,0,0,.1)',
              animation: 'lp-float 4s ease-in-out infinite, lp-up 1s .8s ease both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #34C759, #22C55E)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#fff',
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.muted }}>فاتورة جديدة</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>INV-٢٠٢٦-٠١</div>
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#34C759', marginBottom: 4 }}>
              ٢٬٥٠٠ ج.م
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>مدفوعة بالكامل</div>
          </div>

          <div
            className="lp-glass lp-float-slow lp-floating-card"
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '-2%',
              width: 220,
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 20px 50px rgba(0,0,0,.1)',
              animation: 'lp-float-slow 6s ease-in-out infinite, lp-up 1s 1s ease both',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 11, color: C.muted }}>تذكرة صيانة</div>
              <div
                style={{
                  background: 'rgba(255,159,10,.15)',
                  color: '#F59E0B',
                  padding: '2px 8px',
                  borderRadius: 980,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                قيد الإصلاح
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              iPhone 14 Pro
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>تغيير شاشة</div>
            <div
              style={{ height: 4, background: '#E8E8EB', borderRadius: 980, overflow: 'hidden' }}
            >
              <div
                style={{
                  width: '60%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                  borderRadius: 980,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Logo Marquee
══════════════════════════════════════════════ */
function LogoMarquee() {
  const brands = [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Huawei',
    'Oppo',
    'Realme',
    'Vivo',
    'Honor',
    'Nokia',
    'Tecno',
    'Infinix',
    'OnePlus',
    'Google Pixel',
    'Motorola',
    'Sony',
    'LG',
  ];
  return (
    <section
      style={{
        padding: '48px 0',
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', marginBottom: 24 }}>
        <p
          style={{
            textAlign: 'center',
            fontSize: 13,
            color: C.muted,
            fontFamily: "'Inter','Tajawal',sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          يدعم جميع ماركات الموبايلات والإكسسوارات
        </p>
      </div>
      <div style={{ position: 'relative', padding: '12px 0' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, ${C.surface} 0%, transparent 10%, transparent 90%, ${C.surface} 100%)`,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
        <div className="lp-marquee-track">
          {[...brands, ...brands].map((b, i) => (
            <div
              key={i}
              style={{
                padding: '0 40px',
                fontSize: 22,
                fontWeight: 700,
                color: '#B0B0B5',
                fontFamily: "'Inter','Tajawal',sans-serif",
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                transition: 'color .3s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#B0B0B5')}
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Animated Stats Counter
══════════════════════════════════════════════ */
function AnimatedStats() {
  const stats = [
    { value: 150, suffix: '+', label: 'محل موبايلات', sub: 'في مصر والوطن العربي' },
    { value: 4.9, suffix: '★', label: 'تقييم العملاء', sub: 'من ٥ نجوم', decimals: 1 },
    { value: 50000, suffix: '+', label: 'فاتورة شهرياً', sub: 'تتم معالجتها بأمان' },
    { value: 99.9, suffix: '%', label: 'وقت تشغيل', sub: 'توفر عالي وموثوقية', decimals: 1 },
  ];

  const Counter = ({
    value,
    decimals = 0,
    suffix = '',
  }: {
    value: number;
    decimals?: number;
    suffix?: string;
  }) => {
    const ref = useRef<HTMLSpanElement>(null);
    const [display, setDisplay] = useState('0');

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const duration = 2000;
            const start = performance.now();
            const animate = (now: number) => {
              const elapsed = now - start;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = value * eased;
              const formatted =
                decimals > 0
                  ? current.toFixed(decimals)
                  : Math.floor(current).toLocaleString('en-US');
              setDisplay(formatted);
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
            obs.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, [value, decimals]);

    return (
      <span
        ref={ref}
        className="lp-stat-num"
        style={{ fontSize: 'clamp(40px,5vw,64px)', color: C.text }}
      >
        {display}
        <span style={{ color: C.primary }}>{suffix}</span>
      </span>
    );
  };

  return (
    <section
      className="lp-section-pad"
      style={{ padding: '100px 0', background: C.bg, position: 'relative', overflow: 'hidden' }}
    >
      <div
        className="lp-orb"
        style={{
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(245,158,11,.12) 0%, transparent 70%)',
          top: '30%',
          right: '20%',
        }}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <p
            style={{
              fontSize: 13,
              color: C.primary,
              fontFamily: "'Inter','Tajawal',sans-serif",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            أرقام تتكلم
          </p>
          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(32px,4.5vw,52px)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            بياناتنا تنطق بالنجاح
          </h2>
        </div>
        <div
          className="lp-reveal lp-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 32,
            textAlign: 'center',
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className={i < stats.length - 1 ? 'lp-stat-divider' : ''}
              style={{
                padding: '24px 16px',
                borderRight: i < stats.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <Counter value={s.value} decimals={s.decimals || 0} suffix={s.suffix} />
              <div
                style={{
                  fontSize: 15,
                  color: C.text,
                  fontWeight: 600,
                  marginTop: 12,
                  marginBottom: 4,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Features — Bento grid with FeatureIcon
══════════════════════════════════════════════ */
function FeaturesSection() {
  return (
    <section
      id="features"
      className="lp-section-pad"
      style={{ padding: '120px 0', background: C.surface }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
          <p
            style={{
              fontSize: 13,
              color: C.primary,
              fontFamily: "'Inter','Tajawal',sans-serif",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            التطبيقات
          </p>
          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(36px,5vw,56px)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.03em',
              margin: '0 0 20px',
              lineHeight: 1.1,
            }}
          >
            كل ما تحتاجه في
            <br />
            <span className="lp-gradient-text">منصة واحدة</span>
          </h2>
          <p
            style={{
              fontSize: 'clamp(16px,1.8vw,19px)',
              color: C.sub,
              lineHeight: 1.6,
              maxWidth: 580,
              margin: '0 auto',
            }}
          >
            مُحكم يغطي جميع احتياجات إدارة محلك أو شركتك — من المبيعات والمخزون وحتى الحسابات
            والموظفين.
          </p>
        </div>

        <div
          className="lp-features-bento"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gridAutoRows: 'minmax(180px, auto)',
            gap: 16,
          }}
        >
          {FEATURES.slice(0, 1).map((f, i) => (
            <div
              key={i}
              className="lp-card lp-reveal lp-d1"
              style={{
                gridColumn: 'span 3',
                gridRow: 'span 2',
                padding: 36,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: `linear-gradient(135deg, ${C.surface} 0%, ${C.primaryBg} 100%)`,
              }}
            >
              <div>
                <FeatureIcon gradient={f.gradient} icon={f.icon} size={56} />
                <div
                  style={{
                    fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                    fontSize: 24,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 12,
                    letterSpacing: '-0.02em',
                    marginTop: 14,
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 15, color: C.sub, lineHeight: 1.7, maxWidth: 320 }}>
                  {f.desc}
                </div>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: C.primary,
                  fontSize: 14,
                  fontWeight: 600,
                  marginTop: 24,
                }}
              >
                اعرف المزيد
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: 'scaleX(-1)' }}
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          ))}

          {FEATURES.slice(1, 3).map((f, i) => (
            <div
              key={i}
              className={`lp-card lp-reveal lp-d${((i % 4) + 2) as 2 | 3 | 4}`}
              style={{ gridColumn: 'span 3', padding: 28 }}
            >
              <FeatureIcon gradient={f.gradient} icon={f.icon} />
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 8,
                  letterSpacing: '-0.01em',
                  marginTop: 14,
                }}
              >
                {f.title}
              </div>
              <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}

          {FEATURES.slice(3, 6).map((f, i) => (
            <div
              key={i}
              className={`lp-card lp-reveal lp-d${((i % 4) + 1) as 1 | 2 | 3 | 4}`}
              style={{ gridColumn: 'span 2', padding: 28 }}
            >
              <FeatureIcon gradient={f.gradient} icon={f.icon} />
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 8,
                  letterSpacing: '-0.01em',
                  marginTop: 14,
                }}
              >
                {f.title}
              </div>
              <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}

          {FEATURES.slice(6, 7).map((f, i) => (
            <div
              key={i}
              className="lp-card lp-reveal lp-d3"
              style={{
                gridColumn: 'span 4',
                padding: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 24,
              }}
            >
              <FeatureIcon gradient={f.gradient} icon={f.icon} size={40} />
              <div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 4,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}

          {FEATURES.slice(7, 8).map((f, i) => (
            <div
              key={i}
              className="lp-card lp-reveal lp-d4"
              style={{ gridColumn: 'span 2', padding: 28 }}
            >
              <FeatureIcon gradient={f.gradient} icon={f.icon} />
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 8,
                  letterSpacing: '-0.01em',
                  marginTop: 14,
                }}
              >
                {f.title}
              </div>
              <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Showcase — Interactive Tabs with ClickableImage
══════════════════════════════════════════════ */
function ShowcaseSection() {
  const tabs = [
    {
      id: 'pos',
      label: 'نقطة البيع',
      img: salesImg,
      title: 'فواتير في ثواني',
      desc: 'أنشئ فاتورة بـ ٣ خطوات فقط — ابحث بالباركود، اختر العميل، اطبع.',
    },
    {
      id: 'inventory',
      label: 'المخزون',
      img: inventoryImg,
      title: 'مخزون لحظي دقيق',
      desc: 'تتبع كل صنف بكل مخزن، مع تنبيهات فورية عند الحد الأدنى.',
    },
    {
      id: 'repairs',
      label: 'الصيانة',
      img: repairsImg,
      title: 'تذاكر صيانة منظمة',
      desc: 'من الاستلام للتسليم — تابع كل جهاز وكل فني في مكان واحد.',
    },
    {
      id: 'reports',
      label: 'التقارير',
      img: reportsImg,
      title: 'تحليلات شاملة',
      desc: 'أرباح، خسائر، مبيعات، أفضل المنتجات — كلها في تقارير بصرية واضحة.',
    },
  ];
  const [active, setActive] = useState(0);

  return (
    <section
      className="lp-section-pad"
      style={{ padding: '120px 0', background: C.bg, overflow: 'hidden', position: 'relative' }}
    >
      <div
        className="lp-orb"
        style={{
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(255,179,0,.12) 0%, transparent 70%)',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
          <p
            style={{
              fontSize: 13,
              color: C.primary,
              fontFamily: "'Inter','Tajawal',sans-serif",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            جولة داخلية
          </p>
          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(36px,5vw,64px)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.035em',
              margin: '0 0 20px',
              lineHeight: 1.05,
            }}
          >
            كل قسم مصمم
            <br />
            <span className="lp-gradient-text">لإنتاجية أعلى</span>
          </h2>
          <p
            style={{
              fontSize: 'clamp(16px,1.8vw,19px)',
              color: C.sub,
              lineHeight: 1.6,
              maxWidth: 580,
              margin: '0 auto',
            }}
          >
            اختر أي قسم لترى كيف يعمل — واجهات احترافية مبنية على تجارب حقيقية.
          </p>
        </div>

        <div
          className="lp-reveal lp-tab-row"
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 48,
            flexWrap: 'wrap',
          }}
        >
          {tabs.map((t, i) => (
            <button
              key={t.id}
              className={`lp-tab ${active === i ? 'lp-tab-active' : ''}`}
              onClick={() => setActive(i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="lp-reveal lp-showcase-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.5fr',
            gap: 48,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: C.primaryBg,
                border: `1px solid ${C.primary}33`,
                color: C.primary,
                padding: '6px 14px',
                borderRadius: 980,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 24,
              }}
            >
              {tabs[active].label}
            </div>
            <h3
              style={{
                fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                fontSize: 'clamp(28px,3.5vw,44px)',
                fontWeight: 700,
                color: C.text,
                letterSpacing: '-0.03em',
                margin: '0 0 20px',
                lineHeight: 1.1,
              }}
            >
              {tabs[active].title}
            </h3>
            <p style={{ fontSize: 17, color: C.sub, lineHeight: 1.7, marginBottom: 28 }}>
              {tabs[active].desc}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'واجهة سريعة الاستجابة',
                'متوفر بالعربية والإنجليزية',
                'متصل بقاعدة البيانات لحظياً',
              ].map((f) => (
                <span
                  key={f}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    color: C.text,
                    fontSize: 15,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'rgba(52,199,89,.15)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#34C759"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              boxShadow: '0 32px 80px rgba(0,0,0,.1)',
              background: '#fff',
            }}
          >
            <div
              style={{
                height: 40,
                background: '#F5F5F7',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 14px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
              <div
                style={{
                  flex: 1,
                  height: 22,
                  background: '#E8E8EB',
                  borderRadius: 980,
                  maxWidth: 220,
                  marginRight: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 10, color: C.muted, fontFamily: 'Inter, monospace' }}>
                  app.muhkam.com/{tabs[active].id}
                </span>
              </div>
            </div>
            <ClickableImage
              src={tabs[active].img}
              alt={tabs[active].label}
              className="lp-showcase-img"
              style={{
                width: '100%',
                height: 460,
                objectFit: 'cover',
                objectPosition: 'top center',
                display: 'block',
                background: '#fff',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Testimonials — with real customer photos
══════════════════════════════════════════════ */
function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        'بعد ما بدأت أستخدم مُحكم، وفّرت ٣ ساعات يومياً من الدخول في الحسابات. كل حاجة بقت أتماتيك.',
      name: 'أحمد المصري',
      role: 'صاحب محل موبايلات',
      location: 'القاهرة',
      photo: ahmedImg,
      color: '#F59E0B',
    },
    {
      quote:
        'نظام الصيانة غيّر حياتي. بقيت أعرف كل جهاز فين وفيم وصل وإمتى هيخلص — من غير مكالمات ولا ورق.',
      name: 'محمد عبدالله',
      role: 'مدير فرع',
      location: 'الإسكندرية',
      photo: mohamedImg,
      color: '#A855F7',
    },
    {
      quote:
        'التقارير المالية بتطلعلي كل أسبوع أوتوماتيك. بقدر أتخذ قرارات بناءً على أرقام حقيقية مش تخمين.',
      name: 'خالد السيد',
      role: 'مدير مالي',
      location: 'الجيزة',
      photo: khaledImg,
      color: '#34C759',
    },
  ];

  return (
    <section
      className="lp-section-pad"
      style={{ padding: '120px 0', background: C.bg, overflow: 'hidden' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 72 }}>
          <p
            style={{
              fontSize: 13,
              color: C.primary,
              fontFamily: "'Inter','Tajawal',sans-serif",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            آراء عملائنا
          </p>
          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(36px,5vw,56px)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            +١٥٠ محل بيثقوا فينا
          </h2>
        </div>

        <div
          className="lp-reveal lp-testimonials-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}
        >
          {testimonials.map((t, i) => (
            <div key={i} className={`lp-testimonial lp-d${i + 1}`}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
                {[0, 1, 2, 3, 4].map((s) => (
                  <svg
                    key={s}
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="#F59E0B"
                    aria-hidden="true"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
              <p
                style={{
                  fontSize: 16,
                  color: C.text,
                  lineHeight: 1.75,
                  marginBottom: 28,
                  fontWeight: 400,
                }}
              >
                "{t.quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                    border: `2px solid ${t.color}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,.06)',
                  }}
                >
                  <img
                    src={t.photo}
                    alt={t.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 2,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {t.name}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {t.role} — {t.location}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
    <section
      id="pricing"
      className="lp-section-pad"
      style={{ padding: '120px 0', background: C.surface }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 64 }}>
          <p
            style={{
              fontSize: 13,
              color: C.primary,
              fontFamily: "'Inter','Tajawal',sans-serif",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            الأسعار
          </p>
          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(36px,5vw,56px)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.03em',
              margin: '0 0 20px',
              lineHeight: 1.1,
            }}
          >
            خطط واضحة بلا رسوم خفية
          </h2>
          <p
            style={{
              fontSize: 'clamp(16px,1.8vw,19px)',
              color: C.sub,
              lineHeight: 1.6,
              maxWidth: 580,
              margin: '0 auto',
            }}
          >
            اختر الخطة المناسبة لحجم عملك — وابدأ تجربتك المجانية لمدة ٧ أيام.
          </p>
        </div>

        <div
          className="lp-reveal lp-pricing-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginTop: 48 }}
        >
          {PLANS.map((p, i) => (
            <div
              key={i}
              className={`lp-pricing-card lp-d${i + 1} ${p.popular ? 'lp-pricing-card-popular' : ''}`}
            >
              {p.popular && <div className="lp-popular-badge">الأكثر شيوعاً</div>}
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                {p.name}
              </div>
              <div style={{ fontSize: 14, color: C.sub, marginBottom: 24 }}>{p.desc}</div>
              <div style={{ marginBottom: 24 }}>
                {p.enterprise ? (
                  <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>تواصل معنا</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: "'Inter','Tajawal',sans-serif",
                        fontSize: 40,
                        fontWeight: 700,
                        color: C.text,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {p.price}
                    </span>
                    <span style={{ fontSize: 14, color: C.muted }}>{p.unit}</span>
                  </div>
                )}
              </div>
              <button
                onClick={onRegister}
                className={p.popular ? 'lp-btn-primary' : 'lp-btn-outline'}
                style={{ width: '100%', marginBottom: 24 }}
              >
                {p.enterprise ? 'تواصل مع المبيعات' : 'ابدأ التجربة المجانية'}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.features.map((f) => (
                  <span key={f} className="lp-check" style={{ fontSize: 13 }}>
                    {f}
                  </span>
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
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="lp-section-pad" style={{ padding: '120px 0', background: C.bg }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <div className="lp-reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
          <p
            style={{
              fontSize: 13,
              color: C.primary,
              fontFamily: "'Inter','Tajawal',sans-serif",
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            الأسئلة الشائعة
          </p>
          <h2
            style={{
              fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
              fontSize: 'clamp(32px,4.5vw,48px)',
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            أجوبة على أكثر الأسئلة شيوعاً
          </h2>
        </div>

        <div className="lp-reveal">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <button
                className="lp-faq-btn"
                onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%' }}
              >
                <span>{item.q}</span>
                <span
                  style={{
                    transition: 'transform .2s',
                    transform: open === i ? 'rotate(45deg)' : 'none',
                    color: C.primary,
                    fontSize: 20,
                    fontWeight: 300,
                  }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <div
                  style={{
                    paddingBottom: 20,
                    fontSize: 15,
                    color: C.sub,
                    lineHeight: 1.75,
                    animation: 'lp-up .3s ease',
                  }}
                >
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
   Final CTA
══════════════════════════════════════════════ */
function FinalCTA({ onRegister }: { onRegister: () => void }) {
  return (
    <section style={{ padding: '80px 0', background: C.surface }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
        <div
          className="lp-reveal"
          style={{
            background: 'linear-gradient(135deg, #F59E0B 0%, #FFB300 100%)',
            borderRadius: 24,
            padding: '64px 48px',
            textAlign: 'center',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(255,255,255,.2) 0%, transparent 70%)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2
              style={{
                fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                fontSize: 'clamp(32px,4.5vw,48px)',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.03em',
                margin: '0 0 16px',
                lineHeight: 1.1,
              }}
            >
              ابدأ تجربتك المجانية اليوم
            </h2>
            <p
              style={{
                fontSize: 18,
                color: 'rgba(255,255,255,.85)',
                lineHeight: 1.6,
                marginBottom: 32,
                maxWidth: 500,
                margin: '0 auto 32px',
              }}
            >
              ٧ أيام مجاناً — بدون بطاقة ائتمان. اكتشف كيف يمكن لمُحكم أن يحوّل محلك.
            </p>
            <button
              onClick={onRegister}
              style={{
                height: 56,
                padding: '0 40px',
                background: '#fff',
                color: C.primary,
                border: 'none',
                borderRadius: 980,
                cursor: 'pointer',
                fontFamily: "'Tajawal','SF Pro Display','Inter',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'transform .2s',
                boxShadow: '0 8px 24px rgba(0,0,0,.15)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)')
              }
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0) scale(1)')}
            >
              ابدأ الآن
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: 'scaleX(-1)' }}
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════
   Footer — with real social icons
══════════════════════════════════════════════ */
function FooterSection({
  onLogin: _onLogin,
  onRegister: _onRegister,
}: {
  onLogin: () => void;
  onRegister: () => void;
}) {
  const cols = [
    { title: 'المنتج', links: ['المميزات', 'الأسعار', 'التجربة المجانية', 'التطبيقات'] },
    { title: 'الشركة', links: ['من نحن', 'المدونة', 'الوظائف', 'تواصل معنا'] },
    { title: 'الدعم', links: ['مركز المساعدة', 'الأسئلة الشائعة', 'التوثيق', 'الحالة'] },
    { title: 'قانوني', links: ['الشروط', 'الخصوصية', 'الأمان', 'الكوكيز'] },
  ];
  return (
    <footer
      style={{ background: C.surface, borderTop: `1px solid ${C.border}`, padding: '64px 0 32px' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div
          className="lp-footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            gap: 48,
            marginBottom: 48,
          }}
        >
          <div>
            <MuhkamLogo size={36} />
            <p
              style={{ fontSize: 14, color: C.sub, lineHeight: 1.7, marginTop: 16, maxWidth: 280 }}
            >
              نظام ERP عربي متكامل لإدارة محلات الموبايلات والصيانة والمؤسسات التجارية.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              {/* WhatsApp */}
              <a
                href="https://wa.me/201080902020"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: C.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.sub,
                  textDecoration: 'none',
                  transition: 'all .2s',
                  border: `1px solid ${C.border}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#25D366';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#25D366';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.bg;
                  e.currentTarget.style.color = C.sub;
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
              </a>
              {/* Facebook */}
              <a
                href="#"
                aria-label="Facebook"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: C.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.sub,
                  textDecoration: 'none',
                  transition: 'all .2s',
                  border: `1px solid ${C.border}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#1877F2';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#1877F2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.bg;
                  e.currentTarget.style.color = C.sub;
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="#"
                aria-label="Instagram"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: C.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.sub,
                  textDecoration: 'none',
                  transition: 'all .2s',
                  border: `1px solid ${C.border}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E4405F';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#E4405F';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.bg;
                  e.currentTarget.style.color = C.sub;
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a
                href="#"
                aria-label="LinkedIn"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: C.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.sub,
                  textDecoration: 'none',
                  transition: 'all .2s',
                  border: `1px solid ${C.border}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#0A66C2';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = '#0A66C2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = C.bg;
                  e.currentTarget.style.color = C.sub;
                  e.currentTarget.style.borderColor = C.border;
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
                {c.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.links.map((l) => (
                  <a key={l} href="#" className="lp-nav-link" style={{ fontSize: 13 }}>
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            paddingTop: 32,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 13, color: C.muted }}>© ٢٠٢٦ مُحكم. جميع الحقوق محفوظة.</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: C.muted }}>
            <a href="#" className="lp-nav-link" style={{ fontSize: 13 }}>
              الشروط
            </a>
            <a href="#" className="lp-nav-link" style={{ fontSize: 13 }}>
              الخصوصية
            </a>
            <a href="#" className="lp-nav-link" style={{ fontSize: 13 }}>
              الأمان
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/201080902020"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed',
        bottom: 24,
        left: 24,
        zIndex: 900,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: '#25D366',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(37,211,102,.4)',
        transition: 'transform .2s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
      </svg>
    </a>
  );
}

/* ══════════════════════════════════════════════
   Main LandingPage
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate] = useLocation();
  const obsRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    let el = document.getElementById(LP_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = LP_CSS_ID;
      document.head.appendChild(el);
    }
    el.textContent = LP_CSS;
    return () => {
      document.getElementById(LP_CSS_ID)?.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      obsRef.current = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('lp-in');
              obsRef.current?.unobserve(e.target);
            }
          }),
        { threshold: 0.07 }
      );
      document.querySelectorAll('.lp-reveal').forEach((el) => obsRef.current?.observe(el));
    }, 100);
    return () => {
      clearTimeout(timer);
      obsRef.current?.disconnect();
    };
  }, []);

  const goRegister = useCallback(() => navigate('/login?tab=register'), [navigate]);
  const goLogin = useCallback(() => navigate('/login'), [navigate]);

  return (
    <div
      dir="rtl"
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: "'Tajawal', system-ui, sans-serif",
        minHeight: '100vh',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <Navbar onLogin={goLogin} onRegister={goRegister} />
      <HeroSection onRegister={goRegister} onLogin={goLogin} />
      <LogoMarquee />
      <AnimatedStats />
      <FeaturesSection />
      <ShowcaseSection />
      <TestimonialsSection />
      <PricingSection onRegister={goRegister} />
      <FAQSection />
      <FinalCTA onRegister={goRegister} />
      <FooterSection onLogin={goLogin} onRegister={goRegister} />
      <WhatsAppButton />
    </div>
  );
}
