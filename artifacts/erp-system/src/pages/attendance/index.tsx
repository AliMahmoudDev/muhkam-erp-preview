import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Plus,
  X,
  LogIn,
  LogOut,
  Pencil,
  Trash2,
  Settings,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Users,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import AttendanceSummary from './AttendanceSummary';
import AttendanceList from './AttendanceList';
import { CheckInModal, CheckOutModal, EditRecordModal } from './AttendanceFormModal';

type AnyRec = Record<string, unknown>;

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

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showEditRecord, setShowEditRecord] = useState(false);
  const [showDedSettings, setShowDedSettings] = useState(false);

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
  const shiftsQuery = useQuery({
    queryKey: ['shifts'],
    queryFn: () => f('/api/shifts'),
  });

  const blankShift = { name_ar: '', start_time: '08:00', end_time: '17:00', break_duration: 60, grace_minutes: 10, working_days: '0,1,2,3,4', weekly_hours: 40 };
  const [shiftForm, setShiftForm] = useState<AnyRec>(blankShift);
  const [editShiftId, setEditShiftId] = useState<number | null>(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ employee_id: '', shift_id: '', assigned_date: today });
  const [showAssignForm, setShowAssignForm] = useState(false);

  const WORK_DAYS = [
    { v: '0', label: 'أحد' }, { v: '1', label: 'اثنين' }, { v: '2', label: 'ثلاثاء' },
    { v: '3', label: 'أربعاء' }, { v: '4', label: 'خميس' }, { v: '5', label: 'جمعة' }, { v: '6', label: 'سبت' },
  ];
  const shiftWorkDays: string[] = String(shiftForm['working_days'] ?? '').split(',').filter(Boolean);
  const toggleShiftDay = (v: string) => setShiftForm(p => ({
    ...p,
    working_days: shiftWorkDays.includes(v)
      ? shiftWorkDays.filter(x => x !== v).join(',')
      : [...shiftWorkDays, v].join(','),
  }));

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

  const doAddShift = useMutation({
    mutationFn: (d: AnyRec) => f('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts('shifts', 'تم إضافة المناوبة'),
  });
  const doEditShift = useMutation({
    mutationFn: ({ id, ...d }: AnyRec) => f(`/api/shifts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    ...mutOpts('shifts', 'تم تعديل المناوبة'),
  });
  const doDeleteShift = useMutation({
    mutationFn: (id: number) => f(`/api/shifts/${id}`, { method: 'DELETE' }),
    ...mutOpts('shifts', 'تم حذف المناوبة'),
  });
  const doAssignShift = useMutation({
    mutationFn: (d: AnyRec) => f('/api/employee-shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }),
    onSuccess: () => { toast({ title: 'تم تعيين المناوبة للموظف' }); setShowAssignForm(false); setAssignForm({ employee_id: '', shift_id: '', assigned_date: today }); },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  function openAddShift() { setShiftForm(blankShift); setEditShiftId(null); setShowShiftForm(true); }
  function openEditShift(s: AnyRec) {
    setShiftForm({ name_ar: s['name_ar'], start_time: s['start_time'], end_time: s['end_time'], break_duration: s['break_duration'], grace_minutes: s['grace_minutes'], working_days: s['working_days'], weekly_hours: s['weekly_hours'] });
    setEditShiftId(Number(s['id']));
    setShowShiftForm(true);
  }
  function saveShift() {
    if (!shiftForm['name_ar']) { toast({ title: 'اسم المناوبة مطلوب', variant: 'destructive' }); return; }
    if (editShiftId) { doEditShift.mutate({ id: editShiftId, ...shiftForm }, { onSuccess: () => setShowShiftForm(false) }); }
    else { doAddShift.mutate(shiftForm, { onSuccess: () => { setShowShiftForm(false); } }); }
  }

  const allRecords = safeArray(records.data);
  const empList = safeArray(employees.data);

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
    { key: 'records',    label: 'سجلات الحضور',      icon: Clock },
    { key: 'shifts',     label: 'المناوبات',           icon: Briefcase },
    { key: 'deductions', label: 'الخصومات التلقائية',  icon: Calculator },
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
            <button onClick={() => setShowCheckIn(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <LogIn size={14} /> تسجيل حضور
            </button>
            <button onClick={() => setShowCheckOut(true)} className="erp-btn erp-btn-secondary flex items-center gap-1 text-sm">
              <LogOut size={14} /> تسجيل انصراف
            </button>
            {activeTab === 'deductions' && (
              <button onClick={() => setShowDedSettings(true)} className="erp-btn erp-btn-ghost flex items-center gap-1 text-sm">
                <Settings size={14} /> إعدادات الخصم
              </button>
            )}
          </div>
        )}
      </div>

      <AttendanceSummary
        total={allRecords.length}
        present={present}
        absent={absent}
        late={late}
      />

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

      {activeTab === 'records' && (
        <AttendanceList
          isLoading={records.isLoading}
          recordsList={recordsList}
          totalHours={totalHours}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          empSearch={empSearch}
          setEmpSearch={setEmpSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          canManage={canManage}
          openCheckOut={openCheckOut}
          openEdit={openEdit}
        />
      )}

      {/* ══ تبويب المناوبات ══ */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Briefcase size={16} className="text-amber-400" /> المناوبات المحفوظة
              </h3>
              {canManage && (
                <button onClick={openAddShift} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
                  <Plus size={14} /> مناوبة جديدة
                </button>
              )}
            </div>

            {shiftsQuery.isLoading ? (
              <div className="text-white/40 text-sm text-center py-6">جاري التحميل...</div>
            ) : safeArray(shiftsQuery.data).length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Briefcase size={36} className="text-white/20 mx-auto" />
                <p className="text-white/40 text-sm">لا توجد مناوبات — أضف مناوبة أولى لتحديد مواعيد الدوام</p>
              </div>
            ) : (
              <div className="space-y-3">
                {safeArray(shiftsQuery.data).map((s) => {
                  const days = String(s['working_days'] ?? '').split(',').filter(Boolean);
                  const dayNames = days.map(d => WORK_DAYS.find(x => x.v === d)?.label ?? d);
                  return (
                    <div key={String(s['id'])} className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-amber-400/30 transition-colors">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{String(s['name_ar'])}</span>
                          {s['is_active'] === false && <span className="erp-badge erp-badge-neutral text-[10px]">معطّل</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-white/50">
                          <span>🕐 {String(s['start_time'])} — {String(s['end_time'])}</span>
                          <span>☕ استراحة {Number(s['break_duration'])} د</span>
                          <span>⏱ سماح {Number(s['grace_minutes'])} د</span>
                          <span>📆 {dayNames.join(' · ')}</span>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => openEditShift(s)} className="erp-btn erp-btn-ghost p-1.5" title="تعديل"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm('حذف هذه المناوبة؟')) doDeleteShift.mutate(Number(s['id'])); }} className="erp-btn erp-btn-ghost p-1.5 text-red-400 hover:text-red-300" title="حذف"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canManage && safeArray(shiftsQuery.data).length > 0 && (
            <div className="erp-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Users size={16} className="text-emerald-400" /> تعيين موظف على مناوبة
                </h3>
                <button onClick={() => setShowAssignForm(p => !p)} className="erp-btn erp-btn-ghost flex items-center gap-1 text-sm">
                  {showAssignForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showAssignForm ? 'إخفاء' : 'تعيين موظف'}
                </button>
              </div>
              {showAssignForm && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 bg-white/5 rounded-xl border border-white/10">
                  <Field label="الموظف *">
                    <select className="erp-input w-full" value={assignForm.employee_id} onChange={e => setAssignForm(p => ({ ...p, employee_id: e.target.value }))}>
                      <option value="">اختر الموظف</option>
                      {empList.map(e => (
                        <option key={String(e['id'])} value={String(e['id'])}>
                          {String(e['first_name_ar'] ?? '')} {String(e['last_name_ar'] ?? '')} — {String(e['employee_code'] ?? '')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="المناوبة *">
                    <select className="erp-input w-full" value={assignForm.shift_id} onChange={e => setAssignForm(p => ({ ...p, shift_id: e.target.value }))}>
                      <option value="">اختر المناوبة</option>
                      {safeArray(shiftsQuery.data).map(s => (
                        <option key={String(s['id'])} value={String(s['id'])}>{String(s['name_ar'])} ({String(s['start_time'])}–{String(s['end_time'])})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="تاريخ البدء">
                    <input type="date" className="erp-input w-full" value={assignForm.assigned_date} onChange={e => setAssignForm(p => ({ ...p, assigned_date: e.target.value }))} />
                  </Field>
                  <button
                    onClick={() => {
                      if (!assignForm.employee_id || !assignForm.shift_id) { toast({ title: 'اختر الموظف والمناوبة', variant: 'destructive' }); return; }
                      doAssignShift.mutate({ employee_id: Number(assignForm.employee_id), shift_schedule_id: Number(assignForm.shift_id), assigned_date: assignForm.assigned_date });
                    }}
                    disabled={doAssignShift.isPending}
                    className="erp-btn erp-btn-primary flex items-center gap-1 justify-center"
                  >
                    <Save size={14} /> {doAssignShift.isPending ? 'جاري...' : 'حفظ التعيين'}
                  </button>
                </div>
              )}
              <div className="text-xs text-white/40 flex items-center gap-1.5 bg-amber-500/10 border border-amber-400/20 rounded-lg p-3">
                <span className="text-amber-300">💡</span>
                بعد تعيين الموظف على مناوبة — عند تسجيل حضوره يحتسب النظام تلقائياً: دقائق التأخير، الانصراف المبكر، ساعات العمل الفعلية، والعمل الإضافي.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ تبويب الخصومات التلقائية ══ */}
      {activeTab === 'deductions' && canManage && (
        <DeductionCalcModal
          employees={empList}
          today={today}
          onClose={() => setActiveTab('records')}
          onPreview={(month, employee_id) => previewDed.mutate({ month, employee_id })}
          previewData={previewDed.data as AnyRec | undefined}
          previewing={previewDed.isPending}
          onApply={(items) => applyDed.mutate(items, { onSuccess: () => { previewDed.reset(); qc.invalidateQueries({ queryKey: ['employee-deductions'] }); } })}
          applying={applyDed.isPending}
          inline
        />
      )}

      {/* ══ MODALS ══ */}

      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-lg" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Briefcase size={16} className="text-amber-400" /> {editShiftId ? 'تعديل مناوبة' : 'مناوبة جديدة'}
              </h2>
              <button onClick={() => setShowShiftForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="اسم المناوبة *">
                <input className="erp-input w-full" placeholder="مثال: الوردية الصباحية" value={String(shiftForm['name_ar'] ?? '')} onChange={e => setShiftForm(p => ({ ...p, name_ar: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت الحضور">
                  <input type="time" className="erp-input w-full" value={String(shiftForm['start_time'] ?? '08:00')} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} />
                </Field>
                <Field label="وقت الانصراف">
                  <input type="time" className="erp-input w-full" value={String(shiftForm['end_time'] ?? '17:00')} onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} />
                </Field>
                <Field label="فترة الاستراحة (دقائق)">
                  <input type="number" min="0" className="erp-input w-full" value={Number(shiftForm['break_duration'] ?? 60)} onChange={e => setShiftForm(p => ({ ...p, break_duration: Number(e.target.value) }))} />
                </Field>
                <Field label="فترة السماح (دقائق)">
                  <input type="number" min="0" className="erp-input w-full" value={Number(shiftForm['grace_minutes'] ?? 10)} onChange={e => setShiftForm(p => ({ ...p, grace_minutes: Number(e.target.value) }))} />
                </Field>
              </div>
              <Field label="أيام العمل">
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map(d => (
                    <button key={d.v} type="button" onClick={() => toggleShiftDay(d.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${shiftWorkDays.includes(d.v) ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={saveShift} disabled={doAddShift.isPending || doEditShift.isPending} className="erp-btn erp-btn-primary flex-1 flex items-center gap-1 justify-center">
                <Save size={14} /> {doAddShift.isPending || doEditShift.isPending ? 'جاري الحفظ...' : 'حفظ المناوبة'}
              </button>
              <button onClick={() => setShowShiftForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showCheckIn && (
        <CheckInModal
          empList={empList}
          form={checkInForm}
          setForm={setCheckInForm}
          today={today}
          isPending={doCheckIn.isPending}
          onClose={() => setShowCheckIn(false)}
          onSubmit={() => {
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
        />
      )}

      {showCheckOut && (
        <CheckOutModal
          empList={empList}
          form={checkOutForm}
          setForm={setCheckOutForm}
          isPending={doCheckOut.isPending}
          onClose={() => setShowCheckOut(false)}
          onSubmit={() => {
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
        />
      )}

      {showEditRecord && editForm && (
        <EditRecordModal
          form={editForm}
          setForm={setEditForm}
          isPending={doEditRecord.isPending}
          onClose={() => setShowEditRecord(false)}
          onSubmit={() => {
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
        />
      )}

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
  inline = false,
}: {
  employees: AnyRec[];
  today: string;
  onClose: () => void;
  onPreview: (month: string, employee_id: number | null) => void;
  previewData?: AnyRec;
  previewing: boolean;
  onApply: (items: AnyRec[]) => void;
  applying: boolean;
  inline?: boolean;
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

  const inner = (
    <>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calculator size={18} className="text-amber-300" /> احتساب خصومات الشهر تلقائياً
          </h3>
          {!inline && (
            <button onClick={onClose} className="text-white/50 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
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
          {!inline && (
            <button onClick={onClose} className="erp-btn erp-btn-ghost">إلغاء</button>
          )}
        </div>
    </>
  );

  if (inline) {
    return <div className="erp-card rounded-xl overflow-hidden" dir="rtl">{inner}</div>;
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4" dir="rtl">
      <div className="erp-modal rounded-xl max-w-5xl w-full my-4">{inner}</div>
    </div>
  );
}
