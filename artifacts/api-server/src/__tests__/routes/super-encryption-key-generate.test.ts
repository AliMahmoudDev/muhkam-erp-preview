/**
 * Focused tests for POST /api/super/backup/encryption-key/generate
 *
 * This endpoint is security-sensitive: it is PIN-gated via SUPER_ADMIN_PIN using
 * a constant-time compare, returns a freshly generated 32-byte (64 hex char) key
 * exactly once, NEVER persists/logs the key, never mutates the running
 * BACKUP_ENCRYPTION_KEY, sets no-store cache headers, and audits only the ACTION.
 *
 * Scoped to its own file (and @workspace/db fully mocked) so it runs reliably in
 * isolation without touching the shared test database.
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

// ── audit-log mock (captures the action; key must never appear here) ───────────
vi.mock('../../lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit-log';

const ENDPOINT = '/api/super/backup/encryption-key/generate';

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

const post = async (body?: unknown) => {
  const request = (await import('supertest')).default;
  const app = (await import('../../app')).default;
  const req = request(app).post(ENDPOINT).set('Authorization', 'Bearer test-token');
  return body === undefined ? req : req.send(body as object);
};

describe('POST /api/super/backup/encryption-key/generate', () => {
  const ORIGINAL_PIN = process.env.SUPER_ADMIN_PIN;
  const ORIGINAL_BACKUP_KEY = process.env.BACKUP_ENCRYPTION_KEY;

  beforeEach(() => {
    vi.mocked(authenticate).mockImplementation(asSuperAdmin);
    process.env.SUPER_ADMIN_PIN = 'correct-pin-1234';
  });

  afterEach(() => {
    if (ORIGINAL_PIN === undefined) delete process.env.SUPER_ADMIN_PIN;
    else process.env.SUPER_ADMIN_PIN = ORIGINAL_PIN;
    if (ORIGINAL_BACKUP_KEY === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = ORIGINAL_BACKUP_KEY;
  });

  it('returns 400 when PIN is missing from the body', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).not.toHaveProperty('key');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 400 when PIN is an empty string', async () => {
    const res = await post({ pin: '' });
    expect(res.status).toBe(400);
    expect(res.body).not.toHaveProperty('key');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 403 when PIN is wrong', async () => {
    const res = await post({ pin: 'wrong-pin' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
    expect(res.body).not.toHaveProperty('key');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 404 when SUPER_ADMIN_PIN is not configured on the server', async () => {
    delete process.env.SUPER_ADMIN_PIN;
    const res = await post({ pin: 'anything' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body).not.toHaveProperty('key');
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('returns 200 with a 64-hex-char key, generated_at and already_configured on correct PIN', async () => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    const res = await post({ pin: 'correct-pin-1234' });

    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof res.body.generated_at).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.generated_at))).toBe(false);
    expect(res.body.already_configured).toBe(false);
  });

  it('reflects already_configured=true when a running key exists', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'existing-running-key';
    const res = await post({ pin: 'correct-pin-1234' });

    expect(res.status).toBe(200);
    expect(res.body.already_configured).toBe(true);
  });

  it('sets no-store cache headers on success', async () => {
    const res = await post({ pin: 'correct-pin-1234' });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
  });

  it('never mutates the running BACKUP_ENCRYPTION_KEY', async () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'existing-running-key';
    const res = await post({ pin: 'correct-pin-1234' });

    expect(res.status).toBe(200);
    expect(process.env.BACKUP_ENCRYPTION_KEY).toBe('existing-running-key');
    // The freshly generated key is returned but is NOT the running key.
    expect(res.body.key).not.toBe('existing-running-key');
  });

  it('audits the ACTION only and never the generated key value', async () => {
    const res = await post({ pin: 'correct-pin-1234' });
    expect(res.status).toBe(200);

    expect(writeAuditLog).toHaveBeenCalledTimes(1);
    const auditArg = vi.mocked(writeAuditLog).mock.calls[0][0] as Record<string, unknown>;
    expect(auditArg.action).toBe('BACKUP_ENCRYPTION_KEY_GENERATED');
    expect(auditArg.record_type).toBe('system');

    // The key value must NOT appear anywhere in the audit payload.
    const serialized = JSON.stringify(auditArg);
    expect(serialized).not.toContain(res.body.key);
  });
});
