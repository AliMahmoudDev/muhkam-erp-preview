import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Link } from "wouter";
import { Plus } from "lucide-react";

interface Sale {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  payment_type: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
}

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

const statusLabel: Record<string, string> = { paid: "مدفوع", partial: "جزئي", unpaid: "غير مدفوع" };
const statusClass: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-700",
  unpaid: "bg-red-100 text-red-700",
};
const paymentLabel: Record<string, string> = { cash: "نقدي", credit: "آجل", partial: "جزئي" };

export default function Sales() {
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: () => api.get<Sale[]>("/sales"),
  });

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">المبيعات</h1>
        <Link href="/sales/new" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> فاتورة بيع جديدة
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">العميل</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">نوع الدفع</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الإجمالي</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">المدفوع</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">المتبقي</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sales.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">لا توجد مبيعات حتى الآن</td></tr>
              )}
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-blue-700 font-semibold">{s.invoice_no}</td>
                  <td className="px-4 py-3 text-slate-700">{s.customer_name ?? "عميل نقدي"}</td>
                  <td className="px-4 py-3 text-slate-600">{paymentLabel[s.payment_type] ?? s.payment_type}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmt(s.total_amount)} ج</td>
                  <td className="px-4 py-3 text-green-700">{fmt(s.paid_amount)} ج</td>
                  <td className="px-4 py-3 text-red-600">{fmt(s.remaining_amount)} ج</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass[s.status] ?? ""}`}>
                      {statusLabel[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
