import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── @workspace/db mock ────────────────────────────────────────────────────────
// The encryption-key/generate endpoint does NOT touch the database, but importing
// the full app pulls in every router, each of which imports named table exports
// from @workspace/db at module load. Mock the module so no real pg connection is
// attempted. Mirrors the pattern used by routes/settings-full.test.ts.
vi.mock('@workspace/db', () => {
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn().mockResolvedValue([]),
      then: (onFulfilled: (v: unknown[]) => unknown) => Promise.resolve([]).then(onFulfilled),
    };
    return chain;
  };

  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };

  // Every table export must be explicitly defined: some modules (e.g.
  // lib/backup-service.ts) reference table objects at module-load time, and
  // vitest validates named exports statically (a Proxy is not enough).
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
    superSettingsTable: {} as Record<string, never>,
    suppliersTable: {} as Record<string, never>,
    systemSettingsTable: {} as Record<string, never>,
    taxBracketsTable: {} as Record<string, never>,
    transactionsTable: {} as Record<string, never>,
    treasuryVouchersTable: {} as Record<string, never>,
    warehousesTable: {} as Record<string, never>,
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
    // requireRole stays REAL so role enforcement is genuinely tested.
    authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});

// ── Lib mocks ─────────────────────────────────────────────────────────────────
vi.mock('../../lib/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit-log';

const superAdminUser: AuthUser = {
  id: 99,
  name: 'Super Admin',
  username: 'superadmin',
  role: 'super_admin',
  permissions: '{}',
  active: true,
  warehouse_id: null,
  safe_id: null,
  company_id: null,
  employee_id: null,
};

const adminUser: AuthUser = {
  id: 1,
  name: 'Tenant Admin',
  username: 'admin_a',
  role: 'admin',
  permissions: '{}',
  active: true,
  warehouse_id: 1,
  safe_id: 1,
  company_id: 1,
  employee_id: null,
};

const ENDPOINT = '/api/super/backup/encryption-key/generate';
const VALID_PIN = 'super-admin-pin-1234';

const asSuper = (req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { user: AuthUser }).user = superAdminUser;
  next();
};

describe('POST /api/super/backup/encryption-key/generate', () => {
  let savedPin: string | undefined;
  let savedKey: string | undefined;

  beforeEach(() => {
    savedPin = process.env.SUPER_ADMIN_PIN;
    savedKey = process.env.BACKUP_ENCRYPTION_KEY;
    process.env.SUPER_ADMIN_PIN = VALID_PIN;
    vi.mocked(authenticate).mockImplementation(asSuper);
  });

  afterEach(() => {
    if (savedPin === undefined) delete process.env.SUPER_ADMIN_PIN;
    else process.env.SUPER_ADMIN_PIN = savedPin;
    if (savedKey === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = savedKey;
  });

  it('returns 200 with a fresh 64-hex key, generated_at and already_configured on a correct PIN', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY; // first-time generation
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof res.body.generated_at).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.generated_at))).toBe(false);
    expect(res.body.already_configured).toBe(false);
  });

  it('sets no-store cache headers so the key is never cached by intermediaries', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('reports already_configured=true when rotating an existing key', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(200);
    expect(res.body.already_configured).toBe(true);
  });

  it('NEVER mutates the running BACKUP_ENCRYPTION_KEY (operator must store it manually)', async () => {
    const existing = 'b'.repeat(64);
    process.env.BACKUP_ENCRYPTION_KEY = existing;
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(200);
    expect(res.body.key).not.toBe(existing);
    expect(process.env.BACKUP_ENCRYPTION_KEY).toBe(existing); // unchanged
  });

  it('audits the ACTION only and never logs the generated key value', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(200);
    const generatedKey = res.body.key as string;

    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    const auditArg = vi.mocked(writeAuditLog).mock.calls[0][0] as Record<string, unknown>;
    expect(auditArg.action).toBe('BACKUP_ENCRYPTION_KEY_GENERATED');
    // The key value must NOT appear anywhere in the audit payload.
    expect(JSON.stringify(auditArg)).not.toContain(generatedKey);
  });

  it('returns 403 on a wrong PIN', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: 'totally-wrong-pin' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
    expect(res.body).not.toHaveProperty('key');
  });

  it('returns 400 when the PIN is missing', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('key');
  });

  it('returns 400 when the PIN is an empty string', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: '' });

    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('key');
  });

  it('returns 404 when SUPER_ADMIN_PIN is not configured on the server', async () => {
    delete process.env.SUPER_ADMIN_PIN;
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('key');
  });

  it('returns 403 for a non-super_admin role (requireRole enforced)', async () => {
    vi.mocked(authenticate).mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        (req as Request & { user: AuthUser }).user = adminUser;
        next();
      }
    );
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer test-token')
      .send({ pin: VALID_PIN });

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('key');
  });
});
