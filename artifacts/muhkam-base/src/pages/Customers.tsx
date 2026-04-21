import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  balance: number;
  customer_code: number | null;
  created_at: string;
}

const EMPTY = { name: "", phone: "", balance: 0 };

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [paymentFor, setPaymentFor] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get<Customer[]>("/customers"),
  });

  const createM = useMutation({
    mutationFn: (body: typeof EMPTY) => api.post<Customer>("/customers", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "تم إضافة العميل" }); reset(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof EMPTY }) => api.put<Customer>(`/customers/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "تم تعديل العميل" }); reset(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "تم الحذف" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const receiptM = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      api.post(`/customers/${id}/receipt`, { amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "تم تسجيل الدفعة" }); setPaymentFor(null); setPaymentAmount(""); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const reset = () => { setShowForm(false); setEditing(null); setForm({ ...EMPTY }); };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone ?? "", balance: c.balance });
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateM.mutate({ id: editing.id, body: form });
    else createM.mutate(form);
  };

  const filtered = customers.filter((c) => c.name.includes(search) || (c.phone ?? "").includes(search));

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">العملاء</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ ...EMPTY }); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> إضافة عميل
        </button>
      </div>

      <input
        type="text" placeholder="بحث بالاسم أو الهاتف..."
        value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-slate-800 mb-4">{editing ? "تعديل عميل" : "إضافة عميل جديد"}</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">اسم العميل *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">الهاتف</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">الرصيد الافتتاحي</label>
                <input type="number" step="0.01" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={reset} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
                <button type="submit" disabled={createM.isPending || updateM.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {editing ? "حفظ" : "إضافة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-800 mb-1">تسجيل دفعة</h2>
            <p className="text-sm text-slate-500 mb-4">العميل: <strong>{paymentFor.name}</strong> | الرصيد: {fmt(paymentFor.balance)} ج</p>
            <input
              type="number" min="0.01" step="0.01" placeholder="المبلغ"
              value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setPaymentFor(null); setPaymentAmount(""); }} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
              <button
                onClick={() => receiptM.mutate({ id: paymentFor.id, amount: Number(paymentAmount) })}
                disabled={!paymentAmount || receiptM.isPending}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                تسجيل الدفعة
              </button>
            </div>
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
                <th className="text-right px-4 py-3 font-semibold text-slate-600">العميل</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الهاتف</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الرصيد</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400">لا يوجد عملاء</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    {c.customer_code && <div className="text-xs text-slate-400">كود: {c.customer_code}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${c.balance > 0 ? "text-red-600" : c.balance < 0 ? "text-green-600" : "text-slate-600"}`}>
                      {fmt(Math.abs(c.balance))} ج {c.balance > 0 ? "(مديون)" : c.balance < 0 ? "(دائن)" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setPaymentFor(c)} className="p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600" title="تسجيل دفعة">
                        <CreditCard size={14} />
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => confirm("حذف هذا العميل؟") && deleteM.mutate(c.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
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
