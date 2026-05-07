/**
 * reports/inventory-reports.ts
 * Stock and movement reports.
 *
 * Inventory-specific report endpoints will be added here as the module grows.
 * Inventory health checks are currently embedded in /api/reports/health-check
 * (financial.ts) as part of the system-wide health snapshot.
 */
import { Router, type IRouter } from "express";

const router: IRouter = Router();

export default router;
