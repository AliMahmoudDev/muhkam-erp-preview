/**
 * trial-recent-blocks.ts
 *
 * Lightweight in-memory ring buffer that records the last N blocked
 * trial-registration attempts.  Populated by trial-guard.ts and consumed
 * by the trial-monitoring endpoint.
 *
 * Data is ephemeral (lost on restart) which is intentional — the goal is
 * real-time visibility, not permanent forensics (that is handled by
 * trial_abuse_log + audit_logs in the DB).
 */

export interface BlockedAttempt {
  email:      string;
  ip:         string;
  reason:     string;   // blocked_by value
  created_at: string;   // ISO timestamp
}

const MAX_ENTRIES = 100;

class RecentBlocksStore {
  private buffer: BlockedAttempt[] = [];

  record(entry: BlockedAttempt): void {
    this.buffer.unshift(entry);           // prepend (newest first)
    if (this.buffer.length > MAX_ENTRIES) {
      this.buffer.length = MAX_ENTRIES;   // trim tail
    }
  }

  /** Return the most recent N entries (default 20). */
  recent(n = 20): BlockedAttempt[] {
    return this.buffer.slice(0, n);
  }

  size(): number { return this.buffer.length; }
}

export const recentBlocksStore = new RecentBlocksStore();
