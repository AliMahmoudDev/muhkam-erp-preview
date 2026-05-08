/**
 * Assembles all repair-jobs sub-routers.
 * Route registration ORDER matters for Express matching:
 *   1. reports (stats, alerts, technicians, technician-stats, reports/*)
 *      — must come BEFORE crud so /repair-jobs/stats etc. are matched first
 *   2. checklist (repair-statuses, repair-checklist-items, repair-device-models)
 *   3. crud (repair-jobs/:id, engineer-reports, repair-customers)
 */
import { Router, type IRouter } from "express";
import reportsRouter from "./reports";
import checklistRouter from "./checklist";
import crudRouter from "./crud";

const router: IRouter = Router();

router.use(reportsRouter);
router.use(checklistRouter);
router.use(crudRouter);

export default router;
