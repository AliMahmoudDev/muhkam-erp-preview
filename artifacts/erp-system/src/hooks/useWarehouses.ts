import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { safeArray } from '@/lib/safe-data';

export interface Warehouse {
  id: number;
  name: string;
  [key: string]: unknown;
}

export function useWarehouses() {
  const { data, isLoading, error } = useQuery<Warehouse[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () =>
      authFetch(api('/api/settings/warehouses')).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return safeArray(await r.json()) as Warehouse[];
      }),
    staleTime: 5 * 60_000,
  });
  return { warehouses: safeArray(data) as Warehouse[], isLoading, error };
}
