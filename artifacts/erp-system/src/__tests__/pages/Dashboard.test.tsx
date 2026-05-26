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
  sales_today: 15000,
  sales_today_count: 12,
  treasury_balance: 85000,
  customer_count: 45,
  low_stock_count: 3,
  top_products: [
    { name: "آيفون 15", quantity: 8, total: 6400 },
    { name: "جراب حماية", quantity: 20, total: 1000 },
  ],
  recent_transactions: [
    { id: 1, type: "sale", amount: "1200", direction: "in", date: "2025-01-15", description: "بيع نقدي" },
    { id: 2, type: "expense", amount: "500", direction: "out", date: "2025-01-15", description: "إيجار" },
  ],
  daily_sales: [
    { day: "السبت", total: 5000 },
    { day: "الأحد", total: 7000 },
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

    // Should show skeleton elements
    const skeletons = document.querySelectorAll(".db-skeleton");
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
      // Should show sales today value
      expect(screen.getByText(/15,000|15000/)).toBeInTheDocument();
    });
  });

  it("renders top products section", async () => {
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
      // Transaction descriptions
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
      sales_today: 0,
      sales_today_count: 0,
      treasury_balance: 0,
      customer_count: 0,
      low_stock_count: 0,
      top_products: [],
      recent_transactions: [],
      daily_sales: [],
    };

    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      if (String(url).includes("shortcuts")) {
        return new Response(JSON.stringify({ shortcuts: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(emptyStats), { status: 200 });
    });

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Should render without crashing — shows 0 values
      expect(screen.getByText(/^0/)).toBeInTheDocument();
    });
  });
});
