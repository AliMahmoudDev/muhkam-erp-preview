/**
 * @module routes/payroll
 * @description Payroll management router for MUHKAM ERP.
 *
 * Mounts three sub-routers that together cover the full HR/payroll lifecycle:
 *
 *   salary.ts (sub-router):
 *     GET    /salary-structures          List salary structures for the tenant
 *     POST   /salary-structures          Create a new salary structure (base + allowances + deductions)
 *     PUT    /salary-structures/:id      Update an existing salary structure
 *     DELETE /salary-structures/:id      Delete a salary structure (blocked if referenced by employees)
 *     GET    /salary-history             Paginated payroll run history
 *     GET    /statutory-contributions    Statutory deduction/contribution rates (GOSI, income tax)
 *     GET    /tax-brackets               Progressive tax brackets for payroll calculation
 *
 *   periods.ts (sub-router):
 *     GET    /payroll/periods            List payroll periods
 *     POST   /payroll/periods            Open a new payroll period
 *     PUT    /payroll/periods/:id        Update period dates or status
 *     POST   /payroll/periods/:id/close  Close a period (prevents further modifications)
 *
 *   processing.ts (sub-router):
 *     POST   /payroll/run               Execute payroll for a period — calculates net pay per
 *                                       employee based on salary structure, attendance deductions,
 *                                       advances, and statutory contributions.
 *     GET    /payroll/preview/:periodId  Preview payroll calculation before committing.
 *     POST   /payroll/post/:periodId     Post payroll — creates journal entries and marks as posted.
 *
 * Feature guard: all /payroll, /salary-structures, /salary-history, /statutory-contributions,
 * and /tax-brackets routes require the "hr" feature flag to be enabled for the company.
 *
 * Multi-tenant: all queries are scoped by company_id via the authenticated user context.
 * @access All endpoints require valid JWT + company_id + "hr" feature flag.
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
