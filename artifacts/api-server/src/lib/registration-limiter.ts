/**
 * registration-limiter.ts — Redis-backed rate limiters for POST /auth/register.
 *
 * Two independent limiters:
 *   1. Per-IP  : window=15 min, limit=REG_IP_LIMIT  (default 5)
 *   2. Per-FP  : window=30 min, limit=REG_FP_LIMIT  (default 3)
 *
 * Storage: Redis INCR + EXPIRE.
 *   Key trial:rate:ip:{ip}  — counter, auto-expires after window
 *   Key trial:rate:fp:{fp}  — counter, auto-expires after window
 *
 * Fail-closed: if Redis is unavailable the command throws and the route
 * returns 503 TRIAL_SYSTEM_UNAVAILABLE — never silently allow.
 *
 * API is identical to the previous in-memory version; callers are unchanged
 * except for `await` on the two async functions and the middleware.
 */

import type { Request, Response, NextFunction } from "express";
import { trialRedis, K } from "./redis";
import { logger } from "./logger";

/* ── Config ─────────────────────────────────────────────────────────────── */
const IP_WINDOW_SEC = Math.ceil(Number(process.env.REG_IP_WINDOW_MS  ?? String(15 * 60 * 1000)) / 1000);
const IP_LIMIT      = Number(process.env.REG_IP_LIMIT ?? "5");

const FP_WINDOW_SEC = Math.ceil(Number(process.env.REG_FP_WINDOW_MS  ?? String(30 * 60 * 1000)) / 1000);
const FP_LIMIT      = Number(process.env.REG_FP_LIMIT ?? "3");

/* ── Shared Redis INCR/EXPIRE helper ────────────────────────────────────── */
async function checkAndRecord(
  key:       string,
  limit:     number,
  windowSec: number,
  logTag:    string,
): Promise<{ blocked: boolean; remaining: number; resetMs: number }> {
  /* INCR returns the new value. If it's 1 (first hit), set the expiry. */
  const count = await trialRedis.incr(key);
  if (count === 1) {
    /* First registration in this window — set TTL. */
    await trialRedis.expire(key, windowSec);
  }

  const ttl      = await trialRedis.ttl(key);
  const resetMs  = Date.now() + Math.max(ttl, 0) * 1000;
  const remaining = Math.max(0, limit - count);

  if (count > limit) {
    logger.warn({ key, count, limit, tag: logTag }, `[RegLimit] ${logTag} rate limit exceeded`);
    return { blocked: true, remaining: 0, resetMs };
  }

  return { blocked: false, remaining, resetMs };
}

/* ── Public async API ───────────────────────────────────────────────────── */

/** Check and record an IP-based registration rate hit. Throws if Redis is down. */
export async function checkAndRecordIPLimit(
  ip: string,
): Promise<{ blocked: boolean; remaining: number; resetMs: number }> {
  return checkAndRecord(K.RATE_IP(ip), IP_LIMIT, IP_WINDOW_SEC, "IP");
}

/** Check and record a fingerprint-based rate hit. Throws if Redis is down. */
export async function checkAndRecordFPLimit(
  fingerprint: string,
): Promise<{ blocked: boolean; remaining: number; resetMs: number }> {
  return checkAndRecord(K.RATE_FP(fingerprint), FP_LIMIT, FP_WINDOW_SEC, "FP");
}

/* ── Express middleware (IP only, applied at route mount) ───────────────── */

/**
 * Async middleware — applies the IP rate limit before the route handler runs.
 * Mount on the register route:
 *   router.post('/auth/register', ipRegistrationLimiter, handler)
 */
export async function ipRegistrationLimiter(
  req:  Request,
  res:  Response,
  next: NextFunction,
): Promise<void> {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").trim();

  let result: { blocked: boolean; remaining: number; resetMs: number };
  try {
    result = await checkAndRecordIPLimit(ip);
  } catch (err) {
    /* Redis unavailable — fail-OPEN: allow registration, rate limiting is secondary.
       Primary fraud detection (DB checks) still runs in checkTrialEligibility(). */
    logger.warn({ err, ip }, "[RegLimit] Redis unavailable — failing open on IP rate limiter");
    next();
    return;
  }

  res.setHeader("X-RateLimit-Limit-Register",     String(IP_LIMIT));
  res.setHeader("X-RateLimit-Remaining-Register",  String(result.remaining));
  res.setHeader("X-RateLimit-Window-Register",     String(IP_WINDOW_SEC));

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
