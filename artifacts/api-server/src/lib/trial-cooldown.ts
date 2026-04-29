/**
 * trial-cooldown.ts — Redis-backed escalating cooldown store.
 *
 * Stores cooldown state in Redis with native TTL (SET … EX).
 * Persists across restarts; shared across all server instances.
 *
 * Key format : trial:cooldown:{key}   (string — JSON payload)
 * TTL        : set equal to the cooldown duration (auto-expires)
 *
 * Fail-closed: Redis errors bubble up to the caller.
 * Caller must return 503 TRIAL_SYSTEM_UNAVAILABLE — never silently allow.
 */

import { trialRedis, K } from "./redis";
import { logger } from "./logger";

export interface CooldownEntry {
  until:  number;      // ms epoch
  level:  1 | 2 | 3;
  reason: string;
}

export interface CooldownCheck {
  blocked: boolean;
  until?:  Date;
  level?:  1 | 2 | 3;
  reason?: string;
}

const DURATIONS_MS: Record<1 | 2 | 3, number> = {
  1:  1  * 60 * 60 * 1000,         // 1 hour
  2: 24  * 60 * 60 * 1000,         // 24 hours
  3:  7 * 24 * 60 * 60 * 1000,     // 7 days
};

class CooldownStore {

  /** Returns whether the given key is currently under a cooldown block. */
  async check(key: string): Promise<CooldownCheck> {
    const raw = await trialRedis.get(K.COOLDOWN(key));
    if (!raw) return { blocked: false };

    const entry = JSON.parse(raw) as CooldownEntry;

    /* TTL-expired entries may linger for a few ms — guard with clock check. */
    if (Date.now() > entry.until) {
      void trialRedis.del(K.COOLDOWN(key));
      return { blocked: false };
    }

    return {
      blocked: true,
      until:   new Date(entry.until),
      level:   entry.level,
      reason:  entry.reason,
    };
  }

  /**
   * Escalate the cooldown for the given key:
   *   Level 1 → 1 h  (first block)
   *   Level 2 → 24 h (second block)
   *   Level 3 → 7 d  (third+ blocks — persistent abuser)
   */
  async escalate(key: string, reason: string): Promise<{ level: 1 | 2 | 3; until: Date }> {
    const raw      = await trialRedis.get(K.COOLDOWN(key));
    const current  = raw ? (JSON.parse(raw) as CooldownEntry) : null;
    const nextLevel = Math.min((current?.level ?? 0) + 1, 3) as 1 | 2 | 3;
    // eslint-disable-next-line security/detect-object-injection
    const until     = Date.now() + DURATIONS_MS[nextLevel];
    // eslint-disable-next-line security/detect-object-injection
    const ttlSec    = Math.ceil(DURATIONS_MS[nextLevel] / 1000);

    const payload: CooldownEntry = { until, level: nextLevel, reason };
    await trialRedis.set(K.COOLDOWN(key), JSON.stringify(payload), "EX", ttlSec);

    logger.warn(
      { key, level: nextLevel, until: new Date(until).toISOString(), reason },
      `[Cooldown] Applied level-${nextLevel} cooldown`,
    );
    return { level: nextLevel, until: new Date(until) };
  }

  /** Legacy compat — not meaningful with Redis. */
  size(): number { return 0; }
}

export const cooldownStore = new CooldownStore();
