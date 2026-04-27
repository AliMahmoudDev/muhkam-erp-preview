import { useState } from "react";
import { CheckCircle2, XCircle, Ban, ChevronRight } from "lucide-react";

const PIPELINE_STAGES = [
  { key: "received",                  label: "استلام الجهاز",          icon: "📥", color: "#8b5cf6" },
  { key: "initial_inspection",        label: "الفحص الأولي",           icon: "🔍", color: "#6366f1" },
  { key: "diagnosis",                 label: "التشخيص",                icon: "🩺", color: "#3b82f6" },
  { key: "waiting_customer_approval", label: "انتظار موافقة العميل",   icon: "⏳", color: "#f59e0b" },
  { key: "approved",                  label: "تمت الموافقة",           icon: "✅", color: "#10b981" },
  { key: "in_repair",                 label: "جاري الإصلاح",           icon: "🔧", color: "#06b6d4" },
  { key: "repaired",                  label: "تم الإصلاح",             icon: "🛠️", color: "#22d3ee" },
  { key: "final_quality_check",       label: "مراقبة الجودة",          icon: "🏅", color: "#a855f7" },
  { key: "ready_for_delivery",        label: "جاهز للتسليم",           icon: "📦", color: "#84cc16" },
  { key: "delivered",                 label: "تم التسليم",             icon: "🎉", color: "#14b8a6" },
] as const;

const TERMINAL_STAGES = [
  { key: "rejected",  label: "مرفوض", icon: "🚫", color: "#ef4444" },
  { key: "cancelled", label: "ملغي",  icon: "❌", color: "#f43f5e" },
] as const;

const ALL_LABELS: Record<string, string> = {
  ...Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s.label])),
  ...Object.fromEntries(TERMINAL_STAGES.map(s => [s.key, s.label])),
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
  delivered:                 [],
  rejected:                  [],
  cancelled:                 [],
};

interface RepairJob {
  id: number;
  status: string;
  [key: string]: unknown;
}

interface Props {
  currentStatus: string;
  jobId: number;
  jobData: RepairJob;
  onStatusChange: (newStatus: string) => void;
}

interface ConfirmModal {
  target: string;
  label: string;
  errors: string[];
}

export default function RepairPipeline({ currentStatus, jobData, onStatusChange }: Props) {
  const [modal, setModal] = useState<ConfirmModal | null>(null);
  const [loading, setLoading] = useState(false);

  const currentIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStatus);
  const isTerminal = TERMINAL_STAGES.some(s => s.key === currentStatus);
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

  function handleStageClick(key: string, label: string) {
    if (!allowed.includes(key)) return;
    setModal({ target: key, label, errors: [] });
  }

  async function handleConfirm() {
    if (!modal) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/repair-jobs/${jobData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: modal.target }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        if (res.status === 422) {
          const errorList = (data.error ?? "").split(", ").filter(Boolean);
          setModal(m => m ? { ...m, errors: errorList } : null);
          return;
        }
        setModal(m => m ? { ...m, errors: [data.error ?? "حدث خطأ"] } : null);
        return;
      }
      onStatusChange(modal.target);
      setModal(null);
    } finally {
      setLoading(false);
    }
  }

  const currentLabel = ALL_LABELS[currentStatus] ?? currentStatus;
  const terminalStage = TERMINAL_STAGES.find(s => s.key === currentStatus);

  return (
    <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] text-violet-400/70 font-bold mb-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
          مسار الصيانة
        </p>
      </div>

      <div className="overflow-x-auto pb-3 px-3 scrollbar-none" dir="ltr">
        <div className="flex items-center gap-1 min-w-max">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isActive    = stage.key === currentStatus;
            const isCompleted = !isTerminal && currentIdx > idx && currentIdx !== -1;
            const isClickable = allowed.includes(stage.key);
            const isDimmed    = !isActive && !isCompleted && !isClickable;

            return (
              <div key={stage.key} className="flex items-center gap-1">
                <button
                  onClick={() => handleStageClick(stage.key, stage.label)}
                  disabled={!isClickable && !isActive}
                  title={stage.label}
                  className={[
                    "relative flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition-all duration-200 min-w-[72px]",
                    isActive
                      ? "border-violet-500/60 bg-violet-500/15 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                      : isCompleted
                        ? "border-emerald-500/30 bg-emerald-500/8 cursor-default"
                        : isClickable
                          ? "border-white/20 bg-white/5 hover:border-violet-400/40 hover:bg-violet-500/8 cursor-pointer"
                          : "border-white/5 bg-white/2 cursor-not-allowed",
                    isDimmed ? "opacity-30" : "",
                  ].join(" ")}
                >
                  <div className="relative">
                    <span className="text-base">{stage.icon}</span>
                    {isCompleted && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 absolute -top-1 -right-1" />
                    )}
                    {isActive && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    )}
                  </div>
                  <span className={[
                    "text-[9px] font-bold leading-tight text-center whitespace-nowrap",
                    isActive    ? "text-violet-300"  :
                    isCompleted ? "text-emerald-400/80" :
                    isClickable ? "text-white/60"    : "text-white/20",
                  ].join(" ")}>
                    {stage.label}
                  </span>
                </button>

                {idx < PIPELINE_STAGES.length - 1 && (
                  <ChevronRight className={`w-3 h-3 shrink-0 ${isCompleted || isActive ? "text-white/30" : "text-white/10"}`} />
                )}
              </div>
            );
          })}

          <div className="w-px h-8 bg-white/10 mx-2 shrink-0" />

          {TERMINAL_STAGES.map(stage => {
            const isActive    = stage.key === currentStatus;
            const isClickable = allowed.includes(stage.key);
            return (
              <button
                key={stage.key}
                onClick={() => handleStageClick(stage.key, stage.label)}
                disabled={!isClickable && !isActive}
                title={stage.label}
                className={[
                  "flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl border transition-all duration-200 min-w-[60px]",
                  isActive
                    ? "border-red-500/60 bg-red-500/15 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
                    : isClickable
                      ? "border-red-500/20 bg-red-500/5 hover:border-red-400/40 hover:bg-red-500/10 cursor-pointer"
                      : "border-white/5 bg-white/2 cursor-not-allowed opacity-30",
                ].join(" ")}
              >
                <span className="text-base">
                  {stage.key === "rejected" ? <XCircle className="w-4 h-4 text-red-400" /> : <Ban className="w-4 h-4 text-rose-400" />}
                </span>
                <span className={`text-[9px] font-bold ${isActive ? "text-red-300" : isClickable ? "text-red-400/60" : "text-white/20"}`}>
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isTerminal && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 text-center font-bold">
          {terminalStage?.icon} هذه البطاقة في حالة نهائية: {currentLabel}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <div className="glass-panel rounded-2xl border border-white/10 p-5 w-full max-w-sm shadow-2xl">
            <h3 className="text-sm font-black text-white mb-1">تأكيد تغيير الحالة</h3>
            <p className="text-xs text-white/50 mb-4">
              هل تريد الانتقال من{" "}
              <span className="text-violet-300 font-bold">{currentLabel}</span>
              {" "}إلى{" "}
              <span className="text-white font-bold">{modal.label}</span>؟
            </p>

            {modal.errors.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-[11px] font-bold text-red-400 mb-1">متطلبات غير مستوفاة:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {modal.errors.map((e, i) => (
                    <li key={i} className="text-[11px] text-red-300">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {loading ? "جارٍ التحديث..." : "تأكيد الانتقال"}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-xs transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
