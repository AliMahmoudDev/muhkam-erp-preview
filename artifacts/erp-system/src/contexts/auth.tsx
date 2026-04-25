import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: string;
  permissions?: Record<string, boolean>;
  active?: boolean;
  warehouse_id?: number | null;
  safe_id?: number | null;
  employee_id?: number | null;
}

interface AuthContextType {
  user: AuthUser | null;
  subscriptionExpired: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  clearSubscriptionExpired: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  subscriptionExpired: false,
  login: () => {},
  logout: () => {},
  clearSubscriptionExpired: () => {},
});

const USER_KEY = "erp_current_user";

function isValidForRole(u: AuthUser): boolean {
  if (u.role === "cashier" || u.role === "salesperson") {
    return !!u.warehouse_id && !!u.safe_id;
  }
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      if (!s) return null;
      const parsed = JSON.parse(s) as AuthUser;
      if (!isValidForRole(parsed)) {
        localStorage.removeItem(USER_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [subscriptionExpired, setSubscriptionExpired] = useState(false);

  /* Listen for subscription:expired events fired by authFetch */
  useEffect(() => {
    const handler = () => {
      if (user && user.role !== "super_admin") {
        setSubscriptionExpired(true);
      }
    };
    window.addEventListener("subscription:expired", handler);
    return () => window.removeEventListener("subscription:expired", handler);
  }, [user]);

  const login = (u: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem("halal_erp_login_flag", "1");
    setUser(u);
    setSubscriptionExpired(false);
  };

  const logout = () => {
    localStorage.setItem("halal_erp_logout_flag", "1");
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setSubscriptionExpired(false);
  };

  const clearSubscriptionExpired = () => setSubscriptionExpired(false);

  return (
    <AuthContext.Provider value={{ user, subscriptionExpired, login, logout, clearSubscriptionExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
