export interface Product {
  id: number;
  name: string;
  quantity: string | number;
  sell_price: string | number;
  warehouse_id?: number | null;
}
export interface Warehouse { id: number; name: string; }
export type PayType = "cash" | "credit";
export interface PayRow { id: string; type: PayType; safe_id: number | null; amount: number; }
export type DiscMode = 'amt' | 'pct';
export type PartSource = 'internal' | 'external';
export interface PartLine {
  id: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  warehouse_id: number | null;
  discount_value: number;
  discount_mode: DiscMode;
  source: PartSource;
  external_vendor?: string;
}
export interface PreSavedPart {
  product_name: string;
  quantity:     number;
  unit_price:   number;
  total:        number;
}

export interface ReceiptBase {
  job_no:              string;
  customer_name:       string | null;
  customer_phone:      string | null;
  device_brand:        string | null;
  device_model:        string | null;
  imei:                string | null;
  received_at:         string | null;
  problem_description: string | null;
  technician_name:     string | null;
  final_cost:          number;
  deposit_paid:        number;
  shipping_cost:       number;
  final_discount:      number;
  parts_total:         number;
  parts:               PreSavedPart[];
}
export interface SafeRow { id: number; name: string; balance: string | number; }
export interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  customer_name?: string | null;
  final_cost?: string | number | null;
  broker_name?: string | null;
  broker_commission?: string | number | null;
}

export function lineDiscountAmount(l: Pick<PartLine, "quantity" | "unit_price" | "discount_value" | "discount_mode">): number {
  const gross = l.quantity * l.unit_price;
  if (l.discount_value <= 0 || gross <= 0) return 0;
  const raw = l.discount_mode === 'pct'
    ? (gross * Math.min(l.discount_value, 100)) / 100
    : Math.min(l.discount_value, gross);
  return Math.max(0, raw);
}
export function lineNet(l: Pick<PartLine, "quantity" | "unit_price" | "discount_value" | "discount_mode">): number {
  return Math.max(0, l.quantity * l.unit_price - lineDiscountAmount(l));
}
