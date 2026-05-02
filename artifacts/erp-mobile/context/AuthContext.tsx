import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "erp_auth_token";
const USER_KEY = "erp_auth_user";

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: string;
  companyId: number | null;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

let _baseUrl = "";
export function setApiBaseUrl(url: string) {
  _baseUrl = url;
}
export function getApiBaseUrl() {
  return _baseUrl;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    const companyId = process.env.EXPO_PUBLIC_COMPANY_ID
      ? parseInt(process.env.EXPO_PUBLIC_COMPANY_ID, 10)
      : undefined;
    const body: Record<string, unknown> = { username, pin };
    if (companyId && !isNaN(companyId)) body.company_id = companyId;
    const res = await fetch(`${_baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client": "mobile" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "فشل تسجيل الدخول");
    }
    const data = await res.json();
    const authUser: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      username: data.user.username,
      role: data.user.role,
      companyId: data.user.company_id ?? null,
    };
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, data.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(authUser)),
    ]);
    setToken(data.token);
    setUser(authUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${_baseUrl}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
      setToken(null);
      setUser(null);
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
