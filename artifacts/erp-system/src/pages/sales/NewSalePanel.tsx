import { useEffect, useRef } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { ProductFormModal } from '@/components/product-form-modal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { api } from '@/lib/api';
import WhatsAppSuccessModal from './WhatsAppSuccessModal';
import { useNewSaleData } from './hooks/useNewSaleData';
import { useNewSaleForm } from './hooks/useNewSaleForm';
import { SaleProductPicker } from './SaleProductPicker';
import { SaleCartItems } from './SaleCartItems';
import { SalePaymentSection } from './SalePaymentSection';

export function NewSalePanel({ onDone }: { onDone: () => void }) {
  const { user: currentUser } = useAuth();
  const canEditPrice = hasPermission(currentUser, 'can_edit_price') === true;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Data ────────────────────────────────────────────────────────────────
  const { products, customers, safes, categories, warehouses, createProductMutation } =
    useNewSaleData();

  // ── Form state + cart logic ──────────────────────────────────────────────
  const form = useNewSaleForm({
    products,
    customers,
    safes,
    warehouses,
    currentUser,
    createProductMutation,
  });

  const {
    search, setSearch,
    cart, setCart,
    customerId, setCustomerId,
    invoiceNote, setInvoiceNote,
    discountMode, setDiscountMode,
    barcodeMode, setBarcodeMode,
    editingDisc, setEditingDisc,
    showQuickCustomer, setShowQuickCustomer,
    quickCustName, setQuickCustName,
    quickCustPhone, setQuickCustPhone,
    quickCustLoading,
    heldInvoices,
    showHeld, setShowHeld,
    warehouseId, setWarehouseId,
    discountPct, setDiscountPct,
    categoryFilter, setCategoryFilter,
    payRows, setPayRows,
    payType, setPayType,
    paySafe, setPaySafe,
    payAmount, setPayAmount,
    payShake,
    payRowKey,
    recentlyAdded,
    editingPrice, setEditingPrice,
    checkoutError, setCheckoutError,
    successInvoice, setSuccessInvoice,
    showCreateProduct, setShowCreateProduct,
    searchInputRef,
    payAmountRef,
    isRestricted,
    effectiveWarehouseId,
    effectiveWarehouseName,
    salespersonId,
    salespersonName,
    filteredProducts,
    cartSubtotal,
    discountAmount,
    cartTotal,
    selectedCustomer,
    customerSaleItems,
    payPaidSoFar,
    payRemaining,
    payPct,
    payIsDone,
    payCreditWarn,
    addToCart,
    updateQty,
    updatePrice,
    updateItemDisc,
    handleCreateProduct,
    handleSearchKeyDown,
    _handleNewSale,
    holdInvoice,
    resumeHold,
    deleteHold,
    createQuickCustomer,
    confirmPayRow,
    fillPayRemaining,
  } = form;

  // ── Checkout mutation ────────────────────────────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: (data: object) =>
      authFetch(api('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'خطأ غير متوقع في التسجيل');
        return j;
      }),
    onSuccess: (data) => {
      const customer = customers.find((c) => c.id === parseInt(customerId));
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setCheckoutError(null);
      setPayRows([]);
      setPayAmount('');
      setSuccessInvoice({
        invoice_no: data.invoice_no,
        total_amount: data.total_amount,
        customer_name: customer?.name ?? null,
        customer_phone: customer?.phone ?? null,
        payment_type: data.payment_type ?? 'cash',
        items: [...cart],
        payments: payRows.map((r) => ({
          label:
            r.type === 'credit'
              ? 'آجل'
              : (safes.find((s) => s.id === r.safe_id)?.name ?? 'نقدي'),
          amount: r.amount,
        })),
      });
      setCart([]);
      setCustomerId('');
      setDiscountPct('');
      setInvoiceNote('');
      setDiscountMode('pct');
    },
    onError: (e: Error) => {
      setCheckoutError(e.message);
      toast({ title: '❌ فشل التسجيل', description: e.message, variant: 'destructive' });
    },
  });

  const canCheckout =
    cart.length > 0 && payIsDone && !checkoutMutation.isPending && !payCreditWarn;

  const handleCheckout = () => {
    if (!canCheckout) return;
    if (!effectiveWarehouseId) {
      toast({
        title: 'المخزن غير محدد — يرجى مراجعة المدير لإعداد حسابك',
        variant: 'destructive',
      });
      return;
    }
    const totalCash = payRows.filter((p) => p.type === 'cash').reduce((s, p) => s + p.amount, 0);
    const totalCredit = payRows
      .filter((p) => p.type === 'credit')
      .reduce((s, p) => s + p.amount, 0);
    const pt: 'cash' | 'credit' | 'partial' =
      totalCredit === 0 ? 'cash' : totalCash === 0 ? 'credit' : 'partial';
    const primarySafe = payRows.find((p) => p.type === 'cash')?.safe_id ?? null;
    checkoutMutation.mutate({
      payment_type: pt,
      total_amount: cartTotal,
      paid_amount: totalCash,
      customer_id: selectedCustomer?.id ?? null,
      customer_name: selectedCustomer?.name ?? null,
      safe_id: primarySafe,
      warehouse_id: effectiveWarehouseId ? parseInt(effectiveWarehouseId) : null,
      salesperson_id: salespersonId ? parseInt(salespersonId) : null,
      discount_percent: parseFloat(discountPct) || 0,
      discount_amount: discountAmount,
      notes: invoiceNote.trim() || undefined,
      items: cart,
      payments: payRows.map((r) => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })),
    });
  };

  // ── Keyboard shortcuts (F9 / Ctrl+S / Escape) ────────────────────────────
  const _checkoutRef = useRef(handleCheckout);
  _checkoutRef.current = handleCheckout;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        _checkoutRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        _checkoutRef.current();
        return;
      }
      if (e.key === 'Escape') {
        setSearch((prev) => {
          if (prev) {
            setTimeout(() => searchInputRef.current?.focus(), 0);
            return '';
          }
          return prev;
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {successInvoice && (
        <WhatsAppSuccessModal
          invoice={successInvoice}
          onClose={() => {
            setSuccessInvoice(null);
            onDone();
          }}
        />
      )}
      {showCreateProduct && (
        <ProductFormModal
          title="إضافة منتج جديد"
          onSave={handleCreateProduct}
          onClose={() => setShowCreateProduct(false)}
          isPending={createProductMutation.isPending}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-3" style={{ height: 'calc(100vh - 170px)' }}>
        {/* ═══ يسار — كتالوج المنتجات ═══ */}
        <SaleProductPicker
          search={search}
          setSearch={setSearch}
          searchInputRef={searchInputRef}
          handleSearchKeyDown={handleSearchKeyDown}
          barcodeMode={barcodeMode}
          setBarcodeMode={setBarcodeMode}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          filteredProducts={filteredProducts}
          recentlyAdded={recentlyAdded}
          onAddToCart={addToCart}
          onCreateProduct={() => setShowCreateProduct(true)}
        />

        {/* ═══ يمين — لوحة الفاتورة ═══ */}
        <div className="w-full lg:w-[420px] flex flex-col sale-cart-panel rounded-2xl overflow-hidden shrink-0">
          <SaleCartItems
            cart={cart}
            setCart={setCart}
            products={products}
            heldInvoices={heldInvoices}
            showHeld={showHeld}
            setShowHeld={setShowHeld}
            canEditPrice={canEditPrice}
            editingPrice={editingPrice}
            setEditingPrice={setEditingPrice}
            editingDisc={editingDisc}
            setEditingDisc={setEditingDisc}
            cartSubtotal={cartSubtotal}
            isRestricted={isRestricted}
            warehouseId={warehouseId}
            setWarehouseId={setWarehouseId}
            warehouses={warehouses}
            effectiveWarehouseName={effectiveWarehouseName}
            salespersonName={salespersonName}
            updateQty={updateQty}
            updatePrice={updatePrice}
            updateItemDisc={updateItemDisc}
            onClear={_handleNewSale}
            onHold={holdInvoice}
            onResume={resumeHold}
            onDeleteHold={deleteHold}
          />

          <SalePaymentSection
            cart={cart}
            customerSaleItems={customerSaleItems}
            customerId={customerId}
            setCustomerId={setCustomerId}
            selectedCustomer={selectedCustomer}
            showQuickCustomer={showQuickCustomer}
            setShowQuickCustomer={setShowQuickCustomer}
            quickCustName={quickCustName}
            setQuickCustName={setQuickCustName}
            quickCustPhone={quickCustPhone}
            setQuickCustPhone={setQuickCustPhone}
            quickCustLoading={quickCustLoading}
            createQuickCustomer={createQuickCustomer}
            invoiceNote={invoiceNote}
            setInvoiceNote={setInvoiceNote}
            discountPct={discountPct}
            setDiscountPct={setDiscountPct}
            discountMode={discountMode}
            setDiscountMode={setDiscountMode}
            discountAmount={discountAmount}
            cartSubtotal={cartSubtotal}
            cartTotal={cartTotal}
            safes={safes}
            payRows={payRows}
            setPayRows={setPayRows}
            payType={payType}
            setPayType={setPayType}
            paySafe={paySafe}
            setPaySafe={setPaySafe}
            payAmount={payAmount}
            setPayAmount={setPayAmount}
            payShake={payShake}
            payRowKey={payRowKey}
            payAmountRef={payAmountRef}
            isRestricted={isRestricted}
            payPaidSoFar={payPaidSoFar}
            payRemaining={payRemaining}
            payPct={payPct}
            payIsDone={payIsDone}
            payCreditWarn={payCreditWarn}
            canCheckout={canCheckout}
            checkoutError={checkoutError}
            checkoutMutationPending={checkoutMutation.isPending}
            confirmPayRow={confirmPayRow}
            fillPayRemaining={fillPayRemaining}
            handleCheckout={handleCheckout}
          />
        </div>
      </div>

      <style>{`
        @keyframes erp-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        .erp-shake { animation: erp-shake 0.35s ease; }
      `}</style>
    </>
  );
}
