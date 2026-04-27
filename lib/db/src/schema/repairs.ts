import { pgTable, serial, text, integer, numeric, timestamp, date, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const repairJobsTable = pgTable("repair_jobs", {
  id:                       serial("id").primaryKey(),
  company_id:               integer("company_id").notNull(),
  job_no:                   text("job_no").notNull(),
  customer_id:              integer("customer_id"),
  customer_name:            text("customer_name").notNull(),
  customer_phone:           text("customer_phone"),
  device_brand:             text("device_brand").notNull(),
  device_model:             text("device_model").notNull(),
  device_type:              text("device_type").notNull().default("general"),
  imei:                     text("imei"),
  serial_no:                text("serial_no"),
  color:                    text("color"),
  storage:                  text("storage"),
  problem_description:      text("problem_description"),
  technician_id:            integer("technician_id"),
  technician_name:          text("technician_name"),
  technician_2_id:          integer("technician_2_id"),
  technician_2_name:        text("technician_2_name"),
  technician_2_section:     text("technician_2_section"),
  status:                   text("status").notNull().default("pending"),
  checklist:                text("checklist"),
  qa_checklist:             text("qa_checklist"),
  qa_completed_at:          timestamp("qa_completed_at"),
  qa_notes:                 text("qa_notes"),
  device_score:             integer("device_score"),
  estimated_cost:           numeric("estimated_cost", { precision: 12, scale: 2 }).default("0"),
  final_cost:               numeric("final_cost", { precision: 12, scale: 2 }).default("0"),
  deposit_paid:             numeric("deposit_paid", { precision: 12, scale: 2 }).default("0"),
  external_workshop:        boolean("external_workshop").default(false),
  external_workshop_name:   text("external_workshop_name"),
  external_workshop_cost:   numeric("external_workshop_cost", { precision: 12, scale: 2 }).default("0"),
  broker_name:              text("broker_name"),
  broker_commission:        numeric("broker_commission", { precision: 12, scale: 2 }).default("0"),
  alert_days_threshold:     integer("alert_days_threshold"),
  locked:                   boolean("locked").default(false),
  received_at:              date("received_at").notNull(),
  estimated_delivery:       date("estimated_delivery"),
  delivered_at:             date("delivered_at"),
  device_pin:               text("device_pin"),
  accessories:              text("accessories"),
  branch_id:                integer("branch_id"),
  notes:                    text("notes"),
  created_at:               timestamp("created_at").defaultNow().notNull(),
  updated_at:               timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("repair_jobs_company_idx").on(t.company_id),
  index("repair_jobs_status_idx").on(t.company_id, t.status),
  index("repair_jobs_tech_idx").on(t.company_id, t.technician_id),
  index("repair_jobs_imei_idx").on(t.company_id, t.imei),
]);

export const repairJobPartsTable = pgTable("repair_job_parts", {
  id:                  serial("id").primaryKey(),
  job_id:              integer("job_id").notNull(),
  company_id:          integer("company_id").notNull(),
  product_id:          integer("product_id"),
  product_name:        text("product_name").notNull(),
  quantity:            numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
  unit_price:          numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  source:              text("source").default("internal"),
  warehouse_id:        integer("warehouse_id"),
  is_returned:         boolean("is_returned").default(false),
  return_destination:  text("return_destination"),
  returned_at:         timestamp("returned_at"),
  created_at:          timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_job_parts_job_idx").on(t.job_id),
]);

export const repairStatusesTable = pgTable("repair_statuses", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull(),
  key:          text("key").notNull(),
  label_ar:     text("label_ar").notNull(),
  color:        text("color").default("#64748b"),
  sort_order:   integer("sort_order").default(0),
  is_system:    boolean("is_system").default(false),
  created_at:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_statuses_company_idx").on(t.company_id),
  uniqueIndex("repair_statuses_company_key_unique").on(t.company_id, t.key),
]);

export const repairChecklistItemsTable = pgTable("repair_checklist_items", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull(),
  label_ar:     text("label_ar").notNull(),
  category:     text("category").default("عام"),
  device_type:  text("device_type").default("general"),
  sort_order:   integer("sort_order").default(0),
  is_system:    boolean("is_system").default(false),
  created_at:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_checklist_company_idx").on(t.company_id),
]);

export const repairStatusHistoryTable = pgTable("repair_status_history", {
  id:               serial("id").primaryKey(),
  job_id:           integer("job_id").notNull(),
  company_id:       integer("company_id").notNull(),
  status_from:      text("status_from"),
  status_to:        text("status_to"),
  technician_id:    integer("technician_id"),
  technician_name:  text("technician_name"),
  user_id:          integer("user_id"),
  user_name:        text("user_name"),
  event_type:       text("event_type").default("status_change"),
  note:             text("note"),
  created_at:       timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_history_job_idx").on(t.job_id),
  index("repair_history_company_idx").on(t.company_id),
]);

export const scrapItemsTable = pgTable("scrap_items", {
  id:             serial("id").primaryKey(),
  company_id:     integer("company_id").notNull(),
  product_id:     integer("product_id"),
  product_name:   text("product_name").notNull(),
  quantity:       numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
  unit_cost:      numeric("unit_cost", { precision: 12, scale: 2 }).default("0"),
  warehouse_id:   integer("warehouse_id"),
  reason:         text("reason"),
  source_type:    text("source_type"),
  source_id:      integer("source_id"),
  created_by:     integer("created_by"),
  created_by_name: text("created_by_name"),
  created_at:     timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("scrap_items_company_idx").on(t.company_id),
]);

export const badDebtsTable = pgTable("bad_debts", {
  id:                     serial("id").primaryKey(),
  company_id:             integer("company_id").notNull(),
  customer_id:            integer("customer_id"),
  customer_name:          text("customer_name").notNull(),
  amount:                 numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  reason:                 text("reason"),
  account_id:             integer("account_id"),
  status:                 text("status").notNull().default("open"),
  source_invoice_id:      integer("source_invoice_id"),
  source_repair_job_id:   integer("source_repair_job_id"),
  notes:                  text("notes"),
  written_off_at:         date("written_off_at"),
  created_by:             integer("created_by"),
  created_by_name:        text("created_by_name"),
  created_at:             timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("bad_debts_company_idx").on(t.company_id),
  index("bad_debts_status_idx").on(t.status),
]);

export const repairPipelineConfigTable = pgTable("repair_pipeline_config", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull(),
  status_key:   text("status_key").notNull(),
  label_ar:     text("label_ar").notNull(),
  color:        text("color").notNull(),
  icon:         text("icon").notNull(),
  sort_order:   integer("sort_order").notNull(),
  requirements: text("requirements"),
  created_at:   timestamp("created_at").defaultNow(),
}, (t) => [
  index("repair_pipeline_config_company_idx").on(t.company_id),
]);

/**
 * Customizable dashboard cards on the repairs page.
 * Each card groups one or more status keys, has its own name, color, icon.
 * Configurable per-company by admins; controls the top-of-page summary cards.
 */
export const repairDashboardCardsTable = pgTable("repair_dashboard_cards", {
  id:               serial("id").primaryKey(),
  company_id:       integer("company_id").notNull(),
  name:             text("name").notNull(),
  statuses:         text("statuses").notNull(),    // JSON array of status keys
  color:            text("color").notNull().default("#8b5cf6"),
  icon:             text("icon").notNull().default("Wrench"),
  sort_order:       integer("sort_order").notNull().default(0),
  alert_threshold:  integer("alert_threshold"),    // null = no alert
  is_system:        boolean("is_system").notNull().default(false),
  created_at:       timestamp("created_at").defaultNow().notNull(),
  updated_at:       timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("repair_dashboard_cards_company_idx").on(t.company_id, t.sort_order),
]);

export const insertRepairJobSchema = createInsertSchema(repairJobsTable).omit({ id: true, created_at: true, updated_at: true });
export const insertRepairJobPartSchema = createInsertSchema(repairJobPartsTable).omit({ id: true, created_at: true });
export const insertRepairStatusSchema = createInsertSchema(repairStatusesTable).omit({ id: true, created_at: true });
export const insertRepairChecklistItemSchema = createInsertSchema(repairChecklistItemsTable).omit({ id: true, created_at: true });
export const insertScrapItemSchema = createInsertSchema(scrapItemsTable).omit({ id: true, created_at: true });
export const insertBadDebtSchema = createInsertSchema(badDebtsTable).omit({ id: true, created_at: true });

export type RepairJob = typeof repairJobsTable.$inferSelect;
export type RepairJobPart = typeof repairJobPartsTable.$inferSelect;
export type RepairStatus = typeof repairStatusesTable.$inferSelect;
export type RepairChecklistItem = typeof repairChecklistItemsTable.$inferSelect;
export type RepairStatusHistory = typeof repairStatusHistoryTable.$inferSelect;
export type ScrapItem = typeof scrapItemsTable.$inferSelect;
export type BadDebt = typeof badDebtsTable.$inferSelect;
export type RepairPipelineConfig = typeof repairPipelineConfigTable.$inferSelect;
export type RepairDashboardCard = typeof repairDashboardCardsTable.$inferSelect;
