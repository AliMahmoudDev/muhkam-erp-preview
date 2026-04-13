import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type AnyRec = Record<string, unknown>;
function fmt(v: unknown) { return v != null ? Number(Number(v).toFixed(2)).toLocaleString("ar-EG") : "0"; }

function statusColor(s: string) {
  switch (s) {
    case "approved": case "active": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "pending":  return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "completed":return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "cancelled":return "bg-white/10 text-white/40 border-white/20";
    default:         return "bg-white/10 text-white/40 border-white/20";
  }
}
function statusAr(s: string) {
  const m: Record<string,string> = { pending:"معلّق", approved:"معتمد", active:"نشط (جاري السداد)", rejected:"مرفوض", completed:"مكتمل", cancelled:"ملغي" };
  return m[s] ?? s;
}
function typeAr(t: string) {
  const m: Record<string,string> = { emergency:"طارئ", personal:"شخصي", medical:"علاجي", educational:"تعليمي", other:"أخرى" };
  return m[t] ?? t;
}

export default function SalaryAdvances() {
  const { user, authFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_payroll");

  const [activeTab, setActiveTab] = useState("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [ledgerEmpId, setLedgerEmpId] = useState("");
  const [requestForm, setRequestForm] = useState({ employee_id: "", requested_amount: "", advance_type: "personal", reason: "" });
  const [settingsForm, setSettingsForm] = useState({ max_advance_percentage: "50", max_concurrent_advances: "2", min_salary_for_advance: "3000", repayment_tenure_months: "1" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, [authFetch]);

  const listParams = new URLSearchParams();
  if (statusFilter) listParams.set("status", statusFilter);

  const advances  = useQuery({ queryKey: ["salary-advances", statusFilter], queryFn: () => f(`/api/salary-advances?${listParams}`) });
  const pending   = useQuery({ queryKey: ["salary-advances-pending"], queryFn: () => f("/api/salary-advances/pending-approvals"), enabled: canManage });
  const settings  = useQuery({ queryKey: ["salary-advance-settings"], queryFn: () => f("/api/salary-advances/settings") });
  const ledger    = useQuery({ queryKey: ["salary-advance-ledger", ledgerEmpId], queryFn: () => f(`/api/salary-advances/${ledgerEmpId}/ledger`), enabled: Boolean(ledgerEmpId) });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createAdvance = useMutation({ mutationFn: (d: AnyRec) => f("/api/salary-advances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["salary-advances", statusFilter], "تم تقديم طلب السلفة") });
  const approveAdv = useMutation({ mutationFn: (id: number) => f(`/api/salary-advances/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } }), ...mutOpts(["salary-advances-pending", `salary-advances,${statusFilter}`], "تم اعتماد السلفة") });
  const rejectAdv  = useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => f(`/api/salary-advances/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }), ...mutOpts(["salary-advances-pending", `salary-advances,${statusFilter}`], "تم رفض السلفة") });
  const cancelAdv  = useMutation({ mutationFn: (id: number) => f(`/api/salary-advances/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" } }), ...mutOpts(["salary-advances", statusFilter], "تم إلغاء السلفة") });
  const manualPay  = useMutation({ mutationFn: ({ id, amount }: { id: number; amount: number }) => f(`/api/salary-advances/${id}/manual-payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) }), ...mutOpts(["salary-advances", statusFilter], "تم تسجيل الدفعة") });
  const updateSettings = useMutation({ mutationFn: (d: AnyRec) => f("/api/salary-advances/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("salary-advance-settings", "تم تحديث الإعدادات") });

  const safeArr = (v: unknown) => (Array.isArray(v) ? v : []) as AnyRec[];
  const advancesList  = safeArr(advances.data);
  const pendingList   = safeArr(pending.data);
  const ledgerList    = safeArr(ledger.data);
  const cfg = settings.data as AnyRec | undefined;

  const totalOutstanding = advancesList.filter(a => ["active", "approved"].includes(String(a.status))).reduce((s, a) => s + Number(a.remaining_balance), 0);

  function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    createAdvance.mutate(requestForm, { onSuccess: () => { setShowRequestForm(false); setRequestForm({ employee_id: "", requested_amount: "", advance_type: "personal", reason: "" }); } });
  }
  function submitSettings(e: React.FormEvent) {
    e.preventDefault();
    updateSettings.mutate({ max_advance_percentage: Number(settingsForm.max_advance_percentage), max_concurrent_advances: Number(settingsForm.max_concurrent_advances), min_salary_for_advance: Number(settingsForm.min_salary_for_advance), repayment_tenure_months: Number(settingsForm.repayment_tenure_months) }, { onSuccess: () => setShowSettingsForm(false) });
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">السلف على الراتب</h1>
        <div className="flex gap-2">
          {canManage && <Button size="sm" variant="outline" onClick={() => { setSettingsForm({ max_advance_percentage: String(cfg?.max_advance_percentage ?? 50), max_concurrent_advances: String(cfg?.max_concurrent_advances ?? 2), min_salary_for_advance: String(cfg?.min_salary_for_advance ?? 3000), repayment_tenure_months: String(cfg?.repayment_tenure_months ?? 1) }); setShowSettingsForm(true); }} className="border-white/20 text-white/60 text-xs">⚙ الإعدادات</Button>}
          <Button onClick={() => setShowRequestForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ طلب سلفة</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي السلف", val: advancesList.length, color: "text-white" },
          { label: "معلّقة", val: advancesList.filter(a => a.status === "pending").length, color: "text-amber-400" },
          { label: "نشطة", val: advancesList.filter(a => a.status === "active").length, color: "text-emerald-400" },
          { label: "إجمالي الرصيد المتبقي", val: `${fmt(totalOutstanding)} ج.م`, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Request Form */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitRequest} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">طلب سلفة على الراتب</h2>
            {cfg && <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">الحد الأقصى: {Number(cfg.max_advance_percentage)}% من الراتب • الحد الأدنى للراتب: {fmt(cfg.min_salary_for_advance)} ج.م</div>}
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="رقم الموظف *" value={requestForm.employee_id} onChange={e => setRequestForm(p => ({ ...p, employee_id: e.target.value }))} required />
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="المبلغ المطلوب *" value={requestForm.requested_amount} onChange={e => setRequestForm(p => ({ ...p, requested_amount: e.target.value }))} required />
            <select className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-right" value={requestForm.advance_type} onChange={e => setRequestForm(p => ({ ...p, advance_type: e.target.value }))}>
              {[["personal","شخصي"],["emergency","طارئ"],["medical","علاجي"],["educational","تعليمي"],["other","أخرى"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="السبب *" value={requestForm.reason} onChange={e => setRequestForm(p => ({ ...p, reason: e.target.value }))} required />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={createAdvance.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createAdvance.isPending ? "جاري..." : "تقديم"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Settings Form */}
      {showSettingsForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitSettings} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">إعدادات السلف</h2>
            <div><label className="text-xs text-white/50 mb-1 block">الحد الأقصى من الراتب (%)</label><Input type="number" className="bg-white/5 border-white/10 text-white" value={settingsForm.max_advance_percentage} onChange={e => setSettingsForm(p => ({ ...p, max_advance_percentage: e.target.value }))} /></div>
            <div><label className="text-xs text-white/50 mb-1 block">الحد الأقصى للسلف المتزامنة</label><Input type="number" className="bg-white/5 border-white/10 text-white" value={settingsForm.max_concurrent_advances} onChange={e => setSettingsForm(p => ({ ...p, max_concurrent_advances: e.target.value }))} /></div>
            <div><label className="text-xs text-white/50 mb-1 block">الحد الأدنى للراتب للأهلية (ج.م)</label><Input type="number" className="bg-white/5 border-white/10 text-white" value={settingsForm.min_salary_for_advance} onChange={e => setSettingsForm(p => ({ ...p, min_salary_for_advance: e.target.value }))} /></div>
            <div><label className="text-xs text-white/50 mb-1 block">مدة السداد (شهور)</label><Input type="number" className="bg-white/5 border-white/10 text-white" value={settingsForm.repayment_tenure_months} onChange={e => setSettingsForm(p => ({ ...p, repayment_tenure_months: e.target.value }))} /></div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowSettingsForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={updateSettings.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{updateSettings.isPending ? "جاري..." : "حفظ"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId != null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-white">رفض طلب السلفة</h2>
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="سبب الرفض *" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }} className="border-white/20 text-white">إلغاء</Button>
              <Button onClick={() => { rejectAdv.mutate({ id: rejectId, reason: rejectReason }, { onSuccess: () => { setRejectId(null); setRejectReason(""); } }); }} disabled={!rejectReason.trim() || rejectAdv.isPending} className="bg-red-500 hover:bg-red-600 text-white font-bold">{rejectAdv.isPending ? "جاري..." : "رفض"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showPaymentModal != null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-white">تسجيل دفعة يدوية</h2>
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="المبلغ *" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setShowPaymentModal(null); setPaymentAmount(""); }} className="border-white/20 text-white">إلغاء</Button>
              <Button onClick={() => { manualPay.mutate({ id: showPaymentModal, amount: Number(paymentAmount) }, { onSuccess: () => { setShowPaymentModal(null); setPaymentAmount(""); } }); }} disabled={!paymentAmount || Number(paymentAmount) <= 0 || manualPay.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold">{manualPay.isPending ? "جاري..." : "تسجيل"}</Button>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="list"    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">السلف</TabsTrigger>
          {canManage && <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">طلبات الاعتماد {pendingList.length > 0 && <span className="mr-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">{pendingList.length}</span>}</TabsTrigger>}
          <TabsTrigger value="ledger"  className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">دفتر الأستاذ</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["", "pending", "active", "approved", "completed", "rejected"].map(s => (
              <Button key={s} size="sm" onClick={() => setStatusFilter(s)} className={`text-xs ${statusFilter === s ? "bg-amber-500 text-black" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}`}>
                {s === "" ? "الكل" : statusAr(s)}
              </Button>
            ))}
          </div>
          {advances.isLoading ? (
            <div className="text-center py-12 text-white/40">جاري التحميل...</div>
          ) : advancesList.length === 0 ? (
            <div className="text-center py-12 text-white/40">لا توجد سلف</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/10">
                  <th className="text-right pb-3">الموظف</th><th className="text-right pb-3">النوع</th><th className="text-right pb-3">المبلغ</th><th className="text-right pb-3">الرصيد المتبقي</th><th className="text-right pb-3">الحالة</th><th className="text-right pb-3">التاريخ</th>{canManage && <th className="text-right pb-3">إجراء</th>}
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {advancesList.map(a => (
                    <tr key={String(a.id)} className="hover:bg-white/3">
                      <td className="py-3 text-white">{String(a.first_name_ar ?? "")} {String(a.last_name_ar ?? "")}<div className="text-xs text-white/40">{String(a.employee_code ?? "")}</div></td>
                      <td className="py-3 text-white/60">{typeAr(String(a.advance_type))}</td>
                      <td className="py-3 text-amber-400 font-bold">{fmt(a.requested_amount)} {String(a.currency)}</td>
                      <td className="py-3 text-red-400">{Number(a.remaining_balance) > 0 ? fmt(a.remaining_balance) : <span className="text-emerald-400">مسدّد</span>}</td>
                      <td className="py-3"><Badge className={statusColor(String(a.status))}>{statusAr(String(a.status))}</Badge></td>
                      <td className="py-3 text-white/40 text-xs">{String(a.requested_date)}</td>
                      {canManage && (
                        <td className="py-3">
                          <div className="flex gap-1 flex-wrap">
                            {a.status === "active" && <Button size="sm" onClick={() => setShowPaymentModal(a.id as number)} className="h-6 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">دفعة</Button>}
                            {(a.status === "active" || a.status === "approved") && <Button size="sm" onClick={() => cancelAdv.mutate(a.id as number)} className="h-6 text-xs bg-red-500/20 text-red-400 border border-red-500/30">إلغاء</Button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="pending" className="space-y-4">
            {pending.isLoading ? (
              <div className="text-center py-12 text-white/40">جاري التحميل...</div>
            ) : pendingList.length === 0 ? (
              <div className="text-center py-12 text-white/40">لا توجد طلبات معلّقة</div>
            ) : (
              <div className="space-y-3">
                {pendingList.map(a => (
                  <div key={String(a.id)} className="bg-white/5 border border-amber-500/20 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-bold text-white">{String(a.first_name_ar ?? "")} {String(a.last_name_ar ?? "")} <span className="text-xs text-white/40">({String(a.employee_code ?? "")})</span></div>
                        <div className="text-xs text-white/50 mt-1">الراتب الأساسي: {fmt(a.salary)} ج.م</div>
                        <div className="text-amber-400 font-bold mt-2 text-lg">{fmt(a.requested_amount)} {String(a.currency)}</div>
                        <div className="text-xs text-white/40 mt-1">النوع: {typeAr(String(a.advance_type))} • التاريخ: {String(a.requested_date)}</div>
                        {a.reason && <div className="text-sm text-white/60 mt-2 bg-white/3 rounded p-2">{String(a.reason)}</div>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => approveAdv.mutate(a.id as number)} disabled={approveAdv.isPending} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs">قبول</Button>
                        <Button size="sm" onClick={() => setRejectId(a.id as number)} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-xs">رفض</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="ledger" className="space-y-4">
          <div className="flex gap-3 items-center">
            <Input type="number" className="bg-white/5 border-white/10 text-white w-48" placeholder="رقم الموظف" value={ledgerEmpId} onChange={e => setLedgerEmpId(e.target.value)} />
            <span className="text-white/30 text-sm">أدخل رقم الموظف لعرض كشف حسابه</span>
          </div>
          {ledgerEmpId && ledger.isLoading ? (
            <div className="text-center py-8 text-white/40">جاري التحميل...</div>
          ) : ledgerList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-white/40 border-b border-white/10">
                  <th className="text-right pb-3">التاريخ</th><th className="text-right pb-3">نوع الحركة</th><th className="text-right pb-3">المبلغ</th><th className="text-right pb-3">الرصيد</th><th className="text-right pb-3">ملاحظات</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {ledgerList.map(l => {
                    const typeAr: Record<string,string> = { advance_granted:"سلفة ممنوحة", deduction:"خصم من المرتب", manual_payment:"دفعة يدوية", reversal:"استرداد" };
                    const isDebit = String(l.ledger_type) === "advance_granted";
                    return (
                      <tr key={String(l.id)} className="hover:bg-white/3">
                        <td className="py-3 text-white/60">{String(l.ledger_date)}</td>
                        <td className="py-3 text-white">{typeAr[String(l.ledger_type)] ?? String(l.ledger_type)}</td>
                        <td className={`py-3 font-bold ${isDebit ? "text-amber-400" : "text-emerald-400"}`}>{isDebit ? "+" : "-"}{fmt(l.amount)}</td>
                        <td className="py-3 text-white">{fmt(l.balance)}</td>
                        <td className="py-3 text-white/40 text-xs">{String(l.notes ?? "—")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : ledgerEmpId ? (
            <div className="text-center py-12 text-white/40">لا توجد حركات لهذا الموظف</div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
