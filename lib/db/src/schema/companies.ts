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

  /* ── Anti-abuse / trial tracking fields ─────────────────────────────── */

  /**
   * IP address of the client at registration time.
   * Populated from req.ip (Express trust-proxy resolves X-Forwarded-For safely).
   * Used for IP-based trial abuse detection.
   */
  signup_ip:   text("signup_ip"),

  /**
   * HTTP User-Agent header at registration time.
   * Used for device fingerprinting alongside IP for abuse pattern detection.
   */
  signup_user_agent: text("signup_user_agent"),

  /**
   * True when this company was ever a trial. Set to true on self-service
   * registration, stays true even if the company is later upgraded.
   * The trial_abuse_log table stores the permanent record per email/IP.
   */
  has_used_trial: boolean("has_used_trial").notNull().default(false),

  /**
   * True once the admin's email address has been confirmed via the
   * verification link sent at registration. The trial is active immediately
   * but super admins can see unverified companies in the dashboard.
   */
  email_verified: boolean("email_verified").notNull().default(false),

  /**
   * 64-hex-char token sent in the verification email.
   * Cleared (set to null) after the email is successfully verified.
   * Also expires after 48 hours (enforced in the verify-email endpoint).
   */
  email_verification_token: text("email_verification_token"),

  /**
   * Expiry timestamp for the verification token (48h after registration).
   * After this time the user must request a new token via the resend endpoint.
   */
  email_verification_expires_at: timestamp("email_verification_expires_at", { withTimezone: true }),
});

export type Company = typeof companiesTable.$inferSelect;
export type NewCompany = typeof companiesTable.$inferInsert;
