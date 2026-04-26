/**
 * trial-guard.ts  —  Enterprise-grade trial abuse protection
 *
 * ── Check priority order ────────────────────────────────────────────────────
 *  0. ANOMALY    — global registration spike → 503 pause (trial-anomaly)
 *  1. COOLDOWN   — IP or fingerprint under temporary time-out (trial-cooldown)
 *  2. EMAIL      — email in trial_abuse_log with no admin override (permanent block)
 *  3. IP public  — public IP exceeds MAX_TRIALS_PUBLIC_IP (default 2)
 *  4. IP private — RFC-1918/loopback IP exceeds MAX_TRIALS_PRIVATE_IP (default 5)
 *  5. UA + IP    — same (ip, user_agent) combo exceeds MAX_TRIALS_UA_IP (3)
 *  6. FINGERPRINT— device fingerprint (SHA-256 of browser signals) exceeds limit
 *
 * ── FAIL-CLOSED ─────────────────────────────────────────────────────────────
 *  Every DB query failure BLOCKS the registration.
 *
 * ── Cooldown escalation (trial-cooldown.ts) ──────────────────────────────────
 *  When any check blocks → escalate cooldown for IP + fingerprint.
 *  Level 1 = 1h, Level 2 = 24h, Level 3 = 7 days.
 *
 * ── Anomaly detection (trial-anomaly.ts) ─────────────────────────────────────
 *  Global spike → auto-pause all registrations for PAUSE_MS.
 *  Per-key spike → logged as WARN for alerting.
 *
 * ── IP extraction ───────────────────────────────────────────────────────────
 *  extractClientIP() reads X-Forwarded-For (trusted via Express trust-proxy=1)
 *  and normalises IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4).
 */

import type { Request } from "express";
import crypto from "crypto";
import { eq, and, isNull, count } from "drizzle-orm";
import { db, trialAbuseLogTable } from "@workspace/db";
import { logger } from "./logger";
import { cooldownStore } from "./trial-cooldown";
import { anomalyDetector } from "./trial-anomaly";
import { recentBlocksStore } from "./trial-recent-blocks";

/* ── Configurable limits ───────────────────────────────────────────────────── */

export const MAX_TRIALS_PUBLIC_IP: number =
  Number(process.env.MAX_TRIALS_PER_IP ?? "2");

export const MAX_TRIALS_PRIVATE_IP: number =
  Number(process.env.MAX_TRIALS_PRIVATE_PER_IP ?? "5");

export const MAX_TRIALS_UA_IP: number =
  Number(process.env.MAX_TRIALS_UA_IP ?? "3");

/* ── Result type ───────────────────────────────────────────────────────────── */

export interface TrialCheckResult {
  allowed:        boolean;
  blocked_by:     "anomaly_pause" | "cooldown" | "email" | "ip_public" | "ip_private" | "ua_ip" | "fingerprint" | null;
  reason:         string;
  ip:             string;
  is_private_ip:  boolean;
  ip_count:       number;
  ua_ip_count:    number;
  fp_count:       number;
  email_blocked:  boolean;
  fingerprint?:   string;
  cooldown_until?: Date;
  cooldown_level?: number;
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

/** Check 5: UA + IP. Throws → caller blocks. Only runs when UA is present. */
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

/** Check 6: device fingerprint (SHA-256 of browser signals). Throws → caller blocks. */
async function checkFingerprintBlock(
  fingerprint: string,
): Promise<{ blocked: boolean; count: number }> {
  const [result] = await db
    .select({ total: count() })
    .from(trialAbuseLogTable)
    .where(
      and(
        eq(trialAbuseLogTable.fingerprint, fingerprint),
        isNull(trialAbuseLogTable.override_reason),
      )
    );
  const total = Number(result?.total ?? 0);
  return { blocked: total >= MAX_TRIALS_UA_IP, count: total };
}

/* ── Main eligibility function ─────────────────────────────────────────────── */

/**
 * Runs all 7 trial abuse checks in priority order and returns a decision.
 *
 * FAIL-CLOSED: if any DB query throws, this function re-throws.
 * Caller must catch and return 503 — never silently allow on failure.
 *
 * Side effects on block: escalates cooldown for IP + fingerprint.
 * Always records attempt in anomaly detector (before any block).
 */
export async function checkTrialEligibility(
  email:       string,
  ip:          string,
  userAgent:   string | undefined,
  fingerprint: string | undefined,
): Promise<TrialCheckResult> {
  const normalEmail = email.toLowerCase().trim();
  const normalIP    = normalizeIP(ip);
  const is_private  = isPrivateOrLoopbackIP(normalIP);

  /* ── 0. Record attempt in anomaly detector ────────────────────────────── */
  anomalyDetector.record(normalIP);
  if (fingerprint) anomalyDetector.record(`fp:${fingerprint}`);

  /* ── 0b. Global anomaly pause ─────────────────────────────────────────── */
  if (anomalyDetector.isPaused()) {
    const result: TrialCheckResult = {
      allowed: false, blocked_by: "anomaly_pause",
      reason:        "global registration spike detected — registrations temporarily paused",
      ip: normalIP, is_private_ip: is_private,
      ip_count: 0, ua_ip_count: 0, fp_count: 0, email_blocked: false, fingerprint,
    };
    logger.warn({ email: normalEmail, ip: normalIP }, "[TrialGuard] BLOCKED — anomaly pause");
    recentBlocksStore.record({ email: normalEmail, ip: normalIP, reason: "anomaly_pause", created_at: new Date().toISOString() });
    return result;
  }

  /* ── 1. Cooldown check ────────────────────────────────────────────────── */
  const ipCooldown = cooldownStore.check(normalIP);
  if (ipCooldown.blocked) {
    const result: TrialCheckResult = {
      allowed: false, blocked_by: "cooldown",
      reason:        `ip cooldown active (level ${ipCooldown.level}) until ${ipCooldown.until?.toISOString()}`,
      ip: normalIP, is_private_ip: is_private,
      ip_count: 0, ua_ip_count: 0, fp_count: 0, email_blocked: false, fingerprint,
      cooldown_until: ipCooldown.until, cooldown_level: ipCooldown.level,
    };
    logger.warn({ email: normalEmail, ip: normalIP, level: ipCooldown.level }, "[TrialGuard] BLOCKED — cooldown");
    return result;
  }
  if (fingerprint) {
    const fpCooldown = cooldownStore.check(`fp:${fingerprint}`);
    if (fpCooldown.blocked) {
      const result: TrialCheckResult = {
        allowed: false, blocked_by: "cooldown",
        reason:        `fingerprint cooldown active (level ${fpCooldown.level}) until ${fpCooldown.until?.toISOString()}`,
        ip: normalIP, is_private_ip: is_private,
        ip_count: 0, ua_ip_count: 0, fp_count: 0, email_blocked: false, fingerprint,
        cooldown_until: fpCooldown.until, cooldown_level: fpCooldown.level,
      };
      logger.warn({ email: normalEmail, fingerprint: fingerprint.slice(0,8), level: fpCooldown.level }, "[TrialGuard] BLOCKED — fingerprint cooldown");
      return result;
    }
  }

  /** Helper: apply cooldown escalation to both IP and fingerprint on block,
   *  and record the attempt in the real-time monitoring ring buffer. */
  function applyBlock(result: TrialCheckResult): TrialCheckResult {
    const reason = result.blocked_by ?? "blocked";
    cooldownStore.escalate(normalIP, reason);
    if (fingerprint) cooldownStore.escalate(`fp:${fingerprint}`, reason);
    recentBlocksStore.record({
      email:      normalEmail,
      ip:         normalIP,
      reason:     reason,
      created_at: new Date().toISOString(),
    });
    return result;
  }

  /* ── 2. Email ─────────────────────────────────────────────────────────── */
  const email_blocked = await checkEmailBlock(normalEmail); // throws on DB error
  if (email_blocked) {
    return applyBlock({
      allowed: false, blocked_by: "email",
      reason:        "email already consumed a trial — admin override required",
      ip: normalIP, is_private_ip: is_private,
      ip_count: 0, ua_ip_count: 0, fp_count: 0, email_blocked: true, fingerprint,
    });
  }

  /* ── 3 & 4. IP ────────────────────────────────────────────────────────── */
  const ipResult = await checkIPBlock(normalIP); // throws on DB error
  if (ipResult.blocked) {
    const limit = is_private ? MAX_TRIALS_PRIVATE_IP : MAX_TRIALS_PUBLIC_IP;
    return applyBlock({
      allowed: false,
      blocked_by:    is_private ? "ip_private" : "ip_public",
      reason:        `ip exceeded limit (${ipResult.count}/${limit})`,
      ip: normalIP, is_private_ip: is_private,
      ip_count: ipResult.count, ua_ip_count: 0, fp_count: 0, email_blocked: false, fingerprint,
    });
  }

  /* ── 5. UA + IP ───────────────────────────────────────────────────────── */
  let ua_ip_count = 0;
  if (userAgent) {
    const uaResult = await checkUAIPBlock(normalIP, userAgent); // throws on DB error
    ua_ip_count = uaResult.count;
    if (uaResult.blocked) {
      return applyBlock({
        allowed: false, blocked_by: "ua_ip",
        reason:        `ua+ip combo exceeded limit (${ua_ip_count}/${MAX_TRIALS_UA_IP})`,
        ip: normalIP, is_private_ip: is_private,
        ip_count: ipResult.count, ua_ip_count, fp_count: 0, email_blocked: false, fingerprint,
      });
    }
  }

  /* ── 6. Device fingerprint ────────────────────────────────────────────── */
  let fp_count = 0;
  if (fingerprint) {
    const fpResult = await checkFingerprintBlock(fingerprint); // throws on DB error
    fp_count = fpResult.count;
    if (fpResult.blocked) {
      return applyBlock({
        allowed: false, blocked_by: "fingerprint",
        reason:        `device fingerprint exceeded limit (${fp_count}/${MAX_TRIALS_UA_IP})`,
        ip: normalIP, is_private_ip: is_private,
        ip_count: ipResult.count, ua_ip_count, fp_count, email_blocked: false, fingerprint,
      });
    }
  }

  /* ── All checks passed ────────────────────────────────────────────────── */
  const result: TrialCheckResult = {
    allowed: true, blocked_by: null,
    reason:        "all checks passed",
    ip: normalIP, is_private_ip: is_private,
    ip_count: ipResult.count, ua_ip_count, fp_count, email_blocked: false, fingerprint,
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
  email:       string;
  ip:          string;
  user_agent:  string | undefined;
  fingerprint: string | undefined;
  company_id:  number;
}): Promise<void> {
  try {
    await db.insert(trialAbuseLogTable).values({
      email:       opts.email.toLowerCase().trim(),
      ip:          normalizeIP(opts.ip),
      user_agent:  opts.user_agent  ?? null,
      fingerprint: opts.fingerprint ?? null,
      company_id:  opts.company_id,
      flagged:     false,
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
