import { pgTable, serial, text, boolean, integer, timestamp, date, jsonb } from "drizzle-orm/pg-core";

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

  /* ── Anti-abuse / trial tracking ─────────────────────────────────── */

  /** Client IP at registration time (from req.ip via trust-proxy). */
  signup_ip:   text("signup_ip"),

  /** HTTP User-Agent at registration time — device fingerprinting. */
  signup_user_agent: text("signup_user_agent"),

  /**
   * True when this company was ever on a trial. Set at self-service
   * registration; kept even if later upgraded. The trial_abuse_log table
   * stores the permanent per-email/IP record.
   */
  has_used_trial: boolean("has_used_trial").notNull().default(false),

  /* ── Email verification ───────────────────────────────────────────── */

  /** True once the admin confirmed their email via the verification link. */
  email_verified: boolean("email_verified").notNull().default(false),

  /** 64-hex-char token; cleared after successful verification. */
  email_verification_token: text("email_verification_token"),

  /** Expiry for the verification token (48 h after registration). */
  email_verification_expires_at: timestamp("email_verification_expires_at", { withTimezone: true }),

  /**
   * Tracks the email-verification lifecycle so the scheduler can act without
   * re-computing timestamps on every tick.
   *
   * 'pending'  — not yet verified, within the 48-hour window
   * 'verified' — email confirmed
   * 'expired'  — 48 h elapsed without verification → write-lock applied
   */
  verification_status: text("verification_status").notNull().default("pending"),

  /* ── Trial scoring ────────────────────────────────────────────────── */

  /**
   * Anti-abuse trust score, 0–130.
   *
   * Starts at 100.  Deductions:
   *   -20 if the signup IP appears in other trial registrations
   *   -20 if the signup user-agent appears in other trial registrations
   * Bonus:
   *   +30 once the email is verified
   *
   * Score < 50 → is_suspicious = true (admin can review/override).
   * Score is recomputed by the trial scheduler and on email verification.
   */
  trial_score: integer("trial_score").notNull().default(100),

  /**
   * True when trial_score drops below 50.
   * Super admin can manually clear this after review.
   */
  is_suspicious: boolean("is_suspicious").notNull().default(false),
});

export type Company = typeof companiesTable.$inferSelect;
export type NewCompany = typeof companiesTable.$inferInsert;
