import Constants from "expo-constants";
import { getApiBaseUrl } from "@/context/AuthContext";

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? "https://halaltec.com";

let _getToken: (() => string | null) | null = null;

export function setTokenGetter(fn: () => string | null) {
  _getToken = fn;
}

export function getConfiguredApiUrl(): string {
  return API_URL;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = _getToken ? _getToken() : null;
  const baseUrl = getApiBaseUrl() || API_URL;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `خطأ ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function formatCurrency(amount: number | string): string {
  const n = Number(amount);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("ar-EG");
  } catch {
    return dateStr;
  }
}
