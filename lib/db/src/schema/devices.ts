import { pgTable, serial, text, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";

export const devicesTable = pgTable("devices", {
  id:                       serial("id").primaryKey(),
  company_id:               integer("company_id").notNull(),
  branch_id:                integer("branch_id"),
  device_no:                text("device_no").notNull(),

  brand:                    text("brand").notNull(),
  model:                    text("model").notNull(),
  color:                    text("color"),
  storage:                  text("storage"),
  imei:                     text("imei"),
  serial_no:                text("serial_no"),
  battery_health:           integer("battery_health"),
  grade:                    text("grade").default("B"),
  condition_notes:          text("condition_notes"),

  purchase_price:           numeric("purchase_price", { precision: 12, scale: 2 }).default("0"),
  sale_price:               numeric("sale_price", { precision: 12, scale: 2 }).default("0"),

  status:                   text("status").notNull().default("available"),

  dual_sim:                 boolean("dual_sim").default(false),
  with_box:                 boolean("with_box").default(false),
  icloud_locked:            boolean("icloud_locked").default(false),
  network_locked:           boolean("network_locked").default(false),
  previously_opened:        boolean("previously_opened").default(false),
  mdm_locked:               boolean("mdm_locked").default(false),

  supplier_name:            text("supplier_name"),
  purchase_invoice_no:      text("purchase_invoice_no"),
  inspector_name:           text("inspector_name"),

  sold_to_customer_id:      integer("sold_to_customer_id"),
  sold_to_customer_name:    text("sold_to_customer_name"),
  sold_at:                  timestamp("sold_at"),
  sold_by_user_id:          integer("sold_by_user_id"),
  sold_by_user_name:        text("sold_by_user_name"),
  sold_price:               numeric("sold_price", { precision: 12, scale: 2 }),
  warranty_months:          integer("warranty_months"),
  payment_method:           text("payment_method"),
  payment_status:           text("payment_status"),

  added_by_user_id:         integer("added_by_user_id"),
  added_by_user_name:       text("added_by_user_name"),

  supplier_phone:           text("supplier_phone"),
  id_card_data:             text("id_card_data"),

  product_id:               integer("product_id"),
  purchase_id:              integer("purchase_id"),
  purchase_invoice_ref:     text("purchase_invoice_ref"),

  created_at:               timestamp("created_at").defaultNow(),
  updated_at:               timestamp("updated_at").defaultNow(),
});

export type Device = typeof devicesTable.$inferSelect;
export type NewDevice = typeof devicesTable.$inferInsert;
