// ✔ POS UX CLEANED — SINGLE ENTRY POINT
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { AlertTriangle } from 'lucide-react';
import { SplitPaymentModal } from '@/components/SplitPaymentModal';
import { SuccessModal } from './PosReceipt';
import { usePosData } from './hooks/usePosData';
import { usePosState } from './hooks/usePosState';
import { usePosActions } from './hooks/usePosActions';
import { PosProductGrid } from './PosProductGrid';
import { PosReturnPanel } from './PosReturnPanel';
import { PosCartPanel } from './PosCartPanel';
import { PosHeader } from './PosHeader';
import AdminPOSSetup from './AdminPOSSetup';

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
        <div
          className="erp-page fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8"
          dir="rtl"
        >
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="erp-title text-2xl">وصول مرفوض</h2>
            <p className="text-red-400 font-bold text-lg">يجب ربط حسابك بمخزن وخزينة أولاً</p>
            <p className="erp-text-muted">
              تواصل مع المدير لإتمام إعداد حسابك قبل استخدام نقطة البيع
            </p>
          </div>
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
  const stockClass = (qty: number) =>
    qty <= 0 ? 'erp-badge-danger' : qty <= 5 ? 'erp-badge-warning' : 'erp-badge-neutral';

  return (
    <div className="erp-page fixed inset-0 flex flex-col overflow-hidden" dir="rtl">
      {/* ════════════════════ EXIT CONFIRM MODAL ════════════════ */}
      {state.showExitConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div className="erp-card-soft rounded-2xl p-6 w-full max-w-xs text-center space-y-4 border border-white/10 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <p className="erp-text font-bold text-base">فاتورة غير مكتملة</p>
              <p className="erp-label text-sm mt-1">
                السلة تحتوي على {state.cart.length} صنف. هل تريد الخروج بدون إتمام البيع؟
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => state.setShowExitConfirm(false)}
                className="flex-1 erp-btn-secondary rounded-xl py-2 text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  state.setCart([]);
                  state.setShowExitConfirm(false);
                  navigate('/sales');
                }}
                className="flex-1 rounded-xl py-2 text-sm font-bold bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-colors"
              >
                خروج بدون حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ HEADER ════════════════════ */}
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

      {/* ════════════════════ BODY ════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Products panel */}
        <PosProductGrid
          search={state.search}
          setSearch={state.setSearch}
          searchRef={state.searchRef}
          filtered={state.filtered}
          cart={state.cart}
          recentlyAdded={state.recentlyAdded}
          cashierMode={cm}
          addToCart={actions.addToCart}
          stockClass={stockClass}
        />

        {/* Return panel */}
        {state.returnMode && (
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
        )}

        {/* Cart + Payment panel */}
        {!state.returnMode && (
          <PosCartPanel
            cm={cm}
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
        )}
      </div>

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
