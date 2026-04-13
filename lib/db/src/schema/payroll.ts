import {
  pgTable, serial, text, integer, timestamp, numeric, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

/* ── Salary Structures ───────────────────────────────────────── */
export const salaryStructuresTable = pgTable("salary_structures", {
  id:          serial("id").primaryKey(),
  company_id:  integer("company_id").notNull().default(1).references(() => companiesTable.id),
  name_en:     text("name_en").notNull(),
  name_ar:     text("name_ar").notNull(),
  base_salary: numeric("base_salary", { precision: 14, scale: 2 }).notNull().default("0"),
  description: text("description"),
  is_active:   boolean("is_active").notNull().default(true),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("sal_struct_company_idx").on(t.company_id),
]);

export const insertSalaryStructureSchema = createInsertSchema(salaryStructuresTable).omit({ id: true, created_at: true, updated_at: true });
export type SalaryStructure = typeof salaryStructuresTable.$inferSelect;

/* ── Salary Components ───────────────────────────────────────── */
export const salaryComponentsTable = pgTable("salary_components", {
  id:                    serial("id").primaryKey(),
  salary_structure_id:   integer("salary_structure_id").notNull().references(() => salaryStructuresTable.id),
  component_type:        text("component_type").notNull(), // allowance | deduction | tax
  name_en:               text("name_en").notNull(),
  name_ar:               text("name_ar").notNull(),
  amount:                numeric("amount", { precision: 14, scale: 2 }),
  percentage_of_base:    numeric("percentage_of_base", { precision: 7, scale: 4 }),
  is_mandatory:          boolean("is_mandatory").notNull().default(false),
  is_taxable:            boolean("is_taxable").notNull().default(false),
  sequence:              integer("sequence").notNull().default(0),
  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("sal_comp_struct_idx").on(t.salary_structure_id),
]);

export const insertSalaryComponentSchema = createInsertSchema(salaryComponentsTable).omit({ id: true, created_at: true });
export type SalaryComponent = typeof salaryComponentsTable.$inferSelect;

/* ── Tax Brackets ────────────────────────────────────────────── */
export const taxBracketsTable = pgTable("tax_brackets", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull().default(1).references(() => companiesTable.id),
  fiscal_year:  text("fiscal_year").notNull(),
  min_salary:   numeric("min_salary", { precision: 14, scale: 2 }).notNull().default("0"),
  max_salary:   numeric("max_salary", { precision: 14, scale: 2 }),
  tax_rate:     numeric("tax_rate", { precision: 7, scale: 4 }).notNull(),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("tax_brackets_company_year_idx").on(t.company_id, t.fiscal_year),
]);

export const insertTaxBracketSchema = createInsertSchema(taxBracketsTable).omit({ id: true, created_at: true });
export type TaxBracket = typeof taxBracketsTable.$inferSelect;

/* ── Statutory Contributions ─────────────────────────────────── */
export const statutoryContributionsTable = pgTable("statutory_contributions", {
  id:                    serial("id").primaryKey(),
  company_id:            integer("company_id").notNull().default(1).references(() => companiesTable.id),
  contribution_type:     text("contribution_type").notNull(), // social_insurance | health_insurance | pension | other
  name_ar:               text("name_ar").notNull(),
  name_en:               text("name_en").notNull(),
  employee_percentage:   numeric("employee_percentage", { precision: 7, scale: 4 }).notNull().default("0"),
  employer_percentage:   numeric("employer_percentage", { precision: 7, scale: 4 }).notNull().default("0"),
  is_mandatory:          boolean("is_mandatory").notNull().default(true),
  is_active:             boolean("is_active").notNull().default(true),
  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("statutory_contrib_company_idx").on(t.company_id),
]);

export const insertStatutoryContributionSchema = createInsertSchema(statutoryContributionsTable).omit({ id: true, created_at: true });
export type StatutoryContribution = typeof statutoryContributionsTable.$inferSelect;

/* ── Payroll Periods ─────────────────────────────────────────── */
export const payrollPeriodsTable = pgTable("payroll_periods", {
  id:             serial("id").primaryKey(),
  company_id:     integer("company_id").notNull().default(1).references(() => companiesTable.id),
  name:           text("name").notNull(),
  start_date:     text("start_date").notNull(),
  end_date:       text("end_date").notNull(),
  status:         text("status").notNull().default("draft"), // draft | processing | approved | paid | cancelled
  processed_by:   integer("processed_by"),
  processed_at:   timestamp("processed_at", { withTimezone: true }),
  notes:          text("notes"),
  created_at:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("payroll_periods_company_idx").on(t.company_id),
  index("payroll_periods_status_idx").on(t.company_id, t.status),
]);

export const insertPayrollPeriodSchema = createInsertSchema(payrollPeriodsTable).omit({ id: true, created_at: true, updated_at: true });
export type PayrollPeriod = typeof payrollPeriodsTable.$inferSelect;

/* ── Payroll Records ─────────────────────────────────────────── */
export const payrollRecordsTable = pgTable("payroll_records", {
  id:                serial("id").primaryKey(),
  payroll_period_id: integer("payroll_period_id").notNull().references(() => payrollPeriodsTable.id),
  employee_id:       integer("employee_id").notNull().references(() => employeesTable.id),
  gross_salary:      numeric("gross_salary", { precision: 14, scale: 2 }).notNull().default("0"),
  total_allowances:  numeric("total_allowances", { precision: 14, scale: 2 }).notNull().default("0"),
  total_deductions:  numeric("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
  tax_amount:        numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  net_salary:        numeric("net_salary", { precision: 14, scale: 2 }).notNull().default("0"),
  advance_deductions:numeric("advance_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
  incentive_amount:  numeric("incentive_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency:          text("currency").notNull().default("EGP"),
  status:            text("status").notNull().default("draft"), // draft | approved | rejected | paid
  notes:             text("notes"),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("payroll_records_period_idx").on(t.payroll_period_id),
  index("payroll_records_employee_idx").on(t.employee_id),
  index("payroll_records_status_idx").on(t.status),
]);

export const insertPayrollRecordSchema = createInsertSchema(payrollRecordsTable).omit({ id: true, created_at: true, updated_at: true });
export type PayrollRecord = typeof payrollRecordsTable.$inferSelect;

/* ── Payroll Line Items ──────────────────────────────────────── */
export const payrollLineItemsTable = pgTable("payroll_line_items", {
  id:                 serial("id").primaryKey(),
  payroll_record_id:  integer("payroll_record_id").notNull().references(() => payrollRecordsTable.id),
  component_name:     text("component_name").notNull(),
  component_type:     text("component_type").notNull(), // allowance | deduction | tax | advance | incentive
  amount:             numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description:        text("description"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("payroll_line_items_record_idx").on(t.payroll_record_id),
]);

export type PayrollLineItem = typeof payrollLineItemsTable.$inferSelect;

/* ── Salary History ──────────────────────────────────────────── */
export const salaryHistoryTable = pgTable("salary_history", {
  id:              serial("id").primaryKey(),
  employee_id:     integer("employee_id").notNull().references(() => employeesTable.id),
  salary_amount:   numeric("salary_amount", { precision: 14, scale: 2 }).notNull(),
  currency:        text("currency").notNull().default("EGP"),
  effective_date:  text("effective_date").notNull(),
  reason:          text("reason"),
  created_by:      integer("created_by"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("salary_history_employee_idx").on(t.employee_id),
]);

export type SalaryHistory = typeof salaryHistoryTable.$inferSelect;

/* ── Payroll Adjustments ─────────────────────────────────────── */
export const payrollAdjustmentsTable = pgTable("payroll_adjustments", {
  id:                 serial("id").primaryKey(),
  payroll_record_id:  integer("payroll_record_id").notNull().references(() => payrollRecordsTable.id),
  adjustment_type:    text("adjustment_type").notNull(), // bonus | penalty | correction | other
  amount:             numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason:             text("reason").notNull(),
  approved_by:        integer("approved_by"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("payroll_adjustments_record_idx").on(t.payroll_record_id),
]);

export type PayrollAdjustment = typeof payrollAdjustmentsTable.$inferSelect;
