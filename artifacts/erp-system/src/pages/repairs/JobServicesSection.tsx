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
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Check, X, Wrench,
  ChevronRight, Link2, Unlink, Package,
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

interface JobPart {
  id: number;
  product_name: string;
  unit_price: string;
  quantity: string;
  is_returned: boolean;
}

/* ── Constants ────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending:     { label: "في الانتظار", color: "text-white/40 bg-white/5 border-white/10" },
  in_progress: { label: "قيد التنفيذ", color: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
  completed:   { label: "مكتمل",       color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
} as const;

export const EMPTY_FORM = {
  service_type_id:   null as number | null,
  service_type_name: "",
  technician_id:     null as number | null,
  technician_name:   "",
  amount:            "0",
  status:            "pending" as JobService["status"],
  notes:             "",
};

/* ── Props ────────────────────────────────────────────────────── */
interface Props {
  jobId:    number;
  users:    { id: number; name: string }[];
  jobParts: JobPart[];
  locked?:  boolean;
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
}

function ServiceForm({ value, onChange, onSave, onCancel, saving, serviceTypes, users }: ServiceFormProps) {
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

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2.5">
      {/* نوع الخدمة */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] erp-label mb-1 block">نوع الخدمة</label>
          {serviceTypes.length > 0 ? (
            <select
              value={value.service_type_id ?? ""}
              onChange={e => onServiceTypeChange(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">— اختر أو اكتب يدوياً —</option>
              {serviceTypes.map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
            </select>
          ) : null}
        </div>
        <div>
          <label className="text-[10px] erp-label mb-1 block">
            {serviceTypes.length > 0 ? "أو اكتب اسم الخدمة" : "اسم الخدمة"}
          </label>
          <input
            type="text"
            value={value.service_type_name}
            onChange={e => onChange({ ...value, service_type_name: e.target.value })}
            placeholder={serviceTypes.length > 0 ? "خدمة غير مصنّفة..." : "اسم الخدمة..."}
            className="erp-input w-full text-xs"
          />
        </div>
      </div>

      {/* الفني — اختيار من القائمة + حقل نصي حر دائماً */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] erp-label mb-1 block">الفني المنفذ</label>
          {users.length > 0 && (
            <select
              value={value.technician_id ?? ""}
              onChange={e => onTechSelect(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">— اختر من القائمة —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <input
            type="text"
            value={value.technician_name}
            onChange={e => onChange({ ...value, technician_name: e.target.value, technician_id: null })}
            placeholder="أو اكتب اسم الفني..."
            className="erp-input w-full text-xs"
          />
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

/* ══════════════════════════════════════════════════════════════
   LINKED PARTS PANEL — inline per service card
══════════════════════════════════════════════════════════════ */
function LinkedPartsPanel({
  jobId, service, jobParts, sectionLocked,
}: {
  jobId:         number;
  service:       JobService;
  jobParts:      JobPart[];
  sectionLocked: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen]                   = useState(false);
  const [addingPart, setAddingPart]       = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [selectedQty, setSelectedQty]     = useState("1");
  const [editingQtyId, setEditingQtyId]   = useState<number | null>(null);
  const [editingQtyVal, setEditingQtyVal] = useState("");

  const isLocked = sectionLocked || service.commission_locked;
  const linkedPartIds = new Set(service.linked_parts.map(lp => lp.part_id));
  const availableParts = jobParts.filter(p => !p.is_returned && !linkedPartIds.has(p.id));

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/repair-jobs", jobId, "services"] });

  const linkMut = useMutation({
    mutationFn: ({ partId, qty }: { partId: number; qty: number }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services/${service.id}/parts`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: partId, quantity_allocated: qty }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => {
      invalidate();
      setAddingPart(false);
      setSelectedPartId("");
      setSelectedQty("1");
      toast({ title: "✓ تم ربط القطعة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateQtyMut = useMutation({
    mutationFn: ({ partId, qty }: { partId: number; qty: number }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services/${service.id}/parts`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: partId, quantity_allocated: qty }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { invalidate(); setEditingQtyId(null); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const unlinkMut = useMutation({
    mutationFn: (partId: number) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services/${service.id}/parts/${partId}`), {
        method: "DELETE",
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); }),
    onSuccess: () => { invalidate(); toast({ title: "✓ تم إلغاء الربط" }); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleLink = () => {
    if (!selectedPartId) return;
    linkMut.mutate({ partId: Number(selectedPartId), qty: parseFloat(selectedQty) || 1 });
  };

  const startEditQty = (lp: LinkedPart) => {
    setEditingQtyId(lp.id);
    setEditingQtyVal(lp.quantity_allocated);
  };

  const commitEditQty = (lp: LinkedPart) => {
    const qty = parseFloat(editingQtyVal);
    if (!qty || qty <= 0) { setEditingQtyId(null); return; }
    if (qty === parseFloat(lp.quantity_allocated)) { setEditingQtyId(null); return; }
    updateQtyMut.mutate({ partId: lp.part_id, qty });
  };

  const hasLinked = service.linked_parts.length > 0;

  return (
    <div className="mt-0 rounded-lg border border-white/5 bg-white/[0.015] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-white/3 transition-all"
      >
        <span className="flex items-center gap-1.5 text-[10px] text-white/45 font-bold">
          <Package className="w-3 h-3 text-cyan-400/60" />
          القطع المرتبطة
          {hasLinked && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-500/12 border border-cyan-500/20 text-cyan-300/70 tabular-nums">
              {service.linked_parts.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {open && !isLocked && !addingPart && availableParts.length > 0 && (
            <span
              onClick={e => { e.stopPropagation(); setAddingPart(true); }}
              className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              <Link2 className="w-2.5 h-2.5" /> ربط قطعة
            </span>
          )}
          <ChevronRight
            className={`w-3.5 h-3.5 text-white/25 transition-transform duration-150 ${open ? "-rotate-90" : "rotate-90"}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {addingPart && !isLocked && (
            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2">
              <select
                value={selectedPartId}
                onChange={e => setSelectedPartId(e.target.value)}
                autoFocus
                className="erp-input flex-1 text-[10px]"
              >
                <option value="">— اختر القطعة —</option>
                {availableParts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.product_name}
                    {Number(p.unit_price) > 0 ? ` (${Number(p.unit_price).toLocaleString("ar-EG")} ر.س)` : ""}
                  </option>
                ))}
              </select>
              <input
                type="number" min="0.001" step="1"
                value={selectedQty}
                onChange={e => setSelectedQty(e.target.value)}
                className="erp-input w-14 text-[10px] text-center"
                title="الكمية المخصصة"
              />
              <button
                onClick={handleLink}
                disabled={!selectedPartId || linkMut.isPending}
                className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-30 transition-all shrink-0"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={() => { setAddingPart(false); setSelectedPartId(""); setSelectedQty("1"); }}
                className="w-5 h-5 flex items-center justify-center rounded text-white/25 hover:text-white/50 transition-all shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {!hasLinked && !addingPart && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[10px] text-white/25 italic">لا توجد قطع مرتبطة</span>
              {!isLocked && availableParts.length > 0 && (
                <button
                  onClick={() => setAddingPart(true)}
                  className="text-[9px] text-cyan-400/60 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  <Link2 className="w-2.5 h-2.5" /> ربط قطعة
                </button>
              )}
              {!isLocked && jobParts.filter(p => !p.is_returned).length > 0 && availableParts.length === 0 && (
                <span className="text-[9px] text-white/20">كل القطع مرتبطة بالفعل</span>
              )}
              {jobParts.filter(p => !p.is_returned).length === 0 && (
                <span className="text-[9px] text-white/20">لا توجد قطع في البطاقة</span>
              )}
            </div>
          )}

          {service.linked_parts.map(lp => {
            const unitPrice = Number(lp.unit_price) || 0;
            const qty       = Number(lp.quantity_allocated) || 1;
            const cost      = unitPrice * qty;
            const isEditingThis = editingQtyId === lp.id;

            return (
              <div key={lp.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 group">
                <span className="flex-1 text-[10px] text-white/75 font-medium truncate min-w-0">{lp.product_name}</span>

                {isEditingThis && !isLocked ? (
                  <input
                    type="number" min="0.001" step="1"
                    value={editingQtyVal}
                    autoFocus
                    onChange={e => setEditingQtyVal(e.target.value)}
                    onBlur={() => commitEditQty(lp)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitEditQty(lp);
                      if (e.key === "Escape") setEditingQtyId(null);
                    }}
                    className="erp-input w-14 text-[10px] text-center py-0.5"
                  />
                ) : (
                  <button
                    onClick={() => { if (!isLocked) startEditQty(lp); }}
                    disabled={isLocked}
                    title={isLocked ? "" : "انقر لتعديل الكمية"}
                    className={`text-[10px] tabular-nums font-mono px-1.5 py-0.5 rounded transition-all ${
                      isLocked ? "text-white/35 cursor-default" : "text-white/50 hover:text-white/80 hover:bg-white/5 cursor-pointer"
                    }`}
                  >
                    ×{qty % 1 === 0 ? qty : qty.toFixed(2)}
                  </button>
                )}

                {unitPrice > 0 && (
                  <span className="text-[10px] font-mono tabular-nums text-cyan-300/65 shrink-0">
                    {cost.toLocaleString("ar-EG")} ر.س
                  </span>
                )}

                {!isLocked && (
                  <button
                    onClick={() => { if (confirm(`إلغاء ربط "${lp.product_name}" من هذه الخدمة؟`)) unlinkMut.mutate(lp.part_id); }}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    title="إلغاء الربط"
                  >
                    <Unlink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {hasLinked && (() => {
            const total = service.linked_parts.reduce((s, lp) =>
              s + (Number(lp.unit_price) || 0) * (Number(lp.quantity_allocated) || 1), 0);
            return total > 0 ? (
              <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-0.5">
                <span className="text-[9px] text-white/30">إجمالي تكلفة القطع المرتبطة</span>
                <span className="text-[10px] font-black text-cyan-300/70 font-mono tabular-nums">
                  {total.toLocaleString("ar-EG")} ر.س
                </span>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export function JobServicesSection({ jobId, users, jobParts, locked = false }: Props) {
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

  const { data: servicesRaw, isLoading } = useQuery<JobService[]>({
    queryKey: ["/api/repair-jobs", jobId, "services"],
    queryFn:  () => authFetch(api(`/api/repair-jobs/${jobId}/services`)).then(r => r.json()),
    staleTime: 10_000,
  });
  const services: JobService[] = safeArray(servicesRaw) as JobService[];
  const totalAmount = services.reduce((s, sv) => s + (Number(sv.amount) || 0), 0);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/repair-jobs", jobId, "services"] });

  const createMut = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services`), {
        method: "POST",
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
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => { invalidate(); setAdding(false); setForm({ ...EMPTY_FORM }); toast({ title: "✓ تمت إضافة الخدمة" }); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof EMPTY_FORM }) =>
      authFetch(api(`/api/repair-jobs/${jobId}/services/${id}`), {
        method: "PATCH",
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
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
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
                        </div>

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

                      <div className="border-t border-white/5 mx-3 mb-2">
                        <LinkedPartsPanel
                          jobId={jobId}
                          service={sv}
                          jobParts={jobParts}
                          sectionLocked={locked}
                        />
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
