/**
 * QualityCheckModal — بوّابة "مراقبة الجودة (QC)" → "جاهز للتسليم"
 *
 * يعرض جنباً إلى جنب:
 *  - بنود الفحص الأولي (intake checklist) للمقارنة
 *  - بنود فحص مراقبة الجودة (QC) — نُنشئها من بنود الفحص الأولي إن لم يكن
 *    قد تم إنشاؤها بعد، أو نُحمّلها من qa_checklist إن كانت محفوظة سابقاً.
 *
 * كل بند له status: pass | fail | n/a — يجب اتخاذ قرار لكل بند.
 * عند الحفظ:
 *   1) POST /api/repair-jobs/:id/qa-checklist  → يحفظ qa_checklist + qa_completed_at
 *   2) ثم onSaved() — يطلب من الأب نقل البطاقة إلى ready_for_delivery
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, Loader2, X, AlertTriangle, Check, Minus, XCircle } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type QcStatus = "pass" | "fail" | "n/a";

interface ChecklistItem {
  label_ar: string;
  category?: string;
  /** intake: 'present' | 'damaged' | 'missing'; qc: 'pass' | 'fail' | 'n/a' */
  status?: string | null;
  notes?: string | null;
}

interface QcItem {
  label_ar: string;
  category?: string;
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
  onSaved: () => void;
}

function parseChecklist(raw: unknown): ChecklistItem[] {
  if (Array.isArray(raw)) return raw as ChecklistItem[];
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

const STATUS_BTN: Record<QcStatus, { label: string; bg: string; ring: string; icon: typeof Check }> = {
  pass: { label: "نجح",       bg: "bg-emerald-500/80",  ring: "ring-emerald-300/60",  icon: Check  },
  fail: { label: "فشل",       bg: "bg-red-500/80",      ring: "ring-red-300/60",      icon: XCircle },
  "n/a":{ label: "لا ينطبق",  bg: "bg-zinc-500/80",     ring: "ring-zinc-300/60",     icon: Minus  },
};

const INTAKE_LABEL: Record<string, { txt: string; cls: string }> = {
  present: { txt: "موجود",  cls: "text-emerald-300" },
  damaged: { txt: "تالف",   cls: "text-amber-300" },
  missing: { txt: "مفقود",  cls: "text-red-300" },
};

export default function QualityCheckModal({ job, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const intakeItems = useMemo(() => parseChecklist(job.checklist), [job.checklist]);
  const savedQc     = useMemo(() => parseChecklist(job.qa_checklist), [job.qa_checklist]);

  /* نبني بنود QC: إن كان فيه qa_checklist محفوظة نأخذها، وإلا ننسخ من الفحص الأولي */
  const initial: QcItem[] = useMemo(() => {
    const source = savedQc.length > 0 ? savedQc : intakeItems;
    return source.map((it) => ({
      label_ar: String(it.label_ar ?? ""),
      category: it.category,
      status:   (savedQc.length > 0 && (it.status === "pass" || it.status === "fail" || it.status === "n/a"))
                  ? it.status as QcStatus : null,
      notes:    typeof it.notes === "string" ? it.notes : "",
    })).filter(i => i.label_ar);
  }, [savedQc, intakeItems]);

  const [items, setItems]     = useState<QcItem[]>(initial);
  const [notes, setNotes]     = useState<string>(job.qa_notes ?? "");
  const [score, setScore]     = useState<string>(job.device_score != null ? String(job.device_score) : "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<string[]>([]);

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

  async function handleSave() {
    if (items.length === 0) {
      setErrors(["لا توجد بنود فحص — يجب إكمال الفحص الأولي أولاً"]);
      return;
    }
    if (!allDecided) {
      setErrors([`يجب اتخاذ قرار لكل بند — متبقي ${pendingCount} بند`]);
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
            category: i.category,
            status:   i.status,
            notes:    i.notes ?? "",
          })),
          notes,
          device_score: score.trim() === "" ? null : Number(score),
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setErrors([data.error ?? "تعذّر حفظ فحص الجودة"]);
        setLoading(false);
        return;
      }
      toast({ title: "تم حفظ فحص الجودة", description: `${passCount} نجح · ${failCount} فشل · ${naCount} لا ينطبق` });
      onSaved();
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
        {/* Header */}
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

        {/* Counters */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02]">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/12 text-emerald-300 border border-emerald-500/25">
            ✓ نجح: {passCount}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/12 text-red-300 border border-red-500/25">
            ✗ فشل: {failCount}
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

        {/* Items */}
        <div className="px-3 sm:px-5 py-4 max-h-[55vh] overflow-y-auto space-y-2">
          {items.length === 0 ? (
            <div className="p-6 text-center text-amber-300 text-sm">
              ⚠ لا توجد بنود فحص — يجب إكمال الفحص الأولي على البطاقة قبل QC.
            </div>
          ) : items.map((it, idx) => {
            const intakeMatch = intakeItems[idx];
            const intakeMeta  = intakeMatch?.status ? INTAKE_LABEL[intakeMatch.status] : null;
            return (
              <div
                key={idx}
                className="rounded-xl border border-white/8 p-3"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{it.label_ar}</p>
                    {intakeMeta && (
                      <p className="text-[10px] mt-0.5">
                        <span className="text-white/40">عند الاستلام: </span>
                        <span className={`${intakeMeta.cls} font-bold`}>{intakeMeta.txt}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(["pass","fail","n/a"] as QcStatus[]).map(st => {
                      const cfg = STATUS_BTN[st];
                      const Icon = cfg.icon;
                      const active = it.status === st;
                      return (
                        <button
                          key={st}
                          onClick={() => setItemStatus(idx, st)}
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
                    placeholder="ملاحظة حول سبب الفشل..."
                    className="mt-2 w-full px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/40"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Notes + Score */}
        <div className="px-5 py-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold text-white/55 mb-1">ملاحظات عامة على فحص الجودة</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-400/40"
              placeholder="مثلاً: تم الإصلاح بالكامل والجهاز يعمل بكفاءة..."
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
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white focus:outline-none focus:border-purple-400/40"
              placeholder="—"
            />
          </div>
        </div>

        {/* Errors */}
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

        {/* Actions */}
        <div className="px-5 py-4 border-t border-white/8 flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading || !allDecided || items.length === 0}
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(168,85,247,0.7)", border: "1px solid rgba(192,132,252,0.4)" }}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
              : <><ShieldCheck className="w-3.5 h-3.5" /> حفظ فحص الجودة وانتقال إلى "جاهز للتسليم"</>}
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
