/* eslint-disable erp/no-hardcoded-colors -- landing page and modal decorative colors: intentional fixed palette */
/**
 * LiveDashboard — animated ERP dashboard mockup for marketing surfaces.
 * Used in: Landing product reveal section + Login left panel.
 * Purely presentational: no state, no API, no routing.
 */
import { useEffect, useRef, useState } from 'react';

const LIVE_DASH_CSS_ID = 'muhkam-live-dash-css';
const LIVE_DASH_CSS = `
@keyframes ld-bar-grow {
  from { transform: scaleY(0); opacity: 0; }
  to   { transform: scaleY(1); opacity: 1; }
}
@keyframes ld-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes ld-row-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ld-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.ld-pulse { animation: ld-pulse 2.2s ease infinite; }
`;

/* ── Palette ── */
const D = {
  bg:       '#09090B',
  surface:  '#111115',
  surface2: '#0D0D12',
  border:   '#1C1C21',
  border2:  '#27272A',
  text1:    '#F8F8FA',
  text2:    '#A1A1AA',
  text3:    '#71717A',
  text4:    '#52525B',
  accent:   '#6366F1',
  green:    '#22C55E',
  red:      '#EF4444',
  yellow:   '#EAB308',
} as const;

/* ── SVG Nav Icons ── */
const IcoDash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IcoSales = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
  </svg>
);
const IcoInventory = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 8V21H3V8M1 3h22v5H1zM10 12h4"/>
  </svg>
);
const IcoAccounting = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>
  </svg>
);
const IcoReports = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
);
const IcoRepair = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
const IcoBell = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const NAV = [
  { Icon: IcoDash,       label: 'لوحة التحكم', active: true  },
  { Icon: IcoSales,      label: 'المبيعات',    active: false },
  { Icon: IcoInventory,  label: 'المخزون',     active: false },
  { Icon: IcoAccounting, label: 'المحاسبة',    active: false },
  { Icon: IcoReports,    label: 'التقارير',    active: false },
  { Icon: IcoRepair,     label: 'الصيانة',     active: false },
];

const CHART_VALS = [62, 78, 52, 91, 68, 95, 83];
const CHART_LABELS = ['الأح', 'الاث', 'الث', 'الأر', 'الخ', 'الج', 'الس'];

const KPIS = [
  { label: 'الإيرادات',  raw: 124800, display: '١٢٤٫٨ ألف', pct: '+١٢.٤%', up: true  },
  { label: 'المصروفات', raw: 48200,  display: '٤٨٫٢ ألف',  pct: '−٣.١%',  up: false },
  { label: 'الأرباح',   raw: 76600,  display: '٧٦٫٦ ألف',  pct: '+١٨.٢%', up: true  },
  { label: 'الطلبات',   raw: 241,    display: '٢٤١',        pct: '+٧.٣%',  up: true  },
];

const TRANSACTIONS = [
  { item: 'iPhone 15 Pro',   customer: 'أحمد علي',       amount: '٢٥٫٥٠٠ ج', status: 'مكتمل' },
  { item: 'Samsung S24',     customer: 'محمد الشريف',    amount: '١٨٫٩٠٠ ج', status: 'مكتمل' },
  { item: 'MacBook Air M3',  customer: 'سارة إبراهيم',   amount: '٣٢٫٠٠٠ ج', status: 'معلق'  },
  { item: 'AirPods Pro 2',   customer: 'خالد مصطفى',     amount: '٣٫٢٠٠ ج',  status: 'مكتمل' },
];

const TOP_PRODUCTS = [
  { name: 'iPhone 15 Pro', pct: 92, qty: '١٤٢ قطعة' },
  { name: 'Samsung S24',   pct: 64, qty: '٩٨ قطعة'  },
  { name: 'MacBook Air',   pct: 44, qty: '٦٧ قطعة'  },
];

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export function LiveDashboard({ compact = false }: { compact?: boolean }) {
  const [chartReady, setChartReady] = useState(false);
  const [pulse, setPulse]           = useState(false);
  const [counts, setCounts]         = useState(KPIS.map(() => 0));
  const animRef                     = useRef<number>(0);

  /* Inject CSS */
  useEffect(() => {
    if (document.getElementById(LIVE_DASH_CSS_ID)) return;
    const el = document.createElement('style');
    el.id = LIVE_DASH_CSS_ID;
    el.textContent = LIVE_DASH_CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  /* KPI counter animation */
  useEffect(() => {
    const targets = KPIS.map((k) => k.raw);
    const dur = 1800;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - (1 - p) ** 3;
      setCounts(targets.map((v) => Math.round(v * ease)));
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setChartReady(true);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  /* Notification pulse */
  useEffect(() => {
    const t = setInterval(() => setPulse((v) => !v), 2400);
    return () => clearInterval(t);
  }, []);

  const fmtCount = (raw: number, i: number) => {
    const v = counts[i];
    if (raw >= 1000) {
      return (v / 1000).toFixed(1) + ' ألف';
    }
    return String(v);
  };

  const px = compact ? 12 : 20;
  const fs = compact ? 10 : 12;

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: D.bg,
        fontFamily: "'Tajawal', system-ui, sans-serif",
        fontSize: fs,
        color: D.text1,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ── TOPBAR ── */}
      <div
        style={{
          height: compact ? 38 : 44,
          background: D.surface2,
          borderBottom: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${px}px`,
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: D.text1, letterSpacing: '-0.025em' }}>مُحكم</span>
          <span style={{ fontSize: 7, fontWeight: 700, color: D.accent, letterSpacing: '0.15em' }}>ERP</span>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: D.text4, fontSize: fs - 1 }}>
          <span>/</span>
          <span style={{ color: D.text2 }}>لوحة التحكم</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Notifications */}
        <div style={{ position: 'relative', color: D.text3 }}>
          <IcoBell />
          <div
            className="ld-pulse"
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: D.accent,
              border: `1.5px solid ${D.bg}`,
              opacity: pulse ? 1 : 0.3,
            }}
          />
        </div>

        {/* Avatar */}
        <div
          style={{
            width: compact ? 24 : 28,
            height: compact ? 24 : 28,
            borderRadius: '50%',
            background: D.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 9 : 10,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          أ
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR ── */}
        <aside
          style={{
            width: compact ? 44 : 160,
            background: D.surface2,
            borderLeft: `1px solid ${D.border}`,
            display: 'flex',
            flexDirection: 'column',
            padding: `${compact ? 8 : 12}px 0`,
            gap: 2,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {NAV.map(({ Icon, label, active }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: compact ? 0 : 10,
                justifyContent: compact ? 'center' : 'flex-start',
                padding: compact ? '8px 0' : '8px 16px',
                background: active ? `rgba(99,102,241,.12)` : 'transparent',
                color: active ? D.accent : D.text4,
                borderRight: active ? `2px solid ${D.accent}` : '2px solid transparent',
                cursor: 'default',
                transition: 'none',
              }}
            >
              <Icon />
              {!compact && (
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
              )}
            </div>
          ))}
        </aside>

        {/* ── MAIN ── */}
        <div
          style={{
            flex: 1,
            padding: px,
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? 10 : 14,
            overflow: 'hidden',
          }}
        >
          {/* Page header */}
          {!compact && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: D.text1, letterSpacing: '-0.01em' }}>لوحة التحكم الرئيسية</div>
                <div style={{ fontSize: 11, color: D.text4, marginTop: 2 }}>السبت، ٢٢ يونيو ٢٠٢٦</div>
              </div>
              <div
                style={{
                  padding: '5px 12px',
                  background: D.accent,
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                + فاتورة جديدة
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(4,1fr)', gap: compact ? 6 : 10 }}>
            {(compact ? KPIS.slice(0, 2) : KPIS).map((k, i) => (
              <div
                key={k.label}
                style={{
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  borderRadius: compact ? 7 : 10,
                  padding: compact ? '9px 10px' : '14px 16px',
                  animation: `ld-fade .5s ${i * 0.06}s ease both`,
                }}
              >
                <div style={{ fontSize: compact ? 9 : 10, color: D.text4, marginBottom: compact ? 4 : 6, fontWeight: 500 }}>{k.label}</div>
                <div style={{ fontSize: compact ? 13 : 18, fontWeight: 700, color: D.text1, letterSpacing: '-0.02em', marginBottom: compact ? 3 : 4 }}>
                  {chartReady ? k.display : fmtCount(k.raw, i)}
                </div>
                <div style={{ fontSize: compact ? 9 : 10, color: k.up ? D.green : D.red, fontWeight: 600 }}>{k.pct}</div>
              </div>
            ))}
          </div>

          {/* Chart + Products row */}
          <div style={{ display: 'flex', gap: compact ? 8 : 12, flex: 1, overflow: 'hidden', minHeight: 0 }}>

            {/* Bar chart */}
            <div
              style={{
                flex: compact ? '1 1 60%' : '1 1 65%',
                background: D.surface,
                border: `1px solid ${D.border}`,
                borderRadius: compact ? 7 : 10,
                padding: compact ? '10px 12px' : '16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: compact ? 10 : 12, fontWeight: 600, color: D.text2, marginBottom: compact ? 8 : 12 }}>
                الإيرادات — ٧ أيام
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: compact ? 3 : 6, flex: 1, paddingBottom: compact ? 16 : 20 }}>
                {CHART_VALS.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 3 : 5, height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${v}%`,
                        borderRadius: '3px 3px 0 0',
                        background: i === 5 ? D.accent : `rgba(99,102,241,${0.2 + (v / 100) * 0.3})`,
                        transformOrigin: 'bottom',
                        animation: chartReady ? `ld-bar-grow .9s ${i * 0.05}s cubic-bezier(.16,1,.3,1) both` : 'none',
                        minHeight: 2,
                      }}
                    />
                    <div style={{ fontSize: compact ? 7 : 9, color: D.text4, whiteSpace: 'nowrap' }}>{CHART_LABELS[i]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top products */}
            <div
              style={{
                flex: compact ? '0 0 38%' : '0 0 33%',
                background: D.surface,
                border: `1px solid ${D.border}`,
                borderRadius: compact ? 7 : 10,
                padding: compact ? '10px 12px' : '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: compact ? 8 : 10,
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: compact ? 10 : 12, fontWeight: 600, color: D.text2 }}>أعلى المنتجات</div>
              {TOP_PRODUCTS.map((p, i) => (
                <div key={i} style={{ animation: `ld-row-in .4s ${0.3 + i * 0.08}s ease both` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: compact ? 3 : 4 }}>
                    <span style={{ fontSize: compact ? 9 : 11, color: D.text1, fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: compact ? 8 : 10, color: D.text4 }}>{p.qty}</span>
                  </div>
                  <div style={{ height: compact ? 3 : 4, background: D.border2, borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${p.pct}%`,
                        background: D.accent,
                        borderRadius: 2,
                        transition: 'width .8s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions */}
          {!compact && (
            <div
              style={{
                background: D.surface,
                border: `1px solid ${D.border}`,
                borderRadius: 10,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, fontSize: 12, fontWeight: 600, color: D.text2 }}>
                آخر المعاملات
              </div>
              {TRANSACTIONS.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '9px 16px',
                    borderBottom: i < TRANSACTIONS.length - 1 ? `1px solid ${D.border}` : 'none',
                    fontSize: 11,
                    animation: `ld-row-in .4s ${0.4 + i * 0.05}s ease both`,
                  }}
                >
                  <div style={{ flex: '0 0 160px', color: D.text1, fontWeight: 500 }}>{t.item}</div>
                  <div style={{ flex: 1, color: D.text3 }}>{t.customer}</div>
                  <div style={{ flex: '0 0 100px', textAlign: 'left', color: D.accent, fontWeight: 600, direction: 'ltr' }}>{t.amount}</div>
                  <div
                    style={{
                      flex: '0 0 60px',
                      textAlign: 'center',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      background: t.status === 'مكتمل' ? 'rgba(34,197,94,.1)' : 'rgba(234,179,8,.1)',
                      color: t.status === 'مكتمل' ? D.green : D.yellow,
                    }}
                  >
                    {t.status}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Compact: mini transactions */}
          {compact && (
            <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: '7px 10px', borderBottom: `1px solid ${D.border}`, fontSize: 9, fontWeight: 600, color: D.text4 }}>آخر المعاملات</div>
              {TRANSACTIONS.slice(0, 3).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: i < 2 ? `1px solid ${D.border}` : 'none', animation: `ld-row-in .4s ${0.4 + i * 0.05}s ease both` }}>
                  <span style={{ fontSize: 9, color: D.text2 }}>{t.item}</span>
                  <span style={{ fontSize: 9, color: D.accent, fontWeight: 600, direction: 'ltr' }}>{t.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
