/* ── Shared types for devices module ── */
export type DeviceStatus = "available" | "sold" | "maintenance";
export type PaymentMethod = "cash" | "card" | "instapay" | "transfer";
export type PaymentStatus = "paid" | "partial" | "unpaid";

export type Device = {
  id: number; company_id: number; branch_id?: number;
  device_no: string;
  brand: string; model: string; color?: string; storage?: string;
  imei?: string; serial_no?: string;
  battery_health?: number; grade?: string; condition_notes?: string;
  purchase_price: string; sale_price: string;
  status: DeviceStatus;
  dual_sim: boolean; with_box: boolean;
  icloud_locked: boolean; network_locked: boolean; previously_opened: boolean; mdm_locked: boolean;
  supplier_name?: string; purchase_invoice_no?: string; inspector_name?: string;
  sold_to_customer_name?: string; sold_at?: string;
  sold_by_user_name?: string; sold_price?: string;
  warranty_months?: number; payment_method?: string; payment_status?: string;
  added_by_user_name?: string; created_at: string;
  supplier_phone?: string; id_card_data?: string;
};

export type Stats = {
  total: number; available: number; sold: number; maintenance: number;
  stock_purchase_value: number; stock_sale_value: number; stock_profit_potential: number;
  sold_revenue: number; sold_profit: number;
};
