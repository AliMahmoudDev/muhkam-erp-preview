/**
 * trial-recent-blocks.ts
 *
 * Redis-backed ring buffer for the last N blocked trial-registration attempts.
 * Persists across server restarts; shared across all instances.
 *
 * Redis key : trial:recent_blocks  (list)
 * Operations: LPUSH (prepend) + LTRIM (cap at MAX) + LRANGE (read)
 *
 * Fail-closed: if Redis is unavailable any operation will throw, which is
 * caught by the caller (trial-guard) and returned as 503.
 */

import { trialRedis, K } from './redis';

const MAX_ENTRIES = 100;

export interface BlockedAttempt {
  email: string;
  ip: string;
  fingerprint?: string;
  reason: string;
  created_at: string; // ISO timestamp
}

export const recentBlocksStore = {
  /** Prepend a blocked attempt and cap the list at MAX_ENTRIES. */
  async record(entry: BlockedAttempt): Promise<void> {
    const pipeline = trialRedis.pipeline();
    pipeline.lpush(K.RECENT_BLOCKS, JSON.stringify(entry));
    pipeline.ltrim(K.RECENT_BLOCKS, 0, MAX_ENTRIES - 1);
    await pipeline.exec();
  },

  /** Return the most recent n entries (default 20). Newest first. */
  async recent(n = 20): Promise<BlockedAttempt[]> {
    const raw = await trialRedis.lrange(K.RECENT_BLOCKS, 0, n - 1);
    return raw.map((s) => JSON.parse(s) as BlockedAttempt);
  },

  /**
   * Remove every recorded attempt that matches ANY of the provided identifiers
   * (ip / email / fingerprint). Used when a super-admin lifts a block so the
   * entry disappears from the dashboard immediately instead of lingering in the
   * ring buffer until it ages out at MAX_ENTRIES.
   *
   * Uses LREM on the exact raw JSON string so entries pushed concurrently are
   * never clobbered (unlike a read-filter-rewrite). Malformed entries are
   * skipped. Returns the number of list elements removed.
   */
  async removeMatching(match: {
    ip?: string;
    email?: string;
    fingerprint?: string;
  }): Promise<number> {
    const ip = match.ip?.trim().toLowerCase();
    const email = match.email?.trim().toLowerCase();
    const fingerprint = match.fingerprint?.trim();
    if (!ip && !email && !fingerprint) return 0;

    const raw = await trialRedis.lrange(K.RECENT_BLOCKS, 0, -1);
    const toRemove = new Set<string>();
    for (const s of raw) {
      let entry: BlockedAttempt;
      try {
        entry = JSON.parse(s) as BlockedAttempt;
      } catch {
        continue; // skip malformed entries — never abort the whole removal
      }
      const hit =
        (!!ip && entry.ip?.trim().toLowerCase() === ip) ||
        (!!email && entry.email?.trim().toLowerCase() === email) ||
        (!!fingerprint && entry.fingerprint?.trim() === fingerprint);
      if (hit) toRemove.add(s);
    }

    let removed = 0;
    for (const s of toRemove) {
      removed += await trialRedis.lrem(K.RECENT_BLOCKS, 0, s);
    }
    return removed;
  },

  async size(): Promise<number> {
    return trialRedis.llen(K.RECENT_BLOCKS);
  },
};
