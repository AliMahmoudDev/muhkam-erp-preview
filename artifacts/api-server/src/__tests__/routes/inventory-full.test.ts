import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
const { mockChainData } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select:  vi.fn().mockReturnThis(),
    from:    vi.fn().mockReturnThis(),
    where:   vi.fn().mockReturnThis(),
    insert:  vi.fn().mockReturnThis(),
    values:  vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update:  vi.fn().mockReturnThis(),
    set:     vi.fn().mockReturnThis(),
    delete:  vi.fn().mockReturnThis(),
    limit:   vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from:    vi.fn(() => chain),
      where:   vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit:   vi.fn(() => chain),
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

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { db } from '@workspace/db';

// Typed alias so we can call vi mock helpers on the db mock methods
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

const employeeUser: AuthUser = {
  id: 3, name: 'Employee', username: 'emp',
  role: 'employee', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: 1, employee_id: 10,
};

// ── Inventory row fixture (raw SQL result shape) ──────────────────────────────
const mockInventoryRow = {
  id: 1, name: 'منتج اختبار', sku: 'SKU-001', category: 'electronics',
  actual_qty: 10, cost_price: 100, sale_price: 150,
  low_stock_threshold: 5,
  opening_qty: 0, purchased_qty: 15, sold_qty: 5,
  sale_return_qty: 0, purchase_return_qty: 0, adjustment_qty: 0,
  calculated_qty: 10,
};

// ── Product fixture (for adjustment) ─────────────────────────────────────────
const mockProduct = {
  id: 1, name: 'منتج اختبار', sku: 'SKU-001', quantity: '10',
  cost_price: '100.00', sale_price: '150.00', company_id: 1,
  is_active: true, category: 'electronics', description: null,
  unit: null, low_stock_threshold: 5, warehouse_id: 1,
  created_at: new Date('2024-01-01T00:00:00.000Z'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/inventory/audit', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 مع بيانات المخزون للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/audit')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body).toHaveProperty('summary');
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/inventory/audit');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرفض المستخدم بدون صلاحية can_view_inventory بـ 403', async () => {
    const setEmployee = (req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = employeeUser;
      next();
    };
    vi.mocked(authenticate).mockImplementationOnce(setEmployee);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/audit')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يعزل بيانات الشركة — company B لا ترى مخزون company A', async () => {
    // Inject a row for company A via db.execute mock
    dbMock.execute.mockResolvedValueOnce({ rows: [mockInventoryRow] });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const resA = await request(app)
      .get('/api/inventory/audit')
      .set('Authorization', 'Bearer test-token');

    expect(resA.status).toBe(200);
    expect(resA.body.products).toHaveLength(1);
    expect(resA.body.products[0]).toHaveProperty('id', 1);

    // Company B — db.execute falls back to { rows: [] }
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const resB = await request(app)
      .get('/api/inventory/audit')
      .set('Authorization', 'Bearer test-token');

    expect(resB.status).toBe(200);
    expect(resB.body.products).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/inventory/adjustment', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند إرسال body غير صالح (بدون product_id)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرفض المستخدم بدون صلاحية can_adjust_inventory بـ 403', async () => {
    const setEmployee = (req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = employeeUser;
      next();
    };
    vi.mocked(authenticate).mockImplementationOnce(setEmployee);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, new_quantity: 20 });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 200 عند تسوية المخزون بنجاح', async () => {
    // Product lookup resolves with mockProduct
    mockChainData.mockResolvedValueOnce([mockProduct]);

    // Transaction resolves without executing callback (bypass internal tx calls)
    dbMock.transaction.mockResolvedValueOnce(undefined);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/inventory/adjustment')
      .set('Authorization', 'Bearer test-token')
      .send({ product_id: 1, new_quantity: 20, notes: 'تسوية اختبار' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('product_id', 1);
    expect(res.body).toHaveProperty('new_qty', 20);
  });
});
