import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const safesTable = pgTable("safes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0"),
  company_id: integer("company_id").notNull().default(1).references(() => companiesTable.id),
  branch_id:  integer("branch_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
},
  (t) => [index("safes_company_idx").on(t.company_id)]
);

export const safeTransfersTable = pgTable("safe_transfers", {
  id: serial("id").primaryKey(),
  from_safe_id: integer("from_safe_id"),
  from_safe_name: text("from_safe_name"),
  to_safe_id: integer("to_safe_id"),
  to_safe_name: text("to_safe_name"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  fee_type: text("fee_type").default("none"),
  fee_rate: numeric("fee_rate", { precision: 10, scale: 4 }).default("0"),
  fee_amount: numeric("fee_amount", { precision: 12, scale: 2 }).default("0"),
  net_amount: numeric("net_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  company_id: integer("company_id").notNull().default(1).references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("safe_transfers_from_safe_id_idx").on(t.from_safe_id),
  index("safe_transfers_to_safe_id_idx").on(t.to_safe_id),
  index("safe_transfers_created_at_idx").on(t.created_at),
]);

export type Safe = typeof safesTable.$inferSelect;
export type SafeTransfer = typeof safeTransfersTable.$inferSelect;
