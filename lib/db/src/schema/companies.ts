import { pgTable, serial, text, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";

export type CompanyFeatures = {
  accounting: boolean;
  hr: boolean;
  pos: boolean;
  warranty: boolean;
  consignment: boolean;
  fixed_assets: boolean;
  maintenance: boolean;
  budgets: boolean;
  bank_reconciliation: boolean;
};

export const DEFAULT_FEATURES_ULTIMATE: CompanyFeatures = {
  accounting: false,
  hr: true,
  pos: true,
  warranty: true,
  consignment: true,
  fixed_assets: false,
  maintenance: false,
  budgets: false,
  bank_reconciliation: false,
};

export const DEFAULT_FEATURES_ADVANCED: CompanyFeatures = {
  accounting: true,
  hr: true,
  pos: true,
  warranty: true,
  consignment: true,
  fixed_assets: true,
  maintenance: false,
  budgets: true,
  bank_reconciliation: true,
};

export const companiesTable = pgTable("companies", {
  id:         serial("id").primaryKey(),
  name:       text("name").notNull(),
  plan_type:  text("plan_type").notNull().default("trial"),
  edition:    text("edition").notNull().default("ultimate"),
  features:   jsonb("features").$type<CompanyFeatures>(),
  start_date: date("start_date").notNull(),
  end_date:   date("end_date").notNull(),
  is_active:   boolean("is_active").notNull().default(true),
  admin_email: text("admin_email"),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Company = typeof companiesTable.$inferSelect;
export type NewCompany = typeof companiesTable.$inferInsert;
