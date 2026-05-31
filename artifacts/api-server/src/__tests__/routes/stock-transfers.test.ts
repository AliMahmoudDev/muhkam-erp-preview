import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
const { mockChainData, mockHasPermission } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockHasPermission: vi.fn().mockReturnValue(true),
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
    limit:     vi.fn().mockResolvedValue([]),
    orderBy:   vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    execute:   vi.fn().mockResolvedValue({ rows: [] }),
  };


  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from:      vi.fn(() => chain),
      where:     vi.fn(() => chain),
      orderBy:   vi.fn(() => chain),
      limit:     vi.fn(() => chain),
      offset:    mockChainData,
      innerJoin: vi.fn(() => chain),
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
    devicesTable:                    {} as Record<string, never>,
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
    notificationsTable:              {} as Record<string, never>,
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
    warrantyTable:                   {} as Record<string, never>,
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
vi.mock('../../lib/period-lock', () => ({
  assertPeriodOpen:           vi.fn().mockResolvedValue(undefined),
  invalidateClosingDateCache: vi.fn(),
}));
vi.mock('../../lib/backup-service', () => ({
  triggerBackup:  vi.fn().mockResolvedValue(undefined),
  scheduleBackup: vi.fn(),
}));
vi.mock('../../lib/alert-service', () => ({
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
  getOrCreateInventoryAccount:         vi.fn().mockResolvedValue({ id: 10, code: 'INV-001', name: 'Inventory' }),
  getOrCreateSafeAccount:              vi.fn().mockResolvedValue({ id: 11, code: 'SAFE-001', name: 'Safe' }),
  getOrCreateCustomerPayableAccount:   vi.fn().mockResolvedValue({ id: 12, code: 'AP-001', name: 'AP' }),
  getOrCreateVatInputAccount:          vi.fn().mockResolvedValue({ id: 13, code: 'VAT-IN', name: 'VAT In' }),
  getOrCreateGeneralExpenseAccount:    vi.fn().mockResolvedValue({ id: 14, code: 'EXP-GEN', name: 'Expense' }),
  getOrCreateSalesRevenueAccount:      vi.fn().mockResolvedValue({ id: 20, code: 'REV-SALES', name: 'Revenue' }),
  getOrCreateCustomerAccount:          vi.fn().mockResolvedValue({ id: 21, code: 'AR-001', name: 'AR' }),
  getOrCreateCOGSAccount:              vi.fn().mockResolvedValue({ id: 22, code: 'EXP-COGS', name: 'COGS' }),
  getOrCreateVatPayableAccount:        vi.fn().mockResolvedValue({ id: 23, code: 'VAT-OUT', name: 'VAT Out' }),
  getOrCreateAccount:                  vi.fn().mockResolvedValue({ id: 30, code: 'AUTO-001', name: 'Auto' }),
  createJournalEntry:                  vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry:              vi.fn().mockResolvedValue({ id: 101 }),
}));
vi.mock('../../lib/ledger-balance', () => ({
  getCustomerLedgerBalance: vi.fn().mockResolvedValue(0),
}));
vi.mock('../../middleware/feature-guard', () => ({
  requireFeature:         vi.fn(() => vi.fn((_req: Request, _res: Response, next: NextFunction) => next())),
  invalidateFeatureCache: vi.fn(),
}));
vi.mock('../../lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));


// ── Imports after mocks ───────────────────────────────────────────────────────
import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { db } from '@workspace/db';

// Typed alias for db mock methods
const dbMock = db as unknown as {
  execute:     ReturnType<typeof vi.fn>;
  returning:   ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
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

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockBranchA = { id: 1, name: 'فرع الرياض', company_id: 1 };
const mockBranchB = { id: 2, name: 'فرع جدة', company_id: 1 };
const mockProduct = { id: 1, name: 'منتج اختبار', company_id: 1 };

const mockTransferPending = {
  id: 1, company_id: 1, product_id: 1, product_name: 'منتج اختبار',
  quantity: '10', from_branch_id: 1, to_branch_id: 2,
  status: 'pending', verification_code: '123456',
  created_by: 1, approved_by: null, shipped_by: null, received_by: null,
  notes: null,
  created_at: new Date('2024-06-01T10:00:00.000Z'),
  approved_at: null, shipped_at: null, received_at: null,
};


const mockTransferApproved = {
  ...mockTransferPending, status: 'approved',
  approved_by: 1, approved_at: new Date('2024-06-01T11:00:00.000Z'),
};

const mockTransferShipped = {
  ...mockTransferApproved, status: 'shipped',
  shipped_by: 1, shipped_at: new Date('2024-06-01T12:00:00.000Z'),
};

const mockTransferReceived = {
  ...mockTransferShipped, status: 'received',
  received_by: 1, received_at: new Date('2024-06-01T13:00:00.000Z'),
};


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — POST /api/transfers/request — إنشاء طلب تحويل
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/transfers/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, from_branch_id: 1, to_branch_id: 2, quantity: 5 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية إنشاء طلبات التحويل');
  });


  it('يجب أن يرجع 400 عند إرسال بيانات ناقصة (product_id مفقود)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ from_branch_id: 1, to_branch_id: 2, quantity: 5 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند إرسال كمية سالبة أو صفر', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, from_branch_id: 1, to_branch_id: 2, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند التحويل من نفس الفرع إلى نفسه', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, from_branch_id: 1, to_branch_id: 1, quantity: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('مختلفَين');
  });


  it('يجب أن يرجع 403 عند فرع إرسال لا ينتمي للشركة', async () => {
    // assertBranchOwnership throws 403 for from_branch
    mockChainData.mockResolvedValueOnce([]);  // from_branch not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, from_branch_id: 99, to_branch_id: 2, quantity: 5 });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('غير موجود أو لا ينتمي لشركتك');
  });

  it('يجب أن يرجع 404 عند منتج غير موجود', async () => {
    // Both branches found, product not found
    mockChainData
      .mockResolvedValueOnce([mockBranchA])   // from_branch
      .mockResolvedValueOnce([mockBranchB])   // to_branch
      .mockResolvedValueOnce([]);             // product not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 999, from_branch_id: 1, to_branch_id: 2, quantity: 5 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('المنتج غير موجود أو لا ينتمي لشركتك');
  });


  it('يجب أن يرجع 400 عند عدم كفاية المخزون في فرع المصدر', async () => {
    // Branches + product found
    mockChainData
      .mockResolvedValueOnce([mockBranchA])   // from_branch
      .mockResolvedValueOnce([mockBranchB])   // to_branch
      .mockResolvedValueOnce([mockProduct]);  // product found

    // Stock check: only 3 available, requesting 10
    dbMock.execute.mockResolvedValueOnce({ rows: [{ stock: 3 }] });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, from_branch_id: 1, to_branch_id: 2, quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('المخزون غير كافٍ');
  });

  it('يجب أن يُنشئ طلب تحويل بنجاح ويرجع 201', async () => {
    // Branches + product found
    mockChainData
      .mockResolvedValueOnce([mockBranchA])   // from_branch
      .mockResolvedValueOnce([mockBranchB])   // to_branch
      .mockResolvedValueOnce([mockProduct]);  // product found

    // Enough stock
    dbMock.execute.mockResolvedValueOnce({ rows: [{ stock: 50 }] });
    // Insert returning
    dbMock.returning.mockResolvedValueOnce([mockTransferPending]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/request')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, from_branch_id: 1, to_branch_id: 2, quantity: 10 });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('تم إنشاء طلب التحويل بنجاح');
    expect(res.body.status).toBe('pending');
    expect(res.body.quantity).toBe(10);
  });
});



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — POST /api/transfers/approve/:id — اعتماد الطلب
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/transfers/approve/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند معرّف غير صالح', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/abc')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('معرّف التحويل غير صالح');
  });

  it('يجب أن يرجع 404 عند طلب تحويل غير موجود', async () => {
    mockChainData.mockResolvedValueOnce([]);  // transfer not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('طلب التحويل غير موجود');
  });


  it('يجب أن يرجع 409 عند محاولة اعتماد تحويل ليس بحالة pending', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferApproved]);  // already approved

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('لا يمكن الاعتماد');
    expect(res.body.error).toContain('approved');
  });

  it('يجب أن يعتمد الطلب بنجاح ويرجع 200', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferPending]);  // transfer found

    // update().set().where().returning()
    dbMock.returning.mockResolvedValueOnce([mockTransferApproved]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/approve/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('تم اعتماد طلب التحويل');
    expect(res.body.status).toBe('approved');
  });
});



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — POST /api/transfers/ship/:id — شحن التحويل
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/transfers/ship/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية شحن التحويل');
  });

  it('يجب أن يرجع 404 عند طلب تحويل غير موجود', async () => {
    mockChainData.mockResolvedValueOnce([]);  // transfer not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('طلب التحويل غير موجود');
  });


  it('يجب أن يرجع 409 عند محاولة شحن تحويل ليس بحالة approved', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferPending]);  // status is pending

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('لا يمكن الشحن');
    expect(res.body.error).toContain('pending');
  });

  it('يجب أن يشحن التحويل بنجاح ويخصم المخزون', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferApproved]);  // approved transfer

    // Transaction mock: stock check + warehouse + insert movement + update status
    dbMock.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        execute:   vi.fn().mockResolvedValue({ rows: [{ stock: 50 }] }),
        select:    vi.fn().mockReturnThis(),
        from:      vi.fn().mockReturnThis(),
        where:     vi.fn().mockReturnThis(),
        limit:     vi.fn().mockResolvedValue([{ id: 1 }]),  // warehouse
        insert:    vi.fn().mockReturnThis(),
        values:    vi.fn().mockResolvedValue(undefined),
        update:    vi.fn().mockReturnThis(),
        set:       vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTransferShipped]),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('تم شحن التحويل وخصم المخزون من فرع الإرسال');
    expect(res.body.status).toBe('shipped');
  });


  it('يجب أن يرجع 400 عند عدم كفاية المخزون أثناء الشحن', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferApproved]);  // approved transfer

    // Transaction: stock insufficient
    dbMock.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [{ stock: 2 }] }),  // only 2 available
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/ship/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('المخزون غير كافٍ');
  });
});



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D — POST /api/transfers/confirm/:id — تأكيد الاستلام
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/transfers/confirm/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '123456' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية تأكيد الاستلام');
  });

  it('يجب أن يرجع 400 عند عدم إرسال رمز التحقق', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });


  it('يجب أن يرجع 404 عند طلب تحويل غير موجود', async () => {
    mockChainData.mockResolvedValueOnce([]);  // transfer not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/999')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '123456' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('طلب التحويل غير موجود');
  });

  it('يجب أن يرجع 409 عند محاولة تأكيد تحويل ليس بحالة shipped', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferApproved]);  // not shipped yet

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '123456' });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('لا يمكن التأكيد');
    expect(res.body.error).toContain('approved');
  });

  it('يجب أن يرجع 400 عند رمز تحقق خاطئ', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferShipped]);  // shipped

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('رمز التحقق غير صحيح');
  });


  it('يجب أن يؤكد الاستلام بنجاح ويضيف المخزون لفرع الوجهة', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferShipped]);  // shipped transfer

    // Transaction mock: stock query + warehouse + insert movement + update status
    dbMock.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        execute:   vi.fn().mockResolvedValue({ rows: [{ stock: 5 }] }),
        select:    vi.fn().mockReturnThis(),
        from:      vi.fn().mockReturnThis(),
        where:     vi.fn().mockReturnThis(),
        limit:     vi.fn().mockResolvedValue([{ id: 2 }]),  // to_warehouse
        insert:    vi.fn().mockReturnThis(),
        values:    vi.fn().mockResolvedValue(undefined),
        update:    vi.fn().mockReturnThis(),
        set:       vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTransferReceived]),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/confirm/1')
      .set('Authorization', 'Bearer test-token')
      .send({ verification_code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('تم استلام التحويل وإضافة المخزون لفرع الوجهة');
    expect(res.body.status).toBe('received');
  });
});



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E — POST /api/transfers/cancel/:id — إلغاء الطلب
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/transfers/cancel/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند معرّف غير صالح', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/xyz')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('معرّف التحويل غير صالح');
  });

  it('يجب أن يرجع 404 عند طلب تحويل غير موجود', async () => {
    mockChainData.mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('طلب التحويل غير موجود');
  });


  it('يجب أن يرجع 409 عند محاولة إلغاء تحويل بحالة shipped', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferShipped]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('لا يمكن إلغاء');
    expect(res.body.error).toContain('shipped');
  });

  it('يجب أن يلغي تحويل بحالة pending بنجاح', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferPending]);
    dbMock.returning.mockResolvedValueOnce([{ ...mockTransferPending, status: 'cancelled' }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('تم إلغاء طلب التحويل');
    expect(res.body.status).toBe('cancelled');
  });

  it('يجب أن يلغي تحويل بحالة approved بنجاح', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferApproved]);
    dbMock.returning.mockResolvedValueOnce([{ ...mockTransferApproved, status: 'cancelled' }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/transfers/cancel/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('تم إلغاء طلب التحويل');
    expect(res.body.status).toBe('cancelled');
  });
});



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F — GET /api/transfers — قائمة التحويلات
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية عرض التحويلات');
  });

  it('يجب أن يرجع مصفوفة من التحويلات', async () => {
    mockChainData.mockResolvedValue([mockTransferPending]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('id', 1);
    expect(res.body[0]).toHaveProperty('status', 'pending');
    expect(res.body[0].quantity).toBe(10);
  });


  it('يجب أن يرجع مصفوفة فارغة عند عدم وجود تحويلات', async () => {
    mockChainData.mockResolvedValue([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('يجب أن يرجع 400 عند قيمة status غير صالحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers?status=invalid_status')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status غير صالحة');
  });

  it('يجب أن يعزل بيانات الشركة — company B لا ترى تحويلات company A', async () => {
    mockChainData.mockResolvedValue([mockTransferPending]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // Company A sees transfers
    const resA = await request(app)
      .get('/api/transfers')
      .set('Authorization', 'Bearer test-token');
    expect(resA.status).toBe(200);
    expect(resA.body).toHaveLength(1);

    // Company B — empty
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const resB = await request(app)
      .get('/api/transfers')
      .set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION G — GET /api/transfers/:id — تفاصيل تحويل واحد
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/transfers/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainData.mockResolvedValue([]);
    mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرفض 403 بدون صلاحية can_view_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية عرض التحويل');
  });

  it('يجب أن يرجع 400 عند معرّف غير صالح', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/abc')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('معرّف التحويل غير صالح');
  });


  it('يجب أن يرجع 404 عند تحويل غير موجود', async () => {
    mockChainData.mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('طلب التحويل غير موجود');
  });

  it('يجب أن يرجع تفاصيل التحويل بنجاح', async () => {
    mockChainData.mockResolvedValueOnce([mockTransferShipped]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/transfers/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('status', 'shipped');
    expect(res.body).toHaveProperty('product_name', 'منتج اختبار');
    expect(res.body.quantity).toBe(10);
    expect(res.body).toHaveProperty('created_at');
    expect(res.body).toHaveProperty('shipped_at');
  });
});
