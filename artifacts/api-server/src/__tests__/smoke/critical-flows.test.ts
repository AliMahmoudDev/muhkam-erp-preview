import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
const { mockListOffset, mockCountWhere } = vi.hoisted(() => ({
  mockListOffset: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockCountWhere: vi.fn<[], Promise<Array<{ total: number }>>>()
    .mockResolvedValue([{ total: 0 }]),
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
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

  const makeDirectChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: mockListOffset,
      then: (
        onFulfilled: (v: unknown[]) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) => Promise.resolve<unknown[]>([]).then(onFulfilled, onRejected),
      catch: (onRejected: (e: unknown) => unknown) =>
        Promise.resolve<unknown[]>([]).catch(onRejected),
      finally: (onFinally: () => void) =>
        Promise.resolve<unknown[]>([]).finally(onFinally),
    };
    return chain;
  };

  // countChain is only used when select() is called with a single {total} key —
  // the standard Drizzle `count()` query pattern. All other field-based selects
  // (e.g. products with leftJoin) get makeDirectChain() so leftJoin/groupBy work.
  const countChain: Record<string, unknown> = {
    from: vi.fn(() => countChain),
    where: mockCountWhere,
    leftJoin: vi.fn(() => countChain),
    innerJoin: vi.fn(() => countChain),
    groupBy: vi.fn(() => countChain),
    orderBy: vi.fn(() => countChain),
    limit: vi.fn(() => countChain),
    offset: vi.fn().mockResolvedValue([{ total: 0 }]),
  };

  const db = {
    select: vi.fn((fields?: Record<string, unknown>) => {
      // Route count queries look like db.select({ total: count() }) — single key 'total'.
      // Everything else (no args, or multi-field select) → makeDirectChain().
      const keys = fields ? Object.keys(fields) : [];
      if (keys.length === 1 && keys[0] === 'total') return countChain;
      return makeDirectChain();
    }),
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
    employeeDeductionsTable: {} as Record<string, never>,
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
  };
});

// ── Middleware mocks ──────────────────────────────────────────────────────────
vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));

vi.mock('../../middleware/email-verify-guard', () => ({
  emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth') as Record<string, unknown>;
  return {
    ...actual,
    authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});

vi.mock('../../middleware/feature-guard', () => ({
  requireFeature: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateFeatureCache: vi.fn(),
}));

vi.mock('../../lib/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/notify', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/tracking-token', () => ({
  generateTrackingToken: vi.fn().mockReturnValue('mock-token'),
  computeTrackingToken: vi.fn().mockReturnValue('mock-token'),
  verifyTrackingToken: vi.fn().mockReturnValue(null),
}));

vi.mock('../../lib/auto-customer', () => ({
  getOrCreateWalkInCustomer: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../lib/auto-account', () => ({
  getOrCreateAccount: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock('../../services/repair-pipeline.service', () => ({
  repairPipelineService: {
    transition: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Auth flow: login → protected route → current user
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Auth flow', () => {
  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('GET /api/auth/me يجب أن يرجع 200 وبيانات المستخدم المصادق', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('role');
  });

  it('GET /api/auth/me يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login يجب أن يرجع 400 لـ body ناقص', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sales flow: create → get → verify in list
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Sales flow', () => {
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

  it('GET /api/sales يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/sales يجب أن يرفض الطلب بدون token بـ 401', async () => {
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

  it('POST /api/sales يجب أن يرجع 400 لـ body ناقص', async () => {
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Customers flow: create → get → update
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Customers flow', () => {
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

  it('GET /api/customers يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/customers')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/customers يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/customers');

    expect(res.status).toBe(401);
  });

  it('POST /api/customers يجب أن يرجع 400 لـ body ناقص', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/customers')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Products flow: create → get → check inventory
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Products flow', () => {
  beforeEach(() => {
    mockListOffset.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('GET /api/products يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/products يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(401);
  });

  it('GET /api/inventory/audit يجب أن يرجع 200 وكائن تدقيق للمصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/inventory/audit')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Reports flow: profit-loss → balance-sheet → trial-balance
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Reports flow', () => {
  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('GET /api/reports/cash-flow يجب أن يرجع 200 للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/cash-flow')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });

  it('GET /api/reports/balance-sheet يجب أن يرجع 200 للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/balance-sheet')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });

  it('GET /api/reports/trial-balance يجب أن يرفض المستخدم بدون صلاحية can_view_accounts بـ 403', async () => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/reports/trial-balance')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Repairs flow: create job → get list → role guard
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Repairs flow', () => {
  beforeEach(() => {
    mockListOffset.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('GET /api/repair-jobs يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/repair-jobs')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/repair-jobs يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/repair-jobs');

    expect(res.status).toBe(401);
  });

  it('GET /api/repair-jobs يجب أن يرفض المستخدم بدون صلاحية can_view_repairs بـ 403', async () => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/repair-jobs')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Purchases flow: create → get → verify total
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Purchases flow', () => {
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

  it('GET /api/purchases يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/purchases')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/purchases يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/purchases');

    expect(res.status).toBe(401);
  });

  it('POST /api/purchases يجب أن يرجع 400 لـ body ناقص', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Employees flow: list → payroll periods
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Employees & Payroll flow', () => {
  beforeEach(() => {
    mockListOffset.mockResolvedValue([]);
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('GET /api/payroll/periods يجب أن يرجع 200 ومصفوفة للمستخدم المصرح له', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/payroll/periods')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/payroll/periods يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/payroll/periods');

    expect(res.status).toBe(401);
  });

  it('GET /api/payroll/periods يجب أن يرفض المستخدم من دور employee بـ 403', async () => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/payroll/periods')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Tenant isolation: company A cannot see company B data
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Tenant isolation', () => {
  const mockSaleCompanyA = {
    id: 101,
    request_id: null,
    invoice_no: 'SMOKE-A-001',
    customer_name: null,
    customer_id: null,
    payment_type: 'cash' as const,
    total_amount: '500.00',
    paid_amount: '500.00',
    remaining_amount: '0.00',
    status: 'paid' as const,
    posting_status: 'posted' as const,
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

  it('Company A يرى بياناتها الخاصة', async () => {
    mockCountWhere.mockResolvedValueOnce([{ total: 1 }]);
    mockListOffset.mockResolvedValueOnce([mockSaleCompanyA]);

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toContainEqual(expect.objectContaining({ id: 101 }));
  });

  it('Company B لا ترى بيانات Company A', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserB;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/sales')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).not.toContainEqual(expect.objectContaining({ id: 101 }));
  });

  it('يجب أن يرفض الطلب بدون token بـ 401 لمنع الوصول غير المصرح', async () => {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Super admin: routes require super_admin role
// ─────────────────────────────────────────────────────────────────────────────
describe('Smoke — Super admin access control', () => {
  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('GET /api/super/companies يجب أن يرفض المدير العادي بـ 403', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/super/companies')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/super/stats يجب أن يرفض المدير العادي بـ 403', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/super/stats')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/super/companies يجب أن يرفض الطلب بدون token بـ 401', async () => {
    vi.mocked(authenticate).mockImplementationOnce(
      (_req: Request, res: Response) => {
        res.status(401).json({ error: 'غير مصرح' });
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app).get('/api/super/companies');

    expect(res.status).toBe(401);
  });
});
