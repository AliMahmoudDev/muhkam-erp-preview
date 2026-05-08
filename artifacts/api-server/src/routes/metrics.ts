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
  getPrometheusSnapshot,
} from "../lib/request-counter";
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

/* ── GET /api/metrics/prometheus — Prometheus text format ──────────── */
router.get(
  "/metrics/prometheus",
  authenticate,
  requireRole("super_admin"),
  (_req, res) => {
    const snap = getPrometheusSnapshot();

    const lines: string[] = [
      "# HELP request_count_total Total number of HTTP requests received",
      "# TYPE request_count_total counter",
      `request_count_total ${snap.total_requests}`,
      "",
      "# HELP response_time_ms Response time in milliseconds (summary)",
      "# TYPE response_time_ms summary",
      `response_time_ms{quantile="0.5"}  ${snap.latency.p50}`,
      `response_time_ms{quantile="0.95"} ${snap.latency.p95}`,
      `response_time_ms{quantile="0.99"} ${snap.latency.p99}`,
      `response_time_ms_sum   ${snap.latency.sum}`,
      `response_time_ms_count ${snap.latency.count}`,
      "",
      "# HELP error_count_total Total number of HTTP errors (status >= 400)",
      "# TYPE error_count_total counter",
      `error_count_total ${snap.error_count}`,
      "",
      "# HELP active_connections Current number of active HTTP connections",
      "# TYPE active_connections gauge",
      `active_connections ${snap.active_connections}`,
      "",
      "# HELP memory_usage_bytes Current heap memory usage in bytes",
      "# TYPE memory_usage_bytes gauge",
      `memory_usage_bytes ${snap.memory_bytes}`,
      "",
      "# HELP uptime_seconds Server uptime in seconds",
      "# TYPE uptime_seconds counter",
      `uptime_seconds ${snap.uptime_seconds}`,
      "",
    ];

    res
      .status(200)
      .setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(lines.join("\n"));
  },
);

export default router;
