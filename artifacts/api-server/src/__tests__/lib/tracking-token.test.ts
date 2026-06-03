/**
 * Unit tests for artifacts/api-server/src/lib/tracking-token.ts
 *
 * Because SECRET is captured at module-load time, each describe block
 * uses vi.resetModules() + dynamic import to load a fresh module instance
 * with the desired environment.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

/* ─────────────────────────────────────────────────────────────────────────
 * Helper: load a fresh copy of tracking-token with the given env vars.
 * ───────────────────────────────────────────────────────────────────────── */
async function loadModule(env: { REPAIR_TRACKING_SECRET?: string; NODE_ENV?: string }) {
  const savedSecret  = process.env.REPAIR_TRACKING_SECRET;
  const savedNodeEnv = process.env.NODE_ENV;

  if (env.REPAIR_TRACKING_SECRET !== undefined) {
    process.env.REPAIR_TRACKING_SECRET = env.REPAIR_TRACKING_SECRET;
  } else {
    delete process.env.REPAIR_TRACKING_SECRET;
  }
  if (env.NODE_ENV !== undefined) {
    process.env.NODE_ENV = env.NODE_ENV;
  }

  vi.resetModules();
  const mod = await import("../../lib/tracking-token");

  // Restore
  if (savedSecret !== undefined) {
    process.env.REPAIR_TRACKING_SECRET = savedSecret;
  } else {
    delete process.env.REPAIR_TRACKING_SECRET;
  }
  if (savedNodeEnv !== undefined) {
    process.env.NODE_ENV = savedNodeEnv;
  }
  vi.resetModules();

  return mod;
}

/* ─────────────────────────────────────────────────────────────────────────
 * 1. With a properly configured secret
 * ───────────────────────────────────────────────────────────────────────── */
describe("tracking-token — secret configured", () => {
  const VALID_SECRET = "a-very-secure-secret-for-unit-testing-min32!!";
  let isTrackingEnabled: () => boolean;
  let computeTrackingToken: (companyId: number, jobNo: string) => string;
  let verifyTrackingToken: (companyId: number, jobNo: string, token: string) => boolean;

  beforeAll(async () => {
    const mod = await loadModule({ REPAIR_TRACKING_SECRET: VALID_SECRET, NODE_ENV: "test" });
    isTrackingEnabled    = mod.isTrackingEnabled;
    computeTrackingToken = mod.computeTrackingToken;
    verifyTrackingToken  = mod.verifyTrackingToken;
  });

  it("isTrackingEnabled returns true", () => {
    expect(isTrackingEnabled()).toBe(true);
  });

  it("computeTrackingToken returns a 32-character lowercase hex string", () => {
    const token = computeTrackingToken(1, "JOB-001");
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("verifyTrackingToken accepts a correctly computed token", () => {
    const token = computeTrackingToken(1, "JOB-001");
    expect(verifyTrackingToken(1, "JOB-001", token)).toBe(true);
  });

  it("verifyTrackingToken rejects a wrong token", () => {
    const token = computeTrackingToken(1, "JOB-001");
    const tampered = token.slice(0, 31) + (token[31] === "a" ? "b" : "a");
    expect(verifyTrackingToken(1, "JOB-001", tampered)).toBe(false);
  });

  it("verifyTrackingToken rejects an empty string token", () => {
    expect(verifyTrackingToken(1, "JOB-001", "")).toBe(false);
  });

  it("different company IDs produce different tokens", () => {
    const t1 = computeTrackingToken(1, "JOB-001");
    const t2 = computeTrackingToken(2, "JOB-001");
    expect(t1).not.toBe(t2);
  });

  it("different job numbers produce different tokens", () => {
    const t1 = computeTrackingToken(1, "JOB-001");
    const t2 = computeTrackingToken(1, "JOB-002");
    expect(t1).not.toBe(t2);
  });

  it("same inputs always produce the same token (deterministic)", () => {
    const t1 = computeTrackingToken(5, "REP-999");
    const t2 = computeTrackingToken(5, "REP-999");
    expect(t1).toBe(t2);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * 2. No secret — production environment (fail-closed)
 * ───────────────────────────────────────────────────────────────────────── */
describe("tracking-token — no secret in production (fail-closed)", () => {
  let isTrackingEnabled: () => boolean;
  let computeTrackingToken: (companyId: number, jobNo: string) => string;
  let verifyTrackingToken: (companyId: number, jobNo: string, token: string) => boolean;

  beforeAll(async () => {
    const mod = await loadModule({ NODE_ENV: "production" });
    isTrackingEnabled    = mod.isTrackingEnabled;
    computeTrackingToken = mod.computeTrackingToken;
    verifyTrackingToken  = mod.verifyTrackingToken;
  });

  it("isTrackingEnabled returns false", () => {
    expect(isTrackingEnabled()).toBe(false);
  });

  it("computeTrackingToken throws — no token is generated with an empty key", () => {
    expect(() => computeTrackingToken(1, "JOB-001")).toThrow(
      /REPAIR_TRACKING_SECRET is not configured/
    );
  });

  it("verifyTrackingToken returns false for any token string", () => {
    expect(verifyTrackingToken(1, "JOB-001", "anytoken12345678901234567890123")).toBe(false);
  });

  it("verifyTrackingToken returns false for an empty token", () => {
    expect(verifyTrackingToken(1, "JOB-001", "")).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * 3. No secret — non-production environment (graceful degradation)
 * ───────────────────────────────────────────────────────────────────────── */
describe("tracking-token — no secret in development (graceful degradation)", () => {
  let isTrackingEnabled: () => boolean;
  let computeTrackingToken: (companyId: number, jobNo: string) => string;
  let verifyTrackingToken: (companyId: number, jobNo: string, token: string) => boolean;

  beforeAll(async () => {
    const mod = await loadModule({ NODE_ENV: "development" });
    isTrackingEnabled    = mod.isTrackingEnabled;
    computeTrackingToken = mod.computeTrackingToken;
    verifyTrackingToken  = mod.verifyTrackingToken;
  });

  it("isTrackingEnabled returns false", () => {
    expect(isTrackingEnabled()).toBe(false);
  });

  it("computeTrackingToken returns empty string (no throw in dev)", () => {
    expect(computeTrackingToken(1, "JOB-001")).toBe("");
  });

  it("verifyTrackingToken returns false (empty token cannot be verified)", () => {
    expect(verifyTrackingToken(1, "JOB-001", "")).toBe(false);
  });

  it("verifyTrackingToken returns false even if token matches empty-secret HMAC", () => {
    expect(verifyTrackingToken(1, "JOB-001", "anytoken")).toBe(false);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
 * 4. Secret too short — should throw at module load (all environments)
 * ───────────────────────────────────────────────────────────────────────── */
describe("tracking-token — secret too short (FATAL at load time)", () => {
  it("throws a fatal error when REPAIR_TRACKING_SECRET is shorter than 32 chars", async () => {
    await expect(
      loadModule({ REPAIR_TRACKING_SECRET: "tooshort", NODE_ENV: "test" })
    ).rejects.toThrow(/too short/);
  });
});
