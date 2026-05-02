import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { productsTable } from "./products";

export const priceListsTable = pgTable("price_lists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("price_lists_company_id_idx").on(t.company_id),
]);

export const priceListItemsTable = pgTable("price_list_items", {
  id: serial("id").primaryKey(),
  price_list_id: integer("price_list_id").notNull().references(() => priceListsTable.id, { onDelete: "cascade" }),
  product_id: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  markup_percent: numeric("markup_percent", { precision: 8, scale: 2 }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("price_list_items_list_idx").on(t.price_list_id),
  index("price_list_items_product_idx").on(t.product_id),
]);

export type PriceList = typeof priceListsTable.$inferSelect;
export type PriceListItem = typeof priceListItemsTable.$inferSelect;
