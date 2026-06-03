/**
 * /api/super/companies — Company management routes (barrel).
 * Creates, reads, updates, suspends, extends and deletes tenant companies.
 *
 * Sub-routers:
 *   crud   — list, get, create, update, delete
 *   status — activate, suspend, extend, verify-email
 *   admin  — reset-admin-password
 *   stats  — overall stats, company snapshot
 */
import { Router } from "express";
import crudRouter   from "./crud";
import statusRouter from "./status";
import adminRouter  from "./admin";
import statsRouter  from "./stats";

const router = Router();

router.use(statsRouter);
router.use(statusRouter);
router.use(adminRouter);
router.use(crudRouter);

export default router;
