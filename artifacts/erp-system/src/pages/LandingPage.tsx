import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

/* ══════════════════════════════════════════════
   CSS — keyframes + utility classes
══════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@keyframes lp-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes lp-float {
  0%,100% { transform: translateY(0)     scale(1);    opacity:.45; }
  50%     { transform: translateY(-22px) scale(1.12); opacity:.85; }
}
@keyframes lp-gradient-pan {
  0%,100% { background-position: 0%   50%; }
  50%     { background-position: 100% 50%; }
}
@keyframes lp-pulse-glow {
  0%,100% { box-shadow: 0 0 28px rgba(245,158,11,.45), 0 8px 32px rgba(0,0,0,.3); }
  50%     { box-shadow: 0 0 60px rgba(245,158,11,.75), 0 16px 48px rgba(0,0,0,.4); }
}
@keyframes lp-ping {
  0%       { transform: scale(1);   opacity: .55; }
  70%,100% { transform: scale(2.2); opacity: 0;   }
}
@keyframes lp-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes lp-bar-grow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes lp-slide-up {
  from { opacity: 0; transform: translateY(36px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lp-spin-slow { to { transform: rotate(360deg); } }
@keyframes lp-breathe {
  0%,100% { opacity: .05; }
  50%     { opacity: .11; }
}
@keyframes lp-count-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.lp-fade { opacity:0; transform:translateY(32px); transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1); }
.lp-fade.lp-in { opacity:1; transform:none; }
.lp-d1{transition-delay:.04s} .lp-d2{transition-delay:.11s} .lp-d3{transition-delay:.18s}
.lp-d4{transition-delay:.25s} .lp-d5{transition-delay:.32s} .lp-d6{transition-delay:.39s}
.lp-d7{transition-delay:.46s} .lp-d8{transition-delay:.53s} .lp-d9{transition-delay:.60s}

.lp-shim { position:relative; overflow:hidden; }
.lp-shim::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.22) 50%,transparent 65%);
  background-size:200% 100%; background-position:-200% center; pointer-events:none;
}
.lp-shim:hover::after { animation:lp-shimmer .55s ease forwards; }

.lp-card { transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s ease,border-color .3s ease; }
.lp-card:hover {
  transform: translateY(-9px);
  box-shadow: 0 0 0 1px rgba(245,158,11,.38), 0 28px 70px rgba(245,158,11,.12), inset 0 0 80px rgba(245,158,11,.04);
  border-color: rgba(245,158,11,.4) !important;
}
.lp-card:active { transform: translateY(-4px); }

.lp-bar { transform-origin:bottom; animation:lp-bar-grow 1.2s cubic-bezier(.34,1.56,.64,1) both; animation-play-state:paused; }
.lp-chart-live .lp-bar { animation-play-state:running; }

.lp-stat-num { display:inline-block; animation:lp-count-in .6s ease both; animation-play-state:paused; }
.lp-stats-live .lp-stat-num { animation-play-state:running; }

@media(max-width:768px){
  .lp-nav-links,.lp-nav-btns { display:none !important; }
  .lp-hamburger { display:flex !important; }
  .lp-grid-2,.lp-grid-4 { grid-template-columns:1fr !important; }
  .lp-grid-3 { grid-template-columns:1fr !important; }
  .lp-bento { grid-template-columns:1fr 1fr !important; }
  .lp-bento .lp-wide,.lp-bento .lp-full { grid-column:span 1 !important; }
  .lp-hero-mockup { display:none !important; }
  .lp-spotlight { grid-template-columns:1fr !important; }
}
@media(min-width:769px){ .lp-hamburger { display:none !important; } }
`;

/* ══════════════════════════════════════════════
   Mini Mockup Components (pure CSS, no deps)
══════════════════════════════════════════════ */
function MiniAccounting() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(99,102,241,.2)' }}>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        {([['إيرادات','١٢٤٫٨ك','#10b981'],['مصروفات','٤٨٫٢ك','#ef4444'],['أرباح','٧٦٫٦ك','#f59e0b']] as [string,string,string][]).map(([l,v,c]) => (
          <div key={l} style={{ flex:1, background:'rgba(255,255,255,.04)', borderRadius:8, padding:'7px 8px', border:'1px solid rgba(255,255,255,.07)' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', marginBottom:3, fontFamily:'Tajawal,sans-serif' }}>{l}</div>
            <div style={{ fontSize:13, fontWeight:900, color:c, fontFamily:'Tajawal,sans-serif' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:44 }}>
        {[55,75,48,90,62,82,70].map((h, i) => (
          <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:'3px 3px 0 0', background: i===5 ? 'linear-gradient(to top,#6366f1,#818cf8)' : 'rgba(99,102,241,.28)' }} />
        ))}
      </div>
    </div>
  );
}

function MiniSales() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(245,158,11,.2)' }}>
      <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', marginBottom:7, fontFamily:'Tajawal,sans-serif' }}>فاتورة #٢٤١٩</div>
      {([['iPhone 15 Pro','٢٥٫٥٠٠ ج'],['Apple Watch','٨٫٩٠٠ ج'],['AirPods Pro','٣٫٢٠٠ ج']] as [string,string][]).map(([name,price]) => (
        <div key={name} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,.05)', fontSize:10, fontFamily:'Tajawal,sans-serif' }}>
          <span style={{ color:'rgba(255,255,255,.5)' }}>{name}</span>
          <span style={{ color:'#f59e0b', fontWeight:700 }}>{price}</span>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, fontSize:11, fontWeight:900, fontFamily:'Tajawal,sans-serif' }}>
        <span style={{ color:'rgba(255,255,255,.4)' }}>الإجمالي</span>
        <span style={{ color:'#fbbf24' }}>٣٧٫٦٠٠ ج</span>
      </div>
    </div>
  );
}

function MiniInventory() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(16,185,129,.2)' }}>
      {([['iPhone 15','٤٨',88],['Samsung S24','١٢',22],['Xiaomi 14','٨٩',95]] as [string,string,number][]).map(([name,qty,pct]) => (
        <div key={name} style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3, fontFamily:'Tajawal,sans-serif' }}>
            <span style={{ color:'rgba(255,255,255,.55)' }}>{name}</span>
            <span style={{ color:'#10b981', fontWeight:700 }}>{qty} وحدة</span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,.07)', borderRadius:2 }}>
            <div style={{ height:'100%', width:`${pct}%`, background: pct<30?'#ef4444':'#10b981', borderRadius:2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniHR() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(59,130,246,.2)' }}>
      {([['أحمد محمد','مدير مبيعات',[1,1,1,1,0]],['سارة خالد','محاسبة',[1,1,1,1,1]],['محمود علي','فني',[1,1,0,1,1]],['نور حسن','كاشير',[1,1,1,0,1]]] as [string,string,number[]][]).map(([name,role,days]) => (
        <div key={name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(59,130,246,.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, flexShrink:0, color:'#93c5fd', fontWeight:700 }}>{name[0]}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.7)', fontFamily:'Tajawal,sans-serif', lineHeight:1.2 }}>{name}</div>
            <div style={{ fontSize:8, color:'rgba(255,255,255,.3)', fontFamily:'Tajawal,sans-serif' }}>{role}</div>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            {days.map((d,i) => (
              <div key={i} style={{ width:6, height:6, borderRadius:'50%', background: d ? '#3b82f6' : 'rgba(255,255,255,.1)' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniRepair() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(239,68,68,.2)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,.35)', fontFamily:'Tajawal,sans-serif' }}>#١٠٤٢ — iPhone 15</span>
        <span style={{ padding:'2px 7px', borderRadius:99, background:'rgba(245,158,11,.15)', border:'1px solid rgba(245,158,11,.3)', color:'#f59e0b', fontSize:8, fontWeight:700, fontFamily:'Tajawal,sans-serif' }}>قيد الإصلاح</span>
      </div>
      {([['الفني','أحمد حسن'],['العطل','شاشة مكسورة'],['التكلفة','٨٥٠ ج']] as [string,string][]).map(([k,v]) => (
        <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', fontSize:9, fontFamily:'Tajawal,sans-serif' }}>
          <span style={{ color:'rgba(255,255,255,.3)' }}>{k}</span>
          <span style={{ color:'rgba(255,255,255,.65)', fontWeight:600 }}>{v}</span>
        </div>
      ))}
      <div style={{ marginTop:8, height:4, background:'rgba(255,255,255,.07)', borderRadius:2 }}>
        <div style={{ height:'100%', width:'65%', background:'linear-gradient(90deg,#ef4444,#f97316)', borderRadius:2 }} />
      </div>
    </div>
  );
}

function MiniReports() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(251,191,36,.2)' }}>
      <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', marginBottom:8, fontFamily:'Tajawal,sans-serif' }}>أداء المبيعات — هذا الشهر</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:52, marginBottom:6 }}>
        {[38,55,42,70,58,88,72].map((h, i) => (
          <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:'3px 3px 0 0',
            background: i===5 ? 'linear-gradient(to top,#f59e0b,#fbbf24)' : 'rgba(251,191,36,.22)' }} />
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        {(['س','أح','إث','ث','خ','ج','سب']).map(d => (
          <span key={d} style={{ fontSize:7, color:'rgba(255,255,255,.2)', flex:1, textAlign:'center', fontFamily:'Tajawal,sans-serif' }}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function MiniBank() {
  return (
    <div style={{ marginTop:14, background:'rgba(0,0,0,.35)', borderRadius:12, padding:'11px 13px', border:'1px solid rgba(6,182,212,.2)' }}>
      {([['دفع مورد','-٨٫٥٠٠','#ef4444'],['تحصيل عميل','+٢٢٫٠٠٠','#10b981'],['مصاريف إدارية','-١٫٢٠٠','#ef4444']] as [string,string,string][]).map(([desc,amount,color]) => (
        <div key={desc} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,.05)', fontFamily:'Tajawal,sans-serif' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background: color, flexShrink:0 }} />
            <span style={{ fontSize:9, color:'rgba(255,255,255,.5)' }}>{desc}</span>
          </div>
          <span style={{ fontSize:10, fontWeight:700, color }}>{amount} ج</span>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, fontWeight:900, fontFamily:'Tajawal,sans-serif' }}>
        <span style={{ color:'rgba(255,255,255,.3)' }}>صافي</span>
        <span style={{ color:'#06b6d4' }}>+١٢٫٣٠٠ ج</span>
      </div>
    </div>
  );
}

function MiniMobile() {
  const phone = (content: React.ReactNode, accent: string) => (
    <div style={{ width:88, background:'rgba(0,0,0,.6)', borderRadius:16, border:`1px solid ${accent}33`, overflow:'hidden', flexShrink:0 }}>
      <div style={{ height:8, background:accent+'22', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:22, height:2, background:accent+'55', borderRadius:1 }} />
      </div>
      <div style={{ padding:'6px 7px' }}>{content}</div>
    </div>
  );
  return (
    <div style={{ marginTop:14, display:'flex', gap:12, justifyContent:'center' }}>
      {phone(<>
        <div style={{ fontSize:8, color:'rgba(255,255,255,.35)', marginBottom:5, fontFamily:'Tajawal,sans-serif' }}>📍 الحضور GPS</div>
        <div style={{ width:'100%', height:38, background:'rgba(168,85,247,.12)', borderRadius:6, position:'relative', overflow:'hidden', border:'1px solid rgba(168,85,247,.2)' }}>
          <div style={{ position:'absolute', bottom:4, right:4, width:4, height:4, borderRadius:'50%', background:'#a855f7', boxShadow:'0 0 6px #a855f7' }} />
          {[{top:'40%',left:'55%',s:6},{top:'60%',left:'25%',s:4},{top:'20%',left:'35%',s:5}].map((p,i)=>(
            <div key={i} style={{ position:'absolute', top:p.top, left:p.left, width:p.s, height:p.s, borderRadius:'50%', background:'rgba(168,85,247,.5)' }} />
          ))}
        </div>
        <div style={{ marginTop:4, fontSize:8, color:'#a855f7', fontWeight:700, fontFamily:'Tajawal,sans-serif', textAlign:'center' }}>حضر ✓</div>
      </>, '#a855f7')}
      {phone(<>
        <div style={{ fontSize:8, color:'rgba(255,255,255,.35)', marginBottom:5, fontFamily:'Tajawal,sans-serif' }}>🧾 فاتورة سريعة</div>
        {['منتج ١','منتج ٢'].map(p => (
          <div key={p} style={{ display:'flex', justifyContent:'space-between', fontSize:7, padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,.06)', fontFamily:'Tajawal,sans-serif' }}>
            <span style={{ color:'rgba(255,255,255,.4)' }}>{p}</span>
            <span style={{ color:'#a855f7', fontWeight:700 }}>٢٥٠ ج</span>
          </div>
        ))}
        <div style={{ marginTop:4, padding:'3px 5px', borderRadius:4, background:'rgba(168,85,247,.2)', textAlign:'center', fontSize:7, color:'#c084fc', fontWeight:700, fontFamily:'Tajawal,sans-serif' }}>إصدار ←</div>
      </>, '#a855f7')}
      {phone(<>
        <div style={{ fontSize:8, color:'rgba(255,255,255,.35)', marginBottom:5, fontFamily:'Tajawal,sans-serif' }}>📊 أداء اليوم</div>
        {[['مبيعات','١٢'],['مرتجع','٢'],['تحصيل','٨٫٥ك']].map(([l,v]) => (
          <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:7, padding:'2px 0', fontFamily:'Tajawal,sans-serif' }}>
            <span style={{ color:'rgba(255,255,255,.35)' }}>{l}</span>
            <span style={{ color:'#c084fc', fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </>, '#a855f7')}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Data
══════════════════════════════════════════════ */
interface BentoItem {
  icon: string; title: string; desc: string;
  grad: string; accent: string; cls: string;
  tags?: string[];
  mockup: React.ReactNode;
}

const BENTO: BentoItem[] = [
  { icon:'📊', title:'المحاسبة الكاملة',
    desc:'قيد مزدوج تلقائي، ميزانية عمومية، تقارير مالية، مراكز التكلفة.',
    grad:'linear-gradient(135deg,rgba(99,102,241,.16),rgba(168,85,247,.08))', accent:'#6366f1', cls:'lp-wide',
    mockup: <MiniAccounting /> },
  { icon:'🛒', title:'المبيعات ونقطة البيع',
    desc:'فواتير فورية، POS متكامل، خصومات وتقارير يومية.',
    grad:'linear-gradient(135deg,rgba(245,158,11,.15),rgba(249,115,22,.08))', accent:'#f59e0b', cls:'',
    mockup: <MiniSales /> },
  { icon:'📦', title:'إدارة المخزون',
    desc:'تتبع الكميات لحظةً بلحظة، تنبيهات النفاد، جرد دوري.',
    grad:'linear-gradient(135deg,rgba(16,185,129,.15),rgba(5,150,105,.08))', accent:'#10b981', cls:'',
    mockup: <MiniInventory /> },
  { icon:'👥', title:'الموارد البشرية',
    desc:'الرواتب والمكافآت، الحضور والغياب، ملفات الموظفين.',
    grad:'linear-gradient(135deg,rgba(59,130,246,.16),rgba(99,102,241,.08))', accent:'#3b82f6', cls:'lp-wide',
    mockup: <MiniHR /> },
  { icon:'🔧', title:'وحدة الصيانة',
    desc:'بطاقات IMEI، تعيين الفنيين، تتبع الحالات، إشعارات تلقائية.',
    grad:'linear-gradient(135deg,rgba(239,68,68,.15),rgba(220,38,38,.08))', accent:'#ef4444', cls:'',
    mockup: <MiniRepair /> },
  { icon:'📈', title:'التقارير والتحليلات',
    desc:'لوحة تحكم تفاعلية، تقارير PDF، مؤشرات أداء رئيسية.',
    grad:'linear-gradient(135deg,rgba(245,158,11,.14),rgba(251,191,36,.08))', accent:'#fbbf24', cls:'',
    mockup: <MiniReports /> },
  { icon:'🏦', title:'المطابقة البنكية',
    desc:'ربط الحسابات البنكية، مطابقة تلقائية، كشف حساب فوري.',
    grad:'linear-gradient(135deg,rgba(6,182,212,.14),rgba(59,130,246,.08))', accent:'#06b6d4', cls:'',
    mockup: <MiniBank /> },
  { icon:'📱', title:'تطبيق موبايل لفريقك كله',
    desc:'iOS وAndroid — حضور GPS، بطاقات صيانة، فواتير، ومتابعة الأداء.',
    grad:'linear-gradient(135deg,rgba(168,85,247,.14),rgba(99,102,241,.08))', accent:'#a855f7', cls:'lp-full',
    tags:['iOS','Android','حضور GPS','بطاقات صيانة','فواتير'],
    mockup: <MiniMobile /> },
];

const STATS = [
  { end:500,  suffix:'+',  label:'شركة تثق بنا' },
  { end:99.9, suffix:'%',  label:'وقت التشغيل' },
  { end:7,    suffix:'',   label:'أيام تجريبية مجانية' },
  { end:24,   suffix:'/7', label:'دعم عربي متواصل' },
];

const TICKER = [
  'المحاسبة الكاملة','✦','المبيعات','✦','إدارة المخزون','✦',
  'الموارد البشرية','✦','وحدة الصيانة','✦','التقارير','✦',
  'تطبيق الموبايل','✦','المطابقة البنكية','✦','نقطة البيع POS','✦',
];

const PARTICLES = [
  {top:'17%',left:'9%', s:4,d:'0s',   dur:'6.5s'},
  {top:'32%',left:'87%',s:6,d:'1.2s', dur:'8s'  },
  {top:'58%',left:'6%', s:3,d:'2.1s', dur:'7s'  },
  {top:'72%',left:'78%',s:5,d:'.6s',  dur:'9s'  },
  {top:'21%',left:'64%',s:3,d:'3s',   dur:'6s'  },
  {top:'44%',left:'93%',s:4,d:'1.7s', dur:'7.5s'},
  {top:'80%',left:'42%',s:6,d:'2.5s', dur:'8.5s'},
  {top:'11%',left:'37%',s:3,d:'4s',   dur:'6.2s'},
];

const NAV_LINKS = [['features','الميزات'],['pricing','الأسعار']];
const LOGO_SRC = `${import.meta.env.BASE_URL}muhkam-logo-main.png`;

/* ══════════════════════════════════════════════
   Shared style helpers
══════════════════════════════════════════════ */
const glass: React.CSSProperties = {
  background:'rgba(255,255,255,0.035)',
  backdropFilter:'blur(20px)',
  border:'1px solid rgba(255,255,255,0.07)',
};
const amberBtn: React.CSSProperties = {
  padding:'14px 36px', borderRadius:14, border:'none', cursor:'pointer',
  background:'linear-gradient(135deg,#f59e0b,#f97316)',
  color:'#000', fontWeight:900, fontFamily:'Tajawal,sans-serif',
  animation:'lp-pulse-glow 2.5s ease-in-out infinite',
  transition:'transform .2s',
};
const ghostBtn: React.CSSProperties = {
  padding:'14px 36px', borderRadius:14, cursor:'pointer',
  background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.14)',
  color:'#fff', fontWeight:700, fontFamily:'Tajawal,sans-serif',
  backdropFilter:'blur(10px)', transition:'all .2s',
};
const mono: React.CSSProperties = { fontFamily:'Tajawal,sans-serif' };

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
export default function LandingPage() {
  const [, navigate]  = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mx, setMx]   = useState(50);
  const [my, setMy]   = useState(38);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const countDone = useRef(false);
  const statsEl   = useRef<HTMLDivElement>(null);
  const chartEl   = useRef<HTMLDivElement>(null);
  const obsRef    = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const s = document.createElement('style');
    s.id = 'muhkam-lp-css';
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 52);
    const onMove   = (e: MouseEvent) => {
      setMx((e.clientX / window.innerWidth)  * 100);
      setMy((e.clientY / window.innerHeight) * 100);
    };
    window.addEventListener('scroll',    onScroll, { passive:true });
    window.addEventListener('mousemove', onMove,   { passive:true });
    return () => {
      window.removeEventListener('scroll',    onScroll);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  const startCount = useCallback(() => {
    if (countDone.current) return;
    countDone.current = true;
    const targets = [500, 99.9, 7, 24];
    const dur = 2200;
    const t0  = performance.now();
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
      }), { threshold:0.1 }
    );
    document.querySelectorAll('.lp-fade').forEach(el => obsRef.current?.observe(el));

    const so = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { startCount(); en.target.classList.add('lp-stats-live'); so.unobserve(en.target); }
    }), { threshold:0.4 });
    if (statsEl.current) so.observe(statsEl.current);

    const co = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('lp-chart-live'); co.unobserve(en.target); }
    }), { threshold:0.3 });
    if (chartEl.current) co.observe(chartEl.current);

    return () => { obsRef.current?.disconnect(); so.disconnect(); co.disconnect(); };
  }, [startCount]);

  const goLogin    = () => navigate('/login');
  const goRegister = () => navigate('/login?tab=register');

  const scrollToId = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth' });
    setMenuOpen(false);
  };

  const fmtCount = (i: number) => (i === 1 ? counts[i].toFixed(1) : String(Math.floor(counts[i])));

  return (
    <>
      {/* ─────────────────── NAVBAR ─────────────────── */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        transition:'all .4s cubic-bezier(.16,1,.3,1)',
        background: scrolled ? 'rgba(0,0,0,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(245,158,11,.12)' : '1px solid transparent',
      }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 28px', height:68, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src={LOGO_SRC} alt="مُحكم" style={{ width:40, height:40, borderRadius:10, objectFit:'cover', flexShrink:0, boxShadow:'0 0 18px rgba(245,158,11,.5)' }} />
            <div>
              <div style={{ fontWeight:900, fontSize:19, lineHeight:1, color:'#fff', ...mono }}>مُحكم</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.38)', lineHeight:1, marginTop:2 }}>نظام ERP عربي</div>
            </div>
          </div>

          <div className="lp-nav-links" style={{ display:'flex', alignItems:'center', gap:32 }}>
            {NAV_LINKS.map(([id,lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{
                color:'rgba(255,255,255,.5)', fontSize:14, fontWeight:600,
                textDecoration:'none', transition:'color .2s', cursor:'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.color='#fff'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.5)'}
              >{lbl}</a>
            ))}
          </div>

          <div className="lp-nav-btns" style={{ display:'flex', gap:10 }}>
            <button onClick={goLogin} style={{
              padding:'9px 22px', borderRadius:11, border:'1px solid rgba(255,255,255,.14)',
              background:'transparent', color:'#fff', fontSize:13, fontWeight:700,
              cursor:'pointer', ...mono, transition:'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,.5)'; e.currentTarget.style.color='#f59e0b'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.14)'; e.currentTarget.style.color='#fff'; }}
            >تسجيل الدخول</button>
            <button onClick={goRegister} className="lp-shim" style={{
              padding:'9px 22px', borderRadius:11, border:'none',
              background:'linear-gradient(135deg,#f59e0b,#f97316)',
              color:'#000', fontSize:13, fontWeight:900, cursor:'pointer', ...mono,
              boxShadow:'0 0 22px rgba(245,158,11,.4)', transition:'transform .2s,box-shadow .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.boxShadow='0 0 40px rgba(245,158,11,.65)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 0 22px rgba(245,158,11,.4)'; }}
            >ابدأ مجاناً ←</button>
          </div>

          <button className="lp-hamburger" onClick={() => setMenuOpen(v => !v)} style={{
            background:'none', border:'none', cursor:'pointer', color:'#fff', padding:8,
            display:'none', flexDirection:'column', gap:5,
          }}>
            {[
              { transform: menuOpen ? 'rotate(45deg) translate(5px,5px)'  : 'none', opacity:'1' },
              { transform: 'none', opacity: menuOpen ? '0' : '1' },
              { transform: menuOpen ? 'rotate(-45deg) translate(5px,-5px)': 'none', opacity:'1' },
            ].map((s, i) => (
              <div key={i} style={{ width:22, height:2, background:'#fff', borderRadius:2, transition:'all .3s', ...s }} />
            ))}
          </button>
        </div>

        {menuOpen && (
          <div style={{
            background:'rgba(0,0,0,0.96)', backdropFilter:'blur(24px)',
            borderTop:'1px solid rgba(255,255,255,.07)', padding:'18px 28px',
            display:'flex', flexDirection:'column', gap:14,
          }}>
            {NAV_LINKS.map(([id,lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{
                color:'rgba(255,255,255,.7)', padding:'10px 0',
                borderBottom:'1px solid rgba(255,255,255,.06)',
                textDecoration:'none', fontSize:15, fontWeight:600,
              }}>{lbl}</a>
            ))}
            <button onClick={goRegister} style={{
              marginTop:4, padding:14, borderRadius:13,
              background:'linear-gradient(135deg,#f59e0b,#f97316)',
              color:'#000', fontWeight:900, fontSize:15, cursor:'pointer', border:'none', ...mono,
            }}>ابدأ تجربتك المجانية ←</button>
          </div>
        )}
      </nav>

      {/* ─────────────────── HERO ─────────────────── */}
      <section dir="rtl" style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'108px 28px 72px', textAlign:'center',
        position:'relative', overflow:'hidden', background:'#000', ...mono,
      }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', transition:'background .25s ease',
          background:`radial-gradient(ellipse 68% 54% at ${mx}% ${my}%, rgba(245,158,11,.14) 0%, rgba(249,115,22,.06) 42%, transparent 68%)` }} />
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', transition:'background .4s ease',
          background:`radial-gradient(ellipse 50% 40% at ${100-mx}% ${100-my}%, rgba(99,102,241,.09) 0%, transparent 58%)` }} />
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(rgba(245,158,11,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.028) 1px,transparent 1px)',
          backgroundSize:'64px 64px', animation:'lp-breathe 6s ease-in-out infinite',
        }} />
        {PARTICLES.map((p, i) => (
          <div key={i} style={{
            position:'absolute', top:p.top, left:p.left, width:p.s, height:p.s,
            borderRadius:'50%', pointerEvents:'none',
            background: i%3===0 ? '#f59e0b' : i%3===1 ? '#f97316' : '#fbbf24',
            animation:`lp-float ${p.dur} ${p.d} ease-in-out infinite`,
          }} />
        ))}

        <div style={{ position:'relative', zIndex:10, maxWidth:780, width:'100%' }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8, padding:'6px 20px', borderRadius:999,
            border:'1px solid rgba(245,158,11,.4)', background:'rgba(245,158,11,.08)',
            color:'#f59e0b', fontSize:13, fontWeight:700, marginBottom:32,
            position:'relative', overflow:'hidden', animation:'lp-slide-up .8s ease both',
          }}>
            <span style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(245,158,11,.22),transparent)', backgroundSize:'200% 100%', animation:'lp-shimmer 2.8s ease infinite' }} />
            <span style={{ position:'relative', zIndex:1 }}>✦ نظام ERP عربي #1</span>
          </div>

          <h1 style={{ fontSize:'clamp(3rem,8.5vw,6.2rem)', fontWeight:900, lineHeight:1.08, marginBottom:24, letterSpacing:'-.02em', animation:'lp-slide-up .9s .08s ease both' }}>
            <span style={{ display:'block', color:'#fff' }}>أدِر شركتك</span>
            <span style={{
              display:'block',
              background:'linear-gradient(135deg,#f59e0b 0%,#f97316 38%,#ef4444 75%,#f59e0b 100%)',
              backgroundSize:'200% 200%', WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent', backgroundClip:'text',
              animation:'lp-gradient-pan 4s ease infinite',
            }}>بذكاء حقيقي</span>
          </h1>

          <p style={{ color:'rgba(255,255,255,.52)', fontSize:'clamp(1rem,2vw,1.2rem)', lineHeight:1.75, maxWidth:560, margin:'0 auto 38px', animation:'lp-slide-up .95s .16s ease both' }}>
            مُحكم ERP — النظام الأول عربياً للمبيعات والمحاسبة والموارد البشرية والصيانة.
          </p>

          <div style={{ display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center', marginBottom:28, animation:'lp-slide-up 1s .24s ease both' }}>
            <button onClick={goRegister} className="lp-shim" style={{ ...amberBtn, fontSize:16 }}
              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.06) translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='scale(1) translateY(0)'; }}
            >ابدأ مجاناً ←</button>
            <button style={{ ...ghostBtn, fontSize:16 }}
              onClick={scrollToId('features') as unknown as React.MouseEventHandler<HTMLButtonElement>}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.1)'; e.currentTarget.style.borderColor='rgba(255,255,255,.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,.14)'; }}
            >شاهد كيف يعمل ↓</button>
          </div>

          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'8px 22px', color:'rgba(255,255,255,.32)', fontSize:13, animation:'lp-slide-up 1s .32s ease both' }}>
            {['✓ 7 أيام مجاناً','✓ بدون بطاقة ائتمان','✓ دعم عربي 24/7'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>

        {/* Hero mockup */}
        <div className="lp-hero-mockup" ref={chartEl} style={{ position:'relative', zIndex:10, marginTop:70, width:'100%', maxWidth:820, animation:'lp-slide-up 1.1s .45s ease both' }}>
          <div style={{ position:'absolute', bottom:-50, left:'8%', right:'8%', height:120, background:'radial-gradient(ellipse,rgba(245,158,11,.3) 0%,transparent 70%)', filter:'blur(24px)', pointerEvents:'none' }} />
          <div style={{ background:'rgba(10,10,10,0.94)', borderRadius:22, border:'1px solid rgba(255,255,255,.07)', boxShadow:'0 0 0 1px rgba(255,255,255,.03),0 48px 140px rgba(0,0,0,.85)', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 18px', background:'rgba(255,255,255,.025)', borderBottom:'1px solid rgba(255,255,255,.055)' }}>
              <div style={{ display:'flex', gap:6 }}>
                {['#ff5f57','#febc2e','#28c840'].map((c,i) => <div key={i} style={{ width:11, height:11, borderRadius:'50%', background:c }} />)}
              </div>
              <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
                <div style={{ background:'rgba(255,255,255,.05)', borderRadius:7, padding:'3px 18px', fontSize:11, color:'rgba(255,255,255,.28)', fontFamily:'monospace' }}>dashboard.muhkam.app</div>
              </div>
            </div>
            <div style={{ display:'flex', height:290 }}>
              <div style={{ width:170, borderLeft:'1px solid rgba(255,255,255,.055)', padding:'16px 12px', display:'flex', flexDirection:'column', gap:5, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <img src={LOGO_SRC} alt="مُحكم" style={{ width:26, height:26, borderRadius:7, objectFit:'cover', flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:800, color:'#fff', ...mono }}>مُحكم ERP</span>
                </div>
                {([['🏠','لوحة التحكم',true],['💰','المبيعات',false],['📦','المخزون',false],['🔧','الصيانة',false],['👥','الموظفون',false]] as [string,string,boolean][]).map(([icon,lbl,active], i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:9,
                    background: active ? 'rgba(245,158,11,.15)' : 'transparent',
                    border: active ? '1px solid rgba(245,158,11,.22)' : '1px solid transparent',
                  }}>
                    <span style={{ fontSize:12 }}>{icon}</span>
                    <span style={{ fontSize:11, color: active ? '#f59e0b' : 'rgba(255,255,255,.32)', fontWeight: active ? 700 : 400, ...mono }}>{lbl}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex:1, padding:'18px 22px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
                  {([['المبيعات','٨٥,٣٠٠ ج','↑ ٢٣٪','#10b981'],['العملاء','١,٢٤٨','↑ ١٢٪','#3b82f6'],['الأرباح','٢٩,٤٠٠ ج','↑ ١٨٪','#f59e0b']] as [string,string,string,string][]).map(([lbl,val,chg,clr]) => (
                    <div key={lbl} style={{ background:'rgba(255,255,255,.04)', borderRadius:11, border:'1px solid rgba(255,255,255,.055)', padding:'10px 13px' }}>
                      <div style={{ fontSize:9, color:'rgba(255,255,255,.32)', marginBottom:4, ...mono }}>{lbl}</div>
                      <div style={{ fontSize:15, fontWeight:900, color:'#fff', ...mono, marginBottom:2 }}>{val}</div>
                      <div style={{ fontSize:10, color:clr, fontWeight:700 }}>{chg}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, border:'1px solid rgba(255,255,255,.055)', padding:'13px 18px' }}>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.28)', marginBottom:14, ...mono }}>المبيعات — آخر 6 أشهر</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:9, height:90 }}>
                    {[42,65,52,78,60,95].map((h, i) => (
                      <div key={i} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                        <div className="lp-bar" style={{
                          width:'100%', height:`${h}%`, borderRadius:'5px 5px 0 0', animationDelay:`${i*.09}s`,
                          background: i===5 ? 'linear-gradient(to top,#f59e0b,#fbbf24)' : `rgba(245,158,11,${0.18+i*.04})`,
                        }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ position:'absolute', bottom:26, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, animation:'lp-float 2.5s ease-in-out infinite' }}>
          <div style={{ width:1, height:44, background:'linear-gradient(to bottom,transparent,rgba(245,158,11,.55))', borderRadius:1 }} />
          <div style={{ fontSize:9, color:'rgba(255,255,255,.22)', letterSpacing:3 }}>SCROLL</div>
        </div>
      </section>

      {/* ─────────────────── TICKER ─────────────────── */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,.055)', borderBottom:'1px solid rgba(255,255,255,.055)', background:'rgba(255,255,255,.018)', padding:'13px 0', overflow:'hidden' }}>
        <div style={{ display:'flex', gap:30, whiteSpace:'nowrap', animation:'lp-marquee 22s linear infinite', width:'max-content' }}>
          {[...TICKER,...TICKER,...TICKER].map((item, i) => (
            <span key={i} style={{ fontSize:13, fontWeight:700, color: item==='✦' ? '#f59e0b' : 'rgba(255,255,255,.32)', ...mono }}>{item}</span>
          ))}
        </div>
      </div>

      {/* ─────────────────── STATS ─────────────────── */}
      <section dir="rtl" ref={statsEl} style={{ background:'rgba(255,255,255,.018)', borderBottom:'1px solid rgba(255,255,255,.055)', padding:'72px 28px', ...mono }}>
        <div className="lp-grid-4" style={{ maxWidth:940, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:28, textAlign:'center' }}>
          {STATS.map((s, i) => (
            <div key={i} className={`lp-fade lp-d${i+1}`}>
              <div style={{ fontSize:'clamp(2rem,5vw,3.8rem)', fontWeight:900, lineHeight:1, marginBottom:8 }}>
                <span className="lp-stat-num" style={{ color:'#f59e0b', animationDelay:`${i*.1}s` }}>{fmtCount(i)}</span>
                <span style={{ color:'#f97316', fontSize:'0.68em' }}>{s.suffix}</span>
              </div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,.42)', fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────── BENTO FEATURES ─────────────────── */}
      <section id="features" dir="rtl" style={{ padding:'110px 28px', background:'#000', ...mono }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>

          <div className="lp-fade" style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8, padding:'4px 18px', borderRadius:999,
              border:'1px solid rgba(255,255,255,.09)', background:'rgba(255,255,255,.04)',
              color:'rgba(255,255,255,.48)', fontSize:12, fontWeight:700, marginBottom:20,
            }}>كل ما تحتاجه</div>
            <h2 style={{ fontSize:'clamp(2rem,5.5vw,3.6rem)', fontWeight:900, color:'#fff', marginBottom:16, lineHeight:1.1 }}>
              نظام متكامل. منصة واحدة.
            </h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:17, maxWidth:480, margin:'0 auto' }}>
              من الفواتير إلى الرواتب — كل وحدة مترابطة بذكاء
            </p>
          </div>

          <div className="lp-bento" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:18 }}>
            {BENTO.map((f, i) => (
              <div
                key={i}
                className={`lp-card lp-fade lp-d${(i % 6) + 1} ${f.cls}`}
                style={{
                  ...glass,
                  background: f.grad,
                  borderRadius:22, padding:'24px 22px 22px', position:'relative', overflow:'hidden',
                  gridColumn: f.cls==='lp-full' ? '1/-1' : f.cls==='lp-wide' ? 'span 2' : 'span 1',
                  display:'flex', flexDirection:'column',
                }}
              >
                <div style={{ position:'absolute', bottom:0, right:0, width:140, height:140, background:`radial-gradient(circle at bottom right,${f.accent}18,transparent 70%)`, pointerEvents:'none' }} />

                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:28, marginBottom:10, lineHeight:1 }}>{f.icon}</div>
                    <h3 style={{ fontSize: f.cls==='lp-full' ? 20 : 16, fontWeight:800, color:'#fff', marginBottom:7, lineHeight:1.3 }}>{f.title}</h3>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,.45)', lineHeight:1.7 }}>{f.desc}</p>
                  </div>
                  <div style={{
                    padding:'4px 10px', borderRadius:99,
                    background:`${f.accent}1a`, border:`1px solid ${f.accent}33`,
                    color:f.accent, fontSize:10, fontWeight:700, flexShrink:0, whiteSpace:'nowrap',
                  }}>معاينة</div>
                </div>

                {/* Mini mockup preview */}
                {f.mockup}

                {f.tags && (
                  <div style={{ marginTop:16, display:'flex', gap:7, flexWrap:'wrap' }}>
                    {f.tags.map(tag => (
                      <span key={tag} style={{
                        padding:'3px 11px', borderRadius:999,
                        background:`${f.accent}1a`, border:`1px solid ${f.accent}44`,
                        color:f.accent, fontSize:11, fontWeight:700,
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── FEATURE SPOTLIGHT ─────────────────── */}
      <section dir="rtl" style={{ padding:'80px 28px', background:'rgba(255,255,255,.012)', ...mono }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', flexDirection:'column', gap:110 }}>

          <div className="lp-spotlight lp-fade" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>
            <div>
              <div style={{ display:'inline-block', padding:'3px 13px', borderRadius:999, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.22)', color:'#ef4444', fontSize:12, fontWeight:700, marginBottom:18 }}>🔧 وحدة الصيانة</div>
              <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.9rem)', fontWeight:900, color:'#fff', marginBottom:16, lineHeight:1.18 }}>تتبع كل جهاز.<br/>كل فني. كل لحظة.</h2>
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:15, lineHeight:1.85, marginBottom:26 }}>بطاقات صيانة كاملة مع تتبع IMEI، تعيين الفنيين، حالات متعددة، وتقارير PDF احترافية.</p>
              <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:12 }}>
                {['تتبع IMEI والسيريال','إشعارات WhatsApp تلقائية','بطاقات QR للعملاء','لوحة فنيين متكاملة'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.72)' }}>
                    <span style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, background:'rgba(239,68,68,.14)', border:'1px solid rgba(239,68,68,.28)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#ef4444' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ ...glass, borderRadius:18, padding:24, boxShadow:'0 0 80px rgba(239,68,68,.07)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.3)' }}>بطاقة صيانة #1042</span>
                <span style={{ padding:'3px 11px', borderRadius:999, background:'rgba(245,158,11,.15)', border:'1px solid rgba(245,158,11,.3)', color:'#f59e0b', fontSize:11, fontWeight:700 }}>قيد الإصلاح</span>
              </div>
              {[['الجهاز','iPhone 15 Pro Max'],['العميل','محمد عبد الرحمن'],['الفني','أحمد حسن'],['العطل','شاشة مكسورة'],['التكلفة','٨٥٠ جنية']].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:13 }}>
                  <span style={{ color:'rgba(255,255,255,.35)' }}>{k}</span>
                  <span style={{ color:'#fff', fontWeight:600 }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1, height:6, borderRadius:3, background:'rgba(255,255,255,.06)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:'65%', background:'linear-gradient(90deg,#f59e0b,#f97316)', borderRadius:3 }} />
                </div>
                <span style={{ fontSize:11, color:'#f59e0b', fontWeight:700 }}>٦٥٪</span>
              </div>
            </div>
          </div>

          <div className="lp-spotlight lp-fade" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center', direction:'ltr' }}>
            <div style={{ ...glass, borderRadius:18, padding:24, direction:'rtl', boxShadow:'0 0 80px rgba(99,102,241,.07)' }}>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.32)', marginBottom:5 }}>إجمالي الإيرادات</div>
                <div style={{ fontSize:30, fontWeight:900, color:'#fff' }}>١٢٤,٨٠٠ <span style={{ fontSize:14, color:'rgba(255,255,255,.38)', fontWeight:400 }}>جنية</span></div>
                <div style={{ fontSize:12, color:'#10b981', fontWeight:700, marginTop:3 }}>↑ ٢٣٪ من الشهر السابق</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {([['المصروفات','٤٨,٢٠٠ ج','#ef4444'],['صافي الربح','٧٦,٦٠٠ ج','#10b981']] as [string,string,string][]).map(([l,v,c]) => (
                  <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:11, padding:'12px 14px', border:'1px solid rgba(255,255,255,.055)' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,.32)', marginBottom:5 }}>{l}</div>
                    <div style={{ fontSize:19, fontWeight:900, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
              {([['المبيعات',78,'#6366f1'],['المشتريات',45,'#f59e0b'],['المصاريف',32,'#ef4444']] as [string,number,string][]).map(([n,val,c]) => (
                <div key={n} style={{ marginBottom:11 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(255,255,255,.38)', marginBottom:4 }}>
                    <span>{n}</span><span>{val}٪</span>
                  </div>
                  <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${val}%`, background:c, borderRadius:3 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ direction:'rtl' }}>
              <div style={{ display:'inline-block', padding:'3px 13px', borderRadius:999, background:'rgba(99,102,241,.1)', border:'1px solid rgba(99,102,241,.22)', color:'#6366f1', fontSize:12, fontWeight:700, marginBottom:18 }}>📊 المحاسبة الكاملة</div>
              <h2 style={{ fontSize:'clamp(1.8rem,4vw,2.9rem)', fontWeight:900, color:'#fff', marginBottom:16, lineHeight:1.18 }}>محاسبة دقيقة.<br/>بدون تعقيد.</h2>
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:15, lineHeight:1.85, marginBottom:26 }}>قيد مزدوج تلقائي، ميزانية عمومية، قائمة الدخل، مراكز التكلفة. كل شيء بلمسة واحدة.</p>
              <ul style={{ listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:12 }}>
                {['قيد مزدوج تلقائي','ربط بنكي مباشر','تقارير ضريبية','مراكز التكلفة'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.72)' }}>
                    <span style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, background:'rgba(99,102,241,.14)', border:'1px solid rgba(99,102,241,.28)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#6366f1' }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── PRICING ─────────────────── */}
      <section id="pricing" dir="rtl" style={{ padding:'110px 28px', background:'#000', ...mono }}>
        <div style={{ maxWidth:880, margin:'0 auto' }}>
          <div className="lp-fade" style={{ textAlign:'center', marginBottom:64 }}>
            <h2 style={{ fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:900, color:'#fff', marginBottom:12 }}>خطة تناسب حجمك</h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:16 }}>ابدأ مجاناً لمدة 7 أيام — بدون بطاقة ائتمان</p>
          </div>

          <div className="lp-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:22 }}>
            <div className="lp-fade lp-d1" style={{ ...glass, borderRadius:24, padding:34, display:'flex', flexDirection:'column', transition:'border-color .3s,box-shadow .3s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.07)'; }}
            >
              <div style={{ fontSize:30, marginBottom:10 }}>⭐</div>
              <h3 style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4 }}>MuhKam Pro</h3>
              <p style={{ color:'rgba(255,255,255,.4)', fontSize:13, marginBottom:26 }}>للشركات الصغيرة والمتوسطة</p>
              <ul style={{ flex:1, listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:14, marginBottom:30 }}>
                {['المبيعات والمشتريات','إدارة المخزون','العملاء والموردون','التقارير الأساسية','نقطة البيع POS','دعم عربي'].map(item => (
                  <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color:'rgba(255,255,255,.7)' }}>
                    <span style={{ color:'#f59e0b', fontWeight:700, fontSize:16, lineHeight:1 }}>✓</span>{item}
                  </li>
                ))}
              </ul>
              <button onClick={goRegister} style={{ padding:14, borderRadius:13, border:'1px solid rgba(255,255,255,.16)', background:'transparent', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', ...mono, transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,.45)'; e.currentTarget.style.background='rgba(245,158,11,.08)'; e.currentTarget.style.color='#f59e0b'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,.16)'; e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#fff'; }}
              >ابدأ مجاناً</button>
              <p style={{ textAlign:'center', color:'rgba(255,255,255,.28)', fontSize:12, marginTop:13 }}>7 أيام تجريبية — بدون بطاقة</p>
            </div>

            <div className="lp-fade lp-d2" style={{ borderRadius:26, padding:3, position:'relative', background:'linear-gradient(135deg,#f59e0b,#f97316,#ef4444,#f59e0b)', backgroundSize:'200% 200%', animation:'lp-gradient-pan 4s ease infinite' }}>
              <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', padding:'4px 18px', borderRadius:999, background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#000', fontSize:11, fontWeight:900, whiteSpace:'nowrap', zIndex:1 }}>⚡ الأكثر طلباً</div>
              <div style={{ background:'rgba(8,8,8,.96)', borderRadius:23, padding:32, display:'flex', flexDirection:'column', height:'100%', boxSizing:'border-box', backdropFilter:'blur(20px)' }}>
                <div style={{ fontSize:30, marginBottom:10 }}>🚀</div>
                <h3 style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4 }}>MuhKam Advanced</h3>
                <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginBottom:26 }}>للشركات التي تحتاج كل شيء</p>
                <ul style={{ flex:1, listStyle:'none', padding:0, display:'flex', flexDirection:'column', gap:14, marginBottom:30 }}>
                  {['كل ما في Pro +','المحاسبة الكاملة + القيد المزدوج','الموارد البشرية والرواتب','وحدة الصيانة والأجهزة','تطبيق موبايل (iOS & Android)','المطابقة البنكية','الميزانيات ومراكز التكلفة'].map(item => (
                    <li key={item} style={{ display:'flex', alignItems:'center', gap:10, fontSize:14, color: item==='كل ما في Pro +' ? '#f59e0b' : 'rgba(255,255,255,.8)' }}>
                      <span style={{ color:'#f59e0b', fontWeight:700, fontSize:16, lineHeight:1 }}>✓</span>{item}
                    </li>
                  ))}
                </ul>
                <button onClick={goRegister} className="lp-shim" style={{ padding:14, borderRadius:13, border:'none', cursor:'pointer', ...mono, background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#000', fontSize:14, fontWeight:900, boxShadow:'0 0 32px rgba(245,158,11,.45)', transition:'transform .2s,box-shadow .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.boxShadow='0 0 55px rgba(245,158,11,.65)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 0 32px rgba(245,158,11,.45)'; }}
                >ابدأ مجاناً</button>
                <p style={{ textAlign:'center', color:'rgba(255,255,255,.28)', fontSize:12, marginTop:13 }}>7 أيام تجريبية — بدون بطاقة</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── FINAL CTA ─────────────────── */}
      <section dir="rtl" style={{ padding:'132px 28px', textAlign:'center', background:'rgba(255,255,255,.012)', position:'relative', overflow:'hidden', ...mono }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', background:'radial-gradient(ellipse 75% 55% at 50% 50%,rgba(245,158,11,.14) 0%,rgba(249,115,22,.05) 45%,transparent 68%)' }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:i*220, height:i*130, borderRadius:'50%', border:'1px solid rgba(245,158,11,.12)', pointerEvents:'none', animation:`lp-ping ${1.4+i*.9}s ${i*.55}s ease-out infinite` }} />
        ))}
        <div className="lp-fade" style={{ position:'relative', zIndex:10, maxWidth:640, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(2.2rem,6.5vw,4.2rem)', fontWeight:900, color:'#fff', marginBottom:18, lineHeight:1.12 }}>
            جاهز لتحويل{' '}
            <span style={{ background:'linear-gradient(135deg,#f59e0b,#f97316,#ef4444)', backgroundSize:'200%', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', animation:'lp-gradient-pan 3s ease infinite' }}>شركتك؟</span>
          </h2>
          <p style={{ color:'rgba(255,255,255,.5)', fontSize:18, marginBottom:44 }}>انضم لأكثر من 500 شركة تثق في مُحكم يومياً</p>
          <button onClick={goRegister} className="lp-shim" style={{ ...amberBtn, fontSize:18, padding:'18px 56px' }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.07) translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1) translateY(0)'; }}
          >ابدأ مجاناً الآن ←</button>
          <div style={{ marginTop:22, display:'flex', justifyContent:'center', gap:22, color:'rgba(255,255,255,.28)', fontSize:13 }}>
            <span>✓ 7 أيام مجاناً</span><span>✓ بدون بطاقة</span><span>✓ إلغاء في أي وقت</span>
          </div>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer dir="rtl" style={{ padding:'36px 28px', background:'#000', borderTop:'1px solid rgba(255,255,255,.055)', position:'relative', ...mono }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,rgba(245,158,11,.45),transparent)' }} />
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:11 }}>
            <img src={LOGO_SRC} alt="مُحكم" style={{ width:36, height:36, borderRadius:10, objectFit:'cover', boxShadow:'0 0 14px rgba(245,158,11,.35)' }} />
            <div>
              <div style={{ fontWeight:900, color:'#fff', fontSize:16 }}>مُحكم ERP</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>نظام إدارة عربي متكامل</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:26, flexWrap:'wrap' }}>
            {NAV_LINKS.map(([id,lbl]) => (
              <a key={id} href={`#${id}`} onClick={scrollToId(id)} style={{ color:'rgba(255,255,255,.35)', fontSize:13, textDecoration:'none', transition:'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color='#f59e0b'}
                onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}
              >{lbl}</a>
            ))}
            <button onClick={goLogin} style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)', fontSize:13, cursor:'pointer', padding:0, ...mono, transition:'color .2s' }}
              onMouseEnter={e => e.currentTarget.style.color='#f59e0b'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.35)'}
            >تسجيل الدخول</button>
          </div>
          <p style={{ color:'rgba(255,255,255,.2)', fontSize:12 }}>© 2026 مُحكم ERP — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </>
  );
}
