import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { api } from '@/lib/api';
import { useAppSettings } from "@/contexts/app-settings";
import { formatCurrency } from "@/lib/format";
import { openPrintWindow } from '@/lib/print-utils';
import { Receipt, Printer, X } from "lucide-react";

interface PurchaseDetail {
  id: number; invoice_no: string; date: string | null; created_at: string;
  supplier_name: string | null; customer_name: string | null;
  payment_type: string; total_amount: number; paid_amount: number; remaining_amount: number;
  status: string; posting_status: string; notes: string | null; currency?: string; exchange_rate?: number;
  items: { id: number; product_name: string; quantity: number; unit_price: number; total_price: number }[];
}

export default function PurchaseDetails({ purchaseId, onClose }: { purchaseId: number; onClose: () => void }) {
  const { settings } = useAppSettings();
  const { data: purchase, isLoading } = useQuery<PurchaseDetail>({
    queryKey: ["/api/purchases", purchaseId],
    queryFn: () => authFetch(api(`/api/purchases/${purchaseId}`)).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  const payLabels: Record<string, string> = { cash: "نقدي", credit: "آجل", partial: "جزئي" };

  const handlePrint = () => {
    if (!purchase) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const itemsHtml = purchase.items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.product_name)}</td>
        <td>${it.quantity}</td>
        <td>${it.unit_price.toFixed(2)}</td>
        <td>${it.total_price.toFixed(2)}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>فاتورة شراء — ${esc(purchase.invoice_no)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,sans-serif;background:#fff;color:#111;padding:24px;font-size:13px}
  .header{text-align:center;border-bottom:2px solid #f59e0b;padding-bottom:14px;margin-bottom:18px}
  .company{font-size:22px;font-weight:900;color:#92400e}
  .title{font-size:16px;font-weight:700;color:#b45309;margin-top:6px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:16px;padding:12px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-label{font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase}
  .meta-value{font-weight:700;color:#111;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
  thead{background:#92400e;color:#fff}
  th,td{padding:8px 10px;text-align:right}
  td{border-bottom:1px solid #e5e7eb}
  tbody tr:nth-child(even){background:#fffbeb}
  .totals{border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;background:#fffbeb}
  .total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
  .total-final{font-size:18px;font-weight:900;border-top:2px solid #b45309;padding-top:8px;margin-top:6px;color:#92400e}
  .footer{text-align:center;margin-top:20px;font-size:11px;color:#9ca3af;border-top:1px dashed #d1d5db;padding-top:12px}
  @media print{body{padding:10px}}
</style></head><body>
<div class="header">
  <div class="company">${esc(settings.companyName || "محكم")}</div>
  <div class="title">فاتورة مشتريات — ${esc(purchase.invoice_no)}</div>
</div>
<div class="meta">
  <div class="meta-item"><span class="meta-label">رقم الفاتورة</span><span class="meta-value">${esc(purchase.invoice_no)}</span></div>
  <div class="meta-item"><span class="meta-label">التاريخ</span><span class="meta-value">${purchase.date || new Date(purchase.created_at).toLocaleDateString("ar-EG")}</span></div>
  <div class="meta-item"><span class="meta-label">المورد</span><span class="meta-value">${esc(purchase.supplier_name || purchase.customer_name || "—")}</span></div>
  <div class="meta-item"><span class="meta-label">طريقة الدفع</span><span class="meta-value">${payLabels[purchase.payment_type] || purchase.payment_type}</span></div>
</div>
${purchase.notes ? `<p style="margin-bottom:12px;font-size:12px;color:#6b7280;font-style:italic">${esc(purchase.notes)}</p>` : ""}
<table>
  <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span>الإجمالي</span><span>${purchase.total_amount.toFixed(2)} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${purchase.paid_amount.toFixed(2)} ج.م</span></div>
  ${purchase.remaining_amount > 0 ? `<div class="total-row" style="color:#dc2626"><span>المتبقي</span><span>${purchase.remaining_amount.toFixed(2)} ج.م</span></div>` : ""}
  <div class="total-row total-final"><span>الإجمالي الكلي</span><span>${purchase.total_amount.toFixed(2)} ج.م</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — ${esc(settings.companyName || "محكم")}</div>
</body></html>`;
    openPrintWindow(html, { width: 800, height: 900, delay: 500, autoClose: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" /> تفاصيل فاتورة الشراء
          </h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={isLoading || !purchase}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 transition-colors text-sm font-bold">
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton-shimmer h-8 rounded-xl" />)}
          </div>
        ) : !purchase ? (
          <div className="text-center py-12 text-white/40">لم يتم العثور على الفاتورة</div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/8">
              <div><p className="text-white/40 text-xs mb-1">رقم الفاتورة</p><p className="text-amber-400 font-bold font-mono">{purchase.invoice_no}</p></div>
              <div><p className="text-white/40 text-xs mb-1">التاريخ</p><p className="text-white text-sm">{purchase.date || new Date(purchase.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p></div>
              <div><p className="text-white/40 text-xs mb-1">المورد / البائع</p><p className="text-white font-semibold text-sm">{purchase.supplier_name || purchase.customer_name || "—"}</p></div>
              <div><p className="text-white/40 text-xs mb-1">طريقة الدفع</p><p className="text-white text-sm">{payLabels[purchase.payment_type] || purchase.payment_type}</p></div>
              {purchase.notes && (
                <div className="col-span-2"><p className="text-white/40 text-xs mb-1">ملاحظات</p><p className="text-white/70 text-sm italic">{purchase.notes}</p></div>
              )}
            </div>

            <div>
              <h4 className="text-white font-bold mb-3 text-sm">أصناف الفاتورة</h4>
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <table className="w-full text-right text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="p-3 text-white/50 font-medium">#</th>
                      <th className="p-3 text-white/50 font-medium">الصنف</th>
                      <th className="p-3 text-white/50 font-medium">الكمية</th>
                      <th className="p-3 text-white/50 font-medium">سعر الوحدة</th>
                      <th className="p-3 text-white/50 font-medium">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item, i) => (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-3 text-white/40">{i + 1}</td>
                        <td className="p-3 text-white font-medium">{item.product_name}</td>
                        <td className="p-3 text-white/70">{item.quantity}</td>
                        <td className="p-3 text-white/70">{formatCurrency(item.unit_price)}</td>
                        <td className="p-3 text-blue-400 font-bold">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/8 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-white/50">الإجمالي</span><span className="text-white font-bold">{formatCurrency(purchase.total_amount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/50">المدفوع</span><span className="text-emerald-400 font-bold">{formatCurrency(purchase.paid_amount)}</span></div>
              {purchase.remaining_amount > 0 && (
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-red-400/80">المتبقي</span>
                  <span className="text-red-400 font-bold">{formatCurrency(purchase.remaining_amount)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
