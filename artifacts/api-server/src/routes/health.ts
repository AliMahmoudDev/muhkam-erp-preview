import { Router, type IRouter } from "express";
import { checkHealth, checkDeepHealth } from "../lib/monitor";
import { wrap } from "../lib/async-handler";
import { logger } from "../lib/logger";

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

/* ── POST /health/client-error — frontend error-boundary reporting ── */
router.post("/health/client-error", wrap(async (req, res) => {
  const { message, stack, componentStack, url, userAgent } = req.body as Record<string, unknown>;
  logger.error({
    source:    "client-error-boundary",
    message:   String(message ?? "").slice(0, 500),
    url:       String(url ?? ""),
    ua:        String(userAgent ?? "").slice(0, 200),
    stack:     String(stack ?? "").slice(0, 1000),
    compStack: String(componentStack ?? "").slice(0, 500),
  }, "[CLIENT-ERROR]");
  res.status(204).send();
}));

export default router;
