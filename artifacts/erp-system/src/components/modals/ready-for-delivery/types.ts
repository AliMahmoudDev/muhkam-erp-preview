export type QcStatus = "pass" | "fail" | "n/a";

export interface IntakeItem {
  id: string;
  label: string;
  category?: string;
  status?: string | null;
  notes?: string | null;
}

export interface QcItem {
  id: string;
  label: string;
  category?: string;
  intake_status?: string | null;
  intake_notes?: string | null;
  status: QcStatus | null;
  notes: string;
}

export interface Product {
  id: number;
  name: string;
  quantity: string | number;
  sell_price: string | number;
  warehouse_id?: number | null;
}

export interface Warehouse {
  id: number;
  name: string;
}

export type PayType = "cash" | "credit";

export interface PayRow {
  id: string;
  type: PayType;
  safe_id: number | null;
  amount: number;
}

export interface PartLine {
  id: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  warehouse_id: number | null;
}

export interface JobLite {
  id: number;
  job_no: string;
  device_brand?: string | null;
  device_model?: string | null;
  customer_name?: string | null;
  final_cost?: string | number | null;
  checklist?: unknown;
  qa_checklist?: unknown;
  qa_notes?: string | null;
  device_score?: number | null;
  broker_name?: string | null;
  broker_commission?: string | number | null;
}

export function parseChecklist(raw: unknown): IntakeItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); if (Array.isArray(v)) arr = v; } catch { /**/ }
  }
  return arr
    .map((c, i) => {
      const o = c as Record<string, unknown>;
      const id = String(o.id ?? o.item_id ?? `item-${i}`);
      if (id === "__power_off__") return null;
      return {
        id,
        label:    String(o.label ?? o.label_ar ?? `بند ${i + 1}`),
        category: typeof o.category === "string" ? o.category : undefined,
        status:   typeof o.status === "string" ? o.status : null,
        notes:    typeof o.notes === "string" ? o.notes : null,
      } as IntakeItem;
    })
    .filter((x): x is IntakeItem => x !== null);
}

export function parseSavedQc(raw: unknown): Array<{ id?: string; label?: string; status?: string; notes?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ id?: string; label?: string; status?: string; notes?: string }>;
  if (typeof raw === "string" && raw.trim()) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}
