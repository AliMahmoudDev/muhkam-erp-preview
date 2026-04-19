import { safeArray } from "@/lib/safe-data";
import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeftRight, Plus, ArrowRight, X, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

interface Transfer {
  id: number;
  from_safe_id: number | null;
  from_safe_name: string | null;
  to_safe_id: number | null;
  to_safe_name: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

export default function SafeTransfers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);

  const { data: transfers = [], isLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/safe-transfers"],
    queryFn: () => authFetch(api("/api/safe-transfers")).then(r => { if (!r.ok) throw new Error("خطأ في جلب البيانات"); return r.json(); }),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState({ from_safe_id: "", to_safe_id: "", amount: "", notes: "", date: new Date().toISOString().split("T")[0] });

  const fromSafe = safes.find(s => String(s.id) === form.from_safe_id);
  const toSafe   = safes.find(s => String(s.id) === form.to_safe_id);
  const amt = parseFloat(form.amount) || 0;
  const balanceAfter = fromSafe ? Number(fromSafe.balance) - amt : null;
  const balanceInsufficient = balanceAfter !== null && balanceAfter < 0;

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await authFetch(api("/api/safe-transfers"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "خطأ"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم التحويل بنجاح" });
      qc.invalidateQueries({ queryKey: ["/api/safe-transfers"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      setShowAdd(false);
      setForm({ from_safe_id: "", to_safe_id: "", amount: "", notes: "", date: new Date().toISOString().split("T")[0] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.from_safe_id || !form.to_safe_id || !form.amount) { toast({ title: "الرجاء ملء جميع الحقول المطلوبة", variant: "destructive" }); return; }
    if (form.from_safe_id === form.to_safe_id) { toast({ title: "لا يمكن التحويل من وإلى نفس الخزينة", variant: "destructive" }); return; }
    if (balanceInsufficient) { toast({ title: "الرصيد غير كافٍ في خزينة المصدر", variant: "destructive" }); return; }
    createMutation.mutate({ from_safe_id: parseInt(form.from_safe_id), to_safe_id: parseInt(form.to_safe_id), amount: parseFloat(form.amount), notes: form.notes || undefined, date: form.date });
  };

  const totalTransferred = transfers.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      {confirmId !== null && (
        <ConfirmModal
          title="تأكيد حذف التحويل"
          description="هذه العملية ستعكس مبلغ التحويل — هل أنت متأكد؟"
          isPending={false}
          onConfirm={() => setConfirmId(null)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-bold text-white">التحويل بين الخزائن</h2>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl">
          <Plus className="w-4 h-4" /> تحويل جديد
        </button>
      </div>

      {/* Safes Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {safes.map(s => (
          <div key={s.id} className="glass-panel rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-white/30" />
              <p className="text-white/50 text-xs">{s.name}</p>
            </div>
            <p className="text-xl font-black text-amber-400">{formatCurrency(Number(s.balance))}</p>
            <p className="text-white/30 text-xs mt-0.5">ج.م</p>
          </div>
        ))}
      </div>

      {/* Totals strip */}
      {transfers.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 flex justify-between items-center border border-purple-500/10">
          <span className="text-purple-400 font-bold text-lg">{formatCurrency(totalTransferred)} ج.م</span>
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <ArrowLeftRight className="w-4 h-4" />
            <span>إجمالي {transfers.length} تحويل</span>
          </div>
        </div>
      )}

      {/* Transfers Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h3 className="text-white/70 font-medium text-sm">سجل التحويلات</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap">
            <thead className="border-b border-white/10">
              <tr>
                <th className="p-4 font-medium text-sm text-white/50">من</th>
                <th className="p-4 font-medium text-sm text-white/50 text-center">←</th>
                <th className="p-4 font-medium text-sm text-white/50">إلى</th>
                <th className="p-4 font-medium text-sm text-white/50">المبلغ</th>
                <th className="p-4 font-medium text-sm text-white/50">ملاحظات</th>
                <th className="p-4 font-medium text-sm text-white/50">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={5} />
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <ArrowLeftRight className="w-10 h-10 text-white/10 mx-auto mb-3" />
                    <div className="text-white/40">لا توجد تحويلات بعد</div>
                    <div className="text-white/20 text-sm mt-1">اضغط «تحويل جديد» لنقل مبلغ بين الخزائن</div>
                  </td>
                </tr>
              ) : transfers.map(t => (
                <tr key={t.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-300 border border-red-500/20 font-bold">
                      {t.from_safe_name || '—'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <ArrowRight className="w-4 h-4 text-white/30 inline" />
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                      {t.to_safe_name || '—'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-purple-300">{formatCurrency(t.amount)}</td>
                  <td className="p-4 text-white/50 text-sm max-w-xs truncate">{t.notes || '—'}</td>
                  <td className="p-4 text-sm text-white/40">{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Transfer Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
          <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-8 w-full max-w-md space-y-4 modal-panel">
            <div className="flex items-center justify-between mb-1">
              <button type="button" onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-white/40 hover:text-white/70" /></button>
              <h3 className="text-xl font-bold text-white">تحويل بين الخزائن</h3>
            </div>

            {/* From → To visual */}
            {(fromSafe || toSafe) && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex-1 text-center">
                  <div className="text-xs text-white/40 mb-1">من</div>
                  <div className="font-bold text-red-300 text-sm">{fromSafe?.name || '...'}</div>
                  {fromSafe && <div className="text-xs text-white/40 mt-0.5">{formatCurrency(Number(fromSafe.balance))}</div>}
                </div>
                <ArrowRight className="w-5 h-5 text-white/30 flex-shrink-0" />
                <div className="flex-1 text-center">
                  <div className="text-xs text-white/40 mb-1">إلى</div>
                  <div className="font-bold text-emerald-300 text-sm">{toSafe?.name || '...'}</div>
                  {toSafe && <div className="text-xs text-white/40 mt-0.5">{formatCurrency(Number(toSafe.balance))}</div>}
                </div>
              </div>
            )}

            <div>
              <label className="text-white/60 text-sm block mb-1">من الخزينة *</label>
              <select required className="glass-input w-full" value={form.from_safe_id} onChange={e => setForm(f => ({ ...f, from_safe_id: e.target.value }))}>
                <option value="">-- اختر --</option>
                {safes.map(s => <option key={s.id} value={s.id}>{s.name} ({formatCurrency(Number(s.balance))})</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">إلى الخزينة *</label>
              <select required className="glass-input w-full" value={form.to_safe_id} onChange={e => setForm(f => ({ ...f, to_safe_id: e.target.value }))}>
                <option value="">-- اختر --</option>
                {safes.filter(s => String(s.id) !== form.from_safe_id).map(s => <option key={s.id} value={s.id}>{s.name} ({formatCurrency(Number(s.balance))})</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">المبلغ (ج.م) *</label>
              <input required type="number" step="0.01" min="0.01" className={`glass-input w-full ${balanceInsufficient ? 'border-red-500/50' : ''}`} placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              {fromSafe && amt > 0 && (
                <div className={`text-xs mt-1 ${balanceInsufficient ? 'text-red-400' : 'text-white/40'}`}>
                  الرصيد بعد التحويل: {formatCurrency(Number(fromSafe.balance) - amt)}
                  {balanceInsufficient && ' — الرصيد غير كافٍ ⚠️'}
                </div>
              )}
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">التاريخ</label>
              <input type="date" className="glass-input w-full" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-1">ملاحظات</label>
              <input type="text" className="glass-input w-full" placeholder="اختياري" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={createMutation.isPending || balanceInsufficient || !form.from_safe_id || !form.to_safe_id} className="flex-1 btn-primary py-3 rounded-xl font-bold disabled:opacity-50">
                {createMutation.isPending ? "جاري التحويل..." : "✓ تنفيذ التحويل"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
