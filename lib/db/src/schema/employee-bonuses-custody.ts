import {
  pgTable, serial, text, integer, timestamp, numeric, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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

/* ── Employee Deductions (الخصومات) ───────────────────────────────
 * خصومات مستقلة لا تحتاج سلفة:
 *   late      — تأخير
 *   absence   — غياب
 *   damage    — تلف قطعة غيار / مخزون
 *   other     — أخرى
 */
export const employeeDeductionsTable = pgTable("employee_deductions", {
  id:              serial("id").primaryKey(),
  company_id:      integer("company_id").notNull().references(() => companiesTable.id),
  employee_id:     integer("employee_id").notNull().references(() => employeesTable.id),
  deduction_type:  text("deduction_type").notNull().default("other"), // late | absence | damage | other
  amount:          numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason:          text("reason"),
  deduction_date:  text("deduction_date").notNull(),
  currency:        text("currency").notNull().default("EGP"),
  created_by:      integer("created_by"),
  /** ربط الخصم بسجل حضور (لمنع التكرار في الاحتساب الشهري) */
  attendance_record_id: integer("attendance_record_id"),
  /** نوع توليد الخصم: manual = يدوي، auto_late = تأخير تلقائي، auto_early = انصراف مبكر تلقائي، auto_absence = غياب تلقائي */
  source:          text("source").notNull().default("manual"),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deleted_at:      timestamp("deleted_at", { withTimezone: true }),
}, t => [
  index("emp_deduct_company_idx").on(t.company_id),
  index("emp_deduct_employee_idx").on(t.employee_id),
  index("emp_deduct_type_idx").on(t.company_id, t.deduction_type),
  index("emp_deduct_att_rec_idx").on(t.attendance_record_id, t.source),
]);

export type EmployeeDeduction = typeof employeeDeductionsTable.$inferSelect;

/* ── Employee Commission Ledger (دفتر عمولات الموظف) ────────────────
 *
 * دفتر أستاذ عام قابل للتوسع لجميع حركات عمولات وتسويات الموظف.
 *
 * قاعدة الرصيد:
 *   amount > 0  → دخل (commission_earned, bonus, incentive, adjustment+)
 *   amount < 0  → صرف أو استرداد (payout, reversal, adjustment-)
 *
 * balance = SUM(amount)  — دائماً متسق، لا يُخزَّن
 *
 * entry_type الحالية: commission_earned | payout | reversal | bonus | adjustment | incentive
 * قابلة للتوسع مستقبلاً دون تغيير البنية.
 *
 * Business rules:
 *   - Warranty job  → NO entry (no commission impact)
 *   - Cash refund   → reversal entry, amount negative
 *   - Cancellation  → reversal entry, amount negative
 *   - Historical commission_computed → NEVER modified; corrections = new ledger row
 */
export const employeeCommissionLedgerTable = pgTable("employee_commission_ledger", {
  id:             serial("id").primaryKey(),
  company_id:     integer("company_id").notNull().references(() => companiesTable.id),
  employee_id:    integer("employee_id").notNull().references(() => employeesTable.id),
  entry_type:     text("entry_type").notNull(),
  amount:         numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reference_type: text("reference_type"),
  reference_id:   integer("reference_id"),
  reference_no:   text("reference_no"),
  description:    text("description"),
  date:           text("date").notNull(),
  created_by:     integer("created_by"),
  notes:          text("notes"),
  created_at:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("emp_comm_ledger_employee_idx").on(t.employee_id),
  index("emp_comm_ledger_company_idx").on(t.company_id),
  index("emp_comm_ledger_type_idx").on(t.company_id, t.entry_type),
  index("emp_comm_ledger_ref_idx").on(t.reference_type, t.reference_id),
  index("emp_comm_ledger_date_idx").on(t.company_id, t.date),
]);

export const insertEmployeeCommissionLedgerSchema = createInsertSchema(employeeCommissionLedgerTable).omit({ id: true, created_at: true });
export type EmployeeCommissionLedger = typeof employeeCommissionLedgerTable.$inferSelect;
