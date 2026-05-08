/**
 * metrics.test.ts — Tests for GET /api/metrics and GET /api/metrics/prometheus
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* ── Hoisted state ────────────────────────────────────────────────────── */
const { mockRole } = vi.hoisted(() => ({ mockRole: vi.fn<[], string>().mockReturnValue('super_admin') }));

/* ── @workspace/db mock ─────────────────────────────────────────────── */
vi.mock('@workspace/db', () => {
  const chain: Record<string, unknown> = {};
  const methods = ['select','from','where','orderBy','limit','offset','insert',
                   'values','returning','update','set','delete'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  (chain as Record<string, unknown>).then = (r: (v: unknown[]) => unknown) => Promise.resolve([]).then(r);
  return {
    db: {
      ...chain,
      execute:     vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn(async (fn: (tx: typeof chain) => Promise<unknown>) => fn(chain)),
    },
    pool: { end: vi.fn(), query: vi.fn(), connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }) },
    /* tables — referenced by other routers that share the app */
    accountsTable: {} as Record<string, never>, alertsTable: {} as Record<string, never>,
    attendanceRecordsTable: {} as Record<string, never>, attendanceSummaryTable: {} as Record<string, never>,
    auditLogsTable: {} as Record<string, never>, backupsTable: {} as Record<string, never>,
    branchesTable: {} as Record<string, never>, categoriesTable: {} as Record<string, never>,
    companiesTable: {} as Record<string, never>, customerClassificationsTable: {} as Record<string, never>,
    customerLedgerTable: {} as Record<string, never>, customersTable: {} as Record<string, never>,
    dailyIncentiveAccrualTable: {} as Record<string, never>, departmentsTable: {} as Record<string, never>,
    depositVouchersTable: {} as Record<string, never>, employeeContactsTable: {} as Record<string, never>,
    employeeDocumentsTable: {} as Record<string, never>, employeeIncentiveAssignmentsTable: {} as Record<string, never>,
    employeeLeaveBalancesTable: {} as Record<string, never>, employeeShiftAssignmentsTable: {} as Record<string, never>,
    employeesTable: {} as Record<string, never>, employeeStatusHistoryTable: {} as Record<string, never>,
    erpUsersTable: {} as Record<string, never>, expenseCategoriesTable: {} as Record<string, never>,
    expensesTable: {} as Record<string, never>, incentiveMetricsTable: {} as Record<string, never>,
    incentiveRulesTable: {} as Record<string, never>, incentiveSchemesTable: {} as Record<string, never>,
    incentiveSlabsTable: {} as Record<string, never>, incomeTable: {} as Record<string, never>,
    jobTitlesTable: {} as Record<string, never>, journalEntriesTable: {} as Record<string, never>,
    journalEntryLinesTable: {} as Record<string, never>, leaveAccrualHistoryTable: {} as Record<string, never>,
    leaveApprovalsTable: {} as Record<string, never>, leaveBlackoutDatesTable: {} as Record<string, never>,
    leavePoliciesTable: {} as Record<string, never>, leaveRequestsTable: {} as Record<string, never>,
    leaveTypesTable: {} as Record<string, never>, monthlyIncentiveSummaryTable: {} as Record<string, never>,
    overtimeRecordsTable: {} as Record<string, never>, paymentVouchersTable: {} as Record<string, never>,
    payrollAdjustmentsTable: {} as Record<string, never>, payrollLineItemsTable: {} as Record<string, never>,
    payrollPeriodsTable: {} as Record<string, never>, payrollRecordsTable: {} as Record<string, never>,
    productsTable: {} as Record<string, never>, publicHolidaysTable: {} as Record<string, never>,
    purchaseItemsTable: {} as Record<string, never>, purchaseReturnItemsTable: {} as Record<string, never>,
    purchaseReturnsTable: {} as Record<string, never>, purchasesTable: {} as Record<string, never>,
    receiptVouchersTable: {} as Record<string, never>, repairChecklistItemsTable: {} as Record<string, never>,
    repairDeviceModelsTable: {} as Record<string, never>, repairJobPartsTable: {} as Record<string, never>,
    repairJobsTable: {} as Record<string, never>, repairStatusesTable: {} as Record<string, never>,
    repairStatusHistoryTable: {} as Record<string, never>, safesTable: {} as Record<string, never>,
    safeTransfersTable: {} as Record<string, never>, salaryAdvanceDeductionsTable: {} as Record<string, never>,
    salaryAdvanceHistoryTable: {} as Record<string, never>, salaryAdvanceLedgerTable: {} as Record<string, never>,
    salaryAdvanceSettingsTable: {} as Record<string, never>, salaryAdvancesTable: {} as Record<string, never>,
    salaryComponentsTable: {} as Record<string, never>, salaryHistoryTable: {} as Record<string, never>,
    salaryStructuresTable: {} as Record<string, never>, saleItemsTable: {} as Record<string, never>,
    saleReturnItemsTable: {} as Record<string, never>, salesReturnsTable: {} as Record<string, never>,
    salesTable: {} as Record<string, never>, shiftSchedulesTable: {} as Record<string, never>,
    statutoryContributionsTable: {} as Record<string, never>, stockCountItemsTable: {} as Record<string, never>,
    stockCountSessionsTable: {} as Record<string, never>, stockMovementsTable: {} as Record<string, never>,
    stockTransferItemsTable: {} as Record<string, never>, stockTransfersTable: {} as Record<string, never>,
    suppliersTable: {} as Record<string, never>, systemSettingsTable: {} as Record<string, never>,
    taxBracketsTable: {} as Record<string, never>, transactionsTable: {} as Record<string, never>,
    treasuryVouchersTable: {} as Record<string, never>, warehousesTable: {} as Record<string, never>,
  };
});

/* ── Auth middleware mocks ──────────────────────────────────────────── */
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/auth')>('../../middleware/auth');
  return {
    ...actual,
    authenticate: vi.fn((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = {
        id: 1, role: mockRole(), company_id: null,
        username: 'admin', name: 'Admin',
      };
      next();
    }),
    requireRole: vi.fn((..._roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
      const userRole = (req as Request & { user: { role: string } }).user?.role ?? '';
      if (_roles.includes(userRole)) return next();
      res.status(403).json({ error: 'Forbidden' });
    }),
    requireTenant:       vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    superAdminIPGuard:   vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
    sanitizeBody:        vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  };
});

vi.mock('../../middleware/tenant-guard', () => ({
  tenantGuard:           vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  invalidateTenantCache: vi.fn(),
}));
vi.mock('../../middleware/email-verify-guard', () => ({
  emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../middleware/per-tenant-rate-limit', () => ({
  perTenantRateLimit: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../middleware/request-timeout', () => ({
  requestTimeout: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));
vi.mock('../../lib/rate-limit-store', () => ({
  makeRateLimitStore: vi.fn(() => undefined),
}));
vi.mock('../../lib/telegram-alert-manager', () => ({
  alertManager:  { send: vi.fn() },
  ALERT_TYPES:   { SERVER_SLOW: 'server_slow' },
}));
vi.mock('../../lib/swagger-spec', () => ({ swaggerSpec: {} }));
vi.mock('../../lib/session-blacklist', () => ({
  isTokenBlacklisted:   vi.fn().mockResolvedValue(false),
  addToBlacklist:       vi.fn(),
  cleanExpiredTokens:   vi.fn(),
}));
vi.mock('../../lib/totp', () => ({
  generateTOTP:  vi.fn(),
  verifyTOTP:    vi.fn(),
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn(),
}));
vi.mock('../../lib/job-queue', () => ({
  getQueueStats: vi.fn(() => ({ total: 0, queued: 0, running: 0, done: 0, failed: 0 })),
  enqueueJob:    vi.fn(),
  getJobStatus:  vi.fn(),
}));

/* ── Import app AFTER mocks ─────────────────────────────────────────── */
import app from '../../app';

/* ═══════════════════════════════════════════════════════════════════════
   GET /api/metrics
═══════════════════════════════════════════════════════════════════════ */
describe('GET /api/metrics', () => {
  beforeEach(() => {
    mockRole.mockReturnValue('super_admin');
  });

  it('returns 200 with all required top-level keys', async () => {
    const res = await request(app)
      .get('/api/metrics')
      .set('Cookie', 'token=mock-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('health');
    expect(res.body).toHaveProperty('requests');
    expect(res.body).toHaveProperty('jobs');
    expect(res.body).toHaveProperty('system');
  });

  it('includes extended request metrics', async () => {
    const res = await request(app)
      .get('/api/metrics')
      .set('Cookie', 'token=mock-token');

    expect(res.status).toBe(200);
    const { requests } = res.body as {
      requests: Record<string, unknown>;
    };
    expect(requests).toHaveProperty('requests_per_minute');
    expect(requests).toHaveProperty('error_rate_percentage');
    expect(requests).toHaveProperty('slowest_endpoints');
    expect(Array.isArray(requests.slowest_endpoints)).toBe(true);
    expect(typeof requests.requests_per_minute).toBe('number');
    expect(typeof requests.error_rate_percentage).toBe('number');
  });

  it('includes system fields', async () => {
    const res = await request(app)
      .get('/api/metrics')
      .set('Cookie', 'token=mock-token');

    expect(res.status).toBe(200);
    const { system } = res.body as {
      system: Record<string, unknown>;
    };
    expect(system).toHaveProperty('memory_usage_mb');
    expect(system).toHaveProperty('uptime_hours');
    expect(system).toHaveProperty('active_connections');
  });

  it('returns 403 for non-admin roles', async () => {
    mockRole.mockReturnValue('cashier');
    const res = await request(app)
      .get('/api/metrics')
      .set('Cookie', 'token=mock-token');
    expect(res.status).toBe(403);
  });

  it('admin role can access metrics', async () => {
    mockRole.mockReturnValue('admin');
    const res = await request(app)
      .get('/api/metrics')
      .set('Cookie', 'token=mock-token');
    expect(res.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   GET /api/metrics/prometheus
═══════════════════════════════════════════════════════════════════════ */
describe('GET /api/metrics/prometheus', () => {
  beforeEach(() => {
    mockRole.mockReturnValue('super_admin');
  });

  it('returns 200 with Prometheus text Content-Type', async () => {
    const res = await request(app)
      .get('/api/metrics/prometheus')
      .set('Cookie', 'token=mock-token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('includes all required Prometheus metric names', async () => {
    const res = await request(app)
      .get('/api/metrics/prometheus')
      .set('Cookie', 'token=mock-token');

    expect(res.text).toContain('request_count_total');
    expect(res.text).toContain('response_time_ms');
    expect(res.text).toContain('error_count_total');
    expect(res.text).toContain('active_connections');
    expect(res.text).toContain('memory_usage_bytes');
    expect(res.text).toContain('uptime_seconds');
  });

  it('includes HELP and TYPE annotations', async () => {
    const res = await request(app)
      .get('/api/metrics/prometheus')
      .set('Cookie', 'token=mock-token');

    expect(res.text).toContain('# HELP');
    expect(res.text).toContain('# TYPE');
  });

  it('includes summary quantile labels for response_time_ms', async () => {
    const res = await request(app)
      .get('/api/metrics/prometheus')
      .set('Cookie', 'token=mock-token');

    expect(res.text).toContain('quantile="0.5"');
    expect(res.text).toContain('quantile="0.95"');
    expect(res.text).toContain('quantile="0.99"');
  });

  it('returns 403 for admin role (super_admin only)', async () => {
    mockRole.mockReturnValue('admin');
    const res = await request(app)
      .get('/api/metrics/prometheus')
      .set('Cookie', 'token=mock-token');
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-privileged roles', async () => {
    mockRole.mockReturnValue('cashier');
    const res = await request(app)
      .get('/api/metrics/prometheus')
      .set('Cookie', 'token=mock-token');
    expect(res.status).toBe(403);
  });
});
