import { LogIn, LogOut, Pencil, X } from 'lucide-react';

type AnyRec = Record<string, unknown>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-ink/50">{label}</label>
      {children}
    </div>
  );
}

interface CheckInForm {
  employee_id: string;
  attendance_date: string;
  check_in_time: string;
  notes: string;
}

interface CheckOutForm {
  employee_id: string;
  attendance_date: string;
  check_out_time: string;
}

interface EditForm {
  id: number;
  check_in_time: string;
  check_out_time: string;
  status: string;
  notes: string;
  working_hours: string;
}

export function CheckInModal({
  empList,
  form,
  setForm,
  today,
  onSubmit,
  isPending,
  onClose,
}: {
  empList: AnyRec[];
  form: CheckInForm;
  setForm: React.Dispatch<React.SetStateAction<CheckInForm>>;
  today: string;
  onSubmit: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="font-bold text-ink flex items-center gap-2">
            <LogIn size={16} className="text-emerald-400" /> تسجيل حضور
          </h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="الموظف *">
            <select
              className="erp-input w-full"
              value={form.employee_id}
              onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
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
                value={form.attendance_date || today}
                onChange={(e) => setForm((p) => ({ ...p, attendance_date: e.target.value }))}
                className="erp-input w-full"
              />
            </Field>
            <Field label="وقت الحضور">
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => setForm((p) => ({ ...p, check_in_time: e.target.value }))}
                className="erp-input w-full"
              />
            </Field>
          </div>
          <Field label="ملاحظات">
            <input
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="erp-input w-full"
              placeholder="اختياري"
            />
          </Field>
        </div>
        <div className="flex gap-2 p-5 border-t border-line">
          <button
            onClick={onSubmit}
            disabled={isPending}
            className="erp-btn erp-btn-primary flex-1"
          >
            {isPending ? 'جاري التسجيل...' : 'تسجيل'}
          </button>
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function CheckOutModal({
  empList,
  form,
  setForm,
  onSubmit,
  isPending,
  onClose,
}: {
  empList: AnyRec[];
  form: CheckOutForm;
  setForm: React.Dispatch<React.SetStateAction<CheckOutForm>>;
  onSubmit: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="font-bold text-ink flex items-center gap-2">
            <LogOut size={16} className="text-red-400" /> تسجيل انصراف
          </h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="الموظف *">
            <select
              className="erp-input w-full"
              value={form.employee_id}
              onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
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
                value={form.attendance_date}
                onChange={(e) => setForm((p) => ({ ...p, attendance_date: e.target.value }))}
                className="erp-input w-full"
              />
            </Field>
            <Field label="وقت الانصراف">
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => setForm((p) => ({ ...p, check_out_time: e.target.value }))}
                className="erp-input w-full"
              />
            </Field>
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-line">
          <button
            onClick={onSubmit}
            disabled={isPending}
            className="erp-btn erp-btn-primary flex-1"
          >
            {isPending ? 'جاري التسجيل...' : 'تسجيل'}
          </button>
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditRecordModal({
  form,
  setForm,
  onSubmit,
  isPending,
  onClose,
}: {
  form: EditForm;
  setForm: React.Dispatch<React.SetStateAction<EditForm | null>>;
  onSubmit: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <h2 className="font-bold text-ink flex items-center gap-2">
            <Pencil size={16} className="text-amber-400" /> تعديل سجل الحضور
          </h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="وقت الحضور">
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => setForm((p) => (p ? { ...p, check_in_time: e.target.value } : p))}
                className="erp-input w-full"
              />
            </Field>
            <Field label="وقت الانصراف">
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => setForm((p) => (p ? { ...p, check_out_time: e.target.value } : p))}
                className="erp-input w-full"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الحالة">
              <select
                className="erp-input w-full"
                value={form.status}
                onChange={(e) => setForm((p) => (p ? { ...p, status: e.target.value } : p))}
              >
                <option value="present">حاضر</option>
                <option value="late">متأخر</option>
                <option value="absent">غائب</option>
                <option value="excused">استأذن (بدون خصم)</option>
                <option value="on_leave">إجازة</option>
                <option value="holiday">إجازة رسمية</option>
              </select>
            </Field>
            <Field label="ساعات العمل">
              <input
                type="number"
                step="0.1"
                value={form.working_hours}
                onChange={(e) => setForm((p) => (p ? { ...p, working_hours: e.target.value } : p))}
                className="erp-input w-full"
              />
            </Field>
          </div>
          <Field label="ملاحظات">
            <input
              value={form.notes}
              onChange={(e) => setForm((p) => (p ? { ...p, notes: e.target.value } : p))}
              className="erp-input w-full"
            />
          </Field>
        </div>
        <div className="flex gap-2 p-5 border-t border-line">
          <button
            onClick={onSubmit}
            disabled={isPending}
            className="erp-btn erp-btn-primary flex-1"
          >
            {isPending ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
