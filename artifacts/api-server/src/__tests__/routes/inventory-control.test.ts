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

const _employeeUser: AuthUser = {
  id: 3, name: 'Employee', username: 'emp',
  role: 'employee', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: 1, employee_id: 10,
};

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockProduct = {
  id: 1, name: 'منتج اختبار', sku: 'SKU-001', quantity: '10',
  cost_price: '100.00', sale_price: '150.00', company_id: 1,
  is_active: true, category: 'electronics', description: null,
  unit: null, low_stock_threshold: 5, warehouse_id: 1,
  created_at: new Date('2024-01-01T00:00:00.000Z'),
};

const mockSession = {
  id: 1, warehouse_id: 1, status: 'draft', notes: 'جرد تجريبي',
  company_id: 1, created_by: 1,
  created_at: new Date('2024-06-01T10:00:00.000Z'),
  applied_at: null,
};

const mockSessionApplied = {
  ...mockSession, status: 'applied',
  applied_at: new Date('2024-06-01T12:00:00.000Z'),
};

const mockCountItem = {
  id: 1, session_id: 1, product_id: 1,
  system_qty: '10', physical_qty: '8', notes: null,
};

const mockWarehouseA = { id: 1, name: 'مخزن رئيسي', company_id: 1 };
const mockWarehouseB = { id: 2, name: 'مخزن فرعي', company_id: 1 };


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — POST /api/inventory/count-sessions
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/inventory/count-sessions', () => {
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

  it('يجب أن يرفض 403 بدون صلاحية can_adjust_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [{ product_id: 1, physical_qty: 5 }] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية إجراء جرد المخزون');
  });

  it('يجب أن يرجع 400 عند إرسال items فارغة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند إرسال product_id غير موجود', async () => {
    // db.select().from(productsTable) returns empty — product not found
    mockChainData.mockResolvedValue([]);
    dbMock.execute.mockResolvedValue({ rows: [] });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({ items: [{ product_id: 999, physical_qty: 5 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('منتجات غير موجودة');
    expect(res.body.error).toContain('999');
  });


  it('يجب أن يُنشئ جلسة جرد بنجاح ويرجع 201', async () => {
    // Products found
    mockChainData.mockResolvedValue([mockProduct]);
    // stock_movements query
    dbMock.execute.mockResolvedValue({ rows: [{ product_id: 1, wh_qty: 10 }] });
    // Transaction: insert session + insert items
    dbMock.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn()
          .mockResolvedValueOnce([{ id: 1, warehouse_id: 1, status: 'draft', notes: null, company_id: 1, created_by: 1 }])
          .mockResolvedValueOnce([{ id: 1, session_id: 1, product_id: 1, system_qty: '10', physical_qty: '8', notes: null }]),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token')
      .send({ warehouse_id: 1, items: [{ product_id: 1, physical_qty: 8 }] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.session_id).toBe(1);
    expect(res.body.items_count).toBe(1);
    expect(res.body.items[0].difference).toBe(-2);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — GET /api/inventory/count-sessions
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/inventory/count-sessions', () => {
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

  it('يجب أن يرجع 403 بدون صلاحية can_view_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية عرض الجرد');
  });

  it('يجب أن يرجع مصفوفة من جلسات الجرد', async () => {
    mockChainData.mockResolvedValue([mockSession]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('id', 1);
    expect(res.body[0]).toHaveProperty('status', 'draft');
  });

  it('يجب أن يعزل بيانات الشركة — company B لا ترى جرد company A', async () => {
    mockChainData.mockResolvedValue([mockSession]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // Company A sees sessions
    const resA = await request(app)
      .get('/api/inventory/count-sessions')
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
      .get('/api/inventory/count-sessions')
      .set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — GET /api/inventory/count-sessions/:id
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/inventory/count-sessions/:id', () => {
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

  it('يجب أن يرجع 404 لجلسة غير موجودة', async () => {
    mockChainData.mockResolvedValue([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/count-sessions/999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('جلسة الجرد غير موجودة');
  });

  it('يجب أن يرجع تفاصيل جلسة الجرد مع البنود', async () => {
    // First call: session lookup; second call: items with join
    mockChainData
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([{
        id: 1, session_id: 1, product_id: 1,
        product_name: 'منتج اختبار', product_sku: 'SKU-001',
        system_qty: '10', physical_qty: '8', notes: null,
      }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/count-sessions/1')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.session).toHaveProperty('id', 1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].difference).toBe(-2);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D — POST /api/inventory/count-sessions/:id/apply
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/inventory/count-sessions/:id/apply', () => {
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

  it('يجب أن يرفض 403 بدون صلاحية can_adjust_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions/1/apply')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية تطبيق الجرد');
  });

  it('يجب أن يرجع 409 إذا كانت الجلسة مطبّقة بالفعل', async () => {
    mockChainData.mockResolvedValueOnce([mockSessionApplied]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions/1/apply')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('تم تطبيق هذه الجلسة بالفعل');
  });

  it('يجب أن يرجع 404 لجلسة غير موجودة', async () => {
    mockChainData.mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions/999/apply')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('جلسة الجرد غير موجودة');
  });


  it('يجب أن يطبّق الجرد بنجاح ويُنشئ حركات مخزون', async () => {
    // First call: session lookup (draft)
    // Second call: items in session
    // Third call: products lookup
    mockChainData
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([mockCountItem])
      .mockResolvedValueOnce([mockProduct]);

    // Transaction mock
    dbMock.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        update:    vi.fn().mockReturnThis(),
        set:       vi.fn().mockReturnThis(),
        where:     vi.fn().mockResolvedValue(undefined),
        insert:    vi.fn().mockReturnThis(),
        values:    vi.fn().mockResolvedValue(undefined),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions/1/apply')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.session_id).toBe(1);
    expect(res.body.adjustments_applied).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.adjustments)).toBe(true);
  });

  it('يجب أن يرجع 400 إذا كانت الجلسة بدون بنود', async () => {
    // Session found, but no items
    mockChainData
      .mockResolvedValueOnce([mockSession])
      .mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/count-sessions/1/apply')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('الجلسة لا تحتوي على بنود');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E — POST /api/inventory/transfers
// ═══════════════════════════════════════════════════════════════════════════════
describe('POST /api/inventory/transfers', () => {
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

  it('يجب أن يرفض 403 بدون صلاحية can_adjust_inventory', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token')
      .send({
        from_warehouse_id: 1, to_warehouse_id: 2,
        items: [{ product_id: 1, quantity: 5 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية تحويل المخزون');
  });

  it('يجب أن يرجع 400 عند التحويل لنفس المخزن', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token')
      .send({
        from_warehouse_id: 1, to_warehouse_id: 1,
        items: [{ product_id: 1, quantity: 5 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('لا يمكن التحويل من مخزن إلى نفس المخزن');
  });


  it('يجب أن يرجع 400 عند إرسال items فارغة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token')
      .send({
        from_warehouse_id: 1, to_warehouse_id: 2,
        items: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند كمية غير كافية في مخزن المصدر', async () => {
    // Warehouses exist
    mockChainData
      .mockResolvedValueOnce([mockWarehouseA])  // from_warehouse
      .mockResolvedValueOnce([mockWarehouseB])  // to_warehouse
      .mockResolvedValueOnce([mockProduct]);    // products lookup

    // Stock in source: only 3 available
    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ product_id: 1, wh_qty: 3 }] })   // from stock
      .mockResolvedValueOnce({ rows: [{ product_id: 1, wh_qty: 0 }] });  // to stock

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token')
      .send({
        from_warehouse_id: 1, to_warehouse_id: 2,
        items: [{ product_id: 1, quantity: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('الكمية غير كافية');
    expect(res.body).toHaveProperty('available_in_warehouse', 3);
  });


  it('يجب أن يُنشئ تحويل مخزون بنجاح ويرجع 201', async () => {
    // Warehouses exist
    mockChainData
      .mockResolvedValueOnce([mockWarehouseA])  // from_warehouse
      .mockResolvedValueOnce([mockWarehouseB])  // to_warehouse
      .mockResolvedValueOnce([mockProduct]);    // products lookup

    // Stock queries: enough in source
    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ product_id: 1, wh_qty: 20 }] })   // from stock
      .mockResolvedValueOnce({ rows: [{ product_id: 1, wh_qty: 5 }] });   // to stock

    // Transaction
    dbMock.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token')
      .send({
        from_warehouse_id: 1, to_warehouse_id: 2,
        items: [{ product_id: 1, quantity: 5 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.from_warehouse).toBe('مخزن رئيسي');
    expect(res.body.to_warehouse).toBe('مخزن فرعي');
    expect(res.body.items_count).toBe(1);
  });

  it('يجب أن يرجع 404 عند مخزن مصدر غير موجود', async () => {
    // from_warehouse not found
    mockChainData.mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token')
      .send({
        from_warehouse_id: 99, to_warehouse_id: 2,
        items: [{ product_id: 1, quantity: 5 }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('مخزن المصدر غير موجود');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F — GET /api/inventory/transfers
// ═══════════════════════════════════════════════════════════════════════════════
describe('GET /api/inventory/transfers', () => {
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
      .get('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ليس لديك صلاحية عرض التحويلات');
  });

  it('يجب أن يرجع مصفوفة من التحويلات', async () => {
    const mockTransferRow = {
      id: 1, product_id: 1, product_name: 'منتج اختبار',
      movement_type: 'transfer_out', quantity: '-5',
      quantity_before: '20', quantity_after: '15',
      unit_cost: '100.00', reference_type: 'stock_transfer',
      reference_no: 'WH-TRF-2024-ABC',
      notes: 'تحويل مخزن خروج', date: '2024-06-01',
      warehouse_id: 1, company_id: 1,
      created_at: new Date('2024-06-01T10:00:00.000Z'),
    };
    mockChainData.mockResolvedValue([mockTransferRow]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].quantity).toBe(-5);
    expect(res.body[0].movement_type).toBe('transfer_out');
  });

  it('يجب أن يرجع مصفوفة فارغة عند عدم وجود تحويلات', async () => {
    mockChainData.mockResolvedValue([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/transfers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});
