import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "@/contexts/auth";
import { authFetch } from "@/lib/auth-fetch";
import { api } from '@/lib/api';


export type CompanyFeatures = {
  accounting: boolean;
  hr: boolean;
  pos: boolean;
  warranty: boolean;
  consignment: boolean;
  fixed_assets: boolean;
  maintenance: boolean;
  budgets: boolean;
  bank_reconciliation: boolean;
};

const DEFAULT_ULTIMATE: CompanyFeatures = {
  accounting: false,
  hr: true,
  pos: true,
  warranty: true,
  consignment: true,
  fixed_assets: false,
  maintenance: false,
  budgets: false,
  bank_reconciliation: false,
};

const DEFAULT_ADVANCED: CompanyFeatures = {
  accounting: true,
  hr: true,
  pos: true,
  warranty: true,
  consignment: true,
  fixed_assets: true,
  maintenance: false,
  budgets: true,
  bank_reconciliation: true,
};

export interface SubscriptionInfo {
  edition: "ultimate" | "advanced";
  features: CompanyFeatures;
  isAdvanced: boolean;
  hasFeature: (key: keyof CompanyFeatures) => boolean;
  refresh: () => void;
}

const SubscriptionContext = createContext<SubscriptionInfo>({
  edition: "ultimate",
  features: DEFAULT_ULTIMATE,
  isAdvanced: false,
  hasFeature: () => false,
  refresh: () => {},
});

const STORAGE_KEY = "erp_subscription";

function loadCached(): { edition: "ultimate" | "advanced"; features: CompanyFeatures } | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const cached = loadCached();
  const [edition, setEdition] = useState<"ultimate" | "advanced">(cached?.edition ?? "ultimate");
  const [features, setFeatures] = useState<CompanyFeatures>(cached?.features ?? DEFAULT_ULTIMATE);

  const fetchStatus = useCallback(async () => {
    if (!user || user.role === "super_admin") return;
    try {
      const res = await authFetch(api("/api/subscription/status"));
      if (!res.ok) return;
      const data = (await res.json()) as {
        edition?: string;
        features?: CompanyFeatures;
      };
      const ed = data.edition === "advanced" ? "advanced" : "ultimate";
      const feat: CompanyFeatures = data.features
        ? { ...(ed === "advanced" ? DEFAULT_ADVANCED : DEFAULT_ULTIMATE), ...data.features }
        : ed === "advanced"
        ? DEFAULT_ADVANCED
        : DEFAULT_ULTIMATE;
      setEdition(ed);
      setFeatures(feat);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ edition: ed, features: feat }));
    } catch {
      /* non-fatal */
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
      setEdition("ultimate");
      setFeatures(DEFAULT_ULTIMATE);
    }
  }, [user]);

  const hasFeature = useCallback(
    (key: keyof CompanyFeatures) => features[key] ?? false,
    [features]
  );

  return (
    <SubscriptionContext.Provider
      value={{ edition, features, isAdvanced: edition === "advanced", hasFeature, refresh: fetchStatus }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
