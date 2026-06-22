import { PosCart } from './PosCart';
import { PosPayment } from './PosPayment';
import type { CartItem } from './PosReceipt';
import type { CustomerPickerItem } from './PosCustomerPicker';

interface PosCartPanelProps {
  cm: boolean;
  // PosCart props
  cart: CartItem[];
  canEditPrice: boolean;
  editingPriceId: number | null;
  editingPriceVal: string;
  setEditingPriceId: (id: number | null) => void;
  setEditingPriceVal: (v: string) => void;
  commitPrice: (pid: number, val: string) => void;
  updateQty: (pid: number, delta: number) => void;
  removeItem: (pid: number) => void;
  clearCart: () => void;
  // PosPayment props
  cartSubtotal: number;
  cartTotal: number;
  discountPct: string;
  setDiscountPct: (v: string) => void;
  discountAmt: number;
  customerItems: CustomerPickerItem[];
  customerId: string;
  setCustomerId: (v: string) => void;
  checkoutError: string | null;
  isPending: boolean;
  onCheckout: () => void;
}

export function PosCartPanel({
  cm,
  cart,
  canEditPrice,
  editingPriceId,
  editingPriceVal,
  setEditingPriceId,
  setEditingPriceVal,
  commitPrice,
  updateQty,
  removeItem,
  clearCart,
  cartSubtotal,
  cartTotal,
  discountPct,
  setDiscountPct,
  discountAmt,
  customerItems,
  customerId,
  setCustomerId,
  checkoutError,
  isPending,
  onCheckout,
}: PosCartPanelProps) {
  return (
    <div
      className="flex flex-col shrink-0 bg-[var(--surface)] border-s border-[var(--line)]"
      style={{ width: cm ? '420px' : '360px' }}
    >
      <PosCart
        cart={cart}
        canEditPrice={canEditPrice}
        editingPriceId={editingPriceId}
        editingPriceVal={editingPriceVal}
        setEditingPriceId={setEditingPriceId}
        setEditingPriceVal={setEditingPriceVal}
        commitPrice={commitPrice}
        updateQty={updateQty}
        removeItem={removeItem}
        clearCart={clearCart}
      />
      <PosPayment
        cm={cm}
        cartLength={cart.length}
        cartSubtotal={cartSubtotal}
        cartTotal={cartTotal}
        discountPct={discountPct}
        setDiscountPct={setDiscountPct}
        discountAmt={discountAmt}
        customerItems={customerItems}
        customerId={customerId}
        setCustomerId={setCustomerId}
        checkoutError={checkoutError}
        isPending={isPending}
        onCheckout={onCheckout}
      />
    </div>
  );
}
