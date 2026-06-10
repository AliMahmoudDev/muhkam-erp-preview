import {
  pgTable, serial, text, integer, timestamp, numeric, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

/* ── Salary Advance Settings ─────────────────────────────────── */
export const salaryAdvanceSettingsTable = pgTable("salary_advance_settings", {
  id:                        serial("id").primaryKey(),
  company_id:                integer("company_id").notNull().references(() => companiesTable.id),
  max_advance_percentage:    numeric("max_advance_percentage", { precision: 5, scale: 2 }).notNull().default("50"),
  max_concurrent_advances:   integer("max_concurrent_advances").notNull().default(2),
  min_salary_for_advance:    numeric("min_salary_for_advance", { precision: 14, scale: 2 }).notNull().default("3000"),
  repayment_tenure_months:   integer("repayment_tenure_months").notNull().default(1),
  requires_approval:         boolean("requires_approval").notNull().default(true),
  created_at:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("salary_advance_settings_company_idx").on(t.company_id),
]);

export type SalaryAdvanceSettings = typeof salaryAdvanceSettingsTable.$inferSelect;

/* ── Salary Advances ─────────────────────────────────────────── */
export const salaryAdvancesTable = pgTable("salary_advances", {
  id:               serial("id").primaryKey(),
  company_id:       integer("company_id").notNull().references(() => companiesTable.id),
  employee_id:      integer("employee_id").notNull().references(() => employeesTable.id),
  requested_date:   text("requested_date").notNull(),
  requested_amount: numeric("requested_amount", { precision: 14, scale: 2 }).notNull(),
  approved_amount:  numeric("approved_amount", { precision: 14, scale: 2 }),
  advance_type:     text("advance_type").notNull().default("personal"),
  // emergency | personal | medical | educational | other
  reason:           text("reason"),
  status:           text("status").notNull().default("pending"),
  // pending | approved | rejected | active | completed | cancelled
  approver_id:      integer("approver_id"),
  approved_at:      timestamp("approved_at", { withTimezone: true }),
  rejection_reason: text("rejection_reason"),
  remaining_balance:numeric("remaining_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  currency:         text("currency").notNull().default("EGP"),
  deduct_from:      text("deduct_from").notNull().default("fixed"),
  // fixed | commission | both — which earnings the deduction applies against
  safe_id:          integer("safe_id"),
  // optional: which cash safe (خزينة) the advance was disbursed from
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("salary_advances_emp_idx").on(t.employee_id),
  index("salary_advances_status_idx").on(t.status),
]);

export const insertSalaryAdvanceSchema = createInsertSchema(salaryAdvancesTable).omit({ id: true, created_at: true, updated_at: true });
export type SalaryAdvance = typeof salaryAdvancesTable.$inferSelect;

/* ── Salary Advance Deductions ───────────────────────────────── */
export const salaryAdvanceDeductionsTable = pgTable("salary_advance_deductions", {
  id:                 serial("id").primaryKey(),
  salary_advance_id:  integer("salary_advance_id").notNull().references(() => salaryAdvancesTable.id),
  payroll_record_id:  integer("payroll_record_id"), // no FK (cross-module ref)
  deduction_amount:   numeric("deduction_amount", { precision: 14, scale: 2 }).notNull(),
  deduction_date:     text("deduction_date").notNull(),
  notes:              text("notes"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("salary_adv_deduct_advance_idx").on(t.salary_advance_id),
]);

export type SalaryAdvanceDeduction = typeof salaryAdvanceDeductionsTable.$inferSelect;

/* ── Salary Advance History ──────────────────────────────────── */
export const salaryAdvanceHistoryTable = pgTable("salary_advance_history", {
  id:               serial("id").primaryKey(),
  salary_advance_id:integer("salary_advance_id").notNull().references(() => salaryAdvancesTable.id),
  old_status:       text("old_status"),
  new_status:       text("new_status").notNull(),
  changed_by:       integer("changed_by"),
  comment:          text("comment"),
  changed_at:       timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("salary_adv_history_advance_idx").on(t.salary_advance_id),
]);

export type SalaryAdvanceHistory = typeof salaryAdvanceHistoryTable.$inferSelect;

/* ── Salary Advance Ledger ───────────────────────────────────── */
export const salaryAdvanceLedgerTable = pgTable("salary_advance_ledger", {
  id:           serial("id").primaryKey(),
  employee_id:  integer("employee_id").notNull().references(() => employeesTable.id),
  advance_id:   integer("advance_id").notNull().references(() => salaryAdvancesTable.id),
  ledger_type:  text("ledger_type").notNull(),
  // advance_granted | deduction | manual_payment | reversal
  amount:       numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balance:      numeric("balance", { precision: 14, scale: 2 }).notNull(),
  ledger_date:  text("ledger_date").notNull(),
  notes:        text("notes"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("salary_adv_ledger_emp_idx").on(t.employee_id),
  index("salary_adv_ledger_advance_idx").on(t.advance_id),
]);

export type SalaryAdvanceLedger = typeof salaryAdvanceLedgerTable.$inferSelect;
