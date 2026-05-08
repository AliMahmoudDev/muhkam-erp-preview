/**
 * DeliveryGateModal — بوّابة "جاهز للتسليم" → "التسليم"
 * Orchestrator: portal wrapper + header + invoice column + footer
 */
import { createPortal } from "react-dom";
import {
  PackageCheck, Loader2, X, AlertTriangle,
  FileText, Printer, MessageCircle, CheckCircle2, Truck, Save,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { JobLite, lineDiscountAmount, lineNet } from "./delivery-gate/types";
import { useDeliveryGate } from "./delivery-gate/useDeliveryGate";
import DeliveryGateForm from "./delivery-gate/DeliveryGateForm";

interface Props {
  job:     JobLite;
  onClose: () => void;
  onSaved: () => void;
}

const fmtCurrency = (n: number) => formatCurrency(n);
const fmt = (n: number) => formatNumber(Number(n ?? 0));

export default function DeliveryGateModal({ job, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const g = useDeliveryGate(job, onSaved);

  /* ── Print ── */
  function handlePrint() {
    if (!g.receiptData) return;
    const esc = (v: unknown): string =>
      String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const deviceLine = [g.receiptData.device_brand, g.receiptData.device_model].filter(Boolean).map(esc).join(" ") || "—";
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>فاتورة تسليم ${esc(g.receiptData.job_no)}</title>
<style>body{font-family:'Tahoma','Segoe UI',sans-serif;padding:8px;font-size:11px;color:#000;max-width:80mm;margin:0 auto;}h1{text-align:center;font-size:13px;margin:6px 0;border-bottom:1px dashed #000;padding-bottom:4px;}.row{display:flex;justify-content:space-between;margin:2px 0;}.label{color:#555;}table{width:100%;border-collapse:collapse;margin:6px 0;}th,td{padding:3px 4px;border-bottom:1px dotted #999;text-align:right;font-size:10px;}.totals{margin-top:6px;padding-top:4px;border-top:1px dashed #000;}.grand{font-weight:bold;font-size:12px;}.discount{color:#c00;}.footer{text-align:center;margin-top:8px;color:#666;font-size:10px;border-top:1px dashed #000;padding-top:4px;}@media print{@page{size:80mm auto;margin:4mm;}body{padding:0;}}</style></head><body>
<h1>فاتورة تسليم بطاقة صيانة</h1>
<div class="row"><span class="label">رقم البطاقة:</span><strong>${esc(g.receiptData.job_no)}</strong></div>
<div class="row"><span class="label">العميل:</span><span>${esc(g.receiptData.customer_name ?? "—")}</span></div>
<div class="row"><span class="label">الهاتف:</span><span>${esc(g.receiptData.customer_phone ?? "—")}</span></div>
<div class="row"><span class="label">الجهاز:</span><span>${deviceLine}</span></div>
${g.receiptData.imei ? `<div class="row"><span class="label">IMEI:</span><span>${esc(g.receiptData.imei)}</span></div>` : ""}
${g.receiptData.received_at ? `<div class="row"><span class="label">تاريخ الاستلام:</span><span>${esc(g.receiptData.received_at)}</span></div>` : ""}
<div class="row"><span class="label">تاريخ التسليم:</span><span>${new Date().toLocaleDateString("ar-EG")}</span></div>
${g.receiptData.technician_name ? `<div class="row"><span class="label">الفني:</span><span>${esc(g.receiptData.technician_name)}</span></div>` : ""}
${g.receiptData.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(g.receiptData.problem_description)}</div>` : ""}
${g.partLines.length > 0 ? `<table><thead><tr><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الإجمالي</th></tr></thead><tbody>${g.partLines.map(p => { const d = lineDiscountAmount(p); const discCell = d > 0 ? (p.discount_mode === 'pct' ? `${p.discount_value}% (-${fmt(d)})` : `- ${fmt(d)}`) : "—"; return `<tr><td>${esc(p.product_name)}</td><td>${p.quantity}</td><td>${fmt(p.unit_price)}</td><td>${discCell}</td><td>${fmt(lineNet(p))}</td></tr>`; }).join("")}</tbody></table>` : ""}
<div class="totals">
${g.partsTotal > 0 ? `<div class="row"><span class="label">قطع الغيار:</span><span>${fmt(g.partsTotal)}</span></div>` : ""}
${g.numericCost > 0 ? `<div class="row"><span class="label">الشحن:</span><span>${fmt(g.numericCost)}</span></div>` : ""}
${g.numericDisc > 0 ? `<div class="row discount"><span>خصم:</span><span>- ${fmt(g.numericDisc)}</span></div>` : ""}
<div class="row grand"><span>الإجمالي:</span><span>${fmt(g.total)}</span></div>
<div class="row"><span class="label">المدفوع مقدماً:</span><span>${fmt(g.dep)}</span></div>
<div class="row grand"><span>المتبقي:</span><span>${fmt(g.totalRem)}</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — مع تحيات إدارة الصيانة</div>
<script>window.addEventListener('load',()=>{window.print();setTimeout(()=>window.close(),1000);});</script>
</body></html>`;
    const _blob = new Blob([html], { type: 'text/html' });
    const _url = URL.createObjectURL(_blob);
    const w = window.open(_url, '_blank', 'width=400,height=700');
    if (!w) { URL.revokeObjectURL(_url); toast({ title: "تعذّر فتح نافذة الطباعة", variant: "destructive" }); return; }
    setTimeout(() => URL.revokeObjectURL(_url), 2000);
    toast({ title: "جارٍ تجهيز الطباعة..." });
  }

  /* ── WhatsApp ── */
  function handleWhatsapp() {
    if (!g.receiptData?.customer_phone) { toast({ title: "لا يوجد رقم هاتف للعميل", variant: "destructive" }); return; }
    const partsBlock: string[] = [];
    if (g.partLines.length > 0) {
      partsBlock.push(`*قطع الغيار:*`);
      for (const p of g.partLines) {
        const d = lineDiscountAmount(p);
        const base = `• ${p.product_name} — ${p.quantity} × ${fmt(p.unit_price)}`;
        if (d > 0) { const discTxt = p.discount_mode === 'pct' ? `خصم ${p.discount_value}% (- ${fmt(d)})` : `خصم - ${fmt(d)}`; partsBlock.push(`${base} | ${discTxt} = ${fmt(lineNet(p))}`); }
        else { partsBlock.push(`${base} = ${fmt(lineNet(p))}`); }
      }
      if (g.partsDiscSum > 0) partsBlock.push(`إجمالي خصم القطع: - ${fmt(g.partsDiscSum)}`);
      partsBlock.push(``);
    }
    const lines = [
      `*فاتورة تسليم بطاقة صيانة*`, `رقم البطاقة: ${g.receiptData.job_no}`,
      `العميل: ${g.receiptData.customer_name ?? "—"}`,
      `الجهاز: ${[g.receiptData.device_brand, g.receiptData.device_model].filter(Boolean).join(" ") || "—"}`,
      g.receiptData.problem_description ? `المشكلة: ${g.receiptData.problem_description}` : "",
      ``, ...partsBlock,
      g.partsTotal > 0 ? `إجمالي صافي القطع: ${fmt(g.partsTotal)}` : "",
      g.numericCost > 0 ? `الشحن: ${fmt(g.numericCost)}` : "",
      g.numericDisc > 0 ? `خصم إضافي: - ${fmt(g.numericDisc)}` : "",
      `الإجمالي: ${fmt(g.total)}`, `المدفوع مقدماً: ${fmt(g.dep)}`, `*المتبقي: ${fmt(g.totalRem)} ج.م*`, ``, `شكراً لتعاملكم معنا 🙏`,
    ].filter(Boolean).join("\n");
    const cleanPhone = String(g.receiptData.customer_phone).replace(/[^\d]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`, "_blank", "noopener,noreferrer");
    toast({ title: "تم فتح واتساب" });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="my-4 rounded-2xl border border-white/10 w-full max-w-5xl shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(132,204,22,0.15)", border: "1px solid rgba(163,230,53,0.3)" }}>
              <PackageCheck className="w-4.5 h-4.5 text-lime-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">محاسبة العميل والفاتورة النهائية</h3>
              <p className="text-[11px] text-white/50">
                البطاقة <span className="text-white font-bold">{job.job_no}</span>
                {job.customer_name && <> · {job.customer_name}</>}
                {job.device_brand && <> · {job.device_brand} {job.device_model ?? ""}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/60"><X className="w-4 h-4" /></button>
        </div>

        {/* Draft notice */}
        {g.draftRestored && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl flex items-center justify-between gap-2"
            style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}>
            <span className="text-[11px] text-blue-200">تم استعادة بيانات فاتورة محفوظة محلياً لهذه البطاقة. اضغط «حفظ» للتحديث أو «تأكيد التسليم» لإتمام العملية.</span>
            <button type="button" onClick={g.clearDraft} className="shrink-0 text-[10px] text-red-300 hover:text-red-200 underline">حذف المسوّدة</button>
          </div>
        )}

        {/* Loading / Error */}
        {g.fetchLoading && <div className="flex items-center justify-center gap-2 text-white/60 text-xs py-8"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل بيانات الفاتورة...</div>}
        {g.fetchErr && (
          <div className="m-5 p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300">{g.fetchErr}</p>
          </div>
        )}

        {/* Body */}
        {!g.fetchLoading && !g.fetchErr && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-white/5">
            {/* Left: form */}
            <DeliveryGateForm
              warehouses={g.warehouses} selectedWarehouseId={g.selectedWarehouseId} setSelectedWarehouseId={g.setSelectedWarehouseId}
              filteredProducts={g.filteredProducts} productSearch={g.productSearch} setProductSearch={g.setProductSearch}
              showProductDrop={g.showProductDrop} setShowProductDrop={g.setShowProductDrop}
              productSearchRef={g.productSearchRef}
              addQty={g.addQty} setAddQty={g.setAddQty} addPrice={g.addPrice} setAddPrice={g.setAddPrice}
              selectedProduct={g.selectedProduct}
              partLines={g.partLines} setPartLines={g.setPartLines}
              selectProduct={g.selectProduct} addPartLine={g.addPartLine} updateLineDiscount={g.updateLineDiscount}
              showExtForm={g.showExtForm} setShowExtForm={g.setShowExtForm}
              extVendor={g.extVendor} setExtVendor={g.setExtVendor}
              extDesc={g.extDesc} setExtDesc={g.setExtDesc}
              extPrice={g.extPrice} setExtPrice={g.setExtPrice} addExternalLine={g.addExternalLine}
              safes={g.safes} payRows={g.payRows} setPayRows={g.setPayRows}
              payType={g.payType} setPayType={g.setPayType}
              paySafe={g.paySafe} setPaySafe={g.setPaySafe}
              payAmount={g.payAmount} setPayAmount={g.setPayAmount}
              paidSoFar={g.paidSoFar} grandTotal={g.grandTotal} remaining={g.remaining} payIsDone={g.payIsDone}
              addPayRow={g.addPayRow} fillAll={g.fillAll}
              brokerName={g.brokerName} setBrokerName={g.setBrokerName}
              brokerComm={g.brokerComm} setBrokerComm={g.setBrokerComm}
            />

            {/* Right: invoice summary */}
            <div className="overflow-y-auto max-h-[65vh]">
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-amber-400" /> ملخص الفاتورة
                </h4>
                {g.receiptData && (
                  <div className="space-y-1 text-[11px]">
                    {[
                      { label: "العميل", val: g.receiptData.customer_name },
                      { label: "الهاتف", val: g.receiptData.customer_phone },
                      { label: "الجهاز", val: [g.receiptData.device_brand, g.receiptData.device_model].filter(Boolean).join(" ") },
                      { label: "IMEI", val: g.receiptData.imei },
                      { label: "المشكلة", val: g.receiptData.problem_description },
                      { label: "الفني", val: g.receiptData.technician_name },
                    ].filter(r => r.val).map(r => (
                      <div key={r.label} className="flex justify-between gap-2">
                        <span className="text-white/45 shrink-0">{r.label}:</span>
                        <span className="text-white/75 text-left truncate">{r.val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Shipping cost */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-sky-400" /> تكلفة الشحن (اختياري)
                </h4>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-white/50 mb-1 block">التكلفة (ج.م)</label>
                    <input type="number" min={0} step="any" value={g.cost} onChange={(e) => g.setCost(e.target.value)}
                      placeholder="0.00" dir="ltr"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-sky-400/20 text-sm text-white focus:outline-none focus:border-sky-400/40" />
                  </div>
                  {g.numericCost > 0 && (
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-white/50 mb-1 block">الخزنة</label>
                      <select value={g.safeId} onChange={(e) => g.setSafeId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-sky-400/20 text-sm text-white focus:outline-none focus:border-sky-400/40">
                        <option value="">-- اختر --</option>
                        {g.safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Discount */}
              <div className="px-5 pt-4 pb-3 border-b border-white/5">
                <h4 className="text-[12px] font-black text-white/80 mb-3">خصم نهائي (اترك 0 إن لم يكن)</h4>
                <input type="number" min={0} step="0.01" value={g.discount} onChange={(e) => g.setDiscount(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-red-400/20 text-sm text-white focus:outline-none focus:border-red-400/40" />
              </div>

              {/* Totals */}
              <div className="px-5 py-4 space-y-1.5 text-[11px]">
                {g.partsTotal > 0 && <div className="flex justify-between"><span className="text-white/50">قطع الغيار:</span><span className="text-blue-300">{fmtCurrency(g.partsTotal)}</span></div>}
                {g.numericCost > 0 && <div className="flex justify-between"><span className="text-white/50">الشحن:</span><span className="text-sky-300">{fmtCurrency(g.numericCost)}</span></div>}
                {g.numericDisc > 0 && <div className="flex justify-between text-red-400"><span>خصم نهائي:</span><span>- {fmtCurrency(g.numericDisc)}</span></div>}
                <div className="flex justify-between font-bold text-white text-[12px] pt-1.5 border-t border-white/8">
                  <span>الإجمالي الكلي:</span><span className="text-lime-300">{fmtCurrency(g.total)}</span>
                </div>
                {g.dep > 0 && <div className="flex justify-between text-emerald-300"><span>المدفوع مقدماً:</span><span>{fmtCurrency(g.dep)}</span></div>}
                <div className="flex justify-between font-black text-amber-300 text-[13px] pt-1 border-t border-white/8">
                  <span>المتبقي على العميل:</span><span>{fmtCurrency(g.totalRem)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {g.errors.length > 0 && (
          <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /><p className="text-[11px] font-bold text-red-400">خطأ:</p></div>
            <ul className="list-disc list-inside">{g.errors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}</ul>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleWhatsapp} disabled={!g.receiptData || !g.receiptData.customer_phone}
              className="py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}>
              <MessageCircle className="w-3.5 h-3.5" /> إرسال واتساب
            </button>
            <button onClick={handlePrint} disabled={!g.receiptData}
              className="py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}>
              <Printer className="w-3.5 h-3.5" /> طباعة الفاتورة
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => g.handleSave()} disabled={g.saving || !g.receiptData}
              className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(59,130,246,0.75)", border: "1px solid rgba(96,165,250,0.45)" }}>
              {g.saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</> : <><Save className="w-3.5 h-3.5" /> حفظ</>}
            </button>
            <button onClick={() => void g.handleConfirm()} disabled={g.saving || !g.receiptData}
              className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}>
              {g.saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</> : <><CheckCircle2 className="w-3.5 h-3.5" /> تأكيد التسليم</>}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs">إلغاء</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
