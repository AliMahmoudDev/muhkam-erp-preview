/**
 * QualityCheckModal — بوّابة "مراقبة الجودة (QC)"
 *
 * يفتح عند الانتقال من "جارٍ الإصلاح" إلى "مراقبة الجودة".
 *
 * - يعرض بنود الاستلام الأولي للقراءة فقط كمرجع للفني.
 * - يعرض قائمة فحص قياسية ثابتة (يعمل / لا يعمل / لا ينطبق).
 * - زرّ "قبول" — يحفظ بيانات الفحص + ينتقل تلقائياً إلى "جاهز للتسليم".
 * - زرّ "رفض" — يطلب سبباً إلزامياً، يحفظه في qa_notes، ويُبقي البطاقة في "جارٍ الإصلاح".
 *
 * Endpoints:
 *   POST /api/repair-jobs/:id/qa-checklist  → يحفظ qa_checklist + qa_completed_at (يفتح بوّابة ready_for_delivery)
 *   PATCH /api/repair-jobs/:id              → يحفظ qa_notes (للرفض فقط — لا يلمس qa_completed_at)
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck, Loader2, X, AlertTriangle,
  Check, Minus, XCircle, Eye, ThumbsUp, ThumbsDown, ArrowRight,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type QcStatus = "pass" | "fail" | "n/a";
type Outcome  = "approve" | "reject";

interface IntakeItem {
  label_ar: string;
  category?: string;
  status?: string | null;   // 'present' | 'damaged' | 'missing'
  notes?: string | null;
}

interface QcItem {
  label_ar: string;
  status: QcStatus | null;
  notes?: string;
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

/* ─────────────────────────────────────────────────────────────────────
 * قائمة الفحص القياسية لـ QC — ثابتة ومستقلّة عن بنود الاستلام.
 * ───────────────────────────────────────────────────────────────────── */
const QC_DEFAULT_ITEMS: { label_ar: string }[] = [
  { label_ar: "الجهاز يشتغل ويُقلِع للنظام بشكل طبيعي" },
  { label_ar: "الشاشة سليمة وتعرض بدون خطوط أو بقع" },
  { label_ar: "اللمس يستجيب في كل المناطق" },
  { label_ar: "الكاميرا الأمامية تعمل" },
  { label_ar: "الكاميرا الخلفية تعمل" },
  { label_ar: "السمّاعة العلوية (المكالمات) تعمل" },
  { label_ar: "السمّاعة السفلية (الميديا) تعمل" },
  { label_ar: "الميكروفون يلتقط الصوت بوضوح" },
  { label_ar: "الشاحن يعمل والبطارية تشحن" },
  { label_ar: "أزرار الباور والصوت تعمل" },
  { label_ar: "بصمة/Face ID تعمل (إن وُجدت)" },
  { label_ar: "WiFi و Bluetooth يتصلان" },
  { label_ar: "شبكة المحمول وSIM تعمل" },
  { label_ar: "السماعات اللاسلكية مقترنة (إن طُلب)" },
  { label_ar: "الجهاز نظيف خارجياً" },
];

/* ─── ألوان وعناصر مساعدة ─── */
const QC_BTN: Record<QcStatus, { label: string; bg: string; ring: string; icon: typeof Check }> = {
  pass: { label: "يعمل",      bg: "bg-emerald-500/85", ring: "ring-emerald-300/60", icon: Check   },
  fail: { label: "لا يعمل",   bg: "bg-red-500/85",     ring: "ring-red-300/60",     icon: XCircle },
  "n/a":{ label: "لا ينطبق",  bg: "bg-zinc-500/85",    ring: "ring-zinc-300/60",    icon: Minus   },
};

const INTAKE_LABEL: Record<string, { txt: string; cls: string; bg: string }> = {
  present: { txt: "موجود",  cls: "text-emerald-300", bg: "bg-emerald-500/8 border-emerald-500/20" },
  damaged: { txt: "تالف",   cls: "text-amber-300",   bg: "bg-amber-500/8 border-amber-500/20"     },
  missing: { txt: "مفقود",  cls: "text-red-300",     bg: "bg-red-500/8 border-red-500/20"         },
};

/* ─── parsing helpers ─── */
function parseChecklist(raw: unknown): IntakeItem[] {
  if (Array.isArray(raw)) return raw as IntakeItem[];
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

function parseSavedQc(raw: unknown): QcItem[] {
  if (Array.isArray(raw)) return raw as QcItem[];
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function QualityCheckModal({ job, onClose, onSaved }: Props) {
  const { toast } = useToast();

  /* بنود الاستلام للقراءة فقط — مرجع بصري للفني */
  const intakeItems = useMemo(() => parseChecklist(job.checklist), [job.checklist]);

  /* قائمة الفحص — تبدأ من القائمة القياسية، أو من بيانات محفوظة سابقاً */
  const initial: QcItem[] = useMemo(() => {
    const saved = parseSavedQc(job.qa_checklist);
    if (saved.length > 0) {
      return saved.map(s => ({
        label_ar: String(s.label_ar ?? ""),
        status:   (s.status === "pass" || s.status === "fail" || s.status === "n/a") ? s.status : null,
        notes:    typeof s.notes === "string" ? s.notes : "",
      })).filter(i => i.label_ar);
    }
    return QC_DEFAULT_ITEMS.map(d => ({ label_ar: d.label_ar, status: null, notes: "" }));
  }, [job.qa_checklist]);

  const [items, setItems]     = useState<QcItem[]>(initial);
  const [notes, setNotes]     = useState<string>("");
  const [score, setScore]     = useState<string>(job.device_score != null ? String(job.device_score) : "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<string[]>([]);

  /* وضع الرفض — يطلب سبباً إلزامياً */
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  const passCount = items.filter(i => i.status === "pass").length;
  const failCount = items.filter(i => i.status === "fail").length;
  const naCount   = items.filter(i => i.status === "n/a").length;
  const pendingCount = items.length - passCount - failCount - naCount;
  const allDecided   = items.length > 0 && pendingCount === 0;

  function setItemStatus(idx: number, st: QcStatus) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: st } : it));
  }
  function setItemNotes(idx: number, n: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, notes: n } : it));
  }

  /** قبول الفحص — يحفظ qa_checklist + qa_completed_at ويُخطر الأب لينقل لـ ready_for_delivery */
  async function handleApprove() {
    if (!allDecided) {
      setErrors([`يجب اتخاذ قرار لكل بند — متبقي ${pendingCount} بند`]);
      return;
    }
    if (failCount > 0) {
      setErrors([`لا يمكن قبول الفحص ووجود ${failCount} بند فاشل — استخدم زر "رفض الفحص" بدلاً من ذلك`]);
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
            label_ar: i.label_ar,
            status:   i.status,
            notes:    i.notes ?? "",
          })),
          notes,
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
        title: "✓ تم قبول الفحص",
        description: `${passCount} يعمل · ${naCount} لا ينطبق — جارٍ النقل إلى "جاهز للتسليم"`,
      });
      onSaved("approve");
    } catch {
      setErrors(["تعذّر الاتصال بالخادم"]);
      setLoading(false);
    }
  }

  /** رفض الفحص — يحفظ qa_notes فقط (سبب الرفض)، الحالة تبقى in_repair */
  async function handleReject() {
    if (rejectReason.trim().length < 3) {
      setErrors(["يجب كتابة سبب رفض الفحص (3 أحرف على الأقل)"]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      /* نضيف ختم زمني داخل النصّ لإظهار سجل القرار في الواجهة لاحقاً */
      const stamped = `[رفض QC ${new Date().toLocaleString("ar-EG")}] ${rejectReason.trim()}`;
      const merged  = job.qa_notes ? `${job.qa_notes}\n${stamped}` : stamped;

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
        description: "البطاقة بقيت في مرحلة \"جارٍ الإصلاح\" — راجع الفني للإصلاح.",
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
        className="my-4 rounded-2xl border border-white/10 w-full max-w-4xl shadow-2xl"
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

        {/* ── بنود الاستلام للقراءة فقط (مرجع) ── */}
        {intakeItems.length > 0 && (
          <div className="px-5 py-3 border-b border-white/5 bg-white/[0.015]">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5 text-indigo-300" />
              <p className="text-[11px] font-black text-white/70">بنود الاستلام (مرجع للمقارنة)</p>
              <span className="text-[10px] text-white/40">— حالة الجهاز عند الاستلام</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
              {intakeItems.map((it, idx) => {
                const meta = it.status ? INTAKE_LABEL[it.status] : null;
                return (
                  <div
                    key={idx}
                    className={`px-2 py-1 rounded-lg text-[10px] flex items-center justify-between gap-1 border ${meta?.bg ?? "bg-white/[0.02] border-white/8"}`}
                  >
                    <span className="text-white/75 truncate">{it.label_ar}</span>
                    {meta && <span className={`${meta.cls} font-bold shrink-0`}>{meta.txt}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Counters ── */}
        <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02]">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">
            ✓ يعمل: {passCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/12 text-red-300 border border-red-500/25">
            ✗ لا يعمل: {failCount}
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

        {/* ── بنود الفحص (القياسية الثابتة) ── */}
        <div className="px-3 sm:px-5 py-4 max-h-[45vh] overflow-y-auto space-y-1.5">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-white/8 p-2.5"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <p className="flex-1 min-w-0 text-xs font-bold text-white">{it.label_ar}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {(["pass","fail","n/a"] as QcStatus[]).map(st => {
                    const cfg = QC_BTN[st];
                    const Icon = cfg.icon;
                    const active = it.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setItemStatus(idx, st)}
                        disabled={loading}
                        className={[
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                          active ? `${cfg.bg} text-white ring-2 ${cfg.ring} shadow-md` :
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
              {it.status === "fail" && (
                <input
                  value={it.notes ?? ""}
                  onChange={(e) => setItemNotes(idx, e.target.value)}
                  placeholder="تفاصيل العطل..."
                  disabled={loading}
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/40"
                />
              )}
            </div>
          ))}
        </div>

        {/* ── ملاحظات + تقييم (للقبول فقط) ── */}
        {!rejectMode && (
          <div className="px-5 py-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-white/55 mb-1">ملاحظات عامة</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/40"
                placeholder="مثلاً: تم الإصلاح والجهاز يعمل بكفاءة..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/55 mb-1">تقييم الجهاز (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white focus:outline-none focus:border-purple-400/40"
                placeholder="—"
              />
            </div>
          </div>
        )}

        {/* ── سبب الرفض (للرفض فقط) ── */}
        {rejectMode && (
          <div className="px-5 py-3 border-t border-white/5">
            <label className="block text-[11px] font-black text-red-300 mb-1.5 flex items-center gap-1.5">
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
                disabled={loading || !allDecided || failCount > 0}
                className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(16,185,129,0.8)", border: "1px solid rgba(52,211,153,0.5)" }}
              >
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                  : <><ThumbsUp className="w-3.5 h-3.5" /> قبول الفحص <ArrowRight className="w-3 h-3" /> جاهز للتسليم</>}
              </button>
              <button
                onClick={() => { setRejectMode(true); setErrors([]); }}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-red-300 hover:text-white text-xs font-bold transition-all border border-red-500/30 hover:bg-red-500/15 flex items-center gap-1.5"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                رفض الفحص
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
                className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(239,68,68,0.8)", border: "1px solid rgba(248,113,113,0.5)" }}
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
