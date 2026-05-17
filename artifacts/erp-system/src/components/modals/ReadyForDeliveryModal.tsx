/**
 * ReadyForDeliveryModal — orchestrator (split version)
 * مرحلتان: QcPhase → BillingPhase
 */
import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X, PackageCheck } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { JobLite, QcItem, PartLine, PayRow, PayType, parseChecklist, parseSavedQc, getDefaultQcItems } from "./ready-for-delivery/types";
import QcPhase from "./ready-for-delivery/QcPhase";
import BillingPhase from "./ready-for-delivery/BillingPhase";

interface Props {
  job: JobLite;
  onClose: () => void;
  onSaved: () => void;
  onRejected: () => void;
  qcOnly?: boolean;
}

export default function ReadyForDeliveryModal({ job, onClose, onSaved, onRejected, qcOnly = false }: Props) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"qc" | "billing">("qc");

  /* ── Phase 1: QC ── */
  const intakeItems = useMemo(() => parseChecklist(job.checklist), [job.checklist]);

  /* مساعد: بناء QcItem[] من مصدر بنود */
  function buildQcItems(
    sources: Array<{ id: string; label: string; category?: string; intake_status?: string | null; intake_notes?: string | null }>,
    savedById: Map<string, { status?: string; notes?: string }>,
  ): QcItem[] {
    return sources.map(it => {
      const saved = savedById.get(it.id) ?? savedById.get(it.label);
      const st    = saved?.status;
      return {
        id:            it.id,
        label:         it.label,
        category:      it.category,
        intake_status: it.intake_status ?? null,
        intake_notes:  it.intake_notes ?? null,
        status:        (st === "pass" || st === "fail" || st === "n/a") ? st : null,
        notes:         typeof saved?.notes === "string" ? saved.notes : "",
      };
    });
  }

  const initialItems = useMemo<QcItem[]>(() => {
    const savedRaw  = parseSavedQc(job.qa_checklist);
    const savedById = new Map<string, { status?: string; notes?: string }>();
    savedRaw.forEach((s, i) => savedById.set(String(s.id ?? s.label ?? `item-${i}`), { status: s.status, notes: s.notes }));

    if (intakeItems.length > 0) {
      /* بنود استلام حقيقية — نبني منها */
      return buildQcItems(
        intakeItems.map(it => ({ ...it, intake_status: it.status, intake_notes: it.notes })),
        savedById,
      );
    }

    /* لا يوجد فحص استلام حقيقي (جهاز معطوب من البداية / __power_off__)
       → نستخدم القالب الافتراضي حسب نوع الجهاز */
    const deviceType = (job.device_type ?? "").trim() || "general";
    return buildQcItems(getDefaultQcItems(deviceType), savedById);
  }, [intakeItems, job.qa_checklist, job.device_type]);

  const [items, setItems]               = useState<QcItem[]>(initialItems);
  const [isFallback, setIsFallback]     = useState(() => intakeItems.length === 0);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [openNotes, setOpenNotes]       = useState<Set<number>>(new Set());
  const [rejectMode, setRejectMode]     = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [qcLoading, setQcLoading]       = useState(false);
  const [qcErrors, setQcErrors]         = useState<string[]>([]);

  /* ── محاولة تحميل قالب مخصّص من قاعدة البيانات بعد الـ render ──
     إن وُجدت بنود مخصّصة للجهاز تحل محل الافتراضية.
     تُستدعى فقط عند الجهاز بلا فحص استلام (isFallback). */
  useEffect(() => {
    if (intakeItems.length > 0) return;
    const deviceType = (job.device_type ?? "").trim() || "general";
    setTemplateLoading(true);
    authFetch(api(`/api/repair-checklist-items?device_type=${encodeURIComponent(deviceType)}`))
      .then(res => res.json())
      .then((data: Array<{ id?: number; label_ar?: string; label?: string; category?: string }>) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const savedRaw  = parseSavedQc(job.qa_checklist);
        const savedById = new Map<string, { status?: string; notes?: string }>();
        savedRaw.forEach((s, i) => savedById.set(String(s.id ?? s.label ?? `item-${i}`), { status: s.status, notes: s.notes }));
        const dbSources = data.map((item, i) => ({
          id:       String(item.id ?? `tpl-${i}`),
          label:    String(item.label_ar ?? item.label ?? `بند ${i + 1}`),
          category: item.category,
        }));
        setItems(buildQcItems(dbSources, savedById));
        setIsFallback(true);
      })
      .catch(() => { /* نبقى على القالب الافتراضي المحدد مسبقاً */ })
      .finally(() => setTemplateLoading(false));
  }, []);

  const passCount    = items.filter(i => i.status === "pass").length;
  const failCount    = items.filter(i => i.status === "fail").length;
  const naCount      = items.filter(i => i.status === "n/a").length;
  const pendingCount = items.length - passCount - failCount - naCount;
  const allDecided   = items.length > 0 && pendingCount === 0;

  function toggleNotes(idx: number) {
    setOpenNotes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleQcApprove() {
    if (items.length === 0) { setQcErrors(["لا توجد بنود فحص"]); return; }
    if (!allDecided)        { setQcErrors([`متبقي ${pendingCount} بند`]); return; }
    if (failCount > 0)      { setQcErrors([`لا يمكن القبول ووجود ${failCount} بند مرفوض`]); return; }
    setQcLoading(true); setQcErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/qa-checklist`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ id: i.id, label: i.label, label_ar: i.label, category: i.category, status: i.status, notes: i.notes ?? "" })),
          notes: "",
          device_score: null,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setQcErrors([data.error ?? "تعذّر حفظ نتيجة الفحص"]); setQcLoading(false); return; }
      setQcLoading(false);
      if (qcOnly) { toast({ title: "✓ اجتاز الفحص" }); onSaved(); } else { setPhase("billing"); }
    } catch {
      setQcErrors(["تعذّر الاتصال بالخادم"]); setQcLoading(false);
    }
  }

  async function handleQcReject() {
    if (rejectReason.trim().length < 3) { setQcErrors(["يجب كتابة سبب رفض (3 أحرف على الأقل)"]); return; }
    setQcLoading(true); setQcErrors([]);
    try {
      const failedLines = items.filter(i => i.status === "fail")
        .map(i => `  • ${i.label}${i.notes ? ` — ${i.notes}` : ""}`).join("\n");
      const stamped = `[رفض QC ${new Date().toLocaleString("ar-EG")}] ${rejectReason.trim()}` + (failedLines ? `\nالبنود المرفوضة:\n${failedLines}` : "");
      const merged  = job.qa_notes ? `${job.qa_notes}\n\n${stamped}` : stamped;
      const res = await authFetch(api(`/api/repair-jobs/${job.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qa_notes: merged, qa_completed_at: null, status: "in_repair",
          qa_checklist: items.map(i => ({ id: i.id, label: i.label, label_ar: i.label, category: i.category, status: i.status, notes: i.notes ?? "" })),
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setQcErrors([data.error ?? "تعذّر حفظ سبب الرفض"]); setQcLoading(false); return; }
      toast({ title: "⚠ رُفض الفحص", description: "البطاقة أُعيدت لـ \"جارٍ الإصلاح\"", variant: "destructive" });
      onRejected();
    } catch {
      setQcErrors(["تعذّر الاتصال بالخادم"]); setQcLoading(false);
    }
  }

  /* ── Phase 2: Billing ── */
  const [partLines, setPartLines]               = useState<PartLine[]>([]);
  const [productSearch, setProductSearch]       = useState("");
  const [showProductDrop, setShowProductDrop]   = useState(false);
  const [addQty, setAddQty]                     = useState("1");
  const [addPrice, setAddPrice]                 = useState("");
  const [selectedProduct, setSelectedProduct]   = useState<import("./ready-for-delivery/types").Product | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [payRows, setPayRows]                   = useState<PayRow[]>([]);
  const [payType, setPayType]                   = useState<PayType>("cash");
  const [paySafe, setPaySafe]                   = useState<number | null>(null);
  const [payAmount, setPayAmount]               = useState("");
  const [brokerName, setBrokerName]             = useState(job.broker_name ?? "");
  const [brokerComm, setBrokerComm]             = useState(String(Number(job.broker_commission ?? 0) || ""));
  const [billingLoading, setBillingLoading]     = useState(false);
  const [billingErrors, setBillingErrors]       = useState<string[]>([]);

  const partsTotal    = partLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const finalCostBase = Number(job.final_cost ?? 0);
  const grandTotal    = finalCostBase + partsTotal;
  const paidSoFar     = payRows.reduce((s, r) => s + r.amount, 0);
  const payIsDone     = grandTotal > 0 ? paidSoFar >= grandTotal - 0.005 : payRows.length > 0;

  // initialise paySafe once safes load — done inside BillingPhase via effect; here we just ensure
  // the prop chain works. BillingPhase manages its own safe init.

  async function handleBillingSave() {
    const errs: string[] = [];
    if (grandTotal > 0 && !payIsDone) {
      const cashTotal   = payRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0);
      const creditTotal = payRows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0);
      if (cashTotal + creditTotal === 0) errs.push("يجب إضافة طريقة دفع واحدة على الأقل");
    }
    if (errs.length) { setBillingErrors(errs); return; }
    setBillingLoading(true); setBillingErrors([]);
    try {
      const cashTotal   = payRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0);
      const creditTotal = payRows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0);
      const pt: "cash" | "credit" | "partial" = creditTotal === 0 ? "cash" : cashTotal === 0 ? "credit" : "partial";
      const primarySafe = payRows.find(r => r.type === "cash")?.safe_id ?? null;
      const body: Record<string, unknown> = {
        broker_name:       brokerName.trim() || null,
        broker_commission: Number(brokerComm) || 0,
        parts: partLines.map(l => ({ product_id: l.product_id, product_name: l.product_name, quantity: l.quantity, unit_price: l.unit_price, warehouse_id: l.warehouse_id })),
        payment: { payment_type: pt, paid_amount: cashTotal, safe_id: primarySafe, payments: payRows.map(r => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })) },
      };
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/pre-delivery`), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setBillingErrors([data.error ?? "تعذّر حفظ بيانات المحاسبة"]); setBillingLoading(false); return; }
      toast({ title: "✓ تم حفظ المحاسبة — البطاقة جاهزة للتسليم" });
      onSaved();
    } catch {
      setBillingErrors(["تعذّر الاتصال بالخادم"]); setBillingLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.82)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="my-4 rounded-2xl border border-white/10 w-full max-w-5xl shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: phase === "qc" ? "rgba(168,85,247,0.15)" : "rgba(132,204,22,0.15)",
                border:     phase === "qc" ? "1px solid rgba(196,132,252,0.3)" : "1px solid rgba(163,230,53,0.3)",
              }}
            >
              {phase === "qc"
                ? <ShieldCheck className="w-4 h-4 text-purple-300" />
                : <PackageCheck className="w-4 h-4 text-lime-300" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">
                  {phase === "qc" ? "فحص الجودة النهائي" : "محاسبة العميل"}
                </h3>
                {!qcOnly && (
                  <span className="flex items-center gap-1 text-[10px] text-white/40">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${phase === "qc" ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-white/40"}`}>١</span>
                    <span className="text-white/20">←</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${phase === "billing" ? "bg-lime-500/20 text-lime-300" : "bg-white/10 text-white/40"}`}>٢</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/50">
                البطاقة <span className="text-white font-bold">{job.job_no}</span>
                {job.customer_name && <> · {job.customer_name}</>}
                {job.device_brand && <> · {job.device_brand} {job.device_model ?? ""}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {phase === "qc" && (
          <QcPhase
            items={items}
            intakeItems={intakeItems}
            isFallback={isFallback}
            templateLoading={templateLoading}
            openNotes={openNotes}
            rejectMode={rejectMode}
            rejectReason={rejectReason}
            qcLoading={qcLoading}
            qcErrors={qcErrors}
            passCount={passCount}
            failCount={failCount}
            naCount={naCount}
            pendingCount={pendingCount}
            allDecided={allDecided}
            qcOnly={qcOnly}
            onSetItems={setItems}
            onToggleNotes={toggleNotes}
            onSetRejectMode={setRejectMode}
            onSetRejectReason={setRejectReason}
            onQcApprove={() => void handleQcApprove()}
            onQcReject={() => void handleQcReject()}
            onClose={onClose}
            onSaved={onSaved}
            setPhase={(p) => setPhase(p)}
          />
        )}

        {phase === "billing" && (
          <BillingPhase
            job={job}
            phase="billing"
            partLines={partLines}
            setPartLines={setPartLines}
            payRows={payRows}
            setPayRows={setPayRows}
            payType={payType}
            setPayType={setPayType}
            paySafe={paySafe}
            setPaySafe={setPaySafe}
            payAmount={payAmount}
            setPayAmount={setPayAmount}
            productSearch={productSearch}
            setProductSearch={setProductSearch}
            showProductDrop={showProductDrop}
            setShowProductDrop={setShowProductDrop}
            addQty={addQty}
            setAddQty={setAddQty}
            addPrice={addPrice}
            setAddPrice={setAddPrice}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            selectedWarehouseId={selectedWarehouseId}
            setSelectedWarehouseId={setSelectedWarehouseId}
            brokerName={brokerName}
            setBrokerName={setBrokerName}
            brokerComm={brokerComm}
            setBrokerComm={setBrokerComm}
            billingLoading={billingLoading}
            billingErrors={billingErrors}
            onBillingSave={() => void handleBillingSave()}
            onClose={onClose}
            onBack={() => { setPhase("qc"); setBillingErrors([]); }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
