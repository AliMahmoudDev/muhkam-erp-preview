import { Router, type IRouter } from "express";
import { checkHealth, checkDeepHealth } from "../lib/monitor";

const router: IRouter = Router();

/* ── GET /healthz — quick health check ─────────────────────── */
router.get("/healthz", async (_req, res) => {
  try {
    const health = await checkHealth();
    const code   = health.status === "unhealthy" ? 503 : 200;
    res.status(code).json(health);
  } catch {
    res.status(503).json({
      status:     "unhealthy",
      error:      "Health check failed",
      last_check: new Date().toISOString(),
    });
  }
});

/* ── GET /healthz/deep — full read/write DB round-trip check ─ */
router.get("/healthz/deep", async (_req, res) => {
  try {
    const health = await checkDeepHealth();
    const code   = health.status === "unhealthy" ? 503 : 200;
    res.status(code).json(health);
  } catch {
    res.status(503).json({
      status:     "unhealthy",
      error:      "Deep health check failed",
      last_check: new Date().toISOString(),
    });
  }
});

export default router;
