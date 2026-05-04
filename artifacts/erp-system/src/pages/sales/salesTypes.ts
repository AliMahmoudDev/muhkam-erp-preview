export interface SalesReturn {
  id: number;
  return_no: string;
  customer_name: string | null;
  total_amount: number;
  reason: string | null;
  created_at: string;
  refund_type: string | null;
  safe_name: string | null;
  date: string | null;
}

export interface InvoiceSummary {
  id: number;
  invoice_no: string;
  date: string | null;
  customer_name: string | null;
  customer_id: number | null;
  payment_type: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  safe_id: number | null;
  safe_name: string | null;
  status: string;
  posting_status: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  items: {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    quantity_returned: number | null;
  }[];
}

export interface ReturnLineItem {
  original_sale_item_id: number;
  product_id: number;
  product_name: string;
  returnQty: number;
  maxQty: number;
  unit_price: number;
}

export interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_disc?: number;
  item_disc_mode?: 'pct' | 'amt';
}

export type HeldInvoice = {
  id: string;
  ts: number;
  cart: CartItem[];
  customerId: string;
  discountPct: string;
  discountMode: 'pct' | 'amt';
  invoiceNote: string;
  label: string;
};

export interface SuccessInvoice {
  invoice_no: string;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  payment_type: string;
  items: CartItem[];
  payments?: { label: string; amount: number }[];
}

export type PayRow = { id: string; type: 'cash' | 'credit'; safe_id: number | null; amount: number };

export interface SaleExtras {
  warehouse_name?:   string | null;
  salesperson_name?: string | null;
  discount_amount?:  number | null;
  discount_percent?: number | null;
  tax_rate?:         number | null;
  tax_amount?:       number | null;
}
