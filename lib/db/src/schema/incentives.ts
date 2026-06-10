import {
  pgTable, serial, text, integer, timestamp, numeric, boolean, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

/* ── Incentive Schemes ───────────────────────────────────────── */
export const incentiveSchemesTable = pgTable("incentive_schemes", {
  id:          serial("id").primaryKey(),
  company_id:  integer("company_id").notNull().references(() => companiesTable.id),
  name_en:     text("name_en").notNull(),
  name_ar:     text("name_ar").notNull(),
  description: text("description"),
  status:      text("status").notNull().default("active"), // active | paused | archived
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("incentive_schemes_company_idx").on(t.company_id),
]);

export const insertIncentiveSchemeSchema = createInsertSchema(incentiveSchemesTable).omit({ id: true, created_at: true, updated_at: true });
export type IncentiveScheme = typeof incentiveSchemesTable.$inferSelect;

/* ── Incentive Rules ─────────────────────────────────────────── */
export const incentiveRulesTable = pgTable("incentive_rules", {
  id:                  serial("id").primaryKey(),
  incentive_scheme_id: integer("incentive_scheme_id").notNull().references(() => incentiveSchemesTable.id),
  metric_type:         text("metric_type").notNull(),
  // sales_amount | units_sold | invoices_created | customers_acquired | manual
  target_value:        numeric("target_value", { precision: 14, scale: 2 }).notNull(),
  incentive_amount:    numeric("incentive_amount", { precision: 14, scale: 2 }),
  incentive_type:      text("incentive_type").notNull().default("fixed"),
  // fixed | percentage_of_target | per_unit
  calculation_method:  text("calculation_method").notNull().default("achievement"),
  // achievement | slab | tiered
  currency:            text("currency").notNull().default("EGP"),
  is_active:           boolean("is_active").notNull().default(true),
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("incentive_rules_scheme_idx").on(t.incentive_scheme_id),
]);

export const insertIncentiveRuleSchema = createInsertSchema(incentiveRulesTable).omit({ id: true, created_at: true });
export type IncentiveRule = typeof incentiveRulesTable.$inferSelect;

/* ── Incentive Slabs ─────────────────────────────────────────── */
export const incentiveSlabsTable = pgTable("incentive_slabs", {
  id:                serial("id").primaryKey(),
  incentive_rule_id: integer("incentive_rule_id").notNull().references(() => incentiveRulesTable.id),
  slab_number:       integer("slab_number").notNull(),
  from_percentage:   numeric("from_percentage", { precision: 7, scale: 2 }).notNull(),
  to_percentage:     numeric("to_percentage", { precision: 7, scale: 2 }),
  incentive_value:   numeric("incentive_value", { precision: 14, scale: 2 }).notNull(),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("incentive_slabs_rule_idx").on(t.incentive_rule_id),
]);

export type IncentiveSlab = typeof incentiveSlabsTable.$inferSelect;

/* ── Employee Incentive Assignments ─────────────────────────── */
export const employeeIncentiveAssignmentsTable = pgTable("employee_incentive_assignments", {
  id:                  serial("id").primaryKey(),
  employee_id:         integer("employee_id").notNull().references(() => employeesTable.id),
  incentive_scheme_id: integer("incentive_scheme_id").notNull().references(() => incentiveSchemesTable.id),
  assigned_date:       text("assigned_date").notNull(),
  end_date:            text("end_date"),
  status:              text("status").notNull().default("active"), // active | paused | ended
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_incentive_assign_emp_idx").on(t.employee_id),
  index("emp_incentive_assign_scheme_idx").on(t.incentive_scheme_id),
]);

export type EmployeeIncentiveAssignment = typeof employeeIncentiveAssignmentsTable.$inferSelect;

/* ── Daily Incentive Accrual ─────────────────────────────────── */
export const dailyIncentiveAccrualTable = pgTable("daily_incentive_accrual", {
  id:                     serial("id").primaryKey(),
  employee_id:            integer("employee_id").notNull().references(() => employeesTable.id),
  incentive_rule_id:      integer("incentive_rule_id").notNull().references(() => incentiveRulesTable.id),
  accrual_date:           text("accrual_date").notNull(),
  metric_value:           numeric("metric_value", { precision: 14, scale: 2 }).notNull().default("0"),
  target_value:           numeric("target_value", { precision: 14, scale: 2 }).notNull(),
  achievement_percentage: numeric("achievement_percentage", { precision: 7, scale: 2 }).notNull().default("0"),
  accrued_amount:         numeric("accrued_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency:               text("currency").notNull().default("EGP"),
  status:                 text("status").notNull().default("accrued"), // accrued | reversed | included_in_payroll
  created_at:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("daily_accrual_emp_idx").on(t.employee_id),
  index("daily_accrual_date_idx").on(t.accrual_date),
  index("daily_accrual_emp_date_idx").on(t.employee_id, t.accrual_date),
]);

export const insertDailyIncentiveAccrualSchema = createInsertSchema(dailyIncentiveAccrualTable).omit({ id: true, created_at: true });
export type DailyIncentiveAccrual = typeof dailyIncentiveAccrualTable.$inferSelect;

/* ── Monthly Incentive Summary ───────────────────────────────── */
export const monthlyIncentiveSummaryTable = pgTable("monthly_incentive_summary", {
  id:                         serial("id").primaryKey(),
  employee_id:                integer("employee_id").notNull().references(() => employeesTable.id),
  month:                      text("month").notNull(), // YYYY-MM
  total_accrued:              numeric("total_accrued", { precision: 14, scale: 2 }).notNull().default("0"),
  included_in_payroll_record_id: integer("included_in_payroll_record_id"), // no FK (cross-module)
  status:                     text("status").notNull().default("pending"),
  // pending | included_in_payroll | reversed
  created_at:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:                 timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("monthly_incentive_emp_month_idx").on(t.employee_id, t.month),
]);

export type MonthlyIncentiveSummary = typeof monthlyIncentiveSummaryTable.$inferSelect;

/* ── Incentive Metrics ───────────────────────────────────────── */
export const incentiveMetricsTable = pgTable("incentive_metrics", {
  id:                  serial("id").primaryKey(),
  incentive_rule_id:   integer("incentive_rule_id").notNull().references(() => incentiveRulesTable.id),
  employee_id:         integer("employee_id").notNull().references(() => employeesTable.id),
  metric_date:         text("metric_date").notNull(),
  metric_value:        numeric("metric_value", { precision: 14, scale: 2 }).notNull(),
  source_document_id:  integer("source_document_id"),
  source_type:         text("source_type"), // sale | manual | api
  created_at:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("incentive_metrics_emp_date_idx").on(t.employee_id, t.metric_date),
]);

export type IncentiveMetric = typeof incentiveMetricsTable.$inferSelect;
