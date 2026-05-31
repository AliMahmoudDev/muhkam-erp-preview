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
    limit:     vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockReturnThis(),
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
vi.mock('../../lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
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
  nextReceiptVoucherNo:        vi.fn().mockResolvedValue('RV-2024-0001'),
  nextPaymentVoucherNo:        vi.fn().mockResolvedValue('PV-2024-0001'),
  nextDepositVoucherNo:        vi.fn().mockResolvedValue('DV-2024-0001'),
  nextPurchaseInvoiceNo:       vi.fn().mockResolvedValue('PUR-2024-0001'),
  nextInvoiceNo:               vi.fn().mockResolvedValue('INV-2024-0001'),
  nextSaleInvoiceNo:           vi.fn().mockResolvedValue('SAL-2024-0001'),
  nextDevicePurchaseInvoiceNo: vi.fn().mockResolvedValue('DPUR-2024-0001'),
}));
vi.mock('../../lib/warehouse-guard', () => ({
  resolveTenantWarehouseId: vi.fn().mockResolvedValue(1),
}));

vi.mock('../../lib/auto-account', () => ({
  getOrCreateInventoryAccount:       vi.fn().mockResolvedValue({ id: 10, code: 'INV-001', name: 'Inventory' }),
  getOrCreateSafeAccount:            vi.fn().mockResolvedValue({ id: 11, code: 'SAFE-001', name: 'Safe' }),
  getOrCreateCustomerPayableAccount: vi.fn().mockResolvedValue({ id: 12, code: 'AP-001', name: 'AP' }),
  getOrCreateVatInputAccount:        vi.fn().mockResolvedValue({ id: 13, code: 'VAT-IN', name: 'VAT In' }),
  getOrCreateGeneralExpenseAccount:  vi.fn().mockResolvedValue({ id: 14, code: 'EXP-GEN', name: 'Expense' }),
  getOrCreateSalesRevenueAccount:    vi.fn().mockResolvedValue({ id: 20, code: 'REV-SALES', name: 'Revenue' }),
  getOrCreateCustomerAccount:        vi.fn().mockResolvedValue({ id: 21, code: 'AR-001', name: 'AR' }),
  getOrCreateCOGSAccount:            vi.fn().mockResolvedValue({ id: 22, code: 'EXP-COGS', name: 'COGS' }),
  getOrCreateVatPayableAccount:      vi.fn().mockResolvedValue({ id: 23, code: 'VAT-OUT', name: 'VAT Out' }),
  getOrCreateAccount:                vi.fn().mockResolvedValue({ id: 30, code: 'AUTO-001', name: 'Auto' }),
  getOrCreateMiscRevenueAccount:     vi.fn().mockResolvedValue({ id: 31, code: 'REV-MISC', name: 'Misc Rev' }),
  createJournalEntry:                vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry:            vi.fn().mockResolvedValue({ id: 101 }),
}));
vi.mock('../../lib/ledger-balance', () => ({
  getCustomerLedgerBalance: vi.fn().mockResolvedValue(0),
}));
vi.mock('../../lib/cache', () => ({
  getCache:    vi.fn().mockResolvedValue(null),
  setCache:    vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));


// ── Imports after mocks ───────────────────────────────────────────────────────
import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { db } from '@workspace/db';

const dbMock = db as unknown as {
  transaction: ReturnType<typeof vi.fn>;
  returning:   ReturnType<typeof vi.fn>;
  execute:     ReturnType<typeof vi.fn>;
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
const mockReceiptVoucher = {
  id: 1, voucher_no: 'RV-2024-0001', date: '2024-01-20',
  customer_id: null, customer_name: 'عميل اختبار',
  safe_id: 1, safe_name: 'خزينة رئيسية',
  amount: '500.00', notes: null, request_id: null,
  posting_status: 'draft', company_id: 1,
  created_at: new Date('2024-01-20T10:00:00.000Z'),
};

const mockPaymentVoucher = {
  id: 1, voucher_no: 'PV-2024-0001', date: '2024-01-20',
  customer_id: null, customer_name: 'عميل اختبار',
  safe_id: 1, safe_name: 'خزينة رئيسية',
  amount: '300.00', notes: null, request_id: null,
  posting_status: 'draft', company_id: 1,
  created_at: new Date('2024-01-20T10:00:00.000Z'),
};

const mockDepositVoucher = {
  id: 1, voucher_no: 'DV-2024-0001', date: '2024-02-10',
  customer_id: null, customer_name: null,
  safe_id: 1, safe_name: 'خزينة رئيسية',
  amount: '1000.00', source: 'تحويل بنكي', notes: null, request_id: null,
  posting_status: 'draft', company_id: 1,
  created_at: new Date('2024-02-10T08:00:00.000Z'),
};


// ═══════════════════════════════════════════════════════════════════════════════
// سندات القبض — سيناريوهات إضافية
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/receipt-vouchers — سيناريوهات إضافية', () => {
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

  it('يجب أن يرفض 403 بدون صلاحية can_add_receipt_voucher', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/receipt-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ customer_name: 'عميل', safe_id: 1, amount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح بإضافة سندات قبض');
  });

  it('يجب أن يرجع 201 عند إنشاء سند قبض — المبلغ يدخل الخزينة', async () => {
    dbMock.transaction.mockResolvedValueOnce(mockReceiptVoucher);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/receipt-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ customer_name: 'عميل اختبار', safe_id: 1, amount: 500, date: '2024-01-20' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('amount', 500);
    expect(res.body).toHaveProperty('safe_name', 'خزينة رئيسية');
  });

  it('يجب أن يرجع 400 عند عدم إرسال الحقول المطلوبة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/receipt-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });


  it('يجب أن يرجع 400 عند خزينة غير موجودة', async () => {
    // Transaction where safe lookup returns empty
    dbMock.transaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        select:    vi.fn().mockReturnThis(),
        from:      vi.fn().mockReturnThis(),
        where:     vi.fn().mockResolvedValue([]),
        insert:    vi.fn().mockReturnThis(),
        values:    vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update:    vi.fn().mockReturnThis(),
        set:       vi.fn().mockReturnThis(),
        limit:     vi.fn().mockResolvedValue([]),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/receipt-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ customer_name: 'عميل', safe_id: 999, amount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('الخزينة غير موجودة');
  });

  it('يجب أن يعزل بيانات الشركة — tenant isolation', async () => {
    mockChainData.mockResolvedValueOnce([mockReceiptVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // Company A sees vouchers
    const resA = await request(app)
      .get('/api/receipt-vouchers')
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
      .get('/api/receipt-vouchers')
      .set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });

  it('يجب أن يرجع مصفوفة عند GET /api/receipt-vouchers', async () => {
    mockChainData.mockResolvedValue([mockReceiptVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/receipt-vouchers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// سندات الصرف — سيناريوهات إضافية
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/payment-vouchers — سيناريوهات إضافية', () => {
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

  it('يجب أن يرفض 403 بدون صلاحية can_add_payment_voucher', async () => {
    mockHasPermission.mockReturnValue(false);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payment-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ customer_name: 'عميل', safe_id: 1, amount: 200 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح بإضافة سندات صرف');
  });

  it('يجب أن يرجع 201 عند إنشاء سند صرف — المبلغ يخرج من الخزينة', async () => {
    dbMock.transaction.mockResolvedValueOnce(mockPaymentVoucher);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payment-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ customer_name: 'عميل اختبار', safe_id: 1, amount: 300, date: '2024-01-20' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('amount', 300);
    expect(res.body).toHaveProperty('safe_name', 'خزينة رئيسية');
  });

  it('يجب أن يرجع 400 عند عدم إرسال الحقول المطلوبة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payment-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });


  it('يجب أن يرجع 400 عند خزينة غير موجودة', async () => {
    // Transaction where safe lookup returns empty
    dbMock.transaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        select:    vi.fn().mockReturnThis(),
        from:      vi.fn().mockReturnThis(),
        where:     vi.fn().mockResolvedValue([]),
        insert:    vi.fn().mockReturnThis(),
        values:    vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update:    vi.fn().mockReturnThis(),
        set:       vi.fn().mockReturnThis(),
        limit:     vi.fn().mockResolvedValue([]),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payment-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ customer_name: 'عميل', safe_id: 999, amount: 200 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('الخزينة غير موجودة');
  });

  it('يجب أن يعزل بيانات الشركة — tenant isolation', async () => {
    mockChainData.mockResolvedValueOnce([mockPaymentVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // Company A sees vouchers
    const resA = await request(app)
      .get('/api/payment-vouchers')
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
      .get('/api/payment-vouchers')
      .set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });

  it('يجب أن يرجع مصفوفة عند GET /api/payment-vouchers', async () => {
    mockChainData.mockResolvedValue([mockPaymentVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/payment-vouchers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// سندات التوريد (الإيداع) — تغطية كاملة
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/deposit-vouchers', () => {
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

  it('يجب أن يرجع 200 ومصفوفة سندات التوريد', async () => {
    mockChainData.mockResolvedValue([mockDepositVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('voucher_no', 'DV-2024-0001');
  });

  it('يجب أن يرجع مصفوفة فارغة بدون سندات', async () => {
    mockChainData.mockResolvedValue([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });


  it('يجب أن يعزل بيانات الشركة — company B لا ترى سندات company A', async () => {
    mockChainData.mockResolvedValueOnce([mockDepositVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // Company A sees deposit vouchers
    const resA = await request(app)
      .get('/api/deposit-vouchers')
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
      .get('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});


describe('POST /api/deposit-vouchers', () => {
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

  it('يجب أن يرجع 400 عند عدم إرسال الحقول المطلوبة (بدون safe_id أو amount)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند مبلغ صفر أو سالب', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ safe_id: 1, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 201 عند إنشاء سند توريد بنجاح', async () => {
    dbMock.transaction.mockResolvedValueOnce(mockDepositVoucher);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ safe_id: 1, amount: 1000, source: 'تحويل بنكي', date: '2024-02-10' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 1);
    expect(res.body).toHaveProperty('amount', 1000);
    expect(res.body).toHaveProperty('safe_name', 'خزينة رئيسية');
  });


  it('يجب أن يرجع 400 عند خزينة غير موجودة', async () => {
    // Transaction where safe lookup returns empty
    dbMock.transaction.mockImplementationOnce(async (fn: any) => {
      const tx = {
        select:    vi.fn().mockReturnThis(),
        from:      vi.fn().mockReturnThis(),
        where:     vi.fn().mockResolvedValue([]),
        insert:    vi.fn().mockReturnThis(),
        values:    vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update:    vi.fn().mockReturnThis(),
        set:       vi.fn().mockReturnThis(),
        limit:     vi.fn().mockResolvedValue([]),
      };
      return fn(tx);
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ safe_id: 999, amount: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('الخزينة غير موجودة');
  });

  it('يجب أن يعزل بيانات الشركة — tenant isolation عند الإنشاء', async () => {
    // Deposit voucher belongs to company 1
    dbMock.transaction.mockResolvedValueOnce(mockDepositVoucher);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token')
      .send({ safe_id: 1, amount: 1000, date: '2024-02-10' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('company_id', 1);
  });

  it('يجب أن يرجع مصفوفة عند GET /api/deposit-vouchers', async () => {
    mockChainData.mockResolvedValue([mockDepositVoucher]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/deposit-vouchers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
