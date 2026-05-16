import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { safeArray } from '@/lib/safe-data';

export interface Safe {
  id: number;
  name: string;
  balance?: string | number;
  [key: string]: unknown;
}

export function useSafes() {
  const { data, isLoading, error } = useQuery<Safe[]>({
    queryKey: ['/api/settings/safes'],
    queryFn: () => authFetch(api('/api/settings/safes')).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });
  return { safes: safeArray(data) as Safe[], isLoading, error };
}
