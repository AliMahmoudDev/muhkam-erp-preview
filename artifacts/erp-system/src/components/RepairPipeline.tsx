import { useState } from "react";
import {
  CheckCircle2, PackageOpen, ScanSearch, MessageCircleQuestion,
  Wrench, ShieldCheck, PackageCheck, Truck, PartyPopper,
  PauseCircle, Ban, XCircle, ChevronRight, ChevronLeft, Loader2,
  AlertTriangle, FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createPortal } from "react-dom";
import QualityCheckModal from "@/components/modals/QualityCheckModal";
import PreDeliveryModal from "@/components/modals/PreDeliveryModal";
import ShippingCostModal from "@/components/modals/ShippingCostModal";
import DeliveryReceiptModal from "@/components/modals/DeliveryReceiptModal";

/**
 * البوّابات (gated transitions) — هذه الأهداف لا تُستخدم فيها رسالة التأكيد العامة،
 * بل يُفتح modal مخصّص لجمع البيانات قبل تنفيذ نقل الحالة.
 *
 * - final_quality_check → QualityCheckModal (يفتح عند in_repair → QC)
 *                          • حفظ → يحفظ qa_checklist + qa_completed_at فقط (بدون نقل تلقائي)
 *                          • رفض → يبقى في in_repair مع حفظ السبب في qa_notes
 *                         الانتقال إلى "جاهز للتسليم" يدوي بعد اعتماد الفحص.
 * - ready_for_delivery  → PreDeliveryModal  (نوع الورشة [داخلية/خارجية] + قطع/تكلفة + وسيط)
 *                         يضع pre_delivery_reviewed_at، ثم ينقل البطاقة لـ "جاهز للتسليم".
 * - delivered           → ShippingCostModal (تكلفة شحن + مصروف تلقائي)
 *
 * ملاحظة: الانتقال إلى "قيد الشحن" أصبح بسيطاً (confirm عام) لأن المراجعة النهائية
 * تتم في خطوة "جاهز للتسليم" قبلها.
 */
const GATED_TARGETS = new Set<string>(["final_quality_check", "ready_for_delivery", "delivered"]);

interface Stage {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

/* ── Visible pipeline (after removing diagnosis / approved / repaired) ─── */
const PIPELINE_STAGES: Stage[] = [
  { key: "received",                  label: "الاستلام",      icon: PackageOpen,           color: "violet"  },
  { key: "initial_inspection",        label: "الفحص الأولي",  icon: ScanSearch,            color: "indigo"  },
  { key: "waiting_customer_approval", label: "موافقة العميل", icon: MessageCircleQuestion, color: "amber"   },
  { key: "in_repair",                 label: "جارٍ الإصلاح",  icon: Wrench,                color: "cyan"    },
  { key: "final_quality_check",       label: "مراقبة الجودة", icon: ShieldCheck,           color: "purple"  },
  { key: "ready_for_delivery",        label: "جاهز للتسليم",  icon: PackageCheck,          color: "lime"    },
  { key: "shipped",                   label: "قيد الشحن",     icon: Truck,                 color: "sky"     },
  { key: "delivered",                 label: "تم التسليم",    icon: PartyPopper,           color: "emerald" },
];

/* ── Side branches — exception states ────────────────────────────────── */
const SIDE_BRANCHES: Stage[] = [
  { key: "waiting_parts", label: "بانتظار قطعة", icon: PauseCircle, color: "pink" },
  { key: "rejected",      label: "مرفوض",        icon: Ban,         color: "red"  },
  { key: "cancelled",     label: "ملغي",         icon: XCircle,     color: "red"  },
];

const TERMINAL_KEYS = ["delivered", "rejected", "cancelled"];

/* ── Hidden legacy stages — map them to the nearest visible stage ────── */
const HIDDEN_TO_VISIBLE: Record<string, string> = {
  diagnosis: "initial_inspection",
  approved:  "waiting_customer_approval",
  repaired:  "in_repair",
};

const ALL_LABELS: Record<string, string> = {
  received: "استلام الجهاز", initial_inspection: "الفحص الأولي",
  diagnosis: "التشخيص", waiting_customer_approval: "موافقة العميل",
  approved: "تمت الموافقة", in_repair: "جاري الإصلاح",
  repaired: "تم الإصلاح", final_quality_check: "مراقبة الجودة",
  ready_for_delivery: "جاهز للتسليم", shipped: "قيد الشحن",
  delivered: "تم التسليم", rejected: "مرفوض", cancelled: "ملغي",
  waiting_parts: "بانتظار قطعة غيار",
};

const COLOR: Record<string, { ring: string; bg: string; text: string; soft: string; shadow: string }> = {
  violet:  { ring: "ring-violet-400/50",  bg: "bg-violet-500",  text: "text-violet-300",  soft: "bg-violet-500/15 border-violet-400/40",  shadow: "shadow-violet-500/40"  },
  indigo:  { ring: "ring-indigo-400/50",  bg: "bg-indigo-500",  text: "text-indigo-300",  soft: "bg-indigo-500/15 border-indigo-400/40",  shadow: "shadow-indigo-500/40"  },
  amber:   { ring: "ring-amber-400/50",   bg: "bg-amber-500",   text: "text-amber-300",   soft: "bg-amber-500/15 border-amber-400/40",   shadow: "shadow-amber-500/40"   },
  cyan:    { ring: "ring-cyan-400/50",    bg: "bg-cyan-500",    text: "text-cyan-300",    soft: "bg-cyan-500/15 border-cyan-400/40",    shadow: "shadow-cyan-500/40"    },
  purple:  { ring: "ring-purple-400/50",  bg: "bg-purple-500",  text: "text-purple-300",  soft: "bg-purple-500/15 border-purple-400/40",  shadow: "shadow-purple-500/40"  },
  lime:    { ring: "ring-lime-400/50",    bg: "bg-lime-500",    text: "text-lime-300",    soft: "bg-lime-500/15 border-lime-400/40",    shadow: "shadow-lime-500/40"    },
  sky:     { ring: "ring-sky-400/50",     bg: "bg-sky-500",     text: "text-sky-300",     soft: "bg-sky-500/15 border-sky-400/40",     shadow: "shadow-sky-500/40"     },
  emerald: { ring: "ring-emerald-400/50", bg: "bg-emerald-500", text: "text-emerald-300", soft: "bg-emerald-500/15 border-emerald-400/40", shadow: "shadow-emerald-500/40" },
  pink:    { ring: "ring-pink-400/50",    bg: "bg-pink-500",    text: "text-pink-300",    soft: "bg-pink-500/15 border-pink-400/40",    shadow: "shadow-pink-500/40"    },
  red:     { ring: "ring-red-400/50",     bg: "bg-red-500",     text: "text-red-300",     soft: "bg-red-500/15 border-red-400/40",     shadow: "shadow-red-500/40"     },
};

interface HistoryEntry {
  status_to?: string | null;
  status_from?: string | null;
  event_type?: string | null;
}

interface RepairJobData {
  id: number;
  status: string;
  history?: HistoryEntry[];
  [key: string]: unknown;
}

interface Props {
  currentStatus: string;
  jobId: number;
  jobData: RepairJobData;
  onStatusChange: (newStatus: string) => void;
}

/**
 * يستخرج الحالات المخفية (diagnosis/approved/repaired) التي مرّت بها البطاقة
 * من سجل الانتقالات، ويُرجع خريطة (الحالة المرئية → قائمة الحالات المخفية المكتملة)
 * لعرض شارة صغيرة "✓ تشخيص" تحت أقرب مرحلة ظاهرة.
 */
function buildHiddenStageBadges(
  history: HistoryEntry[] | undefined
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!Array.isArray(history)) return out;
  const seen = new Set<string>();
  for (const h of history) {
    const k = h?.status_to;
    if (!k || typeof k !== "string") continue;
    if (!(k in HIDDEN_TO_VISIBLE)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    const visible = HIDDEN_TO_VISIBLE[k as keyof typeof HIDDEN_TO_VISIBLE];
    if (!out[visible]) out[visible] = [];
    out[visible].push(ALL_LABELS[k] ?? k);
  }
  return out;
}

interface ConfirmState {
  target: string;
  label: string;
  errors: string[];
  loading: boolean;
}

/** أي بوّابة (gated target) فُتح لها modal مخصّص — تُعالَج خارج الـ confirm العام */
type GatedKey = "final_quality_check" | "ready_for_delivery" | "delivered" | null;

export default function RepairPipeline({ currentStatus, jobData, onStatusChange }: Props) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [gated, setGated]         = useState<GatedKey>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const isTerminal   = TERMINAL_KEYS.includes(currentStatus);
  const currentLabel = ALL_LABELS[currentStatus] ?? currentStatus;

  const effectiveStatus = HIDDEN_TO_VISIBLE[currentStatus] ?? currentStatus;
  const visibleIdx      = PIPELINE_STAGES.findIndex(s => s.key === effectiveStatus);

  /* خريطة "الحالة المرئية → قائمة المراحل المخفية المكتملة" — لعرض شارات صغيرة تحت كل مرحلة */
  const hiddenBadges = buildHiddenStageBadges(jobData?.history);

  function canMoveTo(targetKey: string): boolean {
    if (isTerminal) return false;
    if (targetKey === currentStatus) return false;
    return true;
  }

  const prevStage = visibleIdx > 0                          ? PIPELINE_STAGES[visibleIdx - 1] : null;
  const nextStage = visibleIdx >= 0 && visibleIdx < PIPELINE_STAGES.length - 1
                    ? PIPELINE_STAGES[visibleIdx + 1]
                    : null;

  function openConfirm(key: string, label: string) {
    if (!canMoveTo(key)) return;
    /* البوّابات (Gated) — افتح modal مخصّص بدلاً من الـ confirm العام */
    if (GATED_TARGETS.has(key)) {
      setGated(key as Exclude<GatedKey, null>);
      return;
    }
    setConfirm({ target: key, label, errors: [], loading: false });
  }

  async function doTransition() {
    if (!confirm) return;
    setConfirm(c => c ? { ...c, loading: true } : null);
    try {
      const res = await fetch(`/api/repair-jobs/${jobData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: confirm.target }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        const errList = (data.error ?? "حدث خطأ").split(", ").filter(Boolean);
        setConfirm(c => c ? { ...c, loading: false, errors: errList } : null);
        return;
      }
      onStatusChange(confirm.target);
      setConfirm(null);
    } catch {
      setConfirm(c => c ? { ...c, loading: false, errors: ["تعذّر الاتصال بالخادم"] } : null);
    }
  }

  /** يستدعَى من أي gated modal بعد ما يحفظ بياناته بنجاح — نُنفّذ نقل الحالة.
   *  ملاحظة على عدم وجود rollback: الـ modals تحفظ بيانات حقيقية (QC، مراجعة، شحن مع
   *  مصروف ذرّي) — لو فشل الـ PATCH هنا فالبيانات المحفوظة صحيحة من الناحية المحاسبية،
   *  وستُكتشف البوّابة كمستوفاة في المرة التالية. لا نقوم بإلغاء حفظ الـ modal لأنه قد
   *  يكون أنشأ مصروفاً أو حركة مخزون لا يمكن التراجع عنها بأمان من العميل. */
  async function applyGatedTransition(target: Exclude<GatedKey, null>) {
    try {
      const res = await fetch(`/api/repair-jobs/${jobData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: target }),
      });
      if (res.ok) {
        onStatusChange(target);
        setGated(null);
        return;
      }
      /* فشل النقل بعد حفظ الـ modal — نعرض confirm فيه الأخطاء + زر إعادة محاولة */
      const data = await res.json().catch(() => ({})) as { error?: string };
      const errList = (data.error ?? `تعذّر تحديث الحالة (HTTP ${res.status})`).split(", ").filter(Boolean);
      setGated(null);
      setConfirm({ target, label: ALL_LABELS[target] ?? target, errors: errList, loading: false });
    } catch {
      setGated(null);
      setConfirm({ target, label: ALL_LABELS[target] ?? target, errors: ["تعذّر الاتصال بالخادم"], loading: false });
    }
  }

  const modal = confirm ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}
    >
      <div
        className="rounded-2xl border border-[var(--erp-border)] p-5 w-full max-w-sm shadow-2xl"
        style={{ background: "rgba(15,10,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        <h3 className="text-sm font-black text-white mb-1">تأكيد تغيير الحالة</h3>
        <p className="text-xs erp-text-muted mb-4">
          الانتقال من{" "}
          <span className="text-violet-300 font-bold">{currentLabel}</span>
          {" "}إلى{" "}
          <span className="text-white font-bold">{confirm.label}</span>
        </p>

        {confirm.errors.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] font-bold text-red-400">متطلبات غير مستوفاة:</p>
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {confirm.errors.map((e, i) => (
                <li key={i} className="text-[11px] text-red-300">{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={doTransition}
            disabled={confirm.loading}
            className="flex-1 py-2 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(124,58,237,0.7)", border: "1px solid rgba(139,92,246,0.4)" }}
          >
            {confirm.loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التحديث...</>
              : <><CheckCircle2 className="w-3.5 h-3.5" /> تأكيد</>}
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="px-4 py-2 rounded-xl border border-[var(--erp-border)] erp-text-muted hover:text-white text-xs transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  const progressPct = visibleIdx > 0
    ? (visibleIdx / (PIPELINE_STAGES.length - 1)) * 100
    : 0;

  /* البطاقة كـ JobLite للـ modals — الـ jobData يحوي كل الحقول من الـ DB */
  const jobLite = {
    id:                     jobData.id,
    job_no:                 String(jobData.job_no ?? ""),
    device_brand:           jobData.device_brand as string | null | undefined,
    device_model:           jobData.device_model as string | null | undefined,
    checklist:              jobData.checklist,
    qa_checklist:           jobData.qa_checklist,
    qa_notes:               jobData.qa_notes as string | null | undefined,
    device_score:           jobData.device_score as number | null | undefined,
    external_workshop:      jobData.external_workshop as boolean | null | undefined,
    external_workshop_name: jobData.external_workshop_name as string | null | undefined,
    external_workshop_cost: jobData.external_workshop_cost as string | number | null | undefined,
    broker_name:            jobData.broker_name as string | null | undefined,
    broker_commission:      jobData.broker_commission as string | number | null | undefined,
    shipping_cost:          jobData.shipping_cost as string | number | null | undefined,
  };

  return (
    <>
      {modal}
      {gated === "final_quality_check" && (
        <QualityCheckModal
          job={jobLite}
          onClose={() => setGated(null)}
          onSaved={(outcome) => {
            /* حفظ نتيجة الفحص (قبول أو رفض) — لا ينقل الحالة تلقائياً.
               • قبول → احفظ qa_completed_at؛ ينتقل المستخدم يدوياً لاحقاً إلى
                 "جاهز للتسليم" حيث تفتح بوّابة المراجعة النهائية (PreDeliveryModal).
               • رفض → الحالة تبقى in_repair مع تسجيل qa_notes.
               في الحالتين نُغلق المودال ونُحدّث البطاقة لعرض البيانات الجديدة. */
            void outcome;
            setGated(null);
            onStatusChange(currentStatus);
          }}
        />
      )}
      {gated === "ready_for_delivery" && (
        <PreDeliveryModal
          job={jobLite}
          onClose={() => setGated(null)}
          onSaved={() => void applyGatedTransition("ready_for_delivery")}
        />
      )}
      {gated === "delivered" && (
        <ShippingCostModal
          job={jobLite}
          onClose={() => setGated(null)}
          onSaved={() => void applyGatedTransition("delivered")}
        />
      )}
      {showReceipt && (
        <DeliveryReceiptModal
          jobId={jobData.id}
          onClose={() => setShowReceipt(false)}
          onSent={() => onStatusChange(currentStatus)}
        />
      )}
      <div
        className="rounded-2xl border border-[var(--erp-border)] overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(124,58,237,0.05) 100%)" }}
        dir="rtl"
      >
        {/* ── Top toolbar: Prev | Current Stage | Next ─────────────── */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-[var(--erp-border)]">
          <button
            onClick={() => prevStage && openConfirm(prevStage.key, ALL_LABELS[prevStage.key] ?? prevStage.label)}
            disabled={!prevStage || isTerminal}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--erp-border)] text-[11px] font-bold erp-text hover:text-white hover:bg-white/5 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>السابق</span>
            {prevStage && (
              <span className="erp-label hidden sm:inline">· {prevStage.label}</span>
            )}
          </button>

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-violet-400/30"
            style={{ background: "rgba(124,58,237,0.18)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[10px] erp-text-muted">المرحلة الحالية:</span>
            <span className="text-xs font-black text-white">{currentLabel}</span>
          </div>

          {currentStatus === "delivered" ? (
            <button
              onClick={() => setShowReceipt(true)}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-400/40 text-[11px] font-black text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400/60 transition-all"
              style={{ background: "rgba(16,185,129,0.10)" }}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>إيصال التسليم</span>
            </button>
          ) : (
            <button
              onClick={() => nextStage && openConfirm(nextStage.key, ALL_LABELS[nextStage.key] ?? nextStage.label)}
              disabled={!nextStage || isTerminal}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-400/40 text-[11px] font-black text-violet-200 hover:bg-violet-500/20 hover:border-violet-400/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              style={{ background: "rgba(124,58,237,0.10)" }}
            >
              {nextStage && (
                <span className="text-violet-200/70 hidden sm:inline">{nextStage.label} ·</span>
              )}
              <span>التالي</span>
              <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}
        </div>

        {/* ── Stepper ───────────────────────────────────────────────── */}
        <div className="relative px-5 pt-5 pb-4">
          {/* Connector track */}
          <div
            className="absolute top-[38px] left-10 right-10 h-[3px] rounded-full"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          {/* Progress fill — RTL fills from right to left */}
          {visibleIdx > 0 && (
            <div
              className="absolute top-[38px] right-10 h-[3px] rounded-full bg-gradient-to-l from-violet-500 via-cyan-400 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `calc(${progressPct}% - 0px)`, maxWidth: "calc(100% - 5rem)" }}
            />
          )}

          <div className="relative flex items-start justify-between gap-1">
            {PIPELINE_STAGES.map((stage, i) => {
              const isActive    = stage.key === effectiveStatus;
              const isCompleted = !isTerminal && visibleIdx >= 0 && i < visibleIdx;
              const isClickable = canMoveTo(stage.key);
              const Icon        = stage.icon;
              const cc          = COLOR[stage.color] ?? COLOR.violet;

              return (
                <button
                  key={stage.key}
                  onClick={() => openConfirm(stage.key, ALL_LABELS[stage.key] ?? stage.label)}
                  disabled={!isClickable}
                  title={ALL_LABELS[stage.key]}
                  className="relative flex flex-col items-center gap-2 group flex-1 min-w-0 disabled:cursor-not-allowed"
                >
                  <div className={[
                    "relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shrink-0",
                    isActive    ? `${cc.bg} text-white ring-4 ${cc.ring} shadow-lg ${cc.shadow} scale-110` :
                    isCompleted ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" :
                    isClickable ? "bg-white/[0.04] text-white/55 border border-white/10 group-hover:bg-white/8 group-hover:text-white group-hover:border-white/20 group-hover:scale-105" :
                                  "bg-white/[0.03] text-white/30 border border-white/8",
                  ].join(" ")}>
                    {isCompleted
                      ? <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />
                      : <Icon className="w-[18px] h-[18px]" strokeWidth={2} />}
                    {isActive && (
                      <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${cc.bg} animate-ping`} />
                    )}
                  </div>
                  <span className={[
                    "text-[10px] leading-tight text-center max-w-[80px] truncate transition-colors px-0.5",
                    isActive    ? `${cc.text} font-black` :
                    isCompleted ? "text-emerald-400/80 font-bold" :
                    isClickable ? "text-white/55 group-hover:text-white/90 font-semibold" :
                                  "text-white/30 font-semibold",
                  ].join(" ")}>
                    {stage.label}
                  </span>

                  {/* شارات المراحل المخفية المكتملة (مثل: ✓ تشخيص) — تحت أقرب مرحلة ظاهرة */}
                  {hiddenBadges[stage.key]?.length ? (
                    <div className="flex flex-col items-center gap-0.5 mt-0.5">
                      {hiddenBadges[stage.key].map((lbl) => (
                        <span
                          key={lbl}
                          title={`المرحلة المخفية المكتملة: ${lbl}`}
                          className="px-1.5 py-[1px] rounded-full text-[8px] leading-none font-bold bg-emerald-500/12 border border-emerald-500/25 text-emerald-300/85"
                        >
                          ✓ {lbl}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Side branches ─────────────────────────────────────────── */}
        <div className="px-4 py-2 border-t border-[var(--erp-border)] bg-white/[0.015] flex flex-wrap items-center gap-2">
          <span className="text-[10px] erp-label font-bold">حالات استثنائية:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SIDE_BRANCHES.map(stage => {
              const isActive    = stage.key === currentStatus;
              const isClickable = canMoveTo(stage.key);
              const Icon        = stage.icon;
              const cc          = COLOR[stage.color] ?? COLOR.red;
              return (
                <button
                  key={stage.key}
                  onClick={() => openConfirm(stage.key, ALL_LABELS[stage.key] ?? stage.label)}
                  disabled={!isClickable && !isActive}
                  title={ALL_LABELS[stage.key]}
                  className={[
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all",
                    isActive    ? `${cc.soft} ${cc.text} shadow-md ${cc.shadow}` :
                    isClickable ? "border-white/8 text-white/55 hover:text-white hover:bg-white/5 hover:border-white/15" :
                                  "border-white/8 text-white/25 cursor-not-allowed",
                  ].join(" ")}
                >
                  <Icon className="w-3 h-3" strokeWidth={2.5} />
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
