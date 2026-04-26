/**
 * trial-anomaly.ts
 *
 * Sliding-window anomaly detector for registration spikes.
 *
 * Tracks two signals:
 *   1. GLOBAL rate — total registration attempts across all IPs.
 *      Alert threshold: GLOBAL_ALERT_COUNT attempts in WINDOW_MS.
 *      Trip threshold:  GLOBAL_TRIP_COUNT  attempts in WINDOW_MS
 *                       → auto-pauses all new registrations for PAUSE_MS.
 *
 *   2. PER-KEY rate — attempts from a single IP or fingerprint.
 *      Used to trigger auto-cooldown for aggressive actors.
 *
 * Implementation: pure in-memory sliding window (no DB, sub-ms latency).
 * Timestamps older than WINDOW_MS are evicted on read.
 *
 * Paused state: when global trip fires, `isPaused()` returns true and
 * the registration handler should reject all attempts with 503.
 * The pause auto-expires after PAUSE_MS without any manual intervention.
 */

import { logger } from "./logger";

const WINDOW_MS          = Number(process.env.ANOMALY_WINDOW_MS   ?? String(5 * 60 * 1000)); // 5 min
const GLOBAL_ALERT_COUNT = Number(process.env.ANOMALY_ALERT_COUNT  ?? "20");  // log WARN
const GLOBAL_TRIP_COUNT  = Number(process.env.ANOMALY_TRIP_COUNT   ?? "50");  // pause registrations
const PAUSE_MS           = Number(process.env.ANOMALY_PAUSE_MS     ?? String(15 * 60 * 1000)); // 15 min
const PER_KEY_ALERT      = Number(process.env.ANOMALY_PER_KEY      ?? "5");   // per-IP/fingerprint

class AnomalyDetector {
  private global:   number[]                = [];        // epoch ms timestamps
  private perKey:   Map<string, number[]>   = new Map(); // key → timestamps
  private pausedUntil: number               = 0;

  private evict(arr: number[], now: number): number[] {
    const cutoff = now - WINDOW_MS;
    return arr.filter(t => t > cutoff);
  }

  /**
   * Record a registration attempt (call BEFORE checks so spikes are detected
   * even for attempts that ultimately get blocked).
   */
  record(key: string): void {
    const now = Date.now();

    /* ── Global window ──────────────────────────────────────────── */
    this.global = this.evict(this.global, now);
    this.global.push(now);
    const globalCount = this.global.length;

    if (globalCount >= GLOBAL_TRIP_COUNT && !this.isPaused()) {
      this.pausedUntil = now + PAUSE_MS;
      logger.error(
        { globalCount, window_minutes: WINDOW_MS / 60_000, pausedUntilMs: this.pausedUntil },
        "[Anomaly] REGISTRATION PAUSED — global spike tripped",
      );
    } else if (globalCount >= GLOBAL_ALERT_COUNT) {
      logger.warn(
        { globalCount, window_minutes: WINDOW_MS / 60_000, threshold: GLOBAL_TRIP_COUNT },
        "[Anomaly] Global registration spike WARNING",
      );
    }

    /* ── Per-key window ─────────────────────────────────────────── */
    const prev  = this.perKey.get(key) ?? [];
    const evicted = this.evict(prev, now);
    evicted.push(now);
    this.perKey.set(key, evicted);
    const keyCount = evicted.length;

    if (keyCount >= PER_KEY_ALERT) {
      logger.warn(
        { key, keyCount, window_minutes: WINDOW_MS / 60_000 },
        "[Anomaly] Per-key registration spike WARNING",
      );
    }
  }

  /** Returns true when a global spike has temporarily paused registrations. */
  isPaused(): boolean {
    if (this.pausedUntil && Date.now() > this.pausedUntil) {
      this.pausedUntil = 0; // auto-expire
      logger.info("[Anomaly] Registration pause expired — resuming");
    }
    return Date.now() < this.pausedUntil;
  }

  /** Returns number of attempts in the current window for the given key. */
  countKey(key: string): number {
    const now = Date.now();
    const arr  = this.evict(this.perKey.get(key) ?? [], now);
    this.perKey.set(key, arr);
    return arr.length;
  }

  /** Returns total global attempts in current window. */
  countGlobal(): number {
    const now = Date.now();
    this.global = this.evict(this.global, now);
    return this.global.length;
  }

  pausedUntilDate(): Date | null {
    return this.isPaused() ? new Date(this.pausedUntil) : null;
  }

  /** Prune stale per-key windows (call periodically). */
  prune(): void {
    const now = Date.now();
    for (const [k, arr] of this.perKey) {
      const trimmed = arr.filter(t => t > now - WINDOW_MS);
      if (trimmed.length === 0) this.perKey.delete(k);
      else this.perKey.set(k, trimmed);
    }
  }
}

export const anomalyDetector = new AnomalyDetector();

setInterval(() => anomalyDetector.prune(), 5 * 60 * 1000);
