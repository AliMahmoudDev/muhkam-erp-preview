import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const idempotencyKeysTable = pgTable("idempotency_keys", {
  id:         serial("id").primaryKey(),
  company_id: integer("company_id").notNull().references(() => companiesTable.id),
  scope:      text("scope").notNull(),
  key:        text("key").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("idempotency_keys_company_scope_key_uidx").on(t.company_id, t.scope, t.key),
  index("idempotency_keys_created_at_idx").on(t.created_at),
]);

export type IdempotencyKey = typeof idempotencyKeysTable.$inferSelect;
