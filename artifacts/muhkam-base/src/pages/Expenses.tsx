import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Expense {
  id: number;
  category: string;
  description: string | null;
  amount: number;
  date: string | null;
  created_at: string;
}

const EMPTY = { category: "", description: "", amount: 0, date: "" };

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

const CATEGORIES = [
  "إيجار", "كهرباء", "مياه", "رواتب", "نقل", "صيانة", "مواد تشغيل", "أخرى"
];

export default function Expenses() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: () => api.get<Expense[]>("/expenses"),
  });

  const createM = useMutation({
    mutationFn: (body: typeof EMPTY) => api.post("/expenses", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "تم تسجيل المصروف" });
      setShowForm(false);
      setForm({ ...EMPTY });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "تم الحذف" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createM.mutate(form);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">المصروفات</h1>
          {expenses.length > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">الإجمالي: <strong>{fmt(total)} ج</strong></p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> تسجيل مصروف
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-slate-800 mb-4">تسجيل مصروف جديد</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">الفئة *</label>
                <select required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— اختر —</option>
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">الوصف</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">المبلغ *</label>
                  <input type="number" required min="0.01" step="0.01" value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">التاريخ</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setShowForm(false); setForm({ ...EMPTY }); }}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">إلغاء</button>
                <button type="submit" disabled={createM.isPending}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  تسجيل
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
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الفئة</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">الوصف</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">المبلغ</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">التاريخ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">لا توجد مصروفات</td></tr>
              )}
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{exp.description ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">{fmt(exp.amount)} ج</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{exp.date ?? exp.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => confirm("حذف هذا المصروف؟") && deleteM.mutate(exp.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
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
