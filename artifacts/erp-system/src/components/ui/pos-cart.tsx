/**
 * POSCart — point-of-sale cart display.
 *
 * Presentation only: no pricing calculation.
 * All totals passed as pre-formatted strings.
 * Quantity controls and line-item actions are slots.
 * Mobile sheet-friendly (fixed-height body + scroll).
 */
import * as React from 'react';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface POSCartItem {
  id: string;
  /** Product name. */
  name: string;
  /** SKU / product code. Optional. */
  sku?: string;
  /** Pre-formatted unit price. */
  unitPrice: string;
  /** Current quantity (numeric for display). */
  qty: number;
  /** Pre-formatted line total. */
  lineTotal: string;
  /**
   * Slot for quantity controls (−/+ buttons or a numeric input).
   * Caller wires quantity mutation logic.
   */
  quantitySlot?: React.ReactNode;
  /**
   * Slot for line item actions (delete, discount, notes).
   */
  itemActionsSlot?: React.ReactNode;
}

export interface POSCartProps {
  items: POSCartItem[];
  /** Pre-formatted subtotal. */
  subtotal: string;
  /** Pre-formatted discount amount. Omit to hide. */
  discount?: string;
  /** Pre-formatted grand total — rendered as the "hero" number. */
  total: string;
  /**
   * Slot for primary/secondary cart actions (e.g. "إتمام البيع", "تعليق").
   */
  actionsSlot?: React.ReactNode;
  /** Slot shown when cart is empty. */
  emptySlot?: React.ReactNode;
  className?: string;
}

export function POSCart({
  items,
  subtotal,
  discount,
  total,
  actionsSlot,
  emptySlot,
  className,
}: POSCartProps) {
  const isEmpty = items.length === 0;

  return (
    <div className={cn('erp-pos-cart', className)}>
      {/* ── Items list ── */}
      <div className="erp-pos-cart-body">
        {isEmpty ? (
          <div className="erp-pos-cart-empty">
            {emptySlot ?? (
              <>
                <ShoppingCart
                  className="erp-pos-cart-empty-icon"
                  aria-hidden="true"
                />
                <p className="erp-pos-cart-empty-text">السلة فارغة</p>
              </>
            )}
          </div>
        ) : (
          <ul className="erp-pos-cart-list">
            {items.map((item) => (
              <li key={item.id} className="erp-pos-cart-item">
                {/* Product info */}
                <div className="erp-pos-cart-item-info">
                  <span className="erp-pos-cart-item-name">{item.name}</span>
                  {item.sku && (
                    <span className="erp-pos-cart-item-sku">{item.sku}</span>
                  )}
                  <span className="erp-pos-cart-item-price">
                    {item.unitPrice}
                  </span>
                </div>

                {/* Quantity + actions */}
                <div className="erp-pos-cart-item-controls">
                  {item.quantitySlot && (
                    <div className="erp-pos-cart-qty">
                      {item.quantitySlot}
                    </div>
                  )}
                  <span className="erp-pos-cart-item-total">
                    {item.lineTotal}
                  </span>
                  {item.itemActionsSlot && (
                    <div className="erp-pos-cart-item-actions">
                      {item.itemActionsSlot}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Totals ── */}
      {!isEmpty && (
        <div className="erp-pos-cart-totals">
          <div className="erp-pos-cart-total-row">
            <span>المجموع</span>
            <span className="erp-pos-cart-amount">{subtotal}</span>
          </div>
          {discount && (
            <div className="erp-pos-cart-total-row erp-pos-cart-total-row--discount">
              <span>الخصم</span>
              <span className="erp-pos-cart-amount">−{discount}</span>
            </div>
          )}
          <div className="erp-pos-cart-grand">
            <span className="erp-pos-cart-grand-label">الإجمالي</span>
            <span className="erp-pos-cart-grand-value">{total}</span>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {actionsSlot && (
        <div className="erp-pos-cart-actions">{actionsSlot}</div>
      )}
    </div>
  );
}
