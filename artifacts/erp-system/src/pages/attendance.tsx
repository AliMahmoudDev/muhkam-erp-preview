import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { authFetch } from "@/lib/auth-fetch";
import { safeArray } from "@/lib/safe-data";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { Clock, Plus, X, Calendar, Sun, AlarmClock } from "lucide-react";

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
  const [empFilter, setEmpFilter]     = useState("");
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showShiftForm, setShowShiftForm]     = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [checkInForm, setCheckInForm] = useState({ employee_id: "", attendance_date: today, check_in_time: "", notes: "" });
  const [shiftForm, setShiftForm]     = useState({ name_ar: "", name_en: "", start_time: "09:00", end_time: "17:00", break_duration: "60", grace_minutes: "5", weekly_hours: "40" });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: "", name_ar: "", name_en: "" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, []);

  const params = new URLSearchParams({ from, to });
  if (empFilter) params.set("employee_id", empFilter);

  const records  = useQuery({ queryKey: ["attendance", from, to, empFilter], queryFn: () => f(`/api/attendance/records?${params}`) });
  const shifts   = useQuery({ queryKey: ["shifts"],          queryFn: () => f("/api/shifts") });
  const holidays = useQuery({ queryKey: ["public-holidays"], queryFn: () => f("/api/public-holidays") });
  const overtime = useQuery({ queryKey: ["overtime"],        queryFn: () => f("/api/attendance/overtime") });

  const mutOpts = (key: string | string[], msg: string) => ({
    onSuccess: () => { qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }); toast({ title: msg }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const doCheckIn     = useMutation({ mutationFn: (d: AnyRec) => f("/api/attendance/check-in",  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["attendance", from, to, empFilter], "تم تسجيل الحضور") });
  const createShift   = useMutation({ mutationFn: (d: AnyRec) => f("/api/shifts",               { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("shifts",          "تم إنشاء الوردية") });
  const createHoliday = useMutation({ mutationFn: (d: AnyRec) => f("/api/public-holidays",      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("public-holidays", "تم إضافة الإجازة الرسمية") });

  const recordsList  = safeArray(records.data);
  const shiftsList   = safeArray(shifts.data);
  const holidaysList = safeArray(holidays.data);
  const overtimeList = safeArray(overtime.data);

  const present = recordsList.filter(r => r.status === "present" || r.status === "late").length;
  const absent  = recordsList.filter(r => r.status === "absent").length;
  const late    = recordsList.filter(r => r.status === "late").length;

  const TABS = [
    { key: "records",  label: "سجلات الحضور",    icon: Clock },
    { key: "shifts",   label: "الورديات",         icon: AlarmClock },
    { key: "overtime", label: "العمل الإضافي",   icon: AlarmClock },
    { key: "holidays", label: "الإجازات الرسمية", icon: Sun },
  ] as const;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Clock size={22} className="text-amber-400" />
          <h1 className="text-xl font-bold text-white">الحضور والانصراف</h1>
        </div>
        {canManage && (
          <button onClick={() => setShowCheckIn(true)} className="erp-btn erp-btn-primary flex items-center gap-1 text-sm">
            <Plus size={14} /> تسجيل حضور
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي السجلات", val: recordsList.length, color: "text-white" },
          { label: "حاضر",          val: present,             color: "text-emerald-300" },
          { label: "غائب",          val: absent,              color: "text-red-400" },
          { label: "متأخر",         val: late,                color: "text-amber-300" },
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
            <input className="erp-input" placeholder="رقم الموظف" value={empFilter} onChange={e => setEmpFilter(e.target.value)} />
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
                  <th className="p-3 text-right text-xs">ساعات العمل</th>
                  <th className="p-3 text-right text-xs">التأخير</th>
                  <th className="p-3 text-right text-xs">الحالة</th>
                </tr></thead>
                <tbody>
                  {recordsList.map(r => (
                    <tr key={String(r.id)} className="erp-table-row">
                      <td className="p-3 text-sm">{String(r.first_name_ar ?? "")} {String(r.last_name_ar ?? "")}</td>
                      <td className="p-3 text-sm text-white/60 font-mono">{String(r.attendance_date)}</td>
                      <td className="p-3 text-sm text-emerald-300 font-mono">{r.check_in_time ? String(r.check_in_time) : "—"}</td>
                      <td className="p-3 text-sm text-red-400 font-mono">{r.check_out_time ? String(r.check_out_time) : "—"}</td>
                      <td className="p-3 text-sm font-mono">{r.working_hours ? `${Number(r.working_hours).toFixed(1)} س` : "—"}</td>
                      <td className="p-3 text-sm text-amber-300 font-mono">{r.late_minutes ? `${r.late_minutes} د` : "—"}</td>
                      <td className="p-3"><span className={statusBadge(String(r.status))}>{statusAr(String(r.status))}</span></td>
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
                  <div className="font-bold text-sm">{String(s.name_ar)}</div>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="text-emerald-300 font-mono">▶ {String(s.start_time)}</span>
                    <span className="text-red-400 font-mono">■ {String(s.end_time)}</span>
                  </div>
                  <div className="text-xs text-white/40 mt-2">استراحة: {Number(s.break_duration)} د • فترة السماح: {Number(s.grace_minutes)} د</div>
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
                    <td className="p-3"><span className="erp-badge erp-badge-success">{String(o.status)}</span></td>
                  </tr>
                ))}
                {overtimeList.length === 0 && !overtime.isLoading && (
                  <tr><td colSpan={5} className="py-12"><div className="erp-empty-state"><AlarmClock size={28} className="erp-empty-icon mb-2" /><p className="erp-empty-label">لا توجد سجلات عمل إضافي</p></div></td></tr>
                )}
              </tbody>
            </table>
          )}
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
                  <div>
                    <div className="font-bold text-sm">{String(h.name_ar)}</div>
                    <div className="text-xs text-white/40 font-mono">{String(h.holiday_date)}</div>
                  </div>
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
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2"><Clock size={16} className="text-amber-400" /> تسجيل حضور</h2>
              <button onClick={() => setShowCheckIn(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <Field label="رقم الموظف *"><input type="number" value={checkInForm.employee_id} onChange={e => setCheckInForm(p => ({ ...p, employee_id: e.target.value }))} className="erp-input w-full" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="التاريخ"><input type="date" value={checkInForm.attendance_date} onChange={e => setCheckInForm(p => ({ ...p, attendance_date: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="وقت الحضور"><input type="time" value={checkInForm.check_in_time} onChange={e => setCheckInForm(p => ({ ...p, check_in_time: e.target.value }))} className="erp-input w-full" /></Field>
              </div>
              <Field label="ملاحظات"><input value={checkInForm.notes} onChange={e => setCheckInForm(p => ({ ...p, notes: e.target.value }))} className="erp-input w-full" placeholder="اختياري" /></Field>
            </div>
            <div className="flex gap-2 p-5 border-t border-white/10">
              <button onClick={() => { doCheckIn.mutate({ ...checkInForm, attendance_date: checkInForm.attendance_date || today, check_in_time: checkInForm.check_in_time || new Date().toTimeString().substring(0, 5) }, { onSuccess: () => { setShowCheckIn(false); setCheckInForm({ employee_id: "", attendance_date: today, check_in_time: "", notes: "" }); } }); }} disabled={doCheckIn.isPending} className="erp-btn erp-btn-primary flex-1">
                {doCheckIn.isPending ? "جاري التسجيل..." : "تسجيل"}
              </button>
              <button onClick={() => setShowCheckIn(false)} className="erp-btn erp-btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* وردية جديدة */}
      {showShiftForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="فترة الاستراحة (د)"><input type="number" value={shiftForm.break_duration} onChange={e => setShiftForm(p => ({ ...p, break_duration: e.target.value }))} className="erp-input w-full" /></Field>
                <Field label="فترة السماح (د)"><input type="number" value={shiftForm.grace_minutes} onChange={e => setShiftForm(p => ({ ...p, grace_minutes: e.target.value }))} className="erp-input w-full" /></Field>
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
          <div className="bg-[#181c2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md" dir="rtl">
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
    </div>
  );
}
