import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* ── Mocks ─────────────────────────────────────────────────── */

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/sales", mockNavigate],
  useSearch: () => "",
  useRoute: () => [false, {}],
  Link: ({ children }: any) => children,
  Route: ({ children }: any) => children,
  Switch: ({ children }: any) => children,
}));

const mockUser = {
  id: 1,
  name: "Admin",
  username: "admin",
  role: "admin",
  permissions: {},
};

vi.mock("@/contexts/auth", () => ({
  useAuth: () => ({ user: mockUser }),
  AuthProvider: ({ children }: any) => children,
}));

// Default: admin has all permissions
let mockPermissionResult = true;
vi.mock("@/lib/permissions", () => ({
  hasPermission: (_user: any, _perm: string) => mockPermissionResult,
}));

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn().mockResolvedValue(new Response("[]", { status: 200 })),
}));

vi.mock("@/lib/api", () => ({
  api: (path: string) => path,
  BASE: "",
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (v: number) => `${v} ج.م`,
}));

vi.mock("@/contexts/warehouse", () => ({
  useWarehouse: () => ({ currentWarehouseId: null }),
}));

vi.mock("@/contexts/app-settings", () => ({
  useAppSettings: () => ({ settings: { theme: "dark", currency: "EGP" }, update: vi.fn() }),
}));

// Mock sub-panels to isolate the Sales page tab logic
vi.mock("@/pages/sales/SalesReturnsPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="returns-panel">Returns Panel</div>,
}));

vi.mock("@/pages/sales/SaleDetailModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/pages/sales/NewSalePanel", () => ({
  NewSalePanel: () => <div data-testid="new-sale-panel">New Sale Panel</div>,
}));

vi.mock("@/pages/sales/SalesHistoryPanel", () => ({
  SalesHistoryPanel: () => <div data-testid="history-panel">History Panel</div>,
}));

import Sales from "@/pages/sales";

/* ── Helpers ───────────────────────────────────────────────── */

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Tests                                                            */
/* ─────────────────────────────────────────────────────────────── */

describe("Sales page — tabs and permissions", () => {
  beforeEach(() => {
    mockPermissionResult = true;
    mockNavigate.mockReset();
  });

  it("renders all 3 tabs for admin (full permissions)", () => {
    render(<Sales />, { wrapper: createWrapper() });

    expect(screen.getByText("➕ فاتورة بيع جديدة")).toBeInTheDocument();
    expect(screen.getByText("سجل الفواتير")).toBeInTheDocument();
    expect(screen.getByText("↩ المرتجعات")).toBeInTheDocument();
  });

  it("defaults to 'new' tab when user has can_create_sale", () => {
    render(<Sales />, { wrapper: createWrapper() });
    expect(screen.getByTestId("new-sale-panel")).toBeInTheDocument();
  });

  it("switches to history tab on click", () => {
    render(<Sales />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("سجل الفواتير"));
    expect(screen.getByTestId("history-panel")).toBeInTheDocument();
  });

  it("switches to returns tab on click", () => {
    render(<Sales />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("↩ المرتجعات"));
    expect(screen.getByTestId("returns-panel")).toBeInTheDocument();
  });

  it("hides 'new' and 'returns' tabs when permissions are denied", () => {
    mockPermissionResult = false;

    render(<Sales />, { wrapper: createWrapper() });

    expect(screen.queryByText("➕ فاتورة بيع جديدة")).not.toBeInTheDocument();
    expect(screen.queryByText("↩ المرتجعات")).not.toBeInTheDocument();
    // Only history should be visible
    expect(screen.getByText("سجل الفواتير")).toBeInTheDocument();
  });

  it("falls back to history when no create permission and tab=new", () => {
    mockPermissionResult = false;

    render(<Sales />, { wrapper: createWrapper() });

    // Should show history panel since new is not allowed
    expect(screen.getByTestId("history-panel")).toBeInTheDocument();
  });

  it("navigates URL when tab changes", () => {
    render(<Sales />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText("سجل الفواتير"));
    expect(mockNavigate).toHaveBeenCalledWith("?tab=history", { replace: true });
  });
});
