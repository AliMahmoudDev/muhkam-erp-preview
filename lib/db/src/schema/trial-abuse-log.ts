/**
 * trial-abuse-log.ts
 *
 * Permanent log of every trial registration attempt.
 * Records persist even if the company is later deleted by the super admin.
 * This is what makes it possible to detect "email already used trial" and
 * "IP already registered too many trials" scenarios across time.
 *
 * Never delete rows from this table — only the super admin can add
 * manual overrides via the `override_reason` field.
 */
import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const trialAbuseLogTable = pgTable("trial_abuse_log", {
  id:              serial("id").primaryKey(),

  /** Normalized lowercase email used at registration */
  email:           text("email").notNull(),

  /** Client IP at the time of registration (from req.ip via trust-proxy) */
  ip:              text("ip").notNull(),

  /** HTTP User-Agent header value — used for device fingerprinting */
  user_agent:      text("user_agent"),

  /** The company that was created. Nullable in case insert fails mid-way */
  company_id:      integer("company_id"),

  /** True if the registration was flagged as abuse at the time */
  flagged:         boolean("flagged").notNull().default(false),

  /**
   * When set by the super admin, this row will NOT count against the IP/email
   * trial limit. Allows legitimate re-registrations without deleting the log.
   */
  override_reason: text("override_reason"),

  /** Super admin username who granted the override */
  overridden_by:   text("overridden_by"),

  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TrialAbuseLog = typeof trialAbuseLogTable.$inferSelect;
export type NewTrialAbuseLog = typeof trialAbuseLogTable.$inferInsert;
