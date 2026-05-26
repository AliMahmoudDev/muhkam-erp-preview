import { describe, it, expect } from "vitest";
import { canAccess, isAdmin, ROUTE_PERMISSION, NAV_ITEMS, ROLE_LABELS } from "@/lib/rbac";

describe("canAccess", () => {
  it("grants admin access to all routes", () => {
    const adminRoutes = NAV_ITEMS.map(i => i.href);
    for (const route of adminRoutes) {
      expect(canAccess("admin", route)).toBe(true);
    }
  });

  it("grants cashier access to allowed routes", () => {
    expect(canAccess("cashier", "/")).toBe(true);
    expect(canAccess("cashier", "/pos")).toBe(true);
    expect(canAccess("cashier", "/sales")).toBe(true);
    expect(canAccess("cashier", "/devices")).toBe(true);
  });

  it("denies cashier access to restricted routes", () => {
    expect(canAccess("cashier", "/purchases")).toBe(false);
    expect(canAccess("cashier", "/accounts")).toBe(false);
    expect(canAccess("cashier", "/settings")).toBe(false);
    expect(canAccess("cashier", "/payroll")).toBe(false);
  });

  it("denies access when role is undefined", () => {
    expect(canAccess(undefined, "/")).toBe(false);
    expect(canAccess(undefined, "/sales")).toBe(false);
  });

  it("allows access to unknown routes (not in NAV_ITEMS)", () => {
    expect(canAccess("cashier", "/some-unknown-route")).toBe(true);
  });

  it("grants employee access to employee portal", () => {
    expect(canAccess("employee", "/my-portal")).toBe(true);
    expect(canAccess("employee", "/employees")).toBe(true);
  });

  it("denies employee access to most routes", () => {
    expect(canAccess("employee", "/sales")).toBe(false);
    expect(canAccess("employee", "/pos")).toBe(false);
    expect(canAccess("employee", "/purchases")).toBe(false);
  });

  it("grants salesperson access to sales-related routes", () => {
    expect(canAccess("salesperson", "/")).toBe(true);
    expect(canAccess("salesperson", "/sales")).toBe(true);
    expect(canAccess("salesperson", "/pos")).toBe(true);
    expect(canAccess("salesperson", "/customers")).toBe(true);
  });

  it("denies salesperson access to admin routes", () => {
    expect(canAccess("salesperson", "/accounts")).toBe(false);
    expect(canAccess("salesperson", "/settings")).toBe(false);
    expect(canAccess("salesperson", "/journal-entries")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("returns true for admin role", () => {
    expect(isAdmin("admin")).toBe(true);
  });

  it("returns false for non-admin roles", () => {
    expect(isAdmin("cashier")).toBe(false);
    expect(isAdmin("manager")).toBe(false);
    expect(isAdmin("employee")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("ROUTE_PERMISSION", () => {
  it("maps all critical routes to permission keys", () => {
    expect(ROUTE_PERMISSION["/"]).toBe("can_access_dashboard");
    expect(ROUTE_PERMISSION["/pos"]).toBe("can_access_pos");
    expect(ROUTE_PERMISSION["/sales"]).toBe("can_access_sales");
    expect(ROUTE_PERMISSION["/purchases"]).toBe("can_access_purchases");
    expect(ROUTE_PERMISSION["/inventory"]).toBe("can_access_inventory");
    expect(ROUTE_PERMISSION["/employees"]).toBe("can_access_employees");
    expect(ROUTE_PERMISSION["/repairs"]).toBe("can_access_repairs");
  });

  it("all permission keys follow can_access_* pattern", () => {
    for (const [_route, perm] of Object.entries(ROUTE_PERMISSION)) {
      expect(perm).toMatch(/^can_access_/);
    }
  });
});

describe("NAV_ITEMS", () => {
  it("has at least 25 navigation items", () => {
    expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(25);
  });

  it("every item has required fields", () => {
    for (const item of NAV_ITEMS) {
      expect(item.name).toBeTruthy();
      expect(item.href).toMatch(/^\//);
      expect(item.icon).toBeDefined();
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });

  it("admin is in every item's roles", () => {
    for (const item of NAV_ITEMS) {
      expect(item.roles).toContain("admin");
    }
  });
});

describe("ROLE_LABELS", () => {
  it("has labels for all standard roles", () => {
    expect(ROLE_LABELS["admin"]).toBe("مدير النظام");
    expect(ROLE_LABELS["manager"]).toBe("مشرف");
    expect(ROLE_LABELS["cashier"]).toBe("كاشير");
    expect(ROLE_LABELS["employee"]).toBe("موظف (بياناتي)");
    expect(ROLE_LABELS["super_admin"]).toBe("المسؤول العام");
  });
});
