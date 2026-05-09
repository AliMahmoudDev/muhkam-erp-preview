/**
 * metrics.ts — Operational metrics endpoints.
 *
 *   GET /api/metrics              — JSON snapshot (super_admin | admin)
 *   GET /api/metrics/prometheus   — Prometheus text exposition (super_admin only)
 *
 * All computation is in-memory; no new DB tables are introduced.
 */
import { Router, type IRouter } from "express";
import { requireRole, authenticate } from "../middleware/auth";
import {
  getMetrics,
  getRequestsPerMinute,
  getErrorRate,
  getSlowestEndpoints,
  getActiveConnections,
} from "../lib/request-counter";
import { registry, updateLiveGauges } from "../lib/prom-metrics";
import { getQueueStats } from "../lib/job-queue";
import { checkHealth } from "../lib/monitor";

const router: IRouter = Router();

/* ── GET /api/metrics — JSON dashboard payload ─────────────────────── */
router.get(
  "/metrics",
  authenticate,
  requireRole("super_admin", "admin"),
  async (_req, res) => {
    const [metrics, queueStats, health] = await Promise.all([
      Promise.resolve(getMetrics()),
      Promise.resolve(getQueueStats()),
      checkHealth(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      health,
      requests: {
        ...metrics,
        requests_per_minute:   getRequestsPerMinute(),
        error_rate_percentage: getErrorRate(),
        slowest_endpoints:     getSlowestEndpoints(5),
      },
      jobs: queueStats,
      system: {
        memory_usage_mb:    metrics.memory_mb,
        uptime_hours:       health.uptime_hours,
        active_connections: getActiveConnections(),
      },
    });
  },
);

/* ── GET /api/metrics/prometheus — Prometheus text format (prom-client) ── */
router.get(
  "/metrics/prometheus",
  authenticate,
  requireRole("super_admin"),
  async (_req, res) => {
    updateLiveGauges();
    const metricsText = await registry.metrics();
    res
      .status(200)
      .setHeader("Content-Type", registry.contentType)
      .send(metricsText);
  },
);

export default router;
