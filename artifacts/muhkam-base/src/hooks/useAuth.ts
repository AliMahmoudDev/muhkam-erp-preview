import { useState, useEffect } from "react";
import { api, setToken, clearToken } from "../api/client";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("muhkam_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((u) => setUser(u))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>("/auth/login", {
      username,
      password,
    });
    setToken(r.token);
    setUser(r.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return { user, loading, login, logout };
}
