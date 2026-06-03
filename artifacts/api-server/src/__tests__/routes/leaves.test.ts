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
// SECTION A — POST /api/leave-types
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/leave-types', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-types').set('Authorization', 'Bearer test-token').send({ name_ar: 'إجازة سنوية', code: 'ANN' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع 400 عند بيانات غير صالحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-types').set('Authorization', 'Bearer test-token').send({ name_ar: '', code: '' });
    expect(res.status).toBe(400);
  });

  it('يجب أن يُنشئ نوع إجازة بنجاح ويرجع 201', async () => {
    dbMock.returning.mockResolvedValue([{ id: 1, company_id: 1, name_ar: 'إجازة سنوية', code: 'ANN', is_paid: true, requires_approval: true, created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-types').set('Authorization', 'Bearer test-token').send({ name_ar: 'إجازة سنوية', code: 'ANN' });
    expect(res.status).toBe(201);
    expect(res.body.name_ar).toBe('إجازة سنوية');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION B — GET /api/leave-types
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/leave-types', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع قائمة أنواع الإجازات', async () => {
    mockChainData.mockResolvedValue([{ id: 1, name_ar: 'إجازة سنوية', code: 'ANN', is_active: true, created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/leave-types').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION C — GET /api/leave-requests
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/leave-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
  });

  it('يجب أن يرفض 403 إذا كان selfEmployeeId يرجع -1', async () => {
    vi.mocked(selfEmployeeId).mockReturnValue(-1);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/leave-requests').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع قائمة طلبات الإجازة', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, leave_type_id: 1, start_date: '2024-06-01', end_date: '2024-06-03', total_days: '3', status: 'pending', submitted_at: new Date(), created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/leave-requests').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].total_days).toBe(3);
  });

  it('يجب أن يعزل البيانات حسب الشركة', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, leave_type_id: 1, start_date: '2024-06-01', end_date: '2024-06-03', total_days: '3', status: 'pending', submitted_at: new Date(), created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const resA = await request(app).get('/api/leave-requests').set('Authorization', 'Bearer test-token');
    expect(resA.body).toHaveLength(1);
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementationOnce((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUserB; next(); });
    const resB = await request(app).get('/api/leave-requests').set('Authorization', 'Bearer test-token');
    expect(resB.body).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION D — POST /api/leave-requests
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/leave-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
    vi.mocked(isSelfServiceUser).mockReturnValue(false);
  });

  it('يجب أن يرجع 400 عند بيانات غير صالحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(400);
  });

  it('يجب أن يرجع 400 عند تاريخ بداية بعد تاريخ النهاية', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests').set('Authorization', 'Bearer test-token')
      .send({ leave_type_id: 1, employee_id: 10, start_date: '2024-06-10', end_date: '2024-06-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
  });

  it('يجب أن يرجع 404 عند موظف غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests').set('Authorization', 'Bearer test-token')
      .send({ leave_type_id: 1, employee_id: 999, start_date: '2024-06-01', end_date: '2024-06-03' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الموظف غير موجود');
  });

  it('يجب أن يرجع 409 عند وجود طلب متداخل', async () => {
    mockChainData
      .mockResolvedValueOnce([{ id: 10, hire_date: '2023-01-01' }]) // employee exists
      .mockResolvedValueOnce([{ id: 5 }]); // overlapping request
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests').set('Authorization', 'Bearer test-token')
      .send({ leave_type_id: 1, employee_id: 10, start_date: '2024-06-01', end_date: '2024-06-03' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('متداخل');
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION E — POST /api/leave-requests/:id/approve
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/leave-requests/:id/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests/1/approve').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح بالاعتماد');
  });

  it('يجب أن يرجع 404 لطلب غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests/999/approve').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الطلب غير موجود');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION F — POST /api/leave-requests/:id/reject
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/leave-requests/:id/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests/1/reject').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 404 لطلب غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-requests/999/reject').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الطلب غير موجود');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION G — POST /api/leave-blackout-dates
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/leave-blackout-dates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-blackout-dates').set('Authorization', 'Bearer test-token').send({ start_date: '2024-06-01', end_date: '2024-06-10' });
    expect(res.status).toBe(403);
  });

  it('يجب أن يُنشئ فترة محظورة بنجاح ويرجع 201', async () => {
    dbMock.returning.mockResolvedValue([{ id: 1, company_id: 1, start_date: '2024-06-01', end_date: '2024-06-10', reason_ar: 'جرد', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/leave-blackout-dates').set('Authorization', 'Bearer test-token').send({ start_date: '2024-06-01', end_date: '2024-06-10', reason_ar: 'جرد' });
    expect(res.status).toBe(201);
  });
});
