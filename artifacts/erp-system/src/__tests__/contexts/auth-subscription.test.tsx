import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth, type AuthUser } from "@/contexts/auth";

/* ─── helpers ──────────────────────────────────────────────────── */

const mockAdmin: AuthUser = {
  id: 1,
  name: "مدير النظام",
  username: "admin",
  role: "admin",
  permissions: {},
};

const mockSuperAdmin: AuthUser = {
  id: 99,
  name: "المشرف العام",
  username: "super",
  role: "super_admin",
  permissions: {},
};

function TestConsumer() {
  const { user, subscriptionExpired, login, logout, clearSubscriptionExpired } = useAuth();
  return (
    <div>
      <span data-testid="user-name">{user?.name ?? "no-user"}</span>
      <span data-testid="user-role">{user?.role ?? "none"}</span>
      <span data-testid="sub-expired">{String(subscriptionExpired)}</span>
      <button onClick={() => login(mockAdmin)}>login-admin</button>
      <button onClick={() => login(mockSuperAdmin)}>login-super</button>
      <button onClick={logout}>logout</button>
      <button onClick={clearSubscriptionExpired}>clear-expired</button>
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
/* Subscription expired detection                                   */
/* ─────────────────────────────────────────────────────────────── */
describe("AuthProvider — subscription expired", () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it("starts with subscriptionExpired = false", () => {
    renderWithAuth();
    expect(screen.getByTestId("sub-expired").textContent).toBe("false");
  });

  it("sets subscriptionExpired = true when event fires for non-super_admin", async () => {
    renderWithAuth();

    // Login as admin first
    await act(async () => { screen.getByText("login-admin").click(); });
    expect(screen.getByTestId("user-role").textContent).toBe("admin");

    // Fire subscription:expired event
    await act(async () => {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    });

    expect(screen.getByTestId("sub-expired").textContent).toBe("true");
  });

  it("does NOT set subscriptionExpired for super_admin", async () => {
    renderWithAuth();

    // Login as super_admin
    await act(async () => { screen.getByText("login-super").click(); });
    expect(screen.getByTestId("user-role").textContent).toBe("super_admin");

    // Fire subscription:expired event
    await act(async () => {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    });

    // Should still be false — super_admin is immune
    expect(screen.getByTestId("sub-expired").textContent).toBe("false");
  });

  it("does NOT set subscriptionExpired when no user is logged in", async () => {
    renderWithAuth();
    expect(screen.getByTestId("user-name").textContent).toBe("no-user");

    await act(async () => {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    });

    expect(screen.getByTestId("sub-expired").textContent).toBe("false");
  });

  it("clearSubscriptionExpired resets the flag", async () => {
    renderWithAuth();

    await act(async () => { screen.getByText("login-admin").click(); });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    });
    expect(screen.getByTestId("sub-expired").textContent).toBe("true");

    await act(async () => { screen.getByText("clear-expired").click(); });
    expect(screen.getByTestId("sub-expired").textContent).toBe("false");
  });

  it("login clears subscriptionExpired flag", async () => {
    renderWithAuth();

    await act(async () => { screen.getByText("login-admin").click(); });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    });
    expect(screen.getByTestId("sub-expired").textContent).toBe("true");

    // Re-login should clear it
    await act(async () => { screen.getByText("login-admin").click(); });
    expect(screen.getByTestId("sub-expired").textContent).toBe("false");
  });

  it("logout clears subscriptionExpired flag", async () => {
    renderWithAuth();

    await act(async () => { screen.getByText("login-admin").click(); });
    await act(async () => {
      window.dispatchEvent(new CustomEvent("subscription:expired"));
    });
    expect(screen.getByTestId("sub-expired").textContent).toBe("true");

    await act(async () => { screen.getByText("logout").click(); });
    expect(screen.getByTestId("sub-expired").textContent).toBe("false");
  });
});

/* ─────────────────────────────────────────────────────────────── */
/* Login flags                                                      */
/* ─────────────────────────────────────────────────────────────── */
describe("AuthProvider — login/logout flags", () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it("sets halal_erp_login_flag on login", async () => {
    renderWithAuth();
    await act(async () => { screen.getByText("login-admin").click(); });
    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith(
      "halal_erp_login_flag", "1",
    );
  });

  it("sets halal_erp_logout_flag on logout", async () => {
    renderWithAuth();
    await act(async () => { screen.getByText("login-admin").click(); });
    await act(async () => { screen.getByText("logout").click(); });
    expect(vi.mocked(localStorage.setItem)).toHaveBeenCalledWith(
      "halal_erp_logout_flag", "1",
    );
  });
});
