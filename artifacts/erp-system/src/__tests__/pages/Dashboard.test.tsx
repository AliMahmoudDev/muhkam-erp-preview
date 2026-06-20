import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* ── Mock all external dependencies ────────────────────────── */

vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: (path: string) => path,
  BASE: "",
}));

vi.mock("@/contexts/warehouse", () => ({
  useWarehouse: () => ({ currentWarehouseId: null, setWarehouseId: vi.fn() }),
  WarehouseProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/app-settings", () => ({
  useAppSettings: () => ({
    settings: { theme: "dark", currency: "EGP", numberFormat: "western" },
    update: vi.fn(),
  }),
  AppSettingsProvider: ({ children }: any) => children,
}));

vi.mock("@/lib/format", () => ({
  formatCurrency: (v: number) => `${v} ج.م`,
}));

vi.mock("@/components/onboarding", () => ({
  OnboardingPanel: () => null,
}));

vi.mock("@/components/ShortcutsCustomizer", () => ({
  __esModule: true,
  default: () => null,
  ALL_SHORTCUTS: [],
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

import { authFetch } from "@/lib/auth-fetch";
import Dashboard from "@/pages/dashboard";

/* ── Test setup ────────────────────────────────────────────── */

const mockStats = {
  total_sales_today: 15000,
  total_expenses_today: 3000,
  total_income_today: 5000,
  net_profit: 12000,
  total_customer_debts: 45000,
  total_supplier_debts: 20000,
  low_stock_products: [
    { id: 1, name: "آيفون 15", quantity: 2, sell_price: 800 },
    { id: 2, name: "جراب حماية", quantity: 1, sell_price: 50 },
  ],
  recent_transactions: [
    { id: 1, type: "sale_cash", amount: 1200, created_at: "2025-01-15T10:30:00Z" },
    { id: 2, type: "expense", amount: 500, created_at: "2025-01-15T11:00:00Z" },
  ],
};

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Tests                                                            */
/* ─────────────────────────────────────────────────────────────── */

describe("Dashboard page", () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockReset();
  });

  it("shows loading skeletons while data is fetching", () => {
    // Never resolve the fetch — keep it pending
    vi.mocked(authFetch).mockReturnValue(new Promise(() => {}));

    render(<Dashboard />, { wrapper: createWrapper() });

    // Should show skeleton elements (KpiSkeleton uses aria-hidden="true")
    const skeletons = document.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state when API fails", async () => {
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: [] }), { status: 200 });
      }
      return new Response("", { status: 500 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("حدث خطأ في تحميل البيانات")).toBeInTheDocument();
    });
  });

  it("renders KPI cards when data loads successfully", async () => {
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: ["new-sale"] }), { status: 200 });
      }
      return new Response(JSON.stringify(mockStats), { status: 200 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should show "مبيعات اليوم" label (KPI card renders)
      expect(screen.getByText("مبيعات اليوم")).toBeInTheDocument();
    });
  });

  it("renders low stock products section", async () => {
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(mockStats), { status: 200 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("آيفون 15")).toBeInTheDocument();
    });
  });

  it("renders recent transactions", async () => {
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(mockStats), { status: 200 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Transaction type label for "sale_cash" is "بيع نقدي"
      expect(screen.getByText("بيع نقدي")).toBeInTheDocument();
    });
  });

  it("renders chart component", async () => {
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(mockStats), { status: 200 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });
  });

  it("handles empty stats gracefully", async () => {
    const emptyStats = {
      total_sales_today: 0,
      total_expenses_today: 0,
      total_income_today: 0,
      net_profit: 0,
      total_customer_debts: 0,
      total_supplier_debts: 0,
      low_stock_products: [],
      recent_transactions: [],
    };

    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(emptyStats), { status: 200 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should render without crashing — shows KPI labels
      expect(screen.getByText("مبيعات اليوم")).toBeInTheDocument();
    });
  });
});
