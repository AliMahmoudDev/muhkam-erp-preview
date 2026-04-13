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
    case "present":  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "late":     return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "absent":   return "bg-red-500/20 text-red-400 border-red-500/30";
    case "on_leave": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "holiday":  return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:         return "bg-white/10 text-white/40 border-white/20";
  }
}
function statusAr(s: string) {
  const m: Record<string,string> = { present:"حاضر", late:"متأخر", absent:"غائب", on_leave:"إجازة", holiday:"إجازة رسمية", weekend:"عطلة" };
  return m[s] ?? s;
}

export default function Attendance() {
  const { user, authFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const canManage = hasPermission(user, "can_manage_attendance");

  const [activeTab, setActiveTab] = useState("records");
  const [from, setFrom]     = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]!; });
  const [to, setTo]         = useState(() => new Date().toISOString().split("T")[0]!);
  const [empFilter, setEmpFilter] = useState("");
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [checkInForm, setCheckInForm] = useState({ employee_id: "", attendance_date: new Date().toISOString().split("T")[0]!, check_in_time: "", notes: "" });
  const [shiftForm, setShiftForm] = useState({ name_ar: "", name_en: "", start_time: "09:00", end_time: "17:00", break_duration: "60", grace_minutes: "5", weekly_hours: "40" });
  const [holidayForm, setHolidayForm] = useState({ holiday_date: "", name_ar: "", name_en: "" });

  const f = useCallback(async (url: string, opts?: RequestInit) => {
    const r = await authFetch(`${BASE}${url}`, opts);
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as AnyRec).error as string || "خطأ"); }
    return r.json();
  }, [authFetch]);

  const today = new Date().toISOString().split("T")[0];
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

  const doCheckIn  = useMutation({ mutationFn: (d: AnyRec) => f("/api/attendance/check-in",  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts(["attendance", from, to, empFilter], "تم تسجيل الحضور") });
  const createShift = useMutation({ mutationFn: (d: AnyRec) => f("/api/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("shifts", "تم إنشاء الوردية") });
  const createHoliday = useMutation({ mutationFn: (d: AnyRec) => f("/api/public-holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ...mutOpts("public-holidays", "تم إضافة الإجازة الرسمية") });

  const safeArr = (v: unknown) => (Array.isArray(v) ? v : []) as AnyRec[];
  const recordsList  = safeArr(records.data);
  const shiftsList   = safeArr(shifts.data);
  const holidaysList = safeArr(holidays.data);
  const overtimeList = safeArr(overtime.data);

  const present = recordsList.filter(r => r.status === "present" || r.status === "late").length;
  const absent  = recordsList.filter(r => r.status === "absent").length;
  const late    = recordsList.filter(r => r.status === "late").length;

  function submitCheckIn(e: React.FormEvent) {
    e.preventDefault();
    doCheckIn.mutate({ ...checkInForm, attendance_date: checkInForm.attendance_date || today, check_in_time: checkInForm.check_in_time || new Date().toTimeString().substring(0, 5) }, { onSuccess: () => { setShowCheckIn(false); setCheckInForm({ employee_id: "", attendance_date: today!, check_in_time: "", notes: "" }); } });
  }
  function submitShift(e: React.FormEvent) {
    e.preventDefault();
    createShift.mutate(shiftForm, { onSuccess: () => { setShowShiftForm(false); setShiftForm({ name_ar: "", name_en: "", start_time: "09:00", end_time: "17:00", break_duration: "60", grace_minutes: "5", weekly_hours: "40" }); } });
  }
  function submitHoliday(e: React.FormEvent) {
    e.preventDefault();
    createHoliday.mutate(holidayForm, { onSuccess: () => { setShowHolidayForm(false); setHolidayForm({ holiday_date: "", name_ar: "", name_en: "" }); } });
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">الحضور والانصراف</h1>
        {canManage && (
          <Button onClick={() => setShowCheckIn(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
            + تسجيل حضور
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي السجلات", val: recordsList.length, color: "text-white" },
          { label: "حاضر", val: present, color: "text-emerald-400" },
          { label: "غائب", val: absent, color: "text-red-400" },
          { label: "متأخر", val: late, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Check-In Modal */}
      {showCheckIn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={submitCheckIn} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">تسجيل حضور</h2>
            <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="رقم الموظف" value={checkInForm.employee_id} onChange={e => setCheckInForm(p => ({ ...p, employee_id: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/50 mb-1 block">التاريخ</label><Input type="date" className="bg-white/5 border-white/10 text-white" value={checkInForm.attendance_date} onChange={e => setCheckInForm(p => ({ ...p, attendance_date: e.target.value }))} /></div>
              <div><label className="text-xs text-white/50 mb-1 block">وقت الحضور</label><Input type="time" className="bg-white/5 border-white/10 text-white" value={checkInForm.check_in_time} onChange={e => setCheckInForm(p => ({ ...p, check_in_time: e.target.value }))} /></div>
            </div>
            <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="ملاحظات" value={checkInForm.notes} onChange={e => setCheckInForm(p => ({ ...p, notes: e.target.value }))} />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCheckIn(false)} className="border-white/20 text-white">إلغاء</Button>
              <Button type="submit" disabled={doCheckIn.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{doCheckIn.isPending ? "جاري..." : "تسجيل"}</Button>
            </div>
          </form>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="records"  className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">سجلات الحضور</TabsTrigger>
          <TabsTrigger value="shifts"   className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الورديات</TabsTrigger>
          <TabsTrigger value="overtime" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">العمل الإضافي</TabsTrigger>
          <TabsTrigger value="holidays" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">الإجازات الرسمية</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">من:</label>
              <Input type="date" className="bg-white/5 border-white/10 text-white w-36" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/50">إلى:</label>
              <Input type="date" className="bg-white/5 border-white/10 text-white w-36" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <Input className="bg-white/5 border-white/10 text-white w-40" placeholder="رقم الموظف" value={empFilter} onChange={e => setEmpFilter(e.target.value)} />
          </div>

          {records.isLoading ? (
            <div className="text-center py-12 text-white/40">جاري التحميل...</div>
          ) : recordsList.length === 0 ? (
            <div className="text-center py-12 text-white/40">لا توجد سجلات حضور للفترة المحددة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-right pb-3">الموظف</th>
                    <th className="text-right pb-3">التاريخ</th>
                    <th className="text-right pb-3">الحضور</th>
                    <th className="text-right pb-3">الانصراف</th>
                    <th className="text-right pb-3">ساعات العمل</th>
                    <th className="text-right pb-3">التأخير</th>
                    <th className="text-right pb-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recordsList.map((r) => (
                    <tr key={String(r.id)} className="hover:bg-white/3">
                      <td className="py-3 text-white">{String(r.first_name_ar ?? "")} {String(r.last_name_ar ?? "")}</td>
                      <td className="py-3 text-white/70">{String(r.attendance_date)}</td>
                      <td className="py-3 text-emerald-400">{r.check_in_time ? String(r.check_in_time) : "—"}</td>
                      <td className="py-3 text-red-400">{r.check_out_time ? String(r.check_out_time) : "—"}</td>
                      <td className="py-3 text-white">{r.working_hours ? `${Number(r.working_hours).toFixed(1)} س` : "—"}</td>
                      <td className="py-3 text-amber-400">{r.late_minutes ? `${r.late_minutes} د` : "—"}</td>
                      <td className="py-3"><Badge className={statusColor(String(r.status))}>{statusAr(String(r.status))}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowShiftForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ إنشاء وردية</Button>
          )}
          {showShiftForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitShift} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">وردية جديدة</h2>
                <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="اسم الوردية *" value={shiftForm.name_ar} onChange={e => setShiftForm(p => ({ ...p, name_ar: e.target.value }))} required />
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/50 mb-1 block">وقت البداية</label><Input type="time" className="bg-white/5 border-white/10 text-white" value={shiftForm.start_time} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} /></div>
                  <div><label className="text-xs text-white/50 mb-1 block">وقت النهاية</label><Input type="time" className="bg-white/5 border-white/10 text-white" value={shiftForm.end_time} onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-white/50 mb-1 block">فترة الاستراحة (د)</label><Input type="number" className="bg-white/5 border-white/10 text-white" value={shiftForm.break_duration} onChange={e => setShiftForm(p => ({ ...p, break_duration: e.target.value }))} /></div>
                  <div><label className="text-xs text-white/50 mb-1 block">فترة السماح (د)</label><Input type="number" className="bg-white/5 border-white/10 text-white" value={shiftForm.grace_minutes} onChange={e => setShiftForm(p => ({ ...p, grace_minutes: e.target.value }))} /></div>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowShiftForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createShift.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createShift.isPending ? "جاري..." : "إنشاء"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shiftsList.map(s => (
              <div key={String(s.id)} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="font-bold text-white">{String(s.name_ar)}</div>
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="text-emerald-400">⏰ {String(s.start_time)}</span>
                  <span className="text-red-400">⏱ {String(s.end_time)}</span>
                </div>
                <div className="text-xs text-white/40 mt-2">استراحة: {Number(s.break_duration)} دقيقة • فترة السماح: {Number(s.grace_minutes)} دقيقة</div>
              </div>
            ))}
            {shiftsList.length === 0 && !shifts.isLoading && <div className="col-span-3 text-center py-12 text-white/40">لا توجد ورديات</div>}
          </div>
        </TabsContent>

        <TabsContent value="overtime" className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-right pb-3">الموظف</th>
                  <th className="text-right pb-3">التاريخ</th>
                  <th className="text-right pb-3">الساعات</th>
                  <th className="text-right pb-3">السبب</th>
                  <th className="text-right pb-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {overtimeList.map(o => (
                  <tr key={String(o.id)} className="hover:bg-white/3">
                    <td className="py-3 text-white">{String(o.first_name_ar ?? "")} {String(o.last_name_ar ?? "")}</td>
                    <td className="py-3 text-white/70">{String(o.date)}</td>
                    <td className="py-3 text-amber-400 font-bold">{Number(o.hours).toFixed(1)} ساعة</td>
                    <td className="py-3 text-white/60">{String(o.reason ?? "—")}</td>
                    <td className="py-3"><Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{String(o.status)}</Badge></td>
                  </tr>
                ))}
                {overtimeList.length === 0 && !overtime.isLoading && <tr><td colSpan={5} className="text-center py-12 text-white/40">لا توجد سجلات عمل إضافي</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="holidays" className="space-y-4">
          {canManage && (
            <Button onClick={() => setShowHolidayForm(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">+ إضافة إجازة رسمية</Button>
          )}
          {showHolidayForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form onSubmit={submitHoliday} className="bg-[#1a1f35] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
                <h2 className="text-lg font-bold text-white">إجازة رسمية جديدة</h2>
                <Input type="date" className="bg-white/5 border-white/10 text-white" value={holidayForm.holiday_date} onChange={e => setHolidayForm(p => ({ ...p, holiday_date: e.target.value }))} required />
                <Input className="bg-white/5 border-white/10 text-white text-right" placeholder="اسم الإجازة *" value={holidayForm.name_ar} onChange={e => setHolidayForm(p => ({ ...p, name_ar: e.target.value }))} required />
                <Input className="bg-white/5 border-white/10 text-white" placeholder="Holiday Name" value={holidayForm.name_en} onChange={e => setHolidayForm(p => ({ ...p, name_en: e.target.value }))} />
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowHolidayForm(false)} className="border-white/20 text-white">إلغاء</Button>
                  <Button type="submit" disabled={createHoliday.isPending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">{createHoliday.isPending ? "جاري..." : "إضافة"}</Button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holidaysList.map(h => (
              <div key={String(h.id)} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 font-bold text-sm">{String(h.holiday_date).substring(8, 10)}<br/><span className="text-xs">{String(h.holiday_date).substring(5, 7)}</span></div>
                <div><div className="font-bold text-white">{String(h.name_ar)}</div><div className="text-xs text-white/40">{String(h.holiday_date)}</div></div>
              </div>
            ))}
            {holidaysList.length === 0 && !holidays.isLoading && <div className="col-span-3 text-center py-12 text-white/40">لا توجد إجازات رسمية</div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
