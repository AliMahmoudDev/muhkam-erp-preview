import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Plus, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { formatCurrency } from "@/lib/format";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

interface BadDebt {
  id: number;
  customer_id?: number; customer_name: string;
  amount: string;
  reason?: string;
  source_invoice_id?: number; source_repair_job_id?: number;
  status: "open" | "written_off" | "recovered";
  notes?: string;
  created_at: string;
}

/**
 * BadDebts panel — can be rendered either as a full page
 * or embedded inside another page (e.g., the Expenses tabs).
 * When `embedded` is true the page-level header is hidden so the host
 * page can provide its own header / "Add" button.
 */
export default function BadDebts({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "written_off" | "recovered">("all");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newReason, setNewReason] = useState("");

  // Allow a parent page to trigger the "add" modal from its own button
  useEffect(() => {
    if (!embedded) return;
    const w = window as unknown as { __openBadDebtForm?: () => void };
    w.__openBadDebtForm = () => setShowNew(true);
    return () => { delete w.__openBadDebtForm; };
  }, [embedded]);

  const { data: items = [], isLoading } = useQuery<BadDebt[]>({
    queryKey: ["/api/bad-debts", filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/bad-debts" : `/api/bad-debts?status=${filter}`;
      const r = await authFetch(api(url));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const addM = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      authFetch(api("/api/bad-debts"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bad-debts"] });
      setShowNew(false); setNewName(""); setNewAmount(""); setNewReason("");
      toast({ title: "✅ أُضيف الدين" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateM = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      authFetch(api(`/api/bad-debts/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
        .then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/bad-debts"] }); toast({ title: "✅ تم التحديث" }); },
  });

  const open = items.filter(i => i.status === "open").reduce((s, i) => s + Number(i.amount), 0);
  const recovered = items.filter(i => i.status === "recovered").reduce((s, i) => s + Number(i.amount), 0);
  const writtenOff = items.filter(i => i.status === "written_off").reduce((s, i) => s + Number(i.amount), 0);

  const statusColor: Record<string, string> = { open: "text-amber-400 bg-amber-500/10 border-amber-500/30", written_off: "text-red-400 bg-red-500/10 border-red-500/30", recovered: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  const statusLabel: Record<string, string> = { open: "متعثر", written_off: "مشطوب", recovered: "مُسترد" };

  return (
    <div className={embedded ? "space-y-4" : "p-4 space-y-4 h-full overflow-y-auto"} dir="rtl">
      {!embedded && (
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-400" /> الديون المعدومة / المتعثرة
          </h1>
          <button onClick={() => setShowNew(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
            <Plus className="w-4 h-4" /> إضافة دين
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel rounded-xl p-3 border border-amber-500/20">
          <p className="text-[11px] text-white/40">متعثر (غير مسدد)</p>
          <p className="text-xl font-black text-amber-400">{formatCurrency(open)}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 border border-red-500/20">
          <p className="text-[11px] text-white/40">مشطوب</p>
          <p className="text-xl font-black text-red-400">{formatCurrency(writtenOff)}</p>
        </div>
        <div className="glass-panel rounded-xl p-3 border border-emerald-500/20">
          <p className="text-[11px] text-white/40">مُسترد</p>
          <p className="text-xl font-black text-emerald-400">{formatCurrency(recovered)}</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {(["all", "open", "written_off", "recovered"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${filter === f ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/10 text-white/40"}`}>
            {f === "all" ? "الكل" : statusLabel[f]}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {isLoading && <div className="text-center text-white/40 py-8">جاري التحميل...</div>}
        {!isLoading && items.length === 0 && (
          <div className="text-center text-white/40 py-12 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-10 h-10 opacity-20 text-emerald-400" />لا توجد ديون متعثرة
          </div>
        )}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/3">
              <tr className="text-right text-[11px] text-white/50">
                <th className="px-3 py-2">العميل</th>
                <th className="px-3 py-2">المبلغ</th>
                <th className="px-3 py-2">السبب</th>
                <th className="px-3 py-2">المصدر</th>
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id} className="border-b border-white/5 text-white/80">
                  <td className="px-3 py-2 font-bold">{d.customer_name}</td>
                  <td className="px-3 py-2 font-black text-red-400">{formatCurrency(Number(d.amount))}</td>
                  <td className="px-3 py-2 text-xs text-white/50">{d.reason ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-white/50">
                    {d.source_invoice_id && <span className="text-blue-300">فاتورة #{d.source_invoice_id}</span>}
                    {d.source_repair_job_id && <span className="text-violet-300">صيانة #{d.source_repair_job_id}</span>}
                    {!d.source_invoice_id && !d.source_repair_job_id && "يدوي"}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/40">{new Date(d.created_at).toLocaleDateString("ar-EG")}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor[d.status]}`}>{statusLabel[d.status]}</span>
                  </td>
                  <td className="px-3 py-2">
                    {d.status === "open" && (
                      <div className="flex gap-1">
                        <button onClick={() => updateM.mutate({ id: d.id, status: "recovered" })}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">استرداد</button>
                        <button onClick={() => updateM.mutate({ id: d.id, status: "written_off" })}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300">شطب</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="glass-panel rounded-2xl p-5 w-96 border border-white/10 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> إضافة دين</h3>
              <button onClick={() => setShowNew(false)} className="btn-icon text-white/40"><XCircle className="w-4 h-4" /></button>
            </div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم العميل *" className="erp-input w-full text-sm" />
            <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="المبلغ *" className="erp-input w-full text-sm" />
            <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="السبب" className="erp-input w-full text-sm" />
            <button onClick={() => {
              if (!newName.trim() || !newAmount) { toast({ title: "الاسم والمبلغ مطلوبان", variant: "destructive" }); return; }
              addM.mutate({ customer_name: newName, amount: newAmount, reason: newReason, status: "open" });
            }} className="w-full py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 font-bold text-sm">حفظ</button>
          </div>
        </div>
      )}
    </div>
  );
}
