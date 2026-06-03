import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
// mockReset() in each beforeEach clears both call history and queued
// mockResolvedValueOnce values, preventing cross-test pollution.
const { mockChainData, mockInsertReturning, mockUpdateReturning } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockInsertReturning: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockUpdateReturning: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
  // Thenable Drizzle select chain — resolves via mockChainData
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
        mockChainData().then(onFulfilled, onRejected),
      catch: (fn: (e: unknown) => unknown) => mockChainData().catch(fn),
      finally: (fn: () => void) => mockChainData().finally(fn),
    };
    return chain;
  };

  // Insert values chain: .returning() for storing rows, .catch() for fire-and-forget notify
  const makeInsertValuesChain = () => ({
    returning: () => mockInsertReturning(),
    catch: (_fn: (e: unknown) => unknown) => Promise.resolve(),
  });

  // txMock — the argument passed to db.transaction(fn)
  const txMock = {
    execute: vi.fn().mockResolvedValue({ rows: [{ stock: '100' }] }),
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => ({
      values: () => ({
        returning: () => mockInsertReturning(),
        catch: (_fn: (e: unknown) => unknown) => Promise.resolve(),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: () => mockUpdateReturning(),
        }),
      }),
    })),
  };

  const db = {
    select: vi.fn(() => makeChain()),
    execute: vi.fn().mockResolvedValue({ rows: [{ stock: '100' }] }),
    transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    insert: vi.fn(() => ({
      values: () => makeInsertValuesChain(),
      returning: () => mockInsertReturning(),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: () => mockUpdateReturning(),
        }),
      }),
    })),
  };

  return {
    db,
    pool: {
      end: vi.fn(),
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    },
    accountsTable: {} as Record<string, never>,
    alertsTable: {} as Record<string, never>,
    attendanceRecordsTable: {} as Record<string, never>,
    attendanceSummaryTable: {} as Record<string, never>,
    auditLogsTable: {} as Record<string, never>,
    backupsTable: {} as Record<string, never>,
    bankAccountsTable: {} as Record<string, never>,
    bankStatementLinesTable: {} as Record<string, never>,
    branchesTable: {} as Record<string, never>,
    budgetLinesTable: {} as Record<string, never>,
    budgetsTable: {} as Record<string, never>,
    categoriesTable: {} as Record<string, never>,
    companiesTable: {} as Record<string, never>,
    customerClassificationsTable: {} as Record<string, never>,
    customerLedgerTable: {} as Record<string, never>,
    customersTable: {} as Record<string, never>,
    dailyIncentiveAccrualTable: {} as Record<string, never>,
    departmentsTable: {} as Record<string, never>,
    depositVouchersTable: {} as Record<string, never>,
    depreciationRunsTable: {} as Record<string, never>,
    devicesTable: {} as Record<string, never>,
    employeeContactsTable: {} as Record<string, never>,
    employeeDocumentsTable: {} as Record<string, never>,
    employeeIncentiveAssignmentsTable: {} as Record<string, never>,
    employeeLeaveBalancesTable: {} as Record<string, never>,
    employeeShiftAssignmentsTable: {} as Record<string, never>,
    employeesTable: {} as Record<string, never>,
    employeeStatusHistoryTable: {} as Record<string, never>,
    erpUsersTable: {} as Record<string, never>,
    expenseCategoriesTable: {} as Record<string, never>,
    expensesTable: {} as Record<string, never>,
    fixedAssetsTable: {} as Record<string, never>,
    incentiveMetricsTable: {} as Record<string, never>,
    incentiveRulesTable: {} as Record<string, never>,
    incentiveSchemesTable: {} as Record<string, never>,
    incentiveSlabsTable: {} as Record<string, never>,
    incomeTable: {} as Record<string, never>,
    jobTitlesTable: {} as Record<string, never>,
    journalEntriesTable: {} as Record<string, never>,
    journalEntryLinesTable: {} as Record<string, never>,
    leaveAccrualHistoryTable: {} as Record<string, never>,
    leaveApprovalsTable: {} as Record<string, never>,
    leaveBlackoutDatesTable: {} as Record<string, never>,
    leavePoliciesTable: {} as Record<string, never>,
    leaveRequestsTable: {} as Record<string, never>,
    leaveTypesTable: {} as Record<string, never>,
    monthlyIncentiveSummaryTable: {} as Record<string, never>,
    notificationsTable: {} as Record<string, never>,
    overtimeRecordsTable: {} as Record<string, never>,
    paymentVouchersTable: {} as Record<string, never>,
    payrollAdjustmentsTable: {} as Record<string, never>,
    payrollLineItemsTable: {} as Record<string, never>,
    payrollPeriodsTable: {} as Record<string, never>,
    payrollRecordsTable: {} as Record<string, never>,
    productsTable: {} as Record<string, never>,
    publicHolidaysTable: {} as Record<string, never>,
    purchaseItemsTable: {} as Record<string, never>,
    purchaseReturnItemsTable: {} as Record<string, never>,
    purchaseReturnsTable: {} as Record<string, never>,
    purchasesTable: {} as Record<string, never>,
    receiptVouchersTable: {} as Record<string, never>,
    repairChecklistItemsTable: {} as Record<string, never>,
    repairDeviceModelsTable: {} as Record<string, never>,
    repairJobPartsTable: {} as Record<string, never>,
    repairJobsTable: {} as Record<string, never>,
    repairStatusesTable: {} as Record<string, never>,
    repairStatusHistoryTable: {} as Record<string, never>,
    safesTable: {} as Record<string, never>,
    safeTransfersTable: {} as Record<string, never>,
    salaryAdvanceDeductionsTable: {} as Record<string, never>,
    salaryAdvanceHistoryTable: {} as Record<string, never>,
    salaryAdvanceLedgerTable: {} as Record<string, never>,
    salaryAdvanceSettingsTable: {} as Record<string, never>,
    salaryAdvancesTable: {} as Record<string, never>,
    salaryComponentsTable: {} as Record<string, never>,
    salaryHistoryTable: {} as Record<string, never>,
    salaryStructuresTable: {} as Record<string, never>,
    saleItemsTable: {} as Record<string, never>,
    saleReturnItemsTable: {} as Record<string, never>,
    salesReturnsTable: {} as Record<string, never>,
    salesTable: {} as Record<string, never>,
    shiftSchedulesTable: {} as Record<string, never>,
    statutoryContributionsTable: {} as Record<string, never>,
    stockCountItemsTable: {} as Record<string, never>,
    stockCountSessionsTable: {} as Record<string, never>,
    stockMovementsTable: {} as Record<string, never>,
    stockTransferItemsTable: {} as Record<string, never>,
    stockTransfersTable: {} as Record<string, never>,
    suppliersTable: {} as Record<string, never>,
    systemSettingsTable: {} as Record<string, never>,
    taxBracketsTable: {} as Record<string, never>,
    transactionsTable: {} as Record<string, never>,
    treasuryVouchersTable: {} as Record<string, never>,
    warehousesTable: {} as Record<string, never>,
    warrantyTable: {} as Record<string, never>,
  };
});

// ── Middleware passthroughs ───────────────────────────────────────────────────
vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));
vi.mock('../../middleware/email-verify-guard', () => ({
  emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../middleware/auth', async () => {
  const actual = (await vi.importActual('../../middleware/auth')) as Record<string, unknown>;
  return {
    ...actual,
    authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});
vi.mock('../../middleware/feature-guard', () => ({
  requireFeature: vi.fn(() => vi.fn((_req: Request, _res: Response, next: NextFunction) => next())),
  invalidateFeatureCache: vi.fn(),
}));

// ── Lib mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/period-lock', () => ({
  assertPeriodOpen: vi.fn().mockResolvedValue(undefined),
  invalidateClosingDateCache: vi.fn(),
}));
vi.mock('../../lib/backup-service', () => ({
  triggerBackup: vi.fn().mockResolvedValue(undefined),
  scheduleBackup: vi.fn(),
}));
vi.mock('../../lib/alert-service', () => ({
  runAllChecks: vi.fn().mockResolvedValue(undefined),
  checkHealthCritical: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../lib/invoice-no', () => ({
  nextPurchaseInvoiceNo: vi.fn().mockResolvedValue('PUR-2024-0001'),
  nextInvoiceNo: vi.fn().mockResolvedValue('INV-2024-0001'),
  nextSaleInvoiceNo: vi.fn().mockResolvedValue('SAL-2024-0001'),
  nextDevicePurchaseInvoiceNo: vi.fn().mockResolvedValue('DPUR-2024-0001'),
}));
vi.mock('../../lib/warehouse-guard', () => ({
  resolveTenantWarehouseId: vi.fn().mockResolvedValue(1),
}));
vi.mock('../../lib/auto-account', () => ({
  getOrCreateInventoryAccount: vi.fn().mockResolvedValue({ id: 10 }),
  getOrCreateSafeAccount: vi.fn().mockResolvedValue({ id: 11 }),
  getOrCreateCustomerPayableAccount: vi.fn().mockResolvedValue({ id: 12 }),
  getOrCreateVatInputAccount: vi.fn().mockResolvedValue({ id: 13 }),
  getOrCreateGeneralExpenseAccount: vi.fn().mockResolvedValue({ id: 14 }),
  getOrCreateSalesRevenueAccount: vi.fn().mockResolvedValue({ id: 20 }),
  getOrCreateCustomerAccount: vi.fn().mockResolvedValue({ id: 21 }),
  getOrCreateCOGSAccount: vi.fn().mockResolvedValue({ id: 22 }),
  getOrCreateVatPayableAccount: vi.fn().mockResolvedValue({ id: 23 }),
  getOrCreateAccount: vi.fn().mockResolvedValue({ id: 30 }),
  getOrCreateMiscRevenueAccount: vi.fn().mockResolvedValue({ id: 31 }),
  createJournalEntry: vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry: vi.fn().mockResolvedValue({ id: 101 }),
}));
vi.mock('../../lib/cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/ledger-balance', () => ({
  getCustomerLedgerBalance: vi.fn().mockResolvedValue(0),
}));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';

// ── Test users ────────────────────────────────────────────────────────────────
// role:'admin' has can_view_inventory=true by default via ROLE_DEFAULTS
const adminUser: AuthUser = {
  id: 1,
  name: 'مدير',
  username: 'admin',
  role: 'admin',
  permissions: '{}',
  active: true,
  warehouse_id: 1,
  safe_id: 1,
  company_id: 1,
  employee_id: null,
};

// role:'employee' has can_view_inventory=false by default
const employeeUser: AuthUser = {
  id: 3,
  name: 'موظف',
  username: 'emp',
  role: 'employee',
  permissions: '{}',
  active: true,
  warehouse_id: null,
  safe_id: null,
  company_id: 1,
  employee_id: 10,
};

// ── Transfer fixtures ─────────────────────────────────────────────────────────
const mockTransfer = {
  id: 1,
  company_id: 1,
  product_id: 10,
  product_name: 'منتج اختباري',
  quantity: '5',
  from_branch_id: 2,
  to_branch_id: 3,
  status: 'pending',
  verification_code: '123456',
  created_by: 1,
  approved_by: null,
  shipped_by: null,
  received_by: null,
  notes: null,
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  approved_at: null,
  shipped_at: null,
  received_at: null,
};

const approvedTransfer = {
  ...mockTransfer,
  status: 'approved',
  approved_by: 1,
  approved_at: new Date(),
};
const shippedTransfer = {
  ...mockTransfer,
  status: 'shipped',
  shipped_by: 1,
  shipped_at: new Date(),
};
const receivedTransfer = {
  ...mockTransfer,
  status: 'received',
  received_by: 1,
  received_at: new Date(),
};

// ── Helper: set authenticated user on req ─────────────────────────────────────
function setUser(user: AuthUser) {
  vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: AuthUser }).user = user;
    next();
  });
}

// ── Helper: reset hoisted mocks between tests ─────────────────────────────────
// mockReset() clears both call history AND queued mockResolvedValueOnce values,
// preventing cross-test queue pollution that vi.clearAllMocks() does not fix.
function resetMocks() {
  vi.clearAllMocks();
  mockChainData.mockReset();
  mockInsertReturning.mockReset();
  mockUpdateReturning.mockReset();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/request
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/transfers/request', () => {
  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    // Default: no results (each test sets its own sequence via mockResolvedValueOnce)
    mockChainData.mockResolvedValue([]);
    mockInsertReturning.mockResolvedValue([mockTransfer]);
  });

  it('يجب أن ينشئ طلب تحويل ويرجع 201', async () => {
    // 1st: assertBranchOwnership(from), 2nd: assertBranchOwnership(to) [Promise.all]
    // 3rd: product select
    mockChainData
      .mockResolvedValueOnce([{ id: 2, name: 'فرع أ' }])
      .mockResolvedValueOnce([{ id: 3, name: 'فرع ب' }])
      .mockResolvedValueOnce([{ id: 10, name: 'منتج اختباري' }]);
    // db.execute → getBranchProductStock → stock=100 (already set via vi.fn.mockResolvedValue)

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 10, from_branch_id: 2, to_branch_id: 3, quantity: 5 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('status', 'pending');
    expect(res.body).toHaveProperty('message');
  });

  it('يجب أن يرجع 400 عند غياب الحقول المطلوبة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ quantity: 5 }); // missing product_id, from_branch_id, to_branch_id

    expect(res.status).toBe(400);
  });

  it('يجب أن يرجع 403 للمستخدم بدون صلاحية can_view_inventory', async () => {
    setUser(employeeUser);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 10, from_branch_id: 2, to_branch_id: 3, quantity: 5 });

    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 403 عند عدم انتماء فرع المصدر للشركة', async () => {
    // from_branch not found → assertBranchOwnership throws 403
    mockChainData
      .mockResolvedValueOnce([]) // from_branch: empty → 403
      .mockResolvedValueOnce([{ id: 3, name: 'فرع ب' }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 10, from_branch_id: 99, to_branch_id: 3, quantity: 5 });

    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 عند عدم كفاية المخزون في فرع الإرسال', async () => {
    mockChainData
      .mockResolvedValueOnce([{ id: 2, name: 'فرع أ' }])
      .mockResolvedValueOnce([{ id: 3, name: 'فرع ب' }])
      .mockResolvedValueOnce([{ id: 10, name: 'منتج اختباري' }]);

    // Override db.execute to report insufficient stock (only 2, requesting 5)
    const { db } = await import('@workspace/db');
    (db as unknown as { execute: ReturnType<typeof vi.fn> }).execute.mockResolvedValueOnce({
      rows: [{ stock: '2' }],
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 10, from_branch_id: 2, to_branch_id: 3, quantity: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/المخزون غير كافٍ/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/approve/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/transfers/approve/:id', () => {
  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    // Default: transfer found (pending) + update succeeds
    mockChainData.mockResolvedValue([mockTransfer]); // fetch transfer → pending
    mockUpdateReturning.mockResolvedValue([approvedTransfer]);
  });

  it('يجب أن يعتمد الطلب ويرجع 200', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'approved');
    expect(res.body).toHaveProperty('message');
  });

  it('يجب أن يرجع 404 عند عدم وجود التحويل', async () => {
    mockChainData.mockResolvedValueOnce([]); // first select → not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });

  it('يجب أن يرجع 409 عند محاولة اعتماد تحويل غير معلّق', async () => {
    mockChainData.mockResolvedValueOnce([approvedTransfer]); // status: 'approved' ≠ 'pending'

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/لا يمكن الاعتماد/);
  });

  it('يجب أن يرجع 400 لمعرّف غير رقمي', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/abc')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/ship/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/transfers/ship/:id', () => {
  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    mockChainData.mockResolvedValue([]);
    mockUpdateReturning.mockResolvedValue([shippedTransfer]);
  });

  it('يجب أن يشحن التحويل المعتمد ويرجع 200', async () => {
    // Sequence of db.select() calls during ship:
    //   1. outer: fetch transfer (approved)
    //   2. inside tx: getPrimaryWarehouseId → db.select (not tx.select)
    mockChainData
      .mockResolvedValueOnce([approvedTransfer]) // 1st select: fetch transfer
      .mockResolvedValueOnce([{ id: 5 }]); // 2nd select: getPrimaryWarehouseId
    // tx.execute already returns { rows: [{ stock: '100' }] } → 100 ≥ 5 ✓
    // mockUpdateReturning → [shippedTransfer] ✓

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'shipped');
    expect(res.body).toHaveProperty('message');
  });

  it('يجب أن يرجع 403 للمستخدم بدون صلاحية', async () => {
    setUser(employeeUser);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 404 عند عدم وجود التحويل', async () => {
    mockChainData.mockResolvedValueOnce([]); // transfer not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });

  it('يجب أن يرجع 409 عند محاولة شحن تحويل غير معتمد', async () => {
    mockChainData.mockResolvedValueOnce([mockTransfer]); // status: 'pending' ≠ 'approved'

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/لا يمكن الشحن/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/confirm/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/transfers/confirm/:id', () => {
  const shippedWithCode = { ...shippedTransfer, verification_code: '123456' };

  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    mockChainData.mockResolvedValue([]);
    mockUpdateReturning.mockResolvedValue([receivedTransfer]);
  });

  it('يجب أن يؤكد الاستلام برمز التحقق الصحيح ويرجع 200', async () => {
    // 1st: fetch transfer (shipped + code)
    // 2nd: getPrimaryWarehouseId inside tx
    mockChainData.mockResolvedValueOnce([shippedWithCode]).mockResolvedValueOnce([{ id: 6 }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'received');
    expect(res.body).toHaveProperty('message');
  });

  it('يجب أن يرجع 400 عند رمز تحقق خاطئ', async () => {
    mockChainData.mockResolvedValueOnce([shippedWithCode]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '000000' }); // wrong code

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/رمز التحقق غير صحيح/);
  });

  it('يجب أن يرجع 400 عند غياب verification_code من الـ body', async () => {
    mockChainData.mockResolvedValueOnce([shippedWithCode]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('يجب أن يرجع 409 عند محاولة تأكيد تحويل غير مشحون', async () => {
    mockChainData.mockResolvedValueOnce([approvedTransfer]); // status: 'approved' ≠ 'shipped'

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '123456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/لا يمكن التأكيد/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/cancel/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/transfers/cancel/:id', () => {
  const cancelledTransfer = { ...mockTransfer, status: 'cancelled' };

  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    // Default: pending transfer found + update succeeds
    mockChainData.mockResolvedValue([mockTransfer]);
    mockUpdateReturning.mockResolvedValue([cancelledTransfer]);
  });

  it('يجب أن يلغي تحويلاً معلّقاً ويرجع 200', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'cancelled');
    expect(res.body).toHaveProperty('message');
  });

  it('يجب أن يلغي تحويلاً معتمداً (approved) ويرجع 200', async () => {
    mockChainData.mockResolvedValueOnce([approvedTransfer]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });

  it('يجب أن يرجع 409 عند محاولة إلغاء تحويل مشحون', async () => {
    mockChainData.mockResolvedValueOnce([shippedTransfer]); // shipped → can't cancel

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/لا يمكن إلغاء/);
  });

  it('يجب أن يرجع 404 عند عدم وجود التحويل', async () => {
    mockChainData.mockResolvedValueOnce([]); // not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transfers
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/transfers', () => {
  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    mockChainData.mockResolvedValue([mockTransfer]);
  });

  it('يجب أن يرجع 200 مع قائمة التحويلات', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/transfers').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('يجب أن يرجع 200 مع فلتر status=pending', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers?status=pending')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });

  it('يجب أن يرجع 400 لـ status غير صالح', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers?status=invalid_status')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
  });

  it('يجب أن يرجع 403 للمستخدم بدون صلاحية', async () => {
    setUser(employeeUser);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/transfers').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transfers/:id
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/transfers/:id', () => {
  beforeEach(() => {
    resetMocks();
    setUser(adminUser);
    mockChainData.mockResolvedValue([mockTransfer]);
  });

  it('يجب أن يرجع 200 مع بيانات التحويل', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('quantity', 5); // formatted from '5' string
  });

  it('يجب أن يرجع 404 عند عدم وجود التحويل', async () => {
    mockChainData.mockResolvedValueOnce([]); // override: not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });

  it('يجب أن يرجع 403 للمستخدم بدون صلاحية', async () => {
    setUser(employeeUser);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 لمعرّف غير رقمي', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/abc')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
  });
});
