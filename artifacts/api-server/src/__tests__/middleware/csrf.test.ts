/**
 * اختبارات وحدة وسيط CSRF (double-submit cookie)
 *
 * يتحقق من:
 *  - رفض طلب POST بدون رمز CSRF
 *  - رفض طلب POST برمز CSRF غير مطابق
 *  - قبول طلب POST برمز CSRF صحيح
 *  - عدم تأثير CSRF على طلبات GET
 *  - استثناء مسارات تسجيل الدخول
 *  - استثناء طلبات Bearer-only
 *  - استثناء طلبات الموبايل
 *  - ضبط كوكي csrf_token تلقائياً
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { csrfProtection, CSRF_CONFIG } from "../../middleware/csrf";

/* ── Mock logger to suppress output ── */
vi.mock("../../lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/* ── Helper: create mock request ── */
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/test",
    headers: {},
    cookies: {},
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

/* ── Helper: create mock response ── */
function mockRes(): Response & { statusCode: number; body: unknown; cookies: Record<string, { value: string; options: object }> } {
  const res: any = {
    statusCode: 200,
    body: null,
    cookies: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    cookie(name: string, value: string, options: object) {
      res.cookies[name] = { value, options };
      return res;
    },
  };
  return res;
}

describe("CSRF Middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  /* ════════════════════════════════════════════════════════════════
     GET requests — should always pass through
  ════════════════════════════════════════════════════════════════ */

  describe("Safe methods (GET/HEAD/OPTIONS)", () => {
    it("allows GET requests without CSRF token", () => {
      const req = mockReq({ method: "GET", path: "/api/products" });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it("allows HEAD requests without CSRF token", () => {
      const req = mockReq({ method: "HEAD", path: "/api/health" });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows OPTIONS requests without CSRF token", () => {
      const req = mockReq({ method: "OPTIONS", path: "/api/sales" });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  /* ════════════════════════════════════════════════════════════════
     POST without CSRF token — should be REJECTED
  ════════════════════════════════════════════════════════════════ */

  describe("State-changing requests without CSRF token", () => {
    it("rejects POST without CSRF token (403)", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/products",
        cookies: { csrf_token: "abc123", access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect((res.body as { code?: string })?.code).toBe("CSRF_INVALID");
    });

    it("rejects PUT without CSRF header", () => {
      const req = mockReq({
        method: "PUT",
        path: "/api/products/1",
        cookies: { csrf_token: "abc123", access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it("rejects DELETE without CSRF header", () => {
      const req = mockReq({
        method: "DELETE",
        path: "/api/products/1",
        cookies: { csrf_token: "abc123", access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it("rejects PATCH without CSRF header", () => {
      const req = mockReq({
        method: "PATCH",
        path: "/api/employees/1/status",
        cookies: { csrf_token: "abc123", access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });
  });

  /* ════════════════════════════════════════════════════════════════
     POST with mismatched CSRF token — should be REJECTED
  ════════════════════════════════════════════════════════════════ */

  describe("Mismatched CSRF token", () => {
    it("rejects POST when header token doesn't match cookie", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/sales",
        cookies: { csrf_token: "correct-token-value", access_token: "jwt..." },
        headers: { "x-csrf-token": "wrong-token-value" },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect((res.body as { error?: string })?.error).toContain("CSRF");
    });
  });

  /* ════════════════════════════════════════════════════════════════
     POST with VALID CSRF token — should PASS
  ════════════════════════════════════════════════════════════════ */

  describe("Valid CSRF token", () => {
    it("allows POST when header matches cookie token", () => {
      const token = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
      const req = mockReq({
        method: "POST",
        path: "/api/sales",
        cookies: { csrf_token: token, access_token: "jwt..." },
        headers: { "x-csrf-token": token },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it("allows PUT when header matches cookie token", () => {
      const token = "deadbeef".repeat(8);
      const req = mockReq({
        method: "PUT",
        path: "/api/products/42",
        cookies: { csrf_token: token, access_token: "jwt..." },
        headers: { "x-csrf-token": token },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows DELETE when header matches cookie token", () => {
      const token = "cafebabe".repeat(8);
      const req = mockReq({
        method: "DELETE",
        path: "/api/customers/5",
        cookies: { csrf_token: token, access_token: "jwt..." },
        headers: { "x-csrf-token": token },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  /* ════════════════════════════════════════════════════════════════
     Exempt paths — should pass without CSRF
  ════════════════════════════════════════════════════════════════ */

  describe("Exempt paths (login, health, refresh)", () => {
    it("allows POST /api/auth/login without CSRF token", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/auth/login",
        cookies: { access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows POST /api/auth/login/email without CSRF token", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/auth/login/email",
        cookies: { access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows POST /api/auth/refresh without CSRF token", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/auth/refresh",
        cookies: { access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows POST /api/auth/2fa/login without CSRF token", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/auth/2fa/login",
        cookies: { access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  /* ════════════════════════════════════════════════════════════════
     Bearer-only requests — should pass without CSRF
  ════════════════════════════════════════════════════════════════ */

  describe("Bearer-only requests (no cookies)", () => {
    it("allows POST with Authorization header and no access_token cookie", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/products",
        headers: { authorization: "Bearer eyJhbGciOi..." },
        cookies: {},
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  /* ════════════════════════════════════════════════════════════════
     Mobile client (x-client: mobile) — should pass without CSRF
  ════════════════════════════════════════════════════════════════ */

  describe("Mobile client requests", () => {
    it("allows POST with x-client: mobile header without CSRF", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/sales",
        headers: { "x-client": "mobile" },
        cookies: { access_token: "jwt..." },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  /* ════════════════════════════════════════════════════════════════
     Cookie issuance — should set csrf_token cookie on first visit
  ════════════════════════════════════════════════════════════════ */

  describe("CSRF cookie issuance", () => {
    it("sets csrf_token cookie when not present", () => {
      const req = mockReq({ method: "GET", path: "/api/products", cookies: {} });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(res.cookies[CSRF_CONFIG.cookieName]).toBeDefined();
      expect(res.cookies[CSRF_CONFIG.cookieName].value).toHaveLength(64); // 32 bytes hex
      expect(res.cookies[CSRF_CONFIG.cookieName].options).toMatchObject({
        httpOnly: false,
        path: "/",
      });
    });

    it("does NOT overwrite existing csrf_token cookie", () => {
      const existingToken = "existing-csrf-token-value-here-1234567890123456789012345678";
      const req = mockReq({
        method: "GET",
        path: "/api/products",
        cookies: { csrf_token: existingToken },
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      // Should NOT have set a new cookie
      expect(res.cookies[CSRF_CONFIG.cookieName]).toBeUndefined();
    });
  });

  /* ════════════════════════════════════════════════════════════════
     Arabic error message
  ════════════════════════════════════════════════════════════════ */

  describe("Error message", () => {
    it("returns Arabic error message on CSRF failure", () => {
      const req = mockReq({
        method: "POST",
        path: "/api/expenses",
        cookies: { csrf_token: "token123", access_token: "jwt..." },
        headers: {},
      });
      const res = mockRes();

      csrfProtection(req, res, next);

      expect(res.statusCode).toBe(403);
      const body = res.body as { error?: string; code?: string };
      expect(body.error).toContain("أعد تحميل الصفحة");
      expect(body.code).toBe("CSRF_INVALID");
    });
  });
});
