import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { authFetch } from "@/lib/auth-fetch";
import { safeArray } from "@/lib/safe-data";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { CalendarDays, Plus, X, Tag, Ban, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type AnyRec = Record<string, unknown>;

function statusBadge(s: string) {
  switch (s) {
    case "approved":  return "erp-badge erp-badge-success";
    case "pending":   return "erp-badge erp-badge-warning";
    case "rejected":  return "erp-badge erp-badge-danger";
    case "cancelled": return "erp-badge erp-badge-neutral";
    default:          return "erp-badge erp-badge-neutral";
  }
}
function statusAr(s: string) {
  const m: Record<string, string> = { pending: "معلّق", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغي" };
  return m[s] ?? s;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-white/50">{label}</label>{children}</div>;
}

export default function Leaves() {
  const { user }  = useAuth();
  const qc        = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_leaves");

  const [activeTab, setActiveTab]         = useState("requests");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showTypeForm, setShowTypeForm]   = useState(false);
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);
  const [rejectId, setRejectId]           = useState<number | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [requestForm, setRequestForm]     = useState({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [typeForm, setTypeForm]           = useState({ name_ar: "", name_en: "", code: "", is_paid: true, requires_approval: true, carryover_allowed: false, carryover_limit: "" });
  const [blackoutForm, setBlackoutForm]   = useState({ start_date: "", end_date: "", reason_ar: "", reason_en: "" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, []);

  const reqParams = new URLSearchParams();
  if (statusFilter) reqParams.set("status", statusFilter);

  const requests   = useQuery({ queryKey: ["leave-requests", statusFilter], queryFn: () => f(`/api/leave-requests?${reqParams}`) });
  const leaveTypes = useQuery({ queryKey: ["leave-types"],    queryFn: () => f("/api/leave-types") });
  const blackouts  = useQuery({ queryKey: ["leave-blackouts"],queryFn: () => f("/api/leave-blackout-dates") });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createRequest  = useMutation({ mutationFn: (d: AnyRec) => f("/api/leave-requests",                                    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }),                                                                             ...mutOpts(["leave-requests", statusFilter], "تم تقديم طلب الإجازة") });
  const approveRequest = useMutation({ mutationFn: (id: number) => f(`/api/leave-requests/${id}/approve`,                     { method: "POST", headers: { "Content-Type": "application/json" } }),                                                                                                       ...mutOpts(["leave-requests", statusFilter], "تم اعتماد الإجازة") });
  const rejectRequest  = useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => f(`/api/leave-requests/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }),                                                      ...mutOpts(["leave-requests", statusFilter], "تم رفض الإجازة") });
  const createType     = useMutation({ mutationFn: (d: AnyRec) => f("/api/leave-types",                                       { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }),                                                                             ...mutOpts("leave-types",   "تم إنشاء نوع الإجازة") });
  const createBlackout = useMutation({ mutationFn: (d: AnyRec) => f("/api/leave-blackout-dates",                              { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }),                                                                             ...mutOpts("leave-blackouts","تم إضافة الفترة المحظورة") });
  const runAccrual     = useMutation({ mutationFn: () => f("/api/leave-accrual/run",                                          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: new Date().toISOString().substring(0, 7) }) }), onSuccess: () => toast({ title: "تم احتساب رصيد الإجازات بنجاح" }), onError: (e: Error) => toast({ title: e.message, variant: "destructive" }) });

  const requestsList = safeArray(requests.data);
  const typesList    = safeArray(leaveTypes.data);
  const blackoutList = safeArray(blackouts.data);

  const pending   = requestsList.filter(r => r.status === "pending").length;
  const approved  = requestsList.filter(r => r.status === "approved").length;
  const totalDays = requestsList.filter(r => r.status === "approved").reduce((s, r) => s + Number(r.total_days), 0);

  const TABS = [
    { key: "requests",  label: "الطلبات",           icon: CalendarDays },
    { key: "types",     label: "أنواع الإجازات",    icon: Tag },
    { key: "blackouts", label: "الفترات المحظورة",  icon: Ban },
  ] as const;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">إدارة الإجازات</h1>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button onClick={() => runAccrual.mutate()} disabled={runAccrual.isPending} className="erp-btn erp-btn-ghost flex items-center gap-1 text-xs text-blue-300 border-blue-500/40">
              <RefreshCw size={12} /> {runAccrual.isPending ? "جاري..." : "احتساب رصيد الإجازات"}
            </button>
          )}
          <button onClick={() => setShowRequestForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
            <Plus size={14} /> طلب إجازة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "معلّقة",                  val: pending,   color: "text-amber-300" },
          { label: "معتمدة",                  val: approved,  color: "text-emerald-300" },
          { label: "إجمالي الأيام المعتمدة",  val: totalDays, color: "text-blue-300" },
        ].map(s => (
          <div key={s.label} className="erp-card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400" : "text-white/50 hover:text-white/80"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── الطلبات ── */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["", "pending", "approved", "rejected"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`erp-btn text-xs ${statusFilter === s ? "erp-btn-primary" : "erp-btn-ghost"}`}>
                {s === "" ? "الكل" : statusAr(s)}
              </button>
            ))}
          </div>
          <div className="erp-card overflow-x-auto">
            {requests.isLoading ? <TableSkeleton /> : requestsList.length === 0 ? (
              <div className="erp-empty-state"><CalendarDays size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد طلبات إجازة</p></div>
            ) : (
              <table className="erp-table w-full">
                <thead><tr className="erp-table-header">
                  <th className="p-3 text-right text-xs">الموظف</th>
                  <th className="p-3 text-right text-xs">نوع الإجازة</th>
                  <th className="p-3 text-right text-xs">من</th>
                  <th className="p-3 text-right text-xs">إلى</th>
                  <th className="p-3 text-right text-xs">الأيام</th>
                  <th className="p-3 text-right text-xs">الحالة</th>
                  {canManage && <th className="p-3 text-right text-xs">إجراء</th>}
                </tr></thead>
                <tbody>
                  {requestsList.map(r => (
                    <tr key={String(r.id)} className="erp-table-row">
                      <td className="p-3 text-sm">{String(r.first_name_ar ?? "")} {String(r.last_name_ar ?? "")}</td>
                      <td className="p-3 text-sm text-white/60">{String(r.leave_type_name_ar ?? "—")}</td>
                      <td className="p-3 text-sm text-white/60 font-mono">{String(r.start_date)}</td>
                      <td className="p-3 text-sm text-white/60 font-mono">{String(r.end_date)}</td>
                      <td className="p-3 text-sm text-amber-300 font-bold">{Number(r.total_days)} يوم</td>
                      <td className="p-3"><span className={statusBadge(String(r.status))}>{statusAr(String(r.status))}</span></td>
                      {canManage && (
                        <td className="p-3">
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <button onClick={() => approveRequest.mutate(r.id as number)} disabled={approveRequest.isPending} className="erp-btn erp-btn-ghost p-1 text-xs text-emerald-400 border border-emerald-500/30">قبول</button>
                              <button onClick={() => setRejectId(r.id as number)} className="erp-btn erp-btn-ghost p-1 text-xs text-red-400 border border-red-500/30">رفض</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── أنواع الإجازات ── */}
      {activeTab === "types" && (
        <div className="space-y-4">
          {canManage && (
            <button onClick={() => setShowTypeForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <Plus size={14} /> إنشاء نوع إجازة
            </button>
          )}
          {leaveTypes.isLoading ? <TableSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typesList.map(t => (
                <div key={String(t.id)} className="erp-card">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm">{String(t.name_ar)}</div>
                    <span className="erp-badge erp-badge-info text-xs">{String(t.code)}</span>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className={t.is_paid ? "erp-badge erp-badge-success text-xs" : "erp-badge erp-badge-danger text-xs"}>{t.is_paid ? "مدفوعة" : "غير مدفوعة"}</span>
                    {t.requires_approval && <span className="erp-badge erp-badge-warning text-xs">تحتاج موافقة</span>}
                    {t.carryover_allowed && <span className="erp-badge erp-badge-pending text-xs">ترحيل مسموح</span>}
                  </div>
                </div>
              ))}
              {typesList.length === 0 && (
                <div className="erp-card col-span-3"><div className="erp-empty-state"><Tag size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد أنواع إجازات</p></div></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── الفترات المحظورة ── */}
      {activeTab === "blackouts" && (
        <div className="space-y-4">
          {canManage && (
            <button onClick={() => setShowBlackoutForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <Plus size={14} /> إضافة فترة محظورة
            </button>
          )}
          {blackouts.isLoading ? <TableSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {blackoutList.map(b => (
                <div key={String(b.id)} className="erp-card border-red-500/20">
                  <div className="font-bold text-sm">{String(b.reason_ar ?? "—")}</div>
                  <div className="text-xs text-red-400 mt-1 font-mono">{String(b.start_date)} — {String(b.end_date)}</div>
                </div>
              ))}
              {blackoutList.length === 0 && (
                <div className="erp-card col-span-2"><div className="erp-empty-state"><Ban size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد فترات محظورة</p></div></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* طلب إجازة */}
      {showRequestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><CalendarDays size={16} className="text-amber-400" /> طلب إجازة جديد</h2>
              <button onClick={() => setShowRequestForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="رقم الموظف *"><input type="number" value={requestForm.employee_id} onChange={e => setRequestForm(p => ({ ...p, employee_id: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="نوع الإجازة *">
                <select value={requestForm.leave_type_id} onChange={e => setRequestForm(p => ({ ...p, leave_type_id: e.target.value }))} className="erp-input w-full" required>
                  <option value="">— اختر نوع الإجازة —</option>
                  {typesList.map(t => <option key={String(t.id)} value={String(t.id)}>{String(t.name_ar)}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="من *"><input type="date" value={requestForm.start_date} onChange={e => setRequestForm(p => ({ ...p, start_date: e.target.value }))} className="erp-input w-full" required /></Field>
                <Field label="إلى *"><input type="date" value={requestForm.end_date} onChange={e => setRequestForm(p => ({ ...p, end_date: e.target.value }))} className="erp-input w-full" required /></Field>
              </div>
              <Field label="السبب"><input value={requestForm.reason} onChange={e => setRequestForm(p => ({ ...p, reason: e.target.value }))} className="erp-input w-full" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createRequest.mutate(requestForm, { onSuccess: () => { setShowRequestForm(false); setRequestForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" }); } }); }} disabled={createRequest.isPending} className="erp-btn erp-btn-primary flex-1">
                {createRequest.isPending ? "جاري التقديم..." : "تقديم"}
              </button>
              <button onClick={() => setShowRequestForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* رفض الإجازة */}
      {rejectId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-sm" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="font-bold text-white">رفض طلب الإجازة</h2>
              <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="سبب الرفض *">
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="erp-input w-full" placeholder="اكتب سبب الرفض..." />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-white/10">
              <button onClick={() => { rejectRequest.mutate({ id: rejectId, reason: rejectReason }, { onSuccess: () => { setRejectId(null); setRejectReason(""); } }); }} disabled={!rejectReason.trim() || rejectRequest.isPending} className="erp-btn flex-1 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">
                {rejectRequest.isPending ? "جاري..." : "رفض"}
              </button>
              <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="erp-btn erp-btn-ghost flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* نوع إجازة جديد */}
      {showTypeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Tag size={16} className="text-amber-400" /> نوع إجازة جديد</h2>
              <button onClick={() => setShowTypeForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="الاسم (عربي) *"><input value={typeForm.name_ar} onChange={e => setTypeForm(p => ({ ...p, name_ar: e.target.value }))} className="erp-input w-full" required /></Field>
                <Field label="الاسم (إنجليزي)"><input value={typeForm.name_en} onChange={e => setTypeForm(p => ({ ...p, name_en: e.target.value }))} className="erp-input w-full" /></Field>
              </div>
              <Field label="رمز الإجازة *"><input value={typeForm.code} onChange={e => setTypeForm(p => ({ ...p, code: e.target.value }))} className="erp-input w-full" placeholder="ANNUAL" required /></Field>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={typeForm.is_paid} onChange={e => setTypeForm(p => ({ ...p, is_paid: e.target.checked }))} />مدفوعة</label>
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={typeForm.requires_approval} onChange={e => setTypeForm(p => ({ ...p, requires_approval: e.target.checked }))} />تحتاج موافقة</label>
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer"><input type="checkbox" className="accent-amber-500" checked={typeForm.carryover_allowed} onChange={e => setTypeForm(p => ({ ...p, carryover_allowed: e.target.checked }))} />ترحيل مسموح</label>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createType.mutate({ ...typeForm, carryover_limit: typeForm.carryover_limit ? Number(typeForm.carryover_limit) : null }, { onSuccess: () => { setShowTypeForm(false); setTypeForm({ name_ar: "", name_en: "", code: "", is_paid: true, requires_approval: true, carryover_allowed: false, carryover_limit: "" }); } }); }} disabled={createType.isPending} className="erp-btn erp-btn-primary flex-1">
                {createType.isPending ? "جاري..." : "إنشاء"}
              </button>
              <button onClick={() => setShowTypeForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* فترة محظورة */}
      {showBlackoutForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Ban size={16} className="text-red-400" /> فترة محظورة للإجازات</h2>
              <button onClick={() => setShowBlackoutForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="من *"><input type="date" value={blackoutForm.start_date} onChange={e => setBlackoutForm(p => ({ ...p, start_date: e.target.value }))} className="erp-input w-full" required /></Field>
                <Field label="إلى *"><input type="date" value={blackoutForm.end_date} onChange={e => setBlackoutForm(p => ({ ...p, end_date: e.target.value }))} className="erp-input w-full" required /></Field>
              </div>
              <Field label="السبب *"><input value={blackoutForm.reason_ar} onChange={e => setBlackoutForm(p => ({ ...p, reason_ar: e.target.value }))} className="erp-input w-full" required /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createBlackout.mutate(blackoutForm, { onSuccess: () => { setShowBlackoutForm(false); setBlackoutForm({ start_date: "", end_date: "", reason_ar: "", reason_en: "" }); } }); }} disabled={createBlackout.isPending} className="erp-btn erp-btn-primary flex-1">
                {createBlackout.isPending ? "جاري..." : "إضافة"}
              </button>
              <button onClick={() => setShowBlackoutForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
