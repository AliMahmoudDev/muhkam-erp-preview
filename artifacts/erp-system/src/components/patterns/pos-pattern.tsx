/**
 * POSPattern — point-of-sale full-viewport layout.
 *
 * Structure (RTL):
 *   ┌────────────────────────┬─────────────────────┐
 *   │  Catalog (main)        │  Sidebar (cart)      │
 *   │  ─ catalogSlot         │  ─ customerSlot (top)│
 *   │    (scrollable grid)   │  ─ cartSlot (scroll) │
 *   │                        │  ─ paymentSlot (btm) │
 *   └────────────────────────┴─────────────────────┘
 *   Mobile: catalog full-width + mobileCartSlot bottom sheet.
 *
 * In RTL (dir=rtl): catalog on the RIGHT, sidebar on the LEFT.
 * No calculation logic. No pricing logic. No API calls.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type POSState = 'idle' | 'loading' | 'error';

export interface POSPatternProps {
  /**
   * Customer lookup / barcode search bar.
   * Renders at the top of the cart sidebar.
   */
  customerSlot?: React.ReactNode;

  /**
   * Product catalog / grid slot — the scrollable main area.
   * Typically a grid of product cards with add-to-cart buttons.
   */
  catalogSlot?: React.ReactNode;

  /**
   * Cart slot — the list of line items in the current transaction.
   * Renders in the middle (scrollable) section of the sidebar.
   */
  cartSlot?: React.ReactNode;

  /**
   * Payment / totals slot — subtotal, tax, discount, pay button.
   * Renders as a sticky surface at the bottom of the sidebar.
   */
  paymentSlot?: React.ReactNode;

  /**
   * Mobile cart bottom sheet slot — shown only on narrow viewports.
   * Replaces the desktop sidebar on mobile.
   * The caller controls open/closed state of the bottom sheet.
   */
  mobileCartSlot?: React.ReactNode;

  /**
   * Loading slot — shown when state === 'loading'.
   * Covers the catalog area while products are fetching.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Error slot — shown when state === 'error'.
   */
  errorSlot?: React.ReactNode;

  /**
   * Current POS state.
   * 'idle'    → normal catalog + cart
   * 'loading' → loadingSlot in catalog area
   * 'error'   → errorSlot in catalog area
   */
  state?: POSState;

  className?: string;
}

export function POSPattern({
  customerSlot,
  catalogSlot,
  cartSlot,
  paymentSlot,
  mobileCartSlot,
  loadingSlot,
  errorSlot,
  state = 'idle',
  className,
}: POSPatternProps) {
  const isLoading = state === 'loading';

  return (
    <div className={cn('erp-pos', className)}>

      {/* Catalog — main scrollable area */}
      <div
        className="erp-pos-catalog"
        aria-label="كتالوج المنتجات"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {isLoading && (
          <div
            className="erp-pos-state"
            role="status"
            aria-label="جارٍ تحميل المنتجات"
          >
            {loadingSlot ?? (
              <div className="erp-pos-loading-placeholder" aria-hidden="true" />
            )}
          </div>
        )}
        {state === 'error' && (
          <div className="erp-pos-state" role="alert">
            {errorSlot}
          </div>
        )}
        {state === 'idle' && catalogSlot}
      </div>

      {/* Sidebar — customer + cart + payment (desktop) */}
      <div className="erp-pos-sidebar">
        {customerSlot && (
          <div className="erp-pos-customer">
            {customerSlot}
          </div>
        )}

        <div
          className="erp-pos-cart"
          role="region"
          aria-label="سلة المشتريات"
        >
          {cartSlot}
        </div>

        {paymentSlot && (
          <div
            className="erp-pos-payment"
            role="region"
            aria-label="الدفع والإجماليات"
          >
            {paymentSlot}
          </div>
        )}
      </div>

      {/* Mobile cart bottom sheet — visible only on narrow screens */}
      {mobileCartSlot && (
        <div
          className="erp-pos-mobile-cart"
          role="complementary"
          aria-label="سلة المشتريات"
        >
          {mobileCartSlot}
        </div>
      )}

    </div>
  );
}
