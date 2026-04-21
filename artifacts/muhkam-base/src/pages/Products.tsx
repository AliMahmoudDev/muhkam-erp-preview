import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  cost_price: number;
  sale_price: number;
  low_stock_threshold: number | null;
  created_at: string;
}

const EMPTY: Omit<Product, "id" | "created_at"> = {
  name: "",
  sku: "",
  category: "",
  quantity: 0,
  cost_price: 0,
  sale_price: 0,
  low_stock_threshold: 5,
};

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

export default function Products() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });

  const createM = useMutation({
    mutationFn: (body: typeof EMPTY) => api.post<Product>("/products", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم إضافة المنتج بنجاح" });
      reset();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof EMPTY }) =>
      api.put<Product>(`/products/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم تعديل المنتج" });
      reset();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم حذف المنتج" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const reset = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY });
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      category: p.category ?? "",
      quantity: p.quantity,
      cost_price: p.cost_price,
      sale_price: p.sale_price,
      low_stock_threshold: p.low_stock_threshold ?? 5,
    });
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form };
    if (editing) updateM.mutate({ id: editing.id, body });
    else createM.mutate(body);
  };

  const filtered = products.filter(
    (p) =>
      p.name.includes(search) ||
      (p.sku ?? "").includes(search) ||
      (p.category ?? "").includes(search)
  );

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">المنتجات</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ ...EMPTY }); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> إضافة منتج
        </button>
      </div>

      <input
        type="text"
        placeholder="بحث في المنتجات..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-base font-bold text-slate-800 mb-4">
              {editing ? "تعديل منتج" : "إضافة منتج جديد"}
            </h2>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">اسم المنتج *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">SKU</label>
                  <input
                    value={form.sku ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">الفئة</label>
                  <input
                    value={form.category ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">الكمية *</label>
                  <input
                    type="number" min="0" required
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">حد المخزون المنخفض</label>
                  <input
                    type="number" min="0"
                    value={form.low_stock_threshold ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">سعر التكلفة *</label>
                  <input
                    type="number" min="0" step="0.01" required
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">سعر البيع *</label>
                  <input
                    type="number" min="0" step="0.01" required
                    value={form.sale_price}
                    onChange={(e) => setForm((f) => ({ ...f, sale_price: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={reset} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createM.isPending || updateM.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {editing ? "حفظ التعديلات" : "إضافة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">المنتج</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الفئة</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الكمية</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">سعر التكلفة</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">سعر البيع</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الربح</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">لا توجد منتجات</td>
                </tr>
              )}
              {filtered.map((p) => {
                const lowStock = p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold;
                const profit = p.sale_price - p.cost_price;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      {p.sku && <div className="text-xs text-slate-400">{p.sku}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-medium ${lowStock ? "text-red-600" : "text-slate-700"}`}>
                        {lowStock && <AlertCircle size={12} />}
                        {fmt(p.quantity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmt(p.cost_price)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(p.sale_price)}</td>
                    <td className="px-4 py-3">
                      <span className={profit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {fmt(profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => confirm("حذف هذا المنتج؟") && deleteM.mutate(p.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
