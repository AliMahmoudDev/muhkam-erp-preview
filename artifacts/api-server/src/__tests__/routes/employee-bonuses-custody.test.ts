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
import { selfEmployeeId, isSelfServiceUser } from '../../lib/employee-self';

const dbMock = db as unknown as { execute: ReturnType<typeof vi.fn>; returning: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };

const adminUser: AuthUser = { id: 1, name: 'Admin', username: 'admin', role: 'admin', permissions: '{}', active: true, warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null };
const adminUserB: AuthUser = { id: 2, name: 'Admin B', username: 'admin_b', role: 'admin', permissions: '{}', active: true, warehouse_id: 2, safe_id: 2, company_id: 2, employee_id: null };


// ═══════════════════════════════════════════════════════════════════
// SECTION A — GET /api/employee-bonuses
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/employee-bonuses', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
  });

  it('يجب أن يرفض 403 إذا كان selfEmployeeId يرجع -1', async () => {
    vi.mocked(selfEmployeeId).mockReturnValue(-1);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/employee-bonuses').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع قائمة الحوافز بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, amount: '500', reason: 'أداء متميز', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/employee-bonuses').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].amount).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION B — POST /api/employee-bonuses
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/employee-bonuses', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
    vi.mocked(isSelfServiceUser).mockReturnValue(false);
  });

  it('يجب أن يرفض 403 لمستخدم الخدمة الذاتية', async () => {
    vi.mocked(isSelfServiceUser).mockReturnValue(true);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-bonuses').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 500 });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-bonuses').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 500 });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 عند بيانات غير صالحة (مبلغ صفر)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-bonuses').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('يجب أن يرجع 404 عند موظف غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-bonuses').set('Authorization', 'Bearer test-token').send({ employee_id: 999, amount: 500 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الموظف غير موجود');
  });

  it('يجب أن يُنشئ حافز بنجاح ويرجع 201', async () => {
    mockChainData.mockResolvedValue([{ id: 10, company_id: 1, currency: 'EGP', first_name_ar: 'أحمد', last_name_ar: 'محمد' }]);
    dbMock.returning.mockResolvedValue([{ id: 1, company_id: 1, employee_id: 10, amount: '500', currency: 'EGP', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-bonuses').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 500, reason: 'أداء متميز' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(500);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION C — GET /api/employee-custody
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/employee-custody', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/employee-custody').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع قائمة العهد بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, amount: '2000', returned_amount: '0', reimbursement_due: '0', status: 'open', created_at: new Date(), updated_at: null }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/employee-custody').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].amount).toBe(2000);
  });

  it('يجب أن يعزل البيانات حسب الشركة', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, amount: '2000', returned_amount: '0', reimbursement_due: '0', status: 'open', created_at: new Date(), updated_at: null }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const resA = await request(app).get('/api/employee-custody').set('Authorization', 'Bearer test-token');
    expect(resA.body).toHaveLength(1);
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementationOnce((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUserB; next(); });
    const resB = await request(app).get('/api/employee-custody').set('Authorization', 'Bearer test-token');
    expect(resB.body).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION D — POST /api/employee-custody
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/employee-custody', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(isSelfServiceUser).mockReturnValue(false);
  });

  it('يجب أن يرفض 403 لمستخدم الخدمة الذاتية', async () => {
    vi.mocked(isSelfServiceUser).mockReturnValue(true);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-custody').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 2000 });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-custody').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 2000 });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 عند بيانات غير صالحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-custody').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 0 });
    expect(res.status).toBe(400);
  });

  it('يجب أن يرجع 404 عند موظف غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-custody').set('Authorization', 'Bearer test-token').send({ employee_id: 999, amount: 2000 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الموظف غير موجود');
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION E — GET /api/employee-deductions
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/employee-deductions', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
  });

  it('يجب أن يرفض 403 إذا كان selfEmployeeId يرجع -1', async () => {
    vi.mocked(selfEmployeeId).mockReturnValue(-1);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/employee-deductions').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع قائمة الخصومات بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, amount: '100', deduction_type: 'late', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/employee-deductions').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION F — POST /api/employee-deductions
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/employee-deductions', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(isSelfServiceUser).mockReturnValue(false);
  });

  it('يجب أن يرفض 403 بدون صلاحية', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-deductions').set('Authorization', 'Bearer test-token').send({ employee_id: 10, amount: 100 });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 404 عند موظف غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/employee-deductions').set('Authorization', 'Bearer test-token').send({ employee_id: 999, amount: 100, deduction_type: 'late' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الموظف غير موجود');
  });
});
