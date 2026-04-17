/**
 * Token blacklist for immediate logout / session revocation.
 *
 * - When REDIS_URL is set: uses Redis SET with TTL → safe across restarts and
 *   multiple server instances (load-balanced deployment).
 * - Otherwise: in-memory fallback → cleared on restart, single-instance only.
 */

import { logger } from "./logger";

const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000; // 4h — matches access-token expiry
const KEY = (token: string) => `bl:tok:${token}`;

let redis: import("ioredis").Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redis.on("error", (err: Error) => {
      logger.warn({ err }, "[SessionBlacklist] Redis error — falling back to in-memory for new requests");
      redis = null;
    });
    await redis.ping();
    logger.info("[SessionBlacklist] Connected to Redis — token blacklist is distributed");
  } catch (err) {
    logger.warn({ err }, "[SessionBlacklist] Redis unavailable — using in-memory fallback");
    redis = null;
  }
} else {
  logger.info("[SessionBlacklist] REDIS_URL not set — using in-memory store (single-instance only)");
}

/* ── In-memory fallback ─────────────────────────────────── */
const memoryBlacklist = new Map<string, number>(); // token → expiresAt(ms)

function memCleanup() {
  const now = Date.now();
  for (const [tok, exp] of memoryBlacklist) {
    if (exp <= now) memoryBlacklist.delete(tok);
  }
}

/** Add a token to the blacklist for ttlMs (default = remaining access-token TTL). */
export async function blacklistToken(token: string, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  if (redis) {
    try {
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await redis.set(KEY(token), "1", "EX", ttlSec);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memoryBlacklist.set(token, Date.now() + ttlMs);
  if (memoryBlacklist.size > 10_000) memCleanup();
}

/** Synchronous in-memory check (used when Redis is not available). */
function isBlacklistedMem(token: string): boolean {
  const exp = memoryBlacklist.get(token);
  if (exp === undefined) return false;
  if (exp <= Date.now()) {
    memoryBlacklist.delete(token);
    return false;
  }
  return true;
}

/**
 * Returns true if the token has been explicitly revoked.
 * Async to support Redis lookup. Falls back to memory on Redis errors.
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (redis) {
    try {
      const exists = await redis.exists(KEY(token));
      return exists === 1;
    } catch {
      /* fall through to memory */
    }
  }
  return isBlacklistedMem(token);
}
