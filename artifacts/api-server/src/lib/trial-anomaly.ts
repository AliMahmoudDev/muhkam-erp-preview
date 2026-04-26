/**
 * trial-anomaly.ts
 *
 * Two-stage sliding-window anomaly detector for trial registration spikes.
 *
 * Stage 1 — WARNING  (>= ANOMALY_ALERT_COUNT registrations in window)
 *   • status  = "warning"
 *   • registrations still ALLOWED — only the super admin is notified
 *   • warningActive flag set; onWarning callback fires once per period
 *
 * Stage 2 — PAUSED   (>= ANOMALY_TRIP_COUNT in window, OR manual pause)
 *   • status  = "paused"
 *   • all new trial registrations rejected (503 TRIAL_REGISTRATION_PAUSED)
 *   • auto-expires after ANOMALY_PAUSE_MS; also manually resumable
 *
 * Manual controls: manualPause() / manualResume() / clearWarning()
 * Per-key tracking: separate IP vs FP prefix for top-N dashboard reporting.
 */

import { logger } from "./logger";

/* ── Config ─────────────────────────────────────────────────────────────── */
const WINDOW_MS          = Number(process.env.ANOMALY_WINDOW_MS  ?? String(5 * 60_000));   // 5 min
const GLOBAL_ALERT_COUNT = Number(process.env.ANOMALY_ALERT_COUNT ?? "20");                // Stage 1
const GLOBAL_TRIP_COUNT  = Number(process.env.ANOMALY_TRIP_COUNT  ?? "50");                // Stage 2
const PAUSE_MS           = Number(process.env.ANOMALY_PAUSE_MS    ?? String(15 * 60_000)); // 15 min
const PER_KEY_ALERT      = Number(process.env.ANOMALY_PER_KEY     ?? "5");

export type AnomalyStatus = "normal" | "warning" | "paused";
export interface TopEntry   { key: string; count: number }

interface PauseInfo {
  until:  number;
  reason: string;
  manual: boolean;
}

class AnomalyDetector {
  private globalTs:       number[]              = [];
  private perKey:         Map<string, number[]> = new Map();
  private pause:          PauseInfo | null      = null;
  private warningActive:  boolean               = false;
  private warningFiredAt: number                = 0;

  /**
   * Optional callbacks — set by the monitoring route to write audit logs
   * without creating a circular import.
   */
  onWarning?:   (count: number) => void;
  onAutoPause?: (count: number) => void;

  /* ── Private helpers ──────────────────────────────────────────────────── */
  private evict(arr: number[], now: number): number[] {
    const cutoff = now - WINDOW_MS;
    return arr.filter(t => t > cutoff);
  }

  private clearExpiredPause(): void {
    if (this.pause && Date.now() >= this.pause.until) {
      logger.info(
        { until: new Date(this.pause.until).toISOString(), manual: this.pause.manual },
        "[Anomaly] Pause expired — registrations resumed automatically",
      );
      this.pause = null;
    }
  }

  /* ── Core record ──────────────────────────────────────────────────────── */
  /**
   * Record a registration attempt.
   * Call BEFORE eligibility checks so blocked attempts still count.
   */
  record(key: string): void {
    const now = Date.now();

    /* Global window */
    this.globalTs = this.evict(this.globalTs, now);
    this.globalTs.push(now);
    const gc = this.globalTs.length;

    /* Stage 2 — auto-pause (trip threshold) */
    if (gc >= GLOBAL_TRIP_COUNT && !this.isPaused()) {
      this.pause = { until: now + PAUSE_MS, reason: "auto: global registration spike", manual: false };
      logger.error(
        { count: gc, threshold: GLOBAL_TRIP_COUNT, until: new Date(this.pause.until).toISOString() },
        "[Anomaly] REGISTRATION PAUSED — global spike tripped",
      );
      this.onAutoPause?.(gc);
    }

    /* Stage 1 — warning (alert threshold, fires once per period, not when already paused) */
    if (gc >= GLOBAL_ALERT_COUNT && !this.warningActive && !this.isPaused()) {
      this.warningActive  = true;
      this.warningFiredAt = now;
      logger.warn(
        { count: gc, alertAt: GLOBAL_ALERT_COUNT, tripAt: GLOBAL_TRIP_COUNT },
        "[Anomaly] WARNING — high trial registration rate detected",
      );
      this.onWarning?.(gc);
    }

    /* Per-key window */
    const prev = this.evict(this.perKey.get(key) ?? [], now);
    prev.push(now);
    this.perKey.set(key, prev);
    if (prev.length >= PER_KEY_ALERT) {
      logger.warn({ key, count: prev.length }, "[Anomaly] Per-key registration spike");
    }
  }

  /* ── Status ───────────────────────────────────────────────────────────── */
  status(): AnomalyStatus {
    this.clearExpiredPause();
    if (this.pause)         return "paused";
    if (this.warningActive) return "warning";
    return "normal";
  }

  isPaused(): boolean {
    this.clearExpiredPause();
    return !!this.pause;
  }

  pausedUntilDate():       Date | null { return this.pause ? new Date(this.pause.until) : null; }
  pauseRemainingSeconds(): number {
    this.clearExpiredPause();
    if (!this.pause) return 0;
    return Math.max(0, Math.ceil((this.pause.until - Date.now()) / 1000));
  }
  pauseReason():  string | null { return this.pause?.reason  ?? null; }
  wasManualPause(): boolean     { return this.pause?.manual  ?? false; }
  isWarning(): boolean          { return this.warningActive; }
  warningFiredAtDate(): Date | null {
    return this.warningActive ? new Date(this.warningFiredAt) : null;
  }

  /* ── Manual controls ──────────────────────────────────────────────────── */
  manualPause(minutes: number, reason: string): void {
    const until = Date.now() + minutes * 60_000;
    this.pause  = { until, reason, manual: true };
    logger.warn({ minutes, reason, until: new Date(until).toISOString() }, "[Anomaly] MANUAL PAUSE applied");
  }

  manualResume(): void {
    const prev = this.pause;
    this.pause = null;
    logger.info({ prev }, "[Anomaly] MANUAL RESUME — registrations reopened");
  }

  clearWarning(): void {
    this.warningActive  = false;
    this.warningFiredAt = 0;
    logger.info("[Anomaly] Warning cleared by super admin");
  }

  /* ── Counters ─────────────────────────────────────────────────────────── */
  countGlobal(): number {
    const now = Date.now();
    this.globalTs = this.evict(this.globalTs, now);
    return this.globalTs.length;
  }

  countKey(key: string): number {
    const now = Date.now();
    const arr  = this.evict(this.perKey.get(key) ?? [], now);
    this.perKey.set(key, arr);
    return arr.length;
  }

  alertThreshold(): number { return GLOBAL_ALERT_COUNT; }
  blockThreshold(): number { return GLOBAL_TRIP_COUNT;  }
  windowMs():       number { return WINDOW_MS;           }

  /* ── Top-N reporting ──────────────────────────────────────────────────── */
  /** Top IPs by window count (keys that are NOT prefixed "fp:"). */
  topIPs(n = 10): TopEntry[] {
    return this._topEntries(k => !k.startsWith("fp:"), n);
  }

  /** Top device fingerprints (keys prefixed "fp:"), strip prefix for display. */
  topFingerprints(n = 10): TopEntry[] {
    return this._topEntries(k => k.startsWith("fp:"), n)
      .map(e => ({ key: e.key.slice(3), count: e.count }));
  }

  private _topEntries(match: (k: string) => boolean, n: number): TopEntry[] {
    const now = Date.now();
    const out: TopEntry[] = [];
    for (const [key, arr] of this.perKey) {
      if (!match(key)) continue;
      const trimmed = this.evict(arr, now);
      this.perKey.set(key, trimmed);
      if (trimmed.length > 0) out.push({ key, count: trimmed.length });
    }
    return out.sort((a, b) => b.count - a.count).slice(0, n);
  }

  /* ── Maintenance ──────────────────────────────────────────────────────── */
  prune(): void {
    const now = Date.now();
    for (const [k, arr] of this.perKey) {
      const trimmed = arr.filter(t => t > now - WINDOW_MS);
      if (trimmed.length === 0) this.perKey.delete(k);
      else this.perKey.set(k, trimmed);
    }
    /* Auto-clear warning when rate drops below alert threshold */
    const count = this.countGlobal();
    if (this.warningActive && count < GLOBAL_ALERT_COUNT && !this.isPaused()) {
      this.warningActive = false;
      logger.info({ count }, "[Anomaly] Warning auto-cleared — rate normalised");
    }
  }

  size(): number { return this.perKey.size; }
}

export const anomalyDetector = new AnomalyDetector();

setInterval(() => anomalyDetector.prune(), 5 * 60_000);
