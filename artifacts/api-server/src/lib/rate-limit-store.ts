/**
 * rate-limit-store.ts
 *
 * Lightweight Redis-backed store for `express-rate-limit` v8.
 *
 * Reliability:
 * - When REDIS_URL is set and reachable: uses Redis (distributed across
 *   instances and survives restarts).
 * - When Redis is unavailable or fails mid-flight: silently delegates to an
 *   in-process `MemoryStore` so rate limiting is *never* fully bypassed.
 *   This avoids fail-open behaviour during Redis outages.
 */

import type { Store, IncrementResponse, Options } from "express-rate-limit";
import { MemoryStore } from "express-rate-limit";
import { logger } from "./logger";

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
      logger.warn({ err }, "[RateLimit] Redis error — using in-memory fallback for new requests");
      redis = null;
    });
    await redis.ping();
    logger.info("[RateLimit] Connected to Redis — rate limits are distributed");
  } catch (err) {
    logger.warn({ err }, "[RateLimit] Redis unavailable — using in-memory fallback");
    redis = null;
  }
}

class RedisStore implements Store {
  prefix = "rl:";
  windowMs = 60_000;
  localKeys = false;

  /** In-process MemoryStore used when Redis is unreachable. Always-on so we
   *  never fail open. */
  private memory = new MemoryStore();

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (!redis) {
      return this.memory.increment(key);
    }

    const ttlSec = Math.max(1, Math.ceil(this.windowMs / 1000));
    const fullKey = this.k(key);
    try {
      const exec = await redis
        .multi()
        .incr(fullKey)
        .expire(fullKey, ttlSec, "NX")
        .pttl(fullKey)
        .exec();

      const totalHits = Number((exec?.[0]?.[1] as number) ?? 1);
      let pttl = Number((exec?.[2]?.[1] as number) ?? this.windowMs);
      if (!Number.isFinite(pttl) || pttl < 0) pttl = this.windowMs;
      return { totalHits, resetTime: new Date(Date.now() + pttl) };
    } catch (err) {
      logger.warn({ err }, "[RateLimit] Redis increment failed — falling back to in-memory");
      return this.memory.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    if (!redis) return this.memory.decrement(key);
    try { await redis.decr(this.k(key)); } catch { await this.memory.decrement(key); }
  }

  async resetKey(key: string): Promise<void> {
    if (redis) { try { await redis.del(this.k(key)); } catch { /* ignore */ } }
    await this.memory.resetKey(key);
  }
}

/** Returns a Redis-backed store with always-on in-memory fallback. */
export function makeRateLimitStore(prefix: string): Store {
  const store = new RedisStore();
  store.prefix = prefix;
  return store;
}
