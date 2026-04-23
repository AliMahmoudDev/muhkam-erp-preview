import {
  pgTable, serial, integer, numeric, text, timestamp, index, unique,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const salesTargetsTable = pgTable("sales_targets", {
  id:            serial("id").primaryKey(),
  company_id:    integer("company_id").notNull().references(() => companiesTable.id),
  user_id:       integer("user_id").notNull(),
  year_month:    text("year_month").notNull(),
  target_amount: numeric("target_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  created_at:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index("sales_targets_company_month_idx").on(t.company_id, t.year_month),
  unique("sales_targets_user_month_uq").on(t.user_id, t.year_month, t.company_id),
]);

export type SalesTarget = typeof salesTargetsTable.$inferSelect;
export type InsertSalesTarget = typeof salesTargetsTable.$inferInsert;
