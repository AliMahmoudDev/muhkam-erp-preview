import { describe, it, expect, vi, beforeEach } from 'vitest';

// Each test file that imports from app needs the DB mock
vi.mock('@workspace/db', () => {
  const txMock: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{}]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn(async (fn: any) => fn(txMock)),
    },
    pool: { end: vi.fn(), query: vi.fn() },
    accountsTable: {} as any,
    companiesTable: {} as any,
    erpUsersTable: {} as any,
    systemSettingsTable: {} as any,
  };
});

describe('CORS fail-closed in production', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('يجب أن يمنع CORS في production عند عدم ضبط ALLOWED_ORIGINS', async () => {
    // Set production env with no ALLOWED_ORIGINS
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/healthz')
      .set('Origin', 'https://evil-site.com');

    // CORS should block: no Access-Control-Allow-Origin header
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    // Restore
    process.env.NODE_ENV = 'test';
  });

  it('يجب أن يسمح بالأصل المدرج في القائمة البيضاء في production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://app.muhkam.com';

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/healthz')
      .set('Origin', 'https://app.muhkam.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://app.muhkam.com');

    // Restore
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOWED_ORIGINS;
  });

  it('يجب أن يسمح بكل الأصول في development عند عدم ضبط ALLOWED_ORIGINS', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    const res = await request(app)
      .get('/api/healthz')
      .set('Origin', 'https://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('https://localhost:3000');

    // Restore
    process.env.NODE_ENV = 'test';
  });

  it('يجب أن يسمح بالطلبات بدون Origin header (server-to-server)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;

    const request = (await import('supertest')).default;
    const app = (await import('../../app')).default;

    // No Origin header — server-to-server call
    const res = await request(app).get('/api/healthz');

    // Should not be blocked (no CORS rejection for same-origin / no-origin)
    expect(res.status).not.toBe(403);

    // Restore
    process.env.NODE_ENV = 'test';
  });
});
