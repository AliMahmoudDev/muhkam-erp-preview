import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { SplitPaymentModal } from '@/components/SplitPaymentModal';
import { SuccessModal } from './PosReceipt';
import { usePosData } from './hooks/usePosData';
import { usePosState } from './hooks/usePosState';
import { usePosActions } from './hooks/usePosActions';
import { PosProductGrid } from './PosProductGrid';
import { PosReturnPanel } from './PosReturnPanel';
import { PosCart } from './PosCart';
import { PosPayment } from './PosPayment';
import { PosHeader } from './PosHeader';
import AdminPOSSetup from './AdminPOSSetup';
import { POSPattern } from '@/components/patterns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

/* ─────────────────────────────────────────────────────────────
   MAIN POS PAGE
───────────────────────────────────────────────────────────── */
export default function POSPage() {
  const { user } = useAuth();
  const canEditPrice = hasPermission(user, 'can_edit_price') === true;
  const canCash = hasPermission(user, 'can_cash_sale') === true;
  const canCredit = hasPermission(user, 'can_credit_sale') === true;
  const canReturnSale = hasPermission(user, 'can_return_sale') === true;
  const isAdmin = user?.role === 'admin';
  const profileWarehouse = user?.warehouse_id ?? null;
  const profileSafe = user?.safe_id ?? null;

  const [adminSetup, setAdminSetup] = useState<{
    warehouseId: number | null;
    safeId: number | null;
  }>({ warehouseId: null, safeId: null });

  const warehouseId = profileWarehouse ?? adminSetup.warehouseId;
  const safeId = profileSafe ?? adminSetup.safeId;

  if (!warehouseId || !safeId) {
    if (!isAdmin) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]" dir="rtl">
          <ErrorState
            variant="permission"
            title="وصول مرفوض"
            description="يجب ربط حسابك بمخزن وخزينة أولاً. تواصل مع المدير لإتمام إعداد حسابك قبل استخدام نقطة البيع."
          />
        </div>
      );
    }
    return <AdminPOSSetup onStart={(w, s) => setAdminSetup({ warehouseId: w, safeId: s })} />;
  }

  return (
    <POSBody
      warehouseId={warehouseId}
      safeId={safeId}
      canEditPrice={canEditPrice}
      canCash={canCash}
      canCredit={canCredit}
      canReturnSale={canReturnSale}
      isAdmin={isAdmin}
      onResetSetup={() => setAdminSetup({ warehouseId: null, safeId: null })}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   POS BODY (after access check)
───────────────────────────────────────────────────────────── */
function POSBody({
  warehouseId,
  safeId,
  canEditPrice,
  canCash,
  canCredit,
  canReturnSale,
  isAdmin,
  onResetSetup,
}: {
  warehouseId: number;
  safeId: number;
  canEditPrice: boolean;
  canCash: boolean;
  canCredit: boolean;
  canReturnSale: boolean;
  isAdmin: boolean;
  onResetSetup: () => void;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const data = usePosData({ warehouseId, safeId });
  const state = usePosState({ products: data.products, customers: data.customers });
  const actions = usePosActions({ data, state, user: user ?? null, warehouseId, safeId });

  const cm = state.cashierMode;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--bg)]" dir="rtl">
      {/* ════ EXIT CONFIRM MODAL ════ */}
      {state.showExitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <Card className="p-6 w-full max-w-xs text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <p className="font-bold text-base">فاتورة غير مكتملة</p>
              <p className="opacity-60 text-sm mt-1">
                السلة تحتوي على {state.cart.length} صنف. هل تريد الخروج بدون إتمام البيع؟
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => state.setShowExitConfirm(false)}
              >
                إلغاء
              </Button>
              <Button
                variant="ghost"
                className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/20"
                onClick={() => {
                  state.setCart([]);
                  state.setShowExitConfirm(false);
                  navigate('/sales');
                }}
              >
                خروج بدون حفظ
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ════ HEADER ════ */}
      <PosHeader
        warehouseName={data.warehouseName}
        safeName={data.safeName}
        userName={user?.name}
        canReturnSale={canReturnSale}
        returnMode={state.returnMode}
        onToggleReturnMode={actions.toggleReturnMode}
        cashierMode={cm}
        onToggleCashierMode={() => state.setCashierMode((v) => !v)}
        isAdmin={isAdmin}
        onResetSetup={onResetSetup}
      />

      {/* ════ BODY via POSPattern ════ */}
      <POSPattern
        className="flex-1"
        catalogSlot={
          <PosProductGrid
            search={state.search}
            setSearch={state.setSearch}
            searchRef={state.searchRef}
            filtered={state.filtered}
            cart={state.cart}
            recentlyAdded={state.recentlyAdded}
            cashierMode={cm}
            addToCart={actions.addToCart}
          />
        }
        cartSlot={
          state.returnMode ? (
            <PosReturnPanel
              cm={cm}
              returnInvoiceNo={state.returnInvoiceNo}
              setReturnInvoiceNo={state.setReturnInvoiceNo}
              returnSearchFetching={state.returnSearchFetching}
              returnFetching={state.returnFetching}
              returnSale={state.returnSale}
              setReturnSale={state.setReturnSale}
              returnItems={state.returnItems}
              setReturnItems={state.setReturnItems}
              returnSearchResults={state.returnSearchResults}
              setReturnSearchResults={state.setReturnSearchResults}
              returnReason={state.returnReason}
              setReturnReason={state.setReturnReason}
              returnRefundType={state.returnRefundType}
              setReturnRefundType={state.setReturnRefundType}
              handleReturn={actions.handleReturn}
              selectReturnInvoice={actions.selectReturnInvoice}
              isPending={actions.returnMutation.isPending}
            />
          ) : (
            <PosCart
              cart={state.cart}
              canEditPrice={canEditPrice}
              editingPriceId={state.editingPriceId}
              editingPriceVal={state.editingPriceVal}
              setEditingPriceId={state.setEditingPriceId}
              setEditingPriceVal={state.setEditingPriceVal}
              commitPrice={actions.commitPrice}
              updateQty={actions.updateQty}
              removeItem={actions.removeItem}
              clearCart={() => state.setCart([])}
            />
          )
        }
        paymentSlot={
          !state.returnMode ? (
            <PosPayment
              cm={cm}
              cartLength={state.cart.length}
              cartSubtotal={state.cartSubtotal}
              cartTotal={state.cartTotal}
              discountPct={state.discountPct}
              setDiscountPct={state.setDiscountPct}
              discountAmt={state.discountAmt}
              customerItems={state.customerItems}
              customerId={state.customerId}
              setCustomerId={state.setCustomerId}
              checkoutError={state.checkoutError}
              isPending={actions.checkoutMutation.isPending}
              onCheckout={actions.handleCheckout}
            />
          ) : undefined
        }
      />

      {/* ════ SPLIT PAYMENT MODAL ════ */}
      {state.showSplitPayment && (
        <SplitPaymentModal
          total={state.cartTotal}
          safes={data.safes}
          defaultSafeId={safeId}
          isRestricted={!isAdmin}
          canCash={canCash}
          canCredit={canCredit}
          hasCustomer={!!state.customerId}
          isPending={actions.checkoutMutation.isPending}
          onConfirm={actions.handleSplitConfirm}
          onClose={() => {
            state.setShowSplitPayment(false);
            state.setCheckoutError(null);
          }}
        />
      )}

      {/* ════ SUCCESS MODAL ════ */}
      {state.successInvoice && (
        <SuccessModal
          invoice={state.successInvoice}
          onClose={() => {
            state.setSuccessInvoice(null);
            setTimeout(() => state.searchRef.current?.focus(), 100);
          }}
        />
      )}
    </div>
  );
}
