/**
 * redis.ts — Shared Redis client for the trial protection subsystem.
 *
 * Fail-closed by design:
 *   maxRetriesPerRequest: 0  → commands throw immediately when disconnected.
 *   enableOfflineQueue: false → commands queued during connect window fail fast.
 *
 * Connection order:
 *   1. REDIS_URL (full URL, e.g. redis://[:password@]host:port)
 *   2. REDIS_HOST + REDIS_PORT (default 127.0.0.1:6379) + optional REDIS_PASSWORD
 *
 * Any caller that cannot tolerate Redis being down should catch errors
 * and return HTTP 503 TRIAL_SYSTEM_UNAVAILABLE.
 */

import Redis, { type RedisOptions } from "ioredis";
import { logger } from "./logger";

const SHARED_OPTS: RedisOptions = {
  maxRetriesPerRequest: 0,      // fail-closed: throw immediately on disconnected command
  enableOfflineQueue: false,    // do not buffer commands while reconnecting
  enableReadyCheck: true,
  lazyConnect: false,           // connect eagerly so failures surface at startup
  retryStrategy: (times: number) => {
    /* Reconnect with exponential back-off (max 10 s).
       Commands fail immediately (maxRetriesPerRequest: 0) while the
       connection keeps retrying, so transient Redis restarts are handled. */
    return Math.min(times * 200, 10_000);
  },
};

function createTrialRedis(): Redis {
  const url = process.env.REDIS_URL;

  const client = url
    ? new Redis(url, SHARED_OPTS)
    : new Redis({
        ...SHARED_OPTS,
        host:     process.env.REDIS_HOST     ?? "127.0.0.1",
        port:     Number(process.env.REDIS_PORT ?? "6379"),
        password: process.env.REDIS_PASSWORD ?? undefined,
      });

  client.on("connect",      () => logger.info("[TrialRedis] Connected"));
  client.on("ready",        () => logger.info("[TrialRedis] Ready"));
  client.on("reconnecting", () => logger.warn("[TrialRedis] Reconnecting…"));
  client.on("error", (err: Error) =>
    logger.error({ err }, "[TrialRedis] Error — trial protection is fail-closed during outage"),
  );
  client.on("close", () => logger.warn("[TrialRedis] Connection closed"));

  return client;
}

export const trialRedis: Redis = createTrialRedis();

/** Redis key schema for all trial-protection keys. */
export const K = {
  GLOBAL_EVENTS:  "trial:global_events",
  IP_EVENTS:      (ip: string)  => `trial:ip:${ip}`,
  FP_EVENTS:      (fp: string)  => `trial:fp:${fp}`,
  ACTIVE_IPS:     "trial:active_ips",
  ACTIVE_FPS:     "trial:active_fps",
  RECENT_BLOCKS:  "trial:recent_blocks",
  PAUSE:          "trial:pause",
  WARNING:        "trial:warning",
  COOLDOWN:       (key: string) => `trial:cooldown:${key}`,
  RATE_IP:        (ip: string)  => `trial:rate:ip:${ip}`,
  RATE_FP:        (fp: string)  => `trial:rate:fp:${fp}`,
} as const;
