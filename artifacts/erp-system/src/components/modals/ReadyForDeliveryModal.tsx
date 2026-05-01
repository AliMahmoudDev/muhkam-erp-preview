/**
 * ReadyForDeliveryModal — بوّابة الانتقال من "مراقبة الجودة" إلى "جاهز للتسليم"
 *
 * مرحلتان متتاليتان داخل نفس المودال:
 *
 * 1) فحص الجودة النهائي (نفس بنود QualityCheckModal):
 *    - رفض → يعود للبطاقة لـ in_repair + يحفظ سبب الرفض في qa_notes
 *    - قبول → يحفظ qa_checklist + qa_completed_at ثم ينتقل للمرحلة 2
 *
 * 2) محاسبة العميل:
 *    - اختيار قطعة من المخزن (اختياري، متعدد)
 *    - طريقة الدفع: نقدي / آجل / جزئي (نفس منطق المبيعات)
 *    - وسيط اختياري + عمولة
 *    - حفظ → POST /pre-delivery (يضع pre_delivery_reviewed_at + القطع + الدفع + الوسيط)
 *    - onSaved() → Pipeline ينقل البطاقة لـ ready_for_delivery
 */
import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import {
  ShieldCheck, Loader2, X, AlertTriangle,
  Check, Minus, XCircle, ThumbsDown, Save,
  ClipboardCheck, ClipboardList, MessageSquare,
  PackageCheck, Coins, Clock, Plus, Trash2, UserCog,
  ChevronLeft,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/safe-data";

/* ════════════════════════════════════════════════
   أنواع بنود الفحص
════════════════════════════════════════════════ */
type QcStatus = "pass" | "fail" | "n/a";

interface IntakeItem {
  id: string;
  label: string;
  category?: string;
  status?: string | null;
  notes?: string | null;
}

interface QcItem {
  id: string;
  label: string;
  category?: string;
  intake_status?: string | null;
  intake_notes?: string | null;
  status: QcStatus | null;
  notes: string;
}

/* ════════════════════════════════════════════════
   أنواع محاسبة العميل
════════════════════════════════════════════════ */
interface Product {
  id: number;
  name: string;
  quantity: string | number;
  sell_price: string | number;
  warehouse_id?: number | null;
}

interface Warehouse {
  id: number;
  name: string;
}

type PayType = "cash" | "credit";

interface PayRow {
  id: string;
  type: PayType;
  safe_id: number | null;
  amount: number;
}

interface PartLine {
  id: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  warehouse_id: number | null;
}

/* ════════════════════════════════════════════════
   Props
════════════════════════════════════════════════ */
interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  customer_name?: string | null;
  final_cost?: string | number | null;
  checklist?: unknown;
  qa_checklist?: unknown;
  qa_notes?: string | null;
  device_score?: number | null;
  broker_name?: string | null;
  broker_commission?: string | number | null;
}

interface Props {
  job: JobLite;
  onClose: () => void;
  onSaved: () => void;
  onRejected: () => void;
}

/* ════════════════════════════════════════════════
   ثوابت مساعدة
════════════════════════════════════════════════ */
const QC_BTN: Record<QcStatus, { label: string; bg: string; ring: string; icon: typeof Check }> = {
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

/* ────────────────────────────────────────────── */
function parseChecklist(raw: unknown): IntakeItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) arr = v; } catch { /**/ }
  }
  return arr
    .map((c, i) => {
      const o = c as Record<string, unknown>;
      const id = String(o.id ?? o.item_id ?? `item-${i}`);
      if (id === "__power_off__") return null;
      return {
        id,
        label:    String(o.label ?? o.label_ar ?? `بند ${i + 1}`),
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

function fmtCurrency(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ج.م";
}

/* ════════════════════════════════════════════════
   المكوّن الرئيسي
════════════════════════════════════════════════ */
export default function ReadyForDeliveryModal({ job, onClose, onSaved, onRejected }: Props) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"qc" | "billing">("qc");

  /* ═══════════════════════════════
     المرحلة 1 — فحص الجودة
  ═══════════════════════════════ */
  const intakeItems  = useMemo(() => parseChecklist(job.checklist),  [job.checklist]);
  const initialItems = useMemo<QcItem[]>(() => {
    const savedRaw  = parseSavedQc(job.qa_checklist);
    const savedById = new Map<string, { status?: string; notes?: string }>();
    savedRaw.forEach((s, i) => savedById.set(String(s.id ?? s.label ?? `item-${i}`), { status: s.status, notes: s.notes }));
    return intakeItems.map(it => {
      const saved = savedById.get(it.id) ?? savedById.get(it.label);
      const st    = saved?.status;
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

  const [items, setItems]       = useState<QcItem[]>(initialItems);
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());
  const [rejectMode, setRejectMode]     = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [qcLoading, setQcLoading] = useState(false);
  const [qcErrors, setQcErrors]   = useState<string[]>([]);

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
    if (items.length === 0) {
      setQcErrors(["لا توجد بنود فحص — يجب أن يكون هناك فحص أولي مسجَّل عند الاستلام"]);
      return;
    }
    if (!allDecided) {
      setQcErrors([`يجب اتخاذ قرار لكل بند — متبقي ${pendingCount} بند`]);
      return;
    }
    if (failCount > 0) {
      setQcErrors([`لا يمكن قبول الفحص ووجود ${failCount} بند مرفوض — استخدم زر "رفض الفحص"`]);
      return;
    }
    setQcLoading(true);
    setQcErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/qa-checklist`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({
            id: i.id, label: i.label, label_ar: i.label,
            category: i.category, status: i.status, notes: i.notes ?? "",
          })),
          notes: "",
          device_score: null,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setQcErrors([data.error ?? "تعذّر حفظ نتيجة الفحص"]);
        setQcLoading(false);
        return;
      }
      setQcLoading(false);
      setPhase("billing");
    } catch {
      setQcErrors(["تعذّر الاتصال بالخادم"]);
      setQcLoading(false);
    }
  }

  async function handleQcReject() {
    if (rejectReason.trim().length < 3) {
      setQcErrors(["يجب كتابة سبب رفض الفحص (3 أحرف على الأقل)"]);
      return;
    }
    setQcLoading(true);
    setQcErrors([]);
    try {
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
        body: JSON.stringify({
          qa_notes: merged,
          qa_completed_at: null,
          status: "in_repair",
          qa_checklist: items.map(i => ({
            id: i.id, label: i.label, label_ar: i.label,
            category: i.category, status: i.status, notes: i.notes ?? "",
          })),
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setQcErrors([data.error ?? "تعذّر حفظ سبب الرفض"]);
        setQcLoading(false);
        return;
      }
      toast({
        title: "⚠ رُفض الفحص",
        description: "البطاقة أُعيدت لـ \"جارٍ الإصلاح\" — راجع الفني لإعادة المعالجة.",
        variant: "destructive",
      });
      onRejected();
    } catch {
      setQcErrors(["تعذّر الاتصال بالخادم"]);
      setQcLoading(false);
    }
  }

  /* ═══════════════════════════════
     المرحلة 2 — محاسبة العميل
  ═══════════════════════════════ */
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw) as { id: number; name: string }[];

  const { data: warehousesRaw } = useQuery<Warehouse[]>({
    queryKey: ["/api/settings/warehouses"],
    queryFn:  () => authFetch(api("/api/settings/warehouses")).then(r => r.json()),
  });
  const warehouses: Warehouse[] = safeArray(warehousesRaw) as Warehouse[];

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(
    warehouses.length === 1 ? warehouses[0].id : null
  );

  const { data: productsRaw } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedWarehouseId],
    queryFn:  () => {
      const url = selectedWarehouseId
        ? api(`/api/products?warehouse_id=${selectedWarehouseId}`)
        : api("/api/products");
      return authFetch(url).then(r => r.json());
    },
    enabled: phase === "billing",
  });
  const products: Product[] = safeArray(productsRaw) as Product[];

  useEffect(() => {
    if (warehouses.length === 1 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses.length, selectedWarehouseId]);

  const [partLines, setPartLines]         = useState<PartLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [addQty, setAddQty]               = useState("1");
  const [addPrice, setAddPrice]           = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 30);
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productSearch]);

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setAddPrice(String(Number(p.sell_price) || ""));
    setShowProductDrop(false);
  }

  function addPartLine() {
    if (!selectedProduct) return;
    const qty   = Math.max(1, parseInt(addQty) || 1);
    const price = parseFloat(addPrice) || 0;
    setPartLines(prev => [
      ...prev,
      {
        id:           `${Date.now()}-${Math.random()}`,
        product_id:   selectedProduct.id,
        product_name: selectedProduct.name,
        quantity:     qty,
        unit_price:   price,
        warehouse_id: selectedWarehouseId,
      },
    ]);
    setSelectedProduct(null);
    setProductSearch("");
    setAddQty("1");
    setAddPrice("");
    productSearchRef.current?.focus();
  }

  const partsTotal = partLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  const finalCostBase = Number(job.final_cost ?? 0);
  const grandTotal    = finalCostBase + partsTotal;

  const [payRows, setPayRows]   = useState<PayRow[]>([]);
  const [payType, setPayType]   = useState<PayType>("cash");
  const [paySafe, setPaySafe]   = useState<number | null>(safes[0]?.id ?? null);
  const [payAmount, setPayAmount] = useState("");

  useEffect(() => {
    if (safes.length > 0 && !paySafe) setPaySafe(safes[0].id);
  }, [safes.length, paySafe]);

  const paidSoFar  = payRows.reduce((s, r) => s + r.amount, 0);
  const remaining  = Math.max(0, grandTotal - paidSoFar);
  const payIsDone  = grandTotal > 0 ? paidSoFar >= grandTotal - 0.005 : payRows.length > 0;

  function addPayRow() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || amt > remaining + 0.05) return;
    setPayRows(prev => [
      ...prev,
      {
        id:      `${Date.now()}-${Math.random()}`,
        type:    payType,
        safe_id: payType === "cash" ? (paySafe ?? (safes[0]?.id ?? null)) : null,
        amount:  Math.min(amt, remaining),
      },
    ]);
    setPayAmount("");
  }

  function fillAll() {
    if (remaining <= 0) return;
    setPayRows(prev => [
      ...prev,
      {
        id:      `${Date.now()}-${Math.random()}`,
        type:    payType,
        safe_id: payType === "cash" ? (paySafe ?? (safes[0]?.id ?? null)) : null,
        amount:  remaining,
      },
    ]);
    setPayAmount("");
  }

  const [brokerName, setBrokerName]         = useState(job.broker_name ?? "");
  const [brokerComm, setBrokerComm]         = useState(String(Number(job.broker_commission ?? 0) || ""));
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingErrors, setBillingErrors]   = useState<string[]>([]);

  async function handleBillingSave() {
    const errs: string[] = [];
    if (grandTotal > 0 && !payIsDone) {
      const cashTotal   = payRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0);
      const creditTotal = payRows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0);
      if (cashTotal + creditTotal === 0) errs.push("يجب إضافة طريقة دفع واحدة على الأقل");
    }
    if (errs.length) { setBillingErrors(errs); return; }

    setBillingLoading(true);
    setBillingErrors([]);
    try {
      const cashTotal   = payRows.filter(r => r.type === "cash").reduce((s, r) => s + r.amount, 0);
      const creditTotal = payRows.filter(r => r.type === "credit").reduce((s, r) => s + r.amount, 0);
      const pt: "cash" | "credit" | "partial" =
        creditTotal === 0 ? "cash" : cashTotal === 0 ? "credit" : "partial";
      const primarySafe = payRows.find(r => r.type === "cash")?.safe_id ?? null;

      const body: Record<string, unknown> = {
        broker_name:       brokerName.trim() || null,
        broker_commission: Number(brokerComm) || 0,
        parts: partLines.map(l => ({
          product_id:   l.product_id,
          product_name: l.product_name,
          quantity:     l.quantity,
          unit_price:   l.unit_price,
          warehouse_id: l.warehouse_id,
        })),
        payment: {
          payment_type: pt,
          paid_amount:  cashTotal,
          safe_id:      primarySafe,
          payments:     payRows.map(r => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })),
        },
      };

      const res = await authFetch(api(`/api/repair-jobs/${job.id}/pre-delivery`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setBillingErrors([data.error ?? "تعذّر حفظ بيانات المحاسبة"]);
        setBillingLoading(false);
        return;
      }
      toast({ title: "✓ تم حفظ المحاسبة — البطاقة جاهزة للتسليم" });
      onSaved();
    } catch {
      setBillingErrors(["تعذّر الاتصال بالخادم"]);
      setBillingLoading(false);
    }
  }

  /* ════════════════════════════════════════════
     الـ UI
  ════════════════════════════════════════════ */
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
        {/* ── Header ── */}
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
                ? <ShieldCheck className="w-4.5 h-4.5 text-purple-300" />
                : <PackageCheck className="w-4.5 h-4.5 text-lime-300" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">
                  {phase === "qc" ? "فحص الجودة النهائي" : "محاسبة العميل"}
                </h3>
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${phase === "qc" ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-white/40"}`}
                  >
                    ١
                  </span>
                  <span className="text-white/20">←</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${phase === "billing" ? "bg-lime-500/20 text-lime-300" : "bg-white/10 text-white/40"}`}
                  >
                    ٢
                  </span>
                </span>
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

        {/* ════════════════ المرحلة 1: فحص الجودة ════════════════ */}
        {phase === "qc" && (
          <>
            {/* counters */}
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

            {items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-400/60 mx-auto mb-2" />
                <p className="text-sm text-white/70 font-bold mb-1">لا توجد بنود فحص أولي</p>
                <p className="text-[11px] text-white/40">لم يُسجَّل فحص عند الاستلام — يمكنك المتابعة مباشرةً.</p>
                <button
                  onClick={() => setPhase("billing")}
                  className="mt-4 px-5 py-2 rounded-xl text-white text-xs font-bold"
                  style={{ background: "rgba(132,204,22,0.2)", border: "1px solid rgba(163,230,53,0.3)" }}
                >
                  المتابعة لمحاسبة العميل
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto" dir="rtl">
                {/* اليمين: استلام */}
                <div className="border-l border-white/5 bg-indigo-500/[0.03]">
                  <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-white/5 bg-indigo-500/10 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-indigo-300" />
                      <p className="text-[12px] font-black text-indigo-200">بنود الاستلام (مرجع)</p>
                    </div>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {items.map((it, idx) => {
                      const meta = INTAKE_BADGE[String(it.intake_status ?? "")];
                      return (
                        <div key={`r-${it.id}-${idx}`} className="rounded-xl border border-white/8 px-3 py-2 bg-white/[0.02]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-white/85 leading-tight">{it.label}</p>
                              {it.category && <p className="text-[9px] text-white/35 mt-0.5">{it.category}</p>}
                              {it.intake_notes && <p className="text-[10px] text-amber-300/70 mt-1 italic">ملاحظة: {it.intake_notes}</p>}
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

                {/* اليسار: قرار الفني */}
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
                              onClick={() => toggleNotes(idx)}
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
                            >
                              {it.label}
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                              {(["pass","fail","n/a"] as QcStatus[]).map(st => {
                                const cfg    = QC_BTN[st];
                                const Icon   = cfg.icon;
                                const active = it.status === st;
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => setItems(prev => prev.map((x, i) => i === idx ? { ...x, status: st } : x))}
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
                                onChange={(e) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
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

            {/* سبب الرفض */}
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

            {/* أخطاء */}
            {qcErrors.length > 0 && (
              <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <ul className="list-disc list-inside">
                  {qcErrors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
                </ul>
              </div>
            )}

            {/* أزرار المرحلة 1 */}
            <div className="px-5 py-4 border-t border-white/8 flex flex-wrap gap-2">
              {!rejectMode ? (
                <>
                  <button
                    onClick={handleQcApprove}
                    disabled={qcLoading || !allDecided || failCount > 0 || items.length === 0}
                    className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
                  >
                    {qcLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                      : <><Save className="w-3.5 h-3.5" /> قبول الفحص والمتابعة للمحاسبة</>}
                  </button>
                  <button
                    onClick={() => { setRejectMode(true); setQcErrors([]); }}
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
                    onClick={handleQcReject}
                    disabled={qcLoading || rejectReason.trim().length < 3}
                    className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
                  >
                    {qcLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                      : <><ThumbsDown className="w-3.5 h-3.5" /> تأكيد الرفض وإعادة للإصلاح</>}
                  </button>
                  <button
                    onClick={() => { setRejectMode(false); setRejectReason(""); setQcErrors([]); }}
                    disabled={qcLoading}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
                  >
                    رجوع
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ════════════════ المرحلة 2: محاسبة العميل ════════════════ */}
        {phase === "billing" && (
          <>
            <div className="overflow-y-auto max-h-[68vh]">
              {/* ── قسم القطع المستخدمة ── */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-[9px] text-blue-300 font-black">١</span>
                  القطع المستخدمة من المخزن (اختياري)
                </h4>

                {/* اختيار المخزن */}
                {warehouses.length > 1 && (
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">المخزن</label>
                    <select
                      value={selectedWarehouseId ?? ""}
                      onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value) || null)}
                      className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40"
                    >
                      <option value="">-- اختر المخزن --</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}

                {/* بحث عن منتج */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">اختر قطعة من المخزن</label>
                    <input
                      ref={productSearchRef}
                      value={productSearch}
                      onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); setSelectedProduct(null); }}
                      onFocus={() => setShowProductDrop(true)}
                      onBlur={() => setTimeout(() => setShowProductDrop(false), 180)}
                      placeholder="ابحث عن منتج..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/40"
                    />
                    {showProductDrop && filteredProducts.length > 0 && (
                      <div
                        className="absolute top-full right-0 left-0 z-50 mt-1 rounded-xl border border-white/10 overflow-hidden"
                        style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 220, overflowY: "auto" }}
                      >
                        {filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => selectProduct(p)}
                            className="w-full flex items-center justify-between px-3 py-2 text-right hover:bg-white/5 transition-colors"
                          >
                            <span className="text-[11px] text-white/85 truncate">{p.name}</span>
                            <span className="text-[10px] text-white/40 shrink-0 mr-2">{fmtCurrency(Number(p.sell_price))}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* الكمية */}
                  <div style={{ width: 72 }}>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">الكمية</label>
                    <input
                      type="number"
                      min={1}
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40 text-center"
                    />
                  </div>

                  {/* السعر */}
                  <div style={{ width: 100 }}>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">سعر الوحدة (ج.م)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={addPrice}
                      onChange={(e) => setAddPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40"
                      dir="ltr"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addPartLine}
                    disabled={!selectedProduct}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 flex-shrink-0"
                    style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة
                  </button>
                </div>

                {/* قائمة القطع المضافة */}
                {partLines.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {partLines.map(l => (
                      <div
                        key={l.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
                      >
                        <button
                          type="button"
                          onClick={() => setPartLines(prev => prev.filter(x => x.id !== l.id))}
                          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors"
                          style={{ background: "rgba(239,68,68,0.08)" }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="flex-1 text-[11px] text-white/80 truncate">{l.product_name}</span>
                        <span className="text-[10px] text-white/50 shrink-0">{l.quantity} × {fmtCurrency(l.unit_price)}</span>
                        <span className="text-[11px] font-bold text-blue-300 shrink-0">{fmtCurrency(l.quantity * l.unit_price)}</span>
                      </div>
                    ))}
                    <div className="flex justify-end pt-1">
                      <span className="text-[11px] font-bold text-blue-300">
                        إجمالي القطع: {fmtCurrency(partsTotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── ملخص المبلغ ── */}
              <div className="px-5 py-3 border-b border-white/5 bg-white/[0.015]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/50">تكلفة الإصلاح المسجّلة</span>
                  <span className="font-bold text-white">{fmtCurrency(finalCostBase)}</span>
                </div>
                {partsTotal > 0 && (
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-white/50">قطع مضافة</span>
                    <span className="font-bold text-blue-300">+ {fmtCurrency(partsTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[12px] font-black mt-2 pt-2 border-t border-white/8">
                  <span className="text-white">الإجمالي المستحق</span>
                  <span className="text-lime-300">{fmtCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* ── طريقة الدفع ── */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[9px] text-emerald-300 font-black">٢</span>
                  طريقة الدفع
                </h4>

                {/* صفوف الدفع المؤكدة */}
                {payRows.length > 0 && (
                  <div className="mb-2 space-y-1.5">
                    {payRows.map(row => (
                      <div
                        key={row.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${row.type === "credit" ? "bg-indigo-500/8 border border-indigo-500/20" : "bg-emerald-500/8 border border-emerald-500/20"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setPayRows(prev => prev.filter(r => r.id !== row.id))}
                          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors"
                          style={{ background: "rgba(239,68,68,0.08)" }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className={`text-[11px] font-bold shrink-0 flex items-center gap-1 ${row.type === "credit" ? "text-indigo-400" : "text-emerald-400"}`}>
                          {row.type === "cash" ? <Coins className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {row.type === "cash"
                            ? (safes.find(s => s.id === row.safe_id)?.name ?? "نقدي")
                            : "آجل"}
                        </span>
                        <span className="font-black text-sm text-white mr-auto">{fmtCurrency(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* شريط التقدم */}
                {grandTotal > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-white/50 mb-1">
                      <span>{payIsDone ? "✓ مكتمل" : `متبقي: ${fmtCurrency(remaining)}`}</span>
                      <span>{Math.min(100, Math.round((paidSoFar / grandTotal) * 100))}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`,
                          background: payIsDone
                            ? "linear-gradient(90deg,#10B981,#34D399)"
                            : "linear-gradient(90deg,#F59E0B,#FBBF24)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* إدخال الدفع */}
                {!payIsDone && (
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setPayType("cash")}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "cash" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-white/[0.03] text-white/50 border border-white/10 hover:bg-white/[0.06]"}`}
                      >
                        <Coins className="w-3 h-3" /> نقدي
                      </button>
                      <button
                        onClick={() => setPayType("credit")}
                        className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "credit" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "bg-white/[0.03] text-white/50 border border-white/10 hover:bg-white/[0.06]"}`}
                      >
                        <Clock className="w-3 h-3" /> آجل
                      </button>
                    </div>
                    <div className="flex gap-1.5 items-stretch">
                      {payType === "cash" && safes.length > 0 ? (
                        <select
                          value={paySafe ?? ""}
                          onChange={(e) => setPaySafe(parseInt(e.target.value) || null)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-emerald-400/40"
                        >
                          {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      ) : (
                        <div className="flex-1 flex items-center justify-end text-[11px] text-indigo-300/70 px-2 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                          ائتمان العميل
                        </div>
                      )}
                      <div className="relative shrink-0" style={{ width: 100 }}>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPayRow(); } }}
                          onFocus={(e) => e.target.select()}
                          placeholder={grandTotal > 0 ? remaining.toFixed(0) : "0"}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
                          dir="ltr"
                        />
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-white/30">ج.م</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={addPayRow}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/80 hover:text-white transition-all"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                      >
                        ↵ تأكيد
                      </button>
                      <button
                        onClick={fillAll}
                        disabled={remaining <= 0}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 hover:text-white transition-all disabled:opacity-30"
                        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
                      >
                        كل المتبقي ({fmtCurrency(remaining)})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── الوسيط (اختياري) ── */}
              <div className="px-5 pt-4 pb-4">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-[9px] text-amber-300 font-black">٣</span>
                  <UserCog className="w-3.5 h-3.5 text-amber-300" />
                  الوسيط (اختياري)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">اسم الوسيط</label>
                    <input
                      value={brokerName}
                      onChange={(e) => setBrokerName(e.target.value)}
                      placeholder="اسم الوسيط..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">قيمة العمولة (ج.م)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={brokerComm}
                      onChange={(e) => setBrokerComm(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
                      dir="ltr"
                    />
                  </div>
                </div>
                {(brokerName.trim() || Number(brokerComm) > 0) && (
                  <p className="mt-2 text-[10px] text-amber-300/70">
                    ⓘ ستُخصم العمولة من الإيراد الصافي للفني عند حساب الرواتب.
                  </p>
                )}
              </div>
            </div>

            {/* أخطاء */}
            {billingErrors.length > 0 && (
              <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <ul className="list-disc list-inside">
                  {billingErrors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
                </ul>
              </div>
            )}

            {/* أزرار المرحلة 2 */}
            <div className="px-5 py-4 border-t border-white/8 flex flex-wrap gap-2">
              <button
                onClick={() => { setPhase("qc"); setBillingErrors([]); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs transition-all"
                disabled={billingLoading}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                رجوع للفحص
              </button>
              <button
                onClick={handleBillingSave}
                disabled={billingLoading}
                className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(132,204,22,0.85)", border: "1px solid rgba(163,230,53,0.5)", color: "#0d1f00" }}
              >
                {billingLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#0d1f00" }} /> جارٍ الحفظ...</>
                  : <><PackageCheck className="w-3.5 h-3.5" /> حفظ وتأكيد "جاهز للتسليم"</>}
              </button>
              <button
                onClick={onClose}
                disabled={billingLoading}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
