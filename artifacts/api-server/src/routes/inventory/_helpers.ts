/** inventory/_helpers.ts — shared types, schemas, and formatters */
import { z } from 'zod';
import { stockMovementsTable } from '@workspace/db';

export const inventoryAdjustmentSchema = z.object({
  product_id: z
    .number({
      required_error: 'معرّف المنتج مطلوب',
      invalid_type_error: 'معرّف المنتج يجب أن يكون رقماً',
    })
    .int()
    .positive(),
  new_quantity: z
    .number({
      required_error: 'الكمية الجديدة مطلوبة',
      invalid_type_error: 'الكمية يجب أن تكون رقماً',
    })
    .min(0, 'الكمية لا يمكن أن تكون سالبة'),
  notes: z.string().max(500).optional().nullable(),
  warehouse_id: z.number().int().positive().optional().nullable(),
});

export interface AuditRow {
  id: unknown;
  name: unknown;
  sku: unknown;
  category: unknown;
  actual_qty: unknown;
  cost_price: unknown;
  sale_price: unknown;
  low_stock_threshold: unknown;
  opening_qty: unknown;
  purchased_qty: unknown;
  sold_qty: unknown;
  sale_return_qty: unknown;
  purchase_return_qty: unknown;
  adjustment_qty: unknown;
  calculated_qty: unknown;
}


export function fmtMovement(m: typeof stockMovementsTable.$inferSelect) {
  return {
    ...m,
    quantity: Number(m.quantity),
    quantity_before: Number(m.quantity_before),
    quantity_after: Number(m.quantity_after),
    unit_cost: Number(m.unit_cost),
    created_at: m.created_at.toISOString(),
  };
}
export { inventoryAdjustmentSchema };
export type { AuditRow };
