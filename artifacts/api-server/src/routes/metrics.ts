/**
 * GET /api/metrics — Operational metrics for monitoring dashboards.
 * Access restricted to super_admin and admin roles.
 */
import { Router, type IRouter } from "express";
import { requireRole, authenticate } from "../middleware/auth";
import { getMetrics } from "../lib/request-counter";
import { getQueueStats } from "../lib/job-queue";
import { checkHealth } from "../lib/monitor";

const router: IRouter = Router();

router.get("/metrics",
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
      requests: metrics,
      jobs: queueStats,
    });
  }
);

export default router;
