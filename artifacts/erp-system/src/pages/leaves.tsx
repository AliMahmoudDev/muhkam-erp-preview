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

function statusColor(s: string) {
  switch (s) {
    case "approved":  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "pending":   return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "rejected":  return "bg-red-500/20 text-red-400 border-red-500/30";
    case "cancelled": return "bg-white/10 text-white/40 border-white/20";
    default:          return "bg-white/10 text-white/40 border-white/20";
  }
}
function statusAr(s: string) {
  const m: Record<string,string> = { pending:"معلّق", approved:"معتمد", rejected:"مرفوض", cancelled:"ملغي" };
  return m[s] ?? s;
}

export default function Leaves() {
  const { user, authFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_leaves");

  const [activeTab, setActiveTab] = useState("requests");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [requestForm, setRequestForm] = useState({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [typeForm, setTypeForm] = useState({ name_ar: "", name_en: "", code: "", is_paid: true, requires_approval: true, carryover_allowed: false, carryover_limit: "" });
  const [blackoutForm, setBlackoutForm] = useState({ start_date: "", end_date: "", reason_ar: "", reason_en: "" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, [authFetch]);

  const reqParams = new URLSearchParams();
  if (statusFilter) reqParams.set("status", statusFilter);

  const requests  = useQuery({ queryKey: ["leave-requests", statusFilter], queryFn: () => f(`/api/leave-requests?${reqParams}`) });
  const leaveTypes = useQuery({ queryKey: ["leave-types"],    queryFn: () => f("/api/leave-types") });
  const policies   = useQuery({ queryKey: ["leave-policies"], queryFn: () => f("/api/leave-policies") });
  const blackouts  = useQuery({ queryKey: ["leave-blackouts"],queryFn: () => f("/api/leave-blackout-dates") });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createRequest = useMutation({ mutationFn: (d: AnyRec) => f("/api/leave-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["leave-requests", statusFilter], "تم تقديم طلب الإجازة") });
  const approveRequest = useMutation({ mutationFn: (id: number) => f(`/api/leave-requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" } }), ...mutOpts(["leave-requests", statusFilter], "تم اعتماد الإجازة") });
  const rejectRequest = useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => f(`/api/leave-requests/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }), ...mutOpts(["leave-requests", statusFilter], "تم رفض الإجازة") });
  const createType = useMutation({ mutationFn: (d: AnyRec) => f("/api/leave-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("leave-types", "تم إنشاء نوع الإجازة") });
  const createBlackout = useMutation({ mutationFn: (d: AnyRec) => f("/api/leave-blackout-dates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("leave-blackouts", "تم إضافة الفترة المحظورة") });
  const runAccrual = useMutation({ mutationFn: () => f("/api/leave-accrual/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: new Date().toISOString().substring(0, 7) }) }), onSuccess: () => toast({ title: "تم تشغيل احتساب رصيد الإجازات بنجاح" }), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) });

  const safeArr = (v: unknown) => (Array.isArray(v) ? v : []) as AnyRec[];
  const requestsList = safeArr(requests.data);
  const typesList    = safeArr(leaveTypes.data);
  const blackoutList = safeArr(blackouts.data);

  const pending   = requestsList.filter(r => r.status === "pending").length;
  const approved  = requestsList.filter(r => r.status === "approved").length;
  const totalDays = requestsList.filter(r => r.status === "approved").reduce((s, r) => s + Number(r.total_days), 0);

  function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    createRequest.mutate(requestForm, { onSuccess: () => { setShowRequestForm(false); setRequestForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" }); } });
  }
  function submitType(e: React.FormEvent) {
    e.preventDefault();
    createType.mutate({ ...typeForm, carryover_limit: typeForm.carryover_limit ? Number(typeForm.carryover_limit) : null }, { onSuccess: () => { setShowTypeForm(false); setTypeForm({ name_ar: "", name_en: "", code: "", is_paid: true, requires_approval: true, carryover_allowed: false, carryover_limit: "" }); } });
  }
  function submitBlackout(e: React.FormEvent) {
    e.preventDefault();
    createBlackout.mutate(blackoutForm, { onSuccess: () => { setShowBlackoutForm(false); setBlackoutForm({ start_date: "", end_date: "", reason_ar: "", reason_en: "" }); } });
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">إدارة الإجازات</h1>
        <div className="flex gap-2">
          {canManage && (
            <Button size="sm" onClick={() => runAccrual.mutate()} disabled={runAccrual.isPending} variant="outline" className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 text-xs">
              {runAccrual.isPending ? "جاري..." : "احتساب رصيد الإجازات"}
            </Button>
          )}
          <Button onClick={() => setShowRequestForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ طلب إجازة</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "معلّقة", val: pending,  color: "text-amber-400" },
          { label: "معتمدة", val: approved, color: "text-emerald-400" },
          { label: "إجمالي الأيام المعتمدة", val: totalDays, color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitRequest} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">طلب إجازة جديد</h2>
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="رقم الموظف *" value={requestForm.employee_id} onChange={e => setRequestForm(p => ({ ...p, employee_id: e.target.value }))} required />
            <select className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-right" value={requestForm.leave_type_id} onChange={e => setRequestForm(p => ({ ...p, leave_type_id: e.target.value }))} required>
              <option value="">-- نوع الإجازة --</option>
              {typesList.map(t => <option key={String(t.id)} value={String(t.id)}>{String(t.name_ar)}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/50 mb-1 block">من</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={requestForm.start_date} onChange={e => setRequestForm(p => ({ ...p, start_date: e.target.value }))} required /></div>
              <div><label className="text-xs text-white/50 mb-1 block">إلى</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={requestForm.end_date} onChange={e => setRequestForm(p => ({ ...p, end_date: e.target.value }))} required /></div>
            </div>
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="سبب الإجازة" value={requestForm.reason} onChange={e => setRequestForm(p => ({ ...p, reason: e.target.value }))} />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={createRequest.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createRequest.isPending ? "جاري..." : "تقديم"}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId != null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-white">رفض طلب الإجازة</h2>
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="سبب الرفض *" value={rejectReason} onChange={e => setRejectReason(e.target.value)} required />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }} className="border-white/20 text-white">إلغاء</Button>
              <Button onClick={() => { rejectRequest.mutate({ id: rejectId, reason: rejectReason }, { onSuccess: () => { setRejectId(null); setRejectReason(""); } }); }} disabled={!rejectReason.trim() || rejectRequest.isPending} className="bg-red-500 hover:bg-red-600 text-white font-bold">{rejectRequest.isPending ? "جاري..." : "رفض"}</Button>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="requests"  className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الطلبات</TabsTrigger>
          <TabsTrigger value="types"     className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">أنواع الإجازات</TabsTrigger>
          <TabsTrigger value="blackouts" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الفترات المحظورة</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex gap-2">
            {["", "pending", "approved", "rejected"].map(s => (
              <Button key={s} size="sm" onClick={() => setStatusFilter(s)} className={`text-xs ${statusFilter === s ? "bg-amber-500 text-black" : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"}`}>
                {s === "" ? "الكل" : statusAr(s)}
              </Button>
            ))}
          </div>
          {requests.isLoading ? (
            <div className="text-center py-12 text-white/40">جاري التحميل...</div>
          ) : requestsList.length === 0 ? (
            <div className="text-center py-12 text-white/40">لا توجد طلبات إجازة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-right pb-3">الموظف</th>
                    <th className="text-right pb-3">نوع الإجازة</th>
                    <th className="text-right pb-3">من</th>
                    <th className="text-right pb-3">إلى</th>
                    <th className="text-right pb-3">الأيام</th>
                    <th className="text-right pb-3">الحالة</th>
                    {canManage && <th className="text-right pb-3">إجراء</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requestsList.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-white/3">
                      <td className="py-3 text-white">{String(r.first_name_ar ?? "")} {String(r.last_name_ar ?? "")}</td>
                      <td className="py-3 text-white/70">{String(r.leave_type_name_ar ?? "—")}</td>
                      <td className="py-3 text-white/70">{String(r.start_date)}</td>
                      <td className="py-3 text-white/70">{String(r.end_date)}</td>
                      <td className="py-3 text-amber-400 font-bold">{Number(r.total_days)} يوم</td>
                      <td className="py-3"><Badge className={statusColor(String(r.status))}>{statusAr(String(r.status))}</Badge></td>
                      {canManage && (
                        <td className="py-3">
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => approveRequest.mutate(r.id as number)} disabled={approveRequest.isPending} className="h-6 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30">قبول</Button>
                              <Button size="sm" onClick={() => setRejectId(r.id as number)} className="h-6 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30">رفض</Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowTypeForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ إنشاء نوع إجازة</Button>
          )}
          {showTypeForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitType} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">نوع إجازة جديد</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="الاسم بالعربية *" value={typeForm.name_ar} onChange={e => setTypeForm(p => ({ ...p, name_ar: e.target.value }))} required />
                  <Input className="bg-white/5 border-white/10 text-white" placeholder="Name in English" value={typeForm.name_en} onChange={e => setTypeForm(p => ({ ...p, name_en: e.target.value }))} />
                </div>
                <Input className="bg-white/5 border-white/10 text-white" placeholder="رمز الإجازة (مثال: ANNUAL)" value={typeForm.code} onChange={e => setTypeForm(p => ({ ...p, code: e.target.value }))} required />
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={typeForm.is_paid} onChange={e => setTypeForm(p => ({ ...p, is_paid: e.target.checked }))} />مدفوعة</label>
                  <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={typeForm.requires_approval} onChange={e => setTypeForm(p => ({ ...p, requires_approval: e.target.checked }))} />تحتاج موافقة</label>
                  <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={typeForm.carryover_allowed} onChange={e => setTypeForm(p => ({ ...p, carryover_allowed: e.target.checked }))} />ترحيل</label>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowTypeForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createType.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createType.isPending ? "جاري..." : "إنشاء"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typesList.map(t => (
              <div key={String(t.id)} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white">{String(t.name_ar)}</div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{String(t.code)}</Badge>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {t.is_paid && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">مدفوعة</Badge>}
                  {!t.is_paid && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">غير مدفوعة</Badge>}
                  {t.requires_approval && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">تحتاج موافقة</Badge>}
                  {t.carryover_allowed && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">ترحيل مسموح</Badge>}
                </div>
              </div>
            ))}
            {typesList.length === 0 && !leaveTypes.isLoading && <div className="col-span-3 text-center py-12 text-white/40">لا توجد أنواع إجازات</div>}
          </div>
        </TabsContent>

        <TabsContent value="blackouts" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowBlackoutForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ إضافة فترة محظورة</Button>
          )}
          {showBlackoutForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitBlackout} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">فترة محظورة للإجازات</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/50 mb-1 block">من</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={blackoutForm.start_date} onChange={e => setBlackoutForm(p => ({ ...p, start_date: e.target.value }))} required /></div>
                  <div><label className="text-xs text-white/50 mb-1 block">إلى</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={blackoutForm.end_date} onChange={e => setBlackoutForm(p => ({ ...p, end_date: e.target.value }))} required /></div>
                </div>
                <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="السبب بالعربية *" value={blackoutForm.reason_ar} onChange={e => setBlackoutForm(p => ({ ...p, reason_ar: e.target.value }))} required />
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowBlackoutForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createBlackout.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createBlackout.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blackoutList.map(b => (
              <div key={String(b.id)} className="bg-white/5 border border-red-500/20 rounded-2xl p-4">
                <div className="font-bold text-white">{String(b.reason_ar ?? "—")}</div>
                <div className="text-xs text-red-400 mt-1">{String(b.start_date)} — {String(b.end_date)}</div>
              </div>
            ))}
            {blackoutList.length === 0 && !blackouts.isLoading && <div className="col-span-2 text-center py-12 text-white/40">لا توجد فترات محظورة</div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
