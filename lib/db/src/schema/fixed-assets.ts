import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { accountsTable } from "./accounts";
import { journalEntriesTable } from "./accounts";

export const fixedAssetsTable = pgTable("fixed_assets", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("equipment"),
  purchase_date: text("purchase_date").notNull(),
  purchase_cost: numeric("purchase_cost", { precision: 14, scale: 2 }).notNull(),
  residual_value: numeric("residual_value", { precision: 14, scale: 2 }).notNull().default("0"),
  useful_life_months: integer("useful_life_months").notNull(),
  depreciation_method: text("depreciation_method").notNull().default("straight_line"),
  asset_account_id: integer("asset_account_id").references(() => accountsTable.id),
  acc_dep_account_id: integer("acc_dep_account_id").references(() => accountsTable.id),
  dep_expense_account_id: integer("dep_expense_account_id").references(() => accountsTable.id),
  accumulated_depreciation: numeric("accumulated_depreciation", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  disposal_date: text("disposal_date"),
  disposal_proceeds: numeric("disposal_proceeds", { precision: 14, scale: 2 }),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("fixed_assets_company_id_idx").on(t.company_id),
  index("fixed_assets_status_idx").on(t.status),
]);

export const depreciationRunsTable = pgTable("depreciation_runs", {
  id: serial("id").primaryKey(),
  asset_id: integer("asset_id").notNull().references(() => fixedAssetsTable.id),
  period: text("period").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  entry_id: integer("entry_id").references(() => journalEntriesTable.id),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("depreciation_runs_asset_id_idx").on(t.asset_id),
  index("depreciation_runs_company_id_idx").on(t.company_id),
  index("depreciation_runs_period_idx").on(t.period),
]);

export type FixedAsset = typeof fixedAssetsTable.$inferSelect;
export type DepreciationRun = typeof depreciationRunsTable.$inferSelect;
