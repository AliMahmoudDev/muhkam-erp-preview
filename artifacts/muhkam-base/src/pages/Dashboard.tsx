import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardStats {
  totalRevenue: number;
  totalSales: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: number;
  recentSales: Array<{
    id: number;
    invoice_no: string;
    customer_name: string | null;
    total_amount: number;
    status: string;
    created_at: string;
  }>;
  monthlySales?: Array<{ month: string; total: number }>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <span className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 0 });
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48" dir="rtl">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats ?? {
    totalRevenue: 0,
    totalSales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    lowStockProducts: 0,
    recentSales: [],
    monthlySales: [],
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">لوحة التحكم</h1>
        <p className="text-slate-500 text-sm mt-0.5">مرحباً بك في محكم BASE</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الإيرادات"
          value={`${fmt(s.totalRevenue)} ج`}
          icon={TrendingUp}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="المبيعات"
          value={s.totalSales}
          icon={ShoppingCart}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="المنتجات"
          value={s.totalProducts}
          icon={Package}
          color="bg-purple-50 text-purple-600"
          sub={s.lowStockProducts > 0 ? `${s.lowStockProducts} منخفض المخزون` : undefined}
        />
        <StatCard
          label="العملاء"
          value={s.totalCustomers}
          icon={Users}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      {s.lowStockProducts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <span>
            تنبيه: <strong>{s.lowStockProducts}</strong> منتجات وصلت إلى الحد الأدنى للمخزون
          </span>
        </div>
      )}

      {s.monthlySales && s.monthlySales.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">المبيعات الشهرية</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={s.monthlySales}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${fmt(v)} ج`, "المبيعات"]} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                fill="url(#grad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">آخر المبيعات</h2>
          <a href="./sales" className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
            عرض الكل <ArrowUpRight size={12} />
          </a>
        </div>
        <div className="divide-y divide-slate-50">
          {s.recentSales.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">لا توجد مبيعات حتى الآن</p>
          )}
          {s.recentSales.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">{sale.invoice_no}</p>
                <p className="text-xs text-slate-400">
                  {sale.customer_name ?? "عميل نقدي"}
                </p>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">
                  {fmt(sale.total_amount)} ج
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    sale.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : sale.status === "partial"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {sale.status === "paid"
                    ? "مدفوع"
                    : sale.status === "partial"
                    ? "جزئي"
                    : "غير مدفوع"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
