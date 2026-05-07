/**
 * hooks/useNewSaleData.ts
 * All data queries for the new-sale POS panel.
 * No mutations, no state — pure data fetching.
 */
import { safeArray } from '@/lib/safe-data';
import { authFetch } from '@/lib/auth-fetch';
import {
  useGetProducts,
  useGetCustomers,
  useGetSettingsSafes,
  useCreateProduct,
  useGetCategories,
} from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useNewSaleData() {
  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);

  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw).filter((c) => c.is_customer !== false);

  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);

  const { data: categoriesRaw } = useGetCategories();
  const categories = safeArray(categoriesRaw);

  const createProductMutation = useCreateProduct();

  const { data: warehousesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () =>
      authFetch(api('/api/settings/warehouses')).then(async (r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        const j = await r.json();
        return safeArray(j);
      }),
  });
  const warehouses = safeArray(warehousesRaw);

  return {
    products,
    customers,
    safes,
    categories,
    warehouses,
    createProductMutation,
  };
}
