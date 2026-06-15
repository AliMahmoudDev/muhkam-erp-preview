/**
 * trial-anomaly.ts — Redis-backed two-stage sliding-window anomaly detector.
 *
 * Stage 1 — WARNING  (>= ANOMALY_ALERT_COUNT registrations in window)
 *   • status  = "warning"
 *   • registrations still ALLOWED — super-admin notified via onWarning callback
 *
 * Stage 2 — PAUSED   (>= ANOMALY_TRIP_COUNT in window, OR manual pause)
 *   • status  = "paused"
 *   • all new trial registrations rejected with 503 TRIAL_REGISTRATION_PAUSED
 *   • auto-expires after ANOMALY_PAUSE_MS; also manually resumable
 *
 * Storage: Redis — persists across restarts; shared across instances.
 *
 *   trial:global_events     sorted set  global sliding window (score=ms, member=uuid)
 *   trial:ip:{ip}           sorted set  per-IP window
 *   trial:fp:{fp}           sorted set  per-FP window
 *   trial:active_ips        set         known active IP strings (for top-N scan)
 *   trial:active_fps        set         known active FP strings
 *   trial:pause             string      JSON { until, reason, manual }  (EX TTL)
 *   trial:warning           string      JSON { firedAt }                (EX TTL)
 *
 * Fail-closed: Redis errors propagate to the caller (→ 503).
 */

import crypto from 'crypto';
import { trialRedis, K } from './redis';
import { logger } from './logger';

/* ── Config ─────────────────────────────────────────────────────────────── */
const WINDOW_MS = Number(process.env.ANOMALY_WINDOW_MS ?? String(5 * 60_000));
const WINDOW_SEC = Math.ceil(WINDOW_MS / 1000);
const GLOBAL_ALERT_COUNT = Number(process.env.ANOMALY_ALERT_COUNT ?? '20');
const GLOBAL_TRIP_COUNT = Number(process.env.ANOMALY_TRIP_COUNT ?? '50');
const PAUSE_MS = Number(process.env.ANOMALY_PAUSE_MS ?? String(15 * 60_000));
const PAUSE_SEC = Math.ceil(PAUSE_MS / 1000);
const PER_KEY_ALERT = Number(process.env.ANOMALY_PER_KEY ?? '5');

export type AnomalyStatus = 'normal' | 'warning' | 'paused';
export interface TopEntry {
  key: string;
  count: number;
}

interface PauseState {
  until: number;
  reason: string;
  manual: boolean;
}
interface WarningState {
  firedAt: number;
}

class AnomalyDetector {
  /** Set by trial-monitoring.ts to write audit logs without circular imports. */
  onWarning?: (count: number) => void;
  onAutoPause?: (count: number) => void;

  /* ── Core record ──────────────────────────────────────────────────────── */
  /**
   * Record a registration attempt in both the global and per-key sliding windows.
   * Checks thresholds and triggers warning / auto-pause as needed.
   * Fire-and-forget from trial-guard (errors are swallowed there).
   */
  async record(key: string): Promise<void> {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const uuid = crypto.randomUUID();
    const isIP = !key.startsWith('fp:');
    const rawKey = isIP ? key : key.slice(3); // strip "fp:" prefix

    /* ── Pipeline: add to global + per-key sorted sets, cleanup old entries ── */
    const pipe = trialRedis.pipeline();

    /* Global events */
    pipe.zadd(K.GLOBAL_EVENTS, now, uuid);
    pipe.zremrangebyscore(K.GLOBAL_EVENTS, 0, cutoff);
    pipe.expire(K.GLOBAL_EVENTS, WINDOW_SEC * 3);

    /* Per-key events + active keys set */
    const keyName = isIP ? K.IP_EVENTS(rawKey) : K.FP_EVENTS(rawKey);
    pipe.zadd(keyName, now, uuid);
    pipe.zremrangebyscore(keyName, 0, cutoff);
    pipe.expire(keyName, WINDOW_SEC * 3);

    if (isIP) {
      pipe.sadd(K.ACTIVE_IPS, rawKey);
      pipe.expire(K.ACTIVE_IPS, WINDOW_SEC * 3);
    } else {
      pipe.sadd(K.ACTIVE_FPS, rawKey);
      pipe.expire(K.ACTIVE_FPS, WINDOW_SEC * 3);
    }

    await pipe.exec();

    /* ── Count global events in current window ──────────────────────────── */
    const gc = await trialRedis.zcount(K.GLOBAL_EVENTS, cutoff, '+inf');

    /* Stage 2: auto-pause (trip threshold) */
    if (gc >= GLOBAL_TRIP_COUNT && !(await this.isPaused())) {
      const until = now + PAUSE_MS;
      const state: PauseState = { until, reason: 'auto: global registration spike', manual: false };
      await trialRedis.set(K.PAUSE, JSON.stringify(state), 'EX', PAUSE_SEC);
      logger.error(
        { count: gc, threshold: GLOBAL_TRIP_COUNT, until: new Date(until).toISOString() },
        '[Anomaly] REGISTRATION PAUSED — global spike tripped'
      );
      this.onAutoPause?.(gc);
      return; // no need to check warning if we just paused
    }

    /* Stage 1: warning (alert threshold — only when not paused, only once per period) */
    if (gc >= GLOBAL_ALERT_COUNT && !(await this.isWarning()) && !(await this.isPaused())) {
      const state: WarningState = { firedAt: now };
      /* TTL = window — warning auto-clears when the rate subsides */
      await trialRedis.set(K.WARNING, JSON.stringify(state), 'EX', WINDOW_SEC * 2);
      logger.warn(
        { count: gc, alertAt: GLOBAL_ALERT_COUNT, tripAt: GLOBAL_TRIP_COUNT },
        '[Anomaly] WARNING — high trial registration rate detected'
      );
      this.onWarning?.(gc);
    }

    /* Per-key alert (for monitoring only — does not block) */
    const perKeyCount = await trialRedis.zcount(keyName, cutoff, '+inf');
    if (perKeyCount >= PER_KEY_ALERT) {
      logger.warn({ key, count: perKeyCount }, '[Anomaly] Per-key registration spike');
    }
  }

  /* ── Pause state ──────────────────────────────────────────────────────── */
  async isPaused(): Promise<boolean> {
    const raw = await trialRedis.get(K.PAUSE);
    if (!raw) return false;
    const state = JSON.parse(raw) as PauseState;
    if (Date.now() >= state.until) {
      void trialRedis.del(K.PAUSE);
      logger.info('[Anomaly] Pause expired — registrations resumed');
      return false;
    }
    return true;
  }

  async pausedUntilDate(): Promise<Date | null> {
    const raw = await trialRedis.get(K.PAUSE);
    if (!raw) return null;
    const state = JSON.parse(raw) as PauseState;
    return Date.now() < state.until ? new Date(state.until) : null;
  }

  async pauseRemainingSeconds(): Promise<number> {
    const raw = await trialRedis.get(K.PAUSE);
    if (!raw) return 0;
    const state = JSON.parse(raw) as PauseState;
    return Math.max(0, Math.ceil((state.until - Date.now()) / 1000));
  }

  async pauseReason(): Promise<string | null> {
    const raw = await trialRedis.get(K.PAUSE);
    if (!raw) return null;
    return (JSON.parse(raw) as PauseState).reason;
  }

  async wasManualPause(): Promise<boolean> {
    const raw = await trialRedis.get(K.PAUSE);
    if (!raw) return false;
    return (JSON.parse(raw) as PauseState).manual;
  }

  /* ── Warning state ────────────────────────────────────────────────────── */
  async isWarning(): Promise<boolean> {
    return (await trialRedis.exists(K.WARNING)) > 0;
  }

  async warningFiredAtDate(): Promise<Date | null> {
    const raw = await trialRedis.get(K.WARNING);
    if (!raw) return null;
    return new Date((JSON.parse(raw) as WarningState).firedAt);
  }

  /* ── Combined status ──────────────────────────────────────────────────── */
  async status(): Promise<AnomalyStatus> {
    if (await this.isPaused()) return 'paused';
    if (await this.isWarning()) return 'warning';
    return 'normal';
  }

  /* ── Manual controls ──────────────────────────────────────────────────── */
  async manualPause(minutes: number, reason: string): Promise<void> {
    const until = Date.now() + minutes * 60_000;
    const state: PauseState = { until, reason, manual: true };
    const ttlSec = Math.ceil(minutes * 60);
    await trialRedis.set(K.PAUSE, JSON.stringify(state), 'EX', ttlSec);
    logger.warn(
      { minutes, reason, until: new Date(until).toISOString() },
      '[Anomaly] MANUAL PAUSE applied'
    );
  }

  async manualResume(): Promise<void> {
    await trialRedis.del(K.PAUSE);
    logger.info('[Anomaly] MANUAL RESUME — registrations reopened');
  }

  async clearWarning(): Promise<void> {
    await trialRedis.del(K.WARNING);
    logger.info('[Anomaly] Warning cleared');
  }

  /* ── Manual forget (super-admin unblock) ──────────────────────────────────
   * Drop an IP / fingerprint from the sliding-window monitoring so it
   * disappears from the top-N dashboard immediately. This affects DISPLAY and
   * per-key spike history ONLY — it never touches global pause/warning state
   * and never lifts an actual block (DB-based via trial_abuse_log, or the
   * Redis cooldown/rate keys cleared explicitly by the unblock endpoint).
   */
  async forgetIP(ip: string): Promise<void> {
    const raw = ip.startsWith('::ffff:') ? ip.slice(7) : ip.toLowerCase().trim();
    await trialRedis.srem(K.ACTIVE_IPS, raw);
    await trialRedis.del(K.IP_EVENTS(raw));
  }

  async forgetFingerprint(fp: string): Promise<void> {
    const raw = fp.trim();
    await trialRedis.srem(K.ACTIVE_FPS, raw);
    await trialRedis.del(K.FP_EVENTS(raw));
  }

  /* ── Counters ─────────────────────────────────────────────────────────── */
  async countGlobal(): Promise<number> {
    const cutoff = Date.now() - WINDOW_MS;
    return trialRedis.zcount(K.GLOBAL_EVENTS, cutoff, '+inf');
  }

  async countKey(key: string): Promise<number> {
    const cutoff = Date.now() - WINDOW_MS;
    const isIP = !key.startsWith('fp:');
    const rawKey = isIP ? key : key.slice(3);
    const keyName = isIP ? K.IP_EVENTS(rawKey) : K.FP_EVENTS(rawKey);
    return trialRedis.zcount(keyName, cutoff, '+inf');
  }

  /* ── Config accessors (no Redis — read from env at startup) ───────────── */
  alertThreshold(): number {
    return GLOBAL_ALERT_COUNT;
  }
  blockThreshold(): number {
    return GLOBAL_TRIP_COUNT;
  }
  windowMs(): number {
    return WINDOW_MS;
  }

  /* ── Top-N reporting ──────────────────────────────────────────────────── */
  /**
   * Top IPs by registration count in the current sliding window.
   * Scans the active_ips set (bounded to WINDOW_SEC * 3 TTL) and counts each.
   */
  async topIPs(n = 10): Promise<TopEntry[]> {
    const ips = await trialRedis.smembers(K.ACTIVE_IPS);
    return this._topEntries(ips, K.IP_EVENTS, n);
  }

  /**
   * Top device fingerprints by registration count in the current sliding window.
   */
  async topFingerprints(n = 10): Promise<TopEntry[]> {
    const fps = await trialRedis.smembers(K.ACTIVE_FPS);
    return this._topEntries(fps, K.FP_EVENTS, n);
  }

  private async _topEntries(
    keys: string[],
    keyFn: (k: string) => string,
    n: number
  ): Promise<TopEntry[]> {
    if (keys.length === 0) return [];
    const cutoff = Date.now() - WINDOW_MS;
    const counts = await Promise.all(
      keys.map(async (k) => ({
        key: k,
        count: await trialRedis.zcount(keyFn(k), cutoff, '+inf'),
      }))
    );
    return counts
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  /** Legacy compat — no-op with Redis (cleanup is via TTL). */
  async prune(): Promise<void> {
    /* noop — Redis TTLs handle expiry */
  }
  size(): number {
    return 0;
  }
}

export const anomalyDetector = new AnomalyDetector();
