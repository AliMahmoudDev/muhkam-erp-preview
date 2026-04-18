import { pgTable, serial, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { erpUsersTable } from "./users";

export const refreshTokensTable = pgTable("refresh_tokens", {
  id:         serial("id").primaryKey(),
  token_hash: text("token_hash").notNull().unique(),
  user_id:    integer("user_id").notNull().references(() => erpUsersTable.id, { onDelete: "cascade" }),
  used:       boolean("used").notNull().default(false),
  revoked:    boolean("revoked").notNull().default(false),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  used_at:    timestamp("used_at", { withTimezone: true }),
}, (t) => [
  index("refresh_tokens_user_id_idx").on(t.user_id),
  index("refresh_tokens_hash_idx").on(t.token_hash),
  index("refresh_tokens_expires_idx").on(t.expires_at),
]);

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
