import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { formatCurrency } from "@/lib/format";
import { TableSkeleton } from "@/components/skeletons";
import { Package, AlertCircle, Warehouse, TrendingDown, ShoppingCart, Archive } from "lucide-react";
import { api } from '@/lib/api';


interface SupplierReport {
  supplier_name: string;
  customer_id: number | null;
  warehouse_id: number | null;
  warehouse_name: string;
  total_received_qty: number;
  total_received_value: number;
  total_remaining_qty: number;
  total_sold_qty: number;
  total_sold_value: number;
  total_owed: number;
  purchases: {
    id: number;
    invoice_no: string;
    date: string | null;
    total_amount: string;
    currency: string;
  }[];
  items: {
    purchase_id: number;
    product_name: string;
    quantity: string;
    unit_price: string;
    total_price: string;
  }[];
}

interface ReportData {
  suppliers: SupplierReport[];
  summary: {
    total_suppliers: number;
    total_purchases: number;
    grand_total_received: number;
    grand_total_owed: number;
  };
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string
}) {
  return (
    <div className={`glass-panel rounded-2xl p-4 border ${color}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl ${color.replace("border-", "bg-").replace("/40", "/10")}`}>
          {icon}
        </div>
        <span className="text-white/60 text-sm">{label}</span>
      </div>
      <p className="text-white font-black text-xl">{value}</p>
    </div>
  );
}

export default function ConsignmentPage() {
  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ["/api/consignment/report"],
    queryFn: async () => {
      const res = await authFetch(api("/api/consignment/report"));
      if (!res.ok) throw new Error("فشل تحميل تقرير الائتمان");
      return res.json();
    },
  });

  if (isLoading) return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white mb-1">تقرير الائتمان</h1>
        <p className="text-white/40 text-sm">جاري التحميل...</p>
      </div>
      <table className="w-full"><tbody><TableSkeleton /></tbody></table>
    </div>
  );

  if (error) return (
    <div className="p-6 flex items-center gap-3 text-red-400">
      <AlertCircle className="w-5 h-5" />
      <span>حدث خطأ أثناء تحميل التقرير</span>
    </div>
  );

  const summary = data?.summary;
  const suppliers = data?.suppliers ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-violet-500/15 border border-violet-500/30">
          <Package className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">تقرير الائتمان</h1>
          <p className="text-white/40 text-sm">بضاعة أُودعت بالأمانة — تتبع المستلم والمباع والمستحق</p>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="الموردون"
            value={String(summary.total_suppliers)}
            icon={<Warehouse className="w-4 h-4 text-blue-400" />}
            color="border-blue-500/30"
          />
          <StatCard
            label="فواتير الائتمان"
            value={String(summary.total_purchases)}
            icon={<Archive className="w-4 h-4 text-amber-400" />}
            color="border-amber-500/30"
          />
          <StatCard
            label="إجمالي المستلم"
            value={formatCurrency(summary.grand_total_received)}
            icon={<ShoppingCart className="w-4 h-4 text-green-400" />}
            color="border-green-500/30"
          />
          <StatCard
            label="إجمالي المستحق"
            value={formatCurrency(summary.grand_total_owed)}
            icon={<TrendingDown className="w-4 h-4 text-red-400" />}
            color="border-red-500/30"
          />
        </div>
      )}

      {/* Empty state */}
      {suppliers.length === 0 && (
        <div className="glass-panel rounded-2xl p-16 text-center">
          <Package className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">لا توجد فواتير ائتمان حتى الآن</p>
          <p className="text-white/25 text-xs mt-1">أنشئ فاتورة شراء وفعّل خيار «ائتمان»</p>
        </div>
      )}

      {/* Per-supplier cards */}
      {suppliers.map((sup, idx) => {
        const soldPct = sup.total_received_qty > 0
          ? Math.round((sup.total_sold_qty / sup.total_received_qty) * 100)
          : 0;

        return (
          <div key={idx} className="glass-panel rounded-2xl overflow-hidden border border-violet-500/20">
            {/* Supplier header */}
            <div className="px-5 py-4 bg-violet-500/10 border-b border-violet-500/20 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-black text-sm">
                  {sup.supplier_name.slice(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-white">{sup.supplier_name}</p>
                  <p className="text-xs text-white/40 flex items-center gap-1">
                    <Warehouse className="w-3 h-3" /> {sup.warehouse_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                  {sup.purchases.length} فاتورة
                </span>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                  sup.total_owed > 0
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-green-500/10 text-green-400 border-green-500/30'
                }`}>
                  {sup.total_owed > 0 ? `مستحق: ${formatCurrency(sup.total_owed)}` : "تمت التسوية ✓"}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-x-reverse divide-white/10">
              {[
                { label: "إجمالي المستلم", val: `${sup.total_received_qty} قطعة`, sub: formatCurrency(sup.total_received_value), color: "text-blue-400" },
                { label: "المباع", val: `${sup.total_sold_qty} قطعة`, sub: formatCurrency(sup.total_sold_value), color: "text-green-400" },
                { label: "المتبقي في المخزن", val: `${sup.total_remaining_qty} قطعة`, sub: "", color: "text-amber-400" },
                { label: "المستحق للمورد", val: formatCurrency(sup.total_owed), sub: `${soldPct}% مُباع`, color: sup.total_owed > 0 ? "text-red-400" : "text-green-400" },
              ].map((s, i) => (
                <div key={i} className="p-4 text-center">
                  <p className={`font-black text-lg ${s.color}`}>{s.val}</p>
                  {s.sub && <p className="text-xs text-white/40 mt-0.5">{s.sub}</p>}
                  <p className="text-xs text-white/30 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="px-5 py-3 border-t border-white/5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-white/40">نسبة المبيعات</span>
                <span className="text-xs font-bold text-white/60">{soldPct}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-green-500 transition-all"
                  style={{ width: `${soldPct}%` }}
                />
              </div>
            </div>

            {/* Purchases table */}
            <details className="border-t border-white/10">
              <summary className="px-5 py-3 text-xs text-white/40 cursor-pointer hover:text-white/60 flex items-center gap-2 select-none">
                <span>▶ عرض الفواتير التفصيلية ({sup.purchases.length})</span>
              </summary>
              <div className="px-5 pb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="text-right py-2">رقم الفاتورة</th>
                      <th className="text-right py-2">التاريخ</th>
                      <th className="text-left py-2">القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sup.purchases.map(p => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 text-violet-300 font-mono font-bold">{p.invoice_no}</td>
                        <td className="py-2 text-white/50">{p.date ?? "—"}</td>
                        <td className="py-2 text-left font-bold text-white/80">{formatCurrency(Number(p.total_amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
