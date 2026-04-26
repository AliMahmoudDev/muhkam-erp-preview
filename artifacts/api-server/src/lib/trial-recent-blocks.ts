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

import { trialRedis, K } from "./redis";

const MAX_ENTRIES = 100;

export interface BlockedAttempt {
  email:       string;
  ip:          string;
  fingerprint?: string;
  reason:      string;
  created_at:  string;  // ISO timestamp
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
    return raw.map(s => JSON.parse(s) as BlockedAttempt);
  },

  async size(): Promise<number> {
    return trialRedis.llen(K.RECENT_BLOCKS);
  },
};
