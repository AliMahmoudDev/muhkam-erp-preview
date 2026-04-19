import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const warrantyTable = pgTable("warranty_records", {
  id:               serial("id").primaryKey(),
  company_id:       integer("company_id").notNull(),
  sale_id:          integer("sale_id"),
  product_id:       integer("product_id"),
  product_name:     text("product_name").notNull(),
  customer_id:      integer("customer_id"),
  customer_name:    text("customer_name"),
  customer_phone:   text("customer_phone"),
  serial_number:    text("serial_number"),
  device_model:     text("device_model"),
  warranty_months:  integer("warranty_months").notNull().default(3),
  warranty_start:   date("warranty_start").notNull(),
  warranty_end:     date("warranty_end").notNull(),
  status:           text("status").notNull().default("active"),
  notes:            text("notes"),
  created_at:       timestamp("created_at").defaultNow().notNull(),
});

export const insertWarrantySchema = createInsertSchema(warrantyTable).omit({ id: true, created_at: true });
