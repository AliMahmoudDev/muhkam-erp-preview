import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { accountsTable } from "./accounts";
import { journalEntriesTable } from "./accounts";

export const accrualsTable = pgTable("accruals", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  total_amount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  months_total: integer("months_total").notNull(),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  expense_account_id: integer("expense_account_id").references(() => accountsTable.id),
  prepaid_account_id: integer("prepaid_account_id").references(() => accountsTable.id),
  amount_recognized: numeric("amount_recognized", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("accruals_company_id_idx").on(t.company_id),
  index("accruals_status_idx").on(t.status),
]);

export const accrualRunsTable = pgTable("accrual_runs", {
  id: serial("id").primaryKey(),
  accrual_id: integer("accrual_id").notNull().references(() => accrualsTable.id),
  period: text("period").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  entry_id: integer("entry_id").references(() => journalEntriesTable.id),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("accrual_runs_accrual_id_idx").on(t.accrual_id),
  index("accrual_runs_company_id_idx").on(t.company_id),
]);

export type Accrual = typeof accrualsTable.$inferSelect;
export type AccrualRun = typeof accrualRunsTable.$inferSelect;
