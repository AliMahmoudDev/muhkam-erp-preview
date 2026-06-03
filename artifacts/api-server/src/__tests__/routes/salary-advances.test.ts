import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockChainData, mockHasPermission } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockHasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@workspace/db', () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: mockChainData,
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
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
    delete: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ rows: [] }),
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


vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));
vi.mock('../../middleware/email-verify-guard', () => ({
  emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));
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
import { selfEmployeeId } from '../../lib/employee-self';

const dbMock = db as unknown as {
  execute: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
};

const adminUser: AuthUser = {
  id: 1, name: 'Admin', username: 'admin',
  role: 'admin', permissions: '{}', active: true,
  warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
};
const adminUserB: AuthUser = {
  id: 2, name: 'Admin B', username: 'admin_b',
  role: 'admin', permissions: '{}', active: true,
  warehouse_id: 2, safe_id: 2, company_id: 2, employee_id: null,
};
const _employeeUser: AuthUser = {
  id: 3, name: 'Employee', username: 'emp',
  role: 'employee', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: 1, employee_id: 10,
};


// ═══════════════════════════════════════════════════════════════════
// SECTION A — GET /api/salary-advances/settings
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/salary-advances/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
  });

  it('يجب أن يرجع الإعدادات الافتراضية عند عدم وجود إعدادات', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances/settings').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('max_advance_percentage');
  });

  it('يجب أن يرجع الإعدادات المحفوظة عند وجودها', async () => {
    mockChainData.mockResolvedValue([{ company_id: 1, max_advance_percentage: '60', max_concurrent_advances: 3, min_salary_for_advance: '5000', repayment_tenure_months: 3, requires_approval: true, created_at: new Date(), updated_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances/settings').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(res.body.max_advance_percentage).toBe(60);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION B — PUT /api/salary-advances/settings
// ═══════════════════════════════════════════════════════════════════
describe('PUT /api/salary-advances/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_payroll', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).put('/api/salary-advances/settings').set('Authorization', 'Bearer test-token').send({ max_advance_percentage: 70 });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يحدّث الإعدادات بنجاح', async () => {
    mockChainData.mockResolvedValue([{ company_id: 1 }]);
    dbMock.returning.mockResolvedValue([{ company_id: 1, max_advance_percentage: '70', max_concurrent_advances: 2, min_salary_for_advance: '3000', repayment_tenure_months: 1, requires_approval: true, created_at: new Date(), updated_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).put('/api/salary-advances/settings').set('Authorization', 'Bearer test-token').send({ max_advance_percentage: 70 });
    expect(res.status).toBe(200);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION C — GET /api/salary-advances
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/salary-advances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
  });

  it('يجب أن يرفض 403 إذا كان selfEmployeeId يرجع -1', async () => {
    vi.mocked(selfEmployeeId).mockReturnValue(-1);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع قائمة السلف بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, requested_amount: '5000', approved_amount: null, remaining_balance: '0', status: 'pending', approved_at: null, created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].requested_amount).toBe(5000);
  });

  it('يجب أن يعزل البيانات حسب الشركة', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, requested_amount: '5000', approved_amount: null, remaining_balance: '0', status: 'pending', approved_at: null, created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const resA = await request(app).get('/api/salary-advances').set('Authorization', 'Bearer test-token');
    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);

    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementationOnce((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUserB;
      next();
    });
    const resB = await request(app).get('/api/salary-advances').set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION D — POST /api/salary-advances
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/salary-advances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
    vi.mocked(selfEmployeeId).mockReturnValue(null);
  });

  it('يجب أن يرجع 400 عند بيانات غير صالحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('بيانات السلفة غير صالحة');
  });

  it('يجب أن يرجع 404 عند موظف غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances').set('Authorization', 'Bearer test-token')
      .send({ employee_id: 999, requested_amount: 5000, advance_type: 'personal' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الموظف غير موجود');
  });

  it('يجب أن يُنشئ سلفة بنجاح ويرجع 201', async () => {
    // Employee found
    mockChainData.mockResolvedValueOnce([{ id: 10, company_id: 1, salary: '10000', currency: 'EGP', commission_rate: null, first_name_ar: 'أحمد', last_name_ar: 'محمد' }]);
    // Settings
    mockChainData.mockResolvedValueOnce([{ max_advance_percentage: '50', max_concurrent_advances: 2, min_salary_for_advance: '3000' }]);
    // Active advances count
    mockChainData.mockResolvedValueOnce([{ count: 0 }]);
    // Insert returning
    dbMock.returning.mockResolvedValue([{ id: 1, company_id: 1, employee_id: 10, requested_amount: '5000', status: 'pending', remaining_balance: '0', created_at: new Date(), updated_at: null, approved_at: null }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances').set('Authorization', 'Bearer test-token')
      .send({ employee_id: 10, requested_amount: 5000, advance_type: 'personal' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('يجب أن يرجع 400 عند تجاوز الحد الأقصى للمبلغ', async () => {
    mockChainData.mockResolvedValueOnce([{ id: 10, company_id: 1, salary: '10000', currency: 'EGP', commission_rate: null }]);
    mockChainData.mockResolvedValueOnce([{ max_advance_percentage: '50', max_concurrent_advances: 2, min_salary_for_advance: '3000' }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances').set('Authorization', 'Bearer test-token')
      .send({ employee_id: 10, requested_amount: 9000, advance_type: 'personal' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('يتجاوز الحد الأقصى');
  });

  it('يجب أن يرجع 409 عند الوصول للحد الأقصى للسلف المتزامنة', async () => {
    mockChainData.mockResolvedValueOnce([{ id: 10, company_id: 1, salary: '10000', currency: 'EGP', commission_rate: null }]);
    mockChainData.mockResolvedValueOnce([{ max_advance_percentage: '50', max_concurrent_advances: 2, min_salary_for_advance: '3000' }]);
    mockChainData.mockResolvedValueOnce([{ count: 2 }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances').set('Authorization', 'Bearer test-token')
      .send({ employee_id: 10, requested_amount: 3000, advance_type: 'personal' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('الحد الأقصى للسلف المتزامنة');
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION E — POST /api/salary-advances/:id/reject
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/salary-advances/:id/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_payroll', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances/1/reject').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع 404 لسلفة غير موجودة', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances/999/reject').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('السلفة غير موجودة');
  });

  it('يجب أن يرجع 409 إذا كانت السلفة ليست في حالة انتظار', async () => {
    mockChainData.mockResolvedValue([{ id: 1, status: 'active', employee_id: 10, requested_amount: '5000', first_name_ar: 'أحمد', last_name_ar: 'محمد', currency: 'EGP' }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/salary-advances/1/reject').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('لا يمكن رفض سلفة غير معلّقة');
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION F — GET /api/salary-advances/pending-approvals
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/salary-advances/pending-approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_payroll', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances/pending-approvals').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع قائمة الطلبات المعلقة', async () => {
    mockChainData.mockResolvedValue([{ id: 1, employee_id: 10, requested_amount: '5000', advance_type: 'personal', reason: null, currency: 'EGP', created_at: new Date(), first_name_ar: 'أحمد', last_name_ar: 'محمد', employee_code: 'E001', salary: '10000' }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances/pending-approvals').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].requested_amount).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION G — GET /api/salary-advances/:id
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/salary-advances/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = adminUser;
      next();
    });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances/1').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع 404 لسلفة غير موجودة', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/salary-advances/999').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('السلفة غير موجودة');
  });
});
