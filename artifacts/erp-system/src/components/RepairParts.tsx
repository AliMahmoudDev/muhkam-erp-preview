/**
 * RepairParts.tsx
 *
 * مكوّن إدارة قطع الغيار داخل تفاصيل بطاقة الصيانة.
 * - يعرض قائمة قطع الغيار المرتبطة بالبطاقة (يأتيها من تفاصيل الـ job).
 * - يتيح إضافة قطعة جديدة (اسم القطعة، الكمية، السعر، المصدر) عبر POST.
 * - يتيح حذف قطعة عبر DELETE.
 * - يعرض إجمالي تكلفة القطع في الأسفل.
 * - القطع المُرجعة (is_returned=true) تظهر بخط مشطوب ولون رمادي.
 * - يدعم وضع "للقراءة فقط" (readOnly) لإخفاء أزرار التعديل.
 *
 * @param jobId      معرّف بطاقة الصيانة
 * @param companyId  معرّف الشركة (متاح للاستخدام المستقبلي وللتأكد من المضاعفة الذهنية)
 * @param readOnly   هل العرض للقراءة فقط؟ (يُخفي إضافة/حذف)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Package, X } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";

interface RepairPart {
  id: number;
  job_id: number;
  company_id: number;
  product_id: number | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  source: "internal" | "external" | string;
  warehouse_id: number | null;
  is_returned: boolean | null;
  return_destination: string | null;
  returned_at: string | null;
  created_at: string;
}

interface JobDetailWithParts {
  id: number;
  parts?: RepairPart[];
}

interface Props {
  jobId: number;
  /** معرّف الشركة — يُستخدم مستقبلاً للتحقق من العزل في طلبات إضافية */
  companyId?: number;
  readOnly?: boolean;
}

interface NewPartDraft {
  product_name: string;
  quantity: string;
  unit_price: string;
  source: "internal" | "external";
}

const EMPTY_DRAFT: NewPartDraft = {
  product_name: "",
  quantity: "1",
  unit_price: "0",
  source: "internal",
};

export default function RepairParts({ jobId, readOnly = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<NewPartDraft>(EMPTY_DRAFT);

  /* قائمة القطع تأتي ضمن تفاصيل البطاقة — نُعيد استخدام نفس المفتاح لمنع الجلب المزدوج */
  const { data: job, isLoading } = useQuery<JobDetailWithParts>({
    queryKey: ["/api/repair-jobs", jobId],
    queryFn: async () => {
      const r = await authFetch(api(`/api/repair-jobs/${jobId}`));
      if (!r.ok) throw new Error("تعذّر تحميل تفاصيل البطاقة");
      return r.json();
    },
    enabled: jobId > 0,
  });

  const parts: RepairPart[] = Array.isArray(job?.parts) ? job.parts : [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/repair-jobs", jobId] });
  };

  /* إضافة قطعة جديدة */
  const addMutation = useMutation({
    mutationFn: async (body: NewPartDraft) => {
      const r = await authFetch(api(`/api/repair-jobs/${jobId}/parts`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: body.product_name.trim(),
          quantity: body.quantity || "1",
          unit_price: body.unit_price || "0",
          source: body.source,
        }),
      });
      if (!r.ok) {
        let msg = "فشل إضافة القطعة";
        try {
          const j = await r.json();
          msg = j?.error || j?.message || msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✓ تمت إضافة القطعة" });
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  /* حذف قطعة */
  const deleteMutation = useMutation({
    mutationFn: async (partId: number) => {
      const r = await authFetch(api(`/api/repair-jobs/${jobId}/parts/${partId}`), {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("فشل حذف القطعة");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✓ تم حذف القطعة" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const name = draft.product_name.trim();
    if (!name) {
      toast({ title: "اسم القطعة مطلوب", variant: "destructive" });
      return;
    }
    addMutation.mutate(draft);
  };

  /* إجمالي تكلفة القطع — لا نحسب القطع المُرجعة */
  const total = parts.reduce((sum, p) => {
    if (p.is_returned) return sum;
    const q = Number(p.quantity ?? 0);
    const u = Number(p.unit_price ?? 0);
    return sum + (Number.isFinite(q) && Number.isFinite(u) ? q * u : 0);
  }, 0);

  return (
    <div
      className="rounded-2xl border border-white/8 overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", backdropFilter: "blur(10px)" }}
      dir="rtl"
    >
      {/* رأس البطاقة */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/6">
        <p className="text-[11px] text-cyan-300/85 font-bold flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          قطع الغيار المستخدمة
          {parts.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/12 border border-cyan-500/25 text-cyan-300/80 font-medium tabular-nums">
              {parts.length}
            </span>
          )}
        </p>
        {!readOnly && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-cyan-500/12 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Plus className="w-3 h-3" /> إضافة قطعة
          </button>
        )}
      </div>

      {/* نموذج الإضافة */}
      {!readOnly && adding && (
        <div className="px-4 py-3 border-b border-white/6 space-y-2 bg-cyan-500/[0.03]">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-white/40 mb-1 block">اسم القطعة *</label>
              <input
                autoFocus
                type="text"
                value={draft.product_name}
                onChange={(e) => setDraft((d) => ({ ...d, product_name: e.target.value }))}
                placeholder="مثال: شاشة LCD، بطارية، إلخ"
                className="erp-input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">الكمية</label>
              <input
                type="number"
                min="0"
                step="any"
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                className="erp-input w-full text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">سعر الوحدة</label>
              <input
                type="number"
                min="0"
                step="any"
                value={draft.unit_price}
                onChange={(e) => setDraft((d) => ({ ...d, unit_price: e.target.value }))}
                className="erp-input w-full text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-white/40 mb-1 block">المصدر</label>
              <select
                value={draft.source}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, source: e.target.value as "internal" | "external" }))
                }
                className="erp-input w-full text-xs"
              >
                <option value="internal">من المخزون</option>
                <option value="external">شراء خارجي</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY_DRAFT);
              }}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-3 h-3" /> إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={addMutation.isPending}
              className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/35 text-cyan-200 font-bold hover:bg-cyan-500/30 transition-all disabled:opacity-60"
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> جارٍ الحفظ...
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" /> حفظ القطعة
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* قائمة القطع */}
      <div className="px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-white/40 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحميل...
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-xs">
            لا توجد قطع غيار مُسجَّلة لهذه البطاقة
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* رأس الأعمدة */}
            <div className="grid grid-cols-12 gap-2 text-[9px] text-white/30 font-bold uppercase tracking-wider px-2 pb-1 border-b border-white/5">
              <div className="col-span-5">القطعة</div>
              <div className="col-span-1 text-center">الكمية</div>
              <div className="col-span-2 text-end">سعر الوحدة</div>
              <div className="col-span-2 text-end">الإجمالي</div>
              <div className="col-span-1 text-center">المصدر</div>
              <div className="col-span-1" />
            </div>
            {parts.map((p) => {
              const q = Number(p.quantity ?? 0);
              const u = Number(p.unit_price ?? 0);
              const lineTotal = Number.isFinite(q) && Number.isFinite(u) ? q * u : 0;
              const returned = !!p.is_returned;
              const sourceLabel =
                p.source === "internal" ? "مخزون" : p.source === "external" ? "خارجي" : p.source;
              return (
                <div
                  key={p.id}
                  className={`grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg text-xs ${
                    returned
                      ? "bg-white/[0.015] text-white/35 line-through"
                      : "bg-white/[0.025] text-white/80 hover:bg-white/[0.05]"
                  } transition-all`}
                >
                  <div className="col-span-5 truncate" title={p.product_name}>
                    {p.product_name}
                  </div>
                  <div className="col-span-1 text-center tabular-nums">{q}</div>
                  <div className="col-span-2 text-end tabular-nums">{formatCurrency(u)}</div>
                  <div className="col-span-2 text-end tabular-nums font-bold">
                    {formatCurrency(lineTotal)}
                  </div>
                  <div className="col-span-1 text-center">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                        p.source === "internal"
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300/80"
                          : "bg-amber-500/10 border-amber-500/25 text-amber-300/80"
                      }`}
                    >
                      {sourceLabel}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {!readOnly && !returned && (
                      <button
                        onClick={() => deleteMutation.mutate(p.id)}
                        disabled={deleteMutation.isPending}
                        title="حذف القطعة"
                        className="w-6 h-6 rounded-md flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {returned && (
                      <span
                        title="تم الإرجاع"
                        className="text-[9px] text-white/30 px-1.5 py-0.5 rounded-full border border-white/10"
                      >
                        مُرجَعة
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* الإجمالي */}
      {parts.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/6 bg-cyan-500/[0.04]">
          <span className="text-[11px] text-white/50 font-bold">إجمالي تكلفة القطع</span>
          <span className="text-sm text-cyan-200 font-black tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      )}
    </div>
  );
}
