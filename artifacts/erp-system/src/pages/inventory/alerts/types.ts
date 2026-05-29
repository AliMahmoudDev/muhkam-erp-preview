export interface ReorderSuggestion {
  product_id: number;
  product_name: string;
  sku: string | null;
  category: string | null;
  cost_price: number;
  min_stock: number | null;
  current_qty: number;
  sold_qty_30d: number;
  daily_velocity: number;
  coverage_days: number | null;
  suggested_qty: number;
  suggested_cost: number;
  reason: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  is_supplier?: boolean;
}
