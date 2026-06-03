import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const { mockChainData, mockHasPermission } = vi.hoisted(() => ({
  mockChainData: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  mockHasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@workspace/db', () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain), where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain), limit: vi.fn(() => chain),
      offset: mockChainData, innerJoin: vi.fn(() => chain), leftJoin: vi.fn(() => chain),
      then: (onF: (v: unknown[]) => unknown, onR?: (e: unknown) => unknown) => mockChainData().then(onF, onR),
      catch: (fn: (e: unknown) => unknown) => mockChainData().catch(fn),
      finally: (fn: () => void) => mockChainData().finally(fn),
    };
    return chain;
  };
  const txMock: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ rows: [] }),
  };
  const db = {
    select: vi.fn(() => makeChain()), insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
  };
  return {
    db, pool: { end: vi.fn(), query: vi.fn(), connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }) },
    attendanceRecordsTable: {}, shiftSchedulesTable: {}, employeeShiftAssignmentsTable: {},
    overtimeRecordsTable: {}, publicHolidaysTable: {}, attendanceSummaryTable: {},
    employeesTable: {}, accountsTable: {}, auditLogsTable: {},
    companiesTable: {}, branchesTable: {}, productsTable: {}, categoriesTable: {},
    customersTable: {}, warehousesTable: {}, stockMovementsTable: {}, salesTable: {},
    saleItemsTable: {}, purchasesTable: {}, purchaseItemsTable: {}, expensesTable: {},
    suppliersTable: {}, journalEntriesTable: {}, journalEntryLinesTable: {},
    erpUsersTable: {}, systemSettingsTable: {}, devicesTable: {},
  };
});


vi.mock('../../middleware/tenant-guard', () => ({ tenantGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()), invalidateTenantCache: vi.fn() }));
vi.mock('../../middleware/email-verify-guard', () => ({ emailVerifyGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()) }));
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth') as Record<string, unknown>;
  return { ...actual, authenticate: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()), superAdminIPGuard: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()) };
});
vi.mock('../../lib/audit-log', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/period-lock', () => ({ assertPeriodOpen: vi.fn().mockResolvedValue(undefined), invalidateClosingDateCache: vi.fn() }));
vi.mock('../../lib/permissions', () => ({ hasPermission: mockHasPermission }));
vi.mock('../../middleware/feature-guard', () => ({ requireFeature: vi.fn(() => vi.fn((_req: Request, _res: Response, next: NextFunction) => next())), invalidateFeatureCache: vi.fn() }));
vi.mock('../../lib/notify', () => ({ notifyEmployee: vi.fn().mockResolvedValue(undefined), notifyManagers: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../lib/employee-self', () => ({ selfEmployeeId: vi.fn().mockReturnValue(null), isSelfServiceUser: vi.fn().mockReturnValue(false) }));
vi.mock('../../lib/invoice-no', () => ({ nextInvoiceNo: vi.fn().mockResolvedValue('INV-001') }));
vi.mock('../../lib/warehouse-guard', () => ({ resolveTenantWarehouseId: vi.fn().mockResolvedValue(1) }));
vi.mock('../../lib/auto-account', () => ({ getOrCreateAccount: vi.fn().mockResolvedValue({ id: 1 }), createAutoJournalEntry: vi.fn().mockResolvedValue({ id: 1 }) }));
vi.mock('../../lib/ledger-balance', () => ({ getCustomerLedgerBalance: vi.fn().mockResolvedValue(0) }));
vi.mock('../../lib/backup-service', () => ({ triggerBackup: vi.fn(), scheduleBackup: vi.fn() }));
vi.mock('../../lib/alert-service', () => ({ runAllChecks: vi.fn(), checkHealthCritical: vi.fn().mockResolvedValue([]) }));

import { authenticate } from '../../middleware/auth';
import type { AuthUser } from '../../middleware/auth';
import { db } from '@workspace/db';

const dbMock = db as unknown as { execute: ReturnType<typeof vi.fn>; returning: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };

const adminUser: AuthUser = { id: 1, name: 'Admin', username: 'admin', role: 'admin', permissions: '{}', active: true, warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: 10 };
const adminUserB: AuthUser = { id: 2, name: 'Admin B', username: 'admin_b', role: 'admin', permissions: '{}', active: true, warehouse_id: 2, safe_id: 2, company_id: 2, employee_id: null };


// ═══════════════════════════════════════════════════════════════════
// SECTION A — POST /api/shifts
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/shifts', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/shifts').set('Authorization', 'Bearer test-token').send({ name_ar: 'وردية صباحية', start_time: '08:00', end_time: '16:00' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع 400 عند بيانات غير صحيحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/shifts').set('Authorization', 'Bearer test-token').send({ name_ar: '', start_time: 'invalid', end_time: '16:00' });
    expect(res.status).toBe(400);
  });

  it('يجب أن يُنشئ وردية بنجاح ويرجع 201', async () => {
    dbMock.returning.mockResolvedValue([{ id: 1, company_id: 1, name_ar: 'وردية صباحية', start_time: '08:00', end_time: '16:00', weekly_hours: '40', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/shifts').set('Authorization', 'Bearer test-token').send({ name_ar: 'وردية صباحية', start_time: '08:00', end_time: '16:00' });
    expect(res.status).toBe(201);
    expect(res.body.name_ar).toBe('وردية صباحية');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION B — GET /api/shifts
// ═══════════════════════════════════════════════════════════════════
describe('GET /api/shifts', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع قائمة الورديات بنجاح', async () => {
    mockChainData.mockResolvedValue([{ id: 1, name_ar: 'وردية صباحية', start_time: '08:00', end_time: '16:00', weekly_hours: '40', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).get('/api/shifts').set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].weekly_hours).toBe(40);
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION C — POST /api/attendance/check-in
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/attendance/check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع 400 إذا كان الحساب غير مرتبط بموظف', async () => {
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: AuthUser }).user = { ...adminUser, employee_id: null };
      next();
    });
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/check-in').set('Authorization', 'Bearer test-token').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('غير مرتبط بموظف');
  });

  it('يجب أن يرجع 404 إذا كان الموظف غير موجود', async () => {
    mockChainData.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/check-in').set('Authorization', 'Bearer test-token').send({ employee_id: 10 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('الموظف غير موجود');
  });

  it('يجب أن يرجع 409 إذا تم تسجيل الحضور مسبقاً', async () => {
    mockChainData
      .mockResolvedValueOnce([{ id: 10 }]) // employee exists
      .mockResolvedValueOnce([{ id: 1 }]); // existing attendance record
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/check-in').set('Authorization', 'Bearer test-token').send({ employee_id: 10, attendance_date: '2024-06-01' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('تم تسجيل الحضور لهذا اليوم مسبقاً');
  });

  it('يجب أن يُسجل الحضور بنجاح ويرجع 201', async () => {
    mockChainData
      .mockResolvedValueOnce([{ id: 10 }]) // employee exists
      .mockResolvedValueOnce([]) // no existing record
      .mockResolvedValueOnce([]); // no shift assignment
    dbMock.returning.mockResolvedValue([{ id: 1, employee_id: 10, attendance_date: '2024-06-01', check_in_time: '08:00', status: 'present', late_minutes: 0, created_at: new Date(), updated_at: null }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/check-in').set('Authorization', 'Bearer test-token').send({ employee_id: 10, attendance_date: '2024-06-01', check_in_time: '08:00' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('present');
  });
});


// ═══════════════════════════════════════════════════════════════════
// SECTION D — POST /api/attendance/check-out
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/attendance/check-out', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرجع 404 إذا لم يوجد تسجيل حضور', async () => {
    mockChainData.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/check-out').set('Authorization', 'Bearer test-token').send({ employee_id: 10, attendance_date: '2024-06-01' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('لا يوجد تسجيل حضور لهذا اليوم');
  });

  it('يجب أن يرجع 409 إذا تم تسجيل الانصراف مسبقاً', async () => {
    mockChainData.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([{ id: 1, check_in_time: '08:00', check_out_time: '16:00' }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/check-out').set('Authorization', 'Bearer test-token').send({ employee_id: 10, attendance_date: '2024-06-01' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('تم تسجيل الانصراف مسبقاً');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION E — PUT /api/attendance/records/:id
// ═══════════════════════════════════════════════════════════════════
describe('PUT /api/attendance/records/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).put('/api/attendance/records/1').set('Authorization', 'Bearer test-token').send({ status: 'present' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('غير مصرح');
  });

  it('يجب أن يرجع 404 إذا كان السجل غير موجود', async () => {
    dbMock.returning.mockResolvedValue([]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).put('/api/attendance/records/999').set('Authorization', 'Bearer test-token').send({ status: 'present' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('السجل غير موجود');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION F — POST /api/attendance/overtime
// ═══════════════════════════════════════════════════════════════════
describe('POST /api/attendance/overtime', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mockChainData.mockResolvedValue([]); mockHasPermission.mockReturnValue(true);
    vi.mocked(authenticate).mockImplementation((req: Request, _res: Response, next: NextFunction) => { (req as Request & { user: AuthUser }).user = adminUser; next(); });
  });

  it('يجب أن يرفض 403 بدون صلاحية can_manage_employees', async () => {
    mockHasPermission.mockReturnValue(false);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/overtime').set('Authorization', 'Bearer test-token').send({ employee_id: 10, date: '2024-06-01', hours: 2 });
    expect(res.status).toBe(403);
  });

  it('يجب أن يرجع 400 عند بيانات غير صحيحة', async () => {
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/overtime').set('Authorization', 'Bearer test-token').send({ employee_id: 10, date: 'invalid', hours: 2 });
    expect(res.status).toBe(400);
  });

  it('يجب أن يسجل عمل إضافي بنجاح ويرجع 201', async () => {
    dbMock.returning.mockResolvedValue([{ id: 1, employee_id: 10, date: '2024-06-01', hours: '2', status: 'approved', created_at: new Date() }]);
    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;
    const res = await request(app).post('/api/attendance/overtime').set('Authorization', 'Bearer test-token').send({ employee_id: 10, date: '2024-06-01', hours: 2 });
    expect(res.status).toBe(201);
    expect(res.body.hours).toBe(2);
  });
});
