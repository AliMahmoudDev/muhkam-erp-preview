/**
 * debug.ts — Super-admin-only diagnostic endpoints
 *
 * GET /api/super/trial-check?email=...&ip=...&ua=...&fp=...
 *   Returns the full trial eligibility decision plus cooldown, anomaly,
 *   and rate-limit state for the given email + IP + device.
 *   Read-only — no state is modified.
 *
 * Access: super_admin only (authenticate + requireRole guard)
 */

import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { wrap } from "../lib/async-handler";
import {
  checkTrialEligibility,
  isPrivateOrLoopbackIP,
  extractClientIP,
  MAX_TRIALS_PUBLIC_IP,
  MAX_TRIALS_PRIVATE_IP,
  MAX_TRIALS_UA_IP,
} from "../lib/trial-guard";
import { computeDeviceFingerprint } from "../lib/trial-fingerprint";
import { cooldownStore } from "../lib/trial-cooldown";
import { anomalyDetector } from "../lib/trial-anomaly";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")] as const;

/**
 * GET /api/super/trial-check
 *
 * Query params (all optional except email):
 *   email  (required) — email address to check
 *   ip     (optional) — override IP (defaults to caller's IP)
 *   ua     (optional) — override User-Agent
 *   fp     (optional) — override fingerprint (hex string)
 *
 * Returns:
 *   - input          : resolved email / IP / UA / fingerprint used
 *   - ip_metadata    : is_private, limit_applied
 *   - limits         : current configured thresholds
 *   - cooldown       : IP and fingerprint cooldown state
 *   - anomaly        : global + per-key window counts, pause state
 *   - decision       : full TrialCheckResult (all 7 checks)
 *   - check_error    : error message if DB was unreachable
 */
router.get(
  "/super/trial-check",
  ...superOnly,
  wrap(async (req, res) => {
    const email      = (req.query["email"] as string | undefined)?.trim();
    const ipOverride = (req.query["ip"]    as string | undefined)?.trim();
    const uaOverride = (req.query["ua"]    as string | undefined)?.trim();
    const fpOverride = (req.query["fp"]    as string | undefined)?.trim();

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "email query param is required and must contain @" });
      return;
    }

    const ip          = ipOverride ?? extractClientIP(req);
    const userAgent   = uaOverride ?? (req.headers["user-agent"] as string | undefined);
    const fingerprint = fpOverride ?? computeDeviceFingerprint(req);

    /* ── Cooldown state (async — Redis) ──────────────────────────────────── */
    const [ipCooldown, fpCooldown] = await Promise.all([
      cooldownStore.check(ip),
      cooldownStore.check(`fp:${fingerprint}`),
    ]);

    /* ── Anomaly state (async — Redis) ───────────────────────────────────── */
    const [globalCount, ipAnomalyCount, fpAnomalyCount, paused, pausedUntil] =
      await Promise.all([
        anomalyDetector.countGlobal(),
        anomalyDetector.countKey(ip),
        anomalyDetector.countKey(`fp:${fingerprint}`),
        anomalyDetector.isPaused(),
        anomalyDetector.pausedUntilDate(),
      ]);

    /* ── Run full trial check ────────────────────────────────────────────── */
    let decision = null;
    let check_error: string | null = null;

    try {
      decision = await checkTrialEligibility(email, ip, userAgent, fingerprint);
    } catch (err) {
      check_error = err instanceof Error ? err.message : String(err);
    }

    res.json({
      input: {
        email:       email.toLowerCase().trim(),
        ip,
        user_agent:  userAgent ?? null,
        fingerprint: `${fingerprint.slice(0, 8)}…${fingerprint.slice(-4)}`,
      },
      ip_metadata: {
        is_private:    isPrivateOrLoopbackIP(ip),
        limit_applied: isPrivateOrLoopbackIP(ip) ? MAX_TRIALS_PRIVATE_IP : MAX_TRIALS_PUBLIC_IP,
      },
      limits: {
        MAX_TRIALS_PUBLIC_IP,
        MAX_TRIALS_PRIVATE_IP,
        MAX_TRIALS_UA_IP,
        FINGERPRINT_LIMIT: MAX_TRIALS_UA_IP,
      },
      cooldown: {
        ip: {
          blocked: ipCooldown.blocked,
          until:   ipCooldown.until ?? null,
          level:   ipCooldown.level ?? null,
          reason:  ipCooldown.reason ?? null,
        },
        fingerprint: {
          blocked: fpCooldown.blocked,
          until:   fpCooldown.until ?? null,
          level:   fpCooldown.level ?? null,
          reason:  fpCooldown.reason ?? null,
        },
        store_size: cooldownStore.size(),
      },
      anomaly: {
        registrations_paused: paused,
        paused_until:         pausedUntil,
        global_count_5min:    globalCount,
        ip_count_5min:        ipAnomalyCount,
        fp_count_5min:        fpAnomalyCount,
      },
      decision,
      check_error,
      note: check_error
        ? "DB or Redis error — registration would be BLOCKED (fail-closed)"
        : undefined,
    });
  }),
);

export default router;
