/**
 * Payroll router — mounts salary, periods, and processing sub-routers.
 * Feature guard for HR is applied here so every sub-router inherits it.
 */
import { Router, type IRouter } from "express";
import { requireFeature } from "../../middleware/feature-guard";
import salaryRouter     from "./salary";
import periodsRouter    from "./periods";
import processingRouter from "./processing";

const router: IRouter = Router();

router.use(
  ["/payroll", "/salary-structures", "/salary-history", "/statutory-contributions", "/tax-brackets"],
  requireFeature("hr"),
);

router.use(salaryRouter);
router.use(periodsRouter);
router.use(processingRouter);

export default router;
