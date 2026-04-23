import { pgTable, serial, text, integer, numeric, timestamp, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const repairJobsTable = pgTable("repair_jobs", {
  id:                   serial("id").primaryKey(),
  company_id:           integer("company_id").notNull(),
  job_no:               text("job_no").notNull(),
  customer_id:          integer("customer_id"),
  customer_name:        text("customer_name").notNull(),
  customer_phone:       text("customer_phone"),
  device_brand:         text("device_brand").notNull(),
  device_model:         text("device_model").notNull(),
  imei:                 text("imei"),
  color:                text("color"),
  storage:              text("storage"),
  problem_description:  text("problem_description"),
  technician_id:        integer("technician_id"),
  technician_name:      text("technician_name"),
  status:               text("status").notNull().default("pending"),
  checklist:            text("checklist"),
  device_score:         integer("device_score"),
  estimated_cost:       numeric("estimated_cost", { precision: 12, scale: 2 }).default("0"),
  final_cost:           numeric("final_cost", { precision: 12, scale: 2 }).default("0"),
  deposit_paid:         numeric("deposit_paid", { precision: 12, scale: 2 }).default("0"),
  received_at:          date("received_at").notNull(),
  estimated_delivery:   date("estimated_delivery"),
  delivered_at:         date("delivered_at"),
  notes:                text("notes"),
  created_at:           timestamp("created_at").defaultNow().notNull(),
  updated_at:           timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("repair_jobs_company_idx").on(t.company_id),
  index("repair_jobs_status_idx").on(t.company_id, t.status),
]);

export const repairJobPartsTable = pgTable("repair_job_parts", {
  id:           serial("id").primaryKey(),
  job_id:       integer("job_id").notNull(),
  company_id:   integer("company_id").notNull(),
  product_id:   integer("product_id"),
  product_name: text("product_name").notNull(),
  quantity:     numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
  unit_price:   numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  created_at:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_job_parts_job_idx").on(t.job_id),
]);

export const insertRepairJobSchema = createInsertSchema(repairJobsTable).omit({ id: true, created_at: true, updated_at: true });
export const insertRepairJobPartSchema = createInsertSchema(repairJobPartsTable).omit({ id: true, created_at: true });

export type RepairJob = typeof repairJobsTable.$inferSelect;
export type RepairJobPart = typeof repairJobPartsTable.$inferSelect;
