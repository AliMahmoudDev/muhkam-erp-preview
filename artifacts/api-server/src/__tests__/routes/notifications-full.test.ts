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

const noCompanyUser: AuthUser = {
  id: 99, name: 'No Company', username: 'nocompany',
  role: 'cashier', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: null, employee_id: null,
};

// ── Notification fixture ──────────────────────────────────────────────────────
const mockNotification = {
  id: 5, user_id: 1, company_id: 1,
  title: 'إشعار تجريبي', body: 'محتوى الإشعار',
  type: 'info', is_read: false,
  created_at: new Date('2024-01-20T10:00:00.000Z'),
  read_at: null,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 ومصفوفة الإشعارات', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرجع 403 للمستخدم بدون company_id (requireTenant)', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = noCompanyUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
  });

  it('يجب أن يعزل الإشعارات — company B لا ترى إشعارات company A', async () => {
    mockChainData.mockResolvedValueOnce([mockNotification]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const resA = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer test-token');

    expect(resA.status).toBe(200);
    expect(resA.body.length).toBeGreaterThan(0);
    expect(resA.body[0]).toHaveProperty('id', 5);

    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const resB = await request(app)
      .get('/api/notifications')
      .set('Authorization', 'Bearer test-token');

    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/notifications/:id/read', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 عند تحديد الإشعار كمقروء', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .patch('/api/notifications/5/read')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .patch('/api/notifications/5/read');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرجع 400 عند تمرير معرّف غير صحيح', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .patch('/api/notifications/abc/read')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
