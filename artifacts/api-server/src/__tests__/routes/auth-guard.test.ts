/**
 * auth-guard.test.ts — Direct unit tests for superAdminIPGuard (auth.ts lines 409-443).
 *
 * Since superAdminIPGuard is not mounted on any HTTP route, we call it directly
 * with mock req/res/next to exercise every branch in the function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Minimal @workspace/db mock (needed for auth.ts to load) ──────────────────
vi.mock('@workspace/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  pool: {
    connect: vi.fn().mockResolvedValue({ query: vi.fn(), release: vi.fn() }),
    end:     vi.fn(),
    query:   vi.fn(),
  },
  erpUsersTable:  {} as Record<string, never>,
  companiesTable: {} as Record<string, never>,
}));

vi.mock('../../lib/db-context', () => ({
  setDbContext:   vi.fn().mockResolvedValue(undefined),
  clearDbContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/session-blacklist', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  blacklistToken:     vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import the ACTUAL superAdminIPGuard (not mocked) so coverage is measured
import { superAdminIPGuard } from '../../middleware/auth';

// ── Helper builders ───────────────────────────────────────────────────────────

function makeReq(ip: string): Partial<Request> {
  return {
    ip,
    socket: { remoteAddress: ip } as Request['socket'],
  };
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json:   vi.fn().mockReturnThis(),
  };
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('superAdminIPGuard — no SUPER_ADMIN_IPS configured', () => {
  beforeEach(() => {
    delete process.env.SUPER_ADMIN_IPS;
  });

  it('يجب أن يستدعي next() في بيئة غير إنتاجية بدون قائمة IP — سطر 423-424', () => {
    // NODE_ENV=test, no allowedIPs → non-production path → next()
    const req  = makeReq('127.0.0.1');
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    superAdminIPGuard(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('يجب أن يرفض الطلب في بيئة الإنتاج بدون قائمة IP — سطر 418-421', () => {
    // NODE_ENV=production, no allowedIPs → fail-closed → 403
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const req  = makeReq('1.2.3.4');
      const res  = makeRes();
      const next = vi.fn() as unknown as NextFunction;

      superAdminIPGuard(req as Request, res as unknown as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe('superAdminIPGuard — SUPER_ADMIN_IPS configured', () => {
  afterEach(() => {
    delete process.env.SUPER_ADMIN_IPS;
  });

  it('يجب أن يستدعي next() عند تطابق عنوان IP — سطر 443', () => {
    process.env.SUPER_ADMIN_IPS = '192.168.1.100,10.0.0.1';

    const req  = makeReq('10.0.0.1');
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    superAdminIPGuard(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('يجب أن يرفض الطلب عند عدم تطابق عنوان IP — سطر 437-440', () => {
    process.env.SUPER_ADMIN_IPS = '192.168.1.100,10.0.0.1';

    const req  = makeReq('8.8.8.8');
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    superAdminIPGuard(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('يجب تطبيع عنوان IPv6 المُعيَّن على IPv4 قبل المقارنة — سطر 435', () => {
    // "::ffff:192.168.1.100" → stripped to "192.168.1.100" → matches
    process.env.SUPER_ADMIN_IPS = '192.168.1.100';

    const req  = makeReq('::ffff:192.168.1.100');
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    superAdminIPGuard(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('يجب أن يرفض الطلب عند غياب عنوان IP في الطلب — سطر 437', () => {
    process.env.SUPER_ADMIN_IPS = '192.168.1.100';

    // No IP at all
    const req: Partial<Request> = {
      ip: undefined,
      socket: { remoteAddress: undefined } as unknown as Request['socket'],
    };
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    superAdminIPGuard(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ── requireTenant — direct unit tests (auth.ts lines 352-368) ────────────────
// Import the actual requireTenant from auth.ts (same unmocked import as above)

import { requireTenant } from '../../middleware/auth';
import { hasPermission } from '../../lib/permissions';

describe('requireTenant — req.user is undefined (auth.ts lines 354-355)', () => {
  it('يجب أن يرجع 401 عند غياب المستخدم في الطلب', () => {
    const req: Partial<Request> = {};
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireTenant(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

describe('requireTenant — super_admin passes through (auth.ts line 358-360)', () => {
  it('يجب أن يستدعي next() للمشرف العام بدون company_id', () => {
    const req: Partial<Request> = {
      user: {
        id: 99, name: 'Super', username: 'super',
        role: 'super_admin', permissions: '{}', active: true,
        warehouse_id: null, safe_id: null, company_id: null as unknown as number,
        employee_id: null,
      },
    };
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireTenant(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireTenant — non-super_admin with no company_id (auth.ts lines 362-364)', () => {
  it('يجب أن يرجع 403 لمستخدم عادي بدون company_id', () => {
    const req: Partial<Request> = {
      user: {
        id: 1, name: 'Test', username: 'test',
        role: 'admin', permissions: '{}', active: true,
        warehouse_id: null, safe_id: null,
        company_id: null as unknown as number,
        employee_id: null,
      },
    };
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireTenant(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireTenant — normal user with valid company_id (auth.ts line 366)', () => {
  it('يجب أن يستدعي next() ويُعيّن req.companyId للمستخدم العادي', () => {
    const req: Partial<Request> = {
      user: {
        id: 1, name: 'Test', username: 'test',
        role: 'admin', permissions: '{}', active: true,
        warehouse_id: 1, safe_id: 1, company_id: 5, employee_id: null,
      },
    };
    const res  = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireTenant(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as Request & { companyId: number }).companyId).toBe(5);
  });
});

// ── hasPermission — direct unit tests (permissions.ts lines 301, 315, 325) ───

describe('hasPermission — user is undefined (permissions.ts line 301)', () => {
  it('يجب أن يرجع false عند غياب المستخدم', () => {
    expect(hasPermission(undefined, 'can_view_sales')).toBe(false);
  });
});

describe('hasPermission — explicit false override (permissions.ts line 315)', () => {
  it('يجب أن يرجع false عند التعطيل الصريح للصلاحية', () => {
    const user = {
      id: 1, name: 'Test', username: 'test',
      role: 'admin', permissions: '{"can_view_sales":false}', active: true,
      warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
    };
    // admin has can_view_sales:true in ROLE_DEFAULTS, but explicit false wins
    expect(hasPermission(user, 'can_view_sales')).toBe(false);
  });
});

describe('hasPermission — explicit true override (permissions.ts line 313)', () => {
  it('يجب أن يرجع true عند التفعيل الصريح للصلاحية', () => {
    const user = {
      id: 1, name: 'Test', username: 'test',
      role: 'cashier', permissions: '{"can_create_sale":true}', active: true,
      warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
    };
    // cashier normally cannot create sales, but explicit true wins
    expect(hasPermission(user, 'can_create_sale')).toBe(true);
  });
});

describe('hasPermission — unknown permission for unknown role (permissions.ts line 325)', () => {
  it('يجب أن يرجع false للصلاحية غير المعروفة بدور غير موجود', () => {
    const user = {
      id: 1, name: 'Test', username: 'test',
      role: 'unknown_custom_role', permissions: '{}', active: true,
      warehouse_id: null, safe_id: null, company_id: 1, employee_id: null,
    };
    // unknown_custom_role not in ROLE_DEFAULTS → roleDefaults={} → line 325 return false
    expect(hasPermission(user, 'can_view_sales')).toBe(false);
  });
});

describe('hasPermission — invalid permissions JSON falls back to role defaults', () => {
  it('يجب أن يتجاهل JSON الغير صالح ويعتمد على الدور الافتراضي', () => {
    const user = {
      id: 1, name: 'Test', username: 'test',
      role: 'admin', permissions: 'not-valid-json', active: true,
      warehouse_id: 1, safe_id: 1, company_id: 1, employee_id: null,
    };
    // JSON.parse fails → catch block → perms stays {} → role defaults for admin
    expect(hasPermission(user, 'can_view_sales')).toBe(true);
  });
});
