import { pgTable, serial, text, boolean, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const erpUsersTable = pgTable("erp_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull(),
  email: text("email"),
  phone: text("phone"),
  pin: text("pin").notNull(),
  role: text("role").notNull().default("cashier"),
  permissions: text("permissions").default("{}"),
  active: boolean("active").default(true),
  company_id:      integer("company_id").references(() => companiesTable.id),
  warehouse_id:    integer("warehouse_id"),
  safe_id:         integer("safe_id"),
  employee_id:     integer("employee_id"),
  login_attempts:  integer("login_attempts").notNull().default(0),
  last_login:      timestamp("last_login", { withTimezone: true }),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  totp_secret:       text("totp_secret"),
  totp_enabled:      boolean("totp_enabled").default(false),
  totp_verified:     boolean("totp_verified").default(false),
  trusted_device_id: text("trusted_device_id"),
  /* Repair-technician settings (per-tenant, replaces previous localStorage prototype) */
  repair_commission_pct:   integer("repair_commission_pct").notNull().default(0),
  repair_specialty:        text("repair_specialty"),
  repair_notifications:    boolean("repair_notifications").notNull().default(true),
  dashboard_shortcuts:     jsonb("dashboard_shortcuts").$type<string[]>().default([]),
  mobile_nav_tabs:         jsonb("mobile_nav_tabs").$type<string[]>().default([]),
},
  (t) => [index("erp_users_company_idx").on(t.company_id)]
);

export type ErpUser = typeof erpUsersTable.$inferSelect;
