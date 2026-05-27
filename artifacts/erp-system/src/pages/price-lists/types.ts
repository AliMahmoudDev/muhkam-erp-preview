/* ──────────────────────────────── Types ────────────────────────────────── */

export interface PriceList {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PriceListItem {
  id: number;
  price_list_id: number;
  product_id: number;
  markup_percent: number | null;
  product_name: string;
  cost_price: number;
  sale_price: number;
  sku: string | null;
}

export interface PriceListDetail extends PriceList {
  items: PriceListItem[];
}

export interface Product {
  id: number;
  name: string;
  cost_price: number;
  sale_price: number;
  sku: string | null;
  category_name?: string | null;
}

export interface PriceListFormData {
  name: string;
  description: string;
  is_active: boolean;
  items: { product_id: number; markup_percent: number | null }[];
}
