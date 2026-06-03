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
  const returningFn = vi.fn().mockResolvedValue([]);
  const makeWhereResult = (): Record<string, unknown> => ({
    returning: returningFn,
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => Promise.resolve(undefined).then(onF, onR),
    catch: (fn: (e: unknown) => unknown) => Promise.resolve(undefined).catch(fn),
    finally: (fn: () => void) => Promise.resolve(undefined).finally(fn),
  });
  const db = {
    select: vi.fn(() => makeChain()), insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(), returning: returningFn,
    update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
    where: vi.fn(() => makeWhereResult()), delete: vi.fn().mockReturnThis(),
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

const dbMock = db as unknown as { execute: ReturnType<typeof vi.fn>; returning: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };

const adminUser: AuthUser = { id: 1, name: 'Admin', username: 'admin', role: 'admin', permissions: '{}', active: true, warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null };
const _adminUserB: AuthUser = { id: 2, name: 'Admin B', username: 'admin_b', role: 'admin', permissions: '{}', active: true, warehouse_id: 2, safe_id: 2, company_id: 2, employee_id: null };


// ═══════════════════════════════════════════════════════════════════
// SECTION A — GET /api/attendance-deductions/settings
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/attendance-deductions/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/attendance-deductions/settings').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع الإعدادات (أو ينشئ افتراضية)', async () => {
    // First call: getOrCreateSettings select returns nothing, second: insert returns
    mockChainData.mockResolvedValueOnce([]);
    dbMock.returning.mockResolvedValue([{ company_id: 1, grace_minutes: 5, weekly_off_days: '5,6', absence_full_day_amount: '0', absence_half_day_amount: '0', apply_early_leave: false, updated_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/attendance-deductions/settings').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION B — PUT /api/attendance-deductions/settings
// ═══════════════════════════════════════════════════════════════════
describe('PUT /api/attendance-deductions/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).put('/api/attendance-deductions/settings').set('Authorization', 'Bearer test-token').send({ grace_minutes: 10 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يحدّث الإعدادات بنجاح', async () => {
    mockChainData.mockResolvedValue([{ company_id: 1 }]);
    dbMock.returning.mockResolvedValue([{ company_id: 1, grace_minutes: 10, weekly_off_days: '5,6', absence_full_day_amount: '100', absence_half_day_amount: '50', apply_early_leave: true, updated_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).put('/api/attendance-deductions/settings').set('Authorization', 'Bearer test-token').send({ grace_minutes: 10, absence_full_day_amount: 100 });
    expect(res.status).toBe(200);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION C — GET /api/attendance-deductions/tiers
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/attendance-deductions/tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/attendance-deductions/tiers').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع قائمة الشرائح بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, applies_to: 'late', min_minutes: 5, max_minutes: 15, amount: '50', is_active: true, created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/attendance-deductions/tiers').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].amount).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION D — POST /api/attendance-deductions/tiers (bulk replace)
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/attendance-deductions/tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance-deductions/tiers').set('Authorization', 'Bearer test-token').send({ tiers: [] });
    expect(res.status).toBe(403);
  });

  it('يجب أن يستبدل الشرائح بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, applies_to: 'late', min_minutes: 5, max_minutes: 15, amount: '50', is_active: true, created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance-deductions/tiers').set('Authorization', 'Bearer test-token')
      .send({ tiers: [{ applies_to: 'late', min_minutes: 5, max_minutes: 15, amount: 50 }] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION E — POST /api/attendance-deductions/preview
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/attendance-deductions/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance-deductions/preview').set('Authorization', 'Bearer test-token').send({ month: '2024-06' });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 عند صيغة شهر غير صحيحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance-deductions/preview').set('Authorization', 'Bearer test-token').send({ month: 'invalid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('YYYY-MM');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION F — POST /api/attendance-deductions/apply
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/attendance-deductions/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance-deductions/apply').set('Authorization', 'Bearer test-token').send({ items: [] });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 عند إرسال بنود فارغة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance-deductions/apply').set('Authorization', 'Bearer test-token').send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('لا توجد بنود');
  });
});
