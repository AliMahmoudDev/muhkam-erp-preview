/* eslint-disable erp/no-hardcoded-colors -- AppScreenshots are purely presentational marketing mockups designed to look like real app screenshots. */
/**
 * High-fidelity application screenshots for marketing surfaces.
 * These are JSX representations of actual MUHKAM ERP screens.
 * Used by: LandingPage (hero + 3 capability sections) + Login (left panel).
 */

/* ── Dark app palette (matches the real MUHKAM ERP) ── */
const S = {
  bg:       '#0F1117',
  topbar:   '#131318',
  sidebar:  '#0C0C11',
  surface:  '#141418',
  surf2:    '#1A1A22',
  border:   '#252530',
  border2:  '#2E2E3A',
  text:     '#F4F4F5',
  text2:    '#A1A1AA',
  text3:    '#71717A',
  text4:    '#52525B',
  accent:   '#6366F1',
  acBg:     'rgba(99,102,241,.14)',
  green:    '#22C55E',
  greenBg:  'rgba(34,197,94,.12)',
  yellow:   '#EAB308',
  yellowBg: 'rgba(234,179,8,.12)',
  red:      '#EF4444',
  redBg:    'rgba(239,68,68,.12)',
  blueBg:   'rgba(99,102,241,.14)',
} as const;

/* ── Mini icons ── */
const IcoDash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IcoSales = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3h2l.4 2M7 13h10l4-8H5.4"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>
  </svg>
);
const IcoInv = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 8V21H3V8M1 3h22v5H1zM10 12h4"/>
  </svg>
);
const IcoAcct = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>
  </svg>
);
const IcoRep = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
);
const IcoFix = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const NAV_ITEMS = [
  { Icon: IcoDash,  label: 'لوحة التحكم', active: true  },
  { Icon: IcoSales, label: 'المبيعات',    active: false },
  { Icon: IcoInv,   label: 'المخزون',     active: false },
  { Icon: IcoAcct,  label: 'المحاسبة',    active: false },
  { Icon: IcoRep,   label: 'التقارير',    active: false },
  { Icon: IcoFix,   label: 'الصيانة',     active: false },
];

/* ── Reusable status badge ── */
function SBadge({ st }: { st: string }) {
  const map: Record<string, [string, string]> = {
    'مكتمل':        [S.greenBg,  S.green],
    'جاهز':         [S.greenBg,  S.green],
    'معلق':         [S.yellowBg, S.yellow],
    'مستلم':        [S.yellowBg, S.yellow],
    'ملغاة':        [S.redBg,    S.red],
    'جاري الإصلاح': [S.blueBg,   S.accent],
    'مسودة':        ['rgba(161,161,170,.14)', S.text3],
  };
  const [bg, clr] = map[st] ?? ['rgba(161,161,170,.14)', S.text3];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: bg, color: clr, whiteSpace: 'nowrap' }}>
      {st}
    </span>
  );
}

/* ── Shared topbar ── */
function Topbar({ title, action }: { title: string; action?: string }) {
  return (
    <div
      dir="rtl"
      style={{
        height: 44,
        background: S.topbar,
        borderBottom: `1px solid ${S.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: S.text, letterSpacing: '-0.025em' }}>مُحكم</span>
        <span style={{ fontSize: 7, fontWeight: 700, color: S.accent, letterSpacing: '.14em' }}>ERP</span>
      </div>
      <div style={{ width: 1, height: 18, background: S.border, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: S.text3 }}>{title}</span>
      <div style={{ flex: 1 }} />
      {action && (
        <div style={{ height: 28, padding: '0 14px', background: S.accent, borderRadius: 5, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', color: '#fff', flexShrink: 0 }}>
          {action}
        </div>
      )}
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        أ
      </div>
    </div>
  );
}

/* ── Sidebar ── */
function Sidebar() {
  return (
    <aside
      dir="rtl"
      style={{
        width: 172,
        background: S.sidebar,
        borderLeft: `1px solid ${S.border}`,
        padding: '10px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {NAV_ITEMS.map(({ Icon, label, active }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '7px 14px',
            background: active ? S.acBg : 'transparent',
            color: active ? S.accent : S.text4,
            borderRight: active ? `2px solid ${S.accent}` : '2px solid transparent',
          }}
        >
          <Icon />
          <span style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}>{label}</span>
        </div>
      ))}
    </aside>
  );
}

/* ══════════════════════════════════════════════
   1. Dashboard Screenshot
   Used in: Hero (landing) + Login left panel
══════════════════════════════════════════════ */
export function DashboardShot() {
  const CW = 100, CH = 70;
  const vals = [38, 52, 42, 68, 55, 85, 72];
  const pts = vals.map((v, i) => ({ x: (i / (vals.length - 1)) * CW, y: CH * (1 - v / 100) }));
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${CW} ${CH} L 0 ${CH} Z`;
  const maxI = vals.indexOf(Math.max(...vals));

  return (
    <div
      dir="rtl"
      style={{ width: '100%', height: '100%', background: S.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Tajawal', system-ui, sans-serif", fontSize: 11, color: S.text, overflow: 'hidden' }}
    >
      <Topbar title="لوحة التحكم" action="+ فاتورة" />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 11, overflow: 'hidden' }}>
          {/* Page header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.015em' }}>لوحة التحكم الرئيسية</div>
              <div style={{ fontSize: 10, color: S.text4, marginTop: 2 }}>السبت، ٢٢ يونيو ٢٠٢٦</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ height: 28, padding: '0 10px', background: S.surf2, borderRadius: 5, fontSize: 10, display: 'flex', alignItems: 'center', color: S.text3, border: `1px solid ${S.border}` }}>
                يونيو ٢٠٢٦ ▾
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, flexShrink: 0 }}>
            {[
              { l: 'الإيرادات',  v: '١٢٤٫٨ ألف', p: '+١٢٪', up: true  },
              { l: 'المصروفات', v: '٤٨٫٢ ألف',  p: '−٣٪',  up: false },
              { l: 'الأرباح',   v: '٧٦٫٦ ألف',  p: '+١٨٪', up: true  },
              { l: 'الطلبات',   v: '٢٤١',        p: '+٧٪',  up: true  },
            ].map((k) => (
              <div key={k.l} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: S.text4, marginBottom: 5, fontWeight: 600 }}>{k.l}</div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>{k.v}</div>
                <div style={{ fontSize: 9, color: k.up ? S.green : S.red, fontWeight: 600 }}>{k.p}</div>
              </div>
            ))}
          </div>

          {/* Chart + Top Products */}
          <div style={{ display: 'flex', gap: 10, flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ flex: '1 1 65%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: S.text2 }}>الإيرادات — آخر ٧ أيام</span>
                <span style={{ fontSize: 9, color: S.text4 }}>ر.س</span>
              </div>
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                  <defs>
                    <linearGradient id="ds-ag" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity=".22" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[25, 50, 75].map((p) => (
                    <line key={p} x1="0" y1={CH * (1 - p / 100)} x2={CW} y2={CH * (1 - p / 100)} stroke="#252530" strokeWidth=".5" />
                  ))}
                  <path d={areaD} fill="url(#ds-ag)" />
                  <polyline points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={pts[maxI].x.toFixed(1)} cy={pts[maxI].y.toFixed(1)} r="2" fill="#6366F1" />
                </svg>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, flexShrink: 0 }}>
                {['الأح', 'الاث', 'الث', 'الأر', 'الخ', 'الج', 'الس'].map((d) => (
                  <span key={d} style={{ fontSize: 8, color: S.text4 }}>{d}</span>
                ))}
              </div>
            </div>

            <div style={{ flex: '0 0 33%', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: '12px 14px', overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: S.text2, marginBottom: 10 }}>أعلى المنتجات</div>
              {[
                { n: 'iPhone 15 Pro', p: 92, q: '١٤٢' },
                { n: 'Samsung S24',   p: 64, q: '٩٨'  },
                { n: 'MacBook Air',   p: 44, q: '٦٧'  },
                { n: 'AirPods Pro',   p: 31, q: '٤٥'  },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 500 }}>{item.n}</span>
                    <span style={{ fontSize: 9, color: S.text4 }}>{item.q} ق</span>
                  </div>
                  <div style={{ height: 3, background: S.border2, borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${item.p}%`, background: S.accent, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${S.border}`, fontSize: 10, fontWeight: 600, color: S.text2 }}>آخر المعاملات</div>
            {[
              { item: 'iPhone 15 Pro',  cust: 'أحمد علي',    amt: '٢٥٫٥٠٠ ر.س', st: 'مكتمل' },
              { item: 'Samsung S24+',   cust: 'محمد الشريف', amt: '١٨٫٩٠٠ ر.س', st: 'مكتمل' },
              { item: 'MacBook Air M3', cust: 'سارة الأحمد', amt: '٣٢٫٠٠٠ ر.س', st: 'معلق'  },
            ].map((t, i, a) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: i < a.length - 1 ? `1px solid ${S.border}` : 'none', fontSize: 10 }}>
                <div style={{ flex: '0 0 32%', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.item}</div>
                <div style={{ flex: 1, color: S.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.cust}</div>
                <div style={{ flex: '0 0 22%', color: S.accent, fontWeight: 600, direction: 'ltr', textAlign: 'left', whiteSpace: 'nowrap' }}>{t.amt}</div>
                <SBadge st={t.st} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   2. Sales (Invoices) Screenshot
══════════════════════════════════════════════ */
export function SalesShot() {
  const invoices = [
    { no: 'INV-2419', cust: 'أحمد محمد علي',         date: '٢٢ يونيو',  amt: '٢٥٫٥٠٠ ر.س',  st: 'مكتمل' },
    { no: 'INV-2418', cust: 'شركة الخليج للتجارة',   date: '٢١ يونيو',  amt: '١٣٢٫٠٠٠ ر.س', st: 'مكتمل' },
    { no: 'INV-2417', cust: 'محمد عبدالله الحارثي',  date: '٢١ يونيو',  amt: '١٨٫٩٠٠ ر.س',  st: 'معلق'  },
    { no: 'INV-2416', cust: 'سارة الأحمد',           date: '٢٠ يونيو',  amt: '٣٢٫٠٠٠ ر.س',  st: 'مكتمل' },
    { no: 'INV-2415', cust: 'عمر الرشيد',            date: '٢٠ يونيو',  amt: '٤٥٫٧٠٠ ر.س',  st: 'مكتمل' },
    { no: 'INV-2414', cust: 'شركة النور للإلكترونيات', date: '١٩ يونيو', amt: '٨٩٫٣٠٠ ر.س',  st: 'ملغاة'  },
    { no: 'INV-2413', cust: 'خالد مصطفى',            date: '١٩ يونيو',  amt: '٣٫٢٠٠ ر.س',   st: 'مكتمل' },
  ];

  const thStyle: React.CSSProperties = { fontSize: 9, color: S.text4, fontWeight: 700, letterSpacing: '0.06em', textAlign: 'right', padding: '8px 0' };
  const tdStyle: React.CSSProperties = { fontSize: 11, padding: '9px 0', borderBottom: `1px solid ${S.border}`, verticalAlign: 'middle', textAlign: 'right' };

  return (
    <div dir="rtl" style={{ width: '100%', height: '100%', background: S.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Tajawal', system-ui, sans-serif", fontSize: 11, color: S.text, overflow: 'hidden' }}>
      <Topbar title="الفواتير" action="+ فاتورة جديدة" />

      {/* Toolbar */}
      <div style={{ height: 48, background: S.topbar, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
        {['الكل', 'مكتملة', 'معلقة', 'مسودة'].map((f, i) => (
          <div key={f} style={{ height: 28, padding: '0 12px', borderRadius: 5, fontSize: 11, fontWeight: i === 0 ? 600 : 400, display: 'flex', alignItems: 'center', background: i === 0 ? S.surf2 : 'transparent', color: i === 0 ? S.text : S.text3, border: i === 0 ? `1px solid ${S.border}` : 'none', cursor: 'default' }}>
            {f}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ height: 28, padding: '0 12px', background: S.surf2, borderRadius: 5, fontSize: 10, display: 'flex', alignItems: 'center', gap: 5, color: S.text3, border: `1px solid ${S.border}` }}>
          <span>🔍</span><span>بحث في الفواتير</span>
        </div>
        <div style={{ height: 28, padding: '0 12px', background: S.surf2, borderRadius: 5, fontSize: 10, display: 'flex', alignItems: 'center', color: S.text3, border: `1px solid ${S.border}` }}>
          تصدير ▾
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['رقم الفاتورة', 'العميل', 'التاريخ', 'المجموع', 'الحالة', ''].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.no}>
                <td style={{ ...tdStyle, color: S.accent, fontWeight: 600, fontFamily: "'Inter', monospace", fontSize: 10 }}>{inv.no}</td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{inv.cust}</td>
                <td style={{ ...tdStyle, color: S.text3 }}>{inv.date} ٢٠٢٦</td>
                <td style={{ ...tdStyle, fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{inv.amt}</td>
                <td style={tdStyle}><SBadge st={inv.st} /></td>
                <td style={{ ...tdStyle, width: 28 }}><div style={{ width: 20, height: 20, borderRadius: 4, background: S.surf2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: S.text4 }}>⋯</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ height: 40, borderTop: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: S.text4 }}>٧ فاتورة من أصل ٣٢١</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['←', '١', '٢', '٣', '...', '٤٧', '→'].map((p) => (
            <div key={p} style={{ width: 24, height: 24, borderRadius: 4, background: p === '١' ? S.accent : S.surf2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: p === '١' ? '#fff' : S.text3, border: p === '١' ? 'none' : `1px solid ${S.border}` }}>
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   3. Accounting (Trial Balance) Screenshot
══════════════════════════════════════════════ */
export function AccountingShot() {
  const accounts = [
    { name: 'النقدية بالخزينة',      code: '1001', dr: '٤٨٫٢٠٠',  cr: '—',         bal: '٤٨٫٢٠٠',  pos: true  },
    { name: 'بنك الراجحي',           code: '1011', dr: '٢١٦٫٨٠٠', cr: '—',         bal: '٢١٦٫٨٠٠', pos: true  },
    { name: 'الذمم المدينة',          code: '1201', dr: '٨٣٫٥٠٠',  cr: '٢١٫٠٠٠',   bal: '٦٢٫٥٠٠',  pos: true  },
    { name: 'المخزون',               code: '1301', dr: '١٨٩٫٠٠٠', cr: '٦٤٫٠٠٠',   bal: '١٢٥٫٠٠٠', pos: true  },
    { name: 'الذمم الدائنة',          code: '2001', dr: '—',        cr: '٤٧٫٨٠٠',   bal: '٤٧٫٨٠٠',  pos: false },
    { name: 'القرض البنكي',           code: '2101', dr: '—',        cr: '١٢٠٫٠٠٠',  bal: '١٢٠٫٠٠٠', pos: false },
    { name: 'رأس المال',             code: '3001', dr: '—',        cr: '٣٠٠٫٠٠٠',  bal: '٣٠٠٫٠٠٠', pos: false },
    { name: 'إيرادات المبيعات',       code: '4001', dr: '—',        cr: '١٢٤٫٨٠٠',  bal: '١٢٤٫٨٠٠', pos: false },
    { name: 'تكلفة البضاعة المباعة',  code: '5001', dr: '٦٤٫٠٠٠',  cr: '—',         bal: '٦٤٫٠٠٠',  pos: true  },
    { name: 'المصروفات الإدارية',     code: '6001', dr: '١٩٫٢٠٠',  cr: '—',         bal: '١٩٫٢٠٠',  pos: true  },
  ];

  const thS: React.CSSProperties = { fontSize: 9, color: S.text4, fontWeight: 700, letterSpacing: '0.06em', padding: '8px 0', textAlign: 'right', borderBottom: `1px solid ${S.border2}` };
  const tdS: React.CSSProperties = { fontSize: 10, padding: '8px 0', borderBottom: `1px solid ${S.border}`, textAlign: 'right', verticalAlign: 'middle' };

  return (
    <div dir="rtl" style={{ width: '100%', height: '100%', background: S.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Tajawal', system-ui, sans-serif", fontSize: 11, color: S.text, overflow: 'hidden' }}>
      <Topbar title="ميزان المراجعة" />

      {/* Period bar */}
      <div style={{ height: 44, background: S.topbar, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: S.text3 }}>الفترة:</span>
        {['يناير ٢٠٢٦', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو ٢٠٢٦'].map((m, i) => (
          <div key={m} style={{ height: 26, padding: '0 10px', borderRadius: 4, fontSize: 10, display: 'flex', alignItems: 'center', background: i === 5 ? S.acBg : 'transparent', color: i === 5 ? S.accent : S.text4, fontWeight: i === 5 ? 600 : 400, cursor: 'default' }}>
            {m}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ height: 26, padding: '0 12px', background: S.surf2, borderRadius: 4, fontSize: 10, display: 'flex', alignItems: 'center', color: S.text3, border: `1px solid ${S.border}`, cursor: 'default' }}>
          تصدير PDF
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thS}>اسم الحساب</th>
              <th style={{ ...thS, width: 60 }}>الرمز</th>
              <th style={{ ...thS, width: '18%', textAlign: 'left', direction: 'ltr' }}>مدين</th>
              <th style={{ ...thS, width: '18%', textAlign: 'left', direction: 'ltr' }}>دائن</th>
              <th style={{ ...thS, width: '18%', textAlign: 'left', direction: 'ltr' }}>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.code}>
                <td style={{ ...tdS, fontWeight: 500 }}>{a.name}</td>
                <td style={{ ...tdS, color: S.text4, fontFamily: 'Inter', fontSize: 10 }}>{a.code}</td>
                <td style={{ ...tdS, direction: 'ltr', textAlign: 'left', color: a.dr !== '—' ? S.text2 : S.text4, fontWeight: a.dr !== '—' ? 500 : 400 }}>{a.dr}</td>
                <td style={{ ...tdS, direction: 'ltr', textAlign: 'left', color: a.cr !== '—' ? S.text2 : S.text4, fontWeight: a.cr !== '—' ? 500 : 400 }}>{a.cr}</td>
                <td style={{ ...tdS, direction: 'ltr', textAlign: 'left', fontWeight: 600, color: a.pos ? S.green : S.text }}>{a.bal}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: '10px 0', fontWeight: 700, fontSize: 11, borderTop: `1px solid ${S.border2}` }}>المجموع الكلي</td>
              <td style={{ borderTop: `1px solid ${S.border2}` }} />
              <td style={{ padding: '10px 0', fontWeight: 700, direction: 'ltr', textAlign: 'left', borderTop: `1px solid ${S.border2}`, color: S.accent }}>٦٢٠٫٧٠٠</td>
              <td style={{ padding: '10px 0', fontWeight: 700, direction: 'ltr', textAlign: 'left', borderTop: `1px solid ${S.border2}`, color: S.accent }}>٦٧٧٫٦٠٠</td>
              <td style={{ borderTop: `1px solid ${S.border2}` }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   4. Repairs (Jobs) Screenshot
══════════════════════════════════════════════ */
export function RepairShot() {
  const jobs = [
    { id: '٠٠٤٢١', device: 'iPhone 15 Pro Max',  cust: 'محمد عبدالله',  tech: 'أحمد عبد الرحمن', st: 'جاري الإصلاح', due: '٢٣ يونيو' },
    { id: '٠٠٤٢٠', device: 'Samsung Galaxy S24+', cust: 'فاطمة الزهراء', tech: 'محمد السيد',         st: 'جاهز',         due: '٢٢ يونيو' },
    { id: '٠٠٤١٩', device: 'MacBook Pro 14"',     cust: 'خالد الحربي',   tech: 'سارة المنيع',      st: 'جاري الإصلاح', due: '٢٥ يونيو' },
    { id: '٠٠٤١٨', device: 'iPad Pro 12.9"',      cust: 'عبدالعزيز',    tech: 'أحمد عبد الرحمن', st: 'مكتمل',         due: '٢١ يونيو' },
    { id: '٠٠٤١٧', device: 'iPhone 14 Pro',       cust: 'نورة العتيبي',  tech: 'محمد السيد',         st: 'مستلم',        due: '٢٤ يونيو' },
    { id: '٠٠٤١٦', device: 'Dell XPS 15',         cust: 'شركة الخليج',  tech: 'سارة المنيع',      st: 'مستلم',        due: '٢٦ يونيو' },
  ];

  const thS: React.CSSProperties = { fontSize: 9, color: S.text4, fontWeight: 700, letterSpacing: '0.06em', padding: '8px 0', textAlign: 'right', borderBottom: `1px solid ${S.border2}` };
  const tdS: React.CSSProperties = { fontSize: 10, padding: '8px 0', borderBottom: `1px solid ${S.border}`, textAlign: 'right', verticalAlign: 'middle' };

  return (
    <div dir="rtl" style={{ width: '100%', height: '100%', background: S.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Tajawal', system-ui, sans-serif", fontSize: 11, color: S.text, overflow: 'hidden' }}>
      <Topbar title="أوامر الصيانة" action="+ طلب صيانة" />

      {/* Summary strip */}
      <div style={{ height: 48, background: S.topbar, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6, flexShrink: 0 }}>
        {[
          { l: 'الإجمالي',        v: '٨٧', c: S.text2 },
          { l: 'جاري التنفيذ',    v: '٢٣', c: S.accent },
          { l: 'جاهز للتسليم',   v: '١٢', c: S.green  },
          { l: 'مستلم اليوم',    v: '٥',  c: S.yellow },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 30, borderRadius: 5, background: S.surf2, border: `1px solid ${S.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: item.c }}>{item.v}</span>
            <span style={{ fontSize: 10, color: S.text3 }}>{item.l}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ height: 28, padding: '0 12px', background: S.surf2, borderRadius: 5, fontSize: 10, display: 'flex', alignItems: 'center', gap: 5, color: S.text3, border: `1px solid ${S.border}` }}>
          <span>🔍</span><span>بحث</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'الجهاز', 'العميل', 'الفني', 'الحالة', 'الموعد'].map((h) => (
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td style={{ ...tdS, color: S.accent, fontFamily: 'Inter', fontSize: 10, fontWeight: 600 }}>{j.id}</td>
                <td style={{ ...tdS, fontWeight: 500 }}>{j.device}</td>
                <td style={{ ...tdS, color: S.text2 }}>{j.cust}</td>
                <td style={{ ...tdS, color: S.text3, fontSize: 10 }}>{j.tech}</td>
                <td style={tdS}><SBadge st={j.st} /></td>
                <td style={{ ...tdS, color: S.text3, fontSize: 10, whiteSpace: 'nowrap' }}>{j.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
