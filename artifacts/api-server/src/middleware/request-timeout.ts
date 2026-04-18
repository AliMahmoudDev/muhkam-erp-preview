/**
 * request-timeout.ts
 *
 * Middleware that aborts requests exceeding 30 seconds.
 * Protects against slow-loris attacks and runaway DB queries.
 */

import type { Request, Response, NextFunction } from "express";

const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? "30000", 10);

export function requestTimeout(_req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) { next(); return; }

  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: "انتهت مهلة الطلب، حاول مجدداً" });
    }
  }, TIMEOUT_MS);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));

  next();
}
