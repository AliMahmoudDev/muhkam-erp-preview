/**
 * /api/attendance, /api/shifts, /api/public-holidays
 * Attendance tracking with check-in/out, shifts, overtime, and monthly summaries.
 */
import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte, sql, isNull } from "drizzle-orm";
import {
  db,
  attendanceRecordsTable, shiftSchedulesTable, employeeShiftAssignmentsTable,
  overtimeRecordsTable, publicHolidaysTable, attendanceSummaryTable,
  employeesTable,
} from "@workspace/db";
import { wrap } from "../lib/async-handler";
import { hasPermission } from "../lib/permissions";

const router: IRouter = Router();
function fmt(v: Date | null | undefined) { return v instanceof Date ? v.toISOString() : (v ?? null); }

/* ═══════════════════════════════════════════════════════════════════
   SHIFT SCHEDULES
══════════════════════════════════════════════════════════════════════ */

router.get("/shifts", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const rows = await db.select().from(shiftSchedulesTable)
    .where(eq(shiftSchedulesTable.company_id, companyId))
    .orderBy(shiftSchedulesTable.name_ar);
  res.json(rows.map(r => ({ ...r, weekly_hours: Number(r.weekly_hours), created_at: fmt(r.created_at) })));
}));

router.post("/shifts", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { name_ar, name_en, start_time, end_time, break_duration, grace_minutes, weekly_hours, working_days } = req.body as Record<string, unknown>;
  if (!name_ar || !start_time || !end_time) { res.status(400).json({ error: "بيانات الوردية غير مكتملة" }); return; }
  const [row] = await db.insert(shiftSchedulesTable).values({
    company_id: companyId, name_ar: String(name_ar), name_en: String(name_en ?? name_ar),
    start_time: String(start_time), end_time: String(end_time),
    break_duration: Number(break_duration) || 60, grace_minutes: Number(grace_minutes) || 5,
    weekly_hours: String(Number(weekly_hours) || 40), working_days: String(working_days ?? "0,1,2,3,4"),
  }).returning();
  res.status(201).json({ ...row, weekly_hours: Number(row.weekly_hours), created_at: fmt(row.created_at) });
}));

router.put("/shifts/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  const { name_ar, name_en, start_time, end_time, break_duration, grace_minutes, weekly_hours, working_days, is_active } = req.body as Record<string, unknown>;
  const [row] = await db.update(shiftSchedulesTable)
    .set({ name_ar: String(name_ar ?? ""), name_en: String(name_en ?? name_ar ?? ""), start_time: String(start_time ?? ""), end_time: String(end_time ?? ""), break_duration: Number(break_duration) || 60, grace_minutes: Number(grace_minutes) || 5, weekly_hours: String(Number(weekly_hours) || 40), working_days: String(working_days ?? "0,1,2,3,4"), is_active: Boolean(is_active !== false) })
    .where(and(eq(shiftSchedulesTable.id, id), eq(shiftSchedulesTable.company_id, companyId)))
    .returning();
  if (!row) { res.status(404).json({ error: "الوردية غير موجودة" }); return; }
  res.json({ ...row, weekly_hours: Number(row.weekly_hours), created_at: fmt(row.created_at) });
}));

router.delete("/shifts/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(shiftSchedulesTable).where(and(eq(shiftSchedulesTable.id, id), eq(shiftSchedulesTable.company_id, companyId)));
  res.json({ ok: true });
}));

/* ── Employee Shift Assignments ───────────────────────────────── */
router.post("/employee-shifts", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const { employee_id, shift_schedule_id, assigned_date, end_date } = req.body as Record<string, unknown>;
  if (!employee_id || !shift_schedule_id || !assigned_date) { res.status(400).json({ error: "بيانات تعيين الوردية غير مكتملة" }); return; }
  const [row] = await db.insert(employeeShiftAssignmentsTable).values({
    employee_id: Number(employee_id), shift_schedule_id: Number(shift_schedule_id),
    assigned_date: String(assigned_date), end_date: end_date ? String(end_date) : null,
  }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at) });
}));

router.get("/employee-shifts/:employeeId", wrap(async (req, res) => {
  const empId = parseInt(String(req.params["employeeId"]), 10);
  const rows = await db.select({
    id: employeeShiftAssignmentsTable.id,
    employee_id: employeeShiftAssignmentsTable.employee_id,
    shift_schedule_id: employeeShiftAssignmentsTable.shift_schedule_id,
    assigned_date: employeeShiftAssignmentsTable.assigned_date,
    end_date: employeeShiftAssignmentsTable.end_date,
    shift_name_ar: shiftSchedulesTable.name_ar,
    start_time: shiftSchedulesTable.start_time, end_time: shiftSchedulesTable.end_time,
  })
    .from(employeeShiftAssignmentsTable)
    .leftJoin(shiftSchedulesTable, eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id))
    .where(eq(employeeShiftAssignmentsTable.employee_id, empId))
    .orderBy(desc(employeeShiftAssignmentsTable.assigned_date));
  res.json(rows);
}));

/* ═══════════════════════════════════════════════════════════════════
   ATTENDANCE RECORDS
══════════════════════════════════════════════════════════════════════ */

router.get("/attendance/records", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const from     = String(req.query["from"] ?? "");
  const to       = String(req.query["to"] ?? "");
  const empId    = req.query["employee_id"] ? parseInt(String(req.query["employee_id"]), 10) : null;
  const status   = String(req.query["status"] ?? "");

  const conditions = [sql`${employeesTable.company_id} = ${companyId}`];
  if (from) conditions.push(gte(attendanceRecordsTable.attendance_date, from));
  if (to)   conditions.push(lte(attendanceRecordsTable.attendance_date, to));
  if (empId) conditions.push(eq(attendanceRecordsTable.employee_id, empId));
  if (status) conditions.push(eq(attendanceRecordsTable.status, status));

  const rows = await db.select({
    id: attendanceRecordsTable.id, employee_id: attendanceRecordsTable.employee_id,
    attendance_date: attendanceRecordsTable.attendance_date,
    check_in_time: attendanceRecordsTable.check_in_time, check_out_time: attendanceRecordsTable.check_out_time,
    status: attendanceRecordsTable.status, working_hours: attendanceRecordsTable.working_hours,
    late_minutes: attendanceRecordsTable.late_minutes, overtime_hours: attendanceRecordsTable.overtime_hours,
    notes: attendanceRecordsTable.notes, created_at: attendanceRecordsTable.created_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
    employee_code: employeesTable.employee_code,
  })
    .from(attendanceRecordsTable)
    .leftJoin(employeesTable, eq(attendanceRecordsTable.employee_id, employeesTable.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceRecordsTable.attendance_date))
    .limit(200);

  res.json(rows.map(r => ({
    ...r,
    working_hours: r.working_hours != null ? Number(r.working_hours) : null,
    overtime_hours: r.overtime_hours != null ? Number(r.overtime_hours) : null,
    created_at: fmt(r.created_at),
  })));
}));

/* ── Check In ─────────────────────────────────────────────────── */
router.post("/attendance/check-in", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const { employee_id, attendance_date, check_in_time, notes } = req.body as Record<string, unknown>;
  const empId = employee_id ? Number(employee_id) : userId;
  if (!empId) { res.status(400).json({ error: "معرّف الموظف مطلوب" }); return; }

  // Verify employee belongs to company
  const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, Number(empId)), eq(employeesTable.company_id, companyId), isNull(employeesTable.deleted_at)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const date = String(attendance_date ?? new Date().toISOString().split("T")[0]);
  const time = String(check_in_time ?? new Date().toTimeString().substring(0, 5));

  const existing = await db.select({ id: attendanceRecordsTable.id }).from(attendanceRecordsTable)
    .where(and(eq(attendanceRecordsTable.employee_id, Number(empId)), eq(attendanceRecordsTable.attendance_date, date)));
  if (existing.length > 0) { res.status(409).json({ error: "تم تسجيل الحضور لهذا اليوم مسبقاً" }); return; }

  // Get shift to calculate late minutes
  const [assignment] = await db.select({ shift_schedule_id: employeeShiftAssignmentsTable.shift_schedule_id, start_time: shiftSchedulesTable.start_time, grace_minutes: shiftSchedulesTable.grace_minutes })
    .from(employeeShiftAssignmentsTable)
    .leftJoin(shiftSchedulesTable, eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id))
    .where(and(eq(employeeShiftAssignmentsTable.employee_id, Number(empId)), lte(employeeShiftAssignmentsTable.assigned_date, date)))
    .orderBy(desc(employeeShiftAssignmentsTable.assigned_date))
    .limit(1);

  let lateMinutes = 0;
  let status = "present";
  if (assignment?.start_time) {
    const [sh, sm] = assignment.start_time.split(":").map(Number);
    const [ch, cm] = time.split(":").map(Number);
    const shiftStart = sh * 60 + sm;
    const checkIn = ch * 60 + cm;
    const grace = assignment.grace_minutes ?? 5;
    if (checkIn > shiftStart + grace) {
      lateMinutes = checkIn - shiftStart;
      status = "late";
    }
  }

  const [record] = await db.insert(attendanceRecordsTable).values({
    employee_id: Number(empId), attendance_date: date, check_in_time: time,
    status, late_minutes: lateMinutes, notes: (notes as string) ?? null,
    submitted_by: userId,
  }).returning();

  res.status(201).json({ ...record, working_hours: null, overtime_hours: null, created_at: fmt(record.created_at), updated_at: fmt(record.updated_at) });
}));

/* ── Check Out ────────────────────────────────────────────────── */
router.post("/attendance/check-out", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const userId    = req.user?.id ?? null;
  const { employee_id, attendance_date, check_out_time } = req.body as Record<string, unknown>;
  const empId = employee_id ? Number(employee_id) : userId;
  const date = String(attendance_date ?? new Date().toISOString().split("T")[0]);
  const time = String(check_out_time ?? new Date().toTimeString().substring(0, 5));

  const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable)
    .where(and(eq(employeesTable.id, Number(empId)), eq(employeesTable.company_id, companyId)));
  if (!emp) { res.status(404).json({ error: "الموظف غير موجود" }); return; }

  const [existing] = await db.select().from(attendanceRecordsTable)
    .where(and(eq(attendanceRecordsTable.employee_id, Number(empId)), eq(attendanceRecordsTable.attendance_date, date)));
  if (!existing) { res.status(404).json({ error: "لا يوجد تسجيل حضور لهذا اليوم" }); return; }
  if (existing.check_out_time) { res.status(409).json({ error: "تم تسجيل الانصراف مسبقاً" }); return; }

  // Calculate working hours
  let workingHours: number | null = null;
  let overtimeHours = 0;
  if (existing.check_in_time) {
    const [ih, im] = existing.check_in_time.split(":").map(Number);
    const [oh, om] = time.split(":").map(Number);
    workingHours = Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60);

    // Fetch shift to calculate overtime (assume 8h standard)
    const [assignment] = await db.select({ end_time: shiftSchedulesTable.end_time })
      .from(employeeShiftAssignmentsTable)
      .leftJoin(shiftSchedulesTable, eq(employeeShiftAssignmentsTable.shift_schedule_id, shiftSchedulesTable.id))
      .where(and(eq(employeeShiftAssignmentsTable.employee_id, Number(empId)), lte(employeeShiftAssignmentsTable.assigned_date, date)))
      .orderBy(desc(employeeShiftAssignmentsTable.assigned_date)).limit(1);

    if (assignment?.end_time) {
      const [eh, em] = assignment.end_time.split(":").map(Number);
      const [och, ocm] = time.split(":").map(Number);
      const shiftEnd = eh * 60 + em;
      const checkOut = och * 60 + ocm;
      if (checkOut > shiftEnd) {
        overtimeHours = (checkOut - shiftEnd) / 60;
      }
    }
  }

  const [record] = await db.update(attendanceRecordsTable)
    .set({ check_out_time: time, working_hours: workingHours != null ? String(workingHours) : null, overtime_hours: String(overtimeHours), submitted_by: userId, updated_at: new Date() })
    .where(eq(attendanceRecordsTable.id, existing.id))
    .returning();

  res.json({ ...record, working_hours: workingHours, overtime_hours: overtimeHours, created_at: fmt(record.created_at), updated_at: fmt(record.updated_at) });
}));

/* ── Manager Edit Attendance ──────────────────────────────────── */
router.put("/attendance/records/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const id = parseInt(String(req.params["id"]), 10);
  const { check_in_time, check_out_time, status, notes, working_hours, late_minutes, overtime_hours } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date(), verified_by: req.user?.id };
  if (check_in_time  !== undefined) updates["check_in_time"]  = check_in_time;
  if (check_out_time !== undefined) updates["check_out_time"] = check_out_time;
  if (status         !== undefined) updates["status"]         = status;
  if (notes          !== undefined) updates["notes"]          = notes;
  if (working_hours  !== undefined) updates["working_hours"]  = String(Number(working_hours));
  if (late_minutes   !== undefined) updates["late_minutes"]   = Number(late_minutes);
  if (overtime_hours !== undefined) updates["overtime_hours"] = String(Number(overtime_hours));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [record] = await db.update(attendanceRecordsTable).set(updates as any).where(eq(attendanceRecordsTable.id, id)).returning();
  if (!record) { res.status(404).json({ error: "السجل غير موجود" }); return; }
  res.json({ ...record, working_hours: record.working_hours != null ? Number(record.working_hours) : null, overtime_hours: record.overtime_hours != null ? Number(record.overtime_hours) : null, created_at: fmt(record.created_at), updated_at: fmt(record.updated_at) });
}));

/* ── Attendance Summary ───────────────────────────────────────── */
router.get("/attendance/summary/:employeeId", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const empId = parseInt(String(req.params["employeeId"]), 10);
  const month = String(req.query["month"] ?? new Date().toISOString().substring(0, 7));
  const [summary] = await db.select().from(attendanceSummaryTable)
    .where(and(eq(attendanceSummaryTable.employee_id, empId), eq(attendanceSummaryTable.month, month)));
  if (summary) {
    res.json({ ...summary, total_overtime_hours: Number(summary.total_overtime_hours), total_working_hours: Number(summary.total_working_hours), created_at: fmt(summary.created_at), updated_at: fmt(summary.updated_at) });
    return;
  }
  // Compute on-the-fly if no cached summary
  const records = await db.select().from(attendanceRecordsTable)
    .where(and(eq(attendanceRecordsTable.employee_id, empId), sql`LEFT(attendance_date, 7) = ${month}`));
  const computed = {
    employee_id: empId, month,
    total_present_days: records.filter(r => ["present", "late"].includes(r.status)).length,
    total_absent_days: records.filter(r => r.status === "absent").length,
    total_late_days: records.filter(r => r.status === "late").length,
    total_early_departures: records.filter(r => (r.early_departure_minutes ?? 0) > 0).length,
    total_overtime_hours: records.reduce((s, r) => s + Number(r.overtime_hours ?? 0), 0),
    total_working_hours: records.reduce((s, r) => s + Number(r.working_hours ?? 0), 0),
  };
  res.json(computed);
}));

/* ═══════════════════════════════════════════════════════════════════
   OVERTIME
══════════════════════════════════════════════════════════════════════ */

router.get("/attendance/overtime", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_view_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const rows = await db.select({
    id: overtimeRecordsTable.id, employee_id: overtimeRecordsTable.employee_id,
    date: overtimeRecordsTable.date, hours: overtimeRecordsTable.hours,
    reason: overtimeRecordsTable.reason, status: overtimeRecordsTable.status,
    created_at: overtimeRecordsTable.created_at,
    first_name_ar: employeesTable.first_name_ar, last_name_ar: employeesTable.last_name_ar,
  })
    .from(overtimeRecordsTable)
    .leftJoin(employeesTable, eq(overtimeRecordsTable.employee_id, employeesTable.id))
    .where(eq(employeesTable.company_id, companyId))
    .orderBy(desc(overtimeRecordsTable.date))
    .limit(100);
  res.json(rows.map(r => ({ ...r, hours: Number(r.hours), created_at: fmt(r.created_at) })));
}));

router.post("/attendance/overtime", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const userId = req.user?.id ?? null;
  const { employee_id, date, hours, reason } = req.body as Record<string, unknown>;
  if (!employee_id || !date || !hours) { res.status(400).json({ error: "بيانات العمل الإضافي غير مكتملة" }); return; }
  const [row] = await db.insert(overtimeRecordsTable).values({
    employee_id: Number(employee_id), date: String(date), hours: String(Number(hours)),
    reason: (reason as string) ?? null, approved_by: userId, status: "approved",
  }).returning();
  res.status(201).json({ ...row, hours: Number(row.hours), created_at: fmt(row.created_at) });
}));

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC HOLIDAYS
══════════════════════════════════════════════════════════════════════ */

router.get("/public-holidays", wrap(async (req, res) => {
  const companyId = req.user!.company_id!;
  const rows = await db.select().from(publicHolidaysTable)
    .where(eq(publicHolidaysTable.company_id, companyId))
    .orderBy(publicHolidaysTable.holiday_date);
  res.json(rows.map(r => ({ ...r, created_at: fmt(r.created_at) })));
}));

router.post("/public-holidays", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const { holiday_date, name_ar, name_en } = req.body as Record<string, string>;
  if (!holiday_date || !name_ar) { res.status(400).json({ error: "تاريخ ومسمى الإجازة مطلوبان" }); return; }
  const [row] = await db.insert(publicHolidaysTable).values({
    company_id: companyId, holiday_date, name_ar: name_ar.trim(), name_en: name_en?.trim() ?? name_ar.trim(),
  }).returning();
  res.status(201).json({ ...row, created_at: fmt(row.created_at) });
}));

router.delete("/public-holidays/:id", wrap(async (req, res) => {
  if (!hasPermission(req.user, "can_manage_employees")) { res.status(403).json({ error: "غير مصرح" }); return; }
  const companyId = req.user!.company_id!;
  const id = parseInt(String(req.params["id"]), 10);
  await db.delete(publicHolidaysTable).where(and(eq(publicHolidaysTable.id, id), eq(publicHolidaysTable.company_id, companyId)));
  res.json({ ok: true });
}));

export default router;
