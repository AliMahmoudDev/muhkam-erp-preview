import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  branch_id:  integer("branch_id"),
  is_consignment: boolean("is_consignment").notNull().default(false),
  supplier_id: integer("supplier_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
},
  (t) => [index("warehouses_company_idx").on(t.company_id)]
);

export type Warehouse = typeof warehousesTable.$inferSelect;
