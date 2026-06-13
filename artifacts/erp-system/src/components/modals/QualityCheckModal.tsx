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
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Loader2,
  X,
  AlertTriangle,
  ThumbsDown,
  Save,
  ClipboardCheck,
  ClipboardList,
  MessageSquare,
  Package,
} from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { QAReportFields, TechnicianSelector } from '@/pages/repairs/RepairExtensions';
import {
  type QcStatus,
  type QcItem,
  QC_BTN,
  INTAKE_BADGE,
  getDefaultItems,
  parseChecklist,
  parseSavedQc,
} from './quality-check-helpers';

type Outcome = 'approve' | 'reject';

interface RepairPartLite {
  id: number;
  product_name: string;
  quantity: string;
  unit_price: string;
}

interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  device_type?: string | null;
  checklist?: unknown;
  qa_checklist?: unknown;
  qa_notes?: string | null;
  device_score?: number | null;
  parts?: RepairPartLite[];
}

interface Props {
  job: JobLite;
  onClose: () => void;
  /** يستدعى بعد الحفظ مع نتيجة الفحص. الأب يقرّر النقل بناءً على outcome. */
  onSaved: (outcome: Outcome) => void;
  /** قائمة الفنيين لاختيار فاحص الجودة (اختياري) */
  technicians?: Array<{ id: number; name: string }>;
}

/* ═════════════════════════════════════════════════════════════════════ */

export default function QualityCheckModal({ job, onClose, onSaved, technicians = [] }: Props) {
  const { toast } = useToast();

  /* ── QA Report & Inspector state (from RepairExtensions) ── */
  const [qaReport, setQaReport] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [qcTechnicianId, setQcTechnicianId] = useState<number | null>(null);

  /* بنود الاستلام — تُمثّل المرجع وتُستخدم لبناء بنود الفحص */
  const intakeItems = useMemo(() => parseChecklist(job.checklist), [job.checklist]);

  /* ── مساعد: بناء QcItem[] من أي مصفوفة بنود ── */
  function buildFromSource(
    sources: Array<{
      id: string;
      label: string;
      category?: string;
      intake_status?: string | null;
      intake_notes?: string | null;
    }>,
    savedById: Map<string, { status?: string; notes?: string }>
  ): QcItem[] {
    return sources.map((it) => {
      const saved = savedById.get(it.id) ?? savedById.get(it.label);
      const st = saved?.status;
      return {
        id: it.id,
        label: it.label,
        category: it.category,
        intake_status: it.intake_status ?? null,
        intake_notes: it.intake_notes ?? null,
        status: st === 'pass' || st === 'fail' || st === 'n/a' ? st : null,
        notes: typeof saved?.notes === 'string' ? saved.notes : '',
      };
    });
  }

  /* بنود الفحص — مبنيّة فوراً (بدون async):
       - إن وُجدت بنود استلام → تُبنى منها
       - إن لم تُوجد → نستخدم البنود الافتراضية حسب نوع الجهاز  */
  const initial: QcItem[] = useMemo(() => {
    const savedRaw = parseSavedQc(job.qa_checklist);
    const savedById = new Map<string, { status?: string; notes?: string }>();
    savedRaw.forEach((s, i) => {
      const k = String(s.id ?? s.label ?? `item-${i}`);
      savedById.set(k, { status: s.status, notes: s.notes });
    });

    if (intakeItems.length > 0) {
      /* ← يوجد فحص أولي */
      return buildFromSource(
        intakeItems.map((it) => ({ ...it, intake_status: it.status, intake_notes: it.notes })),
        savedById
      );
    }

    /* ← لا يوجد فحص أولي → بنود افتراضية فورية */
    const deviceType = (job.device_type ?? '').trim() || 'general';
    return buildFromSource(getDefaultItems(deviceType), savedById);
  }, [intakeItems, job.qa_checklist, job.device_type]);

  /* isFallback = true عندما لا يوجد فحص أولي (نستخدم القالب أو الافتراضي) */
  const [items, setItems] = useState<QcItem[]>(initial);
  const [score, setScore] = useState<string>(
    job.device_score != null ? String(job.device_score) : ''
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [isFallback, _setIsFallback] = useState(() => intakeItems.length === 0);
  /* تقرير المهندس — إجباري قبل إتمام الفحص */
  const [engineerNote, setEngineerNote] = useState('');

  /* ── محاولة تحميل بنود أفضل من DB (إن وجدت) بعد الـ render ── */
  useEffect(() => {
    if (intakeItems.length > 0) return; // يوجد فحص أولي — الـ initial صحيح بالفعل

    const deviceType = (job.device_type ?? '').trim() || 'general';

    setTemplateLoading(true);
    authFetch(api(`/api/repair-checklist-items?device_type=${encodeURIComponent(deviceType)}`))
      .then((res) => res.json())
      .then(
        (data: Array<{ id?: number; label_ar?: string; label?: string; category?: string }>) => {
          if (!Array.isArray(data) || data.length === 0) return; // الـ defaults الافتراضية كافية

          /* DB لديه بنود مخصصة — نستبدل الافتراضية بها */
          const savedRaw = parseSavedQc(job.qa_checklist);
          const savedById = new Map<string, { status?: string; notes?: string }>();
          savedRaw.forEach((s, i) => {
            savedById.set(String(s.id ?? s.label ?? `item-${i}`), {
              status: s.status,
              notes: s.notes,
            });
          });
          const dbSources = data.map((item, i) => ({
            id: String(item.id ?? `tpl-${i}`),
            label: String(item.label_ar ?? item.label ?? `بند ${i + 1}`),
            category: item.category,
          }));
          setItems(buildFromSource(dbSources, savedById));
        }
      )
      .catch(() => {
        /* إذا فشل الجلب — نبقى على البنود الافتراضية المحددة في initial */
      })
      .finally(() => setTemplateLoading(false));
  }, []);

  /* وضع الرفض — يطلب سبباً إجمالياً إلزامياً */
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  /* البنود المفتوحة لإظهار خانة الملاحظات */
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());
  function toggleNotes(idx: number) {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const passCount = items.filter((i) => i.status === 'pass').length;
  const failCount = items.filter((i) => i.status === 'fail').length;
  const naCount = items.filter((i) => i.status === 'n/a').length;
  const pendingCount = items.length - passCount - failCount - naCount;
  const allDecided = items.length > 0 && pendingCount === 0;

  function setItemStatus(idx: number, st: QcStatus) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: st } : it)));
  }
  function setItemNotes(idx: number, n: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, notes: n } : it)));
  }

  /** حفظ نتيجة الفحص — يحفظ qa_checklist + qa_completed_at فقط (بدون نقل تلقائي).
      النقل لـ "جاهز للتسليم" يدوي من شريط مسار الإصلاح بعد فتح بوّابة المراجعة النهائية.
      حين لا توجد بنود استلام ولا قالب (items.length === 0) نُرسل علم no_intake_checklist=true. */
  async function handleApprove() {
    const noIntakeChecklist = items.length === 0 && !templateLoading;
    const errs: string[] = [];

    /* تقرير المهندس إجباري دائماً */
    if (engineerNote.trim().length < 5) {
      errs.push('تقرير المهندس إجباري (5 أحرف على الأقل) — صِف ما تم إصلاحه');
    }
    if (!noIntakeChecklist) {
      if (!allDecided) errs.push(`يجب اتخاذ قرار لكل بند — متبقي ${pendingCount} بند`);
      if (failCount > 0)
        errs.push(`لا يمكن قبول الفحص ووجود ${failCount} بند مرفوض — استخدم زر "رفض الفحص"`);
    }
    if (errs.length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setErrors([]);
    try {
      /* حفظ تقرير المهندس أولاً */
      await authFetch(api(`/api/repair-jobs/${job.id}/engineer-reports`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: engineerNote.trim() }),
      });

      const body = noIntakeChecklist
        ? {
            items: [],
            no_intake_checklist: true,
            notes: '',
            device_score: score.trim() === '' ? null : Number(score),
            qa_report: qaReport.trim() || null,
            qa_inspector_name: inspectorName.trim() || null,
            qa_technician_id: qcTechnicianId,
          }
        : {
            items: items.map((i) => ({
              id: i.id,
              label: i.label,
              label_ar: i.label,
              category: i.category,
              status: i.status,
              notes: i.notes ?? '',
            })),
            notes: '',
            device_score: score.trim() === '' ? null : Number(score),
            qa_report: qaReport.trim() || null,
            qa_inspector_name: inspectorName.trim() || null,
            qa_technician_id: qcTechnicianId,
          };

      const res = await authFetch(api(`/api/repair-jobs/${job.id}/qa-checklist`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrors([data.error ?? 'تعذّر حفظ فحص الجودة']);
        setLoading(false);
        return;
      }
      toast({
        title: '✓ تم حفظ نتيجة الفحص',
        description: noIntakeChecklist
          ? 'تم تأكيد اجتياز الفحص — لا يوجد فحص أولي مرجعي'
          : isFallback
            ? `${passCount} بند ناجح · ${naCount} لا ينطبق (بنود من قالب الجهاز) — يمكنك النقل إلى "جاهز للتسليم"`
            : `${passCount} بند ناجح · ${naCount} لا ينطبق — يمكنك الآن النقل يدوياً إلى "جاهز للتسليم"`,
      });
      onSaved('approve');
    } catch {
      setErrors(['تعذّر الاتصال بالخادم']);
      setLoading(false);
    }
  }

  /** رفض الفحص — يحفظ qa_notes مع تفصيل البنود المرفوضة + يُبقي البطاقة في in_repair */
  async function handleReject() {
    if (rejectReason.trim().length < 3) {
      setErrors(['يجب كتابة سبب رفض الفحص (3 أحرف على الأقل)']);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      /* تفصيل البنود المرفوضة في النص — ليُعرض في تقرير الفني */
      const failedLines = items
        .filter((i) => i.status === 'fail')
        .map((i) => `  • ${i.label}${i.notes ? ` — ${i.notes}` : ''}`)
        .join('\n');
      const stamped =
        `[رفض QC ${new Date().toLocaleString('ar-EG')}] ${rejectReason.trim()}` +
        (failedLines ? `\nالبنود المرفوضة:\n${failedLines}` : '');
      const merged = job.qa_notes ? `${job.qa_notes}\n\n${stamped}` : stamped;

      /* نحفظ أيضاً qa_checklist مع نتائج البنود حتى يستطيع الفني رؤية
         تفصيل الفحص عند فتح البطاقة مجدداً (البانر الأحمر في JobDetail). */
      const res = await authFetch(api(`/api/repair-jobs/${job.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qa_notes: merged,
          qa_checklist: items.map((i) => ({
            id: i.id,
            label: i.label,
            label_ar: i.label,
            category: i.category,
            status: i.status,
            notes: i.notes ?? '',
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrors([data.error ?? 'تعذّر حفظ سبب الرفض']);
        setLoading(false);
        return;
      }
      toast({
        title: '⚠ رفض الفحص',
        description: 'البطاقة بقيت في مرحلة "جارٍ الإصلاح" — راجع الفني لإعادة المعالجة.',
        variant: 'destructive',
      });
      onSaved('reject');
    } catch {
      setErrors(['تعذّر الاتصال بالخادم']);
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="my-4 rounded-2xl border border-line w-full max-w-5xl shadow-2xl"
        style={{ background: 'rgba(15,12,30,0.97)', backdropFilter: 'blur(20px)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">فحص مراقبة الجودة (QC)</h3>
              <p className="text-[11px] text-ink/50">
                البطاقة <span className="text-ink font-bold">{job.job_no}</span>
                {job.device_brand && (
                  <>
                    {' '}
                    · {job.device_brand} {job.device_model ?? ''}
                  </>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Counters ── */}
        <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-line bg-surface">
          <span className="text-[10px] text-ink/55 ml-1">
            إجمالي البنود: <span className="text-ink font-bold">{items.length}</span>
          </span>
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

        {/* ── القطع المستخدمة في الإصلاح (للمراجعة فقط) ── */}
        {job.parts && job.parts.length > 0 && (
          <div className="px-5 py-2.5 border-b border-line bg-cyan-500/[0.03]">
            <p className="text-[10px] font-black text-cyan-300/80 mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              القطع المستخدمة في الإصلاح ({job.parts.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {job.parts.map((p) => {
                const qty = Number(p.quantity) || 1;
                const price = Number(p.unit_price) || 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] text-[10.5px]"
                  >
                    <span className="text-ink/80 font-bold">{p.product_name}</span>
                    <span className="text-ink/35">×{qty}</span>
                    {price > 0 && (
                      <span className="text-cyan-300/70">
                        {(qty * price).toLocaleString('ar-EG')} ر.س
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {(() => {
              const total = job.parts.reduce(
                (s, p) => s + (Number(p.quantity) || 1) * (Number(p.unit_price) || 0),
                0
              );
              return total > 0 ? (
                <p className="mt-1.5 text-[10px] text-cyan-300/60">
                  إجمالي تكلفة القطع:{' '}
                  <span className="font-bold text-cyan-200">
                    {total.toLocaleString('ar-EG')} ر.س
                  </span>
                </p>
              ) : null;
            })()}
          </div>
        )}

        {/* ── Two-column layout: intake (right) ↔ QC decisions (left) ── */}
        {templateLoading ? (
          <div className="px-5 py-10 text-center">
            <Loader2 className="w-8 h-8 text-purple-400/60 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-ink/60">جارٍ تحميل بنود القالب للجهاز...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400/60 mx-auto mb-3" />
            <p className="text-sm text-ink/80 font-bold mb-1">لا توجد بنود فحص</p>
            <p className="text-[11px] text-ink/45">
              لم يُعرَف نوع الجهاز — يمكنك تأكيد اجتياز مراقبة الجودة يدوياً باستخدام الزر أدناه.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[58vh] overflow-y-auto"
            dir="rtl"
          >
            {/* ═══ العمود الأيمن: بنود الاستلام أو القالب (للقراءة فقط) ═══ */}
            <div className="border-l border-line bg-indigo-500/[0.03]">
              <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-line bg-indigo-500/10 backdrop-blur">
                <div className="flex items-center gap-2">
                  {isFallback ? (
                    <Package className="w-4 h-4 text-violet-300" />
                  ) : (
                    <ClipboardList className="w-4 h-4 text-indigo-300" />
                  )}
                  <p
                    className={`text-[12px] font-black ${isFallback ? 'text-violet-200' : 'text-indigo-200'}`}
                  >
                    {isFallback ? 'بنود القالب (مرجع)' : 'بنود الاستلام (مرجع)'}
                  </p>
                  <span
                    className={`text-[10px] ${isFallback ? 'text-violet-200/60' : 'text-indigo-200/60'}`}
                  >
                    {isFallback
                      ? '— لا يوجد فحص أولي، تم استخدام قالب الجهاز'
                      : '— حالة الجهاز عند الاستلام'}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {items.map((it, idx) => {
                  const stKey = String(it.intake_status ?? '');
                  const meta = INTAKE_BADGE[stKey];
                  return (
                    <div
                      key={`r-${it.id}-${idx}`}
                      className="rounded-xl border border-line px-3 py-2 bg-surface"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-ink/85 leading-tight">
                            {it.label}
                          </p>
                          {it.category && (
                            <p className="text-[9px] text-ink/35 mt-0.5">{it.category}</p>
                          )}
                          {it.intake_notes && (
                            <p className="text-[10px] text-amber-300/70 mt-1 italic">
                              ملاحظة الاستلام: {it.intake_notes}
                            </p>
                          )}
                        </div>
                        {meta ? (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${meta.bg} ${meta.cls}`}
                          >
                            {meta.txt}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-line text-ink/40 shrink-0">
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
              <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-line bg-purple-500/10 backdrop-blur">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-purple-300" />
                  <p className="text-[12px] font-black text-purple-200">
                    قرار الفني (مراقبة الجودة)
                  </p>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {items.map((it, idx) => {
                  const cardCls =
                    it.status === 'pass'
                      ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                      : it.status === 'fail'
                        ? 'border-red-500/30 bg-red-500/[0.04]'
                        : it.status === 'n/a'
                          ? 'border-zinc-500/25 bg-zinc-500/[0.03]'
                          : 'border-line bg-surface';
                  const notesOpen = openNotes.has(idx);
                  const hasNote = (it.notes ?? '').trim().length > 0;
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
                          title={notesOpen ? 'إخفاء الملاحظة' : 'إظهار حقل الملاحظة'}
                          className={[
                            'shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                            hasNote
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                              : notesOpen
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-surface text-ink/40 border border-line hover:text-ink/70 hover:bg-surface',
                          ].join(' ')}
                        >
                          <MessageSquare className="w-3 h-3" />
                        </button>
                        <p
                          className="flex-1 min-w-0 text-[11.5px] font-bold text-ink truncate cursor-pointer"
                          onClick={() => toggleNotes(idx)}
                          title="اضغط لإظهار/إخفاء الملاحظة"
                        >
                          {it.label}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {(['pass', 'fail', 'n/a'] as QcStatus[]).map((st) => {
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
                                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all',
                                  active
                                    ? `${cfg.bg} text-ink ring-2 ${cfg.ring} shadow-md`
                                    : 'bg-surface text-ink/50 border border-line hover:bg-surface hover:text-ink',
                                ].join(' ')}
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
                            value={it.notes ?? ''}
                            onChange={(e) => setItemNotes(idx, e.target.value)}
                            placeholder="ملاحظة الفني (اختيارية)"
                            disabled={loading}
                            autoFocus
                            className={[
                              'w-full px-2.5 py-1 rounded-md text-[10.5px] text-ink placeholder:text-ink/25 focus:outline-none transition-colors',
                              it.status === 'fail'
                                ? 'bg-red-500/8 border border-red-500/25 focus:border-red-400/45'
                                : 'bg-surface border border-line focus:border-purple-400/35',
                            ].join(' ')}
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
          <div className="px-5 py-3 border-t border-line bg-red-500/[0.04]">
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
              className="w-full px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/25 text-[12px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-red-400/50"
              placeholder="مثلاً: الكاميرا الخلفية ما زالت لا تعمل بعد التركيب — يحتاج إعادة فحص..."
            />
            {failCount > 0 && (
              <p className="mt-2 text-[10px] text-red-300/80">
                ⓘ سيُسجَّل تلقائياً تفصيل البنود المرفوضة ({failCount} بند) في تقرير الفني.
              </p>
            )}
          </div>
        )}

        {/* ── تقرير مراقبة الجودة + فاحص الجودة (من RepairExtensions) ── */}
        {!rejectMode && (
          <div className="px-5 py-3 border-t border-line bg-purple-500/[0.02]">
            <QAReportFields
              qaReport={qaReport}
              inspectorName={inspectorName}
              onChangeReport={setQaReport}
              onChangeInspector={setInspectorName}
            />
            {technicians.length > 0 && (
              <div className="mt-3">
                <TechnicianSelector
                  label="الفني المسؤول عن فحص الجودة"
                  value={qcTechnicianId}
                  onChange={setQcTechnicianId}
                  technicians={technicians}
                />
              </div>
            )}
          </div>
        )}

        {/* ── تقرير المهندس (إجباري دائماً) ── */}
        {!rejectMode && (
          <div className="px-5 py-3 border-t border-line bg-violet-500/[0.03]">
            <label className="text-[11px] font-black text-violet-300 mb-1.5 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              تقرير المهندس
              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 rounded-full">
                إجباري
              </span>
            </label>
            <textarea
              value={engineerNote}
              onChange={(e) => setEngineerNote(e.target.value)}
              rows={3}
              disabled={loading}
              autoFocus={items.length === 0}
              className="w-full px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/20 text-[12px] text-ink placeholder:text-ink/25 focus:outline-none focus:border-violet-400/45 resize-y"
              placeholder="صِف ما تم إصلاحه — مثلاً: تم تغيير الشاشة وإصلاح منفذ الشحن..."
            />
            {engineerNote.trim().length > 0 && engineerNote.trim().length < 5 && (
              <p className="mt-1 text-[10px] text-amber-300/70">يجب كتابة 5 أحرف على الأقل</p>
            )}
          </div>
        )}

        {/* ── تقييم الجهاز (يظهر في وضع القبول فقط) ── */}
        {!rejectMode && items.length > 0 && (
          <div className="px-5 py-3 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 text-[10.5px] text-ink/55">
              <span className="text-ink/70 font-bold">ملاحظة:</span> القبول لن يُسمح به ما لم
              يُتَّخذ قرار لكل بند ولا يوجد أي بند مرفوض. في حالة وجود بند مرفوض، استخدم زر{' '}
              <span className="text-red-300 font-bold">«رفض الفحص»</span> لإعادة البطاقة لـ{' '}
              <span className="text-cyan-300 font-bold">«جارٍ الإصلاح»</span>.
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink/55 mb-1">
                تقييم الجهاز (0–100) — اختياري
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink focus:outline-none focus:border-purple-400/40"
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
              {errors.map((e, i) => (
                <li key={i} className="text-[11px] text-red-300">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="px-5 py-4 border-t border-line flex flex-wrap gap-2">
          {!rejectMode ? (
            <>
              <button
                onClick={handleApprove}
                disabled={
                  loading ||
                  engineerNote.trim().length < 5 ||
                  (items.length > 0 && (!allDecided || failCount > 0))
                }
                className="flex-1 min-w-[220px] py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{
                  background: 'rgba(16,185,129,0.85)',
                  border: '1px solid rgba(52,211,153,0.5)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...
                  </>
                ) : items.length === 0 ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> تأكيد اجتياز الفحص
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> حفظ نتيجة الفحص
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setRejectMode(true);
                  setErrors([]);
                }}
                disabled={loading || items.length === 0}
                className="px-4 py-2.5 rounded-xl text-red-300 hover:text-ink text-xs font-bold transition-all border border-red-500/30 hover:bg-red-500/15 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                رفض الفحص (يعود للإصلاح)
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-line text-ink/60 hover:text-ink text-xs"
              >
                إلغاء
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReject}
                disabled={loading || rejectReason.trim().length < 3}
                className="flex-1 min-w-[220px] py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{
                  background: 'rgba(239,68,68,0.85)',
                  border: '1px solid rgba(248,113,113,0.5)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...
                  </>
                ) : (
                  <>
                    <ThumbsDown className="w-3.5 h-3.5" /> تأكيد الرفض وإعادة للإصلاح
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setRejectMode(false);
                  setRejectReason('');
                  setErrors([]);
                }}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-line text-ink/60 hover:text-ink text-xs"
              >
                رجوع
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
