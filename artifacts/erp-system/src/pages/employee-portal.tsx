import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';
import { useToast } from '@/hooks/use-toast';
import {
  LogIn, LogOut, User, Clock, Calendar, Briefcase,
  Building2, Smartphone, Fingerprint, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Loader2,
  Sun, Moon, Coffee, BarChart2, Bell,
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────── */
type AnyRec = Record<string, unknown>;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function fmtTime(iso: unknown): string {
  if (!iso) return '—';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(iso: unknown): string {
  if (!iso) return '—';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function greetingText(): { text: string; Icon: typeof Sun } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'صباح الخير', Icon: Sun };
  if (h < 17) return { text: 'مساء الخير', Icon: Coffee };
  return { text: 'مساء النور', Icon: Moon };
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    present:  { label: 'حاضر',      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    absent:   { label: 'غائب',      cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    late:     { label: 'متأخر',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    on_leave: { label: 'إجازة',     cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
    holiday:  { label: 'إجازة رسمية', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
    half_day: { label: 'نصف يوم',   cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  };
  const m = map[s] ?? { label: s, cls: 'bg-white/5 text-white/50 border-white/10' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${m.cls}`}>
      {m.label}
    </span>
  );
}

/* ─── main component ─────────────────────────────────────── */
export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const { settings } = useAppSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isDark = settings.theme === 'dark';

  const logoSrc = settings.customLogo || `${import.meta.env.BASE_URL}logo.png`;
  const empId = user?.employee_id;

  /* ── greeting ── */
  const { text: greeting, Icon: GreetIcon } = greetingText();
  const today = todayStr();

  /* ── fetch employee profile ── */
  const { data: empRaw } = useQuery<AnyRec>({
    queryKey: ['portal-employee', empId],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/employees/${empId}`);
      return r.json();
    },
    enabled: !!empId,
  });

  /* ── fetch today's attendance ── */
  const { data: todayRecRaw, isLoading: todayLoading } = useQuery<AnyRec[]>({
    queryKey: ['portal-attendance-today', empId, today],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/attendance/records?employee_id=${empId}&date_from=${today}&date_to=${today}`);
      return r.json();
    },
    enabled: !!empId,
    refetchInterval: 60_000,
  });

  /* ── fetch recent attendance (last 14 days) ── */
  const dateFrom = (() => {
    const d = new Date(); d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  })();
  const { data: recentRaw, isLoading: recentLoading } = useQuery<AnyRec[]>({
    queryKey: ['portal-attendance-recent', empId, dateFrom],
    queryFn: async () => {
      if (!empId) return [];
      const r = await authFetch(`/api/attendance/records?employee_id=${empId}&date_from=${dateFrom}&date_to=${today}`);
      return r.json();
    },
    enabled: !!empId,
  });

  /* ── fetch attendance summary ── */
  const monthStart = today.slice(0, 7) + '-01';
  const { data: summaryRaw } = useQuery<AnyRec>({
    queryKey: ['portal-summary', empId, monthStart],
    queryFn: async () => {
      if (!empId) return {};
      const r = await authFetch(`/api/attendance/summary/${empId}?date_from=${monthStart}&date_to=${today}`);
      return r.json();
    },
    enabled: !!empId,
  });

  /* ── check in / check out ── */
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const todayRec = Array.isArray(todayRecRaw) && todayRecRaw.length > 0
    ? (todayRecRaw[0] as AnyRec)
    : null;

  const alreadyCheckedIn  = !!todayRec && !!todayRec.check_in;
  const alreadyCheckedOut = !!todayRec && !!todayRec.check_out;

  async function doCheckIn() {
    if (!empId) return;
    setCheckingIn(true);
    try {
      const res = await authFetch('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ employee_id: empId }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'تم تسجيل الحضور ✓', description: `حضرت في ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` });
      qc.invalidateQueries({ queryKey: ['portal-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['portal-attendance-recent'] });
    } catch (e) {
      toast({ title: 'فشل تسجيل الحضور', description: e instanceof Error ? e.message : 'خطأ غير متوقع', variant: 'destructive' });
    } finally {
      setCheckingIn(false);
    }
  }

  async function doCheckOut() {
    if (!todayRec?.id) return;
    setCheckingOut(true);
    try {
      const res = await authFetch('/api/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ record_id: todayRec.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'تم تسجيل الانصراف ✓', description: `انصرفت في ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}` });
      qc.invalidateQueries({ queryKey: ['portal-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['portal-attendance-recent'] });
    } catch (e) {
      toast({ title: 'فشل تسجيل الانصراف', description: e instanceof Error ? e.message : 'خطأ غير متوقع', variant: 'destructive' });
    } finally {
      setCheckingOut(false);
    }
  }

  /* ── derived data ── */
  const emp        = (empRaw ?? {}) as AnyRec;
  const recentRecs = Array.isArray(recentRaw) ? (recentRaw as AnyRec[]) : [];
  const summary    = (summaryRaw ?? {}) as AnyRec;

  const textMain  = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const bg        = isDark ? '#0b111f' : '#f4f6fb';
  const cardBg    = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const border    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  /* ─── current time display ─── */
  const [nowTime, setNowTime] = useState(() =>
    new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setNowTime(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: bg,
        fontFamily: `'${settings.fontFamily}', sans-serif`,
        color: textMain,
      }}
    >
      {/* ══ TOP NAV BAR ════════════════════════════════════════════════ */}
      <div
        style={{
          height: 60,
          background: isDark ? 'rgba(11,17,31,0.95)' : '#ffffff',
          borderBottom: `1px solid ${border}`,
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 24px',
        }}
      >
        {/* Logo */}
        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <img src={logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 900, color: isDark ? '#f59e0b' : '#b45309', lineHeight: 1.2 }}>
            {settings.companyName}
          </p>
          <p style={{ fontSize: 10, color: textMuted, lineHeight: 1.2 }}>بوابة الموظف</p>
        </div>

        <div style={{ flex: 1 }} />

        {/* Time */}
        <div className="hidden sm:flex items-center gap-2" style={{ color: textMuted, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          <Clock size={14} />
          <span>{nowTime}</span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>

      {/* ══ MAIN CONTENT ═══════════════════════════════════════════════ */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* ── GREETING HEADER ── */}
        <div
          className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(11,17,31,0.95) 50%)'
              : 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 50%)',
            border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.30)'}`,
          }}
        >
          {/* decorative glow */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 180, height: 180,
            background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div className="flex items-start gap-5 relative">
            {/* Avatar */}
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 64, height: 64, borderRadius: 18,
                background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.20)',
                border: '2px solid rgba(245,158,11,0.35)',
              }}
            >
              <User size={28} style={{ color: '#f59e0b' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <GreetIcon size={15} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 12, color: isDark ? '#f59e0b' : '#92400e', fontWeight: 600 }}>{greeting}</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.3, marginBottom: 4 }}>
                {user?.name ?? fmt(emp.name)}
              </h1>
              <div className="flex flex-wrap gap-3" style={{ fontSize: 12, color: textMuted }}>
                {emp.job_title_name && (
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} />
                    {fmt(emp.job_title_name)}
                  </span>
                )}
                {emp.department_name && (
                  <span className="flex items-center gap-1">
                    <Building2 size={12} />
                    {fmt(emp.department_name)}
                  </span>
                )}
                {emp.branch_name && (
                  <span className="flex items-center gap-1">
                    <Building2 size={12} />
                    {fmt(emp.branch_name)}
                  </span>
                )}
              </div>
            </div>

            {/* Date badge */}
            <div className="shrink-0 text-center hidden sm:block">
              <p style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>اليوم</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f59e0b' : '#b45309' }}>
                {new Date().toLocaleDateString('ar-EG', { weekday: 'long' })}
              </p>
              <p style={{ fontSize: 11, color: textMuted }}>
                {new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* ── GRID: check-in card + stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

          {/* Check-in / Check-out Card */}
          <div
            className="rounded-2xl p-5 sm:col-span-2 lg:col-span-1"
            style={{ background: cardBg, border: `1px solid ${border}` }}
          >
            <p style={{ fontSize: 11, color: textMuted, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              تسجيل الحضور والانصراف
            </p>

            {todayLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin" size={22} style={{ color: textMuted }} />
              </div>
            ) : (
              <div className="space-y-3">
                {/* check-in row */}
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: alreadyCheckedIn
                      ? 'rgba(52,211,153,0.10)'
                      : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${alreadyCheckedIn ? 'rgba(52,211,153,0.25)' : border}`,
                  }}
                >
                  <div>
                    <p style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>وقت الحضور</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: alreadyCheckedIn ? '#34d399' : textMuted }}>
                      {alreadyCheckedIn ? fmtTime(todayRec?.check_in) : '—'}
                    </p>
                  </div>
                  {alreadyCheckedIn
                    ? <CheckCircle2 size={20} style={{ color: '#34d399' }} />
                    : <LogIn size={18} style={{ color: textMuted }} />
                  }
                </div>

                {/* check-out row */}
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: alreadyCheckedOut
                      ? 'rgba(99,102,241,0.10)'
                      : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${alreadyCheckedOut ? 'rgba(99,102,241,0.25)' : border}`,
                  }}
                >
                  <div>
                    <p style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>وقت الانصراف</p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: alreadyCheckedOut ? '#818cf8' : textMuted }}>
                      {alreadyCheckedOut ? fmtTime(todayRec?.check_out) : '—'}
                    </p>
                  </div>
                  {alreadyCheckedOut
                    ? <CheckCircle2 size={20} style={{ color: '#818cf8' }} />
                    : <LogOut size={18} style={{ color: textMuted }} />
                  }
                </div>

                {/* action button */}
                <div className="pt-1">
                  {!alreadyCheckedIn ? (
                    <button
                      onClick={doCheckIn}
                      disabled={checkingIn}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(to left, #10b981, #059669)', color: '#fff', boxShadow: '0 4px 16px rgba(16,185,129,0.30)' }}
                    >
                      {checkingIn ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                      تسجيل الحضور
                    </button>
                  ) : !alreadyCheckedOut ? (
                    <button
                      onClick={doCheckOut}
                      disabled={checkingOut}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(to left, #6366f1, #4f46e5)', color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.30)' }}
                    >
                      {checkingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                      تسجيل الانصراف
                    </button>
                  ) : (
                    <div
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}
                    >
                      <CheckCircle2 size={16} />
                      تم تسجيل الحضور والانصراف
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats: days present */}
          <StatCard
            icon={<CheckCircle2 size={22} style={{ color: '#34d399' }} />}
            label="أيام الحضور"
            value={fmt(summary.present_days ?? summary.total_present)}
            sub="هذا الشهر"
            color="emerald"
            isDark={isDark}
            cardBg={cardBg}
            border={border}
            textMuted={textMuted}
          />

          {/* Stats: absences */}
          <StatCard
            icon={<XCircle size={22} style={{ color: '#f87171' }} />}
            label="أيام الغياب"
            value={fmt(summary.absent_days ?? summary.total_absent)}
            sub="هذا الشهر"
            color="red"
            isDark={isDark}
            cardBg={cardBg}
            border={border}
            textMuted={textMuted}
          />
        </div>

        {/* ── RECENT ATTENDANCE TABLE ── */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          {/* header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid ${border}` }}
          >
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: '#f59e0b' }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                سجل الحضور — آخر 14 يوم
              </p>
            </div>
          </div>

          {recentLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin" size={22} style={{ color: textMuted }} />
            </div>
          ) : recentRecs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: textMuted }}>
              <Calendar size={36} style={{ marginBottom: 10, opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>لا توجد سجلات حضور بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {['التاريخ', 'الحضور', 'الانصراف', 'المدة', 'الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, color: textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRecs.map((rec, i) => {
                    const ci   = rec.check_in  ? fmtTime(rec.check_in)  : '—';
                    const co   = rec.check_out ? fmtTime(rec.check_out) : '—';
                    let duration = '—';
                    if (rec.check_in && rec.check_out) {
                      const ms = new Date(String(rec.check_out)).getTime() - new Date(String(rec.check_in)).getTime();
                      const hr = Math.floor(ms / 3600000);
                      const mn = Math.floor((ms % 3600000) / 60000);
                      duration = `${hr}س ${mn}د`;
                    }
                    const isToday = String(rec.date ?? '').slice(0, 10) === today;
                    return (
                      <tr
                        key={String(rec.id ?? i)}
                        style={{
                          borderBottom: `1px solid ${border}`,
                          background: isToday
                            ? isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.05)'
                            : 'transparent',
                        }}
                      >
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: isToday ? 800 : 500, color: isToday ? '#f59e0b' : undefined }}>
                            {fmtDate(rec.date ?? rec.check_in)}
                          </span>
                          {isToday && (
                            <span className="mr-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                              اليوم
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 16px', color: '#34d399', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{ci}</td>
                        <td style={{ padding: '11px 16px', color: '#818cf8', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{co}</td>
                        <td style={{ padding: '11px 16px', color: textMuted, fontVariantNumeric: 'tabular-nums' }}>{duration}</td>
                        <td style={{ padding: '11px 16px' }}>{statusBadge(String(rec.status ?? 'present'))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── QUICK LINKS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Mobile App */}
          <div
            className="rounded-2xl p-5 flex items-start gap-4 cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.06))'
                : 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
              border: `1px solid ${isDark ? 'rgba(99,102,241,0.30)' : 'rgba(99,102,241,0.20)'}`,
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.20)', flexShrink: 0 }}
            >
              <Smartphone size={22} style={{ color: '#818cf8' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: isDark ? '#c7d2fe' : '#4f46e5' }}>
                تطبيق الموبايل
              </p>
              <p style={{ fontSize: 12, color: textMuted, lineHeight: 1.5, marginBottom: 12 }}>
                حمّل تطبيق مُحكم على هاتفك لتسجيل الحضور وعرض بياناتك في أي وقت
              </p>
              <div className="flex gap-2">
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(99,102,241,0.18)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.30)' }}
                >
                  قريباً
                </span>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: textMuted, flexShrink: 0, marginTop: 2 }} />
          </div>

          {/* Fingerprint Device */}
          <div
            className="rounded-2xl p-5 flex items-start gap-4"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))'
                : 'linear-gradient(135deg, #fef9c3, #fffbeb)',
              border: `1px solid ${isDark ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.25)'}`,
            }}
          >
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(245,158,11,0.20)', flexShrink: 0 }}
            >
              <Fingerprint size={22} style={{ color: '#f59e0b' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: isDark ? '#fde68a' : '#b45309' }}>
                جهاز البصمة
              </p>
              <p style={{ fontSize: 12, color: textMuted, lineHeight: 1.5, marginBottom: 12 }}>
                إعدادات ومزامنة جهاز البصمة ZKTeco — يُدار بواسطة مدير النظام
              </p>
              <div className="flex gap-2">
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.30)' }}
                >
                  <Fingerprint size={11} />
                  إعدادات البصمة (للمدير)
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─── StatCard ───────────────────────────────────────────── */
function StatCard({
  icon, label, value, sub, color, isDark, cardBg, border, textMuted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'emerald' | 'red' | 'amber' | 'violet';
  isDark: boolean;
  cardBg: string;
  border: string;
  textMuted: string;
}) {
  const colors: Record<string, { bg: string; glow: string }> = {
    emerald: { bg: 'rgba(52,211,153,0.10)', glow: 'rgba(52,211,153,0.18)' },
    red:     { bg: 'rgba(248,113,113,0.10)', glow: 'rgba(248,113,113,0.18)' },
    amber:   { bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.18)'  },
    violet:  { bg: 'rgba(167,139,250,0.10)', glow: 'rgba(167,139,250,0.18)' },
  };
  const c = colors[color];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col justify-between"
      style={{ background: cardBg, border: `1px solid ${border}` }}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: 48, height: 48, borderRadius: 14, background: c.bg, marginBottom: 16 }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{value}</p>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11, color: textMuted }}>{sub}</p>
      </div>
    </div>
  );
}
