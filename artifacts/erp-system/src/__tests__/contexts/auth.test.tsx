import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth, type AuthUser } from "@/contexts/auth";

/* ─── helpers ──────────────────────────────────────────────────── */

const mockAdmin: AuthUser = {
  id: 1,
  name: "محمد الأمين",
  username: "admin",
  role: "admin",
  permissions: { can_view_sales: true },
};

const mockCashier: AuthUser = {
  id: 2,
  name: "أحمد الكاشير",
  username: "cashier1",
  role: "cashier",
  warehouse_id: 10,
  safe_id: 5,
};

function TestConsumer() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user-name">{user?.name ?? "no-user"}</span>
      <button onClick={() => login(mockAdmin)}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Initial state                                                    */
/* ─────────────────────────────────────────────────────────────── */
describe("AuthProvider — initial state", () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it("starts with no user when localStorage is empty", () => {
    renderWithAuth();
    expect(screen.getByTestId("user-name").textContent).toBe("no-user");
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* Login                                                            */
/* ─────────────────────────────────────────────────────────────── */
describe("AuthProvider — login", () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it("sets user after login", async () => {
    renderWithAuth();
    await act(async () => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("user-name").textContent).toBe("محمد الأمين");
  });

  it("persists user to localStorage on login", async () => {
    renderWithAuth();
    await act(async () => {
      screen.getByText("login").click();
    });
    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith(
      "erp_current_user",
      expect.stringContaining("محمد الأمين"),
    );
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* Logout                                                           */
/* ─────────────────────────────────────────────────────────────── */
describe("AuthProvider — logout", () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it("clears user after logout", async () => {
    renderWithAuth();
    await act(async () => { screen.getByText("login").click(); });
    await act(async () => { screen.getByText("logout").click(); });
    expect(screen.getByTestId("user-name").textContent).toBe("no-user");
  });

  it("removes user from localStorage on logout", async () => {
    renderWithAuth();
    await act(async () => { screen.getByText("login").click(); });
    await act(async () => { screen.getByText("logout").click(); });
    expect(vi.mocked(localStorage.removeItem)).toHaveBeenCalledWith("erp_current_user");
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* Restore from localStorage                                        */
/* ─────────────────────────────────────────────────────────────── */
describe("AuthProvider — restore from localStorage", () => {
  it("restores an admin user from localStorage on mount", () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === "erp_current_user") return JSON.stringify(mockAdmin);
      return null;
    });

    renderWithAuth();
    expect(screen.getByTestId("user-name").textContent).toBe("محمد الأمين");
  });

  it("does NOT restore a cashier without warehouse_id/safe_id (invalid role)", () => {
    const invalidCashier: AuthUser = { ...mockCashier, warehouse_id: null, safe_id: null };
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === "erp_current_user") return JSON.stringify(invalidCashier);
      return null;
    });

    renderWithAuth();
    expect(screen.getByTestId("user-name").textContent).toBe("no-user");
  });

  it("restores a valid cashier (has warehouse_id and safe_id)", () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === "erp_current_user") return JSON.stringify(mockCashier);
      return null;
    });

    renderWithAuth();
    expect(screen.getByTestId("user-name").textContent).toBe("أحمد الكاشير");
  });

  it("handles corrupted localStorage JSON gracefully", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("INVALID_JSON{{{");
    renderWithAuth();
    expect(screen.getByTestId("user-name").textContent).toBe("no-user");
  });
});
