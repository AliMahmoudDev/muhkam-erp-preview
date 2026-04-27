import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Type matching salesTable.$inferSelect (used in mock data) ─────────────────
interface MockSale {
  id: number;
  request_id: string | null;
  invoice_no: string;
  customer_name: string | null;
  customer_id: number | null;
  payment_type: 'cash' | 'credit' | 'partial';
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: 'paid' | 'partial' | 'unpaid';
  posting_status: 'draft' | 'posted' | 'cancelled';
  safe_id: number | null;
  safe_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  salesperson_id: number | null;
  salesperson_name: string | null;
  discount_percent: string | null;
  discount_amount: string | null;
  tax_amount: string;
  tax_rate: string;
  notes: string | null;
  date: string | null;
  user_id: number | null;
  company_id: number;
  branch_id: number | null;
  created_at: Date;
}

// ── Hoisted mock controls ─────────────────────────────────────────────────────
// vi.hoisted() ensures these exist before vi.mock() factories run (they are
// both hoisted above regular imports by Vitest).
const { mockListOffset, mockCountWhere } = vi.hoisted(() => ({
  // Resolves the terminal .offset() call in GET /api/sales list queries
  mockListOffset: vi.fn<[], Promise<MockSale[]>>().mockResolvedValue([]),
  // Resolves the terminal .where() call in COUNT queries
  mockCountWhere: vi.fn<[], Promise<Array<{ total: number }>>>()
    .mockResolvedValue([{ total: 0 }]),
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
  // txMock used by db.transaction(); kept intentionally minimal
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{}]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };

  /**
   * Creates a thenable chain for queries that end directly with .where() (e.g.
   * GET /api/sales/:id). Awaiting the chain resolves to [] so that
   * `const [sale] = await chain` gives sale = undefined → 404.
   *
   * For list queries the chain exposes .offset() = mockListOffset so the
   * terminal await is on a real Promise returned by mockListOffset.
   */
  const makeDirectChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: mockListOffset,
      // Thenable so `await chain` resolves to [] (no sale found)
      then: (
        onFulfilled: (v: MockSale[]) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve<MockSale[]>([]).then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) =>
        Promise.resolve<MockSale[]>([]).catch(onRejected),
      finally: (onFinally: () => void) =>
        Promise.resolve<MockSale[]>([]).finally(onFinally),
    };
    return chain;
  };

  /**
   * Chain for COUNT queries: db.select({ total: count() }).from().where().
   * .where() is replaced by mockCountWhere so the result is controllable.
   */
  const countChain: Record<string, unknown> = {
    from: vi.fn(() => countChain),
    where: mockCountWhere,
  };

  const db = {
    // Route distinguishes count queries (with field arg) from list queries (no arg)
    select: vi.fn((fields?: unknown) =>
      fields != null ? countChain : makeDirectChain(),
    ),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) =>
      fn(txMock),
    ),
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
    branchesTable: {} as Record<string, never>,
    categoriesTable: {} as Record<string, never>,
    companiesTable: {} as Record<string, never>,
    customerClassificationsTable: {} as Record<string, never>,
    customerLedgerTable: {} as Record<string, never>,
    customersTable: {} as Record<string, never>,
    dailyIncentiveAccrualTable: {} as Record<string, never>,
    departmentsTable: {} as Record<string, never>,
    depositVouchersTable: {} as Record<string, never>,
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
  };
});

// ── Mock tenant-guard and email-verify-guard as passthrough ──────────────────
// tenantGuard queries the DB for company subscription status; mock it so that
// the company-subscription check never blocks tests.
vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));

// emailVerifyGuard queries the DB for email-verification state; mock as passthrough.
vi.mock('../../middleware/email-verify-guard', () => ({
  emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

// ── Mock authenticate; keep all other auth exports real ──────────────────────
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';

// ── Shared test users ─────────────────────────────────────────────────────────
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

// ── Minimal sale fixture matching salesTable.$inferSelect ─────────────────────
const mockSaleA: MockSale = {
  id: 42,
  request_id: null,
  invoice_no: 'INV-TEST-001',
  customer_name: null,
  customer_id: null,
  payment_type: 'cash',
  total_amount: '150.00',
  paid_amount: '150.00',
  remaining_amount: '0.00',
  status: 'paid',
  posting_status: 'posted',
  safe_id: 1,
  safe_name: null,
  warehouse_id: 1,
  warehouse_name: null,
  salesperson_id: null,
  salesperson_name: null,
  discount_percent: null,
  discount_amount: null,
  tax_amount: '0.00',
  tax_rate: '0.00',
  notes: null,
  date: '2024-01-15',
  user_id: 1,
  company_id: 1,
  branch_id: null,
  created_at: new Date('2024-01-15T10:00:00.000Z'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/sales', () => {
  beforeEach(() => {
    mockListOffset.mockResolvedValue([]);
    mockCountWhere.mockResolvedValue([{ total: 0 }]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
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

  it('يجب أن يرفض المستخدم من دور employee بـ 403', async () => {
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
    // First request (company A) sees mockSaleA
    mockCountWhere.mockResolvedValueOnce([{ total: 1 }]);
    mockListOffset.mockResolvedValueOnce([mockSaleA]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const resA = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(resA.status).toBe(200);
    expect(resA.body).toContainEqual(expect.objectContaining({ id: 42 }));

    // Second request (company B) — mockListOffset/mockCountWhere fall back to defaults ([])
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
    expect(resB.body).not.toContainEqual(expect.objectContaining({ id: 42 }));
  });
});

describe('POST /api/sales', () => {
  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند إرسال body ناقص', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/sales/:id', () => {
  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 404 لمعرّف فاتورة غير موجود', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales/99999')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
