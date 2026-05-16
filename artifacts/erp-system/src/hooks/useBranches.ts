import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { safeArray } from '@/lib/safe-data';

export interface Branch {
  id: number;
  name: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export function useBranches() {
  const { data, isLoading, error } = useQuery<Branch[]>({
    queryKey: ['/api/branches'],
    queryFn: () => authFetch(api('/api/branches')).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });
  return { branches: safeArray(data) as Branch[], isLoading, error };
}
