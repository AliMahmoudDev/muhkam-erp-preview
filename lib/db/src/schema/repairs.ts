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
  /* ── حقول مرحلة "جاهز للتسليم" (مراجعة ما قبل التسليم) ── */
  pre_delivery_reviewed_at: timestamp("pre_delivery_reviewed_at"),
  /* ── حقول مرحلة الشحن ── */
  shipping_cost:            numeric("shipping_cost", { precision: 12, scale: 2 }).default("0"),
  shipping_expense_id:      integer("shipping_expense_id"),
  shipping_settled_at:      timestamp("shipping_settled_at"),
  /* ── خصم نهائي على الفاتورة ── */
  final_discount:           numeric("final_discount", { precision: 12, scale: 2 }).default("0"),
  /* ── حقول مرحلة التسليم ── */
  delivery_receipt_sent_at: timestamp("delivery_receipt_sent_at"),
  delivery_receipt_method:  text("delivery_receipt_method"), // 'whatsapp' | 'print' | 'both'
  /* ── الضمان والمرتجع ── */
  job_type:                 text("job_type").notNull().default("repair"), // 'repair' | 'warranty'
  warranty_of:              integer("warranty_of"),                        // FK → parent job id
  is_customer_returned:     boolean("is_customer_returned").default(false),
  customer_return_amount:   numeric("customer_return_amount", { precision: 12, scale: 2 }).default("0"),
  /* ── الفني المسؤول + فحص الجودة + طريقة الدفع عند التسليم ── */
  responsible_technician_id: integer("responsible_technician_id"),
  qa_report:                text("qa_report"),
  qa_inspector_name:        text("qa_inspector_name"),
  delivery_payment_type:    text("delivery_payment_type"),   // 'cash' | 'deferred' | 'instant_transfer'
  delivery_safe_id:         integer("delivery_safe_id"),
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

/* ── جدول دفعات الصيانة ──────────────────────────────────────── */
export const repairPaymentsTable = pgTable("repair_payments", {
  id:           serial("id").primaryKey(),
  company_id:   integer("company_id").notNull(),
  job_id:       integer("job_id").notNull().references(() => repairJobsTable.id, { onDelete: "cascade" }),
  amount:       numeric("amount", { precision: 12, scale: 2 }).notNull(),
  payment_method: text("payment_method").notNull().default("cash"), // cash | card | transfer | other
  notes:        text("notes"),
  received_by:  integer("received_by"),
  received_by_name: text("received_by_name"),
  safe_id:      integer("safe_id"),
  safe_name:    text("safe_name"),
  created_at:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_payments_job_idx").on(t.job_id),
  index("repair_payments_company_idx").on(t.company_id),
]);

export const repairDeviceModelsTable = pgTable("repair_device_models", {
  id:         serial("id").primaryKey(),
  company_id: integer("company_id").notNull(),
  brand:      text("brand").notNull(),
  category:   text("category").notNull(),
  model:      text("model").notNull(),
  sort_order: integer("sort_order").default(0).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_device_models_company_idx").on(t.company_id),
]);

/* ── إيصالات الفنيين لكل بطاقة صيانة ── */
export const repairReceiptTechniciansTable = pgTable("repair_receipt_technicians", {
  id:             serial("id").primaryKey(),
  repair_job_id:  integer("repair_job_id").notNull().references(() => repairJobsTable.id, { onDelete: "cascade" }),
  technician_id:  integer("technician_id").notNull(),
  item_name:      text("item_name").notNull(),
  amount:         numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  created_at:     timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("repair_receipt_tech_job_idx").on(t.repair_job_id),
  index("repair_receipt_tech_tech_idx").on(t.technician_id),
]);

/* ── صور الجهاز (استلام / تسليم) ── */
export const repairDevicePhotosTable = pgTable("repair_device_photos", {
  id:             serial("id").primaryKey(),
  repair_job_id:  integer("repair_job_id").notNull().references(() => repairJobsTable.id, { onDelete: "cascade" }),
  photo_url:      text("photo_url").notNull(),
  photo_type:     text("photo_type").notNull().default("intake"), // 'intake' | 'delivery'
  uploaded_at:    timestamp("uploaded_at").defaultNow().notNull(),
  uploaded_by:    integer("uploaded_by"),
}, (t) => [
  index("repair_device_photos_job_idx").on(t.repair_job_id),
]);

/* ══════════════════════════════════════════════════════════════
   PHASE 1 — خدمات الصيانة والكوميشن
   ── جداول البنية التحتية (لا تحسب كوميشن بعد) ──────────────
   NOTE (deferred): خصومات على مستوى الخدمة — الخصم حالياً على مستوى البطاقة (final_discount)
     - مبالغ الخدمة لا تعكس بالضرورة قيمة الفاتورة النهائية (final_cost)
     - قد تكون هناك خصومات على مستوى الخدمة أو على مستوى البطاقة ككل
     - يجب في المرحلة الثانية دراسة: amount_before_discount أو
       استراتيجية توزيع الخصم على مستوى كل خدمة
     - commission_computed يجب أن يأخذ بعين الاعتبار الخصومات المطبّقة
══════════════════════════════════════════════════════════════ */

/* ── 1. أنواع الخدمات (إعدادات على مستوى الشركة) ── */
export const repairServiceTypesTable = pgTable("repair_service_types", {
  id:               serial("id").primaryKey(),
  company_id:       integer("company_id").notNull(),
  name_ar:          text("name_ar").notNull(),
  /* commission_type: profit_based | amount_based | fixed */
  commission_type:  text("commission_type").notNull().default("profit_based"),
  commission_value: numeric("commission_value", { precision: 8, scale: 4 }).notNull().default("0"),
  is_active:        boolean("is_active").notNull().default(true),
  sort_order:       integer("sort_order").notNull().default(0),
  created_at:       timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("repair_service_types_company_idx").on(t.company_id, t.sort_order),
  uniqueIndex("repair_service_types_company_name_uidx").on(t.company_id, t.name_ar),
]);

/* ── 2. بنود الخدمة لكل بطاقة صيانة ── */
export const repairJobServicesTable = pgTable("repair_job_services", {
  id:                          serial("id").primaryKey(),
  job_id:                      integer("job_id").notNull().references(() => repairJobsTable.id, { onDelete: "cascade" }),
  company_id:                  integer("company_id").notNull(),

  /* مرجع نوع الخدمة — SET NULL عند الحذف (الـ snapshots تحفظ البيانات) */
  service_type_id:             integer("service_type_id").references(() => repairServiceTypesTable.id, { onDelete: "set null" }),
  service_type_name_snapshot:  text("service_type_name_snapshot").notNull(),
  /* NOTE: يُستخدم للتقارير التاريخية بعد إعادة تسمية الأنواع */
  service_type_code_snapshot:  text("service_type_code_snapshot"),

  technician_id:               integer("technician_id"),
  technician_name:             text("technician_name").notNull(),

  /* مبلغ الخدمة — أساس حساب الكوميشن (مستقل عن final_cost) */
  amount:                      numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),

  status:                      text("status").notNull().default("pending"),

  /* حقول الكوميشن — تُكتب عند التسليم عبر lockJobCommissions() */
  commission_source_snapshot:  text("commission_source_snapshot"),
  commission_rate_snapshot:    numeric("commission_rate_snapshot", { precision: 8, scale: 4 }),
  commission_computed:         numeric("commission_computed", { precision: 12, scale: 2 }),
  commission_locked:           boolean("commission_locked").notNull().default(false),

  notes:                       text("notes"),
  created_at:                  timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at:                  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("repair_job_services_job_idx").on(t.job_id),
  index("repair_job_services_tech_idx").on(t.company_id, t.technician_id),
]);

/* ── 3. جسر القطع ↔ الخدمات (M:N) ── */
export const repairJobServicePartsTable = pgTable("repair_job_service_parts", {
  id:                  serial("id").primaryKey(),
  service_id:          integer("service_id").notNull().references(() => repairJobServicesTable.id, { onDelete: "cascade" }),
  part_id:             integer("part_id").notNull().references(() => repairJobPartsTable.id, { onDelete: "cascade" }),
  quantity_allocated:  numeric("quantity_allocated", { precision: 12, scale: 3 }).notNull().default("1"),
  created_at:          timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("repair_job_service_parts_service_idx").on(t.service_id),
  index("repair_job_service_parts_part_idx").on(t.part_id),
  uniqueIndex("repair_job_service_parts_uidx").on(t.service_id, t.part_id),
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
export type RepairDeviceModel = typeof repairDeviceModelsTable.$inferSelect;
export type RepairReceiptTechnician = typeof repairReceiptTechniciansTable.$inferSelect;
export type RepairDevicePhoto = typeof repairDevicePhotosTable.$inferSelect;
export type RepairServiceType = typeof repairServiceTypesTable.$inferSelect;
export type RepairJobService = typeof repairJobServicesTable.$inferSelect;
export type RepairJobServicePart = typeof repairJobServicePartsTable.$inferSelect;
