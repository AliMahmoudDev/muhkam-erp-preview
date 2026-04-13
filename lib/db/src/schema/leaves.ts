import {
  pgTable, serial, text, integer, timestamp, numeric, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

/* ── Leave Types ─────────────────────────────────────────────── */
export const leaveTypesTable = pgTable("leave_types", {
  id:                 serial("id").primaryKey(),
  company_id:         integer("company_id").notNull().default(1).references(() => companiesTable.id),
  name_en:            text("name_en").notNull(),
  name_ar:            text("name_ar").notNull(),
  code:               text("code").notNull(),
  is_paid:            boolean("is_paid").notNull().default(true),
  requires_approval:  boolean("requires_approval").notNull().default(true),
  carryover_allowed:  boolean("carryover_allowed").notNull().default(false),
  carryover_limit:    integer("carryover_limit").default(0),
  is_active:          boolean("is_active").notNull().default(true),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_types_company_idx").on(t.company_id),
]);

export const insertLeaveTypeSchema = createInsertSchema(leaveTypesTable).omit({ id: true, created_at: true });
export type LeaveType = typeof leaveTypesTable.$inferSelect;

/* ── Leave Policies ──────────────────────────────────────────── */
export const leavePoliciesTable = pgTable("leave_policies", {
  id:                      serial("id").primaryKey(),
  company_id:              integer("company_id").notNull().default(1).references(() => companiesTable.id),
  leave_type_id:           integer("leave_type_id").notNull().references(() => leaveTypesTable.id),
  entitlement_days_per_year: integer("entitlement_days_per_year").notNull().default(21),
  accrual_method:          text("accrual_method").notNull().default("fixed"), // fixed | percentage | custom
  min_duration:            numeric("min_duration", { precision: 4, scale: 1 }).notNull().default("1"),
  max_consecutive_days:    integer("max_consecutive_days").default(30),
  probation_days:          integer("probation_days").default(90),
  created_at:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_policy_company_idx").on(t.company_id),
  index("leave_policy_type_idx").on(t.leave_type_id),
]);

export const insertLeavePolicySchema = createInsertSchema(leavePoliciesTable).omit({ id: true, created_at: true, updated_at: true });
export type LeavePolicy = typeof leavePoliciesTable.$inferSelect;

/* ── Employee Leave Balances ─────────────────────────────────── */
export const employeeLeaveBalancesTable = pgTable("employee_leave_balances", {
  id:              serial("id").primaryKey(),
  employee_id:     integer("employee_id").notNull().references(() => employeesTable.id),
  leave_type_id:   integer("leave_type_id").notNull().references(() => leaveTypesTable.id),
  accrued_days:    numeric("accrued_days", { precision: 7, scale: 2 }).notNull().default("0"),
  used_days:       numeric("used_days", { precision: 7, scale: 2 }).notNull().default("0"),
  balance_days:    numeric("balance_days", { precision: 7, scale: 2 }).notNull().default("0"),
  carryover_days:  numeric("carryover_days", { precision: 7, scale: 2 }).notNull().default("0"),
  as_of_date:      text("as_of_date").notNull(),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_balance_emp_idx").on(t.employee_id),
  index("leave_balance_emp_type_idx").on(t.employee_id, t.leave_type_id),
]);

export type EmployeeLeaveBalance = typeof employeeLeaveBalancesTable.$inferSelect;

/* ── Leave Requests ──────────────────────────────────────────── */
export const leaveRequestsTable = pgTable("leave_requests", {
  id:              serial("id").primaryKey(),
  employee_id:     integer("employee_id").notNull().references(() => employeesTable.id),
  leave_type_id:   integer("leave_type_id").notNull().references(() => leaveTypesTable.id),
  start_date:      text("start_date").notNull(),
  end_date:        text("end_date").notNull(),
  total_days:      numeric("total_days", { precision: 5, scale: 1 }).notNull(),
  status:          text("status").notNull().default("pending"), // pending | approved | rejected | cancelled
  reason:          text("reason"),
  rejection_reason:text("rejection_reason"),
  submitted_at:    timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  approved_by:     integer("approved_by"),
  approved_at:     timestamp("approved_at", { withTimezone: true }),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_req_emp_idx").on(t.employee_id),
  index("leave_req_status_idx").on(t.status),
  index("leave_req_type_idx").on(t.leave_type_id),
]);

export const insertLeaveRequestSchema = createInsertSchema(leaveRequestsTable).omit({ id: true, created_at: true, updated_at: true, submitted_at: true });
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;

/* ── Leave Approvals ─────────────────────────────────────────── */
export const leaveApprovalsTable = pgTable("leave_approvals", {
  id:               serial("id").primaryKey(),
  leave_request_id: integer("leave_request_id").notNull().references(() => leaveRequestsTable.id),
  approver_id:      integer("approver_id").notNull(),
  status:           text("status").notNull(), // approved | rejected
  comment:          text("comment"),
  approved_at:      timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_approvals_req_idx").on(t.leave_request_id),
]);

export type LeaveApproval = typeof leaveApprovalsTable.$inferSelect;

/* ── Leave Accrual History ───────────────────────────────────── */
export const leaveAccrualHistoryTable = pgTable("leave_accrual_history", {
  id:            serial("id").primaryKey(),
  employee_id:   integer("employee_id").notNull().references(() => employeesTable.id),
  leave_type_id: integer("leave_type_id").notNull().references(() => leaveTypesTable.id),
  accrued_days:  numeric("accrued_days", { precision: 7, scale: 2 }).notNull(),
  month:         text("month").notNull(), // YYYY-MM
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_accrual_emp_idx").on(t.employee_id),
  index("leave_accrual_month_idx").on(t.month),
]);

export type LeaveAccrualHistory = typeof leaveAccrualHistoryTable.$inferSelect;

/* ── Leave Blackout Dates ────────────────────────────────────── */
export const leaveBlackoutDatesTable = pgTable("leave_blackout_dates", {
  id:          serial("id").primaryKey(),
  company_id:  integer("company_id").notNull().default(1).references(() => companiesTable.id),
  start_date:  text("start_date").notNull(),
  end_date:    text("end_date").notNull(),
  reason_en:   text("reason_en"),
  reason_ar:   text("reason_ar"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("leave_blackout_company_idx").on(t.company_id),
]);

export type LeaveBlackoutDate = typeof leaveBlackoutDatesTable.$inferSelect;
