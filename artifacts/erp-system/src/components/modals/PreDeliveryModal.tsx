/**
 * PreDeliveryModal — بوّابة "جاهز للتسليم" → "قيد الشحن"
 *
 * يعرض:
 *  - قائمة قطع الغيار الداخلية غير المرتجَعة + قرار لكل قطعة (مخزن / هالك / تأجيل)
 *  - بيانات ورشة خارجية (اختياري) + التكلفة
 *  - بيانات وسيط/سمسار (اختياري) + العمولة
 *
 * عند الحفظ:
 *   1) لكل قطعة قرارها (stock|scrap) → POST /repair-jobs/:id/parts/:partId/return
 *   2) POST /api/repair-jobs/:id/pre-delivery — يضع pre_delivery_reviewed_at
 *   3) onSaved() — يطلب من الأب نقل البطاقة إلى shipped
 */
import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PackageCheck, Loader2, X, AlertTriangle, ArchiveRestore, Trash2, Clock, Building2, UserCog } from "lucide-react";
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

  const [hasWorkshop, setHasWorkshop]   = useState(Boolean(job.external_workshop));
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
        // eslint-disable-next-line security/detect-object-injection
        next[p.id] = prev[p.id] ?? "defer";
      }
      return next;
    });
  }, [internalUnreturned.length]);

  async function handleSave() {
    setLoading(true);
    setErrors([]);
    try {
      /* 1) إرجاع القطع التي اختار لها المستخدم stock/scrap */
      for (const p of internalUnreturned) {
        // eslint-disable-next-line security/detect-object-injection
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

      /* 2) حفظ بيانات الورشة + الوسيط + ضبط pre_delivery_reviewed_at */
      const wcost = Number(workshopCost);
      const bcomm = Number(brokerComm);
      const r2 = await authFetch(api(`/api/repair-jobs/${job.id}/pre-delivery`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_workshop:      hasWorkshop,
          external_workshop_name: hasWorkshop ? workshopName.trim() : "",
          external_workshop_cost: hasWorkshop && Number.isFinite(wcost) ? wcost : 0,
          broker_name:            brokerName.trim(),
          broker_commission:      Number.isFinite(bcomm) ? bcomm : 0,
        }),
      });
      const d2 = await r2.json() as { error?: string };
      if (!r2.ok) throw new Error(d2.error ?? "فشل حفظ مراجعة ما قبل التسليم");

      const settled = internalUnreturned.filter(p => decisions[p.id] !== "defer").length;
      toast({
        title: "تمت مراجعة ما قبل التسليم",
        description: settled > 0 ? `تم التعامل مع ${settled} قطعة` : "تم تأكيد المراجعة",
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
        className="my-4 rounded-2xl border border-white/10 w-full max-w-3xl shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-lime-500/15 border border-lime-400/30 flex items-center justify-center">
              <PackageCheck className="w-4.5 h-4.5 text-lime-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">مراجعة ما قبل التسليم</h3>
              <p className="text-[11px] text-white/50">
                البطاقة <span className="text-white font-bold">{job.job_no}</span> — قبل الانتقال إلى "قيد الشحن"
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* قطع داخلية غير مرتجعة */}
          <section>
            <h4 className="text-[11px] font-black text-white/70 mb-2 flex items-center gap-1.5">
              <ArchiveRestore className="w-3.5 h-3.5 text-emerald-300" />
              قطع غيار داخلية لم تُرجَع ({internalUnreturned.length})
            </h4>
            {partsLoading ? (
              <p className="text-[11px] text-white/50 px-3 py-2 flex items-center gap-2">
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
                    className="rounded-lg border border-white/8 p-2.5 flex flex-col sm:flex-row sm:items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{p.product_name}</p>
                      <p className="text-[10px] text-white/50">
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
                              active ? `${cfg.bg} text-white shadow-md` :
                                       "bg-white/[0.04] text-white/55 border border-white/8 hover:bg-white/[0.08] hover:text-white",
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

          {/* ورشة خارجية */}
          <section className="rounded-xl border border-white/8 p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={hasWorkshop}
                onChange={(e) => setHasWorkshop(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-500"
              />
              <Building2 className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-[11px] font-bold text-white">تم استخدام ورشة خارجية</span>
            </label>
            {hasWorkshop && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <input
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  placeholder="اسم الورشة"
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
                />
                <input
                  type="number"
                  min={0}
                  value={workshopCost}
                  onChange={(e) => setWorkshopCost(e.target.value)}
                  placeholder="تكلفة الورشة"
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
                />
              </div>
            )}
          </section>

          {/* وسيط/سمسار */}
          <section className="rounded-xl border border-white/8 p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2 mb-2">
              <UserCog className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] font-bold text-white">وسيط / سمسار (اختياري)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="اسم الوسيط (اتركه فارغاً إن لم يوجد)"
                className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
              />
              <input
                type="number"
                min={0}
                value={brokerComm}
                onChange={(e) => setBrokerComm(e.target.value)}
                placeholder="عمولة الوسيط"
                className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
              />
            </div>
            <p className="text-[10px] text-white/40 mt-1.5">ملاحظة: عمولة الوسيط لا تُحسب كمصروف تلقائي — أنشئ سند صرف يدوي للوسيط من شاشة المصاريف.</p>
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

        <div className="px-5 py-4 border-t border-white/8 flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(132,204,22,0.7)", border: "1px solid rgba(163,230,53,0.4)" }}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
              : <><PackageCheck className="w-3.5 h-3.5" /> تأكيد المراجعة وانتقال إلى "قيد الشحن"</>}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
