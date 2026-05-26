import { describe, it, expect, vi, beforeEach } from "vitest";
import { authFetch } from "@/lib/auth-fetch";

describe("authFetch", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
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
    dispatchSpy.mockRestore();
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
    dispatchSpy.mockRestore();
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
});
