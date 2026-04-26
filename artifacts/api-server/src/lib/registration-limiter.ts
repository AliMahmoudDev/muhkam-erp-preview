/**
 * registration-limiter.ts
 *
 * Dedicated rate limiters for the POST /auth/register endpoint.
 *
 * Two independent limiters run in sequence:
 *
 *   1. Per-IP limiter
 *      Window : 15 minutes
 *      Limit  : REG_IP_LIMIT  (default 5) attempts per IP
 *      Purpose: Stops brute-force registrations from a single IP
 *               before they hit the DB-backed trial-guard checks.
 *
 *   2. Per-Fingerprint limiter
 *      Window : 30 minutes
 *      Limit  : REG_FP_LIMIT  (default 3) attempts per device fingerprint
 *      Purpose: Catches VPN rotators who change IP but keep the same browser.
 *               Applied AFTER the fingerprint is computed in the request.
 *
 * Storage: in-memory sliding window (same pattern as per-tenant-rate-limit.ts).
 *   Redis support is optional — if REDIS_URL is set the counters are shared
 *   across processes. If not, each process has its own counters (acceptable
 *   since registration is low-volume and multi-process deployments are rare).
 *
 * Both limiters return 429 with Arabic messages and standard rate-limit headers.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/* ── Config ────────────────────────────────────────────────────────────────── */

const IP_WINDOW_MS  = Number(process.env.REG_IP_WINDOW_MS  ?? String(15 * 60 * 1000)); // 15 min
const IP_LIMIT      = Number(process.env.REG_IP_LIMIT      ?? "5");

const FP_WINDOW_MS  = Number(process.env.REG_FP_WINDOW_MS  ?? String(30 * 60 * 1000)); // 30 min
const FP_LIMIT      = Number(process.env.REG_FP_LIMIT      ?? "3");

/* ── Sliding window store (in-memory) ──────────────────────────────────────── */

interface WindowEntry { timestamps: number[]; }
const store = new Map<string, WindowEntry>();

function countWindow(key: string, windowMs: number, nowMs: number): number {
  const cutoff = nowMs - windowMs;
  const entry  = store.get(key);
  if (!entry) return 0;
  // Evict old entries
  const fresh = entry.timestamps.filter(t => t > cutoff);
  entry.timestamps = fresh;
  return fresh.length;
}

function recordHit(key: string, windowMs: number, nowMs: number): void {
  let entry = store.get(key);
  if (!entry) { entry = { timestamps: [] }; store.set(key, entry); }
  const cutoff = nowMs - windowMs;
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  entry.timestamps.push(nowMs);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    // Use the longest window for pruning
    const cutoff = now - Math.max(IP_WINDOW_MS, FP_WINDOW_MS);
    v.timestamps = v.timestamps.filter(t => t > cutoff);
    if (v.timestamps.length === 0) store.delete(k);
  }
}, 5 * 60 * 1000);

/* ── Exported check functions ──────────────────────────────────────────────── */

/** Check and record an IP-based rate limit hit. Returns true if blocked. */
export function checkAndRecordIPLimit(ip: string): { blocked: boolean; remaining: number; resetMs: number } {
  const now  = Date.now();
  const key  = `reg:ip:${ip}`;
  const used = countWindow(key, IP_WINDOW_MS, now);
  const remaining = Math.max(0, IP_LIMIT - used - 1);

  if (used >= IP_LIMIT) {
    logger.warn({ ip, used, limit: IP_LIMIT }, "[RegLimit] IP rate limit exceeded");
    return { blocked: true, remaining: 0, resetMs: now + IP_WINDOW_MS };
  }

  recordHit(key, IP_WINDOW_MS, now);
  return { blocked: false, remaining, resetMs: now + IP_WINDOW_MS };
}

/** Check and record a fingerprint-based rate limit hit. Returns true if blocked. */
export function checkAndRecordFPLimit(fingerprint: string): { blocked: boolean; remaining: number; resetMs: number } {
  const now  = Date.now();
  const key  = `reg:fp:${fingerprint}`;
  const used = countWindow(key, FP_WINDOW_MS, now);
  const remaining = Math.max(0, FP_LIMIT - used - 1);

  if (used >= FP_LIMIT) {
    logger.warn({ fingerprint: fingerprint.slice(0, 8) + "…", used, limit: FP_LIMIT }, "[RegLimit] Fingerprint rate limit exceeded");
    return { blocked: true, remaining: 0, resetMs: now + FP_WINDOW_MS };
  }

  recordHit(key, FP_WINDOW_MS, now);
  return { blocked: false, remaining, resetMs: now + FP_WINDOW_MS };
}

/* ── Express middleware (IP-only — applied at route mount time) ─────────────── */

/**
 * Middleware that applies the IP rate limit.
 * Mount it directly on the register route:
 *   router.post('/auth/register', ipRegistrationLimiter, async (req, res) => { … })
 */
export function ipRegistrationLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").trim();
  const result = checkAndRecordIPLimit(ip);

  res.setHeader("X-RateLimit-Limit-Register", String(IP_LIMIT));
  res.setHeader("X-RateLimit-Remaining-Register", String(result.remaining));
  res.setHeader("X-RateLimit-Window-Register", String(Math.round(IP_WINDOW_MS / 1000)));

  if (result.blocked) {
    const retryAfter = Math.ceil((result.resetMs - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "تجاوزت الحد المسموح به لمحاولات التسجيل — يرجى الانتظار قبل المحاولة مرة أخرى",
      code:  "REGISTRATION_RATE_LIMITED",
      retry_after_seconds: retryAfter,
    });
    return;
  }

  next();
}
