import { useState } from 'react';
import {
  Plus,
  X,
  Briefcase,
  Users,
  Save,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { useToast } from '@/hooks/use-toast';
import { Field } from './AttendanceDeductionModals';

type AnyRec = Record<string, unknown>;

const WORK_DAYS = [
  { v: '0', label: 'أحد' },
  { v: '1', label: 'اثنين' },
  { v: '2', label: 'ثلاثاء' },
  { v: '3', label: 'أربعاء' },
  { v: '4', label: 'خميس' },
  { v: '5', label: 'جمعة' },
  { v: '6', label: 'سبت' },
];

const blankShift = {
  name_ar: '',
  start_time: '08:00',
  end_time: '17:00',
  break_duration: 60,
  grace_minutes: 10,
  working_days: '0,1,2,3,4',
  weekly_hours: 40,
};

interface AttendanceShiftsTabProps {
  canManage: boolean;
  empList: AnyRec[];
  today: string;
  shifts: AnyRec[];
  shiftsLoading: boolean;
  doAddShift: UseMutationResult<AnyRec, Error, AnyRec>;
  doEditShift: UseMutationResult<AnyRec, Error, AnyRec>;
  doDeleteShift: UseMutationResult<AnyRec, Error, number>;
  doAssignShift: UseMutationResult<AnyRec, Error, AnyRec>;
}

export function AttendanceShiftsTab({
  canManage,
  empList,
  today,
  shifts,
  shiftsLoading,
  doAddShift,
  doEditShift,
  doDeleteShift,
  doAssignShift,
}: AttendanceShiftsTabProps) {
  const { toast } = useToast();
  const [shiftForm, setShiftForm] = useState<AnyRec>(blankShift);
  const [editShiftId, setEditShiftId] = useState<number | null>(null);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    shift_id: '',
    assigned_date: today,
  });
  const [showAssignForm, setShowAssignForm] = useState(false);

  const shiftWorkDays: string[] = String(shiftForm['working_days'] ?? '')
    .split(',')
    .filter(Boolean);
  const toggleShiftDay = (v: string) =>
    setShiftForm((p) => ({
      ...p,
      working_days: shiftWorkDays.includes(v)
        ? shiftWorkDays.filter((x) => x !== v).join(',')
        : [...shiftWorkDays, v].join(','),
    }));

  function openAddShift() {
    setShiftForm(blankShift);
    setEditShiftId(null);
    setShowShiftForm(true);
  }
  function openEditShift(s: AnyRec) {
    setShiftForm({
      name_ar: s['name_ar'],
      start_time: s['start_time'],
      end_time: s['end_time'],
      break_duration: s['break_duration'],
      grace_minutes: s['grace_minutes'],
      working_days: s['working_days'],
      weekly_hours: s['weekly_hours'],
    });
    setEditShiftId(Number(s['id']));
    setShowShiftForm(true);
  }
  function saveShift() {
    if (!shiftForm['name_ar']) {
      toast({ title: 'اسم المناوبة مطلوب', variant: 'destructive' });
      return;
    }
    if (editShiftId) {
      doEditShift.mutate(
        { id: editShiftId, ...shiftForm },
        { onSuccess: () => setShowShiftForm(false) }
      );
    } else {
      doAddShift.mutate(shiftForm, { onSuccess: () => setShowShiftForm(false) });
    }
  }

  return (
    <div className="space-y-6">
      <div className="erp-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink flex items-center gap-2">
            <Briefcase size={16} className="text-amber-400" /> المناوبات المحفوظة
          </h3>
          {canManage && (
            <button
              onClick={openAddShift}
              className="erp-btn erp-btn-primary flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> مناوبة جديدة
            </button>
          )}
        </div>

        {shiftsLoading ? (
          <div className="text-ink/40 text-sm text-center py-6">جاري التحميل...</div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Briefcase size={36} className="text-ink/20 mx-auto" />
            <p className="text-ink/40 text-sm">
              لا توجد مناوبات — أضف مناوبة أولى لتحديد مواعيد الدوام
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((s) => {
              const days = String(s['working_days'] ?? '')
                .split(',')
                .filter(Boolean);
              const dayNames = days.map((d) => WORK_DAYS.find((x) => x.v === d)?.label ?? d);
              return (
                <div
                  key={String(s['id'])}
                  className="flex items-start gap-4 p-4 bg-surface border border-line rounded-xl hover:border-amber-400/30 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{String(s['name_ar'])}</span>
                      {s['is_active'] === false && (
                        <span className="erp-badge erp-badge-neutral text-[10px]">معطّل</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-ink/50">
                      <span>
                        🕐 {String(s['start_time'])} — {String(s['end_time'])}
                      </span>
                      <span>☕ استراحة {Number(s['break_duration'])} د</span>
                      <span>⏱ سماح {Number(s['grace_minutes'])} د</span>
                      <span>📆 {dayNames.join(' · ')}</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEditShift(s)}
                        className="erp-btn erp-btn-ghost p-1.5"
                        title="تعديل"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('حذف هذه المناوبة؟')) doDeleteShift.mutate(Number(s['id']));
                        }}
                        className="erp-btn erp-btn-ghost p-1.5 text-red-400 hover:text-red-300"
                        title="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canManage && shifts.length > 0 && (
        <div className="erp-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink flex items-center gap-2">
              <Users size={16} className="text-emerald-400" /> تعيين موظف على مناوبة
            </h3>
            <button
              onClick={() => setShowAssignForm((p) => !p)}
              className="erp-btn erp-btn-ghost flex items-center gap-1 text-sm"
            >
              {showAssignForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showAssignForm ? 'إخفاء' : 'تعيين موظف'}
            </button>
          </div>
          {showAssignForm && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 bg-surface rounded-xl border border-line">
              <Field label="الموظف *">
                <select
                  className="erp-input w-full"
                  value={assignForm.employee_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">اختر الموظف</option>
                  {empList.map((e) => (
                    <option key={String(e['id'])} value={String(e['id'])}>
                      {String(e['first_name_ar'] ?? '')} {String(e['last_name_ar'] ?? '')} —{' '}
                      {String(e['employee_code'] ?? '')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المناوبة *">
                <select
                  className="erp-input w-full"
                  value={assignForm.shift_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, shift_id: e.target.value }))}
                >
                  <option value="">اختر المناوبة</option>
                  {shifts.map((s) => (
                    <option key={String(s['id'])} value={String(s['id'])}>
                      {String(s['name_ar'])} ({String(s['start_time'])}–{String(s['end_time'])})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="تاريخ البدء">
                <input
                  type="date"
                  className="erp-input w-full"
                  value={assignForm.assigned_date}
                  onChange={(e) => setAssignForm((p) => ({ ...p, assigned_date: e.target.value }))}
                />
              </Field>
              <button
                onClick={() => {
                  if (!assignForm.employee_id || !assignForm.shift_id) {
                    toast({ title: 'اختر الموظف والمناوبة', variant: 'destructive' });
                    return;
                  }
                  doAssignShift.mutate(
                    {
                      employee_id: Number(assignForm.employee_id),
                      shift_schedule_id: Number(assignForm.shift_id),
                      assigned_date: assignForm.assigned_date,
                    },
                    {
                      onSuccess: () => {
                        setShowAssignForm(false);
                        setAssignForm({ employee_id: '', shift_id: '', assigned_date: today });
                      },
                    }
                  );
                }}
                disabled={doAssignShift.isPending}
                className="erp-btn erp-btn-primary flex items-center gap-1 justify-center"
              >
                <Save size={14} /> {doAssignShift.isPending ? 'جاري...' : 'حفظ التعيين'}
              </button>
            </div>
          )}
          <div className="text-xs text-ink/40 flex items-center gap-1.5 bg-amber-500/10 border border-amber-400/20 rounded-lg p-3">
            <span className="text-amber-300">💡</span>
            بعد تعيين الموظف على مناوبة — عند تسجيل حضوره يحتسب النظام تلقائياً: دقائق التأخير،
            الانصراف المبكر، ساعات العمل الفعلية، والعمل الإضافي.
          </div>
        </div>
      )}

      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-lg" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h2 className="font-bold text-ink flex items-center gap-2">
                <Briefcase size={16} className="text-amber-400" />{' '}
                {editShiftId ? 'تعديل مناوبة' : 'مناوبة جديدة'}
              </h2>
              <button
                onClick={() => setShowShiftForm(false)}
                className="text-ink/40 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="اسم المناوبة *">
                <input
                  className="erp-input w-full"
                  placeholder="مثال: الوردية الصباحية"
                  value={String(shiftForm['name_ar'] ?? '')}
                  onChange={(e) => setShiftForm((p) => ({ ...p, name_ar: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت الحضور">
                  <input
                    type="time"
                    className="erp-input w-full"
                    value={String(shiftForm['start_time'] ?? '08:00')}
                    onChange={(e) => setShiftForm((p) => ({ ...p, start_time: e.target.value }))}
                  />
                </Field>
                <Field label="وقت الانصراف">
                  <input
                    type="time"
                    className="erp-input w-full"
                    value={String(shiftForm['end_time'] ?? '17:00')}
                    onChange={(e) => setShiftForm((p) => ({ ...p, end_time: e.target.value }))}
                  />
                </Field>
                <Field label="فترة الاستراحة (دقائق)">
                  <input
                    type="number"
                    min="0"
                    className="erp-input w-full"
                    value={Number(shiftForm['break_duration'] ?? 60)}
                    onChange={(e) =>
                      setShiftForm((p) => ({ ...p, break_duration: Number(e.target.value) }))
                    }
                  />
                </Field>
                <Field label="فترة السماح (دقائق)">
                  <input
                    type="number"
                    min="0"
                    className="erp-input w-full"
                    value={Number(shiftForm['grace_minutes'] ?? 10)}
                    onChange={(e) =>
                      setShiftForm((p) => ({ ...p, grace_minutes: Number(e.target.value) }))
                    }
                  />
                </Field>
              </div>
              <Field label="أيام العمل">
                <div className="flex flex-wrap gap-2">
                  {WORK_DAYS.map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleShiftDay(d.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${shiftWorkDays.includes(d.v) ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-surface border-line text-ink/60 hover:text-ink'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-line">
              <button
                onClick={saveShift}
                disabled={doAddShift.isPending || doEditShift.isPending}
                className="erp-btn erp-btn-primary flex-1 flex items-center gap-1 justify-center"
              >
                <Save size={14} />{' '}
                {doAddShift.isPending || doEditShift.isPending ? 'جاري الحفظ...' : 'حفظ المناوبة'}
              </button>
              <button onClick={() => setShowShiftForm(false)} className="erp-btn erp-btn-ghost">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { safeArray };
