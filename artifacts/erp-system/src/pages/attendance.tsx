import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { TableSkeleton } from '@/components/skeletons';
import {
  Clock,
  Plus,
  X,
  Sun,
  AlarmClock,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Timer,
  Settings,
  Calculator,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

type AnyRec = Record<string, unknown>;

function statusBadge(s: string) {
  switch (s) {
    case 'present':
      return 'erp-badge erp-badge-success';
    case 'late':
      return 'erp-badge erp-badge-warning';
    case 'absent':
      return 'erp-badge erp-badge-danger';
    case 'on_leave':
      return 'erp-badge erp-badge-info';
    case 'holiday':
      return 'erp-badge erp-badge-pending';
    default:
      return 'erp-badge erp-badge-neutral';
  }
}
function statusAr(s: string) {
  const m: Record<string, string> = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    on_leave: 'إجازة',
    holiday: 'إجازة رسمية',
    weekend: 'عطلة',
  };
  return m[s] ?? s;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, 'can_manage_attendance');

  const today = new Date().toISOString().split('T')[0]!;
  const [activeTab, setActiveTab] = useState('records');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0]!;
  });
  const [to, setTo] = useState(() => today);
  const [empSearch, setEmpSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showEditRecord, setShowEditRecord] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [showOTForm, setShowOTForm] = useState(false);
  const [showDedSettings, setShowDedSettings] = useState(false);
  const [showDedCalc, setShowDedCalc] = useState(false);

  // Form states
  const [checkInForm, setCheckInForm] = useState({
    employee_id: '',
    attendance_date: today,
    check_in_time: '',
    notes: '',
  });
  const [checkOutForm, setCheckOutForm] = useState({
    employee_id: '',
    attendance_date: today,
    check_out_time: '',
  });
  const [editForm, setEditForm] = useState<{
    id: number;
    check_in_time: string;
    check_out_time: string;
    status: string;
    notes: string;
    working_hours: string;
  } | null>(null);
  const [shiftForm, setShiftForm] = useState({
    name_ar: '',
    name_en: '',
    start_time: '09:00',
    end_time: '17:00',
    break_duration: '60',
    grace_minutes: '5',
    weekly_hours: '40',
  });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', name_ar: '', name_en: '' });
  const [otForm, setOtForm] = useState({ employee_id: '', date: today, hours: '', reason: '' });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(api(url), opts);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(((d as AnyRec).error as string) || 'خطأ');
    }
    return r.json();
  }, []);

  const params = new URLSearchParams({ from, to });
  if (statusFilter) params.set('status', statusFilter);

  const records = useQuery({
    queryKey: ['attendance', from, to, statusFilter],
    queryFn: () => f(`/api/attendance/records?${params}`),
  });
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: () => f('/api/shifts') });
  const holidays = useQuery({
    queryKey: ['public-holidays'],
    queryFn: () => f('/api/public-holidays'),
  });
  const overtime = useQuery({
    queryKey: ['overtime'],
    queryFn: () => f('/api/attendance/overtime'),
  });
  const employees = useQuery({
    queryKey: ['employees-list'],
    queryFn: () => f('/api/employees?limit=500'),
  });
  const dedSettings = useQuery({
    queryKey: ['att-ded-settings'],
    queryFn: () => f('/api/attendance-deductions/settings'),
  });
  const dedTiers = useQuery({
    queryKey: ['att-ded-tiers'],
    queryFn: () => f('/api/attendance-deductions/tiers'),
  });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const doCheckIn = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts(['attendance', from, to, statusFilter], 'تم تسجيل الحضور'),
  });
  const doCheckOut = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts(['attendance', from, to, statusFilter], 'تم تسجيل الانصراف'),
  });
  const doEditRecord = useMutation({
    mutationFn: (d: AnyRec) =>
      f(`/api/attendance/records/${(d as AnyRec).id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts(['attendance', from, to, statusFilter], 'تم تعديل السجل'),
  });
  const createShift = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('shifts', 'تم إنشاء الوردية'),
  });
  const deleteShift = useMutation({
    mutationFn: (id: number) => f(`/api/shifts/${id}`, { method: 'DELETE' }),
    ...mutOpts('shifts', 'تم حذف الوردية'),
  });
  const createHoliday = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/public-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('public-holidays', 'تم إضافة الإجازة الرسمية'),
  });
  const deleteHoliday = useMutation({
    mutationFn: (id: number) => f(`/api/public-holidays/${id}`, { method: 'DELETE' }),
    ...mutOpts('public-holidays', 'تم حذف الإجازة'),
  });
  const createOT = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/attendance/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('overtime', 'تم تسجيل العمل الإضافي'),
  });

  const saveDedSettings = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/attendance-deductions/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    ...mutOpts('att-ded-settings', 'تم حفظ إعدادات الخصومات'),
  });
  const saveTiers = useMutation({
    mutationFn: (tiers: AnyRec[]) =>
      f('/api/attendance-deductions/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      }),
    ...mutOpts('att-ded-tiers', 'تم حفظ شرائح الخصم'),
  });
  const previewDed = useMutation({
    mutationFn: (d: AnyRec) =>
      f('/api/attendance-deductions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      }),
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });
  const applyDed = useMutation({
    mutationFn: (items: AnyRec[]) =>
      f('/api/attendance-deductions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }),
    onSuccess: (r: AnyRec) => {
      qc.invalidateQueries({ queryKey: ['employee-deductions'] });
      toast({
        title: `تم حفظ ${r['inserted']} خصم${Number(r['skipped']) > 0 ? ` (تم تجاهل ${r['skipped']} مكرر)` : ''}`,
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  const allRecords = safeArray(records.data);
  const shiftsList = safeArray(shifts.data);
  const holidaysList = safeArray(holidays.data);
  const overtimeList = safeArray(overtime.data);
  const empList = safeArray(employees.data);

  // Filter records by employee name search
  const recordsList = empSearch
    ? allRecords.filter((r) => {
        const name = `${r.first_name_ar ?? ''} ${r.last_name_ar ?? ''}`;
        return name.includes(empSearch) || String(r.employee_code ?? '').includes(empSearch);
      })
    : allRecords;

  const present = allRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absent = allRecords.filter((r) => r.status === 'absent').length;
  const late = allRecords.filter((r) => r.status === 'late').length;
  const totalHours = allRecords.reduce((s, r) => s + (Number(r.working_hours) || 0), 0);

  const TABS = [
    { key: 'records', label: 'سجلات الحضور', icon: Clock },
    { key: 'shifts', label: 'الورديات', icon: AlarmClock },
    { key: 'overtime', label: 'العمل الإضافي', icon: Timer },
    { key: 'holidays', label: 'الإجازات الرسمية', icon: Sun },
  ] as const;

  function openCheckOut(rec: AnyRec) {
    setCheckOutForm({
      employee_id: String(rec.employee_id),
      attendance_date: String(rec.attendance_date),
      check_out_time: new Date().toTimeString().substring(0, 5),
    });
    setShowCheckOut(true);
  }
  function openEdit(rec: AnyRec) {
    setEditForm({
      id: Number(rec.id),
      check_in_time: String(rec.check_in_time ?? ''),
      check_out_time: String(rec.check_out_time ?? ''),
      status: String(rec.status),
      notes: String(rec.notes ?? ''),
      working_hours: String(rec.working_hours ?? ''),
    });
    setShowEditRecord(true);
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">الحضور والانصراف</h1>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowCheckIn(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <LogIn size={14} /> تسجيل حضور
            </button>
            <button
              onClick={() => setShowCheckOut(true)}
              className="erp-btn erp-btn-secondary flex items-center gap-1 text-sm"
            >
              <LogOut size={14} /> تسجيل انصراف
            </button>
            <button
              onClick={() => setShowDedCalc(true)}
              className="erp-btn erp-btn-secondary flex items-center gap-1 text-sm"
              title="احتساب خصومات الشهر تلقائياً"
            >
              <Calculator size={14} /> احتساب خصومات
            </button>
            <button
              onClick={() => setShowDedSettings(true)}
              className="erp-btn erp-btn-ghost flex items-center gap-1 text-sm"
              title="إعدادات شرائح الخصم"
            >
              <Settings size={14} /> إعدادات الخصم
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي السجلات', val: allRecords.length, color: 'text-white' },
          { label: 'حاضر', val: present, color: 'text-emerald-300' },
          { label: 'غائب', val: absent, color: 'text-red-400' },
          { label: 'متأخر', val: late, color: 'text-amber-300' },
        ].map((s) => (
          <div key={s.label} className="erp-card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-400' : 'text-white/50 hover:text-white/80'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── سجلات الحضور ── */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">من:</label>
              <input
                type="date"
                className="erp-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">إلى:</label>
              <input
                type="date"
                className="erp-input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <input
              className="erp-input"
              placeholder="بحث بالاسم أو الرمز"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
            />
            <select
              className="erp-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">كل الحالات</option>
              <option value="present">حاضر</option>
              <option value="late">متأخر</option>
              <option value="absent">غائب</option>
              <option value="on_leave">إجازة</option>
              <option value="holiday">إجازة رسمية</option>
            </select>
          </div>

          {/* Summary row */}
          <div className="text-xs text-white/40 flex gap-4">
            <span>
              إجمالي ساعات العمل:{' '}
              <span className="text-amber-300 font-bold">{totalHours.toFixed(1)} س</span>
            </span>
            <span>
              السجلات الظاهرة: <span className="text-white/60">{recordsList.length}</span>
            </span>
          </div>

          <div className="erp-card overflow-x-auto">
            {records.isLoading ? (
              <TableSkeleton />
            ) : recordsList.length === 0 ? (
              <div className="erp-empty-state">
                <Clock size={36} className="erp-empty-icon mb-2" />
                <p className="erp-empty-label">لا توجد سجلات حضور للفترة المحددة</p>
              </div>
            ) : (
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">الموظف</th>
                    <th className="p-3 text-right text-xs">التاريخ</th>
                    <th className="p-3 text-right text-xs">الحضور</th>
                    <th className="p-3 text-right text-xs">الانصراف</th>
                    <th className="p-3 text-right text-xs">ساعات</th>
                    <th className="p-3 text-right text-xs">تأخير</th>
                    <th className="p-3 text-right text-xs">الحالة</th>
                    {canManage && <th className="p-3 text-right text-xs">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {recordsList.map((r) => (
                    <tr key={String(r.id)} className="erp-table-row">
                      <td className="p-3 text-sm">
                        {String(r.first_name_ar ?? '')} {String(r.last_name_ar ?? '')}
                        <span className="text-white/30 text-xs mr-1">
                          {String(r.employee_code ?? '')}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-white/60 font-mono">
                        {String(r.attendance_date)}
                      </td>
                      <td className="p-3 text-sm text-emerald-300 font-mono">
                        {r.check_in_time ? String(r.check_in_time).substring(0, 5) : '—'}
                      </td>
                      <td className="p-3 text-sm text-red-400 font-mono">
                        {r.check_out_time ? String(r.check_out_time).substring(0, 5) : '—'}
                      </td>
                      <td className="p-3 text-sm font-mono">
                        {r.working_hours ? `${Number(r.working_hours).toFixed(1)}س` : '—'}
                      </td>
                      <td className="p-3 text-sm text-amber-300 font-mono">
                        {r.late_minutes ? `${r.late_minutes}د` : '—'}
                      </td>
                      <td className="p-3">
                        <span className={statusBadge(String(r.status))}>
                          {statusAr(String(r.status))}
                        </span>
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <div className="flex gap-1">
                            {r.check_in_time && !r.check_out_time && (
                              <button
                                onClick={() => openCheckOut(r)}
                                title="تسجيل انصراف"
                                className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              >
                                <LogOut size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(r)}
                              title="تعديل"
                              className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── الورديات ── */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowShiftForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> إنشاء وردية
            </button>
          )}
          {shifts.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shiftsList.map((s) => (
                <div key={String(s.id)} className="erp-card">
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-sm">{String(s.name_ar)}</div>
                    {canManage && (
                      <button
                        onClick={() => {
                          if (confirm('هل تريد حذف هذه الوردية؟')) deleteShift.mutate(Number(s.id));
                        }}
                        className="p-1 text-red-400/60 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="text-emerald-300 font-mono">▶ {String(s.start_time)}</span>
                    <span className="text-red-400 font-mono">■ {String(s.end_time)}</span>
                  </div>
                  <div className="text-xs text-white/40 mt-2">
                    استراحة: {Number(s.break_duration)} د • فترة السماح: {Number(s.grace_minutes)} د
                    • {Number(s.weekly_hours)} س/أسبوع
                  </div>
                </div>
              ))}
              {shiftsList.length === 0 && (
                <div className="erp-card col-span-3">
                  <div className="erp-empty-state">
                    <AlarmClock size={36} className="erp-empty-icon mb-2" />
                    <p className="erp-empty-label">لا توجد ورديات</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── العمل الإضافي ── */}
      {activeTab === 'overtime' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowOTForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> تسجيل عمل إضافي
            </button>
          )}
          <div className="erp-card overflow-x-auto">
            {overtime.isLoading ? (
              <TableSkeleton />
            ) : (
              <table className="erp-table w-full">
                <thead>
                  <tr className="erp-table-header">
                    <th className="p-3 text-right text-xs">الموظف</th>
                    <th className="p-3 text-right text-xs">التاريخ</th>
                    <th className="p-3 text-right text-xs">الساعات</th>
                    <th className="p-3 text-right text-xs">السبب</th>
                    <th className="p-3 text-right text-xs">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {overtimeList.map((o) => (
                    <tr key={String(o.id)} className="erp-table-row">
                      <td className="p-3 text-sm">
                        {String(o.first_name_ar ?? '')} {String(o.last_name_ar ?? '')}
                      </td>
                      <td className="p-3 text-sm text-white/60 font-mono">{String(o.date)}</td>
                      <td className="p-3 text-sm text-amber-300 font-bold font-mono">
                        {Number(o.hours).toFixed(1)} ساعة
                      </td>
                      <td className="p-3 text-sm text-white/60">{String(o.reason ?? '—')}</td>
                      <td className="p-3">
                        <span className="erp-badge erp-badge-success">معتمد</span>
                      </td>
                    </tr>
                  ))}
                  {overtimeList.length === 0 && !overtime.isLoading && (
                    <tr>
                      <td colSpan={5} className="py-12">
                        <div className="erp-empty-state">
                          <Timer size={28} className="erp-empty-icon mb-2" />
                          <p className="erp-empty-label">لا توجد سجلات عمل إضافي</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── الإجازات الرسمية ── */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          {canManage && (
            <button
              onClick={() => setShowHolidayForm(true)}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> إضافة إجازة رسمية
            </button>
          )}
          {holidays.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {holidaysList.map((h) => (
                <div key={String(h.id)} className="erp-card flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                    {String(h.holiday_date).substring(8, 10)}
                    <br />
                    <span className="text-xs">{String(h.holiday_date).substring(5, 7)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{String(h.name_ar)}</div>
                    <div className="text-xs text-white/40 font-mono">{String(h.holiday_date)}</div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => {
                        if (confirm('هل تريد حذف هذه الإجازة؟')) deleteHoliday.mutate(Number(h.id));
                      }}
                      className="p-1.5 text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {holidaysList.length === 0 && (
                <div className="erp-card col-span-3">
                  <div className="erp-empty-state">
                    <Sun size={36} className="erp-empty-icon mb-2" />
                    <p className="erp-empty-label">لا توجد إجازات رسمية</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* تسجيل حضور */}
      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <LogIn size={16} className="text-emerald-400" /> تسجيل حضور
              </h2>
              <button
                onClick={() => setShowCheckIn(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الموظف *">
                <select
                  className="erp-input w-full"
                  value={checkInForm.employee_id}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">اختر الموظف</option>
                  {empList.map((e) => (
                    <option key={String(e.id)} value={String(e.id)}>
                      {String(e.first_name_ar)} {String(e.last_name_ar)} — {String(e.employee_code)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ">
                  <input
                    type="date"
                    value={checkInForm.attendance_date}
                    onChange={(e) =>
                      setCheckInForm((p) => ({ ...p, attendance_date: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="وقت الحضور">
                  <input
                    type="time"
                    value={checkInForm.check_in_time}
                    onChange={(e) =>
                      setCheckInForm((p) => ({ ...p, check_in_time: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
              </div>
              <Field label="ملاحظات">
                <input
                  value={checkInForm.notes}
                  onChange={(e) => setCheckInForm((p) => ({ ...p, notes: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="اختياري"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  if (!checkInForm.employee_id) {
                    toast({ title: 'يرجى اختيار الموظف', variant: 'destructive' });
                    return;
                  }
                  doCheckIn.mutate(
                    {
                      ...checkInForm,
                      attendance_date: checkInForm.attendance_date || today,
                      check_in_time:
                        checkInForm.check_in_time || new Date().toTimeString().substring(0, 5),
                    },
                    {
                      onSuccess: () => {
                        setShowCheckIn(false);
                        setCheckInForm({
                          employee_id: '',
                          attendance_date: today,
                          check_in_time: '',
                          notes: '',
                        });
                      },
                    }
                  );
                }}
                disabled={doCheckIn.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {doCheckIn.isPending ? 'جاري التسجيل...' : 'تسجيل'}
              </button>
              <button onClick={() => setShowCheckIn(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تسجيل انصراف */}
      {showCheckOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <LogOut size={16} className="text-red-400" /> تسجيل انصراف
              </h2>
              <button
                onClick={() => setShowCheckOut(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الموظف *">
                <select
                  className="erp-input w-full"
                  value={checkOutForm.employee_id}
                  onChange={(e) => setCheckOutForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">اختر الموظف</option>
                  {empList.map((e) => (
                    <option key={String(e.id)} value={String(e.id)}>
                      {String(e.first_name_ar)} {String(e.last_name_ar)} — {String(e.employee_code)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ">
                  <input
                    type="date"
                    value={checkOutForm.attendance_date}
                    onChange={(e) =>
                      setCheckOutForm((p) => ({ ...p, attendance_date: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="وقت الانصراف">
                  <input
                    type="time"
                    value={checkOutForm.check_out_time}
                    onChange={(e) =>
                      setCheckOutForm((p) => ({ ...p, check_out_time: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  if (!checkOutForm.employee_id) {
                    toast({ title: 'يرجى اختيار الموظف', variant: 'destructive' });
                    return;
                  }
                  doCheckOut.mutate(
                    { ...checkOutForm },
                    {
                      onSuccess: () => {
                        setShowCheckOut(false);
                        setCheckOutForm({
                          employee_id: '',
                          attendance_date: today,
                          check_out_time: '',
                        });
                      },
                    }
                  );
                }}
                disabled={doCheckOut.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {doCheckOut.isPending ? 'جاري التسجيل...' : 'تسجيل'}
              </button>
              <button onClick={() => setShowCheckOut(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تعديل سجل */}
      {showEditRecord && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Pencil size={16} className="text-amber-400" /> تعديل سجل الحضور
              </h2>
              <button
                onClick={() => setShowEditRecord(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت الحضور">
                  <input
                    type="time"
                    value={editForm.check_in_time}
                    onChange={(e) =>
                      setEditForm((p) => (p ? { ...p, check_in_time: e.target.value } : p))
                    }
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="وقت الانصراف">
                  <input
                    type="time"
                    value={editForm.check_out_time}
                    onChange={(e) =>
                      setEditForm((p) => (p ? { ...p, check_out_time: e.target.value } : p))
                    }
                    className="erp-input w-full"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الحالة">
                  <select
                    className="erp-input w-full"
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => (p ? { ...p, status: e.target.value } : p))}
                  >
                    <option value="present">حاضر</option>
                    <option value="late">متأخر</option>
                    <option value="absent">غائب</option>
                    <option value="on_leave">إجازة</option>
                    <option value="holiday">إجازة رسمية</option>
                  </select>
                </Field>
                <Field label="ساعات العمل">
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.working_hours}
                    onChange={(e) =>
                      setEditForm((p) => (p ? { ...p, working_hours: e.target.value } : p))
                    }
                    className="erp-input w-full"
                  />
                </Field>
              </div>
              <Field label="ملاحظات">
                <input
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => (p ? { ...p, notes: e.target.value } : p))}
                  className="erp-input w-full"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  doEditRecord.mutate(
                    {
                      ...editForm,
                      working_hours: editForm.working_hours
                        ? Number(editForm.working_hours)
                        : undefined,
                    },
                    {
                      onSuccess: () => {
                        setShowEditRecord(false);
                        setEditForm(null);
                      },
                    }
                  );
                }}
                disabled={doEditRecord.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {doEditRecord.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setShowEditRecord(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* وردية جديدة */}
      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <AlarmClock size={16} className="text-amber-400" /> وردية جديدة
              </h2>
              <button
                onClick={() => setShowShiftForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="اسم الوردية *">
                <input
                  value={shiftForm.name_ar}
                  onChange={(e) => setShiftForm((p) => ({ ...p, name_ar: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="الوردية الصباحية"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت البداية">
                  <input
                    type="time"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="وقت النهاية">
                  <input
                    type="time"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="erp-input w-full"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="الاستراحة (د)">
                  <input
                    type="number"
                    value={shiftForm.break_duration}
                    onChange={(e) =>
                      setShiftForm((p) => ({ ...p, break_duration: e.target.value }))
                    }
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="السماح (د)">
                  <input
                    type="number"
                    value={shiftForm.grace_minutes}
                    onChange={(e) => setShiftForm((p) => ({ ...p, grace_minutes: e.target.value }))}
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="س/أسبوع">
                  <input
                    type="number"
                    value={shiftForm.weekly_hours}
                    onChange={(e) => setShiftForm((p) => ({ ...p, weekly_hours: e.target.value }))}
                    className="erp-input w-full"
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createShift.mutate(shiftForm, {
                    onSuccess: () => {
                      setShowShiftForm(false);
                      setShiftForm({
                        name_ar: '',
                        name_en: '',
                        start_time: '09:00',
                        end_time: '17:00',
                        break_duration: '60',
                        grace_minutes: '5',
                        weekly_hours: '40',
                      });
                    },
                  });
                }}
                disabled={createShift.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createShift.isPending ? 'جاري...' : 'إنشاء'}
              </button>
              <button onClick={() => setShowShiftForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* إجازة رسمية جديدة */}
      {showHolidayForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Sun size={16} className="text-amber-400" /> إجازة رسمية جديدة
              </h2>
              <button
                onClick={() => setShowHolidayForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="التاريخ *">
                <input
                  type="date"
                  value={holidayForm.holiday_date}
                  onChange={(e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value }))}
                  className="erp-input w-full"
                  required
                />
              </Field>
              <Field label="اسم الإجازة *">
                <input
                  value={holidayForm.name_ar}
                  onChange={(e) => setHolidayForm((p) => ({ ...p, name_ar: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="عيد الفطر"
                  required
                />
              </Field>
              <Field label="Holiday Name">
                <input
                  value={holidayForm.name_en}
                  onChange={(e) => setHolidayForm((p) => ({ ...p, name_en: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="Eid Al-Fitr"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  createHoliday.mutate(holidayForm, {
                    onSuccess: () => {
                      setShowHolidayForm(false);
                      setHolidayForm({ holiday_date: '', name_ar: '', name_en: '' });
                    },
                  });
                }}
                disabled={createHoliday.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createHoliday.isPending ? 'جاري...' : 'إضافة'}
              </button>
              <button onClick={() => setShowHolidayForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* عمل إضافي */}
      {showOTForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Timer size={16} className="text-amber-400" /> تسجيل عمل إضافي
              </h2>
              <button
                onClick={() => setShowOTForm(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الموظف *">
                <select
                  className="erp-input w-full"
                  value={otForm.employee_id}
                  onChange={(e) => setOtForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">اختر الموظف</option>
                  {empList.map((e) => (
                    <option key={String(e.id)} value={String(e.id)}>
                      {String(e.first_name_ar)} {String(e.last_name_ar)} — {String(e.employee_code)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ">
                  <input
                    type="date"
                    value={otForm.date}
                    onChange={(e) => setOtForm((p) => ({ ...p, date: e.target.value }))}
                    className="erp-input w-full"
                  />
                </Field>
                <Field label="عدد الساعات">
                  <input
                    type="number"
                    step="0.5"
                    value={otForm.hours}
                    onChange={(e) => setOtForm((p) => ({ ...p, hours: e.target.value }))}
                    className="erp-input w-full"
                    placeholder="2.5"
                  />
                </Field>
              </div>
              <Field label="السبب">
                <input
                  value={otForm.reason}
                  onChange={(e) => setOtForm((p) => ({ ...p, reason: e.target.value }))}
                  className="erp-input w-full"
                  placeholder="اختياري"
                />
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button
                onClick={() => {
                  if (!otForm.employee_id || !otForm.hours) {
                    toast({ title: 'يرجى اختيار الموظف وتحديد الساعات', variant: 'destructive' });
                    return;
                  }
                  createOT.mutate(
                    {
                      employee_id: Number(otForm.employee_id),
                      date: otForm.date,
                      hours: Number(otForm.hours),
                      reason: otForm.reason || null,
                    },
                    {
                      onSuccess: () => {
                        setShowOTForm(false);
                        setOtForm({ employee_id: '', date: today, hours: '', reason: '' });
                      },
                    }
                  );
                }}
                disabled={createOT.isPending}
                className="erp-btn erp-btn-primary flex-1"
              >
                {createOT.isPending ? 'جاري...' : 'تسجيل'}
              </button>
              <button onClick={() => setShowOTForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ إعدادات الخصم ═══ */}
      {showDedSettings && canManage && (
        <DeductionSettingsModal
          settings={dedSettings.data as AnyRec | undefined}
          tiers={safeArray(dedTiers.data)}
          onClose={() => setShowDedSettings(false)}
          onSaveSettings={(s) => saveDedSettings.mutate(s)}
          onSaveTiers={(t) => saveTiers.mutate(t)}
          savingSettings={saveDedSettings.isPending}
          savingTiers={saveTiers.isPending}
        />
      )}

      {/* ═══ احتساب خصومات الشهر ═══ */}
      {showDedCalc && canManage && (
        <DeductionCalcModal
          employees={empList}
          today={today}
          onClose={() => {
            setShowDedCalc(false);
            previewDed.reset();
          }}
          onPreview={(month, employee_id) => previewDed.mutate({ month, employee_id })}
          previewData={previewDed.data as AnyRec | undefined}
          previewing={previewDed.isPending}
          onApply={(items) =>
            applyDed.mutate(items, {
              onSuccess: () => {
                setShowDedCalc(false);
                previewDed.reset();
                qc.invalidateQueries({ queryKey: ['employee-deductions'] });
              },
            })
          }
          applying={applyDed.isPending}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Deduction Settings Modal
══════════════════════════════════════════════════════════════════ */
function DeductionSettingsModal({
  settings,
  tiers,
  onClose,
  onSaveSettings,
  onSaveTiers,
  savingSettings,
  savingTiers,
}: {
  settings?: AnyRec;
  tiers: AnyRec[];
  onClose: () => void;
  onSaveSettings: (s: AnyRec) => void;
  onSaveTiers: (t: AnyRec[]) => void;
  savingSettings: boolean;
  savingTiers: boolean;
}) {
  const [grace, setGrace] = useState(String(settings?.['grace_minutes'] ?? 10));
  const [weeklyOff, setWeeklyOff] = useState<string[]>(
    String(settings?.['weekly_off_days'] ?? '5')
      .split(',')
      .filter(Boolean)
  );
  const [absFull, setAbsFull] = useState(String(settings?.['absence_full_day_amount'] ?? 0));
  const [absHalf, setAbsHalf] = useState(String(settings?.['absence_half_day_amount'] ?? 0));
  const [applyEarly, setApplyEarly] = useState(Boolean(settings?.['apply_early_leave'] ?? true));

  const [editTiers, setEditTiers] = useState<Array<AnyRec>>(
    tiers.length > 0
      ? tiers.map((t) => ({ ...t }))
      : [
          { applies_to: 'late', min_minutes: 1, max_minutes: 15, amount: 25, is_active: true },
          { applies_to: 'late', min_minutes: 16, max_minutes: 30, amount: 50, is_active: true },
          { applies_to: 'late', min_minutes: 31, max_minutes: 60, amount: 100, is_active: true },
          { applies_to: 'late', min_minutes: 61, max_minutes: null, amount: 200, is_active: true },
        ]
  );

  useEffect(() => {
    if (settings) {
      setGrace(String(settings['grace_minutes'] ?? 10));
      setWeeklyOff(
        String(settings['weekly_off_days'] ?? '5')
          .split(',')
          .filter(Boolean)
      );
      setAbsFull(String(settings['absence_full_day_amount'] ?? 0));
      setAbsHalf(String(settings['absence_half_day_amount'] ?? 0));
      setApplyEarly(Boolean(settings['apply_early_leave'] ?? true));
    }
  }, [settings]);

  useEffect(() => {
    if (tiers.length > 0) setEditTiers(tiers.map((t) => ({ ...t })));
  }, [tiers]);

  const DAYS = [
    { v: '0', label: 'أحد' },
    { v: '1', label: 'اثنين' },
    { v: '2', label: 'ثلاثاء' },
    { v: '3', label: 'أربعاء' },
    { v: '4', label: 'خميس' },
    { v: '5', label: 'جمعة' },
    { v: '6', label: 'سبت' },
  ];

  const toggleDay = (v: string) =>
    setWeeklyOff((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const addTier = (applies_to: 'late' | 'early') =>
    setEditTiers((p) => [
      ...p,
      { applies_to, min_minutes: 0, max_minutes: null, amount: 0, is_active: true },
    ]);
  const updTier = (idx: number, k: string, v: unknown) =>
    setEditTiers((p) => p.map((t, i) => (i === idx ? { ...t, [k]: v } : t)));
  const delTier = (idx: number) => setEditTiers((p) => p.filter((_, i) => i !== idx));

  const lateTiers = editTiers.filter((t) => t['applies_to'] === 'late');
  const earlyTiers = editTiers.filter((t) => t['applies_to'] === 'early');

  const renderTierRow = (t: AnyRec, idx: number) => (
    <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
      <input
        type="number"
        min="0"
        className="erp-input text-xs"
        placeholder="من (دقيقة)"
        value={String(t['min_minutes'] ?? '')}
        onChange={(e) =>
          updTier(
            editTiers.indexOf(t),
            'min_minutes',
            e.target.value === '' ? 0 : Number(e.target.value)
          )
        }
      />
      <input
        type="number"
        min="0"
        className="erp-input text-xs"
        placeholder="إلى (فارغ = مفتوح)"
        value={t['max_minutes'] == null ? '' : String(t['max_minutes'])}
        onChange={(e) =>
          updTier(
            editTiers.indexOf(t),
            'max_minutes',
            e.target.value === '' ? null : Number(e.target.value)
          )
        }
      />
      <input
        type="number"
        min="0"
        step="0.01"
        className="erp-input text-xs"
        placeholder="قيمة الخصم"
        value={String(t['amount'] ?? '')}
        onChange={(e) =>
          updTier(
            editTiers.indexOf(t),
            'amount',
            e.target.value === '' ? 0 : Number(e.target.value)
          )
        }
      />
      <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
        <input
          type="checkbox"
          checked={t['is_active'] !== false}
          onChange={(e) => updTier(editTiers.indexOf(t), 'is_active', e.target.checked)}
          className="w-4 h-4 accent-emerald-500 cursor-pointer"
        />
        <span className={t['is_active'] !== false ? 'text-emerald-400 font-bold' : ''}>نشط</span>
      </label>
      <button
        onClick={() => delTier(editTiers.indexOf(t))}
        className="text-red-400 hover:text-red-300 p-1"
        title="حذف"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      dir="rtl"
    >
      <div className="erp-modal rounded-xl max-w-3xl w-full my-4">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings size={18} className="text-amber-300" /> إعدادات خصومات الحضور
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* General settings */}
          <section className="space-y-3">
            <h4 className="text-sm font-bold text-amber-300">إعدادات عامة</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="فترة السماح (دقائق) — تأخير مسموح بدون خصم">
                <input
                  type="number"
                  min="0"
                  className="erp-input w-full"
                  value={grace}
                  onChange={(e) => setGrace(e.target.value)}
                />
              </Field>
              <Field label="">
                <label className="flex items-center gap-2 text-sm text-white/80 mt-6">
                  <input
                    type="checkbox"
                    checked={applyEarly}
                    onChange={(e) => setApplyEarly(e.target.checked)}
                  />
                  تطبيق نفس الشرائح على الانصراف المبكر
                </label>
              </Field>
            </div>

            <Field label="أيام الإجازة الأسبوعية">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.v}
                    onClick={() => toggleDay(d.v)}
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      weeklyOff.includes(d.v)
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="خصم يوم غياب كامل">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="erp-input w-full"
                  value={absFull}
                  onChange={(e) => setAbsFull(e.target.value)}
                  placeholder="0 = لا يحتسب تلقائياً"
                />
              </Field>
              <Field label="خصم نصف يوم غياب">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="erp-input w-full"
                  value={absHalf}
                  onChange={(e) => setAbsHalf(e.target.value)}
                  placeholder="0 = لا يحتسب تلقائياً"
                />
              </Field>
            </div>

            <button
              onClick={() =>
                onSaveSettings({
                  grace_minutes: Number(grace),
                  weekly_off_days: weeklyOff.join(','),
                  absence_full_day_amount: Number(absFull),
                  absence_half_day_amount: Number(absHalf),
                  apply_early_leave: applyEarly,
                })
              }
              disabled={savingSettings}
              className="erp-btn erp-btn-primary text-sm"
            >
              {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}
            </button>
          </section>

          <div className="border-t border-white/10" />

          {/* Tiers */}
          <section className="space-y-3">
            <h4 className="text-sm font-bold text-amber-300">شرائح خصم التأخير</h4>
            <div className="text-[11px] text-white/40">
              مثال: من 1 إلى 15 دقيقة → 25 جنيه. اترك الحد الأعلى فارغاً للشريحة المفتوحة (مثلاً 60+
              دقيقة).
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-[10px] text-white/40 font-bold">
              <div>من (دقيقة)</div>
              <div>إلى (دقيقة)</div>
              <div>قيمة الخصم</div>
              <div>نشط</div>
              <div></div>
            </div>
            {lateTiers.map(renderTierRow)}
            <button
              onClick={() => addTier('late')}
              className="erp-btn erp-btn-ghost text-xs flex items-center gap-1"
            >
              <Plus size={12} /> إضافة شريحة تأخير
            </button>

            {applyEarly && (
              <>
                <h4 className="text-sm font-bold text-amber-300 mt-4">شرائح خصم الانصراف المبكر</h4>
                <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-[10px] text-white/40 font-bold">
                  <div>من (دقيقة)</div>
                  <div>إلى (دقيقة)</div>
                  <div>قيمة الخصم</div>
                  <div>نشط</div>
                  <div></div>
                </div>
                {earlyTiers.map(renderTierRow)}
                <button
                  onClick={() => addTier('early')}
                  className="erp-btn erp-btn-ghost text-xs flex items-center gap-1"
                >
                  <Plus size={12} /> إضافة شريحة انصراف مبكر
                </button>
              </>
            )}

            <button
              onClick={() => onSaveTiers(editTiers)}
              disabled={savingTiers}
              className="erp-btn erp-btn-primary text-sm mt-3"
            >
              {savingTiers ? 'جاري الحفظ...' : 'حفظ كل الشرائح'}
            </button>
          </section>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Deduction Calculation Modal
══════════════════════════════════════════════════════════════════ */
function DeductionCalcModal({
  employees,
  today,
  onClose,
  onPreview,
  previewData,
  previewing,
  onApply,
  applying,
}: {
  employees: AnyRec[];
  today: string;
  onClose: () => void;
  onPreview: (month: string, employee_id: number | null) => void;
  previewData?: AnyRec;
  previewing: boolean;
  onApply: (items: AnyRec[]) => void;
  applying: boolean;
}) {
  const defaultMonth = today.substring(0, 7);
  const [month, setMonth] = useState(defaultMonth);
  const [empId, setEmpId] = useState<string>('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const items = (previewData?.['items'] as AnyRec[] | undefined) ?? [];
  const summary = (previewData?.['summary'] as AnyRec | undefined) ?? {};

  const itemKey = (it: AnyRec) => `${it['attendance_record_id']}|${it['source']}`;
  const toggleExcluded = (k: string) =>
    setExcluded((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const selectableItems = items.filter((it) => !it['already_applied']);
  const selectedItems = selectableItems.filter((it) => !excluded.has(itemKey(it)));
  const selectedTotal = selectedItems.reduce((s, it) => s + Number(it['amount'] ?? 0), 0);

  const typeLabel = (t: string) =>
    t === 'late' ? 'تأخير' : t === 'early' ? 'انصراف مبكر' : 'غياب';
  const typeColor = (t: string) =>
    t === 'late' ? 'text-amber-300' : t === 'early' ? 'text-orange-300' : 'text-red-400';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      dir="rtl"
    >
      <div className="erp-modal rounded-xl max-w-5xl w-full my-4">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator size={18} className="text-amber-300" /> احتساب خصومات الشهر تلقائياً
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Field label="الشهر">
              <input
                type="month"
                className="erp-input w-full"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </Field>
            <Field label="الموظف (اختياري)">
              <select
                className="erp-input w-full"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
              >
                <option value="">— كل الموظفين —</option>
                {employees.map((e) => (
                  <option key={String(e['id'])} value={String(e['id'])}>
                    {String(e['first_name_ar'] ?? '')} {String(e['last_name_ar'] ?? '')}
                  </option>
                ))}
              </select>
            </Field>
            <button
              onClick={() => {
                setExcluded(new Set());
                onPreview(month, empId ? Number(empId) : null);
              }}
              disabled={previewing}
              className="erp-btn erp-btn-primary flex items-center gap-1 justify-center"
            >
              <Calculator size={14} /> {previewing ? 'جاري الحساب...' : 'حساب الخصومات'}
            </button>
          </div>

          {/* Summary */}
          {previewData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
              <div>
                <div className="text-[10px] text-white/40">إجمالي البنود</div>
                <div className="text-lg font-bold text-white">
                  {Number(summary['total_items'] ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">جديدة</div>
                <div className="text-lg font-bold text-emerald-300">
                  {Number(summary['new_items'] ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">سبق احتسابها</div>
                <div className="text-lg font-bold text-white/40">
                  {Number(summary['already_applied'] ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/40">إجمالي محدد</div>
                <div className="text-lg font-bold text-amber-300">{selectedTotal.toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* Items list */}
          {previewData && items.length === 0 && (
            <div className="erp-empty-state">
              <CheckCircle2 size={36} className="erp-empty-icon mb-2 text-emerald-300" />
              <p className="erp-empty-label">لا توجد خصومات للاحتساب في هذا الشهر</p>
              <p className="text-xs text-white/40 mt-1">تأكد من إعداد الشرائح وتسجيل الحضور</p>
            </div>
          )}

          {previewData && items.length > 0 && (
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/5">
                  <tr>
                    <th className="p-2 text-center w-10">
                      <input
                        type="checkbox"
                        checked={selectableItems.length > 0 && excluded.size === 0}
                        onChange={(e) =>
                          setExcluded(
                            e.target.checked ? new Set() : new Set(selectableItems.map(itemKey))
                          )
                        }
                      />
                    </th>
                    <th className="p-2 text-right">الموظف</th>
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">النوع</th>
                    <th className="p-2 text-right">الدقائق</th>
                    <th className="p-2 text-right">القيمة</th>
                    <th className="p-2 text-right">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const k = itemKey(it);
                    const applied = Boolean(it['already_applied']);
                    const isExcluded = excluded.has(k);
                    return (
                      <tr
                        key={k}
                        className={`border-t border-white/5 ${applied ? 'opacity-40' : ''}`}
                      >
                        <td className="p-2 text-center">
                          {applied ? (
                            <span title="سبق احتسابه">
                              <CheckCircle2 size={14} className="text-emerald-400 inline" />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => toggleExcluded(k)}
                            />
                          )}
                        </td>
                        <td className="p-2">
                          <div className="text-white/80">{String(it['employee_name'])}</div>
                          {it['employee_code'] ? (
                            <div className="text-[10px] text-white/40">
                              {String(it['employee_code'])}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 font-mono text-white/60">{String(it['date'])}</td>
                        <td className={`p-2 font-bold ${typeColor(String(it['type']))}`}>
                          {typeLabel(String(it['type']))}
                        </td>
                        <td className="p-2 font-mono text-white/60">
                          {Number(it['minutes']) || '—'}
                        </td>
                        <td className="p-2 font-mono font-bold text-red-300">
                          {Number(it['amount']).toFixed(2)}
                        </td>
                        <td className="p-2 text-white/50 text-[11px]">{String(it['reason'])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {previewData && selectableItems.length > 0 && excluded.size > 0 && (
            <div className="text-xs text-amber-300 flex items-center gap-1">
              <AlertCircle size={14} /> تم استبعاد {excluded.size} بند من الحفظ
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/10">
          <button
            onClick={() => onApply(selectedItems)}
            disabled={applying || selectedItems.length === 0}
            className="erp-btn erp-btn-primary flex-1 flex items-center gap-1 justify-center"
          >
            <CheckCircle2 size={14} />
            {applying ? 'جاري الحفظ...' : `تأكيد وحفظ (${selectedItems.length}) خصم`}
          </button>
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
