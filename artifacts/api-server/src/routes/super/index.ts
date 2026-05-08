/**
 * /api/super/* — Super-admin panel for managing all SaaS companies.
 * Only accessible to users with role = "super_admin".
 *
 * Sub-routers:
 *   companies  — company CRUD, stats, snapshots, email verification
 *   managers   — super_admin user management
 *   billing    — plan settings, revenue, trial-abuse analytics
 *   settings   — backups, Telegram bot, support contacts
 *   monitoring — health, audit log, alerts, announcements, CSV export
 */
import { Router } from "express";
import companiesRouter from "./companies";
import managersRouter  from "./managers";
import billingRouter   from "./billing";
import settingsRouter  from "./settings";
import monitoringRouter from "./monitoring";

const router = Router();

router.use(companiesRouter);
router.use(managersRouter);
router.use(billingRouter);
router.use(settingsRouter);
router.use(monitoringRouter);

export default router;
