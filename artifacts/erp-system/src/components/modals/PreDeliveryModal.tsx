/**
 * PreDeliveryModal — بوّابة "مراقبة الجودة" → "جاهز للتسليم"
 *
 * يفتح بعد اعتماد فحص مراقبة الجودة (qa_completed_at) قبل النقل لـ "جاهز للتسليم".
 *
 * يبدأ المستخدم باختيار **نوع الورشة** (مفتاح أساسي):
 *   - داخلية → نعرض قائمة قطع الغيار الداخلية غير المرتجَعة + قرار لكل قطعة
 *              (إرجاع للمخزن / هالك / تأجيل). تكلفة الورشة الخارجية = 0.
 *   - خارجية → نُخفي قسم القطع تماماً ونطلب: اسم الورشة + تكلفة الإصلاح.
 *
 * في الحالتين:
 *   - حقول الوسيط (اسم + قيمة عمولة) — اختيارية، القيمة يحددها المستخدم.
 *     عمولة الوسيط تُخصم لاحقاً من الإيراد الصافي للفنّي عند حساب الرواتب.
 *
 * عند الحفظ:
 *   1) لكل قطعة قرارها (stock|scrap) → POST /repair-jobs/:id/parts/:partId/return
 *      (ينطبق فقط على الورشة الداخلية)
 *   2) POST /api/repair-jobs/:id/pre-delivery — يضع pre_delivery_reviewed_at
 *      ويحفظ external_workshop + external_workshop_name + external_workshop_cost
 *      + broker_name + broker_commission
 *   3) onSaved() — يطلب من الأب نقل البطاقة إلى ready_for_delivery
 */
import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PackageCheck, Loader2, X, AlertTriangle, ArchiveRestore, Trash2, Clock, UserCog, Wrench, ExternalLink } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PartRow {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: string | number;
  unit_price: string | number;
  source: string | null;
  is_returned: boolean | null;
  warehouse_id: number | null;
}

interface JobLite {
  id: number;
  job_no: string;
  external_workshop?: boolean | null;
  external_workshop_name?: string | null;
  external_workshop_cost?: string | number | null;
  broker_name?: string | null;
  broker_commission?: string | number | null;
}

interface Props {
  job: JobLite;
  /** اختياري — لو ما اتمررش، الـ modal يجيبهم بنفسه عبر API */
  parts?: PartRow[];
  onClose: () => void;
  onSaved: () => void;
}

type Decision = "stock" | "scrap" | "defer";

const DECISION_BTN: Record<Decision, { label: string; bg: string; icon: typeof ArchiveRestore }> = {
  stock: { label: "إرجاع للمخزن", bg: "bg-emerald-500/80", icon: ArchiveRestore },
  scrap: { label: "هالك",          bg: "bg-red-500/80",     icon: Trash2 },
  defer: { label: "تأجيل",         bg: "bg-zinc-500/80",    icon: Clock  },
};

export default function PreDeliveryModal({ job, parts: partsProp, onClose, onSaved }: Props) {
  const { toast } = useToast();

  /* لو parts ما اتمررتش، نجيبها من السيرفر مرة واحدة عند الفتح */
  const [parts, setParts] = useState<PartRow[]>(partsProp ?? []);
  const [partsLoading, setPartsLoading] = useState(!partsProp);
  useEffect(() => {
    if (partsProp) return;
    let cancelled = false;
    setPartsLoading(true);
    authFetch(api(`/api/repair-jobs/${job.id}`))
      .then(r => r.ok ? r.json() : Promise.reject(new Error("تعذّر تحميل قطع الغيار")))
      .then((j: { parts?: PartRow[] }) => { if (!cancelled) { setParts(Array.isArray(j.parts) ? j.parts : []); setPartsLoading(false); } })
      .catch(() => { if (!cancelled) setPartsLoading(false); });
    return () => { cancelled = true; };
  }, [job.id, partsProp]);

  /* قطع داخلية لم تُرجع بعد — هي اللي محتاجة قرار */
  const internalUnreturned = useMemo(
    () => parts.filter(p => (p.source ?? "internal") === "internal" && !p.is_returned),
    [parts],
  );

  const [decisions, setDecisions] = useState<Record<number, Decision>>(() => {
    const d: Record<number, Decision> = {};
    for (const p of internalUnreturned) d[p.id] = "defer";
    return d;
  });

  /* نوع الورشة — مفتاح أساسي يُغيّر شكل البقية:
        internal → نعرض القطع، نتجاهل اسم/تكلفة الورشة الخارجية
        external → نُخفي القطع، نطلب اسم الورشة + تكلفة الإصلاح */
  const [workshopType, setWorkshopType] = useState<"internal" | "external">(
    job.external_workshop ? "external" : "internal"
  );
  const isExternal = workshopType === "external";
  const [workshopName, setWorkshopName] = useState(job.external_workshop_name ?? "");
  const [workshopCost, setWorkshopCost] = useState(String(job.external_workshop_cost ?? "0"));
  const [brokerName, setBrokerName]     = useState(job.broker_name ?? "");
  const [brokerComm, setBrokerComm]     = useState(String(job.broker_commission ?? "0"));

  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<string[]>([]);

  /* لو تغيرت قائمة القطع (بعد refetch مثلاً) نعيد بناء decisions */
  useEffect(() => {
    setDecisions(prev => {
      const next: Record<number, Decision> = {};
      for (const p of internalUnreturned) {
        next[p.id] = prev[p.id] ?? "defer";
      }
      return next;
    });
  }, [internalUnreturned.length]);

  async function handleSave() {
    /* تحقق محلي قبل الإرسال */
    const validationErrs: string[] = [];
    if (isExternal) {
      if (workshopName.trim().length < 2) {
        validationErrs.push("يجب إدخال اسم الورشة الخارجية");
      }
      const wc = Number(workshopCost);
      if (!Number.isFinite(wc) || wc <= 0) {
        validationErrs.push("يجب إدخال تكلفة إصلاح الورشة الخارجية (> 0)");
      }
    }
    const bc = Number(brokerComm);
    if (brokerComm.trim() !== "" && (!Number.isFinite(bc) || bc < 0)) {
      validationErrs.push("قيمة عمولة الوسيط غير صحيحة");
    }
    if (brokerName.trim().length > 0 && (!Number.isFinite(bc) || bc <= 0)) {
      validationErrs.push("أدخلت اسم وسيط — يجب إدخال قيمة عمولة موجبة");
    }
    if (validationErrs.length > 0) {
      setErrors(validationErrs);
      return;
    }

    setLoading(true);
    setErrors([]);
    try {
      /* 1) إرجاع القطع — فقط للورشة الداخلية. الورشة الخارجية لا تتعامل مع قطع داخلية. */
      if (!isExternal) {
        for (const p of internalUnreturned) {
          const dec = decisions[p.id];
          if (dec === "defer") continue;
          const r = await authFetch(api(`/api/repair-jobs/${job.id}/parts/${p.id}/return`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destination: dec }),
          });
          if (!r.ok) {
            const d = await r.json() as { error?: string };
            throw new Error(d.error ?? `فشل إرجاع القطعة ${p.product_name}`);
          }
        }
      }

      /* 2) حفظ نوع الورشة + بيانات الوسيط + ضبط pre_delivery_reviewed_at.
            للورشة الداخلية: external_workshop_cost = 0، اسم الورشة فارغ. */
      const wcost = Number(workshopCost);
      const bcomm = Number(brokerComm);
      const r2 = await authFetch(api(`/api/repair-jobs/${job.id}/pre-delivery`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_workshop:      isExternal,
          external_workshop_name: isExternal ? workshopName.trim() : "",
          external_workshop_cost: isExternal && Number.isFinite(wcost) ? wcost : 0,
          broker_name:            brokerName.trim(),
          broker_commission:      brokerName.trim().length > 0 && Number.isFinite(bcomm) ? bcomm : 0,
        }),
      });
      const d2 = await r2.json() as { error?: string };
      if (!r2.ok) throw new Error(d2.error ?? "فشل حفظ مراجعة ما قبل التسليم");

      const settled = isExternal ? 0 : internalUnreturned.filter(p => decisions[p.id] !== "defer").length;
      toast({
        title: "تمت مراجعة ما قبل التسليم",
        description: isExternal
          ? `ورشة خارجية — تكلفة ${wcost.toFixed(2)}`
          : settled > 0 ? `تم التعامل مع ${settled} قطعة` : "تم تأكيد المراجعة",
      });
      onSaved();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "خطأ غير معروف"]);
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.78)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="my-4 rounded-2xl border border-line w-full max-w-3xl shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-500/15 border border-lime-400/30 flex items-center justify-center">
              <PackageCheck className="w-4.5 h-4.5 text-lime-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">مراجعة ما قبل التسليم</h3>
              <p className="text-[11px] text-ink/50">
                البطاقة <span className="text-ink font-bold">{job.job_no}</span> — قبل الانتقال إلى "جاهز للتسليم"
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* اختيار نوع الورشة — مفتاح أساسي يُغيّر شكل البقية */}
          <section>
            <h4 className="text-[11px] font-black text-ink/70 mb-2 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-violet-300" />
              نوع الورشة التي أصلحت الجهاز
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWorkshopType("internal")}
                className={[
                  "rounded-xl border p-3 text-right transition-all flex items-start gap-2",
                  !isExternal
                    ? "border-emerald-400/50 bg-emerald-500/15 shadow-md shadow-emerald-500/10"
                    : "border-line bg-surface hover:bg-surface",
                ].join(" ")}
              >
                <div className={[
                  "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                  !isExternal ? "border-emerald-400" : "border-line",
                ].join(" ")}>
                  {!isExternal && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={["text-[12px] font-black", !isExternal ? "text-emerald-200" : "text-ink/70"].join(" ")}>
                    ورشة داخلية
                  </p>
                  <p className="text-[10px] text-ink/45 mt-0.5">
                    أُصلح في الشركة باستخدام قطع من المخزون
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWorkshopType("external")}
                className={[
                  "rounded-xl border p-3 text-right transition-all flex items-start gap-2",
                  isExternal
                    ? "border-cyan-400/50 bg-cyan-500/15 shadow-md shadow-cyan-500/10"
                    : "border-line bg-surface hover:bg-surface",
                ].join(" ")}
              >
                <div className={[
                  "mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                  isExternal ? "border-cyan-400" : "border-line",
                ].join(" ")}>
                  {isExternal && <div className="w-2 h-2 rounded-full bg-cyan-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={["text-[12px] font-black", isExternal ? "text-cyan-200" : "text-ink/70"].join(" ")}>
                    ورشة خارجية
                  </p>
                  <p className="text-[10px] text-ink/45 mt-0.5">
                    أُرسل لورشة خارج الشركة بتكلفة محددة
                  </p>
                </div>
              </button>
            </div>
          </section>

          {/* تفاصيل الورشة الخارجية — فقط لو external */}
          {isExternal && (
            <section className="rounded-xl border border-cyan-400/25 p-3" style={{ background: "rgba(34,211,238,0.05)" }}>
              <h4 className="text-[11px] font-black text-cyan-200 mb-2 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-cyan-300" />
                بيانات الورشة الخارجية
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-ink/55 mb-1 block">اسم الورشة *</label>
                  <input
                    value={workshopName}
                    onChange={(e) => setWorkshopName(e.target.value)}
                    placeholder="مثال: ورشة الفنّي خالد"
                    className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-ink/55 mb-1 block">تكلفة الإصلاح *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={workshopCost}
                    onChange={(e) => setWorkshopCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>
              <p className="text-[10px] text-ink/45 mt-2">
                هذه التكلفة تُخصم من إيرادات الصيانة عند احتساب صافي الفنّي.
              </p>
            </section>
          )}

          {/* قطع داخلية غير مرتجعة — فقط لو internal */}
          {!isExternal && (
          <section>
            <h4 className="text-[11px] font-black text-ink/70 mb-2 flex items-center gap-1.5">
              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-300" />
              قطع غيار داخلية لم تُرجَع ({internalUnreturned.length})
            </h4>
            {partsLoading ? (
              <p className="text-[11px] text-ink/50 px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ تحميل قطع الغيار...
              </p>
            ) : internalUnreturned.length === 0 ? (
              <p className="text-[11px] text-emerald-300/80 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                ✓ لا توجد قطع داخلية تحتاج قراراً
              </p>
            ) : (
              <div className="space-y-1.5">
                {internalUnreturned.map(p => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-line p-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-ink truncate">{p.product_name}</p>
                      <p className="text-[10px] text-ink/50">
                        كمية: {Number(p.quantity)} · سعر: {Number(p.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(["stock","scrap","defer"] as Decision[]).map(d => {
                        const cfg = DECISION_BTN[d];
                        const Icon = cfg.icon;
                        const active = decisions[p.id] === d;
                        const disabled = d === "stock" && (!p.product_id || !p.warehouse_id);
                        return (
                          <button
                            key={d}
                            disabled={disabled}
                            onClick={() => setDecisions(prev => ({ ...prev, [p.id]: d }))}
                            title={disabled ? "هذه القطعة غير مرتبطة بصنف/مخزن — لا يمكن إرجاعها" : ""}
                            className={[
                              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                              active ? `${cfg.bg} text-ink shadow-md` :
                                       "bg-surface text-ink/55 border border-line hover:bg-surface hover:text-ink",
                            ].join(" ")}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          )}

          {/* وسيط/سمسار — اختياري في الحالتين */}
          <section className="rounded-xl border border-amber-400/20 p-3" style={{ background: "rgba(245,158,11,0.04)" }}>
            <div className="flex items-center gap-2 mb-2">
              <UserCog className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] font-bold text-ink">وسيط / سمسار (اختياري)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-ink/55 mb-1 block">اسم الوسيط</label>
                <input
                  value={brokerName}
                  onChange={(e) => setBrokerName(e.target.value)}
                  placeholder="اتركه فارغاً إن لم يوجد"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-amber-400/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-ink/55 mb-1 block">قيمة العمولة</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={brokerComm}
                  onChange={(e) => setBrokerComm(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>
            <p className="text-[10px] text-amber-200/70 mt-2">
              عمولة الوسيط تُخصم من الإيراد الصافي للفنّي عند احتساب الراتب — لا تُسجَّل كمصروف منفصل.
            </p>
          </section>
        </div>

        {errors.length > 0 && (
          <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] font-bold text-red-400">خطأ:</p>
            </div>
            <ul className="list-disc list-inside">
              {errors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
            </ul>
          </div>
        )}

        <div className="px-5 py-4 border-t border-line flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(132,204,22,0.7)", border: "1px solid rgba(163,230,53,0.4)" }}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
              : <><PackageCheck className="w-3.5 h-3.5" /> تأكيد المراجعة وانتقال إلى "جاهز للتسليم"</>}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-line text-ink/60 hover:text-ink text-xs"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
