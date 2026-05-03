/**
 * per-tenant-rate-limit.ts
 *
 * Per-company (tenant) rate limiting for multi-tenant SaaS.
 * Limits requests by company_id extracted from the JWT — so a single
 * misbehaving tenant cannot consume resources of other tenants.
 *
 * Strategy:
 *  - Authenticated requests: keyed on company_id from JWT
 *  - Unauthenticated requests: keyed on IP (fallback)
 *  - Limits: 600 req/min per tenant (10 req/s burst)
 *  - Separate tighter limit for write operations (POST/PUT/PATCH/DELETE): 120 req/min
 *  - Storage: same Redis-backed / in-memory fallback pattern as generalLimiter
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

/* ── Redis store (shared singleton if redis is available) ─────── */
let redis: import("ioredis").Redis | null = null;

(async () => {
  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import("ioredis");
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        lazyConnect: true,
      });
      redis.on("error", () => { redis = null; });
      await redis.ping();
    } catch {
      redis = null;
    }
  }
})();

/* ── In-memory counters for dev / redis fallback ─────────────── */
const memCounters = new Map<string, { count: number; resetAt: number }>();

function getMemCounter(key: string, windowMs: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = memCounters.get(key);
  if (!entry || entry.resetAt < now) {
    const newEntry = { count: 0, resetAt: now + windowMs };
    memCounters.set(key, newEntry);
    return newEntry;
  }
  return entry;
}

/* Cleanup stale entries every 5 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memCounters) {
    if (v.resetAt < now) memCounters.delete(k);
  }
}, 300_000);

/* ── Helper: extract company_id from Bearer JWT ──────────────── */
function extractCompanyId(req: Request): number | null {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const decoded = jwt.verify(token, secret) as { company_id?: number };
    return decoded.company_id ?? null;
  } catch {
    return null;
  }
}

/* ── Increment in Redis or memory ────────────────────────────── */
async function increment(key: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const now = Date.now();

  if (redis) {
    try {
      const exec = await redis
        .multi()
        .incr(key)
        .expire(key, ttlSec, "NX")
        .pttl(key)
        .exec();
      const totalHits = Number((exec?.[0]?.[1] as number) ?? 1);
      let pttl = Number((exec?.[2]?.[1] as number) ?? windowMs);
      if (!Number.isFinite(pttl) || pttl < 0) pttl = windowMs;
      const resetAt = new Date(now + pttl);
      return { allowed: totalHits <= limit, remaining: Math.max(0, limit - totalHits), resetAt };
    } catch (err) {
      logger.warn({ err }, "[TenantRL] Redis error — falling back to memory");
    }
  }

  // Memory fallback
  const entry = getMemCounter(key, windowMs);
  entry.count++;
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: new Date(entry.resetAt),
  };
}

/* ── Config ─────────────────────────────────────────────────── */
const DEV = process.env.NODE_ENV === "development";
const READ_WINDOW_MS = 60_000;  // 1 minute
const READ_LIMIT     = DEV ? 1_000_000 : 600;     // 600 read req/min per tenant
const WRITE_WINDOW_MS = 60_000;
const WRITE_LIMIT     = DEV ? 1_000_000 : 120;    // 120 write req/min per tenant

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/* ── Middleware ──────────────────────────────────────────────── */
export async function perTenantRateLimit(req: Request, res: Response, next: NextFunction) {
  // Build tenant key
  const companyId = extractCompanyId(req);
  const tenantKey = companyId != null ? `tenant:${companyId}` : `ip:${req.ip ?? "unknown"}`;

  const isWrite = WRITE_METHODS.has(req.method.toUpperCase());
  const windowMs = isWrite ? WRITE_WINDOW_MS : READ_WINDOW_MS;
  const limit    = isWrite ? WRITE_LIMIT    : READ_LIMIT;
  const redisKey = `rl:${isWrite ? "w" : "r"}:${tenantKey}`;

  const { allowed, remaining, resetAt } = await increment(redisKey, windowMs, limit);

  res.setHeader("X-RateLimit-Limit",     String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset",     String(Math.floor(resetAt.getTime() / 1000)));
  if (companyId) {
    res.setHeader("X-RateLimit-Tenant", String(companyId));
  }

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    logger.warn({
      tenantKey,
      method: req.method,
      path: req.path,
      retryAfter,
    }, "[TenantRL] Rate limit exceeded");

    res.status(429).json({
      error: "حد الطلبات المسموح به تجاوز — يرجى الانتظار قبل إعادة المحاولة",
      error_en: "Tenant rate limit exceeded",
      retry_after_seconds: retryAfter,
      tenant_key: companyId ? `company:${companyId}` : "ip",
    });
    return;
  }

  next();
}
