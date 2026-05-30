import { safeArray } from "@/lib/safe-data";
import { useState, useMemo } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2, Search, X, TrendingUp, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";
import { api } from '@/lib/api';


interface Income {
  id: number; source: string; amount: number;
  description: string | null; safe_id: number | null; safe_name: string | null;
  created_at: string;
}

const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

/* ── Detail Modal ── */
function IncomeDetailModal({ item, onClose }: { item: Income; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl w-full max-w-md border border-white/10 animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="font-bold text-white text-lg">تفاصيل الإيراد</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Row label="المصدر" value={item.source} valueClass="text-white font-bold text-base" />
          <Row label="المبلغ" value={formatCurrency(item.amount)} valueClass="text-emerald-400 font-black text-xl" />
          <Row label="الخزينة" value={item.safe_name ?? '—'} valueClass={item.safe_name ? "text-blue-300 font-bold" : "text-white/30"} />
          <Row label="التفاصيل" value={item.description || '—'} valueClass={item.description ? "text-white/80" : "text-white/30"} />
          <Row label="التاريخ والوقت" value={formatDate(item.created_at)} valueClass="text-white/60" />
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 font-bold transition-colors text-sm"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/40 text-sm shrink-0">{label}</span>
      <span className={`text-sm text-right ${valueClass ?? 'text-white/80'}`}>{value}</span>
    </div>
  );
}

export default function Income() {
  const { data: incomeList = [], isLoading } = useQuery<Income[]>({
    queryKey: ["/api/income"],
    queryFn: () => authFetch(api("/api/income")).then(r => { if (!r.ok) throw new Error("خطأ في جلب البيانات"); return r.json(); }),
  });
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const r = await authFetch(api(`/api/income/${id}`), { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ source: "", amount: "", description: "", safe_id: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [detailItem, setDetailItem] = useState<Income | null>(null);

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    incomeList.forEach(inc => {
      const d = new Date(inc.created_at);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort().reverse();
  }, [incomeList]);

  const totalAll   = incomeList.reduce((s, i) => s + i.amount, 0);
  const totalMonth = incomeList
    .filter(i => new Date(i.created_at).toISOString().slice(0,7) === thisMonthKey)
    .reduce((s, i) => s + i.amount, 0);

  const filtered = useMemo(() => {
    return incomeList.filter(inc => {
      const matchSearch = !search || inc.source.includes(search) || (inc.description || "").includes(search) || (inc.safe_name || "").includes(search);
      const matchMonth = monthFilter === "all" || new Date(inc.created_at).toISOString().slice(0,7) === monthFilter;
      return matchSearch && matchMonth;
    });
  }, [incomeList, search, monthFilter]);

  const filteredTotal = filtered.reduce((s, i) => s + i.amount, 0);

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch(api("/api/income"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "خطأ"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إضافة الإيراد بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-transactions"] });
      setShowAdd(false);
      setFormData({ source: "", amount: "", description: "", safe_id: "" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { source: formData.source, amount: parseFloat(formData.amount), description: formData.description || undefined };
    if (formData.safe_id) body.safe_id = parseInt(formData.safe_id);
    createMutation.mutate(body);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "تم حذف الإيراد بنجاح" });
        queryClient.invalidateQueries({ queryKey: ["/api/income"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings/safes"] });
        setConfirmDeleteId(null);
      },
      onError: (e: Error) => {
        toast({ title: e.message, variant: "destructive" });
        setConfirmDeleteId(null);
      },
    });
  };

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    return `${ARABIC_MONTHS[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="space-y-5">
      {confirmDeleteId !== null && (
        <ConfirmModal
          title="حذف الإيراد"
          description="هل أنت متأكد من حذف هذا الإيراد؟ سيتم عكس الحركة من الخزينة."
          isPending={deleteMutation.isPending}
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {detailItem && <IncomeDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">إدارة الإيرادات الإضافية</h2>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold">
          <Plus className="w-5 h-5" /> إضافة إيراد
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "الإجمالي الكلي",   value: formatCurrency(totalAll),   color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "هذا الشهر",        value: formatCurrency(totalMonth),  color: "text-amber-400",   bg: "bg-amber-400/10   border-amber-400/20"   },
          { label: "عدد السجلات",      value: String(incomeList.length),   color: "text-blue-400",    bg: "bg-blue-400/10    border-blue-400/20"     },
        ].map(s => (
          <div key={s.label} className={`glass-panel rounded-2xl p-4 border ${s.bg} flex items-center gap-4`}>
            <TrendingUp className={`w-8 h-8 flex-shrink-0 ${s.color} opacity-60`} />
            <div>
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-white/50 text-xs mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Month Filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالمصدر أو التفاصيل أو الخزينة..."
            className="glass-input w-full icon-pr text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-white/40 hover:text-white/70" />
            </button>
          )}
        </div>
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="glass-input text-sm w-44"
        >
          <option value="all">كل الأشهر</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        {(search || monthFilter !== "all") && filtered.length > 0 && (
          <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <span className="text-white/50 text-sm">{filtered.length} نتيجة</span>
            <span className="text-emerald-400 font-bold text-sm">{formatCurrency(filteredTotal)} ج.م</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-medium">المصدر</th>
                <th className="p-4 font-medium">المبلغ</th>
                <th className="p-4 font-medium">الخزينة</th>
                <th className="p-4 font-medium">التفاصيل</th>
                <th className="p-4 font-medium">التاريخ</th>
                <th className="p-4 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <TrendingUp className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40 font-medium">
                      {search || monthFilter !== "all" ? "لا توجد نتائج للبحث" : "لا توجد إيرادات بعد"}
                    </div>
                    {!search && monthFilter === "all" && (
                      <div className="text-white/25 text-sm mt-1">اضغط «إضافة إيراد» لتسجيل أول إيراد</div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(inc => (
                  <tr key={inc.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-4 font-bold text-white">{inc.source}</td>
                    <td className="p-4 font-bold text-emerald-400">{formatCurrency(inc.amount)}</td>
                    <td className="p-4">
                      {inc.safe_name
                        ? <span className="px-2 py-1 rounded-lg text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">{inc.safe_name}</span>
                        : <span className="text-white/30">—</span>}
                    </td>
                    <td className="p-4 text-white/60 text-sm max-w-xs truncate">{inc.description || '—'}</td>
                    <td className="p-4 text-sm text-white/50">{formatDate(inc.created_at)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setDetailItem(inc)}
                          className="btn-icon"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4 text-emerald-400" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(inc.id)} className="btn-icon btn-icon-danger">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
          <form onSubmit={handleAdd} className="glass-panel rounded-3xl p-8 w-full max-w-md animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white/70">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-2xl font-bold text-white">إيراد جديد</h3>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">المصدر (مثال: عمولة، استثمار) *</label>
              <input required type="text" className="glass-input w-full" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} placeholder="عمولة / استثمار / أخرى..." />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">المبلغ (ج.م) *</label>
              <input required type="number" step="0.01" min="0.01" className="glass-input w-full" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">الخزينة المستلِمة</label>
              <select className="glass-input w-full" value={formData.safe_id} onChange={e => setFormData({...formData, safe_id: e.target.value})}>
                <option value="">-- بدون خزينة --</option>
                {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">التفاصيل (اختياري)</label>
              <input type="text" className="glass-input w-full" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="flex gap-4 pt-2">
              <button type="submit" disabled={createMutation.isPending} className="flex-1 btn-primary py-3 rounded-xl font-bold">
                {createMutation.isPending ? "جاري الحفظ..." : "✓ حفظ الإيراد"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
