import { safeArray } from "@/lib/safe-data";
import { useState, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDeleteExpense, useGetSettingsSafes } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2, ShieldOff, BarChart2, X, Printer, Search, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

interface Expense {
  id: number; category: string; amount: number;
  description: string | null; safe_id: number | null; safe_name: string | null;
  created_at: string;
}
interface ExpenseCategory { id: number; name: string; }
interface ExpenseReportRow { id: number; category: string; amount: number; description: string | null; safe_name: string | null; date: string; }

function AccessDenied({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <ShieldOff className="w-14 h-14 text-red-400/40 mb-4" />
      <p className="text-white/60 font-bold text-lg">غير مصرح</p>
      <p className="text-white/30 text-sm mt-1">{msg}</p>
    </div>
  );
}

/* ─── طباعة تقرير المصروفات ─── */
function printExpenseReport(opts: {
  rows: ExpenseReportRow[];
  category: string;
  dateFrom: string;
  dateTo: string;
  companyName: string;
}) {
  const { rows, category, dateFrom, dateTo, companyName } = opts;
  const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const rowsHtml = rows.map((r, i) => `
    <tr class="${i % 2 === 0 ? "even" : "odd"}">
      <td>${r.date}</td>
      <td>${r.category}</td>
      <td>${r.description ?? "—"}</td>
      <td>${r.safe_name ?? "—"}</td>
      <td class="num amount">${r.amount.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
    <title>تقرير المصروفات</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1a1a2e; background: #fff; padding: 24px; font-size: 13px; }
      .header { text-align: center; margin-bottom: 20px; }
      .company { font-size: 22px; font-weight: 900; color: #1a1a2e; }
      .title { font-size: 16px; font-weight: 700; color: #7c3aed; margin-top: 6px; }
      .meta { display: flex; justify-content: center; gap: 32px; margin: 12px 0 18px; font-size: 12px; color: #555; }
      .meta span { background: #f3f0ff; padding: 4px 12px; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #1a1a2e; color: #fff; padding: 8px 10px; text-align: right; font-size: 12px; font-weight: 600; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; text-align: right; }
      tr.even { background: #fafafa; }
      tr.odd  { background: #fff; }
      .num { text-align: left; font-family: monospace; }
      .amount { font-weight: 700; color: #dc2626; }
      tfoot td { font-weight: 800; background: #f3f0ff; border-top: 2px solid #7c3aed; color: #1a1a2e; }
      .footer { margin-top: 20px; font-size: 11px; color: #888; text-align: center; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="header">
      <div class="company">${companyName}</div>
      <div class="title">تقرير المصروفات</div>
      <div class="meta">
        ${category ? `<span>التصنيف: ${category}</span>` : "<span>كل التصنيفات</span>"}
        ${dateFrom ? `<span>من: ${dateFrom}</span>` : ""}
        ${dateTo   ? `<span>إلى: ${dateTo}</span>`   : ""}
        <span>تاريخ الطباعة: ${today}</span>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>التاريخ</th><th>التصنيف</th><th>التفاصيل</th><th>الخزينة</th><th>المبلغ</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr>
        <td colspan="4">الإجمالي (${rows.length} سجل)</td>
        <td class="num amount">${total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م</td>
      </tr></tfoot>
    </table>
    <div class="footer">نظام Halal Tech ERP — تم الطباعة بتاريخ ${today}</div>
    </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

export default function Expenses() {
  const { user } = useAuth();
  const canView   = hasPermission(user, "can_view_expenses") === true;
  const canAdd    = hasPermission(user, "can_add_expense")   === true;
  const isCashier = user?.role === "cashier";
  const companyName = (user as any)?.company_name ?? "Halal Tech";

  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ─── Queries ─── */
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
    queryFn: () => authFetch(api("/api/expenses")).then(r => { if (!r.ok) throw new Error("خطأ في جلب البيانات"); return r.json(); }),
  });
  const { data: categoriesRaw = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
    queryFn: () => authFetch(api("/api/expense-categories")).then(r => r.ok ? r.json() : []),
    enabled: canView,
  });
  const categories: ExpenseCategory[] = safeArray(categoriesRaw);

  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const deleteMutation = useDeleteExpense();

  /* ─── States ─── */
  const [showAdd, setShowAdd]       = useState(false);
  const [search, setSearch]         = useState("");
  const [formData, setFormData]     = useState({ category: "", amount: "", description: "", safe_id: "" });

  // category inline add
  const [newCatName, setNewCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<number | null>(null);

  // report
  const [showReports, setShowReports]   = useState(false);
  const [reportFilters, setReportFilters] = useState({ category: "", dateFrom: "", dateTo: "" });
  const [reportData, setReportData]     = useState<ExpenseReportRow[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  /* ─── Mutations ─── */
  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch(api("/api/expenses"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "خطأ"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم إضافة المصروف بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-transactions"] });
      setShowAdd(false);
      setFormData({ category: "", amount: "", description: "", safe_id: "" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ─── Category handlers ─── */
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setCatLoading(true);
    try {
      const r = await authFetch(api("/api/expense-categories"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error ?? "خطأ", variant: "destructive" }); return; }
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setNewCatName("");
      setFormData(f => ({ ...f, category: name }));
      toast({ title: `تم إضافة التصنيف "${name}"` });
    } finally { setCatLoading(false); }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await authFetch(api(`/api/expense-categories/${id}`), { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      if (formData.category === categories.find(c => c.id === id)?.name) {
        setFormData(f => ({ ...f, category: "" }));
      }
      toast({ title: "تم حذف التصنيف" });
    } catch {
      toast({ title: "خطأ في الحذف", variant: "destructive" });
    } finally { setConfirmDeleteCatId(null); }
  };

  /* ─── Expense handlers ─── */
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) { toast({ title: "اختر تصنيف المصروف", variant: "destructive" }); return; }
    const body: Record<string, unknown> = { category: formData.category, amount: parseFloat(formData.amount), description: formData.description || undefined };
    if (isCashier && user?.safe_id) {
      body.safe_id = user.safe_id;
    } else if (formData.safe_id) {
      body.safe_id = parseInt(formData.safe_id);
    }
    createMutation.mutate(body);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "تم حذف المصروف بنجاح" });
        queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
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

  /* ─── Report ─── */
  const handleFetchReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportFilters.category) params.set("category", reportFilters.category);
      if (reportFilters.dateFrom) params.set("date_from", reportFilters.dateFrom);
      if (reportFilters.dateTo)   params.set("date_to",   reportFilters.dateTo);
      const r = await authFetch(api(`/api/expense-reports?${params}`));
      if (!r.ok) { const e = await r.json(); toast({ title: e.error ?? "خطأ في التقرير", variant: "destructive" }); return; }
      setReportData(await r.json());
    } finally { setReportLoading(false); }
  };

  /* ─── Filtered list ─── */
  const filtered = safeArray(expenses).filter(e =>
    !search || e.category.includes(search) || (e.description ?? "").includes(search)
  );

  if (!canView) return <AccessDenied msg="غير مصرح لك بالوصول إلى المصروفات — تواصل مع المدير لتفعيل الصلاحية" />;

  return (
    <div className="space-y-6">

      {/* Confirm delete expense */}
      {confirmDeleteId !== null && (
        <ConfirmModal
          title="حذف المصروف"
          description="هل أنت متأكد من حذف هذا المصروف؟ سيتم عكس الحركة من الخزينة."
          isPending={deleteMutation.isPending}
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Confirm delete category */}
      {confirmDeleteCatId !== null && (
        <ConfirmModal
          title="حذف التصنيف"
          description="هل أنت متأكد من حذف هذا التصنيف؟ لن يؤثر على المصروفات المسجلة مسبقاً."
          isPending={false}
          onConfirm={() => handleDeleteCategory(confirmDeleteCatId)}
          onCancel={() => setConfirmDeleteCatId(null)}
        />
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-white flex-shrink-0">إدارة المصروفات</h2>
        <div className="flex-1" />
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className="glass-input pr-9 pl-3 py-2 text-sm max-w-[180px]"
          />
        </div>
        {/* Reports */}
        <button
          onClick={() => { setShowReports(true); setReportData(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 transition-colors">
          <BarChart2 className="w-4 h-4" /> تقارير المصروفات
        </button>
        {/* Add */}
        {canAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
            <Plus className="w-4 h-4" /> إضافة مصروف
          </button>
        )}
      </div>

      {/* ─── Add Modal ─── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay">
          <form onSubmit={handleAdd} className="glass-panel rounded-3xl p-8 w-full max-w-md animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-2xl font-bold text-white">مصروف جديد</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category dropdown with inline add */}
            <div>
              <label className="block text-white/70 text-sm mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-violet-400" /> تصنيف المصروف *
              </label>
              <div className="flex gap-2">
                <select
                  className="glass-input flex-1 appearance-none"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  required>
                  <option value="" className="bg-gray-900">-- اختر التصنيف --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name} className="bg-gray-900">{c.name}</option>
                  ))}
                </select>
                {/* Delete selected category */}
                {formData.category && categories.find(c => c.name === formData.category) && (
                  <button
                    type="button"
                    onClick={() => {
                      const cat = categories.find(c => c.name === formData.category);
                      if (cat) setConfirmDeleteCatId(cat.id);
                    }}
                    className="p-2.5 rounded-xl bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-red-500/20"
                    title="حذف هذا التصنيف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {/* Inline add new category */}
              <div className="flex gap-2 mt-2">
                <input
                  ref={catInputRef}
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                  className="glass-input flex-1 text-sm py-1.5"
                  placeholder="＋ إضافة تصنيف جديد..."
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={catLoading || !newCatName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors border border-violet-500/30 text-sm font-bold disabled:opacity-40">
                  {catLoading ? "..." : "إضافة"}
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-white/70 text-sm mb-1">المبلغ (ج.م) *</label>
              <input required type="number" step="0.01" min="0.01" className="glass-input w-full"
                value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            </div>

            {/* Safe */}
            {isCashier ? (
              <div>
                <label className="block text-white/70 text-sm mb-1">الخزينة</label>
                <div className="glass-input w-full flex items-center gap-2 opacity-70 cursor-not-allowed">
                  <span className="text-amber-300 font-bold text-sm">
                    {safes.find(s => s.id === user?.safe_id)?.name ?? "الخزينة الافتراضية"}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-white/70 text-sm mb-1">الخزينة المدفوع منها</label>
                <select className="glass-input w-full" value={formData.safe_id} onChange={e => setFormData({ ...formData, safe_id: e.target.value })}>
                  <option value="" className="bg-gray-900">-- بدون خزينة --</option>
                  {safes.map(s => <option key={s.id} value={s.id} className="bg-gray-900">{s.name} ({formatCurrency(Number(s.balance))})</option>)}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-white/70 text-sm mb-1">التفاصيل (اختياري)</label>
              <input type="text" className="glass-input w-full"
                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>

            <div className="flex gap-4 pt-2">
              <button type="submit" disabled={createMutation.isPending} className="flex-1 btn-primary py-3 rounded-xl font-bold">
                {createMutation.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Expenses Table ─── */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 font-medium">التصنيف</th>
                <th className="p-4 font-medium">المبلغ</th>
                <th className="p-4 font-medium">الخزينة</th>
                <th className="p-4 font-medium">التفاصيل</th>
                <th className="p-4 font-medium">التاريخ</th>
                <th className="p-4 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={5} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-white/50">{search ? "لا توجد نتائج" : "لا توجد مصروفات"}</td></tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-300 text-xs font-bold border border-orange-500/20">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-red-400">{formatCurrency(exp.amount)}</td>
                    <td className="p-4 text-blue-300 text-sm">{exp.safe_name || "—"}</td>
                    <td className="p-4 text-white/70">{exp.description || "—"}</td>
                    <td className="p-4 text-sm text-white/60">{formatDate(exp.created_at)}</td>
                    <td className="p-4">
                      {canAdd && (
                        <button onClick={() => setConfirmDeleteId(exp.id)} className="btn-icon btn-icon-danger">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Reports Modal ─── */}
      {showReports && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-4 px-4 bg-black/60 backdrop-blur-sm modal-overlay overflow-y-auto">
          <div className="glass-panel rounded-3xl w-full max-w-4xl border border-white/10 flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-bold text-white">تقارير المصروفات</h2>
              </div>
              <button onClick={() => setShowReports(false)} className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/50 text-xs mb-1">التصنيف</label>
                  <select className="glass-input w-full text-sm appearance-none"
                    value={reportFilters.category}
                    onChange={e => setReportFilters(f => ({ ...f, category: e.target.value }))}>
                    <option value="" className="bg-gray-900">كل التصنيفات</option>
                    {categories.map(c => <option key={c.id} value={c.name} className="bg-gray-900">{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1">من تاريخ</label>
                  <input type="date" className="glass-input w-full text-sm"
                    value={reportFilters.dateFrom}
                    onChange={e => setReportFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-white/50 text-xs mb-1">إلى تاريخ</label>
                  <input type="date" className="glass-input w-full text-sm"
                    value={reportFilters.dateTo}
                    onChange={e => setReportFilters(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <button onClick={handleFetchReport} disabled={reportLoading}
                  className="btn-primary px-6 py-2 text-sm flex items-center gap-2">
                  {reportLoading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري التحميل...</>
                    : <><BarChart2 className="w-4 h-4" />عرض التقرير</>}
                </button>
                {reportData && reportData.length > 0 && (
                  <button
                    onClick={() => printExpenseReport({
                      rows: reportData,
                      category: reportFilters.category,
                      dateFrom: reportFilters.dateFrom,
                      dateTo: reportFilters.dateTo,
                      companyName,
                    })}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors">
                    <Printer className="w-4 h-4" /> طباعة
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="overflow-auto max-h-[55vh]">
              {reportData === null ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">اضغط "عرض التقرير" لتحميل البيانات</div>
              ) : reportData.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">لا توجد مصروفات بهذه الفلاتر</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-white/5 text-white/50 text-xs">
                      <th className="px-4 py-2.5 text-right font-semibold">التاريخ</th>
                      <th className="px-4 py-2.5 text-right font-semibold">التصنيف</th>
                      <th className="px-4 py-2.5 text-right font-semibold">التفاصيل</th>
                      <th className="px-4 py-2.5 text-right font-semibold">الخزينة</th>
                      <th className="px-4 py-2.5 text-left font-semibold">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr key={row.id} className={`border-t border-white/5 ${i % 2 === 0 ? "" : "bg-white/2"} hover:bg-white/5 transition-colors`}>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{row.date}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-300 text-xs font-bold border border-orange-500/20">{row.category}</span>
                        </td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{row.description ?? "—"}</td>
                        <td className="px-4 py-2.5 text-blue-300/80 text-xs">{row.safe_name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-left font-mono text-sm font-bold text-red-400">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-white/20 bg-white/5 font-bold text-sm">
                      <td colSpan={4} className="px-4 py-2.5 text-white/60">الإجمالي ({reportData.length} سجل)</td>
                      <td className="px-4 py-2.5 text-left font-mono text-red-400">{formatCurrency(reportData.reduce((s, r) => s + r.amount, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
