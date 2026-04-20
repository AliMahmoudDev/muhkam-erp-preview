import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface VatSettings {
  vatEnabled: boolean;
  vatRate: number;
}

async function fetchVatSettings(): Promise<VatSettings> {
  const res = await authFetch('/api/settings/system');
  if (!res.ok) return { vatEnabled: false, vatRate: 14 };
  const data: Record<string, string> = await res.json();
  return {
    vatEnabled: data['vat_enabled'] === 'true',
    vatRate: data['vat_rate'] ? Number(data['vat_rate']) : 14,
  };
}

export function useVatSettings() {
  return useQuery<VatSettings>({
    queryKey: ['vat-settings'],
    queryFn: fetchVatSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateVatSettings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['vat-settings'] });
}
