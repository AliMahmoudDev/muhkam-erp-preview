/** purchases/_helpers.ts */
import { purchasesTable, purchaseItemsTable } from '@workspace/db';

export function formatPurchase(p: typeof purchasesTable.$inferSelect) {
  return {
    ...p,
    total_amount: Number(p.total_amount),
    paid_amount: Number(p.paid_amount),
    remaining_amount: Number(p.remaining_amount),
    exchange_rate: Number((p as Record<string, unknown>).exchange_rate ?? 1),
    currency: String((p as Record<string, unknown>).currency ?? 'EGP'),
    shipping_cost: Number((p as Record<string, unknown>).shipping_cost ?? 0),
    created_at: p.created_at.toISOString(),
  };
}

export function formatPurchaseItem(item: typeof purchaseItemsTable.$inferSelect) {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
    quantity_returned: item.quantity_returned != null ? Number(item.quantity_returned) : null,
  };
}
