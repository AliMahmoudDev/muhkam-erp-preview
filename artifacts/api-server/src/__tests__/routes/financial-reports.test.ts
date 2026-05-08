/**
 * financial-reports.test.ts
 *
 * Integration tests for high-risk financial report routes:
 *   GET /api/reports/cash-flow           — cash-flow statement
 *   GET /api/reports/balance-sheet       — balance sheet
 *   GET /api/reports/trial-balance       — trial balance
 *   GET /api/reports/cash-flow-indirect  — indirect method (P&L proxy)
 *
 * All routes require TWO permission layers:
 *   1. Router middleware:  can_view_reports  (reports/index.ts)
 *   2. Per-handler:        can_view_accounts (reports/financial.ts)
 *
 * admin role → has both → 200
 * employee role → lacks both → 403 at router layer
 * no token → authenticate rejects → 401
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── @workspace/db mock ────────────────────────────────────────────────────────
// All financial report handlers use db.execute() which runs raw SQL.
// The mock returns { rows: [] } for every call; the handlers compute
// totals from empty arrays and return 200 with all-zero summaries.
vi.mock('@workspace/db', () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from:    vi.fn(() => chain),
      where:   vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit:   vi.fn(() => chain),
      offset:  vi.fn().mockResolvedValue([]),
      then: (
        onFulfilled: (v: unknown[]) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve<unknown[]>([]).then(onFulfilled, onRejected),
      catch:   (fn: (e: unknown) => unknown) => Promise.resolve<unknown[]>([]).catch(fn),
      finally: (fn: () => void)              => Promise.resolve<unknown[]>([]).finally(fn),
    };
    return chain;
  };

  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select:  vi.fn().mockReturnThis(),
    from:    vi.fn().mockReturnThis(),
    where:   vi.fn().mockReturnThis(),
    insert:  vi.fn().mockReturnThis(),
    values:  vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{}]),
    update:  vi.fn().mockReturnThis(),
    set:     vi.fn().mockReturnThis(),
    delete:  vi.fn().mockReturnThis(),
    limit:   vi.fn().mockResolvedValue([]),
  };

  const db = {
    select:      vi.fn(() => makeChain()),
    insert:      vi.fn().mockReturnThis(),
    values:      vi.fn().mockReturnThis(),
    returning:   vi.fn().mockResolvedValue([]),
    update:      vi.fn().mockReturnThis(),
    set:         vi.fn().mockReturnThis(),
    delete:      vi.fn().mockReturnThis(),
    execute:     vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };

  return {
    db,
    pool: {
      end:     vi.fn(),
      query:   vi.fn(),
      connect: vi.fn().mockResolvedValue({
        query:   vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    },
    accountsTable:                   {} as Record<string, never>,
    alertsTable:                     {} as Record<string, never>,
    attendanceRecordsTable:          {} as Record<string, never>,
    attendanceSummaryTable:          {} as Record<string, never>,
    auditLogsTable:                  {} as Record<string, never>,
    backupsTable:                    {} as Record<string, never>,
    branchesTable:                   {} as Record<string, never>,
    categoriesTable:                 {} as Record<string, never>,
    companiesTable:                  {} as Record<string, never>,
    customerClassificationsTable:    {} as Record<string, never>,
    customerLedgerTable:             {} as Record<string, never>,
    customersTable:                  {} as Record<string, never>,
    dailyIncentiveAccrualTable:      {} as Record<string, never>,
    departmentsTable:                {} as Record<string, never>,
    depositVouchersTable:            {} as Record<string, never>,
    employeeContactsTable:           {} as Record<string, never>,
    employeeDocumentsTable:          {} as Record<string, never>,
    employeeIncentiveAssignmentsTable: {} as Record<string, never>,
    employeeLeaveBalancesTable:      {} as Record<string, never>,
    employeeShiftAssignmentsTable:   {} as Record<string, never>,
    employeesTable:                  {} as Record<string, never>,
    employeeStatusHistoryTable:      {} as Record<string, never>,
    erpUsersTable:                   {} as Record<string, never>,
    expenseCategoriesTable:          {} as Record<string, never>,
    expensesTable:                   {} as Record<string, never>,
    incentiveMetricsTable:           {} as Record<string, never>,
    incentiveRulesTable:             {} as Record<string, never>,
    incentiveSchemesTable:           {} as Record<string, never>,
    incentiveSlabsTable:             {} as Record<string, never>,
    incomeTable:                     {} as Record<string, never>,
    jobTitlesTable:                  {} as Record<string, never>,
    journalEntriesTable:             {} as Record<string, never>,
    journalEntryLinesTable:          {} as Record<string, never>,
    leaveAccrualHistoryTable:        {} as Record<string, never>,
    leaveApprovalsTable:             {} as Record<string, never>,
    leaveBlackoutDatesTable:         {} as Record<string, never>,
    leavePoliciesTable:              {} as Record<string, never>,
    leaveRequestsTable:              {} as Record<string, never>,
    leaveTypesTable:                 {} as Record<string, never>,
    monthlyIncentiveSummaryTable:    {} as Record<string, never>,
    overtimeRecordsTable:            {} as Record<string, never>,
    paymentVouchersTable:            {} as Record<string, never>,
    payrollAdjustmentsTable:         {} as Record<string, never>,
    payrollLineItemsTable:           {} as Record<string, never>,
    payrollPeriodsTable:             {} as Record<string, never>,
    payrollRecordsTable:             {} as Record<string, never>,
    productsTable:                   {} as Record<string, never>,
    publicHolidaysTable:             {} as Record<string, never>,
    purchaseItemsTable:              {} as Record<string, never>,
    purchaseReturnItemsTable:        {} as Record<string, never>,
    purchaseReturnsTable:            {} as Record<string, never>,
    purchasesTable:                  {} as Record<string, never>,
    receiptVouchersTable:            {} as Record<string, never>,
    repairChecklistItemsTable:       {} as Record<string, never>,
    repairDeviceModelsTable:         {} as Record<string, never>,
    repairJobPartsTable:             {} as Record<string, never>,
    repairJobsTable:                 {} as Record<string, never>,
    repairStatusesTable:             {} as Record<string, never>,
    repairStatusHistoryTable:        {} as Record<string, never>,
    safesTable:                      {} as Record<string, never>,
    safeTransfersTable:              {} as Record<string, never>,
    salaryAdvanceDeductionsTable:    {} as Record<string, never>,
    salaryAdvanceHistoryTable:       {} as Record<string, never>,
    salaryAdvanceLedgerTable:        {} as Record<string, never>,
    salaryAdvanceSettingsTable:      {} as Record<string, never>,
    salaryAdvancesTable:             {} as Record<string, never>,
    salaryComponentsTable:           {} as Record<string, never>,
    salaryHistoryTable:              {} as Record<string, never>,
    salaryStructuresTable:           {} as Record<string, never>,
    saleItemsTable:                  {} as Record<string, never>,
    saleReturnItemsTable:            {} as Record<string, never>,
    salesReturnsTable:               {} as Record<string, never>,
    salesTable:                      {} as Record<string, never>,
    shiftSchedulesTable:             {} as Record<string, never>,
    statutoryContributionsTable:     {} as Record<string, never>,
    stockCountItemsTable:            {} as Record<string, never>,
    stockCountSessionsTable:         {} as Record<string, never>,
    stockMovementsTable:             {} as Record<string, never>,
    stockTransferItemsTable:         {} as Record<string, never>,
    stockTransfersTable:             {} as Record<string, never>,
    suppliersTable:                  {} as Record<string, never>,
    systemSettingsTable:             {} as Record<string, never>,
    taxBracketsTable:                {} as Record<string, never>,
    transactionsTable:               {} as Record<string, never>,
    treasuryVouchersTable:           {} as Record<string, never>,
    warehousesTable:                 {} as Record<string, never>,
  };
});

// ── Middleware passthroughs ───────────────────────────────────────────────────
vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard:           vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));
vi.mock('../../middleware/email-verify-guard', () => ({
  emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate:      vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});

// ── Lib mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../lib/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/alert-service', () => ({
  runAllChecks:        vi.fn().mockResolvedValue(undefined),
  checkHealthCritical: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../lib/period-lock', () => ({
  assertPeriodOpen: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/backup-service', () => ({
  triggerBackup:  vi.fn().mockResolvedValue(undefined),
  scheduleBackup: vi.fn(),
}));
vi.mock('../../lib/invoice-no', () => ({
  nextPurchaseInvoiceNo: vi.fn().mockResolvedValue('PUR-2024-0001'),
  nextInvoiceNo:         vi.fn().mockResolvedValue('INV-2024-0001'),
}));
vi.mock('../../lib/warehouse-guard', () => ({
  resolveTenantWarehouseId: vi.fn().mockResolvedValue(1),
}));
vi.mock('../../lib/auto-account', () => ({
  getOrCreateInventoryAccount:       vi.fn().mockResolvedValue({ id: 10 }),
  getOrCreateSafeAccount:            vi.fn().mockResolvedValue({ id: 11 }),
  getOrCreateCustomerPayableAccount: vi.fn().mockResolvedValue({ id: 12 }),
  getOrCreateVatInputAccount:        vi.fn().mockResolvedValue({ id: 13 }),
  getOrCreateGeneralExpenseAccount:  vi.fn().mockResolvedValue({ id: 14 }),
  createJournalEntry:                vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry:            vi.fn().mockResolvedValue({ id: 101 }),
}));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';

// ── Test users ────────────────────────────────────────────────────────────────
// admin → has can_view_reports + can_view_accounts → 200
// employee → has neither → 403 (blocked at router middleware level)
const adminUser: AuthUser = {
  id: 1, name: 'Admin', username: 'admin',
  role: 'admin', permissions: '{}', active: true,
  warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
};

const employeeUser: AuthUser = {
  id: 3, name: 'Employee', username: 'emp',
  role: 'employee', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: 1, employee_id: 10,
};

// ── Shared authenticate helper ────────────────────────────────────────────────
function asAdmin() {
  vi.mocked(authenticate).mockImplementation(
    (req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/reports/cash-flow', () => {
  beforeEach(() => { asAdmin(); });

  it('يجب أن يرجع 200 مع ملخص التدفق النقدي للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/cash-flow')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('days');
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.summary).toMatchObject({
      total_in: 0, total_out: 0, net_cash_flow: 0,
    });
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app).get('/api/reports/cash-flow');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرفض المستخدم بدون can_view_reports بـ 403', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/cash-flow')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/reports/balance-sheet', () => {
  beforeEach(() => { asAdmin(); });

  it('يجب أن يرجع 200 مع بنود الميزانية العمومية للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/balance-sheet')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    // Response shape: { assets: {cash,receivables,inventory,total}, liabilities, equity, ... }
    expect(res.body).toHaveProperty('assets');
    expect(res.body).toHaveProperty('liabilities');
    expect(res.body).toHaveProperty('equity');
    expect(res.body.assets).toHaveProperty('total');
    expect(res.body.assets.total).toBe(0);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app).get('/api/reports/balance-sheet');

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/reports/trial-balance', () => {
  beforeEach(() => { asAdmin(); });

  it('يجب أن يرجع 200 مع بنود ميزان المراجعة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/trial-balance')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    // Response shape: { accounts: [], summary: { grand_debit, grand_credit, ... }, period, generated_at }
    expect(res.body).toHaveProperty('accounts');
    expect(Array.isArray(res.body.accounts)).toBe(true);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('grand_debit');
    expect(res.body.summary.is_balanced).toBe(true);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app).get('/api/reports/trial-balance');

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Note: /api/reports/profit-loss does not exist as a dedicated route.
// The closest equivalent is /api/reports/cash-flow-indirect (indirect method
// income statement) which computes revenue vs. expenses from the same ledger.
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/reports/cash-flow-indirect (ملخص الأرباح والخسائر)', () => {
  beforeEach(() => { asAdmin(); });

  it('يجب أن يرجع 200 مع بنود قائمة الدخل للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    // date_from and date_to are required by this endpoint
    const res = await request(app)
      .get('/api/reports/cash-flow-indirect')
      .query({ date_from: '2024-01-01', date_to: '2024-12-31' })
      .set('Authorization', 'Bearer test-token');

    // Response shape: { period, operating_activities, investing_activities,
    //                   financing_activities, net_change_in_cash, generated_at }
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('operating_activities');
    expect(res.body).toHaveProperty('net_change_in_cash');
    expect(res.body.net_change_in_cash).toBe(0);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app     = (await import('../../app')).default;

    const res = await request(app).get('/api/reports/cash-flow-indirect');

    expect(res.status).toBe(401);
  });
});
