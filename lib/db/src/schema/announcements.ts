import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id:           serial("id").primaryKey(),
  title:        text("title").notNull(),
  body:         text("body").notNull(),
  type:         text("type").notNull().default("info"),     // info | warning | success | danger
  target:       text("target").notNull().default("all"),    // "all" | specific company_id as string
  company_id:   integer("company_id"),                      // null = all companies
  is_active:    boolean("is_active").notNull().default(true),
  created_by:   text("created_by").notNull().default("super_admin"),
  expires_at:   timestamp("expires_at", { withTimezone: true }),
  created_at:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
export type NewAnnouncement = typeof announcementsTable.$inferInsert;
