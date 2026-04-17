import { pgTable, serial, text, numeric, boolean, timestamp, integer, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const customerClassificationsTable = pgTable("customer_classifications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company_id: integer("company_id").notNull().default(1).references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("customer_classifications_company_id_idx").on(t.company_id),
]);

export const insertCustomerClassificationSchema = createInsertSchema(customerClassificationsTable).omit({ id: true, created_at: true });
export type InsertCustomerClassification = z.infer<typeof insertCustomerClassificationSchema>;
export type CustomerClassification = typeof customerClassificationsTable.$inferSelect;

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  customer_code: integer("customer_code"),
  normalized_name: text("normalized_name"),
  phone: text("phone"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  is_customer: boolean("is_customer").notNull().default(true),
  is_supplier: boolean("is_supplier").notNull().default(false),
  account_id: integer("account_id"),
  classification_id: integer("classification_id").references(() => customerClassificationsTable.id),
  company_id: integer("company_id").notNull().default(1).references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("customers_customer_code_unique").on(t.customer_code),
  index("customers_company_id_idx").on(t.company_id),
  index("customers_company_phone_idx").on(t.company_id, t.phone),
  index("customers_company_name_idx").on(t.company_id, t.name),
  index("customers_classification_id_idx").on(t.classification_id),
]);

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, created_at: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
