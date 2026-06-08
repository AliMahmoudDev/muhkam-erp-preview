/**
 * ServiceTypesTab.tsx — إعدادات أنواع خدمات الصيانة والكوميشن
 *
 * TODO (Phase 2 — Discount Handling):
 *   - commission_value يُحسب حالياً على amount الخدمة الكامل
 *   - في المرحلة الثانية، قد يحتاج الحساب لأخذ خصومات البطاقة بعين الاعتبار
 *   - انظر TODO في lib/db/src/schema/repairs.ts للتفاصيل
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, GripVertical, AlertCircle } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ServiceType {
  id: number;
  name_ar: string;
  commission_type: "profit_based" | "amount_based" | "fixed";
  commission_value: string;
  is_active: boolean;
  sort_order: number;
}

const COMMISSION_TYPE_LABELS: Record<string, { label: string; hint: string; suffix: string }> = {
  profit_based: { label: "% من الربح الصافي", hint: "نسبة من (مبلغ الخدمة − تكلفة قطعها)", suffix: "%" },
  amount_based: { label: "% من مبلغ الخدمة",  hint: "نسبة من مبلغ الخدمة المسجّل",          suffix: "%" },
  fixed:        { label: "مبلغ ثابت",          hint: "كوميشن ثابت بغض النظر عن المبلغ",      suffix: "ج.م" },
};

const EMPTY_FORM = { name_ar: "", commission_type: "profit_based" as ServiceType["commission_type"], commission_value: "0", is_active: true };

export default function ServiceTypesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  /* ── جلب البيانات ─────────────────────────────────────── */
  const { data: types = [], isLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/repair-service-types"],
    queryFn:  () => authFetch(api("/api/repair-service-types")).then(r => r.json()),
    staleTime: 10_000,
  });

  /* ── Mutations ────────────────────────────────────────── */
  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) =>
      authFetch(api("/api/repair-service-types"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, commission_value: Number(body.commission_value) }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/repair-service-types"] });
      setAdding(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "✓ تمت الإضافة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<typeof EMPTY_FORM> }) =>
      authFetch(api(`/api/repair-service-types/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, commission_value: Number(body.commission_value) }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/repair-service-types"] });
      setEditId(null);
      toast({ title: "✓ تم التحديث" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/repair-service-types/${id}`), { method: "DELETE" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/repair-service-types"] });
      toast({ title: "✓ تم الحذف" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (t: ServiceType) =>
    updateMutation.mutate({ id: t.id, body: { is_active: !t.is_active } });

  /* ── Form component ───────────────────────────────────── */
  function ServiceForm({
    value, onChange, onSave, onCancel, saving,
  }: {
    value: typeof EMPTY_FORM;
    onChange: (v: typeof EMPTY_FORM) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
  }) {
    const meta = COMMISSION_TYPE_LABELS[value.commission_type];
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 space-y-3">
        {/* اسم الخدمة */}
        <div>
          <label className="text-[10px] text-white/50 mb-1 block font-bold">اسم الخدمة</label>
          <input
            type="text"
            value={value.name_ar}
            onChange={e => onChange({ ...value, name_ar: e.target.value })}
            placeholder="مثال: تغيير شاشة، تصليح لوحة..."
            className="erp-input w-full text-xs"
            autoFocus
          />
        </div>
        {/* نوع الكوميشن */}
        <div>
          <label className="text-[10px] text-white/50 mb-1.5 block font-bold">نوع الكوميشن</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.entries(COMMISSION_TYPE_LABELS) as [ServiceType["commission_type"], typeof COMMISSION_TYPE_LABELS[string]][]).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ ...value, commission_type: key })}
                className={`text-center py-2 px-2 rounded-lg border text-[10px] font-bold transition-all ${
                  value.commission_type === key
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-white/[0.03] border-white/8 text-white/45 hover:text-white/70 hover:border-white/15"
                }`}
              >
                {meta.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/35 mt-1">{meta.hint}</p>
        </div>
        {/* قيمة الكوميشن */}
        <div>
          <label className="text-[10px] text-white/50 mb-1 block font-bold">
            {value.commission_type === "fixed" ? "المبلغ الثابت" : "النسبة المئوية"}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max={value.commission_type !== "fixed" ? 100 : undefined}
              step="0.01"
              value={value.commission_value}
              onChange={e => onChange({ ...value, commission_value: e.target.value })}
              className="erp-input flex-1 text-xs"
            />
            <span className="text-[11px] text-white/40 font-bold shrink-0">{meta.suffix}</span>
          </div>
        </div>
        {/* أزرار */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => onChange({ ...value, is_active: !value.is_active })}
              className={`w-8 h-4 rounded-full relative transition-colors ${value.is_active ? "bg-emerald-500/70" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${value.is_active ? "right-0.5" : "left-0.5"}`} />
            </div>
            <span className="text-[10px] text-white/50">{value.is_active ? "نشط" : "معطّل"}</span>
          </label>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/60 transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={onSave}
              disabled={!value.name_ar.trim() || saving}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/35 text-amber-300 hover:bg-amber-500/30 disabled:opacity-30 transition-all"
            >
              <Check className="w-3 h-3" /> حفظ
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0 border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-black text-white">أنواع الخدمات والكوميشن</h3>
            <p className="text-[11px] text-white/40 mt-0.5">
              عرّف أنواع خدمات الصيانة وقواعد احتساب كوميشن الفنيين
            </p>
          </div>
          {!adding && (
            <button
              onClick={() => { setAdding(true); setEditId(null); setForm({ ...EMPTY_FORM }); }}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> إضافة نوع خدمة
            </button>
          )}
        </div>

        {/* تنبيه الكوميشن للإدارة فقط */}
        <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/15">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-300/60 leading-relaxed">
            قيم الكوميشن تظهر في هذه الإعدادات فقط — لا تظهر للفنيين. الكوميشن يُحسب ويُجمَّد تلقائياً عند تسليم البطاقة (المرحلة الثانية).
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">

        {/* نموذج الإضافة */}
        {adding && (
          <ServiceForm
            value={form}
            onChange={setForm}
            onSave={() => createMutation.mutate(form)}
            onCancel={() => { setAdding(false); setForm({ ...EMPTY_FORM }); }}
            saving={createMutation.isPending}
          />
        )}

        {/* قائمة الأنواع */}
        {isLoading && (
          <div className="text-center py-10 text-white/30 text-sm">جارٍ التحميل...</div>
        )}

        {!isLoading && types.length === 0 && !adding && (
          <div className="text-center py-14 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
              <GripVertical className="w-5 h-5 text-amber-400/40" />
            </div>
            <p className="text-[12px] text-white/35">لم تُضف أنواع خدمات بعد</p>
            <button
              onClick={() => setAdding(true)}
              className="text-[11px] text-amber-400/70 hover:text-amber-300 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> أضف أول نوع خدمة
            </button>
          </div>
        )}

        {types.map(t => (
          <div key={t.id}>
            {editId === t.id ? (
              <ServiceForm
                value={editForm}
                onChange={setEditForm}
                onSave={() => updateMutation.mutate({ id: t.id, body: editForm })}
                onCancel={() => setEditId(null)}
                saving={updateMutation.isPending}
              />
            ) : (
              <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                t.is_active
                  ? "border-white/8 bg-white/[0.025] hover:bg-white/[0.04]"
                  : "border-white/4 bg-white/[0.01] opacity-50"
              }`}>
                {/* الاسم والنوع */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-white/90">{t.name_ar}</span>
                    {!t.is_active && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/8">معطّل</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white/35">
                      {COMMISSION_TYPE_LABELS[t.commission_type]?.label}
                    </span>
                    <span className="text-[10px] font-mono text-amber-400/70">
                      {Number(t.commission_value).toLocaleString("ar-EG")}
                      {t.commission_type === "fixed" ? " ج.م" : "%"}
                    </span>
                    <span className="text-white/10 text-[9px]">·</span>
                    <span className="text-[9px] text-white/20 font-mono">ترتيب {t.sort_order}</span>
                  </div>
                </div>

                {/* الإجراءات */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(t)}
                    title={t.is_active ? "تعطيل" : "تفعيل"}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                  >
                    {t.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => { setEditId(t.id); setEditForm({ name_ar: t.name_ar, commission_type: t.commission_type, commission_value: t.commission_value, is_active: t.is_active }); setAdding(false); }}
                    title="تعديل"
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`حذف "${t.name_ar}"؟`)) deleteMutation.mutate(t.id); }}
                    title="حذف"
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
