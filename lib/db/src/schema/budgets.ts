import { pgTable, serial, text, numeric, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { accountsTable } from "./accounts";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fiscal_year: integer("fiscal_year").notNull(),
  date_from: text("date_from").notNull(),
  date_to: text("date_to").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("budgets_company_id_idx").on(t.company_id),
  index("budgets_fiscal_year_idx").on(t.fiscal_year),
]);

export const budgetLinesTable = pgTable("budget_lines", {
  id: serial("id").primaryKey(),
  budget_id: integer("budget_id").notNull().references(() => budgetsTable.id),
  account_id: integer("account_id").notNull().references(() => accountsTable.id),
  account_code: text("account_code").notNull(),
  account_name: text("account_name").notNull(),
  account_type: text("account_type").notNull(),
  period: text("period").notNull(),
  budgeted_amount: numeric("budgeted_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
}, (t) => [
  index("budget_lines_budget_id_idx").on(t.budget_id),
  index("budget_lines_company_id_idx").on(t.company_id),
  uniqueIndex("budget_lines_unique_idx").on(t.budget_id, t.account_id, t.period),
]);

export type Budget = typeof budgetsTable.$inferSelect;
export type BudgetLine = typeof budgetLinesTable.$inferSelect;
