import { Router, type IRouter } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import { tenantGuard } from "../middleware/tenant-guard";
import healthRouter from "./health";
import zktecoRouter from "./zkteco";
import productsRouter from "./products";
import customersRouter from "./customers";
import salesRouter from "./sales";
import purchasesRouter from "./purchases";
import expensesRouter from "./expenses";
import incomeRouter from "./income";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import accountsRouter from "./accounts";
import returnsRouter from "./returns";
import treasuryVouchersRouter from "./treasury-vouchers";
import receiptVouchersRouter from "./receipt-vouchers";
import depositVouchersRouter from "./deposit-vouchers";
import paymentVouchersRouter from "./payment-vouchers";
import safeTransfersRouter from "./safe-transfers";
import financialTransactionsRouter from "./financial-transactions";
import adminRouter from "./admin";
import profitsRouter from "./profits";
import metricsRouter from "./metrics";
import inventoryRouter from "./inventory";
import reportsRouter from "./reports";
import authRouter from "./auth";
import openingBalanceRouter from "./opening-balance";
import contactsRouter from "./contacts";
import alertsRouter from "./alerts";
import { notificationsRouter } from "./notifications";
import warrantyRouter from "./warranty";
import systemRouter from "./system";
import backupsRouter from "./backups";
import companiesRouter from "./companies";
import integrityRouter from "./integrity";
import inventoryControlRouter from "./inventory-control";
import categoriesRouter from "./categories";
import superRouter from "./super";
import branchesRouter from "./branches";
import employeesRouter from "./employees";
import payrollRouter from "./payroll";
import attendanceRouter from "./attendance";
import leavesRouter from "./leaves";
import incentivesRouter from "./incentives";
import salaryAdvancesRouter from "./salary-advances";
import employeeBonusesCustodyRouter from "./employee-bonuses-custody";
import attendanceDeductionsRouter from "./attendance-deductions";
import fiscalYearsRouter from "./fiscal-years";
import announcementsRouter from "./announcements";
import exchangeRatesRouter from "./exchange-rates";
import consignmentRouter from "./consignment";
import fixedAssetsRouter from "./fixed-assets";
import accrualsRouter from "./accruals";
import bankReconciliationRouter from "./bank-reconciliation";
import budgetsRouter from "./budgets";
import costCentersRouter from "./cost-centers";

const router: IRouter = Router();

/* ── Public routes — no auth required ─────────────────────────── */
router.use(authRouter);   // /auth/users  /auth/login  /auth/me
router.use(healthRouter); // /health
router.use(zktecoRouter); // /iclock/cdata  /iclock/getrequest  /api/attendance/zkteco

/* ── Global auth guard — all routes below require valid JWT ────── */
router.use(authenticate);

/* ── super_admin cross-tenant routes mount BEFORE requireTenant ── */
router.use(superRouter);

/* ── Tenant guard — every route below MUST resolve a company_id ── */
router.use(requireTenant);

/* ── Subscription guard — blocks expired/inactive companies ────── */
router.use(tenantGuard);

/* ── Protected routes ─────────────────────────────────────────── */
router.use(productsRouter);
router.use(customersRouter);
router.use(salesRouter);
router.use(purchasesRouter);
router.use(expensesRouter);
router.use(incomeRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(accountsRouter);
router.use(returnsRouter);
router.use(treasuryVouchersRouter);
router.use(receiptVouchersRouter);
router.use(depositVouchersRouter);
router.use(paymentVouchersRouter);
router.use(safeTransfersRouter);
router.use(financialTransactionsRouter);
router.use(adminRouter);
router.use(profitsRouter);
router.use(metricsRouter);
router.use(inventoryRouter);
router.use(reportsRouter);
router.use(openingBalanceRouter);
router.use(contactsRouter);
router.use(alertsRouter);
router.use(notificationsRouter);
router.use(warrantyRouter);
router.use(systemRouter);
router.use(backupsRouter);
router.use(companiesRouter);
router.use(integrityRouter);
router.use(inventoryControlRouter);
router.use(categoriesRouter);
router.use(branchesRouter);
router.use(employeesRouter);
router.use(payrollRouter);
router.use(attendanceRouter);
router.use(leavesRouter);
router.use(incentivesRouter);
router.use(salaryAdvancesRouter);
router.use(employeeBonusesCustodyRouter);
router.use(attendanceDeductionsRouter);
router.use(fiscalYearsRouter);
router.use(announcementsRouter);
router.use(exchangeRatesRouter);
router.use(consignmentRouter);
router.use(fixedAssetsRouter);
router.use(accrualsRouter);
router.use(bankReconciliationRouter);
router.use(budgetsRouter);
router.use(costCentersRouter);

export default router;
