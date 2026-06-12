import { useState } from "react";
import { useGetPurchases } from "@workspace/api-client-react";
import { Search, FileDown, Printer } from "lucide-react";
import { formatCurrency, formatDate, TableSkeleton, PaymentBadge, StatusBadge, InvoicePdfButton } from "./shared";
import { escapeHtml } from "@/lib/print-utils";
import { useAppSettings } from "@/contexts/app-settings";
import { exportTableToPDF } from "@/lib/pdf-export";

const PAY_AR: Record<string,string> = { cash:"نقدي", credit:"آجل", partial:"جزئي" };
const STATUS_AR: Record<string,string> = { paid:"مدفوع", partial:"جزئي", unpaid:"غير مدفوع", pending:"معلق" };

interface PurchaseRow {
  invoice_no:       string;
  customer_name?:   string | null;
  total_amount:     number;
  paid_amount:      number;
  remaining_amount: number;
  payment_type:     string;
  status:           string;
  created_at:       string;
}

function exportPurchasesExcel(rows: PurchaseRow[]) {
  const header = ["رقم الفاتورة","المورد","الإجمالي","المدفوع","المتبقي","نوع الدفع","الحالة","التاريخ"];
  const body = rows.map(p => [p.invoice_no,p.customer_name||"—",p.total_amount,p.paid_amount,p.remaining_amount,PAY_AR[p.payment_type]||p.payment_type,STATUS_AR[p.status]||p.status,formatDate(p.created_at)]);
  const csv = [header,...body].map(r=>r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href=url; a.download="فواتير_المشتريات.csv"; a.click(); URL.revokeObjectURL(url);
}
function printPurchasesReport(rows: PurchaseRow[]) {
  const html = `<html dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:Tajawal,Cairo,Arial;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px;text-align:right}th{background:#f5f5f5}</style></head><body><h2>تقرير فواتير المشتريات</h2><table><thead><tr><th>رقم الفاتورة</th><th>المورد</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>نوع الدفع</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${escapeHtml(p.invoice_no)}</td><td>${escapeHtml(p.customer_name)||"—"}</td><td>${formatCurrency(p.total_amount)}</td><td>${formatCurrency(p.paid_amount)}</td><td>${formatCurrency(p.remaining_amount)}</td><td>${escapeHtml(PAY_AR[p.payment_type]||p.payment_type)}</td><td>${escapeHtml(STATUS_AR[p.status]||p.status)}</td><td>${escapeHtml(formatDate(p.created_at))}</td></tr>`).join("")}</tbody></table></body></html>`;
  const _blob = new Blob([html], { type: 'text/html' });
  const _url = URL.createObjectURL(_blob);
  const w = window.open(_url, '_blank');
  setTimeout(() => { w?.print(); URL.revokeObjectURL(_url); }, 500);
}

export default function PurchasesInvoicesReport() {
  const { data:purchases=[], isLoading } = useGetPurchases();
  const [search,setSearch]               = useState("");
  const [payFilter,setPayFilter]         = useState("");
  const { settings }                     = useAppSettings();

  const filtered = purchases.filter(p=>{
    const matchS = !search||p.invoice_no.includes(search)||(p.customer_name&&p.customer_name.includes(search));
    return matchS&&(!payFilter||p.payment_type===payFilter);
  });
  const totalPurchases = filtered.reduce((s,v)=>s+v.total_amount,0);
  const totalPaid      = filtered.reduce((s,v)=>s+v.paid_amount,0);
  const totalRemaining = filtered.reduce((s,v)=>s+v.remaining_amount,0);

  return (
    <div className="space-y-4" style={{ fontFamily:"'Tajawal','Cairo',sans-serif" }}>
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-red-500/10"><p className="text-red-400 text-xs mb-1">إجمالي المشتريات</p><p className="text-2xl font-black text-ink">{formatCurrency(totalPurchases)}</p><p className="text-ink/30 text-xs">{filtered.length} فاتورة</p></div>
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/10"><p className="text-emerald-400 text-xs mb-1">المدفوع</p><p className="text-2xl font-black text-ink">{formatCurrency(totalPaid)}</p></div>
        <div className="glass-panel rounded-2xl p-4 border border-amber-500/10"><p className="text-amber-400 text-xs mb-1">المتبقي للعملاء</p><p className="text-2xl font-black text-ink">{formatCurrency(totalRemaining)}</p></div>
      </div>
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/30"/><input className="glass-input w-full icon-pr text-sm" placeholder="بحث برقم الفاتورة أو العميل..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="flex gap-1">{[{v:"",l:"الكل"},{v:"cash",l:"نقدي"},{v:"credit",l:"آجل"},{v:"partial",l:"جزئي"}].map(opt=>(
          <button key={opt.v} onClick={()=>setPayFilter(opt.v)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${payFilter===opt.v?"bg-amber-500/20 border-amber-500/40 text-amber-400":"glass-panel border-line text-ink/50 hover:text-ink"}`}>{opt.l}</button>
        ))}</div>
        <div className="flex gap-2 mr-auto">
          <button onClick={()=>exportPurchasesExcel(filtered)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-all"><FileDown className="w-3.5 h-3.5"/> Excel</button>
          <button onClick={()=>printPurchasesReport(filtered)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30 transition-all"><Printer className="w-3.5 h-3.5"/> PDF الكل</button>
          <button
            onClick={() => exportTableToPDF({
              title: "تقرير فواتير المشتريات",
              columns: ["رقم الفاتورة","المورد","الإجمالي","المدفوع","المتبقي","نوع الدفع","الحالة","التاريخ"],
              rows: filtered.map(p => [p.invoice_no, p.customer_name||"—", formatCurrency(p.total_amount), formatCurrency(p.paid_amount), formatCurrency(p.remaining_amount), PAY_AR[p.payment_type]||p.payment_type, STATUS_AR[p.status]||p.status, formatDate(p.created_at)]),
              filename: "فواتير_المشتريات",
              companyName: settings.companyName,
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all"
          >
            <FileDown className="w-3.5 h-3.5"/> تصدير PDF
          </button>
        </div>
      </div>
      <div className="glass-panel rounded-3xl overflow-hidden border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-surface border-b border-line"><tr><th className="p-3 text-ink/50">رقم الفاتورة</th><th className="p-3 text-ink/50">العميل</th><th className="p-3 text-ink/50">الإجمالي</th><th className="p-3 text-ink/50">المدفوع</th><th className="p-3 text-ink/50">المتبقي</th><th className="p-3 text-ink/50">الدفع</th><th className="p-3 text-ink/50">الحالة</th><th className="p-3 text-ink/50">التاريخ</th><th className="p-3 text-ink/50">فاتورة</th></tr></thead>
            <tbody>
              {isLoading ? <TableSkeleton cols={9} rows={5}/>
                : filtered.length===0 ? <tr><td colSpan={9} className="p-12 text-center text-ink/40">لا توجد مشتريات</td></tr>
                : filtered.map(p=>(
                  <tr key={p.id} className="border-b border-line erp-table-row">
                    <td className="p-3 font-bold text-amber-400">{p.invoice_no}</td>
                    <td className="p-3 text-ink">{p.customer_name||"—"}</td>
                    <td className="p-3 font-bold text-ink">{formatCurrency(p.total_amount)}</td>
                    <td className="p-3 text-emerald-400 font-bold">{formatCurrency(p.paid_amount)}</td>
                    <td className="p-3 text-red-400 font-bold">{p.remaining_amount>0?formatCurrency(p.remaining_amount):"—"}</td>
                    <td className="p-3"><PaymentBadge type={p.payment_type}/></td>
                    <td className="p-3"><StatusBadge status={p.status}/></td>
                    <td className="p-3 text-ink/40 text-xs">{formatDate(p.created_at)}</td>
                    <td className="p-3"><InvoicePdfButton type="purchases" id={p.id}/></td>
                  </tr>
                ))
              }
            </tbody>
            {filtered.length>0&&(
              <tfoot className="bg-surface border-t border-line"><tr><td colSpan={2} className="p-3 text-ink/50 font-bold">الإجمالي ({filtered.length} فاتورة)</td><td className="p-3 font-black text-ink">{formatCurrency(totalPurchases)}</td><td className="p-3 font-black text-emerald-400">{formatCurrency(totalPaid)}</td><td className="p-3 font-black text-red-400">{formatCurrency(totalRemaining)}</td><td colSpan={4}/></tr></tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
