import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { authFetch } from "@/lib/auth-fetch";
import { safeArray } from "@/lib/safe-data";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { Clock, Plus, X, Sun, AlarmClock, LogIn, LogOut, Pencil, Trash2, Timer } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type AnyRec = Record<string, unknown>;

function statusBadge(s: string) {
  switch (s) {
    case "present":  return "erp-badge erp-badge-success";
    case "late":     return "erp-badge erp-badge-warning";
    case "absent":   return "erp-badge erp-badge-danger";
    case "on_leave": return "erp-badge erp-badge-info";
    case "holiday":  return "erp-badge erp-badge-pending";
    default:         return "erp-badge erp-badge-neutral";
  }
}
function statusAr(s: string) {
  const m: Record<string, string> = { present: "حاضر", late: "متأخر", absent: "غائب", on_leave: "إجازة", holiday: "إجازة رسمية", weekend: "عطلة" };
  return m[s] ?? s;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-white/50">{label}</label>{children}</div>;
}

export default function Attendance() {
  const { user }      = useAuth();
  const qc            = useQueryClient();
  const { toast }     = useToast();
  const canManage     = hasPermission(user, "can_manage_attendance");

  const today = new Date().toISOString().split("T")[0]!;
  const [activeTab, setActiveTab]     = useState("records");
  const [from, setFrom]               = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]!; });
  const [to, setTo]                   = useState(() => today);
  const [empSearch, setEmpSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals state
  const [showCheckIn,    setShowCheckIn]    = useState(false);
  const [showCheckOut,   setShowCheckOut]   = useState(false);
  const [showEditRecord, setShowEditRecord] = useState(false);
  const [showShiftForm,  setShowShiftForm]  = useState(false);
  const [showHolidayForm,setShowHolidayForm]= useState(false);
  const [showOTForm,     setShowOTForm]     = useState(false);

  // Form states
  const [checkInForm,   setCheckInForm]   = useState({ employee_id: "", attendance_date: today, check_in_time: "", notes: "" });
  const [checkOutForm,  setCheckOutForm]  = useState({ employee_id: "", attendance_date: today, check_out_time: "" });
  const [editForm,      setEditForm]      = useState<{ id: number; check_in_time: string; check_out_time: string; status: string; notes: string; working_hours: string } | null>(null);
  const [shiftForm,     setShiftForm]     = useState({ name_ar: "", name_en: "", start_time: "09:00", end_time: "17:00", break_duration: "60", grace_minutes: "5", weekly_hours: "40" });
  const [holidayForm,   setHolidayForm]   = useState({ holiday_date: "", name_ar: "", name_en: "" });
  const [otForm,        setOtForm]        = useState({ employee_id: "", date: today, hours: "", reason: "" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, []);

  const params = new URLSearchParams({ from, to });
  if (statusFilter) params.set("status", statusFilter);

  const records  = useQuery({ queryKey: ["attendance", from, to, statusFilter], queryFn: () => f(`/api/attendance/records?${params}`) });
  const shifts   = useQuery({ queryKey: ["shifts"],          queryFn: () => f("/api/shifts") });
  const holidays = useQuery({ queryKey: ["public-holidays"], queryFn: () => f("/api/public-holidays") });
  const overtime = useQuery({ queryKey: ["overtime"],        queryFn: () => f("/api/attendance/overtime") });
  const employees = useQuery({ queryKey: ["employees-list"], queryFn: () => f("/api/employees?limit=500") });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const doCheckIn     = useMutation({ mutationFn: (d: AnyRec) => f("/api/attendance/check-in",  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["attendance", from, to, statusFilter], "تم تسجيل الحضور") });
  const doCheckOut    = useMutation({ mutationFn: (d: AnyRec) => f("/api/attendance/check-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["attendance", from, to, statusFilter], "تم تسجيل الانصراف") });
  const doEditRecord  = useMutation({ mutationFn: (d: AnyRec) => f(`/api/attendance/records/${(d as AnyRec).id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["attendance", from, to, statusFilter], "تم تعديل السجل") });
  const createShift   = useMutation({ mutationFn: (d: AnyRec) => f("/api/shifts",               { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("shifts",          "تم إنشاء الوردية") });
  const deleteShift   = useMutation({ mutationFn: (id: number) => f(`/api/shifts/${id}`,        { method: "DELETE" }), ...mutOpts("shifts", "تم حذف الوردية") });
  const createHoliday = useMutation({ mutationFn: (d: AnyRec) => f("/api/public-holidays",      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("public-holidays", "تم إضافة الإجازة الرسمية") });
  const deleteHoliday = useMutation({ mutationFn: (id: number) => f(`/api/public-holidays/${id}`, { method: "DELETE" }), ...mutOpts("public-holidays", "تم حذف الإجازة") });
  const createOT      = useMutation({ mutationFn: (d: AnyRec) => f("/api/attendance/overtime",  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("overtime", "تم تسجيل العمل الإضافي") });

  const allRecords   = safeArray(records.data);
  const shiftsList   = safeArray(shifts.data);
  const holidaysList = safeArray(holidays.data);
  const overtimeList = safeArray(overtime.data);
  const empList      = safeArray(employees.data);

  // Filter records by employee name search
  const recordsList = empSearch
    ? allRecords.filter(r => {
        const name = `${r.first_name_ar ?? ""} ${r.last_name_ar ?? ""}`;
        return name.includes(empSearch) || String(r.employee_code ?? "").includes(empSearch);
      })
    : allRecords;

  const present = allRecords.filter(r => r.status === "present" || r.status === "late").length;
  const absent  = allRecords.filter(r => r.status === "absent").length;
  const late    = allRecords.filter(r => r.status === "late").length;
  const totalHours = allRecords.reduce((s, r) => s + (Number(r.working_hours) || 0), 0);

  const TABS = [
    { key: "records",  label: "سجلات الحضور",    icon: Clock },
    { key: "shifts",   label: "الورديات",         icon: AlarmClock },
    { key: "overtime", label: "العمل الإضافي",   icon: Timer },
    { key: "holidays", label: "الإجازات الرسمية", icon: Sun },
  ] as const;

  function openCheckOut(rec: AnyRec) {
    setCheckOutForm({ employee_id: String(rec.employee_id), attendance_date: String(rec.attendance_date), check_out_time: new Date().toTimeString().substring(0, 5) });
    setShowCheckOut(true);
  }
  function openEdit(rec: AnyRec) {
    setEditForm({ id: Number(rec.id), check_in_time: String(rec.check_in_time ?? ""), check_out_time: String(rec.check_out_time ?? ""), status: String(rec.status), notes: String(rec.notes ?? ""), working_hours: String(rec.working_hours ?? "") });
    setShowEditRecord(true);
  }

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">الحضور والانصراف</h1>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowCheckIn(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <LogIn size={14} /> تسجيل حضور
            </button>
            <button onClick={() => setShowCheckOut(true)} className="erp-btn erp-btn-secondary flex items-center gap-1 text-sm">
              <LogOut size={14} /> تسجيل انصراف
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي السجلات",    val: allRecords.length,            color: "text-white" },
          { label: "حاضر",              val: present,                       color: "text-emerald-300" },
          { label: "غائب",              val: absent,                        color: "text-red-400" },
          { label: "متأخر",             val: late,                          color: "text-amber-300" },
        ].map(s => (
          <div key={s.label} className="erp-card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-all ${activeTab === t.key ? "bg-amber-500/20 text-amber-300 border-b-2 border-amber-400" : "text-white/50 hover:text-white/80"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── سجلات الحضور ── */}
      {activeTab === "records" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">من:</label>
              <input type="date" className="erp-input" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">إلى:</label>
              <input type="date" className="erp-input" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <input className="erp-input" placeholder="بحث بالاسم أو الرمز" value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
            <select className="erp-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="present">حاضر</option>
              <option value="late">متأخر</option>
              <option value="absent">غائب</option>
              <option value="on_leave">إجازة</option>
              <option value="holiday">إجازة رسمية</option>
            </select>
          </div>

          {/* Summary row */}
          <div className="text-xs text-white/40 flex gap-4">
            <span>إجمالي ساعات العمل: <span className="text-amber-300 font-bold">{totalHours.toFixed(1)} س</span></span>
            <span>السجلات الظاهرة: <span className="text-white/60">{recordsList.length}</span></span>
          </div>

          <div className="erp-card overflow-x-auto">
            {records.isLoading ? <TableSkeleton /> : recordsList.length === 0 ? (
              <div className="erp-empty-state"><Clock size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد سجلات حضور للفترة المحددة</p></div>
            ) : (
              <table className="erp-table w-full">
                <thead><tr className="erp-table-header">
                  <th className="p-3 text-right text-xs">الموظف</th>
                  <th className="p-3 text-right text-xs">التاريخ</th>
                  <th className="p-3 text-right text-xs">الحضور</th>
                  <th className="p-3 text-right text-xs">الانصراف</th>
                  <th className="p-3 text-right text-xs">ساعات</th>
                  <th className="p-3 text-right text-xs">تأخير</th>
                  <th className="p-3 text-right text-xs">الحالة</th>
                  {canManage && <th className="p-3 text-right text-xs">إجراءات</th>}
                </tr></thead>
                <tbody>
                  {recordsList.map(r => (
                    <tr key={String(r.id)} className="erp-table-row">
                      <td className="p-3 text-sm">{String(r.first_name_ar ?? "")} {String(r.last_name_ar ?? "")}<span className="text-white/30 text-xs mr-1">{String(r.employee_code ?? "")}</span></td>
                      <td className="p-3 text-sm text-white/60 font-mono">{String(r.attendance_date)}</td>
                      <td className="p-3 text-sm text-emerald-300 font-mono">{r.check_in_time ? String(r.check_in_time).substring(0, 5) : "—"}</td>
                      <td className="p-3 text-sm text-red-400 font-mono">{r.check_out_time ? String(r.check_out_time).substring(0, 5) : "—"}</td>
                      <td className="p-3 text-sm font-mono">{r.working_hours ? `${Number(r.working_hours).toFixed(1)}س` : "—"}</td>
                      <td className="p-3 text-sm text-amber-300 font-mono">{r.late_minutes ? `${r.late_minutes}د` : "—"}</td>
                      <td className="p-3"><span className={statusBadge(String(r.status))}>{statusAr(String(r.status))}</span></td>
                      {canManage && (
                        <td className="p-3">
                          <div className="flex gap-1">
                            {r.check_in_time && !r.check_out_time && (
                              <button onClick={() => openCheckOut(r)} title="تسجيل انصراف" className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                                <LogOut size={13} />
                              </button>
                            )}
                            <button onClick={() => openEdit(r)} title="تعديل" className="p-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors">
                              <Pencil size={13} />
                            </button>
                          </div>
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

      {/* ── الورديات ── */}
      {activeTab === "shifts" && (
        <div className="space-y-4">
          {canManage && (
            <button onClick={() => setShowShiftForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <Plus size={14} /> إنشاء وردية
            </button>
          )}
          {shifts.isLoading ? <TableSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shiftsList.map(s => (
                <div key={String(s.id)} className="erp-card">
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-sm">{String(s.name_ar)}</div>
                    {canManage && (
                      <button onClick={() => { if (confirm("هل تريد حذف هذه الوردية؟")) deleteShift.mutate(Number(s.id)); }}
                        className="p-1 text-red-400/60 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="text-emerald-300 font-mono">▶ {String(s.start_time)}</span>
                    <span className="text-red-400 font-mono">■ {String(s.end_time)}</span>
                  </div>
                  <div className="text-xs text-white/40 mt-2">استراحة: {Number(s.break_duration)} د • فترة السماح: {Number(s.grace_minutes)} د • {Number(s.weekly_hours)} س/أسبوع</div>
                </div>
              ))}
              {shiftsList.length === 0 && (
                <div className="erp-card col-span-3"><div className="erp-empty-state"><AlarmClock size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد ورديات</p></div></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── العمل الإضافي ── */}
      {activeTab === "overtime" && (
        <div className="space-y-4">
          {canManage && (
            <button onClick={() => setShowOTForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <Plus size={14} /> تسجيل عمل إضافي
            </button>
          )}
          <div className="erp-card overflow-x-auto">
            {overtime.isLoading ? <TableSkeleton /> : (
              <table className="erp-table w-full">
                <thead><tr className="erp-table-header">
                  <th className="p-3 text-right text-xs">الموظف</th>
                  <th className="p-3 text-right text-xs">التاريخ</th>
                  <th className="p-3 text-right text-xs">الساعات</th>
                  <th className="p-3 text-right text-xs">السبب</th>
                  <th className="p-3 text-right text-xs">الحالة</th>
                </tr></thead>
                <tbody>
                  {overtimeList.map(o => (
                    <tr key={String(o.id)} className="erp-table-row">
                      <td className="p-3 text-sm">{String(o.first_name_ar ?? "")} {String(o.last_name_ar ?? "")}</td>
                      <td className="p-3 text-sm text-white/60 font-mono">{String(o.date)}</td>
                      <td className="p-3 text-sm text-amber-300 font-bold font-mono">{Number(o.hours).toFixed(1)} ساعة</td>
                      <td className="p-3 text-sm text-white/60">{String(o.reason ?? "—")}</td>
                      <td className="p-3"><span className="erp-badge erp-badge-success">معتمد</span></td>
                    </tr>
                  ))}
                  {overtimeList.length === 0 && !overtime.isLoading && (
                    <tr><td colSpan={5} className="py-12"><div className="erp-empty-state"><Timer size={28} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد سجلات عمل إضافي</p></div></td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── الإجازات الرسمية ── */}
      {activeTab === "holidays" && (
        <div className="space-y-4">
          {canManage && (
            <button onClick={() => setShowHolidayForm(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
              <Plus size={14} /> إضافة إجازة رسمية
            </button>
          )}
          {holidays.isLoading ? <TableSkeleton /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {holidaysList.map(h => (
                <div key={String(h.id)} className="erp-card flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                    {String(h.holiday_date).substring(8, 10)}<br /><span className="text-xs">{String(h.holiday_date).substring(5, 7)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{String(h.name_ar)}</div>
                    <div className="text-xs text-white/40 font-mono">{String(h.holiday_date)}</div>
                  </div>
                  {canManage && (
                    <button onClick={() => { if (confirm("هل تريد حذف هذه الإجازة؟")) deleteHoliday.mutate(Number(h.id)); }}
                      className="p-1.5 text-red-400/60 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {holidaysList.length === 0 && (
                <div className="erp-card col-span-3"><div className="erp-empty-state"><Sun size={36} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد إجازات رسمية</p></div></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* تسجيل حضور */}
      {showCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><LogIn size={16} className="text-emerald-400" /> تسجيل حضور</h2>
              <button onClick={() => setShowCheckIn(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الموظف *">
                <select className="erp-input w-full" value={checkInForm.employee_id} onChange={e => setCheckInForm(p => ({ ...p, employee_id: e.target.value }))}>
                  <option value="">اختر الموظف</option>
                  {empList.map(e => <option key={String(e.id)} value={String(e.id)}>{String(e.first_name_ar)} {String(e.last_name_ar)} — {String(e.employee_code)}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ"><input type="date" value={checkInForm.attendance_date} onChange={e => setCheckInForm(p => ({ ...p, attendance_date: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="وقت الحضور"><input type="time" value={checkInForm.check_in_time} onChange={e => setCheckInForm(p => ({ ...p, check_in_time: e.target.value }))} className="erp-input w-full" /></Field>
              </div>
              <Field label="ملاحظات"><input value={checkInForm.notes} onChange={e => setCheckInForm(p => ({ ...p, notes: e.target.value }))} className="erp-input w-full" placeholder="اختياري" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => {
                if (!checkInForm.employee_id) { toast({ title: "يرجى اختيار الموظف", variant: "destructive" }); return; }
                doCheckIn.mutate({ ...checkInForm, attendance_date: checkInForm.attendance_date || today, check_in_time: checkInForm.check_in_time || new Date().toTimeString().substring(0, 5) },
                  { onSuccess: () => { setShowCheckIn(false); setCheckInForm({ employee_id: "", attendance_date: today, check_in_time: "", notes: "" }); } });
              }} disabled={doCheckIn.isPending} className="erp-btn erp-btn-primary flex-1">
                {doCheckIn.isPending ? "جاري التسجيل..." : "تسجيل"}
              </button>
              <button onClick={() => setShowCheckIn(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* تسجيل انصراف */}
      {showCheckOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><LogOut size={16} className="text-red-400" /> تسجيل انصراف</h2>
              <button onClick={() => setShowCheckOut(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الموظف *">
                <select className="erp-input w-full" value={checkOutForm.employee_id} onChange={e => setCheckOutForm(p => ({ ...p, employee_id: e.target.value }))}>
                  <option value="">اختر الموظف</option>
                  {empList.map(e => <option key={String(e.id)} value={String(e.id)}>{String(e.first_name_ar)} {String(e.last_name_ar)} — {String(e.employee_code)}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ"><input type="date" value={checkOutForm.attendance_date} onChange={e => setCheckOutForm(p => ({ ...p, attendance_date: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="وقت الانصراف"><input type="time" value={checkOutForm.check_out_time} onChange={e => setCheckOutForm(p => ({ ...p, check_out_time: e.target.value }))} className="erp-input w-full" /></Field>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => {
                if (!checkOutForm.employee_id) { toast({ title: "يرجى اختيار الموظف", variant: "destructive" }); return; }
                doCheckOut.mutate({ ...checkOutForm },
                  { onSuccess: () => { setShowCheckOut(false); setCheckOutForm({ employee_id: "", attendance_date: today, check_out_time: "" }); } });
              }} disabled={doCheckOut.isPending} className="erp-btn erp-btn-primary flex-1">
                {doCheckOut.isPending ? "جاري التسجيل..." : "تسجيل"}
              </button>
              <button onClick={() => setShowCheckOut(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* تعديل سجل */}
      {showEditRecord && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Pencil size={16} className="text-amber-400" /> تعديل سجل الحضور</h2>
              <button onClick={() => setShowEditRecord(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت الحضور"><input type="time" value={editForm.check_in_time} onChange={e => setEditForm(p => p ? ({ ...p, check_in_time: e.target.value }) : p)} className="erp-input w-full" /></Field>
                <Field label="وقت الانصراف"><input type="time" value={editForm.check_out_time} onChange={e => setEditForm(p => p ? ({ ...p, check_out_time: e.target.value }) : p)} className="erp-input w-full" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="الحالة">
                  <select className="erp-input w-full" value={editForm.status} onChange={e => setEditForm(p => p ? ({ ...p, status: e.target.value }) : p)}>
                    <option value="present">حاضر</option>
                    <option value="late">متأخر</option>
                    <option value="absent">غائب</option>
                    <option value="on_leave">إجازة</option>
                    <option value="holiday">إجازة رسمية</option>
                  </select>
                </Field>
                <Field label="ساعات العمل"><input type="number" step="0.1" value={editForm.working_hours} onChange={e => setEditForm(p => p ? ({ ...p, working_hours: e.target.value }) : p)} className="erp-input w-full" /></Field>
              </div>
              <Field label="ملاحظات"><input value={editForm.notes} onChange={e => setEditForm(p => p ? ({ ...p, notes: e.target.value }) : p)} className="erp-input w-full" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => {
                doEditRecord.mutate({ ...editForm, working_hours: editForm.working_hours ? Number(editForm.working_hours) : undefined },
                  { onSuccess: () => { setShowEditRecord(false); setEditForm(null); } });
              }} disabled={doEditRecord.isPending} className="erp-btn erp-btn-primary flex-1">
                {doEditRecord.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button onClick={() => setShowEditRecord(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* وردية جديدة */}
      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><AlarmClock size={16} className="text-amber-400" /> وردية جديدة</h2>
              <button onClick={() => setShowShiftForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="اسم الوردية *"><input value={shiftForm.name_ar} onChange={e => setShiftForm(p => ({ ...p, name_ar: e.target.value }))} className="erp-input w-full" placeholder="الوردية الصباحية" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت البداية"><input type="time" value={shiftForm.start_time} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="وقت النهاية"><input type="time" value={shiftForm.end_time} onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} className="erp-input w-full" /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="الاستراحة (د)"><input type="number" value={shiftForm.break_duration} onChange={e => setShiftForm(p => ({ ...p, break_duration: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="السماح (د)"><input type="number" value={shiftForm.grace_minutes} onChange={e => setShiftForm(p => ({ ...p, grace_minutes: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="س/أسبوع"><input type="number" value={shiftForm.weekly_hours} onChange={e => setShiftForm(p => ({ ...p, weekly_hours: e.target.value }))} className="erp-input w-full" /></Field>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createShift.mutate(shiftForm, { onSuccess: () => { setShowShiftForm(false); setShiftForm({ name_ar: "", name_en: "", start_time: "09:00", end_time: "17:00", break_duration: "60", grace_minutes: "5", weekly_hours: "40" }); } }); }} disabled={createShift.isPending} className="erp-btn erp-btn-primary flex-1">
                {createShift.isPending ? "جاري..." : "إنشاء"}
              </button>
              <button onClick={() => setShowShiftForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* إجازة رسمية جديدة */}
      {showHolidayForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Sun size={16} className="text-amber-400" /> إجازة رسمية جديدة</h2>
              <button onClick={() => setShowHolidayForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="التاريخ *"><input type="date" value={holidayForm.holiday_date} onChange={e => setHolidayForm(p => ({ ...p, holiday_date: e.target.value }))} className="erp-input w-full" required /></Field>
              <Field label="اسم الإجازة *"><input value={holidayForm.name_ar} onChange={e => setHolidayForm(p => ({ ...p, name_ar: e.target.value }))} className="erp-input w-full" placeholder="عيد الفطر" required /></Field>
              <Field label="Holiday Name"><input value={holidayForm.name_en} onChange={e => setHolidayForm(p => ({ ...p, name_en: e.target.value }))} className="erp-input w-full" placeholder="Eid Al-Fitr" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { createHoliday.mutate(holidayForm, { onSuccess: () => { setShowHolidayForm(false); setHolidayForm({ holiday_date: "", name_ar: "", name_en: "" }); } }); }} disabled={createHoliday.isPending} className="erp-btn erp-btn-primary flex-1">
                {createHoliday.isPending ? "جاري..." : "إضافة"}
              </button>
              <button onClick={() => setShowHolidayForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* عمل إضافي */}
      {showOTForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="erp-modal rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Timer size={16} className="text-amber-400" /> تسجيل عمل إضافي</h2>
              <button onClick={() => setShowOTForm(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="الموظف *">
                <select className="erp-input w-full" value={otForm.employee_id} onChange={e => setOtForm(p => ({ ...p, employee_id: e.target.value }))}>
                  <option value="">اختر الموظف</option>
                  {empList.map(e => <option key={String(e.id)} value={String(e.id)}>{String(e.first_name_ar)} {String(e.last_name_ar)} — {String(e.employee_code)}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ"><input type="date" value={otForm.date} onChange={e => setOtForm(p => ({ ...p, date: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="عدد الساعات"><input type="number" step="0.5" value={otForm.hours} onChange={e => setOtForm(p => ({ ...p, hours: e.target.value }))} className="erp-input w-full" placeholder="2.5" /></Field>
              </div>
              <Field label="السبب"><input value={otForm.reason} onChange={e => setOtForm(p => ({ ...p, reason: e.target.value }))} className="erp-input w-full" placeholder="اختياري" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => {
                if (!otForm.employee_id || !otForm.hours) { toast({ title: "يرجى اختيار الموظف وتحديد الساعات", variant: "destructive" }); return; }
                createOT.mutate({ employee_id: Number(otForm.employee_id), date: otForm.date, hours: Number(otForm.hours), reason: otForm.reason || null },
                  { onSuccess: () => { setShowOTForm(false); setOtForm({ employee_id: "", date: today, hours: "", reason: "" }); } });
              }} disabled={createOT.isPending} className="erp-btn erp-btn-primary flex-1">
                {createOT.isPending ? "جاري..." : "تسجيل"}
              </button>
              <button onClick={() => setShowOTForm(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
