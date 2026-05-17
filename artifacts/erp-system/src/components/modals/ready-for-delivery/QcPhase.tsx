import { Check, Minus, XCircle, ThumbsDown, Save, Loader2, AlertTriangle, MessageSquare, ClipboardList, ClipboardCheck, Wrench } from "lucide-react";
import { QcItem, QcStatus, IntakeItem } from "./types";

const QC_BTN: Record<QcStatus, { label: string; bg: string; ring: string; icon: React.ComponentType<{ className?: string }> }> = {
  pass:  { label: "قبول",     bg: "bg-emerald-500/85", ring: "ring-emerald-300/60", icon: Check   },
  fail:  { label: "رفض",      bg: "bg-red-500/85",     ring: "ring-red-300/60",     icon: XCircle },
  "n/a": { label: "لا ينطبق", bg: "bg-zinc-500/80",    ring: "ring-zinc-300/50",    icon: Minus   },
};

const INTAKE_BADGE: Record<string, { txt: string; cls: string; bg: string }> = {
  pass:       { txt: "يعمل",     cls: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25" },
  fail:       { txt: "لا يعمل",  cls: "text-red-300",     bg: "bg-red-500/10 border-red-500/25"         },
  partial:    { txt: "جزئي",     cls: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/25"     },
  untestable: { txt: "غير قابل", cls: "text-zinc-300",    bg: "bg-zinc-500/10 border-zinc-500/25"       },
  na:         { txt: "غير قابل", cls: "text-zinc-300",    bg: "bg-zinc-500/10 border-zinc-500/25"       },
};

interface QcPhaseProps {
  items: QcItem[];
  intakeItems: IntakeItem[];
  isFallback?: boolean;
  templateLoading?: boolean;
  openNotes: Set<number>;
  rejectMode: boolean;
  rejectReason: string;
  qcLoading: boolean;
  qcErrors: string[];
  passCount: number;
  failCount: number;
  naCount: number;
  pendingCount: number;
  allDecided: boolean;
  qcOnly: boolean;
  onSetItems: (fn: (prev: QcItem[]) => QcItem[]) => void;
  onToggleNotes: (idx: number) => void;
  onSetRejectMode: (v: boolean) => void;
  onSetRejectReason: (v: string) => void;
  onQcApprove: () => void;
  onQcReject: () => void;
  onClose: () => void;
  onSaved: () => void;
  setPhase: (p: "billing") => void;
}

export default function QcPhase({
  items, intakeItems, isFallback = false, templateLoading = false,
  openNotes, rejectMode, rejectReason,
  qcLoading, qcErrors, passCount, failCount, naCount, pendingCount,
  allDecided, qcOnly,
  onSetItems, onToggleNotes, onSetRejectMode, onSetRejectReason,
  onQcApprove, onQcReject, onClose, onSaved, setPhase,
}: QcPhaseProps) {
  return (
    <>
      <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02]">
        <span className="text-[10px] text-white/55 ml-1">البنود: <span className="text-white font-bold">{items.length}</span></span>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">✓ {passCount}</span>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/12 text-red-300 border border-red-500/25">✗ {failCount}</span>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-500/12 text-zinc-300 border border-zinc-500/25">‒ {naCount}</span>
        {pendingCount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-300 border border-amber-500/25 animate-pulse">
            ⚠ متبقي: {pendingCount}
          </span>
        )}
      </div>

      {templateLoading ? (
        <div className="px-5 py-12 text-center">
          <Loader2 className="w-8 h-8 text-purple-400/60 mx-auto mb-3 animate-spin" />
          <p className="text-[12px] text-white/50">جارٍ تحميل قالب الفحص...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400/60 mx-auto mb-2" />
          <p className="text-sm text-white/70 font-bold mb-1">لا توجد بنود فحص</p>
          <p className="text-[11px] text-white/40">تعذّر تحميل القالب — يمكنك المتابعة مباشرةً.</p>
          <button
            onClick={() => qcOnly ? onSaved() : setPhase("billing")}
            className="mt-4 px-5 py-2 rounded-xl text-white text-xs font-bold"
            style={{ background: "rgba(132,204,22,0.2)", border: "1px solid rgba(163,230,53,0.3)" }}
          >
            {qcOnly ? "تأكيد الانتقال لجاهز للتسليم" : "المتابعة لمحاسبة العميل"}
          </button>
        </div>
      ) : isFallback ? (
        /* ── وضع القالب الافتراضي: عمود واحد للفحص + لافتة إشعار ── */
        <div className="max-h-[55vh] overflow-y-auto" dir="rtl">
          <div className="mx-4 mt-3 mb-2 px-3 py-2 rounded-xl border border-violet-500/25 bg-violet-500/8 flex items-start gap-2">
            <Wrench className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-violet-200/80">
              الجهاز استُلم وهو لا يعمل — يُستخدم قالب الفحص الافتراضي للتحقق من سلامة الإصلاح.
            </p>
          </div>
          <div className="bg-purple-500/[0.03]">
            <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-white/5 bg-purple-500/10 backdrop-blur">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-purple-300" />
                <p className="text-[12px] font-black text-purple-200">فحص الجهاز بعد الإصلاح</p>
                <span className="text-[9px] text-violet-300/60 font-bold px-1.5 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10">قالب افتراضي</span>
              </div>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {items.map((it, idx) => {
                const cardCls =
                  it.status === "pass" ? "border-emerald-500/30 bg-emerald-500/[0.04]" :
                  it.status === "fail" ? "border-red-500/30 bg-red-500/[0.04]" :
                  it.status === "n/a"  ? "border-zinc-500/25 bg-zinc-500/[0.03]" :
                                         "border-white/8 bg-white/[0.02]";
                const notesOpen = openNotes.has(idx);
                const hasNote   = (it.notes ?? "").trim().length > 0;
                return (
                  <div key={`f-${it.id}-${idx}`} className={`rounded-xl border transition-colors ${cardCls}`}>
                    <div className="flex items-center gap-1.5 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => onToggleNotes(idx)}
                        className={[
                          "shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                          hasNote
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                            : notesOpen
                              ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              : "bg-white/[0.04] text-white/40 border border-white/10 hover:text-white/70 hover:bg-white/[0.08]",
                        ].join(" ")}
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                      <p
                        className="flex-1 min-w-0 text-[11.5px] font-bold text-white truncate cursor-pointer"
                        onClick={() => onToggleNotes(idx)}
                      >
                        {it.label}
                      </p>
                      {it.category && <span className="text-[9px] text-white/30 shrink-0">{it.category}</span>}
                      <div className="flex items-center gap-1 shrink-0">
                        {(["pass", "fail", "n/a"] as QcStatus[]).map(st => {
                          const cfg    = QC_BTN[st];
                          const Icon   = cfg.icon;
                          const active = it.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => onSetItems(prev => prev.map((x, i) => i === idx ? { ...x, status: st } : x))}
                              disabled={qcLoading}
                              title={cfg.label}
                              className={[
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                                active
                                  ? `${cfg.bg} text-white ring-2 ${cfg.ring} shadow-md`
                                  : "bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white",
                              ].join(" ")}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {notesOpen && (
                      <div className="px-2.5 pb-2 pt-0">
                        <input
                          value={it.notes ?? ""}
                          onChange={(e) => onSetItems(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                          placeholder="ملاحظة (اختيارية)"
                          disabled={qcLoading}
                          autoFocus
                          className={[
                            "w-full px-2.5 py-1 rounded-md text-[10.5px] text-white placeholder:text-white/25 focus:outline-none transition-colors",
                            it.status === "fail"
                              ? "bg-red-500/8 border border-red-500/25 focus:border-red-400/45"
                              : "bg-white/[0.03] border border-white/8 focus:border-purple-400/35",
                          ].join(" ")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ── وضع بنود الاستلام: عمودان (استلام + قرار) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto" dir="rtl">
          <div className="border-l border-white/5 bg-indigo-500/[0.03]">
            <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-white/5 bg-indigo-500/10 backdrop-blur">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-300" />
                <p className="text-[12px] font-black text-indigo-200">بنود الاستلام (مرجع)</p>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {intakeItems.map((it, idx) => {
                const meta = INTAKE_BADGE[String(it.status ?? "")];
                return (
                  <div key={`r-${it.id}-${idx}`} className="rounded-xl border border-white/8 px-3 py-2 bg-white/[0.02]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-white/85 leading-tight">{it.label}</p>
                        {it.category && <p className="text-[9px] text-white/35 mt-0.5">{it.category}</p>}
                        {it.notes && <p className="text-[10px] text-amber-300/70 mt-1 italic">ملاحظة: {it.notes}</p>}
                      </div>
                      {meta
                        ? <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${meta.bg} ${meta.cls}`}>{meta.txt}</span>
                        : <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/10 text-white/40 shrink-0">—</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-purple-500/[0.03]">
            <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-white/5 bg-purple-500/10 backdrop-blur">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-purple-300" />
                <p className="text-[12px] font-black text-purple-200">قرار الفحص النهائي</p>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {items.map((it, idx) => {
                const cardCls =
                  it.status === "pass" ? "border-emerald-500/30 bg-emerald-500/[0.04]" :
                  it.status === "fail" ? "border-red-500/30 bg-red-500/[0.04]" :
                  it.status === "n/a"  ? "border-zinc-500/25 bg-zinc-500/[0.03]" :
                                         "border-white/8 bg-white/[0.02]";
                const notesOpen = openNotes.has(idx);
                const hasNote   = (it.notes ?? "").trim().length > 0;
                return (
                  <div key={`l-${it.id}-${idx}`} className={`rounded-xl border transition-colors ${cardCls}`}>
                    <div className="flex items-center gap-1.5 px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() => onToggleNotes(idx)}
                        className={[
                          "shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                          hasNote
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                            : notesOpen
                              ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                              : "bg-white/[0.04] text-white/40 border border-white/10 hover:text-white/70 hover:bg-white/[0.08]",
                        ].join(" ")}
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                      <p
                        className="flex-1 min-w-0 text-[11.5px] font-bold text-white truncate cursor-pointer"
                        onClick={() => onToggleNotes(idx)}
                      >
                        {it.label}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {(["pass", "fail", "n/a"] as QcStatus[]).map(st => {
                          const cfg    = QC_BTN[st];
                          const Icon   = cfg.icon;
                          const active = it.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => onSetItems(prev => prev.map((x, i) => i === idx ? { ...x, status: st } : x))}
                              disabled={qcLoading}
                              title={cfg.label}
                              className={[
                                "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                                active
                                  ? `${cfg.bg} text-white ring-2 ${cfg.ring} shadow-md`
                                  : "bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08] hover:text-white",
                              ].join(" ")}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {notesOpen && (
                      <div className="px-2.5 pb-2 pt-0">
                        <input
                          value={it.notes ?? ""}
                          onChange={(e) => onSetItems(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                          placeholder="ملاحظة (اختيارية)"
                          disabled={qcLoading}
                          autoFocus
                          className={[
                            "w-full px-2.5 py-1 rounded-md text-[10.5px] text-white placeholder:text-white/25 focus:outline-none transition-colors",
                            it.status === "fail"
                              ? "bg-red-500/8 border border-red-500/25 focus:border-red-400/45"
                              : "bg-white/[0.03] border border-white/8 focus:border-purple-400/35",
                          ].join(" ")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {rejectMode && (
        <div className="px-5 py-3 border-t border-white/5 bg-red-500/[0.04]">
          <label className="text-[11px] font-black text-red-300 mb-1.5 flex items-center gap-1.5">
            <ThumbsDown className="w-3.5 h-3.5" />
            سبب رفض الفحص (إلزامي — سيُعاد للفني)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => onSetRejectReason(e.target.value)}
            rows={3}
            disabled={qcLoading}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/25 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/50"
            placeholder="مثلاً: الكاميرا الخلفية ما زالت لا تعمل — يحتاج إعادة فحص..."
          />
          {failCount > 0 && (
            <p className="mt-2 text-[10px] text-red-300/80">
              ⓘ سيُسجَّل تفصيل البنود المرفوضة ({failCount} بند) تلقائياً.
            </p>
          )}
        </div>
      )}

      {qcErrors.length > 0 && (
        <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
          <ul className="list-disc list-inside">
            {qcErrors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
          </ul>
        </div>
      )}

      <div className="px-5 py-4 border-t border-white/8 flex flex-wrap gap-2">
        {!rejectMode ? (
          <>
            <button
              onClick={onQcApprove}
              disabled={qcLoading || !allDecided || failCount > 0 || items.length === 0}
              className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
            >
              {qcLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                : <><Save className="w-3.5 h-3.5" /> {qcOnly ? "قبول الفحص — جاهز للتسليم" : "قبول الفحص والمتابعة للمحاسبة"}</>}
            </button>
            <button
              onClick={() => { onSetRejectMode(true); }}
              disabled={qcLoading || items.length === 0}
              className="px-4 py-2.5 rounded-xl text-red-300 hover:text-white text-xs font-bold transition-all border border-red-500/30 hover:bg-red-500/15 flex items-center gap-1.5"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              رفض الفحص (يعود للإصلاح)
            </button>
            <button
              onClick={onClose}
              disabled={qcLoading}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
            >
              إلغاء
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onQcReject}
              disabled={qcLoading || rejectReason.trim().length < 3}
              className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
            >
              {qcLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                : <><ThumbsDown className="w-3.5 h-3.5" /> تأكيد الرفض وإعادة للإصلاح</>}
            </button>
            <button
              onClick={() => { onSetRejectMode(false); onSetRejectReason(""); }}
              disabled={qcLoading}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
            >
              رجوع
            </button>
          </>
        )}
      </div>
    </>
  );
}
