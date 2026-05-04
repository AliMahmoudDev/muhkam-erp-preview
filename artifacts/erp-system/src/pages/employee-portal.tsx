import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';
import { useToast } from '@/hooks/use-toast';
import {
  Clock, Calendar, Briefcase, Building2, CheckCircle2,
  XCircle, Loader2, Sun, Moon, Coffee, TrendingDown,
  Gift, FileText, Wallet, UserCheck, AlertCircle,
  Users, MapPin, RotateCcw, LogOut, LogIn,
  PlusCircle, X, ChevronDown, ChevronUp,
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
      day: 'numeric', month: 'short', year: showWeekday ? undefined : 'numeric',
    });
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('ar-EG', { ...(showWeekday ? { weekday: 'short' } : {}), day: 'numeric', month: 'short' });
}

function fmtCurrency(val: unknown, currency = 'EGP'): string {
  const n = parseFloat(String(val ?? '0'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ' + currency;
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
  return `${Math.floor(mins / 60)}س ${mins % 60}د`;
}

/* ══════════════════════════════════════════════════
   BADGES
══════════════════════════════════════════════════ */
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ display:'inline-flex', padding:'2px 9px', borderRadius:6, fontSize:11, fontWeight:700, background:bg, color }}>{label}</span>;
}

function AttBadge({ s }: { s: string }) {
  const M: Record<string, [string, string, string]> = {
    present:  ['حاضر',         '#34d399', 'rgba(52,211,153,0.13)'],
    absent:   ['غائب',         '#f87171', 'rgba(248,113,113,0.13)'],
    late:     ['متأخر',        '#fbbf24', 'rgba(251,191,36,0.13)'],
    on_leave: ['إجازة',        '#60a5fa', 'rgba(96,165,250,0.13)'],
    holiday:  ['إجازة رسمية', '#a78bfa', 'rgba(167,139,250,0.13)'],
    half_day: ['نصف يوم',     '#fb923c', 'rgba(251,146,60,0.13)'],
  };
  const [label, color, bg] = M[s] ?? [s||'—', '#94a3b8', 'rgba(148,163,184,0.1)'];
  return <Badge label={label} color={color} bg={bg} />;
}

function StatusBadge({ s, map }: { s: string; map: Record<string, [string, string, string]> }) {
  const [label, color, bg] = map[s] ?? [s, '#94a3b8', 'rgba(148,163,184,0.1)'];
  return <Badge label={label} color={color} bg={bg} />;
}

const ADVANCE_STATUS: Record<string, [string, string, string]> = {
  pending:  ['قيد المراجعة', '#fbbf24', 'rgba(251,191,36,0.13)'],
  approved: ['موافق عليه',   '#34d399', 'rgba(52,211,153,0.13)'],
  rejected: ['مرفوض',        '#f87171', 'rgba(248,113,113,0.13)'],
  paid:     ['مدفوع',        '#60a5fa', 'rgba(96,165,250,0.13)'],
  active:   ['نشط',          '#a78bfa', 'rgba(167,139,250,0.13)'],
  settled:  ['مسدد',         '#34d399', 'rgba(52,211,153,0.13)'],
  cancelled:['ملغى',         '#94a3b8', 'rgba(148,163,184,0.1)'],
};
const LEAVE_STATUS: Record<string, [string, string, string]> = {
  pending:  ['قيد الانتظار', '#fbbf24', 'rgba(251,191,36,0.13)'],
  approved: ['موافق عليه',   '#34d399', 'rgba(52,211,153,0.13)'],
  rejected: ['مرفوض',        '#f87171', 'rgba(248,113,113,0.13)'],
  cancelled:['ملغى',         '#94a3b8', 'rgba(148,163,184,0.1)'],
};

/* ══════════════════════════════════════════════════
   SECTION CARD
══════════════════════════════════════════════════ */
function SectionCard({ icon, title, accent = '#f59e0b', children, isDark, border, cardBg, actions, defaultOpen = true }: {
  icon: React.ReactNode; title: string; accent?: string; children: React.ReactNode;
  isDark: boolean; border: string; cardBg: string; actions?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, overflow:'hidden', marginBottom:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px' }}>
        <button onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap:12, flex:1, background:'transparent', border:'none', cursor:'pointer', textAlign:'right', padding:0 }}>
          <span style={{ width:34, height:34, borderRadius:9, background:`${accent}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:accent }}>
            {icon}
          </span>
          <span style={{ fontSize:14, fontWeight:800, color:isDark?'#f1f5f9':'#0f172a', flex:1 }}>{title}</span>
          <span style={{ color:isDark?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.28)', flexShrink:0 }}>
            {open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </span>
        </button>
        {actions && <div style={{ flexShrink:0 }}>{actions}</div>}
      </div>
      {open && (
        <div style={{ borderTop:`1px solid ${border}`, padding:'14px 18px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════════ */
function StatCard({ label, value, icon, color, bg }: { label: string; value: string|number; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{ borderRadius:12, padding:'12px 16px', background:bg, display:'flex', flexDirection:'column', gap:6, flex:1, minWidth:110 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ color, opacity:0.8 }}>{icon}</span>
        <span style={{ fontSize:11, color, fontWeight:600, opacity:0.8 }}>{label}</span>
      </div>
      <span style={{ fontSize:26, fontWeight:900, color, fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SALARY ADVANCE REQUEST MODAL
══════════════════════════════════════════════════ */
const ADVANCE_TYPES = [
  ['personal',    'شخصي'],
  ['emergency',   'طارئ'],
  ['medical',     'علاجي'],
  ['educational', 'تعليمي'],
  ['other',       'أخرى'],
] as const;

function AdvanceRequestModal({ empId, currency, isDark, border, onClose }: {
  empId: number; currency: string; isDark: boolean; border: string; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    requested_amount: '',
    advance_type: 'personal',
    reason: '',
    deduct_from: 'fixed' as 'fixed' | 'commission' | 'both',
  });
  const bg = isDark ? 'rgba(8,14,26,0.98)' : '#ffffff';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc';
  const inputStyle = {
    width:'100%', padding:'10px 14px', borderRadius:10,
    border:`1px solid ${border}`, background:inputBg, color:textMain,
    fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const,
  };
  const labelStyle = { fontSize:12, fontWeight:700 as const, color:textMain, display:'block' as const, marginBottom:6 };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/salary-advances', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: empId,
          requested_amount: parseFloat(form.requested_amount),
          advance_type: form.advance_type,
          reason: form.reason,
          deduct_from: form.deduct_from,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(j.message ?? j.error ?? 'فشل إرسال الطلب'));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'تم إرسال طلب السلفة ✓', description: 'سيتم مراجعته من قِبل المدير وإشعارك بالنتيجة' });
      qc.invalidateQueries({ queryKey: ['portal-advances'] });
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: 'فشل إرسال الطلب', description: e.message, variant: 'destructive' });
    },
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}>
      <div dir="rtl" style={{ width:'100%', maxWidth:460, borderRadius:20, background:bg, border:`1px solid ${border}`, padding:28, position:'relative', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, left:16, background:'transparent', border:'none', cursor:'pointer', color:isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.4)' }}>
          <X size={18} />
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
          <span style={{ width:42, height:42, borderRadius:12, background:'rgba(245,158,11,0.18)', display:'flex', alignItems:'center', justifyContent:'center', color:'#f59e0b', flexShrink:0 }}>
            <Wallet size={21} />
          </span>
          <div>
            <p style={{ fontSize:16, fontWeight:900, color:textMain }}>طلب سلفة مالية</p>
            <p style={{ fontSize:12, color:textMuted }}>سيُرسَل للمدير للموافقة</p>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Amount */}
          <div>
            <label style={labelStyle}>المبلغ المطلوب ({currency}) *</label>
            <input
              type="number" min="1"
              value={form.requested_amount}
              onChange={e => setForm(p => ({ ...p, requested_amount: e.target.value }))}
              placeholder="أدخل المبلغ..."
              style={inputStyle}
            />
          </div>

          {/* Advance type */}
          <div>
            <label style={labelStyle}>نوع السلفة</label>
            <select
              value={form.advance_type}
              onChange={e => setForm(p => ({ ...p, advance_type: e.target.value }))}
              style={inputStyle}
            >
              {ADVANCE_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Deduct from */}
          <div>
            <label style={labelStyle}>خصم السلفة من</label>
            <select
              value={form.deduct_from}
              onChange={e => setForm(p => ({ ...p, deduct_from: e.target.value as 'fixed' | 'commission' | 'both' }))}
              style={inputStyle}
            >
              <option value="fixed">الراتب الثابت</option>
              <option value="commission">العمولة</option>
              <option value="both">من الراتب الثابت والعمولة معاً</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label style={labelStyle}>سبب الطلب (اختياري)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="اكتب سبب السلفة..."
              rows={3}
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </div>

          {/* Info note */}
          <div style={{ fontSize:12, color:'#f59e0b', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.20)', borderRadius:9, padding:'10px 14px', lineHeight:1.6 }}>
            سيصلك إشعار بالنتيجة فور مراجعة الطلب من قِبل المدير
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:22 }}>
          <button
            onClick={() => mutate()}
            disabled={!form.requested_amount || parseFloat(form.requested_amount) <= 0 || isPending}
            style={{ flex:1, padding:'11px 0', borderRadius:11, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg, #b45309, #f59e0b)', color:'#fff',
              fontWeight:800, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
              opacity: (!form.requested_amount || parseFloat(form.requested_amount) <= 0 || isPending) ? 0.6 : 1 }}
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : <PlusCircle size={15} />}
            {isPending ? 'جاري الإرسال...' : 'إرسال طلب السلفة'}
          </button>
          <button
            onClick={onClose}
            style={{ padding:'11px 18px', borderRadius:11, border:`1px solid ${border}`, cursor:'pointer',
              background:'transparent', color:isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.5)', fontWeight:600, fontSize:13 }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
export default function EmployeePortal() {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isDark = settings.theme === 'dark';
  const empId = user?.employee_id;

  const { text: greeting, Icon: GreetIcon } = greetingText();
  const today = todayStr();
  const currentMonth = today.slice(0, 7);

  const textMain  = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const bg        = isDark ? 'rgba(255,255,255,0.01)' : '#f8fafc';
  const cardBg    = isDark ? 'rgba(255,255,255,0.035)' : '#ffffff';
  const border    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  /* ── Queries ── */
  const { data: empRaw } = useQuery<AnyRec>({
    queryKey: ['portal-employee', empId],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/employees/${empId}`);
      return r.ok ? r.json() : {};
    },
    enabled: !!empId,
  });

  const { data: todayRecRaw, isLoading: todayLoading } = useQuery<AnyRec[]>({
    queryKey: ['portal-att-today', empId, today],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/attendance/records?employee_id=${empId}&from=${today}&to=${today}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId, refetchInterval: 60_000,
  });

  const { data: summaryRaw } = useQuery<AnyRec>({
    queryKey: ['portal-summary', empId, currentMonth],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/attendance/summary/${empId}?month=${currentMonth}`);
      return r.ok ? r.json() : {};
    },
    enabled: !!empId,
  });

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

  const { data: advancesRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-advances', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/salary-advances?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  const { data: deductionsRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-deductions', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/employee-deductions?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  const { data: bonusesRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-bonuses', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/employee-bonuses?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  const { data: leavesRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-leaves', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/leave-requests?employee_id=${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  const { data: leaveBalRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-leave-bal', empId],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/employee-leave-balance/${empId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
  });

  const { data: payslipsRaw } = useQuery<AnyRec[]>({
    queryKey: ['portal-payslips'],
    queryFn: async () => {
      const r = await authFetch('/api/payroll/my-payslips');
      return r.ok ? r.json() : [];
    },
  });

  /* ── Derived ── */
  const emp       = (empRaw ?? {}) as AnyRec;
  const summary   = (summaryRaw ?? {}) as AnyRec;
  const recentRecs = Array.isArray(recentRaw)    ? recentRaw    : [];
  const advances   = Array.isArray(advancesRaw)  ? advancesRaw  : [];
  const deductions = Array.isArray(deductionsRaw) ? deductionsRaw : [];
  const bonuses    = Array.isArray(bonusesRaw)   ? bonusesRaw   : [];
  const leaves     = Array.isArray(leavesRaw)    ? leavesRaw    : [];
  const leavesBal  = Array.isArray(leaveBalRaw)  ? leaveBalRaw  : [];
  const payslips   = Array.isArray(payslipsRaw)  ? payslipsRaw  : [];

  const todayRec = Array.isArray(todayRecRaw) && todayRecRaw.length > 0 ? todayRecRaw[0] as AnyRec : null;
  const alreadyCheckedIn  = !!todayRec?.check_in_time;
  const alreadyCheckedOut = !!todayRec?.check_out_time;

  const empName   = [fmt(emp.first_name_ar), fmt(emp.last_name_ar)].filter(x => x !== '—').join(' ') || fmt(user?.username);
  const empCode   = fmt(emp.employee_code);
  const empSalary = emp.salary ? fmtCurrency(emp.salary, fmt(emp.currency)) : '—';
  const empCurrency = fmt(emp.currency || 'EGP');
  const empHire   = fmtDate(emp.hire_date, false);
  const empType   = emp.employment_type === 'full_time' ? 'دوام كامل' : emp.employment_type === 'part_time' ? 'دوام جزئي' : fmt(emp.employment_type);

  /* ── Actions ── */
  async function doCheckIn() {
    if (!empId) return;
    setCheckingIn(true);
    try {
      const res = await authFetch('/api/attendance/check-in', { method:'POST', body:JSON.stringify({ employee_id: empId }) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title:'تم تسجيل الحضور ✓', description:`حضرت في ${new Date().toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })}` });
      qc.invalidateQueries({ queryKey:['portal-att-today'] });
      qc.invalidateQueries({ queryKey:['portal-att-recent'] });
      qc.invalidateQueries({ queryKey:['portal-summary'] });
    } catch (e) {
      toast({ title:'فشل تسجيل الحضور', description:e instanceof Error ? e.message : 'خطأ', variant:'destructive' });
    } finally { setCheckingIn(false); }
  }

  async function doCheckOut() {
    if (!todayRec?.id) return;
    setCheckingOut(true);
    try {
      const res = await authFetch('/api/attendance/check-out', { method:'POST', body:JSON.stringify({ record_id: todayRec.id }) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title:'تم تسجيل الانصراف ✓', description:`انصرفت في ${new Date().toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' })}` });
      qc.invalidateQueries({ queryKey:['portal-att-today'] });
      qc.invalidateQueries({ queryKey:['portal-att-recent'] });
      qc.invalidateQueries({ queryKey:['portal-summary'] });
    } catch (e) {
      toast({ title:'فشل تسجيل الانصراف', description:e instanceof Error ? e.message : 'خطأ', variant:'destructive' });
    } finally { setCheckingOut(false); }
  }

  function deductLabel(t: string) {
    return ({ late:'تأخر', absence:'غياب', damage:'تلف', other:'أخرى' }[t] ?? t);
  }

  if (!empId) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300, flexDirection:'column', gap:12, color:textMuted }}>
        <AlertCircle size={40} style={{ opacity:0.4 }} />
        <p style={{ fontSize:14, fontWeight:600 }}>حسابك غير مرتبط بسجل موظف بعد</p>
        <p style={{ fontSize:12 }}>تواصل مع المدير لربط حسابك بملف الموظف</p>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" style={{ background:bg, minHeight:'100%', color:textMain }}>

      {/* ── GREETING BANNER ── */}
      <div style={{
        borderRadius:20, padding:'22px 24px', marginBottom:22, position:'relative', overflow:'hidden',
        background: isDark
          ? 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(8,14,26,0.98) 60%)'
          : 'linear-gradient(135deg, #fef3c7 0%, #fffdf0 60%)',
        border:`1px solid ${isDark ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.30)'}`,
      }}>
        <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, background:'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <div style={{ width:52, height:52, borderRadius:15, background:'rgba(245,158,11,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <GreetIcon size={26} color="#f59e0b" />
          </div>
          <div>
            <p style={{ fontSize:20, fontWeight:900, color:isDark?'#fcd34d':'#92400e', lineHeight:1.2 }}>
              {greeting}، {empName}
            </p>
            <p style={{ fontSize:12, color:textMuted, marginTop:3 }}>
              {new Date().toLocaleDateString('ar-EG', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', gap:10, flexShrink:0, flexWrap:'wrap' }}>
            {empCode !== '—' && (
              <div style={{ textAlign:'center', padding:'7px 14px', borderRadius:10, background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize:10, color:textMuted }}>كود الموظف</p>
                <p style={{ fontSize:16, fontWeight:900, color:isDark?'#fcd34d':'#92400e' }}>{empCode}</p>
              </div>
            )}
            {empSalary !== '—' && (
              <div style={{ textAlign:'center', padding:'7px 14px', borderRadius:10, background:isDark?'rgba(52,211,153,0.08)':'rgba(52,211,153,0.08)' }}>
                <p style={{ fontSize:10, color:'#34d399' }}>الراتب</p>
                <p style={{ fontSize:14, fontWeight:900, color:'#34d399' }}>{empSalary}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TODAY + JOB INFO ROW ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:18 }}>

        {/* Today Attendance */}
        <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, padding:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ width:34, height:34, borderRadius:9, background:'rgba(52,211,153,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'#34d399' }}>
              <UserCheck size={17} />
            </span>
            <span style={{ fontSize:14, fontWeight:800 }}>حضور اليوم</span>
            {todayLoading && <Loader2 size={13} className="animate-spin" style={{ color:textMuted }} />}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:textMuted }}>الحضور</span>
              <span style={{ fontSize:13, fontWeight:700, color:alreadyCheckedIn?'#34d399':textMuted }}>
                {alreadyCheckedIn ? fmtTime(todayRec?.check_in_time) : '—'}
              </span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:textMuted }}>الانصراف</span>
              <span style={{ fontSize:13, fontWeight:700, color:alreadyCheckedOut?'#f87171':textMuted }}>
                {alreadyCheckedOut ? fmtTime(todayRec?.check_out_time) : '—'}
              </span>
            </div>
            {alreadyCheckedIn && (
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, color:textMuted }}>المدة</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#a78bfa' }}>
                  {calcDuration(todayRec?.check_in_time, todayRec?.check_out_time)}
                  {!alreadyCheckedOut && <span style={{ fontSize:10, color:textMuted, marginRight:4 }}>(جارٍ)</span>}
                </span>
              </div>
            )}
            {Boolean(todayRec?.status) && (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:12, color:textMuted }}>الحالة</span>
                <AttBadge s={String(todayRec!.status)} />
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:8, marginTop:14 }}>
            {!alreadyCheckedIn && (
              <button onClick={doCheckIn} disabled={checkingIn}
                style={{ flex:1, padding:'9px 0', borderRadius:9, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#059669,#34d399)', color:'#fff', fontWeight:800, fontSize:12,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:checkingIn?0.7:1 }}>
                {checkingIn ? <Loader2 size={13} className="animate-spin"/> : <LogIn size={13}/>}
                تسجيل الحضور
              </button>
            )}
            {alreadyCheckedIn && !alreadyCheckedOut && (
              <button onClick={doCheckOut} disabled={checkingOut}
                style={{ flex:1, padding:'9px 0', borderRadius:9, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#dc2626,#f87171)', color:'#fff', fontWeight:800, fontSize:12,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity:checkingOut?0.7:1 }}>
                {checkingOut ? <Loader2 size={13} className="animate-spin"/> : <LogOut size={13}/>}
                تسجيل الانصراف
              </button>
            )}
            {alreadyCheckedIn && alreadyCheckedOut && (
              <div style={{ flex:1, padding:'9px 0', borderRadius:9, textAlign:'center',
                background:'rgba(52,211,153,0.09)', color:'#34d399', fontWeight:700, fontSize:12,
                display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <CheckCircle2 size={13}/> تم تسجيل يوم العمل
              </div>
            )}
          </div>
        </div>

        {/* Job Info */}
        <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, padding:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <span style={{ width:34, height:34, borderRadius:9, background:'rgba(96,165,250,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'#60a5fa' }}>
              <Briefcase size={17} />
            </span>
            <span style={{ fontSize:14, fontWeight:800 }}>بيانات الوظيفة</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {[
              { label:'المسمى الوظيفي', value:fmt(emp.job_title_ar ?? emp.job_title_id), icon:<Briefcase size={11}/> },
              { label:'القسم',          value:fmt(emp.department_ar ?? emp.department_id), icon:<Building2 size={11}/> },
              { label:'الفرع',          value:fmt(emp.branch_ar ?? emp.branch_id),         icon:<MapPin size={11}/> },
              { label:'تاريخ التعيين', value:empHire,                                     icon:<Calendar size={11}/> },
              { label:'نوع التوظيف',  value:empType,                                     icon:<Users size={11}/> },
            ].filter(x => x.value !== '—').map(({ label, value, icon }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:textMuted }}>{icon}{label}</span>
                <span style={{ fontSize:12, fontWeight:700 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MONTHLY SUMMARY ── */}
      <div style={{ borderRadius:16, border:`1px solid ${border}`, background:cardBg, padding:18, marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{ width:34, height:34, borderRadius:9, background:'rgba(167,139,250,0.14)', display:'flex', alignItems:'center', justifyContent:'center', color:'#a78bfa' }}>
            <Calendar size={17} />
          </span>
          <span style={{ fontSize:14, fontWeight:800 }}>
            ملخص {new Date(currentMonth + '-01').toLocaleDateString('ar-EG', { month:'long', year:'numeric' })}
          </span>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <StatCard label="حاضر"        value={Number(summary.present_days ?? 0)} icon={<CheckCircle2 size={15}/>} color="#34d399" bg="rgba(52,211,153,0.10)"/>
          <StatCard label="غائب"        value={Number(summary.absent_days  ?? 0)} icon={<XCircle size={15}/>}       color="#f87171" bg="rgba(248,113,113,0.10)"/>
          <StatCard label="تأخر"        value={Number(summary.late_days    ?? 0)} icon={<AlertCircle size={15}/>}   color="#fbbf24" bg="rgba(251,191,36,0.10)"/>
          <StatCard label="إجازة"       value={Number(summary.leave_days   ?? 0)} icon={<Calendar size={15}/>}      color="#60a5fa" bg="rgba(96,165,250,0.10)"/>
          <StatCard label="ساعات"       value={`${Number(summary.total_hours ?? 0).toFixed(0)}س`} icon={<Clock size={15}/>} color="#a78bfa" bg="rgba(167,139,250,0.10)"/>
        </div>
      </div>

      {/* ── SALARY ADVANCES ── */}
      <SectionCard
        icon={<Wallet size={17}/>} title={`السلف والمصروفات (${advances.length})`}
        accent="#f59e0b" isDark={isDark} border={border} cardBg={cardBg}
        actions={
          <button
            onClick={() => setShowAdvanceModal(true)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#b45309,#f59e0b)', color:'#fff', fontWeight:700, fontSize:12 }}
          >
            <PlusCircle size={13}/> طلب سلفة
          </button>
        }
      >
        {advances.length === 0 ? (
          <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'12px 0' }}>لا توجد سلف مسجلة</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {advances.map((a, i) => (
              <div key={(a as {id?:number}).id ?? `adv-${i}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 13px', borderRadius:10,
                background:isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.025)', border:`1px solid ${border}` }}>
                <Wallet size={13} style={{ color:'#f59e0b', flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>{fmtCurrency(a.approved_amount ?? a.requested_amount, fmt(a.currency))}</span>
                    <StatusBadge s={String(a.status??'')} map={ADVANCE_STATUS}/>
                  </div>
                  <p style={{ fontSize:11, color:textMuted, marginTop:2 }}>
                    {fmtDate(a.requested_date, false)}{a.reason ? ` · ${fmt(a.reason)}` : ''}
                  </p>
                </div>
                {Boolean(a.remaining_balance) && Number(a.remaining_balance) > 0 && (
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
      <SectionCard icon={<TrendingDown size={17}/>} title={`الخصومات (${deductions.length})`}
        accent="#f87171" isDark={isDark} border={border} cardBg={cardBg}>
        {deductions.length === 0 ? (
          <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'12px 0' }}>لا توجد خصومات</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {deductions.map((d, i) => (
              <div key={(d as {id?:number}).id ?? `ded-${i}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 13px', borderRadius:10,
                background:'rgba(248,113,113,0.05)', border:'1px solid rgba(248,113,113,0.14)' }}>
                <TrendingDown size={13} style={{ color:'#f87171', flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#f87171' }}>-{fmtCurrency(d.amount, fmt(d.currency))}</span>
                    <span style={{ fontSize:11, padding:'2px 7px', borderRadius:5, background:'rgba(248,113,113,0.12)', color:'#f87171', fontWeight:600 }}>
                      {deductLabel(String(d.deduction_type ?? ''))}
                    </span>
                  </div>
                  <p style={{ fontSize:11, color:textMuted, marginTop:2 }}>
                    {fmtDate(d.deduction_date, false)}{d.reason ? ` · ${fmt(d.reason)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── BONUSES ── */}
      <SectionCard icon={<Gift size={17}/>} title={`الحوافز والمكافآت (${bonuses.length})`}
        accent="#34d399" isDark={isDark} border={border} cardBg={cardBg}>
        {bonuses.length === 0 ? (
          <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'12px 0' }}>لا توجد حوافز</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {bonuses.map((b, i) => (
              <div key={(b as {id?:number}).id ?? `bon-${i}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 13px', borderRadius:10,
                background:'rgba(52,211,153,0.05)', border:'1px solid rgba(52,211,153,0.14)' }}>
                <Gift size={13} style={{ color:'#34d399', flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#34d399' }}>+{fmtCurrency(b.amount, fmt(b.currency))}</span>
                  <p style={{ fontSize:11, color:textMuted, marginTop:2 }}>
                    {fmtDate(b.granted_date, false)}{b.reason ? ` · ${fmt(b.reason)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── LEAVE REQUESTS ── */}
      <SectionCard icon={<FileText size={17}/>} title={`طلبات الإجازة (${leaves.length})`}
        accent="#60a5fa" isDark={isDark} border={border} cardBg={cardBg}>
        {leavesBal.length > 0 && (
          <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${border}` }}>
            {leavesBal.map((lb, i) => (
              <div key={String((lb as {leave_type_code?:string}).leave_type_code ?? i)} style={{ borderRadius:10, padding:'7px 13px', background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.15)' }}>
                <p style={{ fontSize:10, color:'#60a5fa', fontWeight:600, marginBottom:1 }}>{fmt(lb.leave_type_name_ar ?? lb.leave_type_code)}</p>
                <p style={{ fontSize:16, fontWeight:900, color:'#60a5fa' }}>{Number(lb.balance_days ?? 0).toFixed(0)} يوم</p>
                <p style={{ fontSize:10, color:textMuted }}>رصيد متاح</p>
              </div>
            ))}
          </div>
        )}
        {leaves.length === 0 ? (
          <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'12px 0' }}>لا توجد طلبات إجازة</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {leaves.map((l, i) => (
              <div key={(l as {id?:number}).id ?? `leave-${i}`} style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 13px', borderRadius:10,
                background:isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.025)', border:`1px solid ${border}` }}>
                <FileText size={13} style={{ color:'#60a5fa', flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:12, fontWeight:700 }}>{fmtDate(l.start_date, false)} — {fmtDate(l.end_date, false)}</span>
                    <span style={{ fontSize:11, color:textMuted }}>({Number(l.total_days ?? 0)} يوم)</span>
                    <StatusBadge s={String(l.status??'')} map={LEAVE_STATUS}/>
                  </div>
                  {Boolean(l.reason) && <p style={{ fontSize:11, color:textMuted, marginTop:2 }}>{fmt(l.reason)}</p>}
                  {Boolean(l.rejection_reason) && <p style={{ fontSize:11, color:'#f87171', marginTop:2 }}>سبب الرفض: {fmt(l.rejection_reason)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── PAYSLIPS ── */}
      <SectionCard icon={<Wallet size={17}/>} title={`قسائم الرواتب (${payslips.length})`}
        accent="#34d399" isDark={isDark} border={border} cardBg={cardBg} defaultOpen={false}>
        {payslips.length === 0 ? (
          <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'12px 0' }}>لا توجد قسائم رواتب</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {payslips.map((p, i) => (
              <div key={(p as {id?:number}).id ?? `payslip-${i}`} style={{ borderRadius:10, border:`1px solid ${border}`, padding:'12px 14px',
                background: isDark ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:800 }}>
                    {String(p.period_name ?? `فترة ${i+1}`)}
                  </span>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
                    background: String(p.status) === 'approved' ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)',
                    color: String(p.status) === 'approved' ? '#34d399' : '#fbbf24', fontWeight:700 }}>
                    {String(p.status) === 'approved' ? 'معتمد' : String(p.status) === 'processed' ? 'محلول' : 'مسودة'}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px' }}>
                  {[
                    { label:'الإجمالي',         value: fmtCurrency(p.gross_salary,     String(p.currency ?? empCurrency)) },
                    { label:'الخصومات',         value: fmtCurrency(p.total_deductions, String(p.currency ?? empCurrency)) },
                    { label:'الحوافز',          value: fmtCurrency(p.incentive_amount, String(p.currency ?? empCurrency)) },
                    { label:'صافي الراتب',      value: fmtCurrency(p.net_salary,       String(p.currency ?? empCurrency)) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span style={{ fontSize:10, color:textMuted }}>{label}</span>
                      <div style={{ fontSize:12, fontWeight:700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── ATTENDANCE HISTORY (collapsed by default) ── */}
      <SectionCard icon={<RotateCcw size={17}/>} title="سجل الحضور والانصراف (30 يوم)"
        accent="#a78bfa" isDark={isDark} border={border} cardBg={cardBg} defaultOpen={false}>
        {recentRecs.length === 0 ? (
          <p style={{ fontSize:13, color:textMuted, textAlign:'center', padding:'12px 0' }}>لا توجد سجلات</p>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)' }}>
                  {['التاريخ','الحضور','الانصراف','المدة','الحالة'].map(h => (
                    <th key={h} style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:textMuted, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...recentRecs].reverse().map((rec, i) => (
                  <tr key={(rec as {id?:number}).id ?? `att-${rec.date ?? i}`} style={{ borderTop:`1px solid ${border}`, background: i%2===0?'transparent':isDark?'rgba(255,255,255,0.012)':'rgba(0,0,0,0.012)' }}>
                    <td style={{ padding:'7px 10px', whiteSpace:'nowrap', fontWeight:600 }}>{fmtDate(rec.date)}</td>
                    <td style={{ padding:'7px 10px', color:'#34d399', fontWeight:600, whiteSpace:'nowrap' }}>{fmtTime(rec.check_in_time)}</td>
                    <td style={{ padding:'7px 10px', color:'#f87171', fontWeight:600, whiteSpace:'nowrap' }}>{fmtTime(rec.check_out_time)}</td>
                    <td style={{ padding:'7px 10px', color:'#a78bfa', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{calcDuration(rec.check_in_time, rec.check_out_time)}</td>
                    <td style={{ padding:'7px 10px' }}><AttBadge s={String(rec.status??'')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── ADVANCE REQUEST MODAL ── */}
      {showAdvanceModal && (
        <AdvanceRequestModal
          empId={empId} currency={empCurrency}
          isDark={isDark} border={border}
          onClose={() => setShowAdvanceModal(false)}
        />
      )}
    </div>
  );
}
