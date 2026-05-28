import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authFetch } from "@/lib/auth-fetch";

describe("authFetch", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetch with credentials: include", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await authFetch("/api/test");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sets Content-Type to application/json by default", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await authFetch("/api/test");
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("merges custom headers with defaults", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    await authFetch("/api/test", {
      headers: { "X-Custom": "value" },
    });
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Custom"]).toBe("value");
  });

  it("returns the response object", async () => {
    const mockResponse = new Response(JSON.stringify({ data: 1 }), { status: 200 });
    vi.mocked(global.fetch).mockResolvedValue(mockResponse);
    const res = await authFetch("/api/data");
    expect(res).toBe(mockResponse);
  });

  it("dispatches subscription:expired event on 403 with subscription error", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const body = JSON.stringify({ error: "انتهت صلاحية الاشتراك" });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(body, { status: 403, headers: { "Content-Type": "application/json" } }),
    );

    await authFetch("/api/protected");

    // Give the async .then() time to fire
    await new Promise(r => setTimeout(r, 50));

    const events = dispatchSpy.mock.calls.map(c => (c[0] as CustomEvent).type);
    expect(events).toContain("subscription:expired");
  });

  it("does NOT dispatch event on 403 without subscription keyword", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const body = JSON.stringify({ error: "غير مصرح" });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(body, { status: 403, headers: { "Content-Type": "application/json" } }),
    );

    await authFetch("/api/protected");
    await new Promise(r => setTimeout(r, 50));

    const events = dispatchSpy.mock.calls.map(c => (c[0] as CustomEvent).type);
    expect(events).not.toContain("subscription:expired");
  });

  it("does NOT throw on 403 JSON parse failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("not json", { status: 403 }),
    );
    // Should not throw
    const res = await authFetch("/api/test");
    expect(res.status).toBe(403);
  });

  it("passes method and body through to fetch", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response("{}", { status: 201 }),
    );
    await authFetch("/api/create", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    const callArgs = vi.mocked(global.fetch).mock.calls[0];
    const opts = callArgs[1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(JSON.stringify({ name: "test" }));
  });

  /* ══════════════════════════════════════════════════════════════════
     Auto-refresh on 401 tests
     ══════════════════════════════════════════════════════════════════ */

  describe("auto-refresh on 401", () => {
    it("401 → refresh succeeds → retries original request → returns success", async () => {
      const successResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });

      vi.mocked(global.fetch)
        // First call: original request returns 401
        .mockResolvedValueOnce(new Response("", { status: 401 }))
        // Second call: refresh succeeds
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
        // Third call: retried original request succeeds
        .mockResolvedValueOnce(successResponse);

      const res = await authFetch("/api/data");

      expect(res).toBe(successResponse);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Verify refresh was called with correct path and method
      const refreshCall = vi.mocked(global.fetch).mock.calls[1];
      expect(refreshCall[0]).toBe("/api/auth/refresh");
      expect((refreshCall[1] as RequestInit).method).toBe("POST");
      expect((refreshCall[1] as RequestInit).credentials).toBe("include");

      // Verify retry was called with original URL
      const retryCall = vi.mocked(global.fetch).mock.calls[2];
      expect(retryCall[0]).toBe("/api/data");
    });

    it("401 → refresh fails → dispatches session:expired → returns original 401 response", async () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const original401 = new Response("", { status: 401 });

      vi.mocked(global.fetch)
        // First call: original request returns 401
        .mockResolvedValueOnce(original401)
        // Second call: refresh fails
        .mockResolvedValueOnce(new Response("", { status: 401 }));

      const res = await authFetch("/api/data");

      // Returns original 401 response
      expect(res).toBe(original401);
      // Only 2 calls: original + refresh (no retry)
      expect(global.fetch).toHaveBeenCalledTimes(2);
      // session:expired event dispatched
      const events = dispatchSpy.mock.calls.map(c => (c[0] as CustomEvent).type);
      expect(events).toContain("session:expired");
    });

    it("401 on /api/auth/refresh does NOT trigger another refresh (prevents infinite loop)", async () => {
      const refresh401 = new Response("", { status: 401 });
      vi.mocked(global.fetch).mockResolvedValueOnce(refresh401);

      const res = await authFetch("/api/auth/refresh", { method: "POST" });

      // Returns the 401 directly — no refresh attempt
      expect(res).toBe(refresh401);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("concurrent 401 responses trigger only ONE refresh call", async () => {
      const successResponse1 = new Response(JSON.stringify({ a: 1 }), { status: 200 });
      const successResponse2 = new Response(JSON.stringify({ b: 2 }), { status: 200 });

      let fetchCallCount = 0;
      vi.mocked(global.fetch).mockImplementation(async (input) => {
        fetchCallCount++;
        const url = typeof input === "string" ? input : (input as Request).url;

        if (url === "/api/auth/refresh") {
          // Only one refresh call should arrive here
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        // First two calls to data endpoints return 401
        if (fetchCallCount <= 2) {
          return new Response("", { status: 401 });
        }

        // Retry calls succeed
        if (url === "/api/endpoint-a") return successResponse1;
        if (url === "/api/endpoint-b") return successResponse2;
        return new Response("", { status: 200 });
      });

      // Fire two requests concurrently — both will get 401
      const [resA, resB] = await Promise.all([
        authFetch("/api/endpoint-a"),
        authFetch("/api/endpoint-b"),
      ]);

      expect(resA).toBe(successResponse1);
      expect(resB).toBe(successResponse2);

      // Count refresh calls — should be exactly 1
      const refreshCalls = vi.mocked(global.fetch).mock.calls.filter(
        (c) => c[0] === "/api/auth/refresh",
      );
      expect(refreshCalls.length).toBe(1);
    });

    it("non-401 errors are returned as-is without refresh attempt", async () => {
      const error500 = new Response("Server Error", { status: 500 });
      vi.mocked(global.fetch).mockResolvedValueOnce(error500);

      const res = await authFetch("/api/data");

      expect(res).toBe(error500);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("successful requests do not trigger refresh", async () => {
      const okResponse = new Response("{}", { status: 200 });
      vi.mocked(global.fetch).mockResolvedValueOnce(okResponse);

      const res = await authFetch("/api/data");

      expect(res).toBe(okResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("refresh network error → dispatches session:expired → returns original 401", async () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");
      const original401 = new Response("", { status: 401 });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(original401)
        // refresh throws network error
        .mockRejectedValueOnce(new Error("Network error"));

      const res = await authFetch("/api/data");

      expect(res).toBe(original401);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const events = dispatchSpy.mock.calls.map(c => (c[0] as CustomEvent).type);
      expect(events).toContain("session:expired");
    });
  });
});
