import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import type { OBEntry } from '../types';

export function useOBQuery(path: string) {
  return useQuery<OBEntry[]>({
    queryKey: [`ob${path}`],
    queryFn: async () => {
      const res = await authFetch(api(`/api${path}`));
      if (!res.ok) throw new Error('فشل تحميل القيود');
      return res.json();
    },
    staleTime: 15_000,
  });
}
