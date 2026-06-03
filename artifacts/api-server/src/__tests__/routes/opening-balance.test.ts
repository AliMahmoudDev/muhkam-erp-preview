import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockChainData, mockHasPermission } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockHasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@workspace/db', () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain), where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain), limit: vi.fn(() => chain),
      offset: mockChainData, innerJoin: vi.fn(() => chain), leftJoin: vi.fn(() => chain),
      then: (onF: (v: unknown[]) => unknown, onR?: (e: unknown) => unknown) => mockChainData().then(onF, onR),
      catch: (fn: (e: unknown) => unknown) => mockChainData().catch(fn),
      finally: (fn: () => void) => mockChainData().finally(fn),
    };
    return chain;
  };
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ rows: [] }),
  };
  const db = {
    select: vi.fn(() => makeChain()), insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };
  return {
    db, pool: { end: vi.fn(), query: vi.fn(), connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }) },
    accountsTable: {}, accrualRunsTable: {}, accrualsTable: {}, alertsTable: {}, announcementsTable: {},
    attendanceDeductionSettingsTable: {}, attendanceDeductionTiersTable: {}, attendanceRecordsTable: {},
    attendanceSummaryTable: {}, auditLogsTable: {}, backupsTable: {}, badDebtsTable: {},
    bankAccountsTable: {}, bankStatementLinesTable: {}, branchesTable: {}, budgetLinesTable: {},
    budgetsTable: {}, categoriesTable: {}, companiesTable: {}, costCentersTable: {},
    customerClassificationsTable: {}, customerLedgerTable: {}, customersTable: {},
    dailyIncentiveAccrualTable: {}, departmentsTable: {}, depositVouchersTable: {},
    depreciationRunsTable: {}, devicesTable: {}, employeeBonusesTable: {},
    employeeContactsTable: {}, employeeCustodyLinesTable: {}, employeeCustodyTable: {},
    employeeDeductionsTable: {}, employeeDocumentsTable: {}, employeeIncentiveAssignmentsTable: {},
    employeeLeaveBalancesTable: {}, employeeShiftAssignmentsTable: {}, employeesTable: {},
    employeeStatusHistoryTable: {}, erpUsersTable: {}, exchangeRatesTable: {},
    expenseCategoriesTable: {}, expensesTable: {}, fiscalYearsTable: {}, fixedAssetsTable: {},
    idempotencyKeysTable: {}, incentiveMetricsTable: {}, incentiveRulesTable: {},
    incentiveSchemesTable: {}, incentiveSlabsTable: {}, incomeTable: {}, jobTitlesTable: {},
    journalEntriesTable: {}, journalEntryLinesTable: {}, leaveAccrualHistoryTable: {},
    leaveApprovalsTable: {}, leaveBlackoutDatesTable: {}, leavePoliciesTable: {},
    leaveRequestsTable: {}, leaveTypesTable: {}, monthlyIncentiveSummaryTable: {},
    notificationsTable: {}, overtimeRecordsTable: {}, paymentVouchersTable: {},
    payrollAdjustmentsTable: {}, payrollLineItemsTable: {}, payrollPeriodsTable: {},
    payrollRecordsTable: {}, planSettingsTable: {}, priceListItemsTable: {}, priceListsTable: {},
    productsTable: {}, publicHolidaysTable: {}, purchaseItemsTable: {},
    purchaseReturnItemsTable: {}, purchaseReturnsTable: {}, purchasesTable: {},
    receiptVouchersTable: {}, refreshTokensTable: {}, repairAccessoriesTable: {},
    repairChecklistItemsTable: {}, repairDashboardCardsTable: {}, repairDeviceModelsTable: {},
    repairDevicePhotosTable: {}, repairJobPartsTable: {}, repairJobsTable: {},
    repairPaymentsTable: {}, repairPipelineConfigTable: {}, repairReceiptTechniciansTable: {},
    repairStatusesTable: {}, repairStatusHistoryTable: {}, safesTable: {}, safeTransfersTable: {},
    salaryAdvanceDeductionsTable: {}, salaryAdvanceHistoryTable: {}, salaryAdvanceLedgerTable: {},
    salaryAdvanceSettingsTable: {}, salaryAdvancesTable: {}, salaryComponentsTable: {},
    salaryHistoryTable: {}, salaryStructuresTable: {}, saleItemsTable: {},
    saleReturnItemsTable: {}, salesReturnsTable: {}, salesTable: {}, salesTargetsTable: {},
    scrapItemsTable: {}, shiftSchedulesTable: {}, statutoryContributionsTable: {},
    stockCountItemsTable: {}, stockCountSessionsTable: {}, stockMovementsTable: {},
    stockTransferItemsTable: {}, stockTransfersTable: {}, superSettingsTable: {},
    suppliersTable: {}, systemSettingsTable: {}, taxBracketsTable: {}, transactionsTable: {},
    treasuryVouchersTable: {}, trialAbuseLogTable: {}, warehousesTable: {}, warrantyTable: {},
  };
});


vi.mock('../../middleware/tenant-guard', () => ({ tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()), invalidateTenantCache: vi.fn() }));
vi.mock('../../middleware/email-verify-guard', () => ({ emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()) }));
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth') as Record<string, unknown>;
  return { ...actual, authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()), superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()) };
});
vi.mock('../../lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/period-lock', () => ({ assertPeriodOpen: vi.fn().mockResolvedValue(undefined), invalidateClosingDateCache: vi.fn() }));
vi.mock('../../lib/permissions', () => ({ hasPermission: mockHasPermission }));
vi.mock('../../middleware/feature-guard', () => ({ requireFeature: vi.fn(() => vi.fn((_req: Request, _res: Response, next: NextFunction) => next())), invalidateFeatureCache: vi.fn() }));
vi.mock('../../lib/notify', () => ({ notifyEmployee: vi.fn().mockResolvedValue(undefined), notifyManagers: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/employee-self', () => ({ selfEmployeeId: vi.fn().mockReturnValue(null), isSelfServiceUser: vi.fn().mockReturnValue(false) }));
vi.mock('../../lib/invoice-no', () => ({ nextInvoiceNo: vi.fn().mockResolvedValue('INV-001') }));
vi.mock('../../lib/warehouse-guard', () => ({ resolveTenantWarehouseId: vi.fn().mockResolvedValue(1) }));
vi.mock('../../lib/auto-account', () => ({ getOrCreateAccount: vi.fn().mockResolvedValue({ id: 1 }), createAutoJournalEntry: vi.fn().mockResolvedValue({ id: 1 }) }));
vi.mock('../../lib/ledger-balance', () => ({ getCustomerLedgerBalance: vi.fn().mockResolvedValue(0) }));
vi.mock('../../lib/backup-service', () => ({ triggerBackup: vi.fn(), scheduleBackup: vi.fn() }));
vi.mock('../../lib/alert-service', () => ({ runAllChecks: vi.fn(), checkHealthCritical: vi.fn().mockResolvedValue([]) }));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { db } from '@workspace/db';

const _dbMock = db as unknown as { execute: ReturnType<typeof vi.fn>; returning: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };

const adminUser: AuthUser = { id: 1, name: 'Admin', username: 'admin', role: 'admin', permissions: '{}', active: true, warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null };


// ═══════════════════════════════════════════════════════════════════
// SECTION A — GET /api/opening-balance/product
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/opening-balance/product', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع قائمة حركات رصيد أول المدة', async () => {
    mockChainData.mockResolvedValue([{ id: 1, product_id: 1, movement_type: 'opening_balance', quantity: '10', quantity_before: '0', quantity_after: '10', unit_cost: '100', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/opening-balance/product').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].quantity).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION B — POST /api/inventory/opening-balance
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/inventory/opening-balance', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع 400 عند بيانات غير صحيحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/inventory/opening-balance').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('بيانات رصيد أول المدة غير صحيحة');
  });

  it('يجب أن يرجع 404 عند منتج غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/inventory/opening-balance').set('Authorization', 'Bearer test-token')
      .send({ product_id: 999, quantity: 10, cost_price: 100 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('المنتج غير موجود');
  });

  it('يجب أن يرجع 409 إذا كان رصيد أول المدة مسجل مسبقاً', async () => {
    mockChainData
      .mockResolvedValueOnce([{ id: 1, name: 'منتج', quantity: '0', cost_price: '0', company_id: 1 }]) // product found
      .mockResolvedValueOnce([{ id: 1, movement_type: 'opening_balance' }]); // existing movement
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/inventory/opening-balance').set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, quantity: 10, cost_price: 100 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('رصيد أول المدة مسجل مسبقاً لهذا المنتج');
  });

  it('يجب أن يسجل رصيد أول المدة بنجاح ويرجع 201', async () => {
    mockChainData
      .mockResolvedValueOnce([{ id: 1, name: 'منتج', quantity: '0', cost_price: '0', company_id: 1 }]) // product found
      .mockResolvedValueOnce([]); // no existing movement
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/inventory/opening-balance').set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, quantity: 10, cost_price: 100 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.new_qty).toBe(10);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION C — POST /api/opening-balance/treasury
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/opening-balance/treasury', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع 400 عند بيانات غير صحيحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/opening-balance/treasury').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('بيانات رصيد أول المدة للخزينة غير صحيحة');
  });

  it('يجب أن يرجع 404 عند خزينة غير موجودة', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/opening-balance/treasury').set('Authorization', 'Bearer test-token')
      .send({ safe_id: 999, amount: 5000 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الخزينة غير موجودة');
  });

  it('يجب أن يسجل رصيد أول المدة للخزينة بنجاح ويرجع 201', async () => {
    mockChainData.mockResolvedValue([{ id: 1, name: 'خزينة رئيسية', balance: '0', company_id: 1 }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/opening-balance/treasury').set('Authorization', 'Bearer test-token')
      .send({ safe_id: 1, amount: 5000 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.amount).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION D — POST /api/opening-balance/customer
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/opening-balance/customer', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع 400 عند بيانات غير صحيحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/opening-balance/customer').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('بيانات رصيد أول المدة للعميل غير صحيحة');
  });

  it('يجب أن يرجع 404 عند عميل غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/opening-balance/customer').set('Authorization', 'Bearer test-token')
      .send({ customer_id: 999, amount: 3000 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('العميل غير موجود');
  });

  it('يجب أن يسجل رصيد أول المدة للعميل بنجاح ويرجع 201', async () => {
    mockChainData.mockResolvedValue([{ id: 1, name: 'عميل تجريبي', balance: '0', company_id: 1 }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/opening-balance/customer').set('Authorization', 'Bearer test-token')
      .send({ customer_id: 1, amount: 3000 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.amount).toBe(3000);
  });
});
