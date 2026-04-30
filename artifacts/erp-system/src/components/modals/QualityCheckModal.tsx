/**
 * QualityCheckModal — بوّابة "مراقبة الجودة (QC)"
 *
 * يفتح عند الانتقال من "جارٍ الإصلاح" إلى "مراقبة الجودة".
 *
 * تخطيط بعمودين:
 *   - اليمين: بنود الفحص الأولي عند الاستلام (للقراءة فقط، كمرجع للمقارنة).
 *   - اليسار: نفس البنود مع قرار الفني (قبول / رفض / لا ينطبق) + خانة ملاحظات.
 *
 * - زرّ "حفظ نتيجة الفحص" — يحفظ qa_checklist + qa_completed_at ويغلق المودال.
 *   النقل لـ "جاهز للتسليم" يتم يدوياً من شريط مسار الإصلاح بعد اعتماد الفحص.
 *   مفعّل فقط حين تُتَّخذ قرار لكل بند ولا يوجد أي بند مرفوض.
 * - زرّ "رفض الفحص" — يبقى البطاقة في "جارٍ الإصلاح" مع حفظ سبب الرفض في qa_notes.
 *
 * Endpoints:
 *   POST  /api/repair-jobs/:id/qa-checklist  → يحفظ qa_checklist + qa_completed_at
 *   PATCH /api/repair-jobs/:id               → يحفظ qa_notes (للرفض فقط)
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck, Loader2, X, AlertTriangle,
  Check, Minus, XCircle, ThumbsDown, Save,
  ClipboardCheck, ClipboardList, MessageSquare,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type QcStatus = "pass" | "fail" | "n/a";
type Outcome  = "approve" | "reject";

/** بند الفحص الأولي كما يحفظه نظام الاستلام */
interface IntakeItem {
  id: string;
  label: string;
  category?: string;
  status?: string | null;        // pass | fail | partial | untestable | null
  notes?: string | null;
}

/** بند فحص الجودة — مطابق لبنود الاستلام مع قرار الفني */
interface QcItem {
  id: string;
  label: string;
  category?: string;
  intake_status?: string | null; // الحالة الأصلية عند الاستلام (مرجع)
  intake_notes?: string | null;
  status: QcStatus | null;       // قرار الفني الحالي
  notes: string;                 // ملاحظات الفني
}

interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  checklist?: unknown;
  qa_checklist?: unknown;
  qa_notes?: string | null;
  device_score?: number | null;
}

interface Props {
  job: JobLite;
  onClose: () => void;
  /** يستدعى بعد الحفظ مع نتيجة الفحص. الأب يقرّر النقل بناءً على outcome. */
  onSaved: (outcome: Outcome) => void;
}

/* ─── ألوان أزرار القرار ─── */
const QC_BTN: Record<QcStatus, { label: string; bg: string; ring: string; icon: typeof Check }> = {
  pass:   { label: "قبول",     bg: "bg-emerald-500/85", ring: "ring-emerald-300/60", icon: Check   },
  fail:   { label: "رفض",      bg: "bg-red-500/85",     ring: "ring-red-300/60",     icon: XCircle },
  "n/a":  { label: "لا ينطبق", bg: "bg-zinc-500/80",    ring: "ring-zinc-300/50",    icon: Minus   },
};

/* ─── شارة حالة الاستلام للعرض في العمود الأيمن ─── */
const INTAKE_BADGE: Record<string, { txt: string; cls: string; bg: string }> = {
  pass:       { txt: "يعمل",     cls: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25" },
  fail:       { txt: "لا يعمل",  cls: "text-red-300",     bg: "bg-red-500/10 border-red-500/25"         },
  partial:    { txt: "جزئي",     cls: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/25"     },
  untestable: { txt: "غير قابل", cls: "text-zinc-300",    bg: "bg-zinc-500/10 border-zinc-500/25"       },
  na:         { txt: "غير قابل", cls: "text-zinc-300",    bg: "bg-zinc-500/10 border-zinc-500/25"       },
};

/* ─── parsing helpers ─── */
function parseChecklist(raw: unknown): IntakeItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) arr = v; } catch { /* ignore */ }
  }
  return arr
    .map((c, i) => {
      const o = c as Record<string, unknown>;
      const id = String(o.id ?? o.item_id ?? `item-${i}`);
      const label = String(o.label ?? o.label_ar ?? `بند ${i + 1}`);
      // تجاهل بند "الجهاز لا يفتح" — لا يصلح للفحص
      if (id === "__power_off__") return null;
      return {
        id,
        label,
        category: typeof o.category === "string" ? o.category : undefined,
        status:   typeof o.status === "string" ? o.status : null,
        notes:    typeof o.notes === "string" ? o.notes : null,
      } as IntakeItem;
    })
    .filter((x): x is IntakeItem => x !== null);
}

function parseSavedQc(raw: unknown): Array<{ id?: string; label?: string; status?: string; notes?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ id?: string; label?: string; status?: string; notes?: string }>;
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function QualityCheckModal({ job, onClose, onSaved }: Props) {
  const { toast } = useToast();

  /* بنود الاستلام — تُمثّل المرجع وتُستخدم لبناء بنود الفحص */
  const intakeItems = useMemo(() => parseChecklist(job.checklist), [job.checklist]);

  /* بنود الفحص — مبنيّة من الاستلام مع استرجاع أي قرارات محفوظة سابقاً */
  const initial: QcItem[] = useMemo(() => {
    const savedRaw = parseSavedQc(job.qa_checklist);
    const savedById = new Map<string, { status?: string; notes?: string }>();
    savedRaw.forEach((s, i) => {
      const k = String(s.id ?? s.label ?? `item-${i}`);
      savedById.set(k, { status: s.status, notes: s.notes });
    });

    return intakeItems.map(it => {
      const saved = savedById.get(it.id) ?? savedById.get(it.label);
      const st = saved?.status;
      return {
        id:            it.id,
        label:         it.label,
        category:      it.category,
        intake_status: it.status,
        intake_notes:  it.notes,
        status:        (st === "pass" || st === "fail" || st === "n/a") ? st : null,
        notes:         typeof saved?.notes === "string" ? saved.notes : "",
      };
    });
  }, [intakeItems, job.qa_checklist]);

  const [items, setItems]     = useState<QcItem[]>(initial);
  const [score, setScore]     = useState<string>(job.device_score != null ? String(job.device_score) : "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<string[]>([]);

  /* وضع الرفض — يطلب سبباً إجمالياً إلزامياً */
  const [rejectMode, setRejectMode]       = useState(false);
  const [rejectReason, setRejectReason]   = useState<string>("");

  /* البنود المفتوحة لإظهار خانة الملاحظات */
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());
  function toggleNotes(idx: number) {
    setOpenNotes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  const passCount    = items.filter(i => i.status === "pass").length;
  const failCount    = items.filter(i => i.status === "fail").length;
  const naCount      = items.filter(i => i.status === "n/a").length;
  const pendingCount = items.length - passCount - failCount - naCount;
  const allDecided   = items.length > 0 && pendingCount === 0;

  function setItemStatus(idx: number, st: QcStatus) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: st } : it));
  }
  function setItemNotes(idx: number, n: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, notes: n } : it));
  }

  /** حفظ نتيجة الفحص — يحفظ qa_checklist + qa_completed_at فقط (بدون نقل تلقائي).
      النقل لـ "جاهز للتسليم" يدوي من شريط مسار الإصلاح بعد فتح بوّابة المراجعة النهائية. */
  async function handleApprove() {
    if (items.length === 0) {
      setErrors(["لا توجد بنود فحص — يجب أن يكون هناك فحص أولي مسجَّل عند الاستلام"]);
      return;
    }
    if (!allDecided) {
      setErrors([`يجب اتخاذ قرار لكل بند — متبقي ${pendingCount} بند`]);
      return;
    }
    if (failCount > 0) {
      setErrors([`لا يمكن قبول الفحص ووجود ${failCount} بند مرفوض — استخدم زر "رفض الفحص" لإعادة البطاقة للإصلاح`]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/qa-checklist`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({
            id:       i.id,
            label:    i.label,
            label_ar: i.label,
            category: i.category,
            status:   i.status,
            notes:    i.notes ?? "",
          })),
          notes: "",
          device_score: score.trim() === "" ? null : Number(score),
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setErrors([data.error ?? "تعذّر حفظ فحص الجودة"]);
        setLoading(false);
        return;
      }
      toast({
        title: "✓ تم حفظ نتيجة الفحص",
        description: `${passCount} بند ناجح · ${naCount} لا ينطبق — يمكنك الآن النقل يدوياً إلى "جاهز للتسليم"`,
      });
      onSaved("approve");
    } catch {
      setErrors(["تعذّر الاتصال بالخادم"]);
      setLoading(false);
    }
  }

  /** رفض الفحص — يحفظ qa_notes مع تفصيل البنود المرفوضة + يُبقي البطاقة في in_repair */
  async function handleReject() {
    if (rejectReason.trim().length < 3) {
      setErrors(["يجب كتابة سبب رفض الفحص (3 أحرف على الأقل)"]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      /* تفصيل البنود المرفوضة في النص — ليُعرض في تقرير الفني */
      const failedLines = items
        .filter(i => i.status === "fail")
        .map(i => `  • ${i.label}${i.notes ? ` — ${i.notes}` : ""}`)
        .join("\n");
      const stamped =
        `[رفض QC ${new Date().toLocaleString("ar-EG")}] ${rejectReason.trim()}` +
        (failedLines ? `\nالبنود المرفوضة:\n${failedLines}` : "");
      const merged = job.qa_notes ? `${job.qa_notes}\n\n${stamped}` : stamped;

      const res = await authFetch(api(`/api/repair-jobs/${job.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qa_notes: merged }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setErrors([data.error ?? "تعذّر حفظ سبب الرفض"]);
        setLoading(false);
        return;
      }
      toast({
        title: "⚠ رفض الفحص",
        description: "البطاقة بقيت في مرحلة \"جارٍ الإصلاح\" — راجع الفني لإعادة المعالجة.",
        variant: "destructive",
      });
      onSaved("reject");
    } catch {
      setErrors(["تعذّر الاتصال بالخادم"]);
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
        className="my-4 rounded-2xl border border-white/10 w-full max-w-5xl shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">فحص مراقبة الجودة (QC)</h3>
              <p className="text-[11px] text-white/50">
                البطاقة <span className="text-white font-bold">{job.job_no}</span>
                {job.device_brand && <> · {job.device_brand} {job.device_model ?? ""}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Counters ── */}
        <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02]">
          <span className="text-[10px] text-white/55 ml-1">إجمالي البنود: <span className="text-white font-bold">{items.length}</span></span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">
            ✓ مقبول: {passCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/12 text-red-300 border border-red-500/25">
            ✗ مرفوض: {failCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-500/12 text-zinc-300 border border-zinc-500/25">
            ‒ لا ينطبق: {naCount}
          </span>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/12 text-amber-300 border border-amber-500/25 animate-pulse">
              ⚠ متبقي: {pendingCount}
            </span>
          )}
        </div>

        {/* ── Two-column layout: intake (right) ↔ QC decisions (left) ── */}
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400/60 mx-auto mb-2" />
            <p className="text-sm text-white/70 font-bold mb-1">لا توجد بنود فحص أولي</p>
            <p className="text-[11px] text-white/40">
              لم يُسجَّل فحص عند الاستلام — لا يمكن إجراء مراقبة جودة بدون مرجع.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[58vh] overflow-y-auto" dir="rtl">
            {/* ═══ العمود الأيمن: بنود الاستلام (للقراءة فقط) ═══ */}
            <div className="border-l border-white/5 bg-indigo-500/[0.03]">
              <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-white/5 bg-indigo-500/10 backdrop-blur">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-300" />
                  <p className="text-[12px] font-black text-indigo-200">بنود الاستلام (مرجع)</p>
                  <span className="text-[10px] text-indigo-200/60">— حالة الجهاز عند الاستلام</span>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {items.map((it, idx) => {
                  const stKey = String(it.intake_status ?? "");
                  const meta = INTAKE_BADGE[stKey];
                  return (
                    <div
                      key={`r-${it.id}-${idx}`}
                      className="rounded-xl border border-white/8 px-3 py-2 bg-white/[0.02]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white/85 leading-tight">{it.label}</p>
                          {it.category && (
                            <p className="text-[9px] text-white/35 mt-0.5">{it.category}</p>
                          )}
                          {it.intake_notes && (
                            <p className="text-[10px] text-amber-300/70 mt-1 italic">
                              ملاحظة الاستلام: {it.intake_notes}
                            </p>
                          )}
                        </div>
                        {meta ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${meta.bg} ${meta.cls}`}>
                            {meta.txt}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-white/10 text-white/40 shrink-0">
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ العمود الأيسر: قرار الفني ═══ */}
            <div className="bg-purple-500/[0.03]">
              <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-white/5 bg-purple-500/10 backdrop-blur">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-purple-300" />
                  <p className="text-[12px] font-black text-purple-200">قرار الفني (مراقبة الجودة)</p>
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
                    <div
                      key={`l-${it.id}-${idx}`}
                      className={`rounded-xl border transition-colors ${cardCls}`}
                    >
                      {/* صف البند — نفس ارتفاع بطاقة الاستلام في اليمين */}
                      <div className="flex items-center gap-1.5 px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => toggleNotes(idx)}
                          title={notesOpen ? "إخفاء الملاحظة" : "إظهار حقل الملاحظة"}
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
                          onClick={() => toggleNotes(idx)}
                          title="اضغط لإظهار/إخفاء الملاحظة"
                        >
                          {it.label}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {(["pass","fail","n/a"] as QcStatus[]).map(st => {
                            const cfg = QC_BTN[st];
                            const Icon = cfg.icon;
                            const active = it.status === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setItemStatus(idx, st)}
                                disabled={loading}
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

                      {/* الملاحظة — تظهر منسدلة فقط عند الفتح */}
                      {notesOpen && (
                        <div className="px-2.5 pb-2 pt-0">
                          <input
                            value={it.notes ?? ""}
                            onChange={(e) => setItemNotes(idx, e.target.value)}
                            placeholder="ملاحظة الفني (اختيارية)"
                            disabled={loading}
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

        {/* ── سبب الرفض الإجمالي (يظهر في وضع الرفض فقط) ── */}
        {rejectMode && (
          <div className="px-5 py-3 border-t border-white/5 bg-red-500/[0.04]">
            <label className="text-[11px] font-black text-red-300 mb-1.5 flex items-center gap-1.5">
              <ThumbsDown className="w-3.5 h-3.5" />
              سبب رفض الفحص (إلزامي — سيُعاد للفني)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              disabled={loading}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/25 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/50"
              placeholder="مثلاً: الكاميرا الخلفية ما زالت لا تعمل بعد التركيب — يحتاج إعادة فحص..."
            />
            {failCount > 0 && (
              <p className="mt-2 text-[10px] text-red-300/80">
                ⓘ سيُسجَّل تلقائياً تفصيل البنود المرفوضة ({failCount} بند) في تقرير الفني.
              </p>
            )}
          </div>
        )}

        {/* ── تقييم الجهاز (يظهر في وضع القبول فقط) ── */}
        {!rejectMode && items.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 text-[10.5px] text-white/55">
              <span className="text-white/70 font-bold">ملاحظة:</span> القبول لن يُسمح به ما لم يُتَّخذ قرار لكل بند ولا يوجد أي بند مرفوض.
              في حالة وجود بند مرفوض، استخدم زر <span className="text-red-300 font-bold">«رفض الفحص»</span> لإعادة البطاقة لـ <span className="text-cyan-300 font-bold">«جارٍ الإصلاح»</span>.
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/55 mb-1">تقييم الجهاز (0–100) — اختياري</label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white focus:outline-none focus:border-purple-400/40"
                placeholder="—"
              />
            </div>
          </div>
        )}

        {/* ── Errors ── */}
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

        {/* ── Actions ── */}
        <div className="px-5 py-4 border-t border-white/8 flex flex-wrap gap-2">
          {!rejectMode ? (
            <>
              <button
                onClick={handleApprove}
                disabled={loading || !allDecided || failCount > 0 || items.length === 0}
                className="flex-1 min-w-[220px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                  : <><Save className="w-3.5 h-3.5" /> حفظ نتيجة الفحص</>}
              </button>
              <button
                onClick={() => { setRejectMode(true); setErrors([]); }}
                disabled={loading || items.length === 0}
                className="px-4 py-2.5 rounded-xl text-red-300 hover:text-white text-xs font-bold transition-all border border-red-500/30 hover:bg-red-500/15 flex items-center gap-1.5"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                رفض الفحص (يعود للإصلاح)
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
              >
                إلغاء
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={loading || rejectReason.trim().length < 3}
                className="flex-1 min-w-[220px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                  : <><ThumbsDown className="w-3.5 h-3.5" /> تأكيد الرفض وإعادة للإصلاح</>}
              </button>
              <button
                onClick={() => { setRejectMode(false); setRejectReason(""); setErrors([]); }}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
              >
                رجوع
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
