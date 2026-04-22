import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

/**
 * notifications — in-app notifications targeted to a specific user.
 * type:    advance_approved | advance_rejected | advance_pending | bonus_granted |
 *          deduction_added | custody_settled | custody_assigned | generic
 * link:    optional client-side route to deep-link the user to the relevant page
 */
export const notificationsTable = pgTable("notifications", {
  id:          serial("id").primaryKey(),
  company_id:  integer("company_id").notNull().default(1).references(() => companiesTable.id),
  user_id:     integer("user_id").notNull(),
  type:        text("type").notNull(),
  title:       text("title").notNull(),
  message:     text("message").notNull(),
  link:        text("link"),
  reference_id: integer("reference_id"),
  is_read:     boolean("is_read").notNull().default(false),
  created_at:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  read_at:     timestamp("read_at", { withTimezone: true }),
}, t => [
  index("notifications_user_idx").on(t.user_id),
  index("notifications_user_unread_idx").on(t.user_id, t.is_read),
  index("notifications_company_idx").on(t.company_id),
]);

export type Notification = typeof notificationsTable.$inferSelect;
