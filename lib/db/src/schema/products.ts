import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category"),
  category_id: integer("category_id"),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  cost_price: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
  sale_price: numeric("sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  low_stock_threshold: integer("low_stock_threshold"),
  tax_rate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("products_company_id_idx").on(t.company_id),
  index("products_company_sku_idx").on(t.company_id, t.sku),
  index("products_company_name_idx").on(t.company_id, t.name),
  index("products_category_id_idx").on(t.category_id),
  index("products_company_category_idx").on(t.company_id, t.category_id),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, created_at: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
