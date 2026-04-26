/**
 * trial-monitoring.ts — Super-admin trial registration monitoring
 *
 * Endpoints (all protected: authenticate + requireRole("super_admin")):
 *
 *   GET  /api/super/trial-monitoring
 *        Real-time dashboard data: status, counts, top IPs/FPs,
 *        suspicious companies, recent blocks.
 *
 *   POST /api/super/trial-monitoring/clear-warning
 *        Clear the active anomaly warning without affecting pause state.
 *
 *   POST /api/super/trial-monitoring/pause
 *        Body: { "minutes": 15, "reason": "..." }
 *        Manually pause trial registrations.
 *
 *   POST /api/super/trial-monitoring/resume
 *        Manually resume trial registrations (clears pause + warning).
 *
 * All state-changing actions are written to audit_logs.
 */

import { Router } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { authenticate, requireRole } from "../middleware/auth";
import { wrap } from "../lib/async-handler";
import { anomalyDetector } from "../lib/trial-anomaly";
import { recentBlocksStore } from "../lib/trial-recent-blocks";
import { writeAuditLog } from "../lib/audit-log";
import { db, companiesTable } from "@workspace/db";

const router  = Router();
const superOnly = [authenticate, requireRole("super_admin")] as const;

/* ── Wire anomaly callbacks for audit logging (runs once at import time) ──── */
anomalyDetector.onWarning = (count: number) => {
  void writeAuditLog({
    action:      "TRIAL_MONITORING_WARNING",
    record_type: "trial_monitoring",
    record_id:   0,
    old_value:   { status: "normal" },
    new_value:   { status: "warning", count },
    note:        `High trial registration rate: ${count} in window`,
  });
};

anomalyDetector.onAutoPause = (count: number) => {
  void writeAuditLog({
    action:      "TRIAL_REGISTRATION_AUTO_PAUSED",
    record_type: "trial_monitoring",
    record_id:   0,
    old_value:   { status: "warning" },
    new_value:   { status: "paused", count, auto: true },
    note:        `Auto-paused: ${count} registrations in window exceeded trip threshold`,
  });
};

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/super/trial-monitoring
   ══════════════════════════════════════════════════════════════════════════ */
router.get(
  "/super/trial-monitoring",
  ...superOnly,
  wrap(async (_req, res) => {
    /* All anomaly calls are now async (Redis). Run independent ones in parallel. */
    const [
      status,
      inWindow,
      pauseUntil,
      pauseRemain,
      topIPs,
      topFPs,
      warningFiredAt,
      pauseReason,
      wasManualPause,
      recentBlocks,
    ] = await Promise.all([
      anomalyDetector.status(),
      anomalyDetector.countGlobal(),
      anomalyDetector.pausedUntilDate(),
      anomalyDetector.pauseRemainingSeconds(),
      anomalyDetector.topIPs(10),
      anomalyDetector.topFingerprints(10),
      anomalyDetector.warningFiredAtDate(),
      anomalyDetector.pauseReason(),
      anomalyDetector.wasManualPause(),
      recentBlocksStore.recent(20),
    ]);

    /* Suspicious companies — trial_score < 50 or is_suspicious flag */
    const suspiciousCompanies = await db
      .select({
        id:                  companiesTable.id,
        name:                companiesTable.name,
        email:               companiesTable.admin_email,
        trial_score:         companiesTable.trial_score,
        is_suspicious:       companiesTable.is_suspicious,
        verification_status: companiesTable.verification_status,
      })
      .from(companiesTable)
      .where(eq(companiesTable.is_suspicious, true))
      .orderBy(desc(companiesTable.trial_score))
      .limit(20);

    res.json({
      status,
      registrations_in_window:  inWindow,
      alert_threshold:          anomalyDetector.alertThreshold(),
      block_threshold:          anomalyDetector.blockThreshold(),
      pause_until:              pauseUntil?.toISOString() ?? null,
      pause_remaining_seconds:  pauseRemain,
      warning_fired_at:         warningFiredAt?.toISOString() ?? null,
      pause_reason:             pauseReason,
      was_manual_pause:         wasManualPause,
      top_ips:          topIPs.map(e => ({ ip:          e.key, count: e.count })),
      top_fingerprints: topFPs.map(e => ({ fingerprint: e.key, count: e.count })),
      suspicious_companies: suspiciousCompanies,
      recent_blocks:        recentBlocks,
    });
  }),
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/super/trial-monitoring/clear-warning
   ══════════════════════════════════════════════════════════════════════════ */
router.post(
  "/super/trial-monitoring/clear-warning",
  ...superOnly,
  wrap(async (req, res) => {
    const actor      = req.user;
    const prevStatus = await anomalyDetector.status();

    await anomalyDetector.clearWarning();

    const newStatus = await anomalyDetector.status();

    void writeAuditLog({
      action:      "TRIAL_MONITORING_WARNING_CLEARED",
      record_type: "trial_monitoring",
      record_id:   actor?.id ?? 0,
      old_value:   { status: prevStatus },
      new_value:   { status: newStatus },
      user:        { id: actor?.id, username: actor?.username },
      note:        "Super admin cleared trial registration warning",
    });

    res.json({ ok: true, status: newStatus });
  }),
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/super/trial-monitoring/pause
   Body: { minutes: number, reason?: string }
   ══════════════════════════════════════════════════════════════════════════ */
const PauseSchema = z.object({
  minutes: z.number().int().min(1).max(1440),
  reason:  z.string().max(255).optional().default("manual security pause"),
});

router.post(
  "/super/trial-monitoring/pause",
  ...superOnly,
  wrap(async (req, res) => {
    const parsed = PauseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
      return;
    }

    const { minutes, reason } = parsed.data;
    const actor      = req.user;
    const prevStatus = await anomalyDetector.status();

    await anomalyDetector.manualPause(minutes, reason);

    const [newStatus, pauseUntil] = await Promise.all([
      anomalyDetector.status(),
      anomalyDetector.pausedUntilDate(),
    ]);

    void writeAuditLog({
      action:      "TRIAL_REGISTRATION_MANUAL_PAUSED",
      record_type: "trial_monitoring",
      record_id:   actor?.id ?? 0,
      old_value:   { status: prevStatus },
      new_value:   { status: "paused", minutes, reason, manual: true },
      user:        { id: actor?.id, username: actor?.username },
      note:        `Super admin manually paused trial registrations for ${minutes} min: ${reason}`,
    });

    res.json({
      ok:            true,
      status:        newStatus,
      pause_until:   pauseUntil?.toISOString(),
      pause_minutes: minutes,
      reason,
    });
  }),
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/super/trial-monitoring/resume
   ══════════════════════════════════════════════════════════════════════════ */
router.post(
  "/super/trial-monitoring/resume",
  ...superOnly,
  wrap(async (req, res) => {
    const actor      = req.user;
    const prevStatus = await anomalyDetector.status();

    await anomalyDetector.manualResume();
    await anomalyDetector.clearWarning(); // also clear warning on resume

    const newStatus = await anomalyDetector.status();

    void writeAuditLog({
      action:      "TRIAL_REGISTRATION_RESUMED",
      record_type: "trial_monitoring",
      record_id:   actor?.id ?? 0,
      old_value:   { status: prevStatus },
      new_value:   { status: newStatus },
      user:        { id: actor?.id, username: actor?.username },
      note:        "Super admin manually resumed trial registrations",
    });

    res.json({ ok: true, status: newStatus });
  }),
);

export default router;
