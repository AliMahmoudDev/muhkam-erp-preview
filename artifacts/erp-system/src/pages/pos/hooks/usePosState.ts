import { useState, useEffect, useRef, useMemo } from 'react';
import { safeArray } from '@/lib/safe-data';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import type { CartItem, SuccessInvoice } from '../PosReceipt';
import type { PosProduct } from './usePosData';
import type { ReturnSale, ReturnItem, PosCustomer } from '../pos-types';

export function usePosState({
  products,
  customers,
}: {
  products: PosProduct[];
  customers: PosCustomer[];
}) {
  /* ── Cart / UI state ── */
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
  const [successInvoice, setSuccessInvoice] = useState<SuccessInvoice | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cashierMode, setCashierMode] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  /* ── Return mode state ── */
  const [returnMode, setReturnMode] = useState(false);
  const [returnInvoiceNo, setReturnInvoiceNo] = useState('');
  const [debouncedReturnSearch, setDebouncedReturnSearch] = useState('');
  const [returnSearchResults, setReturnSearchResults] = useState<ReturnSale[]>([]);
  const [returnSearchFetching, setReturnSearchFetching] = useState(false);
  const [returnFetching, setReturnFetching] = useState(false);
  const [returnSale, setReturnSale] = useState<ReturnSale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnRefundType, setReturnRefundType] = useState<'cash' | 'credit'>('cash');
  const [returnReason, setReturnReason] = useState('');

  /* ── Refs ── */
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Auto-focus on mount ── */
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  /* ── Return: debounce search input (350ms) ── */
  useEffect(() => {
    if (!returnMode) return;
    const t = setTimeout(() => setDebouncedReturnSearch(returnInvoiceNo.trim()), 350);
    return () => clearTimeout(t);
  }, [returnInvoiceNo, returnMode]);

  /* ── Return: fetch search results when debounced term changes ── */
  useEffect(() => {
    if (!returnMode) return;
    if (!debouncedReturnSearch) {
      setReturnSearchResults([]);
      return;
    }
    setReturnSearchFetching(true);
    const url = debouncedReturnSearch
      ? `/api/sales?sort=desc&limit=100&q=${encodeURIComponent(debouncedReturnSearch)}`
      : `/api/sales?sort=desc&limit=40`;
    authFetch(api(url))
      .then((r) => r.json())
      .then((data) => {
        const list: ReturnSale[] = safeArray(
          Array.isArray(data) ? data : ((data as { data?: ReturnSale[] }).data ?? [])
        );
        setReturnSearchResults(list.filter((s) => s.status !== 'cancelled'));
      })
      .catch(() => setReturnSearchResults([]))
      .finally(() => setReturnSearchFetching(false));
  }, [debouncedReturnSearch, returnMode]);

  /* ── Computed: filtered products ── */
  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
        );
      }),
    [products, search]
  );

  /* ── Computed: cart totals ── */
  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.total_price, 0), [cart]);
  const discountAmt = useMemo(
    () => (cartSubtotal * (parseFloat(discountPct) || 0)) / 100,
    [cartSubtotal, discountPct]
  );
  const cartTotal = useMemo(() => cartSubtotal - discountAmt, [cartSubtotal, discountAmt]);

  /* ── Computed: customer select items ── */
  const customerItems = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: `${c.customer_code ? `[${c.customer_code}] ` : ''}${c.name}${Number(c.balance) > 0 ? ` (دين: ${Number(c.balance).toFixed(0)} ج.م)` : ''}`,
        searchKeys: [String(c.customer_code ?? ''), c.name],
      })),
    [customers]
  );

  const selectedCustomer = customers.find((c) => c.id === parseInt(customerId));

  return {
    search, setSearch,
    cart, setCart,
    customerId, setCustomerId,
    discountPct, setDiscountPct,
    showSplitPayment, setShowSplitPayment,
    editingPriceId, setEditingPriceId,
    editingPriceVal, setEditingPriceVal,
    successInvoice, setSuccessInvoice,
    recentlyAdded, setRecentlyAdded,
    checkoutError, setCheckoutError,
    cashierMode, setCashierMode,
    showExitConfirm, setShowExitConfirm,
    returnMode, setReturnMode,
    returnInvoiceNo, setReturnInvoiceNo,
    returnSearchResults, setReturnSearchResults,
    returnSearchFetching,
    returnFetching, setReturnFetching,
    returnSale, setReturnSale,
    returnItems, setReturnItems,
    returnRefundType, setReturnRefundType,
    returnReason, setReturnReason,
    searchRef,
    filtered,
    cartSubtotal,
    discountAmt,
    cartTotal,
    customerItems,
    selectedCustomer,
  };
}
