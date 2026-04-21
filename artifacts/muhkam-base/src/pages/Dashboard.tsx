import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Users,
  Truck,
  AlertTriangle,
} from "lucide-react";

interface DashboardStats {
  total_sales_today: number;
  total_expenses_today: number;
  total_income_today: number;
  net_profit: number;
  total_customer_debts: number;
  total_supplier_debts: number;
  low_stock_products: Array<{
    id: number;
    name: string;
    sku: string | null;
    quantity: number;
    low_stock_threshold: number | null;
    sale_price: number;
    cost_price: number;
  }>;
  recent_transactions: Array<{
    id: number;
    type: string;
    amount: number;
    description: string | null;
    created_at: string;
  }>;
}

interface Product { id: number }
interface Customer { id: number }
interface Supplier { id: number }

function fmt(n: number | undefined | null) {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString("ar-EG", { minimumFractionDigits: 0 });
}

function StatCard({
  label,
  value,
  icon: Icon,
  colorBg,
  colorText,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorBg: string;
  colorText: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <span className={`p-2 rounded-lg ${colorBg}`}>
          <Icon size={18} className={colorText} />
        </span>
      </div>
      <p className={`text-2xl font-bold ${colorText}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const txTypeLabel: Record<string, string> = {
  sale: "بيع", purchase: "شراء", expense: "مصروف", income: "إيراد",
  receipt: "سند قبض", payment: "سند صرف", sale_return: "مرتجع بيع",
  purchase_return: "مرتجع شراء", sale_cash: "بيع نقدي", sale_credit: "بيع آجل",
  receipt_voucher: "قبض", payment_voucher: "صرف", supplier_payment: "دفع مورد",
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/customers"),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/suppliers"),
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-48" dir="rtl">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats ?? {
    total_sales_today: 0,
    total_expenses_today: 0,
    total_income_today: 0,
    net_profit: 0,
    total_customer_debts: 0,
    total_supplier_debts: 0,
    low_stock_products: [],
    recent_transactions: [],
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">لوحة التحكم</h1>
        <p className="text-slate-500 text-sm mt-0.5">ملخص اليوم</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="مبيعات اليوم"
          value={`${fmt(s.total_sales_today)} ج`}
          icon={ShoppingCart}
          colorBg="bg-blue-50"
          colorText="text-blue-600"
        />
        <StatCard
          label="صافي الربح"
          value={`${fmt(s.net_profit)} ج`}
          icon={s.net_profit >= 0 ? TrendingUp : TrendingDown}
          colorBg={s.net_profit >= 0 ? "bg-green-50" : "bg-red-50"}
          colorText={s.net_profit >= 0 ? "text-green-600" : "text-red-600"}
          sub={`مصاريف: ${fmt(s.total_expenses_today)} ج`}
        />
        <StatCard
          label="المنتجات"
          value={String(products.length)}
          icon={Package}
          colorBg="bg-purple-50"
          colorText="text-purple-600"
          sub={s.low_stock_products.length > 0 ? `${s.low_stock_products.length} منخفض المخزون` : undefined}
        />
        <StatCard
          label="العملاء / الموردون"
          value={`${customers.length} / ${suppliers.length}`}
          icon={Users}
          colorBg="bg-orange-50"
          colorText="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-700">ديون العملاء</h2>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(s.total_customer_debts)} ج</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={16} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-slate-700">مستحقات الموردين</h2>
          </div>
          <p className="text-2xl font-bold text-orange-600">{fmt(s.total_supplier_debts)} ج</p>
        </div>
      </div>

      {s.low_stock_products.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <span>
            تنبيه: <strong>{s.low_stock_products.length}</strong> منتجات وصلت للحد الأدنى —{" "}
            {s.low_stock_products.slice(0, 3).map(p => p.name).join("، ")}
            {s.low_stock_products.length > 3 ? "..." : ""}
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">آخر الحركات المالية</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {s.recent_transactions.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">لا توجد حركات حتى الآن</p>
          )}
          {s.recent_transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {txTypeLabel[tx.type] ?? tx.type}
                </p>
                <p className="text-xs text-slate-400">
                  {tx.description ?? "—"}
                </p>
              </div>
              <div className="text-left">
                <p className={`text-sm font-semibold ${
                  ["expense", "payment", "payment_voucher", "supplier_payment"].includes(tx.type)
                    ? "text-red-600" : "text-green-700"
                }`}>
                  {fmt(tx.amount)} ج
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(tx.created_at).toLocaleDateString("ar-EG")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
