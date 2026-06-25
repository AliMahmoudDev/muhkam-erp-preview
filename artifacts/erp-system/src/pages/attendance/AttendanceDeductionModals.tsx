import { useState, useEffect } from 'react';
import { Plus, X, Settings, Calculator, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Combobox } from '@/components/ui/combobox';

type AnyRec = Record<string, unknown>;

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-ink/50">{label}</label>
      {children}
    </div>
  );
}

export function DeductionSettingsModal({
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
  const [editTiers, setEditTiers] = useState<AnyRec[]>(
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
      <label className="flex items-center gap-1.5 text-[10px] text-ink/60 cursor-pointer">
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
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="text-lg font-bold text-ink flex items-center gap-2">
            <Settings size={18} className="text-amber-300" /> إعدادات خصومات الحضور
          </h3>
          <button onClick={onClose} className="text-ink/50 hover:text-ink">
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
                <label className="flex items-center gap-2 text-sm text-ink/80 mt-6">
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
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${weeklyOff.includes(d.v) ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-surface border-line text-ink/60 hover:text-ink'}`}
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
          <div className="border-t border-line" />
          <section className="space-y-3">
            <h4 className="text-sm font-bold text-amber-300">شرائح خصم التأخير</h4>
            <div className="text-[11px] text-ink/40">
              مثال: من 1 إلى 15 دقيقة → 25 جنيه. اترك الحد الأعلى فارغاً للشريحة المفتوحة.
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-[10px] text-ink/40 font-bold">
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
                <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-[10px] text-ink/40 font-bold">
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
        <div className="flex justify-end gap-2 p-4 border-t border-line">
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeductionCalcModal({
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
      <div className="flex items-center justify-between p-4 border-b border-line">
        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
          <Calculator size={18} className="text-amber-300" /> احتساب خصومات الشهر تلقائياً
        </h3>
        {!inline && (
          <button onClick={onClose} className="text-ink/50 hover:text-ink">
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
            <Combobox
              options={employees.map((e) => ({
                value: String(e['id']),
                label: `${String(e['first_name_ar'] ?? '')} ${String(e['last_name_ar'] ?? '')}`,
              }))}
              value={empId}
              onChange={(v) => setEmpId(v)}
              placeholder="— كل الموظفين —"
              className="w-full"
            />
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-surface rounded-lg border border-line">
            <div>
              <div className="text-[10px] text-ink/40">إجمالي البنود</div>
              <div className="text-lg font-bold text-ink">
                {Number(summary['total_items'] ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-ink/40">جديدة</div>
              <div className="text-lg font-bold text-emerald-300">
                {Number(summary['new_items'] ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-ink/40">سبق احتسابها</div>
              <div className="text-lg font-bold text-ink/40">
                {Number(summary['already_applied'] ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-ink/40">إجمالي محدد</div>
              <div className="text-lg font-bold text-amber-300">{selectedTotal.toFixed(2)}</div>
            </div>
          </div>
        )}
        {previewData && items.length === 0 && (
          <div className="erp-empty-state">
            <CheckCircle2 size={36} className="erp-empty-icon mb-2 text-emerald-300" />
            <p className="erp-empty-label">لا توجد خصومات للاحتساب في هذا الشهر</p>
            <p className="text-xs text-ink/40 mt-1">تأكد من إعداد الشرائح وتسجيل الحضور</p>
          </div>
        )}
        {previewData && items.length > 0 && (
          <div className="border border-line rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface">
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
                    <tr key={k} className={`border-t border-line ${applied ? 'opacity-40' : ''}`}>
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
                        <div className="text-ink/80">{String(it['employee_name'])}</div>
                        {it['employee_code'] ? (
                          <div className="text-[10px] text-ink/40">
                            {String(it['employee_code'])}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 font-mono text-ink/60">{String(it['date'])}</td>
                      <td className={`p-2 font-bold ${typeColor(String(it['type']))}`}>
                        {typeLabel(String(it['type']))}
                      </td>
                      <td className="p-2 font-mono text-ink/60">{Number(it['minutes']) || '—'}</td>
                      <td className="p-2 font-mono font-bold text-red-300">
                        {Number(it['amount']).toFixed(2)}
                      </td>
                      <td className="p-2 text-ink/50 text-[11px]">{String(it['reason'])}</td>
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
      <div className="flex gap-2 p-4 border-t border-line">
        <button
          onClick={() => onApply(selectedItems)}
          disabled={applying || selectedItems.length === 0}
          className="erp-btn erp-btn-primary flex-1 flex items-center gap-1 justify-center"
        >
          <CheckCircle2 size={14} />{' '}
          {applying ? 'جاري الحفظ...' : `تأكيد وحفظ (${selectedItems.length}) خصم`}
        </button>
        {!inline && (
          <button onClick={onClose} className="erp-btn erp-btn-ghost">
            إلغاء
          </button>
        )}
      </div>
    </>
  );

  if (inline)
    return (
      <div className="erp-card rounded-xl overflow-hidden" dir="rtl">
        {inner}
      </div>
    );
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      dir="rtl"
    >
      <div className="erp-modal rounded-xl max-w-5xl w-full my-4">{inner}</div>
    </div>
  );
}

export type { AnyRec };
// Unused import kept for type compatibility
export type { UseMutationResult };
