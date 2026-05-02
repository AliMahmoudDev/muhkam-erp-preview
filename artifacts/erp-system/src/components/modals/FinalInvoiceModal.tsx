/**
 * FinalInvoiceModal — بوّابة "جاهز للتسليم" → "التسليم"
 *
 * يجمع بين:
 *  - عرض الفاتورة النهائية الكاملة (مع تحديث فوري بناءً على تكلفة الشحن والخصم)
 *  - حقل تكلفة الشحن + اختيار الخزنة
 *  - حقل خصم نهائي على الإجمالي
 *  - زرّا طباعة وإرسال واتساب (يعملان قبل الحفظ باستخدام القيم الحالية)
 *  - زر تأكيد: يحفظ الشحن + الخصم ثم ينقل البطاقة لـ "التسليم"
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/format";
import {
  FileText, Printer, MessageCircle, Loader2, X, AlertTriangle, Truck, CheckCircle2,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { safeArray } from "@/lib/safe-data";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";

interface PartLine {
  product_name: string;
  quantity:     number;
  unit_price:   number;
  total:        number;
}
interface ReceiptData {
  job_no:               string;
  customer_name:        string | null;
  customer_phone:       string | null;
  device_brand:         string | null;
  device_model:         string | null;
  imei:                 string | null;
  serial_no:            string | null;
  color:                string | null;
  storage:              string | null;
  received_at:          string | null;
  problem_description:  string | null;
  technician_name:      string | null;
  final_cost:           number;
  deposit_paid:         number;
  shipping_cost:        number;
  final_discount:       number;
  parts_total:          number;
  parts:                PartLine[];
}

interface JobLite {
  id:             number;
  job_no:         string;
  shipping_cost?: string | number | null;
}
interface SafeRow { id: number; name: string; balance: string | number; }

interface Props {
  job:      JobLite;
  onClose:  () => void;
  onSaved:  () => void;
}

const fmt = (n: number) => formatCurrency(Number(n ?? 0));

export default function FinalInvoiceModal({ job, onClose, onSaved }: Props) {
  const { user }  = useAuth();
  const { toast } = useToast();
  const { data: safesRaw } = useGetSettingsSafes();
  const allSafes: SafeRow[] = safeArray(safesRaw) as SafeRow[];

  const isScopedRole = user?.role === "cashier" || user?.role === "salesperson";
  const safes = isScopedRole && user?.safe_id
    ? allSafes.filter(s => s.id === user.safe_id)
    : allSafes;

  const [data,    setData]    = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr,setFetchErr]= useState("");

  const [cost,     setCost]     = useState<string>(String(job.shipping_cost ?? "0"));
  const [safeId,   setSafeId]   = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<string[]>([]);

  useEffect(() => {
    if (safes.length === 1 && !safeId) setSafeId(String(safes[0].id));
  }, [safes.length]);

  useEffect(() => {
    let cancelled = false;
    authFetch(api(`/api/repair-jobs/${job.id}/receipt-data`))
      .then(async r => {
        if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? "تعذّر تحميل البيانات");
        return r.json() as Promise<ReceiptData>;
      })
      .then(d => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
          if (d.final_discount > 0) setDiscount(String(d.final_discount));
        }
      })
      .catch(e => { if (!cancelled) { setFetchErr(e instanceof Error ? e.message : "خطأ"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [job.id]);

  /* حسابات الإجمالي المحدَّثة بناءً على الحقول الحالية */
  function computeTotals() {
    const fc   = data?.final_cost  ?? 0;
    const pt   = data?.parts_total ?? 0;
    const sc   = Math.max(Number(cost)     || 0, 0);
    const disc = Math.max(Number(discount) || 0, 0);
    const dep  = data?.deposit_paid ?? 0;
    const sub  = fc + pt + sc;
    const total     = Math.max(sub - disc, 0);
    const remaining = Math.max(total - dep, 0);
    return { fc, pt, sc, disc, dep, sub, total, remaining };
  }

  const numericCost = Number(cost);
  const needsSafe   = Number.isFinite(numericCost) && numericCost > 0;

  /* ── طباعة ── */
  function handlePrint() {
    if (!data) return;
    const { fc, pt, sc, disc, dep, total, remaining } = computeTotals();
    const esc = (v: unknown): string =>
      String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

    const deviceLine = [data.device_brand, data.device_model].filter(Boolean).map(esc).join(" ") || "—";
    const html = `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>فاتورة تسليم ${esc(data.job_no)}</title>
<style>
  body{font-family:'Tahoma','Segoe UI',sans-serif;padding:8px;font-size:11px;color:#000;max-width:80mm;margin:0 auto;}
  h1{text-align:center;font-size:13px;margin:6px 0;border-bottom:1px dashed #000;padding-bottom:4px;}
  .row{display:flex;justify-content:space-between;margin:2px 0;}
  .label{color:#555;}
  table{width:100%;border-collapse:collapse;margin:6px 0;}
  th,td{padding:3px 4px;border-bottom:1px dotted #999;text-align:right;font-size:10px;}
  .totals{margin-top:6px;padding-top:4px;border-top:1px dashed #000;}
  .grand{font-weight:bold;font-size:12px;}
  .discount{color:#c00;}
  .footer{text-align:center;margin-top:8px;color:#666;font-size:10px;border-top:1px dashed #000;padding-top:4px;}
  @media print{@page{size:80mm auto;margin:4mm;}body{padding:0;}}
</style></head><body>
<h1>فاتورة تسليم بطاقة صيانة</h1>
<div class="row"><span class="label">رقم البطاقة:</span><strong>${esc(data.job_no)}</strong></div>
<div class="row"><span class="label">العميل:</span><span>${esc(data.customer_name ?? "—")}</span></div>
<div class="row"><span class="label">الهاتف:</span><span>${esc(data.customer_phone ?? "—")}</span></div>
<div class="row"><span class="label">الجهاز:</span><span>${deviceLine}</span></div>
${data.imei ? `<div class="row"><span class="label">IMEI:</span><span>${esc(data.imei)}</span></div>` : ""}
${data.received_at ? `<div class="row"><span class="label">تاريخ الاستلام:</span><span>${esc(data.received_at)}</span></div>` : ""}
<div class="row"><span class="label">تاريخ التسليم:</span><span>${esc(new Date().toLocaleDateString("ar-EG"))}</span></div>
${data.technician_name ? `<div class="row"><span class="label">الفني:</span><span>${esc(data.technician_name)}</span></div>` : ""}
${data.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(data.problem_description)}</div>` : ""}
${data.parts.length > 0 ? `
<table>
  <thead><tr><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>${data.parts.map(p => `<tr><td>${esc(p.product_name)}</td><td>${esc(p.quantity)}</td><td>${esc(fmt(p.unit_price))}</td><td>${esc(fmt(p.total))}</td></tr>`).join("")}</tbody>
</table>` : ""}
<div class="totals">
  <div class="row"><span class="label">تكلفة الإصلاح:</span><span>${esc(fmt(fc))}</span></div>
  ${pt > 0 ? `<div class="row"><span class="label">قطع الغيار:</span><span>${esc(fmt(pt))}</span></div>` : ""}
  ${sc > 0 ? `<div class="row"><span class="label">الشحن:</span><span>${esc(fmt(sc))}</span></div>` : ""}
  ${disc > 0 ? `<div class="row discount"><span>خصم:</span><span>- ${esc(fmt(disc))}</span></div>` : ""}
  <div class="row grand"><span>الإجمالي:</span><span>${esc(fmt(total))}</span></div>
  <div class="row"><span class="label">المدفوع مقدماً:</span><span>${esc(fmt(dep))}</span></div>
  <div class="row grand"><span>المتبقي:</span><span>${esc(fmt(remaining))}</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — مع تحيات إدارة الصيانة</div>
<script>window.addEventListener('load',()=>{window.print();setTimeout(()=>window.close(),1000);});</script>
</body></html>`;
    const w = window.open("","_blank","width=400,height=700");
    if (!w) { toast({ title: "تعذّر فتح نافذة الطباعة", description: "تأكد من السماح للنوافذ المنبثقة", variant: "destructive" }); return; }
    w.document.write(html);
    w.document.close();
    toast({ title: "جارٍ تجهيز الطباعة..." });
  }

  /* ── واتساب ── */
  function handleWhatsapp() {
    if (!data?.customer_phone) { toast({ title: "لا يوجد رقم هاتف للعميل", variant: "destructive" }); return; }
    const { fc, pt, sc, disc, dep, total, remaining } = computeTotals();
    const lines = [
      `*فاتورة تسليم بطاقة صيانة*`,
      `رقم البطاقة: ${data.job_no}`,
      `العميل: ${data.customer_name ?? "—"}`,
      `الجهاز: ${[data.device_brand, data.device_model].filter(Boolean).join(" ") || "—"}`,
      data.problem_description ? `المشكلة: ${data.problem_description}` : "",
      ``,
      `تكلفة الإصلاح: ${fmt(fc)}`,
      pt > 0 ? `قطع الغيار: ${fmt(pt)}` : "",
      sc > 0 ? `الشحن: ${fmt(sc)}` : "",
      disc > 0 ? `خصم: - ${fmt(disc)}` : "",
      `الإجمالي: ${fmt(total)}`,
      `المدفوع مقدماً: ${fmt(dep)}`,
      `*المتبقي: ${fmt(remaining)} ج.م*`,
      ``,
      `شكراً لتعاملكم معنا 🙏`,
    ].filter(Boolean).join("\n");
    const cleanPhone = String(data.customer_phone).replace(/[^\d]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`, "_blank", "noopener,noreferrer");
    toast({ title: "تم فتح واتساب" });
  }

  /* ── تأكيد التسليم ── */
  async function handleConfirm() {
    const numCost = Number(cost);
    const numDisc = Number(discount);

    if (!Number.isFinite(numCost) || numCost < 0) { setErrors(["تكلفة الشحن غير صحيحة"]); return; }
    if (!Number.isFinite(numDisc) || numDisc < 0)  { setErrors(["قيمة الخصم غير صحيحة"]); return; }
    if (numCost > 0 && !safeId) { setErrors(["يجب اختيار خزنة لخصم تكلفة الشحن منها"]); return; }

    setSaving(true); setErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/shipping`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_cost:  numCost,
          safe_id:        numCost > 0 ? Number(safeId) : null,
          final_discount: numDisc,
          notes:          `تسليم بطاقة صيانة ${job.job_no}`,
        }),
      });
      const body = await res.json() as { error?: string };
      if (!res.ok) { setErrors([body.error ?? "تعذّر حفظ البيانات"]); setSaving(false); return; }
      toast({ title: "تم تسجيل الفاتورة", description: "جارٍ الانتقال إلى مرحلة التسليم..." });
      onSaved();
    } catch {
      setErrors(["تعذّر الاتصال بالخادم"]); setSaving(false);
    }
  }

  const { fc, pt, sc, disc, dep, total, remaining } = computeTotals();

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="my-4 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <FileText className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">الفاتورة النهائية</h3>
              <p className="text-[11px] text-white/50">
                البطاقة <span className="text-white font-bold">{job.job_no}</span> — طباعة + إرسال + تأكيد التسليم
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── Loading / Error ── */}
          {loading && (
            <div className="flex items-center gap-2 text-white/60 text-xs justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل بيانات الفاتورة...
            </div>
          )}
          {fetchErr && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300">{fetchErr}</p>
            </div>
          )}

          {/* ── Invoice preview ── */}
          {data && (
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

              {/* ── Totals (live) ── */}
              <div className="mt-2 pt-2 border-t border-white/8 space-y-1">
                <div className="flex justify-between"><span className="text-white/50">تكلفة الإصلاح:</span><span className="text-white">{fmt(fc)}</span></div>
                {pt > 0 && <div className="flex justify-between"><span className="text-white/50">قطع الغيار:</span><span className="text-white">{fmt(pt)}</span></div>}
                {sc > 0 && <div className="flex justify-between"><span className="text-white/50">الشحن:</span><span className="text-white">{fmt(sc)}</span></div>}
                {disc > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>خصم نهائي:</span><span>- {fmt(disc)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-white pt-1 border-t border-white/8">
                  <span>الإجمالي:</span><span>{fmt(total)}</span>
                </div>
                <div className="flex justify-between text-emerald-300"><span>المدفوع:</span><span>{fmt(dep)}</span></div>
                <div className="flex justify-between font-black text-amber-300 text-[12px]"><span>المتبقي:</span><span>{fmt(remaining)}</span></div>
              </div>
            </div>
          )}

          {/* ── Shipping cost ── */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-white/55 mb-1">
                <Truck className="w-3 h-3 inline ml-1" />تكلفة الشحن (ج.م) — اترك 0 إن لم يكن هناك شحن
              </label>
              <input
                type="number" min={0} step="0.01"
                value={cost}
                onChange={e => setCost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-sm text-white focus:outline-none focus:border-sky-400/40"
                placeholder="0.00"
              />
            </div>

            {needsSafe && (
              <div>
                <label className="block text-[10px] font-bold text-white/55 mb-1">الخزنة (لخصم تكلفة الشحن)</label>
                <select
                  value={safeId}
                  onChange={e => setSafeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white focus:outline-none focus:border-sky-400/40"
                >
                  <option value="">— اختر الخزنة —</option>
                  {safes.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#1a1530]">
                      {s.name} — رصيد: {Number(s.balance).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Discount ── */}
            <div>
              <label className="block text-[10px] font-bold text-white/55 mb-1">
                خصم نهائي على الإجمالي (ج.م) — اترك 0 إن لم يكن هناك خصم
              </label>
              <input
                type="number" min={0} step="0.01"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-red-400/20 text-sm text-white focus:outline-none focus:border-red-400/40"
                placeholder="0.00"
              />
              {disc > 0 && (
                <p className="text-[10px] text-red-400/80 mt-1">
                  سيتم تطبيق خصم {fmt(disc)} ج.م على إجمالي الفاتورة
                </p>
              )}
            </div>
          </div>

          {/* ── Errors ── */}
          {errors.length > 0 && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <p className="text-[11px] font-bold text-red-400">خطأ:</p>
              </div>
              <ul className="list-disc list-inside">
                {errors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-white/8 space-y-2">
          {/* Print + WhatsApp */}
          <div className="grid grid-cols-2 gap-2">
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
              <Printer className="w-3.5 h-3.5" /> طباعة الفاتورة
            </button>
          </div>

          {/* Confirm → delivered */}
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={saving || !data}
              className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}
            >
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
                : <><CheckCircle2 className="w-3.5 h-3.5" /> تأكيد التسليم</>}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
