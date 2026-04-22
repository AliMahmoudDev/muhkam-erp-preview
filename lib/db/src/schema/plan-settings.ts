import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const planSettingsTable = pgTable("plan_settings", {
  id:          serial("id").primaryKey(),
  key:         text("key").notNull().unique(),
  name_ar:     text("name_ar").notNull(),
  description: text("description"),
  price:       integer("price").notNull().default(0),
  includes_mobile: boolean("includes_mobile").notNull().default(false),
  is_active:   boolean("is_active").notNull().default(true),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlanSetting = typeof planSettingsTable.$inferSelect;
export type NewPlanSetting = typeof planSettingsTable.$inferInsert;
