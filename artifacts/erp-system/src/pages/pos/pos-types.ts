export interface ReturnSaleItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ReturnSale {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer_name: string | null;
  total_amount: number;
  payment_type: string;
  date: string | null;
  status: string;
  items: ReturnSaleItem[];
}

export interface ReturnItem {
  id: number;
  product_id: number;
  product_name: string;
  max_qty: number;
  return_qty: number;
  unit_price: number;
}

export interface PosUser {
  id?: number | null;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  warehouse_id?: number | null;
  safe_id?: number | null;
}

export interface PosCustomer {
  id: number;
  name: string;
  customer_code?: string | null;
  balance?: number | string | null;
  phone?: string | null;
}
