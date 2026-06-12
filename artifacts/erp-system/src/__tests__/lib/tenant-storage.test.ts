import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCurrentCompanyId,
  getTenantScopedStorageKey,
  getTenantSettingsStorageKey,
} from '@/lib/tenant-storage';

describe('tenant-storage', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('uses public scope when no company is active', () => {
    expect(getCurrentCompanyId()).toBeNull();
    expect(getTenantSettingsStorageKey()).toBe('halal_erp_settings:public');
    expect(getTenantScopedStorageKey('erp_subscription')).toBe('erp_subscription:public');
  });

  it('uses company_id from current user first', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === 'erp_current_user') return JSON.stringify({ id: 1, company_id: 28 });
      if (key === 'erp_company_id') return '99';
      return null;
    });

    expect(getCurrentCompanyId()).toBe('28');
    expect(getTenantSettingsStorageKey()).toBe('halal_erp_settings:company:28');
    expect(getTenantScopedStorageKey('erp_subscription')).toBe('erp_subscription:company:28');
  });

  it('falls back to erp_company_id when current user is missing', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === 'erp_company_id') return '42';
      return null;
    });

    expect(getCurrentCompanyId()).toBe('42');
    expect(getTenantSettingsStorageKey()).toBe('halal_erp_settings:company:42');
  });

  it('does not trust erp_company_id if current user is corrupted', () => {
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === 'erp_current_user') return '{bad-json';
      if (key === 'erp_company_id') return '7';
      return null;
    });

    expect(getCurrentCompanyId()).toBeNull();
    expect(getTenantSettingsStorageKey()).toBe('halal_erp_settings:public');
  });
});
