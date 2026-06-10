import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  record_type: text("record_type").notNull(),
  record_id: integer("record_id").notNull(),
  old_value: jsonb("old_value"),
  new_value: jsonb("new_value"),
  user_id: integer("user_id"),
  username: text("username"),
  note: text("note"),
  /* Nullable: super_admin / system events legitimately have no tenant context.
     Forcing a default of 1 caused forensic pollution of tenant 1's audit trail. */
  company_id: integer("company_id").references(() => companiesTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
},
  (t) => [index("audit_logs_company_idx").on(t.company_id)]
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
