import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/contexts/auth';
import { useAppSettings } from '@/contexts/app-settings';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Calendar,
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingDown,
  Gift,
  FileText,
  Wallet,
  UserCheck,
  AlertCircle,
  Users,
  MapPin,
  RotateCcw,
  LogOut,
  LogIn,
  PlusCircle,
} from 'lucide-react';

import type { AnyRec } from './types';
import {
  fmt,
  fmtTime,
  fmtDate,
  fmtCurrency,
  todayStr,
  nDaysAgo,
  greetingText,
  calcDuration,
} from './helpers';
import { ADVANCE_STATUS, LEAVE_STATUS } from './constants';
import { AttBadge, StatusBadge } from './Badge';
import { SectionCard } from './SectionCard';
import { StatCard } from './StatCard';
import { AdvanceRequestModal } from './AdvanceRequestModal';
import { TechnicianSections } from './TechnicianSections';
import { Role } from '@/lib/roles';

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

  const textMain = isDark ? 'var(--text-1)' : 'var(--bg-app)';
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const bg = isDark ? 'rgba(255,255,255,0.01)' : 'var(--text-1)';
  const cardBg = isDark ? 'rgba(255,255,255,0.035)' : 'var(--text-1)';
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
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
      const r = await authFetch(
        `/api/attendance/records?employee_id=${empId}&from=${today}&to=${today}`
      );
      return r.ok ? r.json() : [];
    },
    enabled: !!empId,
    refetchInterval: 60_000,
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
      const r = await authFetch(
        `/api/attendance/records?employee_id=${empId}&from=${dateFrom30}&to=${today}`
      );
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

  /* ── Tech-services visibility check ────────────────────────────
     يتحقق هل سبق تعيين خدمات صيانة لهذا المستخدم (نشطة أو مكتملة).
     technician_id في repair_job_services = user.id (ليس employee_id).
     يُستخدم في شرط إظهار لوحة الفني — لا علاقة له بدور المستخدم.
     هام: عند error نُلقي استثناء (لا نُرجع null) حتى يُعيد React Query المحاولة ── */
  const { data: techSummaryRaw } = useQuery<{
    active_count: number;
    delivered_count: number;
    outstanding_earnings: number;
    total_assigned: number;
  } | null>({
    queryKey: ['portal-tech-check', user?.id],
    queryFn: async () => {
      const r = await authFetch(`/api/technicians/${user!.id}/earnings/summary`);
      /* 403 = مستخدم لا يملك خدمات (ليس فنياً) — أرجع null بهدوء
         أي خطأ آخر (502/503/network) = ألقِ استثناء حتى يُعيد React Query المحاولة تلقائياً */
      if (r.status === 403) return null;
      if (!r.ok) throw new Error(`tech-check: ${r.status}`);
      return r.json();
    },
    retry: 3,
    enabled: true,
  });

  /* ── Derived ── */
  /* لوحة الفني:
     - technician_id في repair_job_services = user.id دائماً
     - تظهر اللوحة إذا: role=technician  أو  (empId موجود + سبق تعيين أي خدمة للمستخدم)
     - نستخدم total_assigned (كل الخدمات بغض النظر عن الحالة) لأن active_count
       قد يكون صفراً حتى لو عنده خدمات بحالة "completed" أو "commission_locked" */
  const hasTechServices = !!techSummaryRaw && (techSummaryRaw.total_assigned ?? 0) > 0;
  const showTechDashboard = user?.role === Role.Technician || (!!empId && hasTechServices);

  const emp = (empRaw ?? {}) as AnyRec;
  const summary = (summaryRaw ?? {}) as AnyRec;
  const recentRecs = Array.isArray(recentRaw) ? recentRaw : [];
  const advances = Array.isArray(advancesRaw) ? advancesRaw : [];
  const deductions = Array.isArray(deductionsRaw) ? deductionsRaw : [];
  const bonuses = Array.isArray(bonusesRaw) ? bonusesRaw : [];
  const leaves = Array.isArray(leavesRaw) ? leavesRaw : [];
  const leavesBal = Array.isArray(leaveBalRaw) ? leaveBalRaw : [];
  const payslips = Array.isArray(payslipsRaw) ? payslipsRaw : [];

  const todayRec =
    Array.isArray(todayRecRaw) && todayRecRaw.length > 0 ? (todayRecRaw[0] as AnyRec) : null;
  const alreadyCheckedIn = !!todayRec?.check_in_time;
  const alreadyCheckedOut = !!todayRec?.check_out_time;

  const empName =
    [fmt(emp.first_name_ar), fmt(emp.last_name_ar)].filter((x) => x !== '—').join(' ') ||
    fmt(user?.username);
  const empCode = fmt(emp.employee_code);
  const empSalary = emp.salary ? fmtCurrency(emp.salary, fmt(emp.currency)) : '—';
  const empCurrency = fmt(emp.currency || 'EGP');
  const empHire = fmtDate(emp.hire_date, false);
  const empType =
    emp.employment_type === 'full_time'
      ? 'دوام كامل'
      : emp.employment_type === 'part_time'
        ? 'دوام جزئي'
        : fmt(emp.employment_type);

  /* ── Actions ── */
  async function doCheckIn() {
    if (!empId) return;
    setCheckingIn(true);
    try {
      const res = await authFetch('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ employee_id: empId }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({
        title: 'تم تسجيل الحضور ✓',
        description: `حضرت في ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
      });
      qc.invalidateQueries({ queryKey: ['portal-att-today'] });
      qc.invalidateQueries({ queryKey: ['portal-att-recent'] });
      qc.invalidateQueries({ queryKey: ['portal-summary'] });
    } catch (e) {
      toast({
        title: 'فشل تسجيل الحضور',
        description: e instanceof Error ? e.message : 'خطأ',
        variant: 'destructive',
      });
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
      toast({
        title: 'تم تسجيل الانصراف ✓',
        description: `انصرفت في ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
      });
      qc.invalidateQueries({ queryKey: ['portal-att-today'] });
      qc.invalidateQueries({ queryKey: ['portal-att-recent'] });
      qc.invalidateQueries({ queryKey: ['portal-summary'] });
    } catch (e) {
      toast({
        title: 'فشل تسجيل الانصراف',
        description: e instanceof Error ? e.message : 'خطأ',
        variant: 'destructive',
      });
    } finally {
      setCheckingOut(false);
    }
  }

  function deductLabel(t: string) {
    return { late: 'تأخر', absence: 'غياب', damage: 'تلف', other: 'أخرى' }[t] ?? t;
  }

  if (!empId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          flexDirection: 'column',
          gap: 12,
          color: textMuted,
        }}
      >
        <AlertCircle size={40} style={{ opacity: 0.4 }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>حسابك غير مرتبط بسجل موظف بعد</p>
        <p style={{ fontSize: 12 }}>تواصل مع المدير لربط حسابك بملف الموظف</p>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" style={{ background: bg, minHeight: '100%', color: textMain }}>
      {/* ── GREETING BANNER ── */}
      <div
        style={{
          borderRadius: 20,
          padding: '22px 24px',
          marginBottom: 22,
          position: 'relative',
          overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(8,14,26,0.98) 60%)'
            : 'linear-gradient(135deg, #fef3c7 0%, #fffdf0 60%)',
          border: `1px solid ${isDark ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.30)'}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 15,
              background: 'rgba(245,158,11,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <GreetIcon size={26} color="var(--status-warning)" />
          </div>
          <div>
            <p
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: isDark ? '#fcd34d' : 'var(--status-warning)',
                lineHeight: 1.2,
              }}
            >
              {greeting}، {empName}
            </p>
            <p style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>
              {new Date().toLocaleDateString('ar-EG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            {empCode !== '—' && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '7px 14px',
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <p style={{ fontSize: 10, color: textMuted }}>كود الموظف</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: isDark ? '#fcd34d' : 'var(--status-warning)' }}>
                  {empCode}
                </p>
              </div>
            )}
            {empSalary !== '—' && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '7px 14px',
                  borderRadius: 10,
                  background: isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.08)',
                }}
              >
                <p style={{ fontSize: 10, color: 'var(--status-success)' }}>الراتب</p>
                <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--status-success)' }}>{empSalary}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TECHNICIAN DASHBOARD — يظهر لـ role=technician أو لأي موظف عنده خدمات صيانة ── */}
      {showTechDashboard && (
        <TechnicianSections
          empId={user.id}
          isDark={isDark}
          textMain={textMain}
          textMuted={textMuted}
          cardBg={cardBg}
          border={border}
          currency={empCurrency}
        />
      )}

      {/* ── TODAY + JOB INFO ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* Today Attendance */}
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${border}`,
            background: cardBg,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(52,211,153,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-success)',
              }}
            >
              <UserCheck size={17} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>حضور اليوم</span>
            {todayLoading && (
              <Loader2 size={13} className="animate-spin" style={{ color: textMuted }} />
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: textMuted }}>الحضور</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: alreadyCheckedIn ? 'var(--status-success)' : textMuted,
                }}
              >
                {alreadyCheckedIn ? fmtTime(todayRec?.check_in_time) : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: textMuted }}>الانصراف</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: alreadyCheckedOut ? 'var(--status-danger)' : textMuted,
                }}
              >
                {alreadyCheckedOut ? fmtTime(todayRec?.check_out_time) : '—'}
              </span>
            </div>
            {alreadyCheckedIn && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: textMuted }}>المدة</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-info)' }}>
                  {calcDuration(todayRec?.check_in_time, todayRec?.check_out_time)}
                  {!alreadyCheckedOut && (
                    <span style={{ fontSize: 10, color: textMuted, marginRight: 4 }}>(جارٍ)</span>
                  )}
                </span>
              </div>
            )}
            {Boolean(todayRec?.status) && (
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 12, color: textMuted }}>الحالة</span>
                <AttBadge s={String(todayRec!.status)} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {!alreadyCheckedIn && (
              <button
                onClick={doCheckIn}
                disabled={checkingIn}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,#059669,#34d399)',
                  color: 'var(--text-1)',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: checkingIn ? 0.7 : 1,
                }}
              >
                {checkingIn ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                تسجيل الحضور
              </button>
            )}
            {alreadyCheckedIn && !alreadyCheckedOut && (
              <button
                onClick={doCheckOut}
                disabled={checkingOut}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg,#dc2626,#f87171)',
                  color: 'var(--text-1)',
                  fontWeight: 800,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: checkingOut ? 0.7 : 1,
                }}
              >
                {checkingOut ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LogOut size={13} />
                )}
                تسجيل الانصراف
              </button>
            )}
            {alreadyCheckedIn && alreadyCheckedOut && (
              <div
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 9,
                  textAlign: 'center',
                  background: 'rgba(52,211,153,0.09)',
                  color: 'var(--status-success)',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={13} /> تم تسجيل يوم العمل
              </div>
            )}
          </div>
        </div>

        {/* Job Info */}
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${border}`,
            background: cardBg,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'rgba(96,165,250,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--status-info)',
              }}
            >
              <Briefcase size={17} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>بيانات الوظيفة</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              {
                label: 'المسمى الوظيفي',
                value: fmt(emp.job_title_ar ?? emp.job_title_id),
                icon: <Briefcase size={11} />,
              },
              {
                label: 'القسم',
                value: fmt(emp.department_ar ?? emp.department_id),
                icon: <Building2 size={11} />,
              },
              {
                label: 'الفرع',
                value: fmt(emp.branch_ar ?? emp.branch_id),
                icon: <MapPin size={11} />,
              },
              { label: 'تاريخ التعيين', value: empHire, icon: <Calendar size={11} /> },
              { label: 'نوع التوظيف', value: empType, icon: <Users size={11} /> },
            ]
              .filter((x) => x.value !== '—')
              .map(({ label, value, icon }) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: textMuted,
                    }}
                  >
                    {icon}
                    {label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── MONTHLY SUMMARY ── */}
      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${border}`,
          background: cardBg,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'rgba(167,139,250,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--status-info)',
            }}
          >
            <Calendar size={17} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>
            ملخص{' '}
            {new Date(currentMonth + '-01').toLocaleDateString('ar-EG', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatCard
            label="حاضر"
            value={Number(summary.present_days ?? 0)}
            icon={<CheckCircle2 size={15} />}
            color="var(--status-success)"
            bg="rgba(52,211,153,0.10)"
          />
          <StatCard
            label="غائب"
            value={Number(summary.absent_days ?? 0)}
            icon={<XCircle size={15} />}
            color="var(--status-danger)"
            bg="rgba(248,113,113,0.10)"
          />
          <StatCard
            label="تأخر"
            value={Number(summary.late_days ?? 0)}
            icon={<AlertCircle size={15} />}
            color="var(--status-warning)"
            bg="rgba(251,191,36,0.10)"
          />
          <StatCard
            label="إجازة"
            value={Number(summary.leave_days ?? 0)}
            icon={<Calendar size={15} />}
            color="var(--status-info)"
            bg="rgba(96,165,250,0.10)"
          />
          <StatCard
            label="ساعات"
            value={`${Number(summary.total_hours ?? 0).toFixed(0)}س`}
            icon={<Clock size={15} />}
            color="var(--status-info)"
            bg="rgba(167,139,250,0.10)"
          />
        </div>
      </div>

      {/* ── SALARY ADVANCES ── */}
      <SectionCard
        icon={<Wallet size={17} />}
        title={`السلف والمصروفات (${advances.length})`}
        accent="var(--status-warning)"
        isDark={isDark}
        border={border}
        cardBg={cardBg}
        actions={
          <button
            onClick={() => setShowAdvanceModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg,#b45309,#f59e0b)',
              color: 'var(--text-1)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <PlusCircle size={13} /> طلب سلفة
          </button>
        }
      >
        {advances.length === 0 ? (
          <p style={{ fontSize: 13, color: textMuted, textAlign: 'center', padding: '12px 0' }}>
            لا توجد سلف مسجلة
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {advances.map((a, i) => (
              <div
                key={(a as { id?: number }).id ?? `adv-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 13px',
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                  border: `1px solid ${border}`,
                }}
              >
                <Wallet size={13} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {fmtCurrency(a.approved_amount ?? a.requested_amount, fmt(a.currency))}
                    </span>
                    <StatusBadge s={String(a.status ?? '')} map={ADVANCE_STATUS} />
                  </div>
                  <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                    {fmtDate(a.requested_date, false)}
                    {a.reason ? ` · ${fmt(a.reason)}` : ''}
                  </p>
                </div>
                {Boolean(a.remaining_balance) && Number(a.remaining_balance) > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: textMuted }}>المتبقي</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-warning)' }}>
                      {fmtCurrency(a.remaining_balance, fmt(a.currency))}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── DEDUCTIONS ── */}
      <SectionCard
        icon={<TrendingDown size={17} />}
        title={`الخصومات (${deductions.length})`}
        accent="var(--status-danger)"
        isDark={isDark}
        border={border}
        cardBg={cardBg}
      >
        {deductions.length === 0 ? (
          <p style={{ fontSize: 13, color: textMuted, textAlign: 'center', padding: '12px 0' }}>
            لا توجد خصومات
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deductions.map((d, i) => (
              <div
                key={(d as { id?: number }).id ?? `ded-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 13px',
                  borderRadius: 10,
                  background: 'rgba(248,113,113,0.05)',
                  border: '1px solid rgba(248,113,113,0.14)',
                }}
              >
                <TrendingDown size={13} style={{ color: 'var(--status-danger)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-danger)' }}>
                      -{fmtCurrency(d.amount, fmt(d.currency))}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 5,
                        background: 'rgba(248,113,113,0.12)',
                        color: 'var(--status-danger)',
                        fontWeight: 600,
                      }}
                    >
                      {deductLabel(String(d.deduction_type ?? ''))}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                    {fmtDate(d.deduction_date, false)}
                    {d.reason ? ` · ${fmt(d.reason)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── BONUSES ── */}
      <SectionCard
        icon={<Gift size={17} />}
        title={`الحوافز والمكافآت (${bonuses.length})`}
        accent="var(--status-success)"
        isDark={isDark}
        border={border}
        cardBg={cardBg}
      >
        {bonuses.length === 0 ? (
          <p style={{ fontSize: 13, color: textMuted, textAlign: 'center', padding: '12px 0' }}>
            لا توجد حوافز
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bonuses.map((b, i) => (
              <div
                key={(b as { id?: number }).id ?? `bon-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 13px',
                  borderRadius: 10,
                  background: 'rgba(52,211,153,0.05)',
                  border: '1px solid rgba(52,211,153,0.14)',
                }}
              >
                <Gift size={13} style={{ color: 'var(--status-success)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-success)' }}>
                    +{fmtCurrency(b.amount, fmt(b.currency))}
                  </span>
                  <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                    {fmtDate(b.granted_date, false)}
                    {b.reason ? ` · ${fmt(b.reason)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── LEAVE REQUESTS ── */}
      <SectionCard
        icon={<FileText size={17} />}
        title={`طلبات الإجازة (${leaves.length})`}
        accent="var(--status-info)"
        isDark={isDark}
        border={border}
        cardBg={cardBg}
      >
        {leavesBal.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 9,
              flexWrap: 'wrap',
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: `1px solid ${border}`,
            }}
          >
            {leavesBal.map((lb, i) => (
              <div
                key={String((lb as { leave_type_code?: string }).leave_type_code ?? i)}
                style={{
                  borderRadius: 10,
                  padding: '7px 13px',
                  background: 'rgba(96,165,250,0.08)',
                  border: '1px solid rgba(96,165,250,0.15)',
                }}
              >
                <p style={{ fontSize: 10, color: 'var(--status-info)', fontWeight: 600, marginBottom: 1 }}>
                  {fmt(lb.leave_type_name_ar ?? lb.leave_type_code)}
                </p>
                <p style={{ fontSize: 16, fontWeight: 900, color: 'var(--status-info)' }}>
                  {Number(lb.balance_days ?? 0).toFixed(0)} يوم
                </p>
                <p style={{ fontSize: 10, color: textMuted }}>رصيد متاح</p>
              </div>
            ))}
          </div>
        )}
        {leaves.length === 0 ? (
          <p style={{ fontSize: 13, color: textMuted, textAlign: 'center', padding: '12px 0' }}>
            لا توجد طلبات إجازة
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaves.map((l, i) => (
              <div
                key={(l as { id?: number }).id ?? `leave-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 13px',
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                  border: `1px solid ${border}`,
                }}
              >
                <FileText size={13} style={{ color: 'var(--status-info)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                      {fmtDate(l.start_date, false)} — {fmtDate(l.end_date, false)}
                    </span>
                    <span style={{ fontSize: 11, color: textMuted }}>
                      ({Number(l.total_days ?? 0)} يوم)
                    </span>
                    <StatusBadge s={String(l.status ?? '')} map={LEAVE_STATUS} />
                  </div>
                  {Boolean(l.reason) && (
                    <p style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{fmt(l.reason)}</p>
                  )}
                  {Boolean(l.rejection_reason) && (
                    <p style={{ fontSize: 11, color: 'var(--status-danger)', marginTop: 2 }}>
                      سبب الرفض: {fmt(l.rejection_reason)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── PAYSLIPS ── */}
      <SectionCard
        icon={<Wallet size={17} />}
        title={`قسائم الرواتب (${payslips.length})`}
        accent="var(--status-success)"
        isDark={isDark}
        border={border}
        cardBg={cardBg}
        defaultOpen={false}
      >
        {payslips.length === 0 ? (
          <p style={{ fontSize: 13, color: textMuted, textAlign: 'center', padding: '12px 0' }}>
            لا توجد قسائم رواتب
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payslips.map((p, i) => (
              <div
                key={(p as { id?: number }).id ?? `payslip-${i}`}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  padding: '12px 14px',
                  background: isDark ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800 }}>
                    {String(p.period_name ?? `فترة ${i + 1}`)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 20,
                      background:
                        String(p.status) === 'approved'
                          ? 'rgba(52,211,153,0.2)'
                          : 'rgba(251,191,36,0.2)',
                      color: String(p.status) === 'approved' ? 'var(--status-success)' : 'var(--status-warning)',
                      fontWeight: 700,
                    }}
                  >
                    {String(p.status) === 'approved'
                      ? 'معتمد'
                      : String(p.status) === 'processed'
                        ? 'محلول'
                        : 'مسودة'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {[
                    {
                      label: 'الإجمالي',
                      value: fmtCurrency(p.gross_salary, String(p.currency ?? empCurrency)),
                    },
                    {
                      label: 'الخصومات',
                      value: fmtCurrency(p.total_deductions, String(p.currency ?? empCurrency)),
                    },
                    {
                      label: 'الحوافز',
                      value: fmtCurrency(p.incentive_amount, String(p.currency ?? empCurrency)),
                    },
                    {
                      label: 'صافي الراتب',
                      value: fmtCurrency(p.net_salary, String(p.currency ?? empCurrency)),
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span style={{ fontSize: 10, color: textMuted }}>{label}</span>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── ATTENDANCE HISTORY (collapsed by default) ── */}
      <SectionCard
        icon={<RotateCcw size={17} />}
        title="سجل الحضور والانصراف (30 يوم)"
        accent="var(--status-info)"
        isDark={isDark}
        border={border}
        cardBg={cardBg}
        defaultOpen={false}
      >
        {recentRecs.length === 0 ? (
          <p style={{ fontSize: 13, color: textMuted, textAlign: 'center', padding: '12px 0' }}>
            لا توجد سجلات
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  {['التاريخ', 'الحضور', 'الانصراف', 'المدة', 'الحالة'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '7px 10px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: textMuted,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...recentRecs].reverse().map((rec, i) => (
                  <tr
                    key={(rec as { id?: number }).id ?? `att-${rec.date ?? i}`}
                    style={{
                      borderTop: `1px solid ${border}`,
                      background:
                        i % 2 === 0
                          ? 'transparent'
                          : isDark
                            ? 'rgba(255,255,255,0.012)'
                            : 'rgba(0,0,0,0.012)',
                    }}
                  >
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {fmtDate(rec.date)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        color: 'var(--status-success)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtTime(rec.check_in_time)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        color: 'var(--status-danger)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtTime(rec.check_out_time)}
                    </td>
                    <td
                      style={{
                        padding: '7px 10px',
                        color: 'var(--status-info)',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {calcDuration(rec.check_in_time, rec.check_out_time)}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <AttBadge s={String(rec.status ?? '')} />
                    </td>
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
          empId={empId}
          currency={empCurrency}
          isDark={isDark}
          border={border}
          onClose={() => setShowAdvanceModal(false)}
        />
      )}
    </div>
  );
}
