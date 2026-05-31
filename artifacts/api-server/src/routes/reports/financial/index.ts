/**
 * reports/financial/index.ts
 * Aggregates all financial report sub-routers.
 * Routes: cash-flow, health-check, balance-sheet, trial-balance, cash-flow-indirect
 * All routes require can_view_accounts permission (checked per-handler).
 */
import { Router, type IRouter } from "express";

import cashFlowRouter         from "./cash-flow";
import healthCheckRouter      from "./health-check";
import balanceSheetRouter     from "./balance-sheet";
import trialBalanceRouter     from "./trial-balance";
import cashFlowIndirectRouter from "./cash-flow-indirect";

const router: IRouter = Router();

router.use(cashFlowRouter);
router.use(healthCheckRouter);
router.use(balanceSheetRouter);
router.use(trialBalanceRouter);
router.use(cashFlowIndirectRouter);

export default router;
