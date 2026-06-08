/**
 * JobServicesSection.tsx — قسم بنود الخدمة داخل تفاصيل بطاقة الصيانة
 *
 * Phase 1.5: ربط القطع بالخدمات (inline UI)
 *
 * IMPORTANT: ServiceForm يجب أن يبقى خارج JobServicesSection
 * لأن تعريفه داخل الدالة الأم يُسبب إعادة إنشاء كامل في كل render
 * مما يفقد التركيز بعد كل ضغطة مفتاح.
 *
 * TODO (Phase 2):
 *   - commission_computed يُحسب ويُكتب عند التسليم في delivery route
 *   - معالجة خصومات البطاقة عند تحديد قاعدة الكوميشن
 */
import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Check, X, Wrench,
  ChevronRight, Package, Search,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/safe-data";

/* ── Types ────────────────────────────────────────────────────── */
interface ServiceType {
  id: number;
  name_ar: string;
  is_active: boolean;
}

interface LinkedPart {
  id: number;
  part_id: number;
  product_name: string;
  quantity_allocated: string;
  unit_price: string;
}

interface Product {
  id: number;
  name: string;
  sell_price: string | number;
  warehouse_id?: number | null;
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
  linked_parts: LinkedPart[];
}

/* ── Constants ────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending:     { label: "في الانتظار", color: "text-white/40 bg-white/5 border-white/10" },
  in_progress: { label: "قيد التنفيذ", color: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  completed:   { label: "مكتمل",       color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
} as const;

const EMPTY_FORM = {
  service_type_id:   null as number | null,
  service_type_name: "",
  technician_id:     null as number | null,
  technician_name:   "",
  amount:            "0",
  status:            "pending" as JobService["status"],
  notes:             "",
  pending_part:      null as { product_id: number; product_name: string; unit_price: number; warehouse_id: number | null } | null,
};

/* ── Props ────────────────────────────────────────────────────── */
interface Props {
  jobId:   number;
  users:   { id: number; name: string }[];
  locked?: boolean;
}

/* ══════════════════════════════════════════════════════════════
   SERVICE FORM — مُعرَّف خارج JobServicesSection تماماً
   (تعريفه داخل الدالة يُسبب فقدان التركيز بعد كل حرف)
══════════════════════════════════════════════════════════════ */
interface ServiceFormProps {
  value:        typeof EMPTY_FORM;
  onChange:     (v: typeof EMPTY_FORM) => void;
  onSave:       () => void;
  onCancel:     () => void;
  saving:       boolean;
  serviceTypes: ServiceType[];
  users:        { id: number; name: string }[];
  products:     Product[];
}

function ServiceForm({ value, onChange, onSave, onCancel, saving, serviceTypes, users, products }: ServiceFormProps) {
  const dropRef = useRef<HTMLDivElement>(null);
  const [partSearch, setPartSearch]     = useState("");
  const [showPartDrop, setShowPartDrop] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!partSearch.trim()) return products.slice(0, 25);
    const q = partSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 25);
  }, [products, partSearch]);

  function onServiceTypeChange(id: string) {
    const numId = id ? Number(id) : null;
    const st = serviceTypes.find(s => s.id === numId);
    onChange({ ...value, service_type_id: numId, service_type_name: st?.name_ar ?? value.service_type_name });
  }

  function onTechSelect(id: string) {
    const numId = id ? Number(id) : null;
    const u = users.find(u => u.id === numId);
    onChange({ ...value, technician_id: numId, technician_name: u?.name ?? value.technician_name });
  }

  function selectPart(p: Product) {
    onChange({
      ...value,
      pending_part: {
        product_id:   p.id,
        product_name: p.name,
        unit_price:   Number(p.sell_price) || 0,
        warehouse_id: p.warehouse_id ?? null,
      },
    });
    setPartSearch("");
    setShowPartDrop(false);
  }

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2">

      {/* صف ١: نوع الخدمة | قطعة مستخدمة | المبلغ */}
      <div className="grid grid-cols-[1fr_1fr_6rem] gap-2">
        <div>
          <label className="text-[10px] erp-label mb-1 block">نوع الخدمة</label>
          {serviceTypes.length > 0 ? (
            <select
              value={value.service_type_id ?? ""}
              onChange={e => onServiceTypeChange(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">— اختر أو اكتب —</option>
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

        {/* ─── قطعة مستخدمة ─── */}
        <div className="relative" ref={dropRef}>
          <label className="text-[10px] erp-label mb-1 block">قطعة مستخدمة</label>
          {value.pending_part ? (
            <div className="flex items-center gap-1 erp-input py-1.5 min-h-[2rem]">
              <Package className="w-3 h-3 text-cyan-400/70 shrink-0" />
              <span className="flex-1 text-[10px] text-cyan-300/90 truncate font-medium">
                {value.pending_part.product_name}
              </span>
              {value.pending_part.unit_price > 0 && (
                <span className="text-[9px] text-white/35 font-mono tabular-nums shrink-0">
                  {value.pending_part.unit_price.toLocaleString("ar-EG")}
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange({ ...value, pending_part: null })}
                className="w-4 h-4 flex items-center justify-center rounded text-white/25 hover:text-red-400 transition-colors shrink-0"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={partSearch}
                onChange={e => { setPartSearch(e.target.value); setShowPartDrop(true); }}
                onFocus={() => setShowPartDrop(true)}
                onBlur={() => setTimeout(() => setShowPartDrop(false), 180)}
                placeholder="ابحث عن قطعة..."
                className="erp-input w-full text-xs pr-7"
              />
              {showPartDrop && (
                <div className="absolute z-50 top-full mt-0.5 right-0 left-0 rounded-lg border border-white/10 bg-[#0f1117] shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-white/30 text-center">لا توجد نتائج</div>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => selectPart(p)}
                        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-cyan-500/10 transition-colors text-right"
                      >
                        <span className="text-[10px] text-white/80 truncate">{p.name}</span>
                        {Number(p.sell_price) > 0 && (
                          <span className="text-[9px] text-cyan-300/60 font-mono tabular-nums shrink-0 mr-2">
                            {Number(p.sell_price).toLocaleString("ar-EG")} ر.س
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] erp-label mb-1 block">المبلغ</label>
          <input
            type="number" min="0" step="0.01"
            value={value.amount}
            onChange={e => onChange({ ...value, amount: e.target.value })}
            className="erp-input w-full text-xs text-left"
            dir="ltr"
          />
        </div>
      </div>

      {/* صف ٢: الفني (ذكي) | الحالة | ملاحظة */}
      <div className="grid grid-cols-[1fr_7rem_1fr] gap-2">
        <div>
          <label className="text-[10px] erp-label mb-1 block">الفني المنفذ</label>
          {users.length > 0 ? (
            <>
              <select
                value={value.technician_id ?? ""}
                onChange={e => onTechSelect(e.target.value)}
                className="erp-input w-full text-xs"
              >
                <option value="">— اختر من القائمة —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {!value.technician_id && (
                <input
                  type="text"
                  value={value.technician_name}
                  onChange={e => onChange({ ...value, technician_name: e.target.value, technician_id: null })}
                  placeholder="أو اكتب اسم الفني..."
                  className="erp-input w-full text-xs mt-1"
                />
              )}
            </>
          ) : (
            <input
              type="text"
              value={value.technician_name}
              onChange={e => onChange({ ...value, technician_name: e.target.value, technician_id: null })}
              placeholder="اسم الفني..."
              className="erp-input w-full text-xs"
            />
          )}
        </div>

        <div>
          <label className="text-[10px] erp-label mb-1 block">الحالة</label>
          <select
            value={value.status}
            onChange={e => onChange({ ...value, status: e.target.value as JobService["status"] })}
            className="erp-input w-full text-xs"
          >
            <option value="pending">انتظار</option>
            <option value="in_progress">جاري</option>
            <option value="completed">مكتمل</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] erp-label mb-1 block">ملاحظة</label>
          <input
            type="text"
            value={value.notes}
            onChange={e => onChange({ ...value, notes: e.target.value })}
            placeholder="اختياري..."
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

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export function JobServicesSection({ jobId, users, locked = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen]         = useState(true);
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const { data: serviceTypesRaw } = useQuery<ServiceType[]>({
    queryKey: ["/api/repair-service-types"],
    queryFn:  () => authFetch(api("/api/repair-service-types")).then(r => r.json()),
    staleTime: 30_000,
  });
  const serviceTypes: ServiceType[] = (safeArray(serviceTypesRaw) as ServiceType[]).filter(s => s.is_active);

  const { data: productsRaw } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn:  () => authFetch(api("/api/products")).then(r => r.json()),
    staleTime: 60_000,
  });
  const products: Product[] = safeArray(productsRaw) as Product[];

  const { data: servicesRaw, isLoading } = useQuery<JobService[]>({
    queryKey: ["/api/repair-jobs", jobId, "services"],
    queryFn:  () => authFetch(api(`/api/repair-jobs/${jobId}/services`)).then(r => r.json()),
    staleTime: 10_000,
  });
  const services: JobService[] = safeArray(servicesRaw) as JobService[];
  const totalAmount = services.reduce((s, sv) => s + (Number(sv.amount) || 0), 0);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/repair-jobs", jobId, "services"] });

  /* ── مساعد: إضافة قطعة للبطاقة ثم ربطها بخدمة ── */
  async function addAndLinkPart(
    serviceId: number,
    part: NonNullable<typeof EMPTY_FORM["pending_part"]>,
  ) {
    const partRes = await authFetch(api(`/api/repair-jobs/${jobId}/parts`), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id:   part.product_id,
        product_name: part.product_name,
        quantity:     1,
        unit_price:   part.unit_price,
        source:       "internal",
        warehouse_id: part.warehouse_id,
      }),
    });
    if (!partRes.ok) throw new Error((await partRes.json()).error ?? "تعذّر إضافة القطعة");
    const jobPart = await partRes.json() as { id: number };

    const linkRes = await authFetch(api(`/api/repair-jobs/${jobId}/services/${serviceId}/parts`), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ part_id: jobPart.id, quantity_allocated: 1 }),
    });
    if (!linkRes.ok) throw new Error((await linkRes.json()).error ?? "تعذّر ربط القطعة");
    qc.invalidateQueries({ queryKey: ["/api/repair-jobs", jobId] });
  }

  const createMut = useMutation({
    mutationFn: async (body: typeof EMPTY_FORM) => {
      const r = await authFetch(api(`/api/repair-jobs/${jobId}/services`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type_id:   body.service_type_id,
          service_type_name: body.service_type_name || undefined,
          technician_id:     body.technician_id,
          technician_name:   body.technician_name,
          amount:            Number(body.amount),
          status:            body.status,
          notes:             body.notes || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const service = await r.json() as { id: number };
      return { service, pendingPart: body.pending_part };
    },
    onSuccess: async ({ service, pendingPart }) => {
      let partLinked = false;
      if (pendingPart) {
        try { await addAndLinkPart(service.id, pendingPart); partLinked = true; } catch { /* non-fatal */ }
      }
      invalidate();
      setAdding(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: partLinked ? "✓ تمت إضافة الخدمة والقطعة" : "✓ تمت إضافة الخدمة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: typeof EMPTY_FORM }) => {
      const r = await authFetch(api(`/api/repair-jobs/${jobId}/services/${id}`), {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type_id:   body.service_type_id,
          service_type_name: body.service_type_name || undefined,
          technician_id:     body.technician_id,
          technician_name:   body.technician_name,
          amount:            Number(body.amount),
          status:            body.status,
          notes:             body.notes || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return { serviceId: id, pendingPart: body.pending_part };
    },
    onSuccess: async ({ serviceId, pendingPart }) => {
      let partLinked = false;
      if (pendingPart) {
        try { await addAndLinkPart(serviceId, pendingPart); partLinked = true; } catch { /* non-fatal */ }
      }
      invalidate();
      setEditId(null);
      toast({ title: partLinked ? "✓ تم التحديث وربط القطعة" : "✓ تم التحديث" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services/${id}`), { method: "DELETE" })
        .then(async r => { if (!r.ok) throw new Error((await r.json()).error); }),
    onSuccess: () => { invalidate(); toast({ title: "✓ تم الحذف" }); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

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
          {totalAmount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300/50 font-mono tabular-nums">
              {totalAmount.toLocaleString("ar-EG")} ر.س
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
          {adding && (
            <ServiceForm
              value={form}
              onChange={setForm}
              onSave={() => createMut.mutate(form)}
              onCancel={() => { setAdding(false); setForm({ ...EMPTY_FORM }); }}
              saving={createMut.isPending}
              serviceTypes={serviceTypes}
              users={users}
              products={products}
            />
          )}

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

          {services.length > 0 && (
            <div className="space-y-2">
              {services.map(sv => (
                <div key={sv.id}>
                  {editId === sv.id ? (
                    <ServiceForm
                      value={editForm}
                      onChange={setEditForm}
                      onSave={() => updateMut.mutate({ id: sv.id, body: editForm })}
                      onCancel={() => setEditId(null)}
                      saving={updateMut.isPending}
                      serviceTypes={serviceTypes}
                      users={users}
                      products={products}
                    />
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-start gap-2 px-3 py-2.5 group">
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
                          </div>
                          {sv.notes && <p className="text-[10px] text-white/30 italic">{sv.notes}</p>}

                          {/* قطع مرتبطة — chips للقراءة فقط */}
                          {sv.linked_parts.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {sv.linked_parts.map(lp => {
                                const cost = (Number(lp.unit_price) || 0) * (Number(lp.quantity_allocated) || 1);
                                return (
                                  <span
                                    key={lp.id}
                                    className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border border-cyan-500/20 bg-cyan-500/8 text-cyan-300/75 font-medium"
                                  >
                                    <Package className="w-2 h-2 shrink-0" />
                                    {lp.product_name}
                                    {cost > 0 && (
                                      <span className="font-mono tabular-nums text-cyan-400/50">
                                        {cost.toLocaleString("ar-EG")}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {!locked && !sv.commission_locked && (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditId(sv.id);
                                setEditForm({
                                  ...EMPTY_FORM,
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
                              title="تعديل"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => { if (confirm("حذف بند الخدمة؟")) deleteMut.mutate(sv.id); }}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

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
