/**
 * JobServicesSection.tsx — قسم بنود الخدمة داخل تفاصيل بطاقة الصيانة
 *
 * يعرض خدمات البطاقة ويسمح بإضافة/تعديل/حذف البنود.
 * commission_value لا يُعرض هنا — يظهر في إعدادات الصيانة فقط.
 *
 * TODO (Phase 2):
 *   - ربط القطع بالخدمات (repair_job_service_parts)
 *   - حساب commission_computed عند التسليم في shipping.ts
 *   - معالجة خصومات البطاقة عند تحديد الكوميشن
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Wrench, ChevronRight } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/safe-data";

interface ServiceType {
  id: number;
  name_ar: string;
  is_active: boolean;
}

interface JobService {
  id: number;
  service_type_id: number | null;
  service_type_name_snapshot: string;
  technician_id: number | null;
  technician_name: string;
  amount: string;
  status: "pending" | "in_progress" | "completed";
  notes: string | null;
  commission_locked: boolean;
  linked_parts: Array<{ id: number; part_id: number; product_name: string; quantity_allocated: string }>;
}

const STATUS_CONFIG = {
  pending:     { label: "في الانتظار", color: "text-white/40 bg-white/5 border-white/10" },
  in_progress: { label: "قيد التنفيذ",  color: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  completed:   { label: "مكتمل",        color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
} as const;

const EMPTY_FORM = {
  service_type_id:  null as number | null,
  service_type_name: "",
  technician_id:    null as number | null,
  technician_name:  "",
  amount:           "0",
  status:           "pending" as JobService["status"],
  notes:            "",
};

interface Props {
  jobId: number;
  users: { id: number; name: string }[];
  locked?: boolean;
}

export function JobServicesSection({ jobId, users, locked = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen]         = useState(true);
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  /* ── جلب أنواع الخدمات والبنود ─────────────────────────── */
  const { data: serviceTypesRaw } = useQuery<ServiceType[]>({
    queryKey: ["/api/repair-service-types"],
    queryFn:  () => authFetch(api("/api/repair-service-types")).then(r => r.json()),
    staleTime: 30_000,
  });
  const serviceTypes: ServiceType[] = (safeArray(serviceTypesRaw) as ServiceType[]).filter(s => s.is_active);

  const { data: servicesRaw, isLoading } = useQuery<JobService[]>({
    queryKey: ["/api/repair-jobs", jobId, "services"],
    queryFn:  () => authFetch(api(`/api/repair-jobs/${jobId}/services`)).then(r => r.json()),
    staleTime: 10_000,
  });
  const services: JobService[] = safeArray(servicesRaw) as JobService[];

  /* ── الإجمالي ─────────────────────────────────────────── */
  const totalAmount = services.reduce((s, sv) => s + (Number(sv.amount) || 0), 0);

  /* ── Mutations ────────────────────────────────────────── */
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/repair-jobs", jobId, "services"] });

  const createMut = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) => {
      const payload: Record<string, unknown> = {
        service_type_id:    body.service_type_id,
        service_type_name:  body.service_type_name || undefined,
        technician_id:      body.technician_id,
        technician_name:    body.technician_name,
        amount:             Number(body.amount),
        status:             body.status,
        notes:              body.notes || null,
      };
      return authFetch(api(`/api/repair-jobs/${jobId}/services`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); });
    },
    onSuccess: () => { invalidate(); setAdding(false); setForm({ ...EMPTY_FORM }); toast({ title: "✓ تمت إضافة الخدمة" }); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof EMPTY_FORM }) => {
      const payload: Record<string, unknown> = {
        service_type_id:    body.service_type_id,
        service_type_name:  body.service_type_name || undefined,
        technician_id:      body.technician_id,
        technician_name:    body.technician_name,
        amount:             Number(body.amount),
        status:             body.status,
        notes:              body.notes || null,
      };
      return authFetch(api(`/api/repair-jobs/${jobId}/services/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); });
    },
    onSuccess: () => { invalidate(); setEditId(null); toast({ title: "✓ تم التحديث" }); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services/${id}`), { method: "DELETE" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); }),
    onSuccess: () => { invalidate(); toast({ title: "✓ تم الحذف" }); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  /* ── مساعد: تحديد اسم الخدمة من ID ─────────────────── */
  function onServiceTypeChange(id: string, setF: (v: typeof EMPTY_FORM) => void, current: typeof EMPTY_FORM) {
    const numId = id ? Number(id) : null;
    const st = serviceTypes.find(s => s.id === numId);
    setF({ ...current, service_type_id: numId, service_type_name: st?.name_ar ?? current.service_type_name });
  }

  function onTechChange(id: string, setF: (v: typeof EMPTY_FORM) => void, current: typeof EMPTY_FORM) {
    const numId = id ? Number(id) : null;
    const u = users.find(u => u.id === numId);
    setF({ ...current, technician_id: numId, technician_name: u?.name ?? current.technician_name });
  }

  /* ── نموذج الإضافة/التعديل ────────────────────────── */
  function ServiceForm({
    value, onChange, onSave, onCancel, saving,
  }: {
    value: typeof EMPTY_FORM;
    onChange: (v: typeof EMPTY_FORM) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
  }) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2.5">
        {/* نوع الخدمة */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] erp-label mb-1 block">نوع الخدمة</label>
            {serviceTypes.length > 0 ? (
              <select
                value={value.service_type_id ?? ""}
                onChange={e => onServiceTypeChange(e.target.value, onChange, value)}
                className="erp-input w-full text-xs"
              >
                <option value="">— اختر أو اكتب يدوياً —</option>
                {serviceTypes.map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={value.service_type_name}
                onChange={e => onChange({ ...value, service_type_name: e.target.value })}
                placeholder="اسم الخدمة..."
                className="erp-input w-full text-xs"
              />
            )}
          </div>
          {/* إذا كان هناك أنواع محددة — حقل نص يدوي بديل */}
          {serviceTypes.length > 0 && !value.service_type_id && (
            <div>
              <label className="text-[10px] erp-label mb-1 block">أو اكتب اسم الخدمة</label>
              <input
                type="text"
                value={value.service_type_name}
                onChange={e => onChange({ ...value, service_type_name: e.target.value })}
                placeholder="خدمة غير مصنّفة..."
                className="erp-input w-full text-xs"
              />
            </div>
          )}
        </div>

        {/* الفني والمبلغ */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] erp-label mb-1 block">الفني المنفذ</label>
            <select
              value={value.technician_id ?? ""}
              onChange={e => onTechChange(e.target.value, onChange, value)}
              className="erp-input w-full text-xs"
            >
              <option value="">— اختر الفني —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {value.technician_id && !value.technician_name && (
              <input
                type="text"
                value={value.technician_name}
                onChange={e => onChange({ ...value, technician_name: e.target.value })}
                placeholder="اسم الفني..."
                className="erp-input w-full text-xs mt-1"
              />
            )}
          </div>
          <div>
            <label className="text-[10px] erp-label mb-1 block">مبلغ الخدمة</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.amount}
              onChange={e => onChange({ ...value, amount: e.target.value })}
              className="erp-input w-full text-xs"
            />
          </div>
        </div>

        {/* الحالة والملاحظات */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] erp-label mb-1 block">الحالة</label>
            <select
              value={value.status}
              onChange={e => onChange({ ...value, status: e.target.value as JobService["status"] })}
              className="erp-input w-full text-xs"
            >
              <option value="pending">في الانتظار</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="completed">مكتمل</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] erp-label mb-1 block">ملاحظة (اختياري)</label>
            <input
              type="text"
              value={value.notes}
              onChange={e => onChange({ ...value, notes: e.target.value })}
              placeholder="ملاحظة اختيارية..."
              className="erp-input w-full text-xs"
            />
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex items-center justify-end gap-2 pt-0.5">
          <button
            onClick={onCancel}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/60 transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={onSave}
            disabled={(!value.service_type_id && !value.service_type_name.trim()) || !value.technician_name.trim() || saving}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-30 transition-all"
          >
            <Check className="w-3 h-3" /> حفظ
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="glass-panel rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden">
      {/* الرأس */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-white/3 transition-all"
      >
        <p className="text-[11px] text-emerald-300/80 font-bold flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" /> بنود الخدمة
          {services.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300/70 font-medium tabular-nums">
              {services.length}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {open && !adding && !locked && (
            <span
              onClick={e => { e.stopPropagation(); setAdding(true); setEditId(null); setForm({ ...EMPTY_FORM }); }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" /> إضافة خدمة
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-emerald-400/50 transition-transform duration-200 ${open ? "-rotate-90" : "rotate-90"}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2.5">

          {/* نموذج الإضافة */}
          {adding && (
            <ServiceForm
              value={form}
              onChange={setForm}
              onSave={() => createMut.mutate(form)}
              onCancel={() => { setAdding(false); setForm({ ...EMPTY_FORM }); }}
              saving={createMut.isPending}
            />
          )}

          {/* حالة فارغة */}
          {!isLoading && services.length === 0 && !adding && (
            <div className="text-center py-6 space-y-2">
              <Wrench className="w-6 h-6 text-emerald-400/30 mx-auto" />
              <p className="text-[11px] text-white/35">لم تُضف بنود خدمة بعد</p>
              {!locked && (
                <button
                  onClick={() => setAdding(true)}
                  className="text-[11px] text-emerald-400/70 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> أضف أول خدمة
                </button>
              )}
            </div>
          )}

          {/* قائمة البنود */}
          {services.length > 0 && (
            <div className="space-y-1.5">
              {services.map(sv => (
                <div key={sv.id}>
                  {editId === sv.id ? (
                    <ServiceForm
                      value={editForm}
                      onChange={setEditForm}
                      onSave={() => updateMut.mutate({ id: sv.id, body: editForm })}
                      onCancel={() => setEditId(null)}
                      saving={updateMut.isPending}
                    />
                  ) : (
                    <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 group">
                      {/* المحتوى */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-white/90">{sv.service_type_name_snapshot}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_CONFIG[sv.status].color}`}>
                            {STATUS_CONFIG[sv.status].label}
                          </span>
                          {sv.commission_locked && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/8 text-amber-400/60 font-medium">
                              مقفول
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-white/35">
                          <span>{sv.technician_name}</span>
                          {Number(sv.amount) > 0 && (
                            <span className="font-mono tabular-nums text-emerald-300/70">
                              {Number(sv.amount).toLocaleString("ar-EG")} ر.س
                            </span>
                          )}
                          {sv.linked_parts.length > 0 && (
                            <span>{sv.linked_parts.length} قطعة مرتبطة</span>
                          )}
                        </div>
                        {sv.notes && (
                          <p className="text-[10px] text-white/30 italic">{sv.notes}</p>
                        )}
                      </div>

                      {/* الإجراءات */}
                      {!locked && !sv.commission_locked && (
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditId(sv.id);
                              setEditForm({
                                service_type_id:   sv.service_type_id,
                                service_type_name: sv.service_type_name_snapshot,
                                technician_id:     sv.technician_id,
                                technician_name:   sv.technician_name,
                                amount:            sv.amount,
                                status:            sv.status,
                                notes:             sv.notes ?? "",
                              });
                              setAdding(false);
                            }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { if (confirm("حذف بند الخدمة؟")) deleteMut.mutate(sv.id); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* إجمالي مبالغ الخدمات */}
              {totalAmount > 0 && (
                <div className="flex items-center justify-between border-t border-emerald-500/10 pt-2 mt-1">
                  <span className="text-[10px] text-white/40">إجمالي مبالغ الخدمات</span>
                  <span className="text-[11px] font-black text-emerald-300 font-mono tabular-nums">
                    {totalAmount.toLocaleString("ar-EG")} ر.س
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
