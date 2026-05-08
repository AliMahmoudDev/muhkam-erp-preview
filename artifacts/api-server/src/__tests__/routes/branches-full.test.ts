import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
const { mockChainData } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select:    vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    insert:    vi.fn().mockReturnThis(),
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    delete:    vi.fn().mockReturnThis(),
    limit:     vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockReturnThis(),
  };

  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from:    vi.fn(() => chain),
      where:   vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit:   vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      offset:  mockChainData,
      then: (
        onFulfilled: (v: unknown[]) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => mockChainData().then(onFulfilled, onRejected),
      catch:   (fn: (e: unknown) => unknown) => mockChainData().catch(fn),
      finally: (fn: () => void)              => mockChainData().finally(fn),
    };
    return chain;
  };

  const db = {
    select:      vi.fn(() => makeChain()),
    insert:      vi.fn().mockReturnThis(),
    values:      vi.fn().mockReturnThis(),
    returning:   vi.fn().mockResolvedValue([]),
    update:      vi.fn().mockReturnThis(),
    set:         vi.fn().mockReturnThis(),
    where:       vi.fn().mockResolvedValue(undefined),
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
    accountsTable:                     {} as Record<string, never>,
    alertsTable:                       {} as Record<string, never>,
    attendanceRecordsTable:            {} as Record<string, never>,
    attendanceSummaryTable:            {} as Record<string, never>,
    auditLogsTable:                    {} as Record<string, never>,
    backupsTable:                      {} as Record<string, never>,
    bankAccountsTable:                 {} as Record<string, never>,
    bankStatementLinesTable:           {} as Record<string, never>,
    branchesTable:                     {} as Record<string, never>,
    budgetLinesTable:                  {} as Record<string, never>,
    budgetsTable:                      {} as Record<string, never>,
    categoriesTable:                   {} as Record<string, never>,
    companiesTable:                    {} as Record<string, never>,
    customerClassificationsTable:      {} as Record<string, never>,
    customerLedgerTable:               {} as Record<string, never>,
    customersTable:                    {} as Record<string, never>,
    dailyIncentiveAccrualTable:        {} as Record<string, never>,
    departmentsTable:                  {} as Record<string, never>,
    depositVouchersTable:              {} as Record<string, never>,
    depreciationRunsTable:             {} as Record<string, never>,
    devicesTable:                      {} as Record<string, never>,
    employeeContactsTable:             {} as Record<string, never>,
    employeeDocumentsTable:            {} as Record<string, never>,
    employeeIncentiveAssignmentsTable: {} as Record<string, never>,
    employeeLeaveBalancesTable:        {} as Record<string, never>,
    employeeShiftAssignmentsTable:     {} as Record<string, never>,
    employeesTable:                    {} as Record<string, never>,
    employeeStatusHistoryTable:        {} as Record<string, never>,
    erpUsersTable:                     {} as Record<string, never>,
    expenseCategoriesTable:            {} as Record<string, never>,
    expensesTable:                     {} as Record<string, never>,
    fixedAssetsTable:                  {} as Record<string, never>,
    incentiveMetricsTable:             {} as Record<string, never>,
    incentiveRulesTable:               {} as Record<string, never>,
    incentiveSchemesTable:             {} as Record<string, never>,
    incentiveSlabsTable:               {} as Record<string, never>,
    incomeTable:                       {} as Record<string, never>,
    jobTitlesTable:                    {} as Record<string, never>,
    journalEntriesTable:               {} as Record<string, never>,
    journalEntryLinesTable:            {} as Record<string, never>,
    leaveAccrualHistoryTable:          {} as Record<string, never>,
    leaveApprovalsTable:               {} as Record<string, never>,
    leaveBlackoutDatesTable:           {} as Record<string, never>,
    leavePoliciesTable:                {} as Record<string, never>,
    leaveRequestsTable:                {} as Record<string, never>,
    leaveTypesTable:                   {} as Record<string, never>,
    monthlyIncentiveSummaryTable:      {} as Record<string, never>,
    notificationsTable:                {} as Record<string, never>,
    overtimeRecordsTable:              {} as Record<string, never>,
    paymentVouchersTable:              {} as Record<string, never>,
    payrollAdjustmentsTable:           {} as Record<string, never>,
    payrollLineItemsTable:             {} as Record<string, never>,
    payrollPeriodsTable:               {} as Record<string, never>,
    payrollRecordsTable:               {} as Record<string, never>,
    productsTable:                     {} as Record<string, never>,
    publicHolidaysTable:               {} as Record<string, never>,
    purchaseItemsTable:                {} as Record<string, never>,
    purchaseReturnItemsTable:          {} as Record<string, never>,
    purchaseReturnsTable:              {} as Record<string, never>,
    purchasesTable:                    {} as Record<string, never>,
    receiptVouchersTable:              {} as Record<string, never>,
    repairChecklistItemsTable:         {} as Record<string, never>,
    repairDeviceModelsTable:           {} as Record<string, never>,
    repairJobPartsTable:               {} as Record<string, never>,
    repairJobsTable:                   {} as Record<string, never>,
    repairStatusesTable:               {} as Record<string, never>,
    repairStatusHistoryTable:          {} as Record<string, never>,
    safesTable:                        {} as Record<string, never>,
    safeTransfersTable:                {} as Record<string, never>,
    salaryAdvanceDeductionsTable:      {} as Record<string, never>,
    salaryAdvanceHistoryTable:         {} as Record<string, never>,
    salaryAdvanceLedgerTable:          {} as Record<string, never>,
    salaryAdvanceSettingsTable:        {} as Record<string, never>,
    salaryAdvancesTable:               {} as Record<string, never>,
    salaryComponentsTable:             {} as Record<string, never>,
    salaryHistoryTable:                {} as Record<string, never>,
    salaryStructuresTable:             {} as Record<string, never>,
    saleItemsTable:                    {} as Record<string, never>,
    saleReturnItemsTable:              {} as Record<string, never>,
    salesReturnsTable:                 {} as Record<string, never>,
    salesTable:                        {} as Record<string, never>,
    shiftSchedulesTable:               {} as Record<string, never>,
    statutoryContributionsTable:       {} as Record<string, never>,
    stockCountItemsTable:              {} as Record<string, never>,
    stockCountSessionsTable:           {} as Record<string, never>,
    stockMovementsTable:               {} as Record<string, never>,
    stockTransferItemsTable:           {} as Record<string, never>,
    stockTransfersTable:               {} as Record<string, never>,
    suppliersTable:                    {} as Record<string, never>,
    systemSettingsTable:               {} as Record<string, never>,
    taxBracketsTable:                  {} as Record<string, never>,
    transactionsTable:                 {} as Record<string, never>,
    treasuryVouchersTable:             {} as Record<string, never>,
    warehousesTable:                   {} as Record<string, never>,
    warrantyTable:                     {} as Record<string, never>,
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
// branches.ts imports authenticate directly and uses it per-route, in addition to the
// global authenticate in routes/index.ts. This means TWO authenticate calls per request
// for branches routes — UNLESS the global middleware (requireTenant) short-circuits first.
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate:      vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});
vi.mock('../../middleware/feature-guard', () => ({
  requireFeature:         vi.fn(() => vi.fn((_req: Request, _res: Response, next: NextFunction) => next())),
  invalidateFeatureCache: vi.fn(),
}));

// ── Lib mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../lib/audit-log',      () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/period-lock',    () => ({
  assertPeriodOpen:           vi.fn().mockResolvedValue(undefined),
  invalidateClosingDateCache: vi.fn(),
}));
vi.mock('../../lib/backup-service', () => ({
  triggerBackup:  vi.fn().mockResolvedValue(undefined),
  scheduleBackup: vi.fn(),
}));
vi.mock('../../lib/alert-service',  () => ({
  runAllChecks:        vi.fn().mockResolvedValue(undefined),
  checkHealthCritical: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../lib/invoice-no', () => ({
  nextPurchaseInvoiceNo:       vi.fn().mockResolvedValue('PUR-2024-0001'),
  nextInvoiceNo:               vi.fn().mockResolvedValue('INV-2024-0001'),
  nextSaleInvoiceNo:           vi.fn().mockResolvedValue('SAL-2024-0001'),
  nextDevicePurchaseInvoiceNo: vi.fn().mockResolvedValue('DPUR-2024-0001'),
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
  getOrCreateSalesRevenueAccount:    vi.fn().mockResolvedValue({ id: 20 }),
  getOrCreateCustomerAccount:        vi.fn().mockResolvedValue({ id: 21 }),
  getOrCreateCOGSAccount:            vi.fn().mockResolvedValue({ id: 22 }),
  getOrCreateVatPayableAccount:      vi.fn().mockResolvedValue({ id: 23 }),
  getOrCreateAccount:                vi.fn().mockResolvedValue({ id: 30 }),
  getOrCreateMiscRevenueAccount:     vi.fn().mockResolvedValue({ id: 31 }),
  createJournalEntry:                vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry:            vi.fn().mockResolvedValue({ id: 101 }),
}));
vi.mock('../../lib/cache', () => ({
  getCache:    vi.fn().mockResolvedValue(null),
  setCache:    vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
}));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { db } from '@workspace/db';

const dbMock = db as unknown as {
  returning: ReturnType<typeof vi.fn>;
  execute:   ReturnType<typeof vi.fn>;
};

// ── Test users ────────────────────────────────────────────────────────────────
const adminUserA: AuthUser = {
  id: 1, name: 'Admin A', username: 'admin_a',
  role: 'admin', permissions: '{}', active: true,
  warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
};

const adminUserB: AuthUser = {
  id: 2, name: 'Admin B', username: 'admin_b',
  role: 'admin', permissions: '{}', active: true,
  warehouse_id: 2, safe_id: 2, company_id: 2, employee_id: null,
};

// noCompanyUser: used for 403 tests (requireTenant rejects before route-level auth runs)
const noCompanyUser: AuthUser = {
  id: 99, name: 'No Company', username: 'nocompany',
  role: 'cashier', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: null, employee_id: null,
};

// ── Branch fixture ────────────────────────────────────────────────────────────
const mockBranch = {
  id: 1, name: 'الفرع الرئيسي',
  address: 'الرياض', phone: null,
  is_active: true, company_id: 1,
  created_at: new Date('2024-01-01T10:00:00.000Z'),
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/branches makes 5 separate db.select() calls (chain resolves via `then`):
//   1. branches list         → rows[]
//   2. warehouse counts      → []  (groupBy)
//   3. safe counts           → []  (groupBy)
//   4. unlinked warehouses   → [{ unlinkedW: N }]  ← MUST be non-empty, else crash
//   5. unlinked safes        → [{ unlinkedS: N }]  ← MUST be non-empty, else crash
//
// Call count rules for branches (routes/index.ts global + branches.ts per-route):
//   - 200 / 201  : both authenticate calls use default (adminUserA)
//   - 401        : ONE mockImplementationOnce (global rejects, route auth never runs)
//   - 403 noComp : ONE mockImplementationOnce (requireTenant fires, route auth never runs)
//   - isolation B: TWO mockImplementationOnce (both calls must see adminUserB)
// ─────────────────────────────────────────────────────────────────────────────

/** Helper: prime the chain for one complete GET /api/branches call. */
function primeBranchGetChain(branchesList: unknown[] = []) {
  mockChainData
    .mockResolvedValueOnce(branchesList)        // 1. branches list
    .mockResolvedValueOnce([])                  // 2. warehouse counts
    .mockResolvedValueOnce([])                  // 3. safe counts
    .mockResolvedValueOnce([{ unlinkedW: 0 }])  // 4. unlinked warehouses
    .mockResolvedValueOnce([{ unlinkedS: 0 }]); // 5. unlinked safes
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/branches', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 مع بيانات الفروع', async () => {
    primeBranchGetChain();

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/branches')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('branches');
    expect(Array.isArray(res.body.branches)).toBe(true);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    // Global authenticate rejects → route-level authenticate never runs → ONE Once entry
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/branches');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرجع 403 للمستخدم بدون company_id (requireTenant يقاطع قبل route-auth)', async () => {
    // ONE Once entry: global auth sets noCompanyUser → requireTenant → 403
    // route-level authenticate never runs
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = noCompanyUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/branches')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
  });

  it('يجب أن يعزل بيانات الشركة — company B لا ترى فروع company A', async () => {
    // Prime 5 chain calls for request A (company A — has one branch)
    // and 5 chain calls for request B (company B — empty list)
    primeBranchGetChain([mockBranch]); // request A: returns the branch
    primeBranchGetChain([]);           // request B: empty

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // Request A — both authenticate calls use default (adminUserA)
    const resA = await request(app)
      .get('/api/branches')
      .set('Authorization', 'Bearer test-token');

    expect(resA.status).toBe(200);
    expect(resA.body.branches).toHaveLength(1);
    expect(resA.body.branches[0]).toHaveProperty('id', 1);

    // Request B — both authenticate calls (global + route-level) must see adminUserB
    const setAdminB = (req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUserB;
      next();
    };
    vi.mocked(authenticate)
      .mockImplementationOnce(setAdminB)
      .mockImplementationOnce(setAdminB);

    const resB = await request(app)
      .get('/api/branches')
      .set('Authorization', 'Bearer test-token');

    expect(resB.status).toBe(200);
    expect(resB.body.branches).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/branches', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند إرسال body بدون name', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/branches')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 403 للمستخدم بدون company_id (requireTenant يقاطع قبل route-auth)', async () => {
    // ONE Once entry: global auth sets noCompanyUser → requireTenant → 403
    // This guarantees 403 without relying on requireRole behaviour
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = noCompanyUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/branches')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'فرع الرياض' });

    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 201 عند إنشاء فرع جديد بنجاح', async () => {
    dbMock.returning.mockResolvedValueOnce([mockBranch]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/branches')
      .set('Authorization', 'Bearer test-token')
      .send({ name: 'الفرع الرئيسي', address: 'الرياض' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('name', 'الفرع الرئيسي');
  });
});
