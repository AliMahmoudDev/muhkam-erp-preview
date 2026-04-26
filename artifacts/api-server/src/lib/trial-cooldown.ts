/**
 * trial-cooldown.ts
 *
 * Escalating temporary block system for trial abuse.
 *
 * When a registration attempt is blocked by trial-guard, the cooldown
 * manager imposes a temporary time-out before the same IP/fingerprint
 * can attempt registration again — even if they change email or use a
 * different device.
 *
 * Escalation schedule (per key):
 *   Level 1 → 1 hour  (first block)
 *   Level 2 → 24 hours (second block)
 *   Level 3 → 7 days   (third+ block — treat as persistent abuser)
 *
 * Storage: in-process Map with TTL.
 *   - Simple, zero-latency, zero-deps.
 *   - Not persisted across server restarts — intentional (gives abusers
 *     one "free" cooldown reset on restart, but the hard DB blocks remain).
 *   - Stale entries are pruned every 10 minutes.
 *
 * Keys: any string (use IP or device fingerprint).
 * Multiple keys can be checked — IP AND fingerprint are both tracked
 * so changing IP doesn't reset the fingerprint cooldown.
 */

import { logger } from "./logger";

export interface CooldownEntry {
  until:      number; // ms epoch
  level:      1 | 2 | 3;
  reason:     string; // what triggered the cooldown
}

export interface CooldownCheck {
  blocked: boolean;
  until?:  Date;
  level?:  1 | 2 | 3;
  reason?: string;
}

const DURATIONS_MS: Record<1 | 2 | 3, number> = {
  1:  1  * 60 * 60 * 1000,  // 1 hour
  2: 24  * 60 * 60 * 1000,  // 24 hours
  3:  7 * 24 * 60 * 60 * 1000,  // 7 days
};

class CooldownStore {
  private readonly store = new Map<string, CooldownEntry>();

  /** Returns true if the key is currently under a cooldown. */
  check(key: string): CooldownCheck {
    const entry = this.store.get(key);
    if (!entry) return { blocked: false };

    if (Date.now() > entry.until) {
      this.store.delete(key);
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
   * Records a block event for the key, escalating the level.
   * Returns the applied level and expiry time.
   */
  escalate(key: string, reason: string): { level: 1 | 2 | 3; until: Date } {
    const current = this.store.get(key);
    const nextLevel = (Math.min((current?.level ?? 0) + 1, 3)) as 1 | 2 | 3;
    const until = Date.now() + DURATIONS_MS[nextLevel];

    this.store.set(key, { until, level: nextLevel, reason });

    logger.warn(
      { key, level: nextLevel, until: new Date(until), reason },
      `[Cooldown] Applied level-${nextLevel} cooldown`,
    );

    return { level: nextLevel, until: new Date(until) };
  }

  /** Remove expired entries. Called automatically every 10 minutes. */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [k, v] of this.store) {
      if (v.until < now) { this.store.delete(k); pruned++; }
    }
    return pruned;
  }

  size(): number { return this.store.size; }
}

export const cooldownStore = new CooldownStore();

setInterval(() => {
  const pruned = cooldownStore.prune();
  if (pruned > 0) {
    logger.debug({ pruned }, "[Cooldown] Pruned expired entries");
  }
}, 10 * 60 * 1000);
