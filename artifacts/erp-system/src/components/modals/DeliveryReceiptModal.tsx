/**
 * DeliveryReceiptModal — يعرض إيصال تسليم البطاقة بعد إغلاقها (delivered).
 *
 * يجلب البيانات من /api/repair-jobs/:id/receipt-data، ثم يعرض معاينة قابلة للطباعة.
 * يدعم زرّين:
 *  - طباعة (window.print on a hidden printable section)
 *  - إرسال واتساب (wa.me deep link مع نص ملخّص + رابط الإيصال)
 *
 * عند الإرسال/الطباعة يستدعي POST /api/repair-jobs/:id/delivery-receipt لتسجيل الحدث.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Printer, MessageCircle, Loader2, X, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface PartLine {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}
interface ReceiptData {
  job_no: string;
  customer_name: string | null;
  customer_phone: string | null;
  device_brand: string | null;
  device_model: string | null;
  imei: string | null;
  serial_no: string | null;
  color: string | null;
  storage: string | null;
  received_at: string | null;
  delivered_at: string | null;
  problem_description: string | null;
  notes: string | null;
  technician_name: string | null;
  estimated_cost: number;
  final_cost: number;
  deposit_paid: number;
  shipping_cost: number;
  final_discount: number;
  parts_total: number;
  parts: PartLine[];
}

interface Props {
  jobId: number;
  onClose: () => void;
  /** يُستدعى بعد طباعة/إرسال ناجح حتى يقوم الأب بإعادة تحميل البيانات */
  onSent?: () => void;
}

const fmt = (n: number) => Number(n ?? 0).toFixed(2);

export default function DeliveryReceiptModal({ jobId, onClose, onSent }: Props) {
  const { toast } = useToast();
  const [data, setData]   = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch(api(`/api/repair-jobs/${jobId}/receipt-data`))
      .then(async r => {
        if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "تعذّر تحميل بيانات الإيصال");
        return r.json() as Promise<ReceiptData>;
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : "خطأ"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [jobId]);

  function buildTotals(d: ReceiptData) {
    const sub        = (d.final_cost ?? 0) + (d.parts_total ?? 0) + (d.shipping_cost ?? 0);
    const total      = Math.max(sub - (d.final_discount ?? 0), 0);
    const remaining  = Math.max(total - (d.deposit_paid ?? 0), 0);
    return { sub, total, remaining };
  }

  async function recordDelivered(method: "whatsapp" | "print" | "both") {
    try {
      await authFetch(api(`/api/repair-jobs/${jobId}/delivery-receipt`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      onSent?.();
    } catch {
      /* تسجيل الحدث غير حرج — نتجاهل الفشل */
    }
  }

  function handlePrint() {
    /* Use a print-only window/iframe approach: open a new window with the
       receipt HTML and trigger print there to avoid affecting the host page. */
    if (!data) return;
    const { total, remaining } = buildTotals(data);

    /* SEC-XSS-001: نُهرّب أي حقل قادم من الخادم/المستخدم قبل دمجه في HTML
       لمنع XSS عبر اسم عميل/وصف مشكلة/قطعة مدسوس بـ <script> أو attribute injection. */
    const esc = (v: unknown): string => {
      const s = v == null ? "" : String(v);
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const deviceLine = [data.device_brand, data.device_model].filter(Boolean).map(esc).join(" ") || "—";

    const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>إيصال تسليم ${esc(data.job_no)}</title>
<style>
  body { font-family: 'Tahoma','Segoe UI',sans-serif; padding: 8px; font-size: 11px; color: #000; max-width: 80mm; margin: 0 auto; }
  h1 { text-align:center; font-size: 13px; margin: 6px 0; border-bottom: 1px dashed #000; padding-bottom: 4px; }
  .row { display:flex; justify-content: space-between; margin: 2px 0; }
  .label { color: #555; }
  .discount { color: #c00; }
  table { width:100%; border-collapse: collapse; margin: 6px 0; }
  th,td { padding: 3px 4px; border-bottom: 1px dotted #999; text-align: right; font-size: 10px; }
  .totals { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000; }
  .grand { font-weight: bold; font-size: 12px; }
  .footer { text-align:center; margin-top: 8px; color: #666; font-size: 10px; border-top: 1px dashed #000; padding-top: 4px; }
  @media print { @page { size: 80mm auto; margin: 4mm; } body { padding: 0; } }
</style>
</head>
<body>
  <h1>إيصال تسليم بطاقة صيانة</h1>
  <div class="row"><span class="label">رقم البطاقة:</span><strong>${esc(data.job_no)}</strong></div>
  <div class="row"><span class="label">العميل:</span><span>${data.customer_name ? esc(data.customer_name) : "—"}</span></div>
  <div class="row"><span class="label">الهاتف:</span><span>${data.customer_phone ? esc(data.customer_phone) : "—"}</span></div>
  <div class="row"><span class="label">الجهاز:</span><span>${deviceLine}</span></div>
  ${data.imei ? `<div class="row"><span class="label">IMEI:</span><span>${esc(data.imei)}</span></div>` : ""}
  ${data.serial_no ? `<div class="row"><span class="label">السيريال:</span><span>${esc(data.serial_no)}</span></div>` : ""}
  ${data.color ? `<div class="row"><span class="label">اللون:</span><span>${esc(data.color)}</span></div>` : ""}
  ${data.storage ? `<div class="row"><span class="label">السعة:</span><span>${esc(data.storage)}</span></div>` : ""}
  <div class="row"><span class="label">تاريخ الاستلام:</span><span>${data.received_at ? esc(data.received_at) : "—"}</span></div>
  <div class="row"><span class="label">تاريخ التسليم:</span><span>${esc(data.delivered_at ?? new Date().toISOString().split("T")[0])}</span></div>
  ${data.technician_name ? `<div class="row"><span class="label">الفني:</span><span>${esc(data.technician_name)}</span></div>` : ""}
  ${data.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(data.problem_description)}</div>` : ""}
  ${data.parts.length > 0 ? `
    <table>
      <thead><tr><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>
        ${data.parts.map(p => `<tr><td>${esc(p.product_name)}</td><td>${esc(p.quantity)}</td><td>${esc(fmt(p.unit_price))}</td><td>${esc(fmt(p.total))}</td></tr>`).join("")}
      </tbody>
    </table>
  ` : ""}
  <div class="totals">
    <div class="row"><span class="label">تكلفة الإصلاح:</span><span>${esc(fmt(data.final_cost))}</span></div>
    ${data.parts_total > 0 ? `<div class="row"><span class="label">قطع الغيار:</span><span>${esc(fmt(data.parts_total))}</span></div>` : ""}
    ${data.shipping_cost > 0 ? `<div class="row"><span class="label">الشحن:</span><span>${esc(fmt(data.shipping_cost))}</span></div>` : ""}
    ${data.final_discount > 0 ? `<div class="row discount"><span>خصم:</span><span>- ${esc(fmt(data.final_discount))}</span></div>` : ""}
    <div class="row grand"><span>الإجمالي:</span><span>${esc(fmt(total))}</span></div>
    <div class="row"><span class="label">المدفوع مقدماً:</span><span>${esc(fmt(data.deposit_paid))}</span></div>
    <div class="row grand"><span>المتبقي:</span><span>${esc(fmt(remaining))}</span></div>
  </div>
  <div class="footer">شكراً لتعاملكم معنا — مع تحيات إدارة الصيانة</div>
  <script>window.addEventListener('load', () => { window.print(); setTimeout(() => window.close(), 1000); });</script>
</body>
</html>`;
    const _blob = new Blob([html], { type: 'text/html' });
    const _url = URL.createObjectURL(_blob);
    const w = window.open(_url, '_blank', 'width=400,height=700');
    if (!w) {
      URL.revokeObjectURL(_url);
      toast({ title: "تعذّر فتح نافذة الطباعة", description: "تأكد من السماح للنوافذ المنبثقة", variant: "destructive" });
      return;
    }
    setTimeout(() => URL.revokeObjectURL(_url), 2000);
    void recordDelivered("print");
    toast({ title: "جارٍ تجهيز الطباعة..." });
  }

  function handleWhatsapp() {
    if (!data || !data.customer_phone) {
      toast({ title: "لا يوجد رقم هاتف للعميل", variant: "destructive" });
      return;
    }
    const { total, remaining } = buildTotals(data);
    const lines = [
      `*إيصال تسليم بطاقة صيانة*`,
      `رقم البطاقة: ${data.job_no}`,
      `العميل: ${data.customer_name ?? "—"}`,
      `الجهاز: ${[data.device_brand, data.device_model].filter(Boolean).join(" ") || "—"}`,
      data.problem_description ? `المشكلة: ${data.problem_description}` : "",
      ``,
      `تكلفة الإصلاح: ${fmt(data.final_cost)}`,
      data.parts_total > 0 ? `قطع الغيار: ${fmt(data.parts_total)}` : "",
      data.shipping_cost > 0 ? `الشحن: ${fmt(data.shipping_cost)}` : "",
      data.final_discount > 0 ? `خصم: - ${fmt(data.final_discount)}` : "",
      `الإجمالي: ${fmt(total)}`,
      `المدفوع مقدماً: ${fmt(data.deposit_paid)}`,
      `*المتبقي: ${fmt(remaining)} ج.م*`,
      ``,
      `شكراً لتعاملكم معنا 🙏`,
    ].filter(Boolean).join("\n");
    /* تنظيف الرقم — wa.me بيقبل أرقام بدون + ولا مسافات */
    const cleanPhone = String(data.customer_phone).replace(/[^\d]/g, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    void recordDelivered("whatsapp");
    toast({ title: "تم فتح واتساب" });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.78)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="my-4 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">إيصال التسليم</h3>
              <p className="text-[11px] text-white/50">معاينة + طباعة + واتساب</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-white/60 text-xs justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل بيانات الإيصال...
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300">{error}</p>
            </div>
          )}

          {data && (() => {
            const { total, remaining } = buildTotals(data);
            return (
              <div className="rounded-xl border border-white/8 p-4 text-[11px] space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex justify-between"><span className="text-white/50">رقم البطاقة:</span><span className="font-bold text-white">{data.job_no}</span></div>
                <div className="flex justify-between"><span className="text-white/50">العميل:</span><span className="text-white">{data.customer_name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-white/50">الهاتف:</span><span className="text-white">{data.customer_phone ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-white/50">الجهاز:</span><span className="text-white">{[data.device_brand, data.device_model].filter(Boolean).join(" ") || "—"}</span></div>
                {data.imei && <div className="flex justify-between"><span className="text-white/50">IMEI:</span><span className="text-white font-mono">{data.imei}</span></div>}
                {data.parts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/8">
                    <p className="text-white/55 mb-1">قطع الغيار:</p>
                    {data.parts.map((p, i) => (
                      <div key={i} className="flex justify-between text-[10px] text-white/70">
                        <span>{p.product_name} × {p.quantity}</span>
                        <span>{fmt(p.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-white/8 space-y-1">
                  <div className="flex justify-between"><span className="text-white/50">تكلفة الإصلاح:</span><span className="text-white">{fmt(data.final_cost)}</span></div>
                  {data.parts_total > 0 && <div className="flex justify-between"><span className="text-white/50">قطع الغيار:</span><span className="text-white">{fmt(data.parts_total)}</span></div>}
                  {data.shipping_cost > 0 && <div className="flex justify-between"><span className="text-white/50">الشحن:</span><span className="text-white">{fmt(data.shipping_cost)}</span></div>}
                  {data.final_discount > 0 && <div className="flex justify-between text-red-400"><span>خصم نهائي:</span><span>- {fmt(data.final_discount)}</span></div>}
                  <div className="flex justify-between font-bold text-white pt-1 border-t border-white/8"><span>الإجمالي:</span><span>{fmt(total)}</span></div>
                  <div className="flex justify-between text-emerald-300"><span>المدفوع:</span><span>{fmt(data.deposit_paid)}</span></div>
                  <div className="flex justify-between font-black text-amber-300 text-[12px]"><span>المتبقي:</span><span>{fmt(remaining)}</span></div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="px-5 py-4 border-t border-white/8 grid grid-cols-2 gap-2">
          <button
            onClick={handleWhatsapp}
            disabled={!data || !data.customer_phone}
            className="py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}
          >
            <MessageCircle className="w-3.5 h-3.5" /> إرسال واتساب
          </button>
          <button
            onClick={handlePrint}
            disabled={!data}
            className="py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
          >
            <Printer className="w-3.5 h-3.5" /> طباعة الإيصال
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
