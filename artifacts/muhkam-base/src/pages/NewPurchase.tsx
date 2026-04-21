import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useLocation } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number;
  name: string;
  cost_price: number;
  quantity: number;
}

interface Supplier {
  id: number;
  name: string;
}

interface PurchaseItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

export default function NewPurchase() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<"cash" | "credit" | "partial">("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selProductId, setSelProductId] = useState<number | "">("");
  const [selQty, setSelQty] = useState(1);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products"),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/suppliers"),
  });

  const total = items.reduce((s, i) => s + i.total_price, 0);
  const paid = paymentType === "cash" ? total : paymentType === "credit" ? 0 : Number(paidAmount) || 0;

  const addItem = () => {
    if (!selProductId) return;
    const p = products.find((x) => x.id === selProductId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id
            ? { ...i, quantity: i.quantity + selQty, total_price: (i.quantity + selQty) * i.unit_price }
            : i
        );
      }
      return [
        ...prev,
        { product_id: p.id, product_name: p.name, quantity: selQty, unit_price: p.cost_price, total_price: selQty * p.cost_price },
      ];
    });
    setSelProductId("");
    setSelQty(1);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updatePrice = (idx: number, price: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, unit_price: price, total_price: item.quantity * price } : item
      )
    );
  };

  const createM = useMutation({
    mutationFn: (body: object) => api.post("/purchases", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "تم إنشاء فاتورة الشراء" });
      setLocation("/purchases");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast({ title: "أضف منتجاً على الأقل", variant: "destructive" }); return; }
    createM.mutate({
      supplier_id: supplierId || undefined,
      payment_type: paymentType,
      total_amount: total,
      paid_amount: paid,
      notes: notes || undefined,
      items,
    });
  };

  return (
    <div className="space-y-5 max-w-3xl" dir="rtl">
      <h1 className="text-xl font-bold text-slate-800">فاتورة شراء جديدة</h1>

      <form onSubmit={submit} className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">المورد</label>
            <select
              value={supplierId ?? ""}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— بدون مورد —</option>
              {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">طريقة الدفع *</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as "cash" | "credit" | "partial")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">نقدي</option>
              <option value="credit">آجل</option>
              <option value="partial">دفع جزئي</option>
            </select>
          </div>
          {paymentType === "partial" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">المبلغ المدفوع</label>
              <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">ملاحظات</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">أصناف الفاتورة</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">اختر منتج</label>
              <select
                value={selProductId}
                onChange={(e) => setSelProductId(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— اختر —</option>
                {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-slate-600 mb-1">الكمية</label>
              <input type="number" min="1" value={selQty} onChange={(e) => setSelQty(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="button" onClick={addItem}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">
              <Plus size={14} /> إضافة
            </button>
          </div>

          {items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-right px-3 py-2 text-xs text-slate-600">المنتج</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-600">الكمية</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-600">السعر</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-600">الإجمالي</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-slate-700">{item.product_name}</td>
                    <td className="px-3 py-2 text-slate-600">{item.quantity}</td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="0.01" value={item.unit_price}
                        onChange={(e) => updatePrice(idx, Number(e.target.value))}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm" />
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{fmt(item.total_price)} ج</td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="border-t border-slate-100 pt-3 flex justify-end">
            <div className="text-lg font-bold text-slate-800">
              الإجمالي: {fmt(total)} ج
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => setLocation("/purchases")}
            className="px-5 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
            إلغاء
          </button>
          <button type="submit" disabled={createM.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
            {createM.isPending ? "جاري الحفظ..." : "حفظ الفاتورة"}
          </button>
        </div>
      </form>
    </div>
  );
}
