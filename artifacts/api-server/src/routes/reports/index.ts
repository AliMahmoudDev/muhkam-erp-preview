/**
 * reports/index.ts — main reports router
 *
 * Mounts all report sub-routers and enforces the top-level
 * can_view_reports permission gate for /reports/* paths.
 */
import { Router, type IRouter } from "express";
import { hasPermission } from "../../lib/permissions";
import salesReportsRouter    from "./sales-reports";
import customerReportsRouter from "./customer-reports";
import financialRouter       from "./financial";
import inventoryReportsRouter from "./inventory-reports";
import taxReportsRouter      from "./tax-reports";

const router: IRouter = Router();

// Scope the permission check to /reports/* paths only, otherwise this middleware
// runs for EVERY request passing through the parent router (since the parent
// mounts reportsRouter without a path prefix), incorrectly blocking unrelated
// endpoints for any role that lacks can_view_reports (e.g. self-service employee).
router.use((req, res, next) => {
  if (!req.path.startsWith("/reports")) { next(); return; }
  if (!hasPermission(req.user, "can_view_reports")) {
    res.status(403).json({ error: "غير مصرح بعرض التقارير" }); return;
  }
  next();
});

router.use(salesReportsRouter);
router.use(customerReportsRouter);
router.use(financialRouter);
router.use(inventoryReportsRouter);
router.use(taxReportsRouter);

export default router;
