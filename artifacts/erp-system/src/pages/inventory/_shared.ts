/* shared types, helpers and constants for the inventory module */

  export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
  export const api = (p: string) => `${BASE}${p}`;

  export interface AuditProduct {
    id: number;
    name: string;
    sku: string | null;
    category: string | null;
    actual_qty: number;
    cost_price: number;
    sale_price: number;
    low_stock_threshold: number | null;
    opening_qty: number;
    purchased_qty: number;
    sold_qty: number;
    sale_return_qty: number;
    purchase_return_qty: number;
    adjustment_qty: number;
    calculated_qty: number;
    discrepancy: number;
    total_value: number;
  }
  export interface AuditSummary {
    total_products: number;
    total_inventory_value: number;
    low_stock_count: number;
    zero_stock_count: number;
  }
  export interface StockMovement {
    id: number;
    product_id: number;
    product_name: string;
    movement_type: string;
    quantity: number;
    quantity_before: number;
    quantity_after: number;
    unit_cost: number;
    reference_type: string | null;
    reference_id: number | null;
    reference_no: string | null;
    notes: string | null;
    date: string | null;
    created_at: string;
  }
  export interface ProductDetail {
    product: {
      id: number;
      name: string;
      sku: string | null;
      quantity: number;
      cost_price: number;
      sale_price: number;
    };
    movements: StockMovement[];
    calculated_qty: number;
    actual_qty: number;
    discrepancy: number;
    breakdown: Record<string, number>;
    formula: string;
  }
  export interface CountSession {
    id: number;
    warehouse_id: number;
    status: string;
    notes: string | null;
    created_at: string;
    applied_at: string | null;
  }
  export interface CountSessionEnriched extends CountSession {
    items_count: number;
    adjustments_count: number;
  }
  export interface StockTransfer {
    id: number;
    from_warehouse_id: number;
    to_warehouse_id: number;
    status: string;
    notes: string | null;
    created_at: string;
  }
  export interface TransferEnriched extends StockTransfer {
    items_count: number;
    total_qty: number;
  }
  export interface WarehouseSummaryItem {
    warehouse_id: number;
    warehouse_name: string;
    item_count: number;
    total_value: number;
    pct_of_total: number;
  }
  export interface LowStockItem {
    product_id: number;
    product_name: string;
    sku: string | null;
    category: string | null;
    cost_price: number;
    min_stock: number;
    warehouse_id: number;
    warehouse_name: string;
    current_qty: number;
    shortage: number;
    suggested_qty: number;
    is_zero: boolean;
    available_elsewhere: { warehouse_id: number; warehouse_name: string; qty: number }[];
  }
  export interface TransferPrefill {
    fromWH: number;
    toWH: number;
    productId: number;
    productName: string;
    qty: number;
  }

  export const movementTypeLabel: Record<string, { label: string; color: string }> = {
    opening_balance: { label: 'رصيد افتتاحي', color: 'bg-blue-500/20 text-blue-300' },
    purchase: { label: 'مشتريات', color: 'bg-emerald-500/20 text-emerald-300' },
    sale: { label: 'مبيعات', color: 'bg-red-500/20 text-red-300' },
    sale_return: { label: 'مرتجع مبيعات', color: 'bg-teal-500/20 text-teal-300' },
    purchase_return: { label: 'مرتجع مشتريات', color: 'bg-orange-500/20 text-orange-300' },
    adjustment: { label: 'تسوية يدوية', color: 'bg-violet-500/20 text-violet-300' },
    transfer_out: { label: 'تحويل خروج', color: 'bg-amber-500/20 text-amber-300' },
    transfer_in: { label: 'تحويل دخول', color: 'bg-cyan-500/20 text-cyan-300' },
  };

  export type Tab = 'overview' | 'movements' | 'count' | 'transfer' | 'alerts' | 'reports';

  export function today() {
    return new Date().toISOString().slice(0, 10);
  }
  export function nowTime() {
    return new Date().toTimeString().slice(0, 5);
  }
  