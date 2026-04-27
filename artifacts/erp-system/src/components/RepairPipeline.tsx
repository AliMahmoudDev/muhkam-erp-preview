import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createPortal } from "react-dom";

const PIPELINE_STAGES = [
  { key: "received",                  label: "استلام",        icon: "📥", color: "violet" },
  { key: "initial_inspection",        label: "الفحص الأولي",  icon: "🔍", color: "indigo" },
  { key: "diagnosis",                 label: "التشخيص",       icon: "🩺", color: "blue"   },
  { key: "waiting_customer_approval", label: "موافقة العميل", icon: "⏳", color: "amber"  },
  { key: "approved",                  label: "موافقة",        icon: "✅", color: "emerald"},
  { key: "in_repair",                 label: "جارٍ الإصلاح",  icon: "🔧", color: "cyan"   },
  { key: "repaired",                  label: "تم الإصلاح",    icon: "🛠️", color: "teal"   },
  { key: "final_quality_check",       label: "مراقبة الجودة", icon: "🏅", color: "purple" },
  { key: "ready_for_delivery",        label: "جاهز للتسليم",  icon: "📦", color: "lime"   },
  { key: "delivered",                 label: "مُسلَّم",        icon: "🎉", color: "teal"   },
] as const;

const TERMINAL_STAGES = [
  { key: "rejected",  label: "مرفوض", icon: "🚫" },
  { key: "cancelled", label: "ملغي",  icon: "❌" },
] as const;

const ALL_LABELS: Record<string, string> = {
  received: "استلام الجهاز", initial_inspection: "الفحص الأولي",
  diagnosis: "التشخيص", waiting_customer_approval: "انتظار موافقة العميل",
  approved: "تمت الموافقة", in_repair: "جاري الإصلاح",
  repaired: "تم الإصلاح", final_quality_check: "مراقبة الجودة",
  ready_for_delivery: "جاهز للتسليم", delivered: "تم التسليم",
  rejected: "مرفوض", cancelled: "ملغي",
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received:                  ["initial_inspection", "cancelled"],
  initial_inspection:        ["diagnosis", "cancelled"],
  diagnosis:                 ["waiting_customer_approval", "cancelled"],
  waiting_customer_approval: ["approved", "rejected"],
  approved:                  ["in_repair"],
  in_repair:                 ["repaired"],
  repaired:                  ["final_quality_check"],
  final_quality_check:       ["ready_for_delivery"],
  ready_for_delivery:        ["delivered"],
  delivered: [], rejected: [], cancelled: [],
};

const COLOR_CLASSES: Record<string, { dot: string; glow: string; text: string; bg: string }> = {
  violet: { dot: "bg-violet-400",  glow: "shadow-violet-500/30",  text: "text-violet-300",  bg: "bg-violet-500/15 border-violet-500/40" },
  indigo: { dot: "bg-indigo-400",  glow: "shadow-indigo-500/30",  text: "text-indigo-300",  bg: "bg-indigo-500/15 border-indigo-500/40" },
  blue:   { dot: "bg-blue-400",    glow: "shadow-blue-500/30",    text: "text-blue-300",    bg: "bg-blue-500/15 border-blue-500/40"   },
  amber:  { dot: "bg-amber-400",   glow: "shadow-amber-500/30",   text: "text-amber-300",   bg: "bg-amber-500/15 border-amber-500/40"  },
  emerald:{ dot: "bg-emerald-400", glow: "shadow-emerald-500/30", text: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/40"},
  cyan:   { dot: "bg-cyan-400",    glow: "shadow-cyan-500/30",    text: "text-cyan-300",    bg: "bg-cyan-500/15 border-cyan-500/40"   },
  teal:   { dot: "bg-teal-400",    glow: "shadow-teal-500/30",    text: "text-teal-300",    bg: "bg-teal-500/15 border-teal-500/40"   },
  purple: { dot: "bg-purple-400",  glow: "shadow-purple-500/30",  text: "text-purple-300",  bg: "bg-purple-500/15 border-purple-500/40"},
  lime:   { dot: "bg-lime-400",    glow: "shadow-lime-500/30",    text: "text-lime-300",    bg: "bg-lime-500/15 border-lime-500/40"   },
};

interface RepairJobData {
  id: number;
  status: string;
  [key: string]: unknown;
}

interface Props {
  currentStatus: string;
  jobId: number;
  jobData: RepairJobData;
  onStatusChange: (newStatus: string) => void;
}

interface ConfirmState {
  target: string;
  label: string;
  errors: string[];
  loading: boolean;
}

export default function RepairPipeline({ currentStatus, jobData, onStatusChange }: Props) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const currentIdx   = PIPELINE_STAGES.findIndex(s => s.key === currentStatus);
  const isTerminal   = TERMINAL_STAGES.some(s => s.key === currentStatus);
  const allowed      = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  const currentLabel = ALL_LABELS[currentStatus] ?? currentStatus;

  function openConfirm(key: string, label: string) {
    if (!allowed.includes(key)) return;
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

  const modal = confirm ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}
    >
      <div
        className="rounded-2xl border border-white/10 p-5 w-full max-w-sm shadow-2xl"
        style={{ background: "rgba(15,10,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        <h3 className="text-sm font-black text-white mb-1">تأكيد تغيير الحالة</h3>
        <p className="text-xs text-white/50 mb-4">
          الانتقال من{" "}
          <span className="text-violet-300 font-bold">{currentLabel}</span>
          {" "}إلى{" "}
          <span className="text-white font-bold">{confirm.label}</span>
        </p>

        {confirm.errors.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <p className="text-[11px] font-bold text-red-400 mb-1.5">⚠ متطلبات غير مستوفاة:</p>
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
            className="flex-1 py-2 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50"
            style={{ background: "rgba(124,58,237,0.7)", border: "1px solid rgba(139,92,246,0.4)" }}
          >
            {confirm.loading ? "جارٍ التحديث..." : "✓ تأكيد"}
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {modal}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="overflow-x-auto scrollbar-none" dir="ltr">
          <div className="flex items-stretch min-w-max">
            {[...PIPELINE_STAGES].reverse().map((stage) => {
              const originalIdx = PIPELINE_STAGES.findIndex(s => s.key === stage.key);
              const isActive    = stage.key === currentStatus;
              const isCompleted = !isTerminal && currentIdx > originalIdx && currentIdx !== -1;
              const isClickable = allowed.includes(stage.key);
              const cc          = COLOR_CLASSES[stage.color] ?? COLOR_CLASSES.violet;

              return (
                <button
                  key={stage.key}
                  onClick={() => openConfirm(stage.key, ALL_LABELS[stage.key] ?? stage.label)}
                  disabled={!isClickable && !isActive}
                  title={ALL_LABELS[stage.key]}
                  className={[
                    "relative flex flex-col items-center gap-1 px-3 py-2.5 border-l border-white/5 first:border-l-0 min-w-[64px] transition-all duration-150",
                    isActive    ? `${cc.bg} shadow-lg ${cc.glow}` :
                    isCompleted ? "bg-emerald-500/8" :
                    isClickable ? "hover:bg-white/5 cursor-pointer" :
                    "opacity-25 cursor-not-allowed",
                  ].filter(Boolean).join(" ")}
                >
                  {isActive && (
                    <span className={`absolute top-0 left-0 right-0 h-0.5 ${cc.dot}`} />
                  )}
                  <div className="relative text-sm leading-none">
                    {stage.icon}
                    {isCompleted && (
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 absolute -top-1 -right-1" />
                    )}
                    {isActive && (
                      <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${cc.dot} animate-pulse`} />
                    )}
                  </div>
                  <span className={[
                    "text-[9px] font-semibold leading-tight text-center whitespace-nowrap",
                    isActive    ? cc.text      :
                    isCompleted ? "text-emerald-400/70" :
                    isClickable ? "text-white/50" : "text-white/20",
                  ].join(" ")}>
                    {stage.label}
                  </span>
                </button>
              );
            })}

            <div className="w-px bg-white/10 mx-0 self-stretch" />

            {TERMINAL_STAGES.map(stage => {
              const isActive    = stage.key === currentStatus;
              const isClickable = allowed.includes(stage.key);
              return (
                <button
                  key={stage.key}
                  onClick={() => openConfirm(stage.key, ALL_LABELS[stage.key] ?? stage.label)}
                  disabled={!isClickable && !isActive}
                  title={ALL_LABELS[stage.key]}
                  className={[
                    "flex flex-col items-center gap-1 px-3 py-2.5 border-l border-white/5 min-w-[56px] transition-all",
                    isActive    ? "bg-red-500/15 border-l-red-500/20" :
                    isClickable ? "hover:bg-red-500/8 cursor-pointer" :
                    "opacity-20 cursor-not-allowed",
                  ].filter(Boolean).join(" ")}
                >
                  <span className="text-sm leading-none">{stage.icon}</span>
                  <span className={`text-[9px] font-semibold ${isActive ? "text-red-300" : isClickable ? "text-red-400/60" : "text-white/20"}`}>
                    {stage.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
