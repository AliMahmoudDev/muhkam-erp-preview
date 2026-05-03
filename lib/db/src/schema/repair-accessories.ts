import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const repairAccessoriesTable = pgTable("repair_accessories", {
  id:         serial("id").primaryKey(),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  key_:       text("key").notNull(),
  label_ar:   text("label_ar").notNull(),
  emoji:      text("emoji"),
  sort_order: integer("sort_order").notNull().default(0),
  active:     boolean("active").notNull().default(true),
  is_system:  boolean("is_system").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("repair_accessories_company_key_uidx").on(t.company_id, t.key_),
]);

export type RepairAccessory = typeof repairAccessoriesTable.$inferSelect;
