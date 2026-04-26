/**
 * trial-guard.ts  —  Production-grade trial abuse protection
 *
 * ── Check priority order ────────────────────────────────────────────────────
 *  1. EMAIL      — email in trial_abuse_log with no admin override (permanent block)
 *  2. IP public  — public IP exceeds MAX_TRIALS_PUBLIC_IP (default 2)
 *  3. IP private — RFC-1918/loopback IP exceeds MAX_TRIALS_PRIVATE_IP (default 5)
 *                  Private IPs are NOT fully ignored — they receive a relaxed limit
 *                  to accommodate NAT/dev environments without opening an abuse door
 *  4. UA + IP    — same (ip, user_agent) fingerprint exceeds MAX_TRIALS_UA_IP (3)
 *                  Catches VPN rotators who reuse the same browser/device
 *
 * ── FAIL-CLOSED ─────────────────────────────────────────────────────────────
 *  Every DB query that fails BLOCKS the registration.
 *  A DB blip is safer than an open door for abuse.
 *  The super admin can manually override stuck companies in the panel.
 *
 * ── IP extraction ───────────────────────────────────────────────────────────
 *  extractClientIP() reads X-Forwarded-For (trusted via Express trust-proxy=1)
 *  and normalises IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4).
 *  Always call this instead of req.ip directly.
 */

import type { Request } from "express";
import crypto from "crypto";
import { eq, and, isNull, count } from "drizzle-orm";
import { db, trialAbuseLogTable } from "@workspace/db";
import { logger } from "./logger";

/* ── Configurable limits ───────────────────────────────────────────────────── */

export const MAX_TRIALS_PUBLIC_IP: number =
  Number(process.env.MAX_TRIALS_PER_IP ?? "2");

export const MAX_TRIALS_PRIVATE_IP: number =
  Number(process.env.MAX_TRIALS_PRIVATE_PER_IP ?? "5");

export const MAX_TRIALS_UA_IP: number =
  Number(process.env.MAX_TRIALS_UA_IP ?? "3");

/* ── Result type ───────────────────────────────────────────────────────────── */

export interface TrialCheckResult {
  allowed:       boolean;
  blocked_by:    "email" | "ip_public" | "ip_private" | "ua_ip" | null;
  reason:        string;
  ip:            string;
  is_private_ip: boolean;
  ip_count:      number;
  ua_ip_count:   number;
  email_blocked: boolean;
}

/* ── IP utilities ──────────────────────────────────────────────────────────── */

/** Strips IPv4-in-IPv6 wrapper and lowercases for consistent DB comparisons. */
function normalizeIP(ip: string): string {
  const raw = ip.trim().toLowerCase();
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

/**
 * Extracts the real client IP from the request.
 * Reads the first entry of X-Forwarded-For (set by nginx, trusted via
 * Express trust-proxy=1). Falls back to req.ip then socket address.
 * Always returns a normalised string.
 */
export function extractClientIP(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const raw   = typeof xff === "string" ? xff : xff[0];
    const first = raw.split(",")[0]?.trim();
    if (first) return normalizeIP(first);
  }
  return normalizeIP(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

/**
 * Returns true for RFC-1918 private addresses and loopback ranges.
 * Private IPs still get checked — but against a higher limit.
 */
export function isPrivateOrLoopbackIP(ip: string): boolean {
  const v4 = normalizeIP(ip);
  if (v4 === "::1" || v4 === "localhost") return true;
  const parts = v4.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 127) return true;                          // 127.0.0.0/8  loopback
    if (a === 10)  return true;                          // 10.0.0.0/8   RFC-1918
    if (a === 192 && b === 168) return true;             // 192.168.0.0/16
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  }
  return false;
}

/* ── Individual checks (all FAIL-CLOSED — throw on DB error) ──────────────── */

/** Check 1: email block. Throws → caller blocks registration. */
async function checkEmailBlock(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: trialAbuseLogTable.id })
    .from(trialAbuseLogTable)
    .where(
      and(
        eq(trialAbuseLogTable.email, email.toLowerCase().trim()),
        isNull(trialAbuseLogTable.override_reason),
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Check 2 & 3: IP count with separate limits for public vs private ranges. Throws → caller blocks. */
async function checkIPBlock(
  ip: string,
): Promise<{ blocked: boolean; count: number; is_private: boolean }> {
  const is_private = isPrivateOrLoopbackIP(ip);
  const limit      = is_private ? MAX_TRIALS_PRIVATE_IP : MAX_TRIALS_PUBLIC_IP;

  const [result] = await db
    .select({ total: count() })
    .from(trialAbuseLogTable)
    .where(
      and(
        eq(trialAbuseLogTable.ip, ip),
        isNull(trialAbuseLogTable.override_reason),
      )
    );

  const total = Number(result?.total ?? 0);
  return { blocked: total >= limit, count: total, is_private };
}

/** Check 4: UA + IP fingerprint. Throws → caller blocks. Only runs when UA is present. */
async function checkUAIPBlock(
  ip:        string,
  userAgent: string,
): Promise<{ blocked: boolean; count: number }> {
  const [result] = await db
    .select({ total: count() })
    .from(trialAbuseLogTable)
    .where(
      and(
        eq(trialAbuseLogTable.ip, ip),
        eq(trialAbuseLogTable.user_agent, userAgent),
        isNull(trialAbuseLogTable.override_reason),
      )
    );

  const total = Number(result?.total ?? 0);
  return { blocked: total >= MAX_TRIALS_UA_IP, count: total };
}

/* ── Main eligibility function ─────────────────────────────────────────────── */

/**
 * Runs all trial abuse checks and returns a structured decision.
 *
 * FAIL-CLOSED contract: if any DB query throws, this function re-throws.
 * The registration handler must catch it and respond with 503 — never
 * silently allow registration on infrastructure failure.
 *
 * Every decision (allowed or blocked) is logged at INFO/WARN level for audit.
 */
export async function checkTrialEligibility(
  email:     string,
  ip:        string,
  userAgent: string | undefined,
): Promise<TrialCheckResult> {
  const normalEmail = email.toLowerCase().trim();
  const normalIP    = normalizeIP(ip);
  const is_private  = isPrivateOrLoopbackIP(normalIP);

  /* ── 1. Email ──────────────────────────────────────────────────────────── */
  const email_blocked = await checkEmailBlock(normalEmail); // throws on DB error
  if (email_blocked) {
    const result: TrialCheckResult = {
      allowed: false, blocked_by: "email",
      reason:        "email already consumed a trial — admin override required",
      ip: normalIP, is_private_ip: is_private,
      ip_count: 0, ua_ip_count: 0, email_blocked: true,
    };
    logger.warn({ ...result, email: normalEmail }, "[TrialGuard] BLOCKED");
    return result;
  }

  /* ── 2 & 3. IP ────────────────────────────────────────────────────────── */
  const ipResult = await checkIPBlock(normalIP); // throws on DB error
  if (ipResult.blocked) {
    const limit = is_private ? MAX_TRIALS_PRIVATE_IP : MAX_TRIALS_PUBLIC_IP;
    const result: TrialCheckResult = {
      allowed: false,
      blocked_by:    is_private ? "ip_private" : "ip_public",
      reason:        `ip exceeded limit (${ipResult.count}/${limit})`,
      ip: normalIP, is_private_ip: is_private,
      ip_count: ipResult.count, ua_ip_count: 0, email_blocked: false,
    };
    logger.warn({ ...result, email: normalEmail }, "[TrialGuard] BLOCKED");
    return result;
  }

  /* ── 4. UA + IP fingerprint ───────────────────────────────────────────── */
  let ua_ip_count = 0;
  if (userAgent) {
    const uaResult = await checkUAIPBlock(normalIP, userAgent); // throws on DB error
    ua_ip_count = uaResult.count;
    if (uaResult.blocked) {
      const result: TrialCheckResult = {
        allowed: false, blocked_by: "ua_ip",
        reason:        `ua+ip fingerprint exceeded limit (${ua_ip_count}/${MAX_TRIALS_UA_IP})`,
        ip: normalIP, is_private_ip: is_private,
        ip_count: ipResult.count, ua_ip_count, email_blocked: false,
      };
      logger.warn({ ...result, email: normalEmail }, "[TrialGuard] BLOCKED");
      return result;
    }
  }

  /* ── All checks passed ────────────────────────────────────────────────── */
  const result: TrialCheckResult = {
    allowed: true, blocked_by: null,
    reason:        "all checks passed",
    ip: normalIP, is_private_ip: is_private,
    ip_count: ipResult.count, ua_ip_count, email_blocked: false,
  };
  logger.info({ ...result, email: normalEmail }, "[TrialGuard] ALLOWED");
  return result;
}

/* ── Record signup ─────────────────────────────────────────────────────────── */

/**
 * Records a confirmed trial signup into the permanent abuse log.
 * Call AFTER the company and user are successfully created.
 *
 * Records all IPs including private — private-IP registrations count toward
 * the relaxed limit (MAX_TRIALS_PRIVATE_IP) so they are tracked properly.
 *
 * Does NOT throw — a failed log entry is recoverable by the super admin;
 * a rolled-back registration is not. Error is logged at CRITICAL level.
 */
export async function recordTrialSignup(opts: {
  email:      string;
  ip:         string;
  user_agent: string | undefined;
  company_id: number;
}): Promise<void> {
  try {
    await db.insert(trialAbuseLogTable).values({
      email:      opts.email.toLowerCase().trim(),
      ip:         normalizeIP(opts.ip),
      user_agent: opts.user_agent ?? null,
      company_id: opts.company_id,
      flagged:    false,
    });
  } catch (err) {
    logger.error(
      { err, email: opts.email, ip: opts.ip, company_id: opts.company_id },
      "[TrialGuard] CRITICAL: failed to record trial signup — manual audit required",
    );
  }
}

/* ── Email verification helpers ────────────────────────────────────────────── */

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildVerificationLink(token: string): string {
  const base = (process.env.BASE_URL ?? "http://localhost:5000").replace(/\/$/, "");
  return `${base}/api/auth/verify-email?token=${token}`;
}

export function logVerificationLink(email: string, link: string): void {
  logger.info(
    { email, verification_link: link },
    "[TrialGuard] Email verification link (copy from logs if no email provider configured)",
  );
}

/* ── Legacy shims — kept so existing call sites compile without changes ─────── */

/** @deprecated Use checkTrialEligibility() */
export async function isEmailTrialAbused(email: string): Promise<boolean> {
  try   { return await checkEmailBlock(email); }
  catch { return true; } // fail-closed
}

/** @deprecated Use checkTrialEligibility() */
export async function isIPTrialAbused(ip: string): Promise<{ abused: boolean; count: number }> {
  try {
    const r = await checkIPBlock(ip);
    return { abused: r.blocked, count: r.count };
  } catch {
    return { abused: true, count: -1 }; // fail-closed
  }
}
