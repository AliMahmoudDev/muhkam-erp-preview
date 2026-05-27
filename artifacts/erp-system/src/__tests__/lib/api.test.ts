import { describe, it, expect } from "vitest";
import { api, BASE } from "@/lib/api";

describe("api()", () => {
  it("prepends BASE_URL to the given path", () => {
    const result = api("/api/users");
    expect(result).toBe(`${BASE}/api/users`);
  });

  it("handles paths without leading slash", () => {
    const result = api("api/products");
    expect(result).toBe(`${BASE}api/products`);
  });

  it("returns path unchanged when BASE is empty", () => {
    // BASE is derived from import.meta.env.BASE_URL which defaults to '/'
    // After .replace(/\/$/, '') it becomes ''
    expect(BASE).toBe("");
    expect(api("/api/health")).toBe("/api/health");
  });
});

describe("BASE constant", () => {
  it("is a string without trailing slash", () => {
    expect(typeof BASE).toBe("string");
    expect(BASE).not.toMatch(/\/$/);
  });
});
