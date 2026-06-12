export const APP_SETTINGS_STORAGE_KEY_BASE = 'halal_erp_settings';

type StoredUser = {
  company_id?: number | string | null;
};

export function getCurrentCompanyId(): string | null {
  try {
    const rawUser = localStorage.getItem('erp_current_user');
    if (rawUser) {
      const user = JSON.parse(rawUser) as StoredUser;
      const companyId = user.company_id;
      if (companyId !== undefined && companyId !== null && String(companyId).trim()) {
        return String(companyId);
      }
    }

    const storedCompanyId = localStorage.getItem('erp_company_id');
    if (storedCompanyId && storedCompanyId.trim()) {
      return storedCompanyId.trim();
    }
  } catch {
    // fall through to public key
  }

  return null;
}

export function getTenantSettingsStorageKey(): string {
  const companyId = getCurrentCompanyId();
  return companyId
    ? `${APP_SETTINGS_STORAGE_KEY_BASE}:company:${companyId}`
    : `${APP_SETTINGS_STORAGE_KEY_BASE}:public`;
}

export function getTenantScopedStorageKey(baseKey: string): string {
  const companyId = getCurrentCompanyId();
  return companyId ? `${baseKey}:company:${companyId}` : `${baseKey}:public`;
}
