/**
 * Focused tests for:
 *   GET /api/super/encryption-key       — intentionally disabled; must always return 410
 *   GET /api/super/encryption-status    — must return enabled flag only, never the key value
 *
 * SECURITY:
 *   • GET /super/encryption-key is a tombstoned endpoint that must return 410 with
 *     key: null and no-store cache headers regardless of whether BACKUP_ENCRYPTION_KEY
 *     is set. A future change accidentally re-enabling key export would be caught here.
 *   • GET /super/encryption-status must only expose a boolean `enabled` field and must
 *     never include the actual key value in any part of the response body.
 *
 * Scoped to its own file (and @workspace/db fully mocked) so it runs in isolation
 * without touching the shared test database.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── @workspace/db mock (no real DB connection during this suite) ──────────────
vi.mock('@workspace/db', () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn().mockResolvedValue([]),
      then: (onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve([]).then(onFulfilled, onRejected),
      catch: (fn: (e: unknown) => unknown) => Promise.resolve([]).catch(fn),
      finally: (fn: () => void) => Promise.resolve([]).finally(fn),
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
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };

  const tableStub = {} as Record<string, never>;

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
    accountsTable: tableStub,
    alertsTable: tableStub,
    attendanceRecordsTable: tableStub,
    attendanceSummaryTable: tableStub,
    auditLogsTable: tableStub,
    backupsTable: tableStub,
    branchesTable: tableStub,
    categoriesTable: tableStub,
    companiesTable: tableStub,
    customerClassificationsTable: tableStub,
    customerLedgerTable: tableStub,
    customersTable: tableStub,
    dailyIncentiveAccrualTable: tableStub,
    departmentsTable: tableStub,
    depositVouchersTable: tableStub,
    employeeContactsTable: tableStub,
    employeeDocumentsTable: tableStub,
    employeeIncentiveAssignmentsTable: tableStub,
    employeeLeaveBalancesTable: tableStub,
    employeeShiftAssignmentsTable: tableStub,
    employeesTable: tableStub,
    employeeStatusHistoryTable: tableStub,
    erpUsersTable: tableStub,
    expenseCategoriesTable: tableStub,
    expensesTable: tableStub,
    incentiveMetricsTable: tableStub,
    incentiveRulesTable: tableStub,
    incentiveSchemesTable: tableStub,
    incentiveSlabsTable: tableStub,
    incomeTable: tableStub,
    jobTitlesTable: tableStub,
    journalEntriesTable: tableStub,
    journalEntryLinesTable: tableStub,
    leaveAccrualHistoryTable: tableStub,
    leaveApprovalsTable: tableStub,
    leaveBlackoutDatesTable: tableStub,
    leavePoliciesTable: tableStub,
    leaveRequestsTable: tableStub,
    leaveTypesTable: tableStub,
    monthlyIncentiveSummaryTable: tableStub,
    overtimeRecordsTable: tableStub,
    paymentVouchersTable: tableStub,
    payrollAdjustmentsTable: tableStub,
    payrollLineItemsTable: tableStub,
    payrollPeriodsTable: tableStub,
    payrollRecordsTable: tableStub,
    productsTable: tableStub,
    publicHolidaysTable: tableStub,
    purchaseItemsTable: tableStub,
    purchaseReturnItemsTable: tableStub,
    purchaseReturnsTable: tableStub,
    purchasesTable: tableStub,
    receiptVouchersTable: tableStub,
    repairChecklistItemsTable: tableStub,
    repairDeviceModelsTable: tableStub,
    repairJobPartsTable: tableStub,
    repairJobsTable: tableStub,
    repairStatusesTable: tableStub,
    repairStatusHistoryTable: tableStub,
    safesTable: tableStub,
    safeTransfersTable: tableStub,
    salaryAdvanceDeductionsTable: tableStub,
    salaryAdvanceHistoryTable: tableStub,
    salaryAdvanceLedgerTable: tableStub,
    salaryAdvanceSettingsTable: tableStub,
    salaryAdvancesTable: tableStub,
    salaryComponentsTable: tableStub,
    salaryHistoryTable: tableStub,
    salaryStructuresTable: tableStub,
    saleItemsTable: tableStub,
    saleReturnItemsTable: tableStub,
    salesReturnsTable: tableStub,
    salesTable: tableStub,
    shiftSchedulesTable: tableStub,
    statutoryContributionsTable: tableStub,
    stockCountItemsTable: tableStub,
    stockCountSessionsTable: tableStub,
    stockMovementsTable: tableStub,
    stockTransferItemsTable: tableStub,
    stockTransfersTable: tableStub,
    suppliersTable: tableStub,
    superSettingsTable: tableStub,
    systemSettingsTable: tableStub,
    taxBracketsTable: tableStub,
    transactionsTable: tableStub,
    treasuryVouchersTable: tableStub,
    warehousesTable: tableStub,
    devicesTable: tableStub,
    warrantyTable: tableStub,
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
  const actual = (await vi.importActual('../../middleware/auth')) as Record<string, unknown>;
  return {
    ...actual,
    authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});

vi.mock('../../lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';

const KEY_EXPORT_ENDPOINT = '/api/super/encryption-key';
const KEY_STATUS_ENDPOINT = '/api/super/encryption-status';

const superUser: AuthUser = {
  id: 7,
  name: 'Root',
  username: 'root',
  role: 'super_admin',
  permissions: '{}',
  active: true,
  warehouse_id: null,
  safe_id: null,
  company_id: null,
  employee_id: null,
};

const asSuperAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  (req as Request & { user: AuthUser }).user = superUser;
  next();
};

const get = async (endpoint: string) => {
  const request = (await import('supertest')).default;
  const app = (await import('../../app')).default;
  return request(app).get(endpoint).set('Authorization', 'Bearer test-token');
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/super/encryption-key — disabled tombstone endpoint
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/super/encryption-key (disabled — must always return 410)', () => {
  const ORIGINAL_BACKUP_KEY = process.env.BACKUP_ENCRYPTION_KEY;

  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(asSuperAdmin);
  });

  afterEach(() => {
    if (ORIGINAL_BACKUP_KEY === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = ORIGINAL_BACKUP_KEY;
  });

  it('returns 410 Gone when BACKUP_ENCRYPTION_KEY is not set', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const res = await get(KEY_EXPORT_ENDPOINT);
    expect(res.status).toBe(410);
  });

  it('returns 410 Gone even when BACKUP_ENCRYPTION_KEY is set', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'secret-key-that-must-never-leave-server';
    const res = await get(KEY_EXPORT_ENDPOINT);
    expect(res.status).toBe(410);
  });

  it('always returns key: null regardless of env state', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const resNoKey = await get(KEY_EXPORT_ENDPOINT);
    expect(resNoKey.body.key).toBeNull();

    process.env.BACKUP_ENCRYPTION_KEY = 'secret-key-that-must-never-leave-server';
    const resWithKey = await get(KEY_EXPORT_ENDPOINT);
    expect(resWithKey.body.key).toBeNull();
  });

  it('never exposes the running BACKUP_ENCRYPTION_KEY value in the response body', async () => {
    const sensitiveKey = 'my-ultra-secret-backup-key-abc123';
    process.env.BACKUP_ENCRYPTION_KEY = sensitiveKey;
    const res = await get(KEY_EXPORT_ENDPOINT);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(sensitiveKey);
  });

  it('sets no-store cache headers', async () => {
    const res = await get(KEY_EXPORT_ENDPOINT);
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
  });

  it('sets no-store cache headers even when BACKUP_ENCRYPTION_KEY is set', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'secret-key-that-must-never-leave-server';
    const res = await get(KEY_EXPORT_ENDPOINT);
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
  });

  it('includes an error field explaining the endpoint is disabled', async () => {
    const res = await get(KEY_EXPORT_ENDPOINT);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/super/encryption-status — boolean status check (no key exposure)
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/super/encryption-status (boolean flag only — must never expose key)', () => {
  const ORIGINAL_BACKUP_KEY = process.env.BACKUP_ENCRYPTION_KEY;

  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(asSuperAdmin);
  });

  afterEach(() => {
    if (ORIGINAL_BACKUP_KEY === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = ORIGINAL_BACKUP_KEY;
  });

  it('returns 200 with enabled: false when BACKUP_ENCRYPTION_KEY is not set', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const res = await get(KEY_STATUS_ENDPOINT);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it('returns 200 with enabled: true when BACKUP_ENCRYPTION_KEY is set', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'any-key-value';
    const res = await get(KEY_STATUS_ENDPOINT);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true });
  });

  it('never includes the key value anywhere in the response body when key is set', async () => {
    const sensitiveKey = 'super-secret-encryption-key-xyz987';
    process.env.BACKUP_ENCRYPTION_KEY = sensitiveKey;
    const res = await get(KEY_STATUS_ENDPOINT);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(sensitiveKey);
  });

  it('response body does not contain a "key" field', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'some-key';
    const res = await get(KEY_STATUS_ENDPOINT);
    expect(res.body).not.toHaveProperty('key');
  });

  it('response body contains only an "enabled" boolean field', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const res = await get(KEY_STATUS_ENDPOINT);
    expect(typeof res.body.enabled).toBe('boolean');
    const keys = Object.keys(res.body as object);
    expect(keys).toEqual(['enabled']);
  });
});
