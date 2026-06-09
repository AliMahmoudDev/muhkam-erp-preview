import { UserCheck, X, IdCard, Plus, Wallet, Percent } from 'lucide-react';
import type { Employee, Department, JobTitle, Branch } from './types';
import { uploadFileToR2, resolveUploadedFileUrl } from '@/lib/file-upload';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50">{label}</label>
      {children}
    </div>
  );
}

type ToastFn = (opts: {
  title: string;
  variant?: 'default' | 'destructive' | 'warning' | 'info' | null;
}) => void;

interface EmployeeFormProps {
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  editId: number | null;
  editEmp: Partial<Employee>;
  set: (k: keyof Employee, v: unknown) => void;
  saveEmployee: () => void;
  createEmp: { isPending: boolean };
  updateEmp: { isPending: boolean };
  departments: Department[];
  jobTitles: JobTitle[];
  branches: Branch[];
  showInlineDept: boolean;
  setShowInlineDept: React.Dispatch<React.SetStateAction<boolean>>;
  inlineDept: { name_ar: string };
  setInlineDept: React.Dispatch<React.SetStateAction<{ name_ar: string }>>;
  createInlineDept: { mutate: (data: { name_ar: string }) => void; isPending: boolean };
  showInlineJt: boolean;
  setShowInlineJt: React.Dispatch<React.SetStateAction<boolean>>;
  inlineJt: { name_ar: string };
  setInlineJt: React.Dispatch<React.SetStateAction<{ name_ar: string }>>;
  createInlineJt: { mutate: (data: { name_ar: string }) => void; isPending: boolean };
  toast: ToastFn;
}

export function EmployeeForm({
  showForm,
  setShowForm,
  editId,
  editEmp,
  set,
  saveEmployee,
  createEmp,
  updateEmp,
  departments,
  jobTitles,
  branches,
  showInlineDept,
  setShowInlineDept,
  inlineDept,
  setInlineDept,
  createInlineDept,
  showInlineJt,
  setShowInlineJt,
  inlineJt,
  setInlineJt,
  createInlineJt,
  toast,
}: EmployeeFormProps) {
  if (!showForm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="erp-modal rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCheck size={18} className="text-amber-400" />
            {editId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
          </h2>
          <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="الاسم الأول (عربي) *">
              <input
                value={editEmp.first_name_ar ?? ''}
                onChange={(e) => set('first_name_ar', e.target.value)}
                className="erp-input w-full"
                placeholder="صالح"
              />
            </Field>
            <Field label="الاسم الأخير (عربي) *">
              <input
                value={editEmp.last_name_ar ?? ''}
                onChange={(e) => set('last_name_ar', e.target.value)}
                className="erp-input w-full"
                placeholder="المليجي"
              />
            </Field>
          </div>

          {/* Phone (11 digits exact) */}
          <Field label="الهاتف * (11 رقم)">
            <input
              required
              value={editEmp.phone ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                set('phone', v);
              }}
              className="erp-input w-full"
              placeholder="01012345678"
              inputMode="numeric"
              maxLength={11}
            />
            {(editEmp.phone ?? '') && (editEmp.phone ?? '').length !== 11 && (
              <div className="text-xs text-red-400 mt-1">
                يجب إدخال 11 رقم بالضبط ({(editEmp.phone ?? '').length}/11)
              </div>
            )}
          </Field>

          {/* National ID + Image upload — same row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرقم القومي (14 رقم)">
              <div className="relative">
                <IdCard
                  size={14}
                  className="absolute top-1/2 -translate-y-1/2 right-3 text-white/30"
                />
                <input
                  value={editEmp.national_id ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 14);
                    set('national_id', v);
                  }}
                  className="erp-input w-full pr-8"
                  placeholder="14 رقم"
                  inputMode="numeric"
                  maxLength={14}
                />
              </div>
              {(editEmp.national_id ?? '') && (editEmp.national_id ?? '').length !== 14 && (
                <div className="text-xs text-red-400 mt-1">
                  يجب 14 رقم ({(editEmp.national_id ?? '').length}/14)
                </div>
              )}
            </Field>
            <Field label="صورة البطاقة">
              <div className="flex items-center gap-2">
                <label className="erp-btn erp-btn-ghost text-xs cursor-pointer flex-1 text-center border border-white/10">
                  {editEmp.national_id_image ? 'تغيير الصورة' : 'رفع صورة'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 2 * 1024 * 1024) {
                        toast({
                          title: 'حجم الصورة يجب ألا يزيد عن 2 ميجابايت',
                          variant: 'destructive',
                        });
                        return;
                      }
                      try {
                        const uploaded = await uploadFileToR2(f, 'employees');
                        set('national_id_image', uploaded.url);
                        toast({ title: 'تم رفع صورة البطاقة بنجاح', variant: 'default' });
                      } catch (err) {
                        toast({
                          title: err instanceof Error ? err.message : 'فشل رفع صورة البطاقة',
                          variant: 'destructive',
                        });
                      } finally {
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </label>
                {editEmp.national_id_image && (
                  <>
                    <a
                      href={resolveUploadedFileUrl(editEmp.national_id_image)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="erp-btn erp-btn-ghost text-xs px-2 border border-emerald-500/30 text-emerald-300"
                      title="عرض الصورة"
                    >
                      عرض
                    </a>
                    <button
                      type="button"
                      onClick={() => set('national_id_image', null)}
                      className="erp-btn erp-btn-ghost text-xs px-2 border border-red-500/30 text-red-300"
                      title="حذف"
                    >
                      <X size={12} />
                    </button>
                  </>
                )}
              </div>
            </Field>
          </div>

          {/* Department + Job Title — same row, both with inline add */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="القسم">
              <div className="flex gap-2">
                <select
                  value={editEmp.department_id ?? ''}
                  onChange={(e) =>
                    set('department_id', e.target.value ? Number(e.target.value) : null)
                  }
                  className="erp-input flex-1"
                >
                  <option value="">— اختر القسم —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name_ar}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowInlineDept((v) => !v)}
                  className="erp-btn erp-btn-ghost px-2 text-amber-400 border border-amber-500/30"
                  title="إضافة قسم جديد"
                >
                  <Plus size={14} />
                </button>
              </div>
              {showInlineDept && (
                <div className="mt-2 bg-white/5 rounded-lg p-3 space-y-2 border border-amber-500/20">
                  <div className="text-xs text-amber-300 mb-1">قسم جديد</div>
                  <input
                    value={inlineDept.name_ar}
                    onChange={(e) => setInlineDept((p) => ({ ...p, name_ar: e.target.value }))}
                    className="erp-input w-full text-sm"
                    placeholder="اسم القسم *"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => createInlineDept.mutate(inlineDept)}
                      disabled={!inlineDept.name_ar.trim() || createInlineDept.isPending}
                      className="erp-btn erp-btn-primary text-xs flex-1"
                    >
                      {createInlineDept.isPending ? 'جاري...' : 'إضافة'}
                    </button>
                    <button
                      onClick={() => setShowInlineDept(false)}
                      className="erp-btn erp-btn-ghost text-xs"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </Field>

            <Field label="المسمى الوظيفي">
              <div className="flex gap-2">
                <select
                  value={editEmp.job_title_id ?? ''}
                  onChange={(e) =>
                    set('job_title_id', e.target.value ? Number(e.target.value) : null)
                  }
                  className="erp-input flex-1"
                >
                  <option value="">— اختر المسمى —</option>
                  {jobTitles.map((jt) => (
                    <option key={jt.id} value={jt.id}>
                      {jt.name_ar}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowInlineJt((v) => !v)}
                  className="erp-btn erp-btn-ghost px-2 text-amber-400 border border-amber-500/30"
                  title="إضافة مسمى جديد"
                >
                  <Plus size={14} />
                </button>
              </div>
              {showInlineJt && (
                <div className="mt-2 bg-white/5 rounded-lg p-3 space-y-2 border border-amber-500/20">
                  <div className="text-xs text-amber-300 mb-1">مسمى وظيفي جديد</div>
                  <input
                    value={inlineJt.name_ar}
                    onChange={(e) => setInlineJt((p) => ({ ...p, name_ar: e.target.value }))}
                    className="erp-input w-full text-sm"
                    placeholder="اسم المسمى الوظيفي *"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => createInlineJt.mutate(inlineJt)}
                      disabled={!inlineJt.name_ar.trim() || createInlineJt.isPending}
                      className="erp-btn erp-btn-primary text-xs flex-1"
                    >
                      {createInlineJt.isPending ? 'جاري...' : 'إضافة'}
                    </button>
                    <button
                      onClick={() => setShowInlineJt(false)}
                      className="erp-btn erp-btn-ghost text-xs"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </Field>
          </div>

          {/* Hire Date & Branch */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ التعيين *">
              <input
                type="date"
                value={editEmp.hire_date ?? ''}
                onChange={(e) => set('hire_date', e.target.value)}
                className="erp-input w-full"
              />
            </Field>
            <Field label="الفرع">
              <select
                value={editEmp.branch_id ?? ''}
                onChange={(e) => set('branch_id', e.target.value ? Number(e.target.value) : null)}
                className="erp-input w-full"
              >
                <option value="">— اختر الفرع —</option>
                {branches
                  .filter((b) => b.is_active)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          {/* Salary section — 3 modes */}
          <div className="bg-white/5 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/50 ml-1">الراتب:</span>
              {(
                [
                  { v: 'fixed', label: 'راتب ثابت', icon: Wallet, color: 'emerald' },
                  { v: 'commission', label: 'نسبة عمولة', icon: Percent, color: 'purple' },
                  {
                    v: 'fixed_plus_commission',
                    label: 'راتب + عمولة',
                    icon: Plus,
                    color: 'amber',
                  },
                ] as const
              ).map(({ v, label, icon: Icon, color }) => {
                const active = (editEmp.salary_type ?? 'fixed') === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('salary_type', v)}
                    className={`px-3 py-1 rounded-lg text-xs transition-all ${
                      active
                        ? `bg-${color}-500/20 text-${color}-300 border border-${color}-500/30`
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    <Icon size={11} className="inline ml-1" /> {label}
                  </button>
                );
              })}
            </div>

            {/* Fixed-salary input (shown for fixed & fixed_plus_commission) */}
            {(editEmp.salary_type ?? 'fixed') !== 'commission' && (
              <div>
                <div className="text-xs text-white/40 mb-1">الراتب الأساسي</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={editEmp.salary ?? 0}
                    onChange={(e) => set('salary', Number(e.target.value))}
                    className="erp-input flex-1"
                    min={0}
                    placeholder="0.00"
                    style={{ minWidth: 0 }}
                  />
                  <select
                    value={editEmp.currency ?? 'EGP'}
                    onChange={(e) => set('currency', e.target.value)}
                    className="erp-input"
                    style={{ width: '90px', flexShrink: 0 }}
                  >
                    {['EGP', 'USD', 'CNY'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Commission inputs (shown for commission & fixed_plus_commission) */}
            {(editEmp.salary_type ?? 'fixed') !== 'fixed' && (
              <div className="space-y-2">
                <div className="text-xs text-white/40 mb-1">نسبة العمولة</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editEmp.commission_rate ?? ''}
                      onChange={(e) => set('commission_rate', Number(e.target.value))}
                      className="erp-input w-full"
                      min={0}
                      max={100}
                      placeholder="مثال: 5"
                      style={{ minWidth: 0 }}
                    />
                    <span className="text-white/50 text-xs shrink-0">%</span>
                  </div>
                  <select
                    value={editEmp.commission_basis ?? 'gross'}
                    onChange={(e) => set('commission_basis', e.target.value as 'gross' | 'net')}
                    className="erp-input"
                    title="أساس حساب العمولة"
                  >
                    <option value="gross">من إجمالي الدخل</option>
                    <option value="net">من صافي الربح</option>
                  </select>
                  <select
                    value={editEmp.commission_scope_dept_id ?? ''}
                    onChange={(e) =>
                      set(
                        'commission_scope_dept_id',
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="erp-input"
                    title="نطاق العمولة (قسم)"
                  >
                    <option value="">— كل الأقسام —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name_ar}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Address & Notes */}
          <Field label="العنوان">
            <input
              value={editEmp.address_ar ?? ''}
              onChange={(e) => set('address_ar', e.target.value)}
              className="erp-input w-full"
              placeholder="العنوان الكامل"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3">
            <Field label="الحساب البنكي">
              <input
                value={editEmp.bank_account ?? ''}
                onChange={(e) => set('bank_account', e.target.value)}
                className="erp-input w-full"
              />
            </Field>
          </div>
          <Field label="ملاحظات">
            <textarea
              value={editEmp.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              className="erp-input w-full"
              rows={2}
            />
          </Field>
        </div>
        <div className="flex gap-2 p-5 border-t border-white/10">
          <button
            onClick={saveEmployee}
            disabled={createEmp.isPending || updateEmp.isPending}
            className="erp-btn erp-btn-primary flex-1"
          >
            {createEmp.isPending || updateEmp.isPending
              ? 'جاري الحفظ...'
              : editId
                ? 'حفظ التعديلات'
                : 'إضافة الموظف'}
          </button>
          <button onClick={() => setShowForm(false)} className="erp-btn erp-btn-ghost">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
