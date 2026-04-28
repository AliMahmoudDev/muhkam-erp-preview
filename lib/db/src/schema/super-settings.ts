import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * إعدادات عالمية للسوبر أدمن — key/value بدون ربط بشركة معينة
 * تُستخدم حالياً لإعدادات بوت التليجرام والتنبيهات
 */
export const superSettingsTable = pgTable("super_settings", {
  key:        text("key").primaryKey(),
  value:      text("value"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SuperSetting = typeof superSettingsTable.$inferSelect;
