import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { safesTable } from "./safes";
import { journalEntriesTable } from "./accounts";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  account_number: text("account_number"),
  bank_name: text("bank_name").notNull(),
  currency: text("currency").notNull().default("EGP"),
  safe_id: integer("safe_id").references(() => safesTable.id),
  opening_balance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  is_active: boolean("is_active").notNull().default(true),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("bank_accounts_company_id_idx").on(t.company_id),
]);

export const bankStatementLinesTable = pgTable("bank_statement_lines", {
  id: serial("id").primaryKey(),
  bank_account_id: integer("bank_account_id").notNull().references(() => bankAccountsTable.id),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  type: text("type").notNull(),
  reference: text("reference"),
  matched_entry_id: integer("matched_entry_id").references(() => journalEntriesTable.id),
  status: text("status").notNull().default("unmatched"),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("bank_statement_lines_bank_account_idx").on(t.bank_account_id),
  index("bank_statement_lines_company_id_idx").on(t.company_id),
  index("bank_statement_lines_status_idx").on(t.status),
]);

export type BankAccount = typeof bankAccountsTable.$inferSelect;
export type BankStatementLine = typeof bankStatementLinesTable.$inferSelect;
