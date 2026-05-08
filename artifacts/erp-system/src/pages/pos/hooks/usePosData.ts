import { useQuery } from '@tanstack/react-query';
import { safeArray } from '@/lib/safe-data';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useGetCustomers, useGetSettingsSafes } from '@workspace/api-client-react';
import type { PosCustomer } from '../pos-types';

export interface PosProduct {
  id: number;
  name: string;
  sku: string | null;
  quantity: number;
  sale_price: number;
  cost_price: number;
  barcode?: string | null;
}

export function usePosData({ warehouseId, safeId }: { warehouseId: number; safeId: number }) {
  const { data: products = [] } = useQuery<PosProduct[]>({
    queryKey: ['/api/products'],
    queryFn: () =>
      authFetch(api('/api/products')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 60_000,
  });

  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw) as PosCustomer[];

  const { data: safesBodyRaw } = useGetSettingsSafes();
  const safes = safeArray(safesBodyRaw) as { id: number; name: string }[];

  const { data: warehousesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () =>
      authFetch(api('/api/settings/warehouses')).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        return safeArray(j);
      }),
    staleTime: 5 * 60_000,
  });
  const warehouses = safeArray(warehousesRaw) as { id: number; name: string }[];

  const warehouseName =
    warehouses.find((w) => w.id === warehouseId)?.name ?? `فرع ${warehouseId}`;
  const safeName = safes.find((s) => s.id === safeId)?.name ?? `خزينة ${safeId}`;

  return { products, customers, safes, warehouses, warehouseName, safeName };
}
