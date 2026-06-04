import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Hoisted mock controls ─────────────────────────────────────────────────────
// captureArgs يلتقط آخر سلسلة استعلام (where/orderBy/limit) للتأكيد عليها.
const { mockRows, captureArgs } = vi.hoisted(() => ({
  mockRows: vi.fn<[], Promise<unknown[]>>().mockResolvedValue([]),
  captureArgs: { whereArg: undefined as unknown, limitArg: undefined as unknown },
}));

// ── @workspace/db mock ────────────────────────────────────────────────────────
vi.mock('@workspace/db', () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {
      from:    vi.fn(() => chain),
      where:   vi.fn((arg: unknown) => { captureArgs.whereArg = arg; return chain; }),
      orderBy: vi.fn(() => chain),
      limit:   vi.fn((arg: unknown) => { captureArgs.limitArg = arg; return mockRows(); }),
    };
    return chain;
  };
  return {
    db: { select: vi.fn(() => makeChain()) },
    transactionsTable: {
      company_id:    'company_id',
      safe_id:       'safe_id',
      direction:     'direction',
      type:          'type',
      date:          'date',
      description:   'description',
      customer_name: 'customer_name',
      created_at:    'created_at',
    },
  };
});

import express from 'express';
import financialTransactionsRouter from '../../routes/financial-transactions';
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
const noCompanyUser: AuthUser = {
  id: 99, name: 'No Company', username: 'nocompany',
  role: 'cashier', permissions: '{}', active: true,
  warehouse_id: null, safe_id: null, company_id: null, employee_id: null,
};

// يبني تطبيق Express صغيراً يحقن المستخدم ثم يركّب الراوتر تحت الاختبار.
function buildApp(user: AuthUser | null) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (user) (req as Request & { user: AuthUser }).user = user;
    next();
  });
  app.use('/api', financialTransactionsRouter);
  // معالج أخطاء بسيط يحوّل الأخطاء التي يرميها getTenant إلى رمز الحالة الصحيح.
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status ?? 500).json({ error: err.message });
  });
  return app;
}

const sampleRow = {
  id: 1, company_id: 1, safe_id: 1, direction: 'in', type: 'sale',
  amount: '250.50', date: '2024-01-20', description: 'بيع نقدي',
  customer_name: 'عميل اختبار',
  created_at: new Date('2024-01-20T10:00:00.000Z'),
};

describe('GET /api/financial-transactions', () => {
  beforeEach(() => {
    mockRows.mockResolvedValue([]);
    captureArgs.whereArg = undefined;
    captureArgs.limitArg = undefined;
  });

  it('يرجع 200 ومصفوفة الحركات المالية مع تنسيق amount كرقم و created_at كـ ISO', async () => {
    mockRows.mockResolvedValue([sampleRow]);
    const request = (await import('supertest')).default;
    const res = await request(buildApp(adminUserA)).get('/api/financial-transactions');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe(250.5);
    expect(typeof res.body[0].amount).toBe('number');
    expect(res.body[0].created_at).toBe('2024-01-20T10:00:00.000Z');
  });

  it('يرجع مصفوفة فارغة عند عدم وجود حركات', async () => {
    const request = (await import('supertest')).default;
    const res = await request(buildApp(adminUserA)).get('/api/financial-transactions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('يرفض الطلب بـ 403 عندما لا يمكن تحديد المستأجر (لا company_id)', async () => {
    const request = (await import('supertest')).default;
    const res = await request(buildApp(noCompanyUser)).get('/api/financial-transactions');
    expect(res.status).toBe(403);
  });

  it('يحدّ النتائج بحد أقصى 2000 حتى مع طلب limit أكبر', async () => {
    const request = (await import('supertest')).default;
    await request(buildApp(adminUserA)).get('/api/financial-transactions?limit=999999');
    expect(captureArgs.limitArg).toBe(2000);
  });

  it('يستخدم الحد الافتراضي 500 عند غياب معامل limit', async () => {
    const request = (await import('supertest')).default;
    await request(buildApp(adminUserA)).get('/api/financial-transactions');
    expect(captureArgs.limitArg).toBe(500);
  });

  it('يطبّق حداً أدنى 1 على limit عند تمرير قيمة غير صالحة', async () => {
    const request = (await import('supertest')).default;
    await request(buildApp(adminUserA)).get('/api/financial-transactions?limit=0');
    expect(captureArgs.limitArg).toBe(1);
  });

  it('يبني شرط where (عزل المستأجر + الفلاتر) عند تمرير فلاتر متعددة', async () => {
    const request = (await import('supertest')).default;
    const res = await request(buildApp(adminUserA))
      .get('/api/financial-transactions?safe_id=5&direction=in&type=sale&from=2024-01-01&to=2024-12-31&search=عميل');
    expect(res.status).toBe(200);
    expect(captureArgs.whereArg).toBeDefined();
  });

  it('يعزل بيانات المستأجر — company B تحصل على استعلام مختلف عن company A', async () => {
    mockRows.mockResolvedValue([sampleRow]);
    const request = (await import('supertest')).default;

    const resA = await request(buildApp(adminUserA)).get('/api/financial-transactions');
    const whereArgA = captureArgs.whereArg;

    captureArgs.whereArg = undefined;

    const resB = await request(buildApp(adminUserB)).get('/api/financial-transactions');
    const whereArgB = captureArgs.whereArg;

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(whereArgA).toBeDefined();
    expect(whereArgB).toBeDefined();
    expect(JSON.stringify(whereArgA)).not.toEqual(JSON.stringify(whereArgB));
  });

  it('يرجع 403 عند عدم تمرير مستخدم (req.user غير موجود)', async () => {
    const request = (await import('supertest')).default;
    const res = await request(buildApp(null)).get('/api/financial-transactions');
    expect(res.status).toBe(403);
  });
});
