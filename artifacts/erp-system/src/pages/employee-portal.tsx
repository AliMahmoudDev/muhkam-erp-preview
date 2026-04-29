import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';
import { useToast } from '@/hooks/use-toast';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';
import LogoutCheckoutModal from '@/components/logout-checkout-modal';
import IdleCheckoutModal from '@/components/idle-checkout-modal';
import {
  LogOut, Clock, Calendar, Briefcase, Building2, CheckCircle2,
  XCircle, Loader2, Sun, Moon, Coffee, TrendingDown,
  Gift, FileText, Wallet, UserCheck, AlertCircle, ChevronDown,
  ChevronUp, DollarSign, Users, MapPin, RotateCcw,
} from 'lucide-react';

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */
type AnyRec = Record<string, unknown>;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtTime(val: unknown): string {
  if (!val) return '—';
  const s = String(val);
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(val: unknown, showWeekday = true): string {
  if (!val) return '—';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, day] = s.split('-').map(Number);
    return new Date(y, mo - 1, day).toLocaleDateString('ar-EG', {
      ...(showWeekday ? { weekday: 'short' } : {}),
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('ar-EG', {
    ...(showWeekday ? { weekday: 'short' } : {}),
    day: 'numeric', month: 'short',
  });
}

function fmtCurrency(val: unknown, currency = 'EGP'): string {
  const n = parseFloat(String(val ?? '0'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('ar-EG', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + currency;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function nDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function greetingText(): { text: string; Icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'صباح الخير', Icon: Sun };
  if (h < 17) return { text: 'مساء الخير', Icon: Coffee };
  return { text: 'مساء النور', Icon: Moon };
}

function calcDuration(checkIn: unknown, checkOut: unknown): string {
  if (!checkIn) return '—';
  const parse = (v: unknown) => {
    const s = String(v ?? '');
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const [h, m, sec = 0] = s.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, sec, 0); return d;
    }
    return new Date(s);
  };
  const inD = parse(checkIn);
  const outD = checkOut ? parse(checkOut) : new Date();
  const mins = Math.max(0, Math.round((outD.getTime() - inD.getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}س ${m}د`;
}

/* ══════════════════════════════════════════════════
   STATUS BADGES
══════════════════════════════════════════════════ */
function AttBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    present:  { label: 'حاضر',         color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
    absent:   { label: 'غائب',         color: '#f87171', bg: 'rgba(248,113,113,0.13)' },
    late:     { label: 'متأخر',        color: '#fbbf24', bg: 'rgba(251,191,36,0.13)' },
    on_leave: { label: 'إجازة',        color: '#60a5fa', bg: 'rgba(96,165,250,0.13)' },
    holiday:  { label: 'إجازة رسمية', color: '#a78bfa', bg: 'rgba(167,139,250,0.13)' },
    half_day: { label: 'نصف يوم',     color: '#fb923c', bg: 'rgba(251,146,60,0.13)'  },
  };
  const m = map[status] ?? { label: status || '—', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:6,
      fontSize:11, fontWeight:700, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function AdvanceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'قيد المراجعة', color: '#fbbf24', bg: 'rgba(251,191,36,0.13)' },
    approved: { label: 'موافق عليه',   color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
    rejected: { label: 'مرفوض',        color: '#f87171', bg: 'rgba(248,113,113,0.13)' },
    paid:     { label: 'مدفوع',        color: '#60a5fa', bg: 'rgba(96,165,250,0.13)' },
    active:   { label: 'نشط',          color: '#a78bfa', bg: 'rgba(167,139,250,0.13)' },
    settled:  { label: 'مسدد',         color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
    cancelled:{ label: 'ملغى',         color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  };
  const m = map[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:6,
      fontSize:11, fontWeight:700, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function LeaveBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'قيد الانتظار', color: '#fbbf24', bg: 'rgba(251,191,36,0.13)' },
    approved: { label: 'موافق عليه',   color: '#34d399', bg: 'rgba(52,211,153,0.13)' },
    rejected: { label: 'مرفوض',        color: '#f87171', bg: 'rgba(248,113,113,0.13)' },
    cancelled:{ label: 'ملغى',         color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  };
  const m = map[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return (
    <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:6,
      fontSize:11, fontWeight:700, background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════
   SECTION CARD
══════════════════════════════════════════════════ */
function SectionCard({
  icon, title, accent = '#f59e0b', children, isDark, border, cardBg, defaultOpen = true,
}: {
  icon: React.ReactNode; title: string; accent?: string; children: React.ReactNode;
  isDark: boolean; border: string; cardBg: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${border}`, background: cardBg,
      overflow: 'hidden', marginBottom: 20 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display:'flex', alignItems:'center', gap:12, padding:'16px 20px',
          background:'transparent', border:'none', cursor:'pointer', textAlign:'right' }}
      >
        <span style={{ width:36, height:36, borderRadius:10, background:`${accent}22`,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: accent }}>
          {icon}
        </span>
        <span style={{ fontSize:15, fontWeight:800, color: isDark ? '#f1f5f9' : '#0f172a', flex:1 }}>
          {title}
        </span>
        <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', flexShrink:0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${border}`, padding:'16px 20px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   STAT MINI CARD
══════════════════════════════════════════════════ */
function StatCard({ label, value, icon, color, bg }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: string; bg: string;
}) {
  return (
    <div style={{ borderRadius:12, padding:'14px 16px', background: bg,
      display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:120 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ color, opacity:0.8 }}>{icon}</span>
        <span style={{ fontSize:11, color, fontWeight:600, opacity:0.8 }}>{label}</span>
      </div>
      <span style={{ fontSize:26, fontWeight:900, color, fontVariantNumeric:'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const { settings } = useAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isDark = settings.theme === 'dark';

  const logoSrc = settings.customLogo || `${import.meta.env.BASE_URL}logo.png`;
  const empId = user?.employee_id;

  const { text: greeting, Icon: GreetIcon } = greetingText();
  const today = todayStr();
  const currentMonth = today.slice(0, 7);

  /* ── theme tokens ── */
  const textMain  = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const bg        = isDark ? '#080e1a' : '#f0f2f8';
  const cardBg    = isDark ? 'rgba(255,255,255,0.035)' : '#ffffff';
  const border    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  /* ── live clock ── */
  const [nowTime, setNowTime] = useState(() =>
    new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );
  useEffect(() => {
    const id = setInterval(() =>
      setNowTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    , 1000);
    return () => clearInterval(id);
  }, []);

  /* ── modals ── */
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showIdleModal,   setShowIdleModal]   = useState(false);
  useIdleTimeout({ timeoutMs: 60 * 60 * 1000, onIdle: () => { if (!showLogoutModal) setShowIdleModal(true); } });

  /* ── check-in/out actions ── */
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  /* ══ API QUERIES ══════════════════════════════════════════ */

  /* Employee profile */
  const { data: empRaw } = useQuery<AnyRec>({
    queryKey: ['portal-employee', empId],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/employees/${empId}`);
      return r.ok ? r.json() : {};
    },
    enabled: !!empId,
  });

  /* Today attendance */
  const { data: todayRecRaw, isLoading: todayLoading } = useQuery<AnyRec[]>({
    queryKey: ['portal-att-today', empId, today],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/attendance/records?employee_id=${empId}&from=${today}&to=${today}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId, refetchInterval: 60_000,
  });

  /* Monthly summary */
  const { data: summaryRaw } = useQuery<AnyRec>({
    queryKey: ['portal-summary', empId, currentMonth],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/attendance/summary/${empId}?month=${currentMonth}`);
      return r.ok ? r.json() : {};
    },
    enabled: !!empId,
  });

  /* Recent attendance 30 days */
  const dateFrom30 = nDaysAgo(29);
  const { data: recentRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-att-recent', empId, dateFrom30],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/attendance/records?employee_id=${empId}&from=${dateFrom30}&to=${today}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* Salary advances */
  const { data: advancesRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-advances', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/salary-advances?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* Deductions */
  const { data: deductionsRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-deductions', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/employee-deductions?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* Bonuses */
  const { data: bonusesRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-bonuses', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/employee-bonuses?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* Leave requests */
  const { data: leavesRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-leaves', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/leave-requests?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* Leave balance */
  const { data: leaveBalRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-leave-bal', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/employee-leave-balance/${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  /* ══ DERIVED DATA ════════════════════════════════════════ */
  const emp         = (empRaw ?? {}) as AnyRec;
  const summary     = (summaryRaw ?? {}) as AnyRec;
  const recentRecs  = Array.isArray(recentRaw)    ? recentRaw    : [];
  const advances    = Array.isArray(advancesRaw)  ? advancesRaw  : [];
  const deductions  = Array.isArray(deductionsRaw) ? deductionsRaw : [];
  const bonuses     = Array.isArray(bonusesRaw)   ? bonusesRaw   : [];
  const leaves      = Array.isArray(leavesRaw)    ? leavesRaw    : [];
  const leavesBal   = Array.isArray(leaveBalRaw)  ? leaveBalRaw  : [];

  const todayRec = Array.isArray(todayRecRaw) && todayRecRaw.length > 0 ? todayRecRaw[0] as AnyRec : null;
  const alreadyCheckedIn  = !!todayRec?.check_in_time;
  const alreadyCheckedOut = !!todayRec?.check_out_time;

  const empName     = [fmt(emp.first_name_ar), fmt(emp.last_name_ar)].filter(x => x !== '—').join(' ') || fmt(user?.username);
  const empCode     = fmt(emp.employee_code);
  const empSalary   = emp.salary ? fmtCurrency(emp.salary, fmt(emp.currency)) : '—';
  const empHire     = fmtDate(emp.hire_date, false);
  const empType     = emp.employment_type === 'full_time' ? 'دوام كامل' : emp.employment_type === 'part_time' ? 'دوام جزئي' : fmt(emp.employment_type);
  const empStatus   = emp.employment_status === 'active' ? 'نشط' : fmt(emp.employment_status);

  /* ── check-in / check-out ── */
  async function doCheckIn() {
    if (!empId) return;
    setCheckingIn(true);
    try {
      const res = await authFetch('/api/attendance/check-in', { method: 'POST', body: JSON.stringify({ employee_id: empId }) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'تم تسجيل الحضور ✓', description: `حضرت في ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` });
      qc.invalidateQueries({ queryKey: ['portal-att-today'] });
      qc.invalidateQueries({ queryKey: ['portal-att-recent'] });
      qc.invalidateQueries({ queryKey: ['portal-summary'] });
    } catch (e) {
      toast({ title: 'فشل تسجيل الحضور', description: e instanceof Error ? e.message : 'خطأ', variant: 'destructive' });
    } finally { setCheckingIn(false); }
  }

  async function doCheckOut() {
    if (!todayRec?.id) return;
    setCheckingOut(true);
    try {
      const res = await authFetch('/api/attendance/check-out', { method: 'POST', body: JSON.stringify({ record_id: todayRec.id }) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'تم تسجيل الانصراف ✓', description: `انصرفت في ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` });
      qc.invalidateQueries({ queryKey: ['portal-att-today'] });
      qc.invalidateQueries({ queryKey: ['portal-att-recent'] });
      qc.invalidateQueries({ queryKey: ['portal-summary'] });
    } catch (e) {
      toast({ title: 'فشل تسجيل الانصراف', description: e instanceof Error ? e.message : 'خطأ', variant: 'destructive' });
    } finally { setCheckingOut(false); }
  }

  /* ── deduction type label ── */
  function deductLabel(t: string) {
    return ({ late: 'تأخر', absence: 'غياب', damage: 'تلف', other: 'أخرى' }[t] ?? t);
  }

  /* ═════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: bg, fontFamily: `'${settings.fontFamily}', sans-serif`, color: textMain }}>

      {/* ══ NAVBAR ════════════════════════════════════════════ */}
      <div style={{
        height: 60, background: isDark ? 'rgba(8,14,26,0.96)' : '#ffffff',
        borderBottom: `1px solid ${border}`, backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
          <img src={logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 900, color: isDark ? '#f59e0b' : '#b45309', lineHeight: 1.2 }}>{settings.companyName}</p>
          <p style={{ fontSize: 10, color: textMuted, lineHeight: 1.2 }}>بوابة الموظف الذاتية</p>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textMuted, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          <Clock size={13} /><span className="hidden sm:inline">{nowTime}</span>
        </div>
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8,
            border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.10)',
            color:'#f87171', cursor:'pointer', fontSize:12, fontWeight:700 }}
        >
          <LogOut size={13} /><span className="hidden sm:inline">تسجيل الخروج</span>
        </button>
      </div>

      {/* ══ CONTENT ═══════════════════════════════════════════ */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* ── GREETING BANNER ── */}
        <div style={{
          borderRadius: 20, padding: '24px 28px', marginBottom: 24, position: 'relative', overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(8,14,26,0.98) 60%)'
            : 'linear-gradient(135deg, #fef3c7 0%, #fffdf0 60%)',
          border: `1px solid ${isDark ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.30)'}`,
        }}>
          <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200,
            background:'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)' }} />
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ width:56, height:56, borderRadius:16, flexShrink:0,
              background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.18)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <GreetIcon size={28} color="#f59e0b" />
            </div>
            <div>
              <p style={{ fontSize:22, fontWeight:900, color: isDark ? '#fcd34d' : '#92400e', lineHeight:1.2 }}>
                {greeting}، {empName}
              </p>
              <p style={{ fontSize:13, color: textMuted, marginTop:4 }}>
                {new Date().toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </p>
            </div>
            <div style={{ flex:1 }} />
            {empCode !== '—' && (
              <div style={{ textAlign:'center', padding:'8px 16px', borderRadius:10,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize:10, color:textMuted, fontWeight:600 }}>كود الموظف</p>
                <p style={{ fontSize:18, fontWeight:900, color: isDark ? '#fcd34d' : '#92400e', fontVariantNumeric:'tabular-nums' }}>{empCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TODAY ATTENDANCE + PROFILE ROW ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>

          {/* Today check-in/out card */}
          <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, padding:20, gridColumn:'span 1' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ width:36, height:36, borderRadius:10, background:'rgba(52,211,153,0.14)',
                display:'flex', alignItems:'center', justifyContent:'center', color:'#34d399' }}>
                <UserCheck size={18} />
              </span>
              <span style={{ fontSize:14, fontWeight:800, color: isDark ? '#f1f5f9' : '#0f172a' }}>حضور اليوم</span>
              <div style={{ flex:1 }} />
              {todayLoading && <Loader2 size={14} className="animate-spin" style={{ color:textMuted }} />}
            </div>

            {/* Status row */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:textMuted }}>الحضور</span>
                <span style={{ fontSize:14, fontWeight:700, color: alreadyCheckedIn ? '#34d399' : textMuted }}>
                  {alreadyCheckedIn ? fmtTime(todayRec?.check_in_time) : '—'}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:textMuted }}>الانصراف</span>
                <span style={{ fontSize:14, fontWeight:700, color: alreadyCheckedOut ? '#f87171' : textMuted }}>
                  {alreadyCheckedOut ? fmtTime(todayRec?.check_out_time) : '—'}
                </span>
              </div>
              {alreadyCheckedIn && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:textMuted }}>المدة</span>
                  <span style={{ fontSize:14, fontWeight:700, color:'#a78bfa', fontVariantNumeric:'tabular-nums' }}>
                    {calcDuration(todayRec?.check_in_time, todayRec?.check_out_time)}
                    {!alreadyCheckedOut && <span style={{ fontSize:10, color:textMuted, marginRight:4 }}>(جارٍ)</span>}
                  </span>
                </div>
              )}
              {todayRec?.status && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:textMuted }}>الحالة</span>
                  <AttBadge status={String(todayRec.status)} />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:10, marginTop:18 }}>
              {!alreadyCheckedIn && (
                <button
                  onClick={doCheckIn} disabled={checkingIn}
                  style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg, #059669, #34d399)', color:'#fff',
                    fontWeight:800, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    opacity: checkingIn ? 0.7 : 1 }}
                >
                  {checkingIn ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  تسجيل الحضور
                </button>
              )}
              {alreadyCheckedIn && !alreadyCheckedOut && (
                <button
                  onClick={doCheckOut} disabled={checkingOut}
                  style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', cursor:'pointer',
                    background:'linear-gradient(135deg, #dc2626, #f87171)', color:'#fff',
                    fontWeight:800, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    opacity: checkingOut ? 0.7 : 1 }}
                >
                  {checkingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  تسجيل الانصراف
                </button>
              )}
              {alreadyCheckedIn && alreadyCheckedOut && (
                <div style={{ flex:1, padding:'10px 0', borderRadius:10, textAlign:'center',
                  background: isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.1)',
                  color:'#34d399', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <CheckCircle2 size={14} /> تم تسجيل يوم العمل
                </div>
              )}
            </div>
          </div>

          {/* Employee info card */}
          <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ width:36, height:36, borderRadius:10, background:'rgba(96,165,250,0.14)',
                display:'flex', alignItems:'center', justifyContent:'center', color:'#60a5fa' }}>
                <Briefcase size={18} />
              </span>
              <span style={{ fontSize:14, fontWeight:800, color: isDark ? '#f1f5f9' : '#0f172a' }}>بيانات الوظيفة</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { label:'المسمى الوظيفي', value: fmt(emp.job_title_ar ?? emp.job_title_id), icon: <Briefcase size={12} /> },
                { label:'القسم', value: fmt(emp.department_ar ?? emp.department_id), icon: <Building2 size={12} /> },
                { label:'الفرع', value: fmt(emp.branch_ar ?? emp.branch_id), icon: <MapPin size={12} /> },
                { label:'تاريخ التعيين', value: empHire, icon: <Calendar size={12} /> },
                { label:'نوع التوظيف', value: empType, icon: <Users size={12} /> },
                { label:'الراتب الأساسي', value: empSalary, icon: <DollarSign size={12} /> },
              ].map(({ label, value, icon }) => (
                value !== '—' && (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:textMuted }}>
                      {icon}{label}
                    </span>
                    <span style={{ fontSize:12, fontWeight:700, color: isDark ? '#f1f5f9' : '#1e293b', textAlign:'left' }}>{value}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        {/* ── MONTHLY SUMMARY STATS ── */}
        <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <span style={{ width:36, height:36, borderRadius:10, background:'rgba(167,139,250,0.14)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#a78bfa' }}>
              <Calendar size={18} />
            </span>
            <span style={{ fontSize:14, fontWeight:800, color: isDark ? '#f1f5f9' : '#0f172a' }}>
              ملخص شهر {new Date(currentMonth + '-01').toLocaleDateString('ar-EG', { month:'long', year:'numeric' })}
            </span>
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <StatCard label="أيام الحضور"   value={Number(summary.present_days  ?? 0)} icon={<CheckCircle2 size={16} />} color="#34d399" bg="rgba(52,211,153,0.10)" />
            <StatCard label="أيام الغياب"   value={Number(summary.absent_days   ?? 0)} icon={<XCircle size={16} />}      color="#f87171" bg="rgba(248,113,113,0.10)" />
            <StatCard label="مرات التأخر"   value={Number(summary.late_days     ?? 0)} icon={<AlertCircle size={16} />}  color="#fbbf24" bg="rgba(251,191,36,0.10)" />
            <StatCard label="أيام الإجازة"  value={Number(summary.leave_days    ?? 0)} icon={<Calendar size={16} />}     color="#60a5fa" bg="rgba(96,165,250,0.10)" />
            <StatCard label="ساعات العمل"   value={`${Number(summary.total_hours ?? 0).toFixed(0)}س`} icon={<Clock size={16} />} color="#a78bfa" bg="rgba(167,139,250,0.10)" />
          </div>
        </div>

        {/* ── SALARY ADVANCES ── */}
        <SectionCard icon={<Wallet size={18} />} title={`السلف والمصروفات (${advances.length})`}
          accent="#f59e0b" isDark={isDark} border={border} cardBg={cardBg}>
          {advances.length === 0 ? (
            <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'16px 0' }}>لا توجد سلف مسجلة</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {advances.map((a, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                  borderRadius:10, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                  border:`1px solid ${border}` }}>
                  <Wallet size={14} style={{ color:'#f59e0b', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>
                        {fmtCurrency(a.approved_amount ?? a.requested_amount, fmt(a.currency))}
                      </span>
                      <AdvanceBadge status={String(a.status ?? '')} />
                    </div>
                    <div style={{ fontSize:11, color:textMuted, marginTop:2 }}>
                      {fmtDate(a.requested_date, false)}
                      {a.reason ? ` · ${fmt(a.reason)}` : ''}
                    </div>
                  </div>
                  {a.remaining_balance && Number(a.remaining_balance) > 0 && (
                    <div style={{ textAlign:'center' }}>
                      <p style={{ fontSize:10, color:textMuted }}>المتبقي</p>
                      <p style={{ fontSize:12, fontWeight:700, color:'#fbbf24' }}>{fmtCurrency(a.remaining_balance, fmt(a.currency))}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── DEDUCTIONS ── */}
        <SectionCard icon={<TrendingDown size={18} />} title={`الخصومات (${deductions.length})`}
          accent="#f87171" isDark={isDark} border={border} cardBg={cardBg}>
          {deductions.length === 0 ? (
            <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'16px 0' }}>لا توجد خصومات مسجلة</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {deductions.map((d, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                  borderRadius:10, background: isDark ? 'rgba(248,113,113,0.05)' : 'rgba(248,113,113,0.04)',
                  border:`1px solid rgba(248,113,113,0.15)` }}>
                  <TrendingDown size={14} style={{ color:'#f87171', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#f87171' }}>
                        -{fmtCurrency(d.amount, fmt(d.currency))}
                      </span>
                      <span style={{ fontSize:11, padding:'2px 7px', borderRadius:5,
                        background:'rgba(248,113,113,0.12)', color:'#f87171', fontWeight:600 }}>
                        {deductLabel(String(d.deduction_type ?? ''))}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:textMuted, marginTop:2 }}>
                      {fmtDate(d.deduction_date, false)}
                      {d.reason ? ` · ${fmt(d.reason)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── BONUSES ── */}
        <SectionCard icon={<Gift size={18} />} title={`الحوافز والمكافآت (${bonuses.length})`}
          accent="#34d399" isDark={isDark} border={border} cardBg={cardBg}>
          {bonuses.length === 0 ? (
            <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'16px 0' }}>لا توجد حوافز مسجلة</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {bonuses.map((b, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                  borderRadius:10, background: isDark ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.04)',
                  border:`1px solid rgba(52,211,153,0.15)` }}>
                  <Gift size={14} style={{ color:'#34d399', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#34d399' }}>
                      +{fmtCurrency(b.amount, fmt(b.currency))}
                    </span>
                    <div style={{ fontSize:11, color:textMuted, marginTop:2 }}>
                      {fmtDate(b.granted_date, false)}
                      {b.reason ? ` · ${fmt(b.reason)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── LEAVE REQUESTS ── */}
        <SectionCard icon={<FileText size={18} />} title={`طلبات الإجازة (${leaves.length})`}
          accent="#60a5fa" isDark={isDark} border={border} cardBg={cardBg}>
          {leavesBal.length > 0 && (
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${border}` }}>
              {leavesBal.map((lb, i) => (
                <div key={i} style={{ borderRadius:10, padding:'8px 14px',
                  background: isDark ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.07)',
                  border:`1px solid rgba(96,165,250,0.15)` }}>
                  <p style={{ fontSize:10, color:'#60a5fa', fontWeight:600, marginBottom:2 }}>
                    {fmt(lb.leave_type_name_ar ?? lb.leave_type_code)}
                  </p>
                  <p style={{ fontSize:16, fontWeight:900, color:'#60a5fa' }}>
                    {Number(lb.balance_days ?? 0).toFixed(0)} يوم
                  </p>
                  <p style={{ fontSize:10, color:textMuted }}>رصيد متاح</p>
                </div>
              ))}
            </div>
          )}
          {leaves.length === 0 ? (
            <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'16px 0' }}>لا توجد طلبات إجازة</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {leaves.map((l, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                  borderRadius:10, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                  border:`1px solid ${border}` }}>
                  <FileText size={14} style={{ color:'#60a5fa', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>
                        {fmtDate(l.start_date, false)} ← {fmtDate(l.end_date, false)}
                      </span>
                      <span style={{ fontSize:11, color:textMuted }}>({Number(l.total_days ?? 0)} يوم)</span>
                      <LeaveBadge status={String(l.status ?? '')} />
                    </div>
                    {l.reason && (
                      <div style={{ fontSize:11, color:textMuted, marginTop:2 }}>{fmt(l.reason)}</div>
                    )}
                    {l.rejection_reason && (
                      <div style={{ fontSize:11, color:'#f87171', marginTop:2 }}>
                        سبب الرفض: {fmt(l.rejection_reason)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── ATTENDANCE HISTORY ── */}
        <SectionCard icon={<RotateCcw size={18} />} title="سجل الحضور والانصراف (30 يوم)"
          accent="#a78bfa" isDark={isDark} border={border} cardBg={cardBg} defaultOpen={false}>
          {recentRecs.length === 0 ? (
            <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'16px 0' }}>لا توجد سجلات</p>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                    {['التاريخ', 'الحضور', 'الانصراف', 'المدة', 'الحالة'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign:'right', fontWeight:700,
                        color:textMuted, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...recentRecs].reverse().map((rec, i) => (
                    <tr key={i} style={{
                      borderTop: `1px solid ${border}`,
                      background: i % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)'),
                    }}>
                      <td style={{ padding:'8px 12px', whiteSpace:'nowrap', fontWeight:600 }}>
                        {fmtDate(rec.date)}
                      </td>
                      <td style={{ padding:'8px 12px', color:'#34d399', fontWeight:600, whiteSpace:'nowrap' }}>
                        {fmtTime(rec.check_in_time)}
                      </td>
                      <td style={{ padding:'8px 12px', color:'#f87171', fontWeight:600, whiteSpace:'nowrap' }}>
                        {fmtTime(rec.check_out_time)}
                      </td>
                      <td style={{ padding:'8px 12px', color:'#a78bfa', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                        {calcDuration(rec.check_in_time, rec.check_out_time)}
                      </td>
                      <td style={{ padding:'8px 12px' }}>
                        <AttBadge status={String(rec.status ?? '')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

      </div>

      {/* ══ MODALS ════════════════════════════════════════════ */}
      {showLogoutModal && (
        <LogoutCheckoutModal
          employeeId={empId}
          todayRecordId={todayRec?.id as number | undefined}
          alreadyCheckedIn={alreadyCheckedIn}
          alreadyCheckedOut={alreadyCheckedOut}
          onLogout={() => { setShowLogoutModal(false); logout(); }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
      {showIdleModal && (
        <IdleCheckoutModal
          employeeId={empId}
          todayRecordId={todayRec?.id as number | undefined}
          alreadyCheckedOut={alreadyCheckedOut}
          onStayLoggedIn={() => setShowIdleModal(false)}
          onLogout={() => { setShowIdleModal(false); logout(); }}
        />
      )}
    </div>
  );
}
