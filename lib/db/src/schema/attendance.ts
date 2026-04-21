import {
  pgTable, serial, text, integer, timestamp, numeric, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

/* ── Shift Schedules ─────────────────────────────────────────── */
export const shiftSchedulesTable = pgTable("shift_schedules", {
  id:              serial("id").primaryKey(),
  company_id:      integer("company_id").notNull().default(1).references(() => companiesTable.id),
  name_en:         text("name_en").notNull(),
  name_ar:         text("name_ar").notNull(),
  start_time:      text("start_time").notNull(),   // HH:MM format
  end_time:        text("end_time").notNull(),
  break_duration:  integer("break_duration").notNull().default(60), // minutes
  grace_minutes:   integer("grace_minutes").notNull().default(5),
  weekly_hours:    numeric("weekly_hours", { precision: 5, scale: 2 }).notNull().default("40"),
  working_days:    text("working_days").notNull().default("0,1,2,3,4"), // 0=Sun,1=Mon...6=Sat
  is_active:       boolean("is_active").notNull().default(true),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("shifts_company_idx").on(t.company_id),
]);

export const insertShiftScheduleSchema = createInsertSchema(shiftSchedulesTable).omit({ id: true, created_at: true });
export type ShiftSchedule = typeof shiftSchedulesTable.$inferSelect;

/* ── Employee Shift Assignments ──────────────────────────────── */
export const employeeShiftAssignmentsTable = pgTable("employee_shift_assignments", {
  id:               serial("id").primaryKey(),
  employee_id:      integer("employee_id").notNull().references(() => employeesTable.id),
  shift_schedule_id:integer("shift_schedule_id").notNull().references(() => shiftSchedulesTable.id),
  assigned_date:    text("assigned_date").notNull(),
  end_date:         text("end_date"),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_shift_assign_emp_idx").on(t.employee_id),
  index("emp_shift_assign_shift_idx").on(t.shift_schedule_id),
]);

export type EmployeeShiftAssignment = typeof employeeShiftAssignmentsTable.$inferSelect;

/* ── Attendance Records ──────────────────────────────────────── */
export const attendanceRecordsTable = pgTable("attendance_records", {
  id:                       serial("id").primaryKey(),
  employee_id:              integer("employee_id").notNull().references(() => employeesTable.id),
  attendance_date:          text("attendance_date").notNull(),
  check_in_time:            text("check_in_time"),   // HH:MM
  check_out_time:           text("check_out_time"),
  status:                   text("status").notNull().default("present"),
  // present | late | absent | on_leave | holiday | weekend | half_day
  working_hours:            numeric("working_hours", { precision: 5, scale: 2 }),
  late_minutes:             integer("late_minutes").default(0),
  early_departure_minutes:  integer("early_departure_minutes").default(0),
  overtime_hours:           numeric("overtime_hours", { precision: 5, scale: 2 }).default("0"),
  notes:                    text("notes"),
  submitted_by:             integer("submitted_by"),
  verified_by:              integer("verified_by"),
  created_at:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("attendance_emp_idx").on(t.employee_id),
  index("attendance_date_idx").on(t.attendance_date),
  index("attendance_emp_date_idx").on(t.employee_id, t.attendance_date),
]);

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecordsTable).omit({ id: true, created_at: true, updated_at: true });
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;

/* ── Overtime Records ────────────────────────────────────────── */
export const overtimeRecordsTable = pgTable("overtime_records", {
  id:          serial("id").primaryKey(),
  employee_id: integer("employee_id").notNull().references(() => employeesTable.id),
  date:        text("date").notNull(),
  hours:       numeric("hours", { precision: 5, scale: 2 }).notNull(),
  reason:      text("reason"),
  approved_by: integer("approved_by"),
  status:      text("status").notNull().default("pending"), // pending | approved | rejected
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("overtime_emp_idx").on(t.employee_id),
]);

export type OvertimeRecord = typeof overtimeRecordsTable.$inferSelect;

/* ── Public Holidays ─────────────────────────────────────────── */
export const publicHolidaysTable = pgTable("public_holidays", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull().default(1).references(() => companiesTable.id),
  holiday_date: text("holiday_date").notNull(),
  name_en:      text("name_en").notNull(),
  name_ar:      text("name_ar").notNull(),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("holidays_company_idx").on(t.company_id),
]);

export const insertPublicHolidaySchema = createInsertSchema(publicHolidaysTable).omit({ id: true, created_at: true });
export type PublicHoliday = typeof publicHolidaysTable.$inferSelect;

/* ── Attendance Deduction Settings (إعدادات خصومات الحضور) ───── */
export const attendanceDeductionSettingsTable = pgTable("attendance_deduction_settings", {
  id:                          serial("id").primaryKey(),
  company_id:                  integer("company_id").notNull().unique().references(() => companiesTable.id),
  /** فترة السماح بالدقائق قبل بدء احتساب الخصم */
  grace_minutes:               integer("grace_minutes").notNull().default(10),
  /** أيام الإجازة الأسبوعية مفصولة بفاصلة (0=أحد..6=سبت). افتراضي الجمعة */
  weekly_off_days:             text("weekly_off_days").notNull().default("5"),
  /** خصم يوم غياب كامل */
  absence_full_day_amount:     numeric("absence_full_day_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  /** خصم نصف يوم غياب */
  absence_half_day_amount:     numeric("absence_half_day_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  /** تطبيق نفس شرائح التأخير على الانصراف المبكر */
  apply_early_leave:           boolean("apply_early_leave").notNull().default(true),
  updated_at:                  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("att_ded_settings_company_idx").on(t.company_id),
]);

export type AttendanceDeductionSettings = typeof attendanceDeductionSettingsTable.$inferSelect;

/* ── Attendance Deduction Tiers (شرائح خصم التأخير/الانصراف) ─── */
export const attendanceDeductionTiersTable = pgTable("attendance_deduction_tiers", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull().references(() => companiesTable.id),
  /** late = تأخير عن الحضور | early = انصراف مبكر */
  applies_to:   text("applies_to").notNull().default("late"),
  min_minutes:  integer("min_minutes").notNull(),
  /** null = لا يوجد حد أعلى (شريحة مفتوحة) */
  max_minutes:  integer("max_minutes"),
  amount:       numeric("amount", { precision: 14, scale: 2 }).notNull(),
  is_active:    boolean("is_active").notNull().default(true),
  sort_order:   integer("sort_order").notNull().default(0),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("att_ded_tiers_company_idx").on(t.company_id),
  index("att_ded_tiers_type_idx").on(t.company_id, t.applies_to),
]);

export type AttendanceDeductionTier = typeof attendanceDeductionTiersTable.$inferSelect;

/* ── Attendance Summary ──────────────────────────────────────── */
export const attendanceSummaryTable = pgTable("attendance_summary", {
  id:                      serial("id").primaryKey(),
  employee_id:             integer("employee_id").notNull().references(() => employeesTable.id),
  month:                   text("month").notNull(), // YYYY-MM
  total_present_days:      integer("total_present_days").notNull().default(0),
  total_absent_days:       integer("total_absent_days").notNull().default(0),
  total_late_days:         integer("total_late_days").notNull().default(0),
  total_early_departures:  integer("total_early_departures").notNull().default(0),
  total_overtime_hours:    numeric("total_overtime_hours", { precision: 7, scale: 2 }).notNull().default("0"),
  total_working_hours:     numeric("total_working_hours", { precision: 7, scale: 2 }).notNull().default("0"),
  created_at:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("att_summary_emp_month_idx").on(t.employee_id, t.month),
]);

export type AttendanceSummary = typeof attendanceSummaryTable.$inferSelect;
