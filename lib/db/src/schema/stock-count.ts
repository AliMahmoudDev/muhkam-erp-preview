import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { companiesTable } from "./companies";

export const stockCountSessionsTable = pgTable("stock_count_sessions", {
  id:           serial("id").primaryKey(),
  warehouse_id: integer("warehouse_id").notNull(),
  status:       text("status").notNull().default("draft"),
  notes:        text("notes"),
  company_id:   integer("company_id").notNull().references(() => companiesTable.id),
  created_by:   integer("created_by"),
  applied_at:   timestamp("applied_at", { withTimezone: true }),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
},
  (t) => [index("stock_count_sessions_company_idx").on(t.company_id)]
);

export const stockCountItemsTable = pgTable("stock_count_items", {
  id:           serial("id").primaryKey(),
  session_id:   integer("session_id").notNull(),
  product_id:   integer("product_id").notNull().references(() => productsTable.id),
  system_qty:   numeric("system_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  physical_qty: numeric("physical_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  notes:        text("notes"),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StockCountSession = typeof stockCountSessionsTable.$inferSelect;
export type StockCountItem    = typeof stockCountItemsTable.$inferSelect;
