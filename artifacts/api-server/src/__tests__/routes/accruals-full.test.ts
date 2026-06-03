import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
const { mockChainData, mockTxReturning } = vi.hoisted(() => ({
  mockChainData:  vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockTxReturning: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select:    vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    insert:    vi.fn().mockReturnThis(),
    values:    vi.fn().mockReturnThis(),
    returning: mockTxReturning,
    update:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    delete:    vi.fn().mockReturnThis(),
    limit:     vi.fn().mockResolvedValue([]),
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
    accrualRunsTable:                  {} as Record<string, never>,
    accrualsTable:                     {} as Record<string, never>,
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
vi.mock('../../lib/audit-log',      () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/period-lock',    () => ({
  assertPeriodOpen:           vi.fn().mockResolvedValue(undefined),
  invalidateClosingDateCache: vi.fn(),
}));
vi.mock('../../lib/backup-service', () => ({
  triggerBackup:  vi.fn().mockResolvedValue(undefined),
  scheduleBackup: vi.fn(),
}));
vi.mock('../../lib/alert-service',  () => ({
  runAllChecks:        vi.fn().mockResolvedValue(undefined),
  checkHealthCritical: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../lib/invoice-no',     () => ({
  nextInvoiceNo:               vi.fn().mockResolvedValue('INV-2024-0001'),
  nextPurchaseInvoiceNo:       vi.fn().mockResolvedValue('PUR-2024-0001'),
  nextSaleInvoiceNo:           vi.fn().mockResolvedValue('SAL-2024-0001'),
  nextDevicePurchaseInvoiceNo: vi.fn().mockResolvedValue('DPUR-2024-0001'),
}));
vi.mock('../../lib/warehouse-guard', () => ({
  resolveTenantWarehouseId: vi.fn().mockResolvedValue(1),
}));
vi.mock('../../lib/auto-account', () => ({
  getOrCreateAccount:                  vi.fn().mockResolvedValue({ id: 30, code: 'AUTO-001', name: 'Auto Account', current_balance: '0' }),
  getOrCreateInventoryAccount:         vi.fn().mockResolvedValue({ id: 10, code: 'INV-001',  name: 'Inventory' }),
  getOrCreateSafeAccount:              vi.fn().mockResolvedValue({ id: 11, code: 'SAFE-001', name: 'Safe' }),
  getOrCreateCustomerPayableAccount:   vi.fn().mockResolvedValue({ id: 12, code: 'AP-001',   name: 'AP' }),
  getOrCreateVatInputAccount:          vi.fn().mockResolvedValue({ id: 13, code: 'VAT-IN',   name: 'VAT In' }),
  getOrCreateGeneralExpenseAccount:    vi.fn().mockResolvedValue({ id: 14, code: 'EXP-GEN',  name: 'Expense' }),
  getOrCreateSalesRevenueAccount:      vi.fn().mockResolvedValue({ id: 20, code: 'REV-SALES',name: 'Revenue' }),
  getOrCreateCustomerAccount:          vi.fn().mockResolvedValue({ id: 21, code: 'AR-001',   name: 'AR' }),
  getOrCreateCOGSAccount:              vi.fn().mockResolvedValue({ id: 22, code: 'EXP-COGS', name: 'COGS' }),
  getOrCreateVatPayableAccount:        vi.fn().mockResolvedValue({ id: 23, code: 'VAT-OUT',  name: 'VAT Out' }),
  createJournalEntry:                  vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry:              vi.fn().mockResolvedValue({ id: 101 }),
}));
vi.mock('../../lib/auto-customer',  () => ({
  findOrCreateCustomerByPhone: vi.fn().mockResolvedValue(null),
}));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';

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
const mockAccrual = {
  id: 7,
  type: 'prepayment',
  category: 'expense',
  description: 'إيجار مدفوع مقدماً',
  total_amount: '1200',
  months_total: 12,
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  expense_account_id: 14,
  prepaid_account_id: 30,
  amount_recognized: '0',
  status: 'active',
  company_id: 1,
  created_at: new Date('2024-01-01T00:00:00.000Z'),
};

const mockExpenseAcc = { id: 14, code: 'EXP-GENERAL', name: 'مصروفات عمومية', current_balance: '500', company_id: 1 };
const mockPrepaidAcc = { id: 30, code: 'ASSET-PREPAID-EXP', name: 'مصروفات مدفوعة مقدماً', current_balance: '1200', company_id: 1 };

const mockJournalEntry = {
  id: 100, entry_no: 'JE-00006', date: '2024-01-01',
  description: 'استحقاق مدفوع مقدماً - إيجار مدفوع مقدماً - 2024-01',
  status: 'posted', reference: 'ACC-7-2024-01',
  total_debit: '100', total_credit: '100', company_id: 1,
};

const mockAccrualRun = {
  id: 1, accrual_id: 7, period: '2024-01', amount: '100',
  entry_id: 100, company_id: 1,
  created_at: new Date('2024-01-15T00:00:00.000Z'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/accruals', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 ومصفوفة لمستخدم مصرح له', async () => {
    mockChainData.mockResolvedValueOnce([mockAccrual]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/accruals').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('يجب أن يرجع 401 بدون token', async () => {
    vi.mocked(authenticate).mockImplementationOnce((_req: Request, res: Response) => {
      res.status(401).json({ error: 'غير مصرح' });
    });

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/accruals');
    expect(res.status).toBe(401);
  });

  it('شركة B لا ترى استحقاقات شركة A (tenant isolation)', async () => {
    mockChainData.mockResolvedValueOnce([mockAccrual]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const resA = await request(app).get('/api/accruals').set('Authorization', 'Bearer test-token');
    expect(resA.status).toBe(200);
    expect(resA.body.length).toBeGreaterThanOrEqual(1);

    // Company B — returns []
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );
    const resB = await request(app).get('/api/accruals').set('Authorization', 'Bearer test-token');
    expect(resB.status).toBe(200);
    expect(resB.body).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/accruals', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    mockTxReturning.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 201 عند إنشاء استحقاق بنجاح', async () => {
    const { db } = await import('@workspace/db');
    vi.mocked(db.returning).mockResolvedValueOnce([mockAccrual]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/accruals')
      .set('Authorization', 'Bearer test-token')
      .send({
        type: 'prepayment', category: 'expense',
        description: 'إيجار مدفوع مقدماً',
        total_amount: 1200, months_total: 12,
        start_date: '2024-01-01', end_date: '2024-12-31',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('يجب أن يرجع 400 عند غياب حقل مطلوب', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/accruals')
      .set('Authorization', 'Bearer test-token')
      .send({ type: 'prepayment', category: 'expense' }); // missing description + amounts

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند نوع غير صالح', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/accruals')
      .set('Authorization', 'Bearer test-token')
      .send({
        type: 'invalid_type', category: 'expense',
        description: 'test', total_amount: 100, months_total: 6,
        start_date: '2024-01-01', end_date: '2024-06-30',
      });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/accruals/:id/recognize — Transaction Atomicity
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/accruals/:id/recognize', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    mockTxReturning.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن ينفذ التسجيل الشهري بنجاح داخل transaction واحدة', async () => {
    // SELECT accrual → found
    // SELECT existing run → none (allow)
    // SELECT expenseAcc
    // SELECT prepaidAcc
    // SELECT count for entryNo
    mockChainData
      .mockResolvedValueOnce([mockAccrual])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockExpenseAcc])
      .mockResolvedValueOnce([mockPrepaidAcc])
      .mockResolvedValueOnce([{ total: 5 }]);

    // tx writes:
    // tx.insert(journalEntriesTable).returning() → mockJournalEntry
    // tx.insert(accrualRunsTable).returning()    → mockAccrualRun
    mockTxReturning
      .mockResolvedValueOnce([mockJournalEntry])
      .mockResolvedValueOnce([mockAccrualRun]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const { db } = await import('@workspace/db');

    vi.mocked(db.transaction).mockClear();

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({ period: '2024-01' });

    expect(res.status).toBe(200);
    // All 6 writes wrapped in exactly ONE transaction
    expect(vi.mocked(db.transaction)).toHaveBeenCalledTimes(1);
    expect(res.body).toHaveProperty('accrual_id', 7);
    expect(res.body).toHaveProperty('period', '2024-01');
  });

  it('يجب أن يرجع 400 عند period بصيغة غير صالحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const { db } = await import('@workspace/db');

    vi.mocked(db.transaction).mockClear();

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({ period: '01-2024' }); // wrong format

    expect(res.status).toBe(400);
    // No transaction on validation failure
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
  });

  it('يجب أن يرجع 400 عند غياب period', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const { db } = await import('@workspace/db');

    vi.mocked(db.transaction).mockClear();

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
  });

  it('يجب أن يرجع 404 إذا الاستحقاق غير موجود (tenant isolation)', async () => {
    mockChainData.mockResolvedValueOnce([]); // accrual not found

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const { db } = await import('@workspace/db');

    vi.mocked(db.transaction).mockClear();

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({ period: '2024-01' });

    expect(res.status).toBe(404);
    // No transaction when record not found
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
  });

  it('يجب أن يرجع 409 إذا تم التسجيل لهذه الفترة مسبقاً', async () => {
    mockChainData
      .mockResolvedValueOnce([mockAccrual])
      .mockResolvedValueOnce([{ id: 99, accrual_id: 7, period: '2024-01' }]); // run already exists

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const { db } = await import('@workspace/db');

    vi.mocked(db.transaction).mockClear();

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({ period: '2024-01' });

    expect(res.status).toBe(409);
    // No transaction — duplicate check prevents it
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
  });

  it('يجب أن يرجع 400 إذا الاستحقاق مكتمل (status !== active)', async () => {
    mockChainData.mockResolvedValueOnce([{ ...mockAccrual, status: 'completed' }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const { db } = await import('@workspace/db');

    vi.mocked(db.transaction).mockClear();

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({ period: '2024-01' });

    expect(res.status).toBe(400);
    expect(vi.mocked(db.transaction)).not.toHaveBeenCalled();
  });

  it('شركة B لا تستطيع تسجيل استحقاق شركة A', async () => {
    mockChainData.mockResolvedValueOnce([]); // company B query returns empty

    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/accruals/7/recognize')
      .set('Authorization', 'Bearer test-token')
      .send({ period: '2024-01' });

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/accruals/:id', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يحذف الاستحقاق بنجاح إذا لم يُسجَّل منه شيء', async () => {
    mockChainData.mockResolvedValueOnce([{ ...mockAccrual, amount_recognized: '0' }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .delete('/api/accruals/7')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('يجب أن يرجع 400 إذا تم استحقاق جزء من السجل', async () => {
    mockChainData.mockResolvedValueOnce([{ ...mockAccrual, amount_recognized: '100' }]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .delete('/api/accruals/7')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 404 إذا الاستحقاق غير موجود (tenant isolation)', async () => {
    mockChainData.mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .delete('/api/accruals/7')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });

  it('شركة B لا تستطيع حذف استحقاق شركة A', async () => {
    mockChainData.mockResolvedValueOnce([]); // company B finds nothing

    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .delete('/api/accruals/7')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });
});
