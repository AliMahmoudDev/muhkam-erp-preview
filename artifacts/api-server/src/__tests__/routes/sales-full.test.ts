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
    returning: vi.fn().mockResolvedValue([{
      id: 77, invoice_no: 'SAL-2024-0077', customer_name: 'عميل أ',
      customer_id: null, payment_type: 'cash',
      total_amount: '350.00', paid_amount: '350.00', remaining_amount: '0.00',
      status: 'paid', date: '2024-01-20', notes: null,
      currency: 'EGP', exchange_rate: '1', safe_id: 1, safe_name: 'خزينة رئيسية',
      warehouse_id: 1, salesperson_id: null, posting_status: 'draft',
      discount_percent: '0', discount_amount: '0', tax_amount: '0', tax_rate: '0',
      request_id: null, company_id: 1,
      created_at: new Date('2024-01-20T10:00:00.000Z'),
    }]),
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
  };
});

// ── @workspace/api-zod mock ──────────────────────────────────────────────────
vi.mock('@workspace/api-zod', () => ({
  GetSalesResponse:    { parse: (d: unknown) => d },
  GetSaleByIdResponse: { parse: (d: unknown) => d },
  GetSaleByIdParams:   {
    safeParse: (d: Record<string, string>) => ({
      success: true,
      data: { id: Number(d.id) },
    }),
  },
  CreateSaleBody: {
    safeParse: (d: Record<string, unknown>) => {
      if (
        !d.payment_type ||
        d.total_amount === undefined ||
        d.paid_amount  === undefined ||
        !Array.isArray(d.items)
      ) {
        return { success: false, error: { message: 'بيانات غير صحيحة' } };
      }
      return { success: true, data: d };
    },
  },
}));

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
  nextInvoiceNo:             vi.fn().mockResolvedValue('INV-2024-0001'),
  nextPurchaseInvoiceNo:     vi.fn().mockResolvedValue('PUR-2024-0001'),
  nextSaleInvoiceNo:         vi.fn().mockResolvedValue('SAL-2024-0001'),
  nextDevicePurchaseInvoiceNo: vi.fn().mockResolvedValue('DPUR-2024-0001'),
}));
vi.mock('../../lib/warehouse-guard', () => ({
  resolveTenantWarehouseId: vi.fn().mockResolvedValue(1),
}));
vi.mock('../../lib/auto-account', () => ({
  getOrCreateInventoryAccount:         vi.fn().mockResolvedValue({ id: 10, code: 'INV-001' }),
  getOrCreateSafeAccount:              vi.fn().mockResolvedValue({ id: 11, code: 'SAFE-001' }),
  getOrCreateCustomerPayableAccount:   vi.fn().mockResolvedValue({ id: 12, code: 'AP-001' }),
  getOrCreateVatInputAccount:          vi.fn().mockResolvedValue({ id: 13, code: 'VAT-IN' }),
  getOrCreateGeneralExpenseAccount:    vi.fn().mockResolvedValue({ id: 14, code: 'EXP-GEN' }),
  getOrCreateSalesRevenueAccount:      vi.fn().mockResolvedValue({ id: 20, code: 'REV-SALES' }),
  getOrCreateCustomerAccount:          vi.fn().mockResolvedValue({ id: 21, code: 'AR-001' }),
  getOrCreateCOGSAccount:              vi.fn().mockResolvedValue({ id: 22, code: 'EXP-COGS' }),
  getOrCreateVatPayableAccount:        vi.fn().mockResolvedValue({ id: 23, code: 'VAT-OUT' }),
  createJournalEntry:                  vi.fn().mockResolvedValue({ id: 100 }),
  createAutoJournalEntry:              vi.fn().mockResolvedValue({ id: 101 }),
}));
vi.mock('../../lib/ledger-balance', () => ({
  getCustomerLedgerBalance: vi.fn().mockResolvedValue(0),
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

const employeeUser: AuthUser = {
  id: 3, name: 'Employee', username: 'emp',
  role: 'employee', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: 1, employee_id: 10,
};

// ── Fixture ───────────────────────────────────────────────────────────────────
const mockSaleA = {
  id: 77, invoice_no: 'SAL-2024-0077', customer_name: 'عميل أ',
  customer_id: null, payment_type: 'cash',
  total_amount: '350.00', paid_amount: '350.00', remaining_amount: '0.00',
  status: 'paid', date: '2024-01-20', notes: null,
  currency: 'EGP', exchange_rate: '1', safe_id: 1, safe_name: 'خزينة رئيسية',
  warehouse_id: 1, salesperson_id: null, posting_status: 'draft',
  discount_percent: '0', discount_amount: '0', tax_amount: '0', tax_rate: '0',
  request_id: null, company_id: 1,
  created_at: new Date('2024-01-20T10:00:00.000Z'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/sales', () => {
  beforeEach(() => {
    // GET /sales issues TWO db.select() chain calls: (1) count query, (2) data query.
    // Seed with [{ total: 0 }] first so destructuring `const [{ total }]` doesn't explode.
    mockChainData.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 ومصفوفة فارغة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/sales');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرفض المستخدم بدون صلاحية can_view_sales بـ 403', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يعزل بيانات الشركة — company B لا ترى مبيعات company A', async () => {
    // Reset queue, then supply:
    //   Company A — count → [{total:1}], data → [mockSaleA]
    //   Company B — count → [{total:0}], data → [] (default)
    mockChainData
      .mockReset()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([mockSaleA])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValue([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const resA = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(resA.status).toBe(200);
    expect(resA.body).toContainEqual(expect.objectContaining({ id: 77 }));

    // Company B — mockChainData falls back to [] (empty)
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const resB = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(resB.status).toBe(200);
    expect(resB.body).not.toContainEqual(expect.objectContaining({ id: 77 }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/sales', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند إرسال body فارغ (فشل Zod validation)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 403 للمستخدم بدون صلاحية can_create_sale', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', 'Bearer test-token')
      .send({
        payment_type: 'cash', total_amount: 100, paid_amount: 100,
        items: [{ product_id: 1, product_name: 'صنف', quantity: 1, unit_price: 100, total_price: 100 }],
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 201 عند إنشاء فاتورة بيع بنجاح', async () => {
    const { db } = await import('@workspace/db');
    vi.mocked(db.transaction).mockResolvedValueOnce(mockSaleA);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', 'Bearer test-token')
      .send({
        payment_type: 'cash',
        total_amount: 350,
        paid_amount: 350,
        warehouse_id: 1,
        safe_id: 1,
        items: [
          { product_id: 1, product_name: 'صنف اختبار', quantity: 1, unit_price: 350, total_price: 350 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id', 77);
    expect(res.body).toHaveProperty('invoice_no', 'SAL-2024-0077');
    expect(res.body.payment_type).toBe('cash');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/sales/:id', () => {
  beforeEach(() => {
    mockChainData.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 404 لمعرّف مبيعات غير موجود', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales/99999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 200 وبيانات الفاتورة مع الأصناف عند وجودها', async () => {
    // First chain call → sale record; second → items array
    mockChainData.mockResolvedValueOnce([mockSaleA]).mockResolvedValueOnce([]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales/77')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 77);
    expect(res.body).toHaveProperty('invoice_no', 'SAL-2024-0077');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/sales/77');

    expect(res.status).toBe(401);
  });
});
