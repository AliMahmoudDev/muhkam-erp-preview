import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { CartItem, SuccessInvoice } from '../PosReceipt';
import type { ReturnSale, ReturnSaleItem, ReturnItem, PosUser } from '../pos-types';
import type { PosProduct } from './usePosData';
import type { SplitPaymentEntry } from '@/components/SplitPaymentModal';

type PosData = {
  products: PosProduct[];
  safes: { id: number; name: string }[];
  warehouses: { id: number; name: string }[];
  warehouseName: string;
  safeName: string;
};

type PosState = {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  customerId: string;
  discountPct: string;
  discountAmt: number;
  cartTotal: number;
  selectedCustomer: { id: number; name: string; phone?: string | null } | undefined;
  returnSale: ReturnSale | null;
  returnItems: ReturnItem[];
  returnReason: string;
  returnRefundType: 'cash' | 'credit';
  search: string;
  filtered: PosProduct[];
  successInvoice: SuccessInvoice | null;
  returnMode: boolean;
  showExitConfirm: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  setRecentlyAdded: React.Dispatch<React.SetStateAction<number | null>>;
  setReturnMode: React.Dispatch<React.SetStateAction<boolean>>;
  setReturnSale: React.Dispatch<React.SetStateAction<ReturnSale | null>>;
  setReturnItems: React.Dispatch<React.SetStateAction<ReturnItem[]>>;
  setReturnInvoiceNo: React.Dispatch<React.SetStateAction<string>>;
  setReturnReason: React.Dispatch<React.SetStateAction<string>>;
  setReturnSearchResults: React.Dispatch<React.SetStateAction<ReturnSale[]>>;
  setReturnFetching: React.Dispatch<React.SetStateAction<boolean>>;
  setCheckoutError: React.Dispatch<React.SetStateAction<string | null>>;
  setShowSplitPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setSuccessInvoice: React.Dispatch<React.SetStateAction<SuccessInvoice | null>>;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setShowExitConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  setCustomerId: React.Dispatch<React.SetStateAction<string>>;
  setDiscountPct: React.Dispatch<React.SetStateAction<string>>;
};

export function usePosActions({
  data,
  state,
  user,
  warehouseId,
  safeId,
}: {
  data: PosData;
  state: PosState;
  user: PosUser | null;
  warehouseId: number;
  safeId: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const checkoutRef = useRef<() => void>(() => {});

  /* ── Add to cart ── */
  const addToCart = useCallback(
    (product: PosProduct) => {
      if (Number(product.quantity) <= 0) {
        toast({ title: `⚠ "${product.name}" نفد من المخزون`, variant: 'destructive' });
        return;
      }
      state.setCart((prev) => {
        const ex = prev.find((i) => i.product_id === product.id);
        if (ex) {
          if (ex.quantity >= Number(product.quantity)) {
            toast({
              title: `⚠ الكمية المتاحة: ${Number(product.quantity)}`,
              variant: 'destructive',
            });
            return prev;
          }
          return prev.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price }
              : i
          );
        }
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.sale_price,
            total_price: product.sale_price,
            stock: Number(product.quantity),
          },
        ];
      });
      state.setRecentlyAdded(product.id);
      setTimeout(() => state.setRecentlyAdded(null), 500);
    },
    [data.products, toast, state]
  );

  /* ── Update quantity ── */
  const updateQty = (pid: number, delta: number) => {
    state.setCart((prev) =>
      prev.map((i) => {
        if (i.product_id !== pid) return i;
        const newQ = Math.max(1, i.quantity + delta);
        if (newQ > i.stock) {
          toast({ title: `⚠ الكمية المتاحة: ${i.stock}`, variant: 'destructive' });
          return i;
        }
        return { ...i, quantity: newQ, total_price: newQ * i.unit_price };
      })
    );
  };

  /* ── Remove item ── */
  const removeItem = (pid: number) =>
    state.setCart((prev) => prev.filter((i) => i.product_id !== pid));

  /* ── Commit price edit ── */
  const commitPrice = (pid: number, val: string) => {
    const newPrice = parseFloat(val);
    if (isNaN(newPrice) || newPrice < 0) return;
    const prod = data.products.find((p) => p.id === pid);
    const cost = prod ? Number(prod.cost_price) : 0;
    if (cost > 0 && newPrice < cost - 0.001) {
      toast({
        title: `⚠ السعر أقل من التكلفة (${cost.toFixed(2)})`,
        variant: 'destructive',
      });
    }
    state.setCart((prev) =>
      prev.map((i) =>
        i.product_id !== pid
          ? i
          : { ...i, unit_price: newPrice, total_price: newPrice * i.quantity }
      )
    );
  };

  /* ── Toggle return mode ── */
  const toggleReturnMode = useCallback(() => {
    state.setReturnMode((v) => !v);
    state.setReturnSale(null);
    state.setReturnItems([]);
    state.setReturnInvoiceNo('');
  }, [state]);

  /* ── Checkout mutation ── */
  const checkoutMutation = useMutation({
    mutationFn: (payload: object) =>
      authFetch(api('/api/sales'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': `pos-${Date.now()}-${Math.random()}`,
        },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'خطأ');
        return j;
      }),
    onSuccess: (resData) => {
      qc.invalidateQueries({ queryKey: ['/api/sales'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      qc.invalidateQueries({ queryKey: ['/api/customers'] });
      qc.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      state.setCheckoutError(null);
      state.setShowSplitPayment(false);
      state.setSuccessInvoice({
        invoice_no: resData.invoice_no,
        total_amount: resData.total_amount,
        customer_name: state.selectedCustomer?.name ?? null,
        customer_phone: state.selectedCustomer?.phone ?? null,
        payment_type: resData.payment_type ?? 'cash',
        items: [...state.cart],
        warehouseName: data.warehouses.find((w) => w.id === warehouseId)?.name,
        safeName: data.safes.find((s) => s.id === safeId)?.name,
        cashierName: user?.name ?? user?.username ?? undefined,
      });
      state.setCart([]);
      state.setCustomerId('');
      state.setDiscountPct('');
      setTimeout(() => state.searchRef.current?.focus(), 100);
    },
    onError: (e: Error) => {
      state.setCheckoutError(e.message);
      toast({ title: '❌ فشل التسجيل', description: e.message, variant: 'destructive' });
    },
  });

  /* ── Return mutation ── */
  const returnMutation = useMutation({
    mutationFn: (body: object) =>
      authFetch(api('/api/sales-returns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'خطأ');
        return j;
      }),
    onSuccess: () => {
      toast({ title: '✅ تم تسجيل المرتجع بنجاح' });
      qc.invalidateQueries({ queryKey: ['/api/sales'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      state.setReturnMode(false);
      state.setReturnSale(null);
      state.setReturnItems([]);
      state.setReturnInvoiceNo('');
      state.setReturnReason('');
    },
    onError: (e: Error) => {
      toast({ title: '❌ فشل المرتجع', description: e.message, variant: 'destructive' });
    },
  });

  /* ── Select return invoice ── */
  const selectReturnInvoice = useCallback(
    async (saleId: number) => {
      state.setReturnFetching(true);
      state.setReturnSale(null);
      state.setReturnItems([]);
      state.setReturnSearchResults([]);
      try {
        const r = await authFetch(api(`/api/sales/${saleId}`));
        const full: ReturnSale = await r.json();
        if (!r.ok) throw new Error('خطأ في تحميل الفاتورة');
        state.setReturnSale(full);
        state.setReturnInvoiceNo(full.invoice_no);
        state.setReturnItems(
          full.items.map((it: ReturnSaleItem, idx: number) => ({
            id: idx,
            product_id: it.product_id,
            product_name: it.product_name,
            max_qty: it.quantity,
            return_qty: it.quantity,
            unit_price: it.unit_price,
          }))
        );
      } catch (e: unknown) {
        toast({ title: '❌ ' + (e instanceof Error ? e.message : 'خطأ'), variant: 'destructive' });
      } finally {
        state.setReturnFetching(false);
      }
    },
    [toast, state]
  );

  /* ── Handle return submit ── */
  const handleReturn = useCallback(() => {
    if (!state.returnSale) return;
    const activeItems = state.returnItems.filter((i) => i.return_qty > 0);
    if (activeItems.length === 0) {
      toast({ title: 'اختر صنفاً واحداً على الأقل', variant: 'destructive' });
      return;
    }
    const total = activeItems.reduce((s, i) => s + i.return_qty * i.unit_price, 0);
    returnMutation.mutate({
      sale_id: state.returnSale.id,
      customer_id: state.returnSale.customer_id,
      customer_name: state.returnSale.customer_name,
      items: activeItems.map((i) => ({
        original_sale_item_id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.return_qty,
        unit_price: i.unit_price,
        total_price: i.return_qty * i.unit_price,
      })),
      reason: state.returnReason,
      notes: '',
      date: new Date().toISOString().split('T')[0],
      refund_type: state.returnRefundType,
      safe_id: safeId,
      total_amount: total,
    });
  }, [state, safeId, returnMutation, toast]);

  /* ── Handle checkout (opens split payment modal) ── */
  const handleCheckout = useCallback(() => {
    if (state.cart.length === 0) {
      toast({ title: 'السلة فارغة', variant: 'destructive' });
      return;
    }
    state.setShowSplitPayment(true);
  }, [state, toast]);

  /* ── Handle split payment confirm ── */
  const handleSplitConfirm = useCallback(
    (payments: SplitPaymentEntry[]) => {
      const immediatePaid = payments
        .filter((p) => p.type !== 'credit')
        .reduce((s, p) => s + p.amount, 0);
      const totalCredit = payments
        .filter((p) => p.type === 'credit')
        .reduce((s, p) => s + p.amount, 0);
      const pt: 'cash' | 'credit' | 'partial' =
        totalCredit === 0 ? 'cash' : immediatePaid === 0 ? 'credit' : 'partial';
      const primarySafe =
        payments.find((p) => p.type === 'cash')?.safe_id ??
        payments.find((p) => p.safe_id)?.safe_id ??
        safeId;

      checkoutMutation.mutate({
        payment_type: pt,
        total_amount: state.cartTotal,
        paid_amount: immediatePaid,
        customer_id: state.selectedCustomer?.id ?? null,
        customer_name: state.selectedCustomer?.name ?? null,
        safe_id: primarySafe,
        warehouse_id: warehouseId,
        salesperson_id: user?.id ?? null,
        discount_percent: parseFloat(state.discountPct) || 0,
        discount_amount: state.discountAmt,
        items: state.cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
        })),
        payments,
      });
    },
    [state, safeId, warehouseId, user, checkoutMutation]
  );

  /* keep ref current for keyboard shortcut */
  checkoutRef.current = handleCheckout;

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        checkoutRef.current();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        state.searchRef.current?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
        e.preventDefault();
        state.setCart([]);
        return;
      }
      if (e.key === 'Escape') {
        if (state.successInvoice) { state.setSuccessInvoice(null); return; }
        if (state.showExitConfirm) { state.setShowExitConfirm(false); return; }
        if (state.returnMode) {
          state.setReturnMode(false);
          state.setReturnSale(null);
          state.setReturnItems([]);
          state.setReturnInvoiceNo('');
          return;
        }
        if (state.cart.length > 0) { state.setShowExitConfirm(true); return; }
        navigate('/sales');
        return;
      }
      if (e.key === 'Enter' && document.activeElement === state.searchRef.current) {
        e.preventDefault();
        const trimmed = state.search.trim();
        if (trimmed && state.filtered.length > 0) {
          const barcodeMatch = data.products.find(
            (p) => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
          );
          const target = barcodeMatch ?? state.filtered[0];
          addToCart(target);
          if (barcodeMatch) state.setSearch('');
        }
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    state.filtered,
    addToCart,
    data.products,
    state.search,
    state.successInvoice,
    state.returnMode,
    state.cart,
    state.showExitConfirm,
    navigate,
    state,
  ]);

  return {
    addToCart,
    updateQty,
    removeItem,
    commitPrice,
    toggleReturnMode,
    handleCheckout,
    handleSplitConfirm,
    handleReturn,
    selectReturnInvoice,
    checkoutMutation,
    returnMutation,
  };
}
