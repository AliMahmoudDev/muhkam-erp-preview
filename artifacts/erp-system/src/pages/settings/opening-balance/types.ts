export type OBSubTab = 'treasury' | 'products' | 'customers' | 'suppliers';

export interface SafeItem {
  id: number;
  name: string;
  balance?: number | string;
}

export interface ProductItem {
  id: number;
  name: string;
  sku?: string | null;
  cost_price?: number | string;
  quantity?: number | string;
}

export interface CustomerItem {
  id: number;
  name: string;
  is_customer?: boolean;
  is_supplier?: boolean;
}

export interface OBEntry {
  id: number;
  customer_id?: number;
  reference_id?: number;
  amount?: number;
  quantity?: number;
  unit_cost?: number;
  description?: string;
  customer_name?: string;
  safe_name?: string;
  product_name?: string;
  date?: string;
  created_at: string;
  notes?: string;
}
