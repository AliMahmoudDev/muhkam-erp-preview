import {
  pgTable, serial, text, integer, timestamp, numeric, index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { employeesTable } from "./employees";

/* ── Employee Bonuses / Incentives (الحافز) ──────────────────────── */
export const employeeBonusesTable = pgTable("employee_bonuses", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull().references(() => companiesTable.id),
  employee_id:  integer("employee_id").notNull().references(() => employeesTable.id),
  amount:       numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason:       text("reason"),
  granted_date: text("granted_date").notNull(),
  granted_by:   integer("granted_by"),
  currency:     text("currency").notNull().default("EGP"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_bonus_company_idx").on(t.company_id),
  index("emp_bonus_employee_idx").on(t.employee_id),
]);

export type EmployeeBonus = typeof employeeBonusesTable.$inferSelect;

/* ── Employee Custody / Imprest (عهدة) ───────────────────────────── */
export const employeeCustodyTable = pgTable("employee_custody", {
  id:              serial("id").primaryKey(),
  company_id:      integer("company_id").notNull().references(() => companiesTable.id),
  employee_id:     integer("employee_id").notNull().references(() => employeesTable.id),
  safe_id:         integer("safe_id"),
  amount:          numeric("amount", { precision: 14, scale: 2 }).notNull(),
  returned_amount: numeric("returned_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  purpose:         text("purpose"),
  granted_date:    text("granted_date").notNull(),
  settled_date:    text("settled_date"),
  status:          text("status").notNull().default("open"), // open | settled
  granted_by:      integer("granted_by"),
  currency:        text("currency").notNull().default("EGP"),
  notes:           text("notes"),
  /** المبلغ المستحق للموظف بعد التسوية (لو الموظف صرف أكثر من قيمة العهدة) */
  reimbursement_due: numeric("reimbursement_due", { precision: 14, scale: 2 }).notNull().default("0"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_custody_company_idx").on(t.company_id),
  index("emp_custody_employee_idx").on(t.employee_id),
  index("emp_custody_status_idx").on(t.company_id, t.status),
]);

export type EmployeeCustody = typeof employeeCustodyTable.$inferSelect;

/* ── Employee Custody Lines (بنود تسوية العهدة) ─────────────────── */
export const employeeCustodyLinesTable = pgTable("employee_custody_lines", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull().references(() => companiesTable.id),
  custody_id:   integer("custody_id").notNull().references(() => employeeCustodyTable.id, { onDelete: "cascade" }),
  /** اسم تصنيف المصروف (نخزّنه نصاً تماشياً مع expensesTable.category) */
  category:     text("category").notNull(),
  amount:       numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description:  text("description"),
  line_date:    text("line_date").notNull(),
  /** ربط بسجل المصروف الذي أُنشئ تلقائياً عند التسوية */
  expense_id:   integer("expense_id"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_custody_lines_company_idx").on(t.company_id),
  index("emp_custody_lines_custody_idx").on(t.custody_id),
]);

export type EmployeeCustodyLine = typeof employeeCustodyLinesTable.$inferSelect;
