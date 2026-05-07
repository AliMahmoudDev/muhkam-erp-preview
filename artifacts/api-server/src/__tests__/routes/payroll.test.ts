import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
const { mockDirectOffset } = vi.hoisted(() => ({
  mockDirectOffset: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
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
      limit: vi.fn(() => chain),
      offset: mockDirectOffset,
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

  const db = {
    select: vi.fn(() => makeDirectChain()),
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

// ── Mock tenant-guard and email-verify-guard as passthrough ──────────────────
vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));

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

// ── Mock feature-guard so requireFeature("hr") never blocks ──────────────────
vi.mock('../../middleware/feature-guard', () => ({
  requireFeature: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

// ── Mock audit-log ────────────────────────────────────────────────────────────
vi.mock('../../lib/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock job-queue (used by payroll process routes) ───────────────────────────
vi.mock('../../lib/job-queue', () => ({
  enqueueJob: vi.fn().mockResolvedValue({ jobId: 'test-job-1' }),
  getJobStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
}));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';

// ── Shared test users ─────────────────────────────────────────────────────────
const adminUserA: AuthUser = {
  id: 1, name: 'Admin A', username: 'admin_a',
  role: 'admin', permissions: '{}', active: true,
  warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
};

const employeeUser: AuthUser = {
  id: 3, name: 'Employee', username: 'emp',
  role: 'employee', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: 1, employee_id: 10,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/payroll/periods', () => {
  beforeEach(() => {
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
      .get('/api/payroll/periods')
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

    const res = await request(app).get('/api/payroll/periods');

    expect(res.status).toBe(401);
  });

  it('يجب أن يرفض المستخدم بدون صلاحية can_view_payroll بـ 403', async () => {
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

describe('POST /api/payroll/periods', () => {
  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUserA;
        next();
      },
    );
  });

  it('يجب أن يرجع 400 عند إرسال body ناقص (بدون name)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payroll/periods')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرجع 400 عند إرسال تواريخ غير صحيحة (البداية بعد النهاية)', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payroll/periods')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'فترة اختبار',
        start_date: '2024-02-01',
        end_date: '2024-01-01',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('يجب أن يرفض المستخدم بدون صلاحية can_manage_payroll بـ 403', async () => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = employeeUser;
        next();
      },
    );

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post('/api/payroll/periods')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'فترة يناير',
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});
