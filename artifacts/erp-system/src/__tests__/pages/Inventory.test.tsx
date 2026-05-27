import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* ── Mocks ─────────────────────────────────────────────────── */

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/inventory", mockNavigate],
  useSearch: () => "",
  useRoute: () => [false, {}],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
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
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: () => true,
}));

vi.mock("@/contexts/warehouse", () => ({
  useWarehouse: () => ({ currentWarehouseId: null, setWarehouseId: vi.fn() }),
}));

vi.mock("@/contexts/app-settings", () => ({
  useAppSettings: () => ({ settings: { theme: "dark", currency: "EGP" }, update: vi.fn() }),
}));

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ products: [], summary: { total_products: 0, total_inventory_value: 0, low_stock_count: 0, zero_stock_count: 0 } }), { status: 200 }),
  ),
}));

vi.mock("@/lib/api", () => ({
  api: (path: string) => path,
  BASE: "",
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (v: number) => `${v} ج.م`,
}));

vi.mock("@/lib/safe-data", () => ({
  safeArray: (v: any) => Array.isArray(v) ? v : [],
}));

vi.mock("@/lib/inventory-export", () => ({
  exportToExcelMulti: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetSettingsWarehouses: () => ({ data: [], isLoading: false }),
  useCreateSettingsWarehouse: () => ({ mutateAsync: vi.fn() }),
  useDeleteSettingsWarehouse: () => ({ mutateAsync: vi.fn() }),
}));

// Mock sub-tabs to isolate the Inventory page tab logic
vi.mock("@/pages/inventory/ReviewTab", () => ({
  __esModule: true,
  default: () => <div data-testid="review-tab">Review Tab</div>,
}));
vi.mock("@/pages/inventory/CountTab", () => ({
  __esModule: true,
  default: () => <div data-testid="count-tab">Count Tab</div>,
}));
vi.mock("@/pages/inventory/AlertsTab", () => ({
  __esModule: true,
  default: () => <div data-testid="alerts-tab">Alerts Tab</div>,
}));
vi.mock("@/pages/reports/InventoryReport", () => ({
  __esModule: true,
  default: () => <div data-testid="report-tab">Report Tab</div>,
}));
vi.mock("@/pages/consignment", () => ({
  __esModule: true,
  default: () => <div data-testid="consignment-tab">Consignment</div>,
}));
vi.mock("@/pages/scrap-inventory", () => ({
  __esModule: true,
  default: () => <div data-testid="scrap-tab">Scrap</div>,
}));

import Inventory from "@/pages/inventory";

/* ── Helpers ───────────────────────────────────────────────── */

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Tests                                                            */
/* ─────────────────────────────────────────────────────────────── */

describe("Inventory page — tabs", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("renders overview tab by default", () => {
    render(<Inventory />, { wrapper: createWrapper() });
    // Overview tab should show summary stat cards or the overview section
    // The tab buttons should be visible
    expect(screen.getByText(/نظرة عامة|المراجعة|overview/i)).toBeInTheDocument();
  });

  it("renders multiple tab buttons", () => {
    render(<Inventory />, { wrapper: createWrapper() });
    // Check that at least some tab buttons exist
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("does not crash on initial render", () => {
    const { container } = render(<Inventory />, { wrapper: createWrapper() });
    expect(container).toBeTruthy();
  });
});

describe("Inventory _shared — movementTypeLabel", () => {
  // These are already covered in inventory-shared.test.ts but let's add a
  // quick integration check that types are used correctly
  it("all movement type entries have label and color", async () => {
    const { movementTypeLabel } = await import("@/pages/inventory/_shared");
    for (const [_key, value] of Object.entries(movementTypeLabel)) {
      const v = value as { label: string; color: string };
      expect(v.label).toBeTruthy();
      expect(v.color).toContain("bg-");
    }
  });
});

describe("Inventory _shared — today/nowTime", () => {
  it("today returns current date in ISO format", async () => {
    const { today } = await import("@/pages/inventory/_shared");
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should be today's date
    expect(result).toBe(new Date().toISOString().slice(0, 10));
  });

  it("nowTime returns current time HH:MM", async () => {
    const { nowTime } = await import("@/pages/inventory/_shared");
    const result = nowTime();
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});
