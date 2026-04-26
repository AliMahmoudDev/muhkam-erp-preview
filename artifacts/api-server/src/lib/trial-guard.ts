/**
 * trial-guard.ts
 *
 * Anti-abuse protection for the trial registration system.
 *
 * ── Two hard-block checks ────────────────────────────────────────────────────
 *  1. EMAIL: if a normalized email appears in trial_abuse_log (without an admin
 *     override), that email has already consumed a trial and cannot get another.
 *
 *  2. IP: if the same IP has registered MAX_TRIALS_PER_IP (default 2) trials
 *     without admin overrides, new registrations from that IP are blocked.
 *
 * ── Design choices ───────────────────────────────────────────────────────────
 *  - Records are permanent — they survive company deletion so history is kept.
 *  - Super admin can grant a per-row override (override_reason) to unblock a
 *    legitimate user without deleting the history.
 *  - Blocking is deliberately conservative (2 trials per IP) to avoid
 *    penalizing NAT/shared-IP environments. Adjust MAX_TRIALS_PER_IP via env.
 *  - Email verification is "soft" — the trial activates immediately but the
 *    super admin can see unverified companies.
 *
 * ── Email verification ───────────────────────────────────────────────────────
 *  A 64-byte hex token is stored in companies.email_verification_token with a
 *  48-hour expiry. The GET /auth/verify-email?token=... endpoint marks the
 *  company as email_verified=true. If no email provider is configured the link
 *  is logged to the server console so the admin can send it manually.
 */

import crypto from "crypto";
import { eq, and, isNull, count } from "drizzle-orm";
import { db, trialAbuseLogTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Returns true for IPs that are loopback or RFC-1918 private addresses.
 * These should never be counted against the IP trial limit because many
 * legitimate users (behind NAT, in development, or in internal networks)
 * share the same private IP.
 *
 * Handles both IPv4 (127.x, 10.x, 172.16-31.x, 192.168.x) and their
 * IPv4-in-IPv6 mapped forms (::ffff:…), plus the IPv6 loopback (::1).
 */
function isPrivateOrLoopbackIP(ip: string): boolean {
  const raw = ip.trim();
  // Unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4)
  const v4 = raw.startsWith("::ffff:") ? raw.slice(7) : raw;

  if (v4 === "::1" || v4 === "localhost") return true;

  // IPv4 private / loopback ranges
  const parts = v4.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 127) return true;                                // 127.0.0.0/8  loopback
    if (a === 10)  return true;                                // 10.0.0.0/8   RFC-1918
    if (a === 192 && b === 168) return true;                   // 192.168.0.0/16 RFC-1918
    if (a === 172 && b >= 16 && b <= 31) return true;          // 172.16.0.0/12  RFC-1918
  }
  return false;
}

/** Maximum number of trial registrations allowed per IP (overrideable by admin) */
export const MAX_TRIALS_PER_IP: number =
  Number(process.env.MAX_TRIALS_PER_IP ?? "2");

/* ─── Email abuse check ─────────────────────────────────────────────────── */

/**
 * Returns true if the email was already used for a trial and has no active
 * super-admin override. A blocked email must be manually overridden in the
 * super admin panel before the user can register again.
 */
export async function isEmailTrialAbused(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: trialAbuseLogTable.id })
    .from(trialAbuseLogTable)
    .where(
      and(
        eq(trialAbuseLogTable.email, email.toLowerCase().trim()),
        isNull(trialAbuseLogTable.override_reason), // overridden rows don't count
      )
    )
    .limit(1);

  return rows.length > 0;
}

/* ─── IP abuse check ────────────────────────────────────────────────────── */

/**
 * Returns true if the IP has already registered MAX_TRIALS_PER_IP trials
 * that have no admin override. Registrations with an override_reason do not
 * count against the limit.
 */
export async function isIPTrialAbused(ip: string): Promise<{ abused: boolean; count: number }> {
  // Loopback / private IPs are never blocked — they are shared by design
  // (development, NAT, internal load-balancers, etc.).
  if (isPrivateOrLoopbackIP(ip)) return { abused: false, count: 0 };

  const [result] = await db
    .select({ total: count() })
    .from(trialAbuseLogTable)
    .where(
      and(
        eq(trialAbuseLogTable.ip, ip),
        isNull(trialAbuseLogTable.override_reason), // only count non-overridden rows
      )
    );

  const total = Number(result?.total ?? 0);
  return { abused: total >= MAX_TRIALS_PER_IP, count: total };
}

/* ─── Record a trial signup ─────────────────────────────────────────────── */

/**
 * Records a new trial registration into the permanent abuse log.
 * Should be called AFTER the company and user are successfully created.
 * Fire-and-forget — never throws so it cannot break the registration flow.
 */
export async function recordTrialSignup(opts: {
  email:      string;
  ip:         string;
  user_agent: string | undefined;
  company_id: number;
}): Promise<void> {
  // Don't record loopback / private-network IPs — they are shared addresses
  // that would quickly exhaust the per-IP limit for legitimate users.
  if (isPrivateOrLoopbackIP(opts.ip)) return;

  try {
    await db.insert(trialAbuseLogTable).values({
      email:     opts.email.toLowerCase().trim(),
      ip:        opts.ip,
      user_agent: opts.user_agent ?? null,
      company_id: opts.company_id,
      flagged:   false,
    });
  } catch (err) {
    logger.error({ err, email: opts.email }, "[trial-guard] Failed to record trial signup — non-fatal");
  }
}

/* ─── Email verification token helpers ──────────────────────────────────── */

/**
 * Generates a cryptographically secure 64-hex-char verification token.
 * Stored in companies.email_verification_token.
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Returns the email verification link that should be sent to the user.
 * If BASE_URL env var is not set, falls back to localhost for development.
 */
export function buildVerificationLink(token: string): string {
  const base = (process.env.BASE_URL ?? "http://localhost:5000").replace(/\/$/, "");
  return `${base}/api/auth/verify-email?token=${token}`;
}

/**
 * Logs the email verification link to the server console.
 * Called when no email provider is configured so the admin can
 * send the link manually or copy it from the server logs.
 */
export function logVerificationLink(email: string, link: string): void {
  logger.info(
    { email, verification_link: link },
    "[trial-guard] Verification link (copy from logs if no email provider is configured)"
  );
}
