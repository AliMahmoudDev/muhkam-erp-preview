import { getTenantScopedStorageKey } from '@/lib/tenant-storage';
/**
 * hooks/useNewSaleForm.ts
 * All form state, cart management, payment logic, and derived
 * calculations for the new-sale POS panel.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { CartItem, HeldInvoice, PayRow, SuccessInvoice } from '../salesTypes';
import { ProductFormData } from '@/components/product-form-modal';

interface SaleProduct {
  id: number;
  name: string;
  sale_price: number;
  cost_price: unknown;
  quantity: number;
  sku?: string | null;
  category?: string | null;
  category_name?: string | null;
}

interface SaleCustomer {
  id: number;
  name: string;
  phone?: string | null;
  balance?: unknown;
  customer_code?: string | null;
  is_customer?: boolean;
}

interface SaleSafe {
  id: number;
  name: string;
}

interface SaleWarehouse {
  id: number;
  name: string;
}

interface SaleUser {
  id: number;
  name?: string;
  role?: string;
  warehouse_id?: number | null;
  safe_id?: number | null;
}

interface CreateProductMutation {
  mutate: (
    vars: { data: ProductFormData },
    options: { onSuccess: (p: unknown) => void; onError: () => void }
  ) => void;
  isPending: boolean;
}

interface UseNewSaleFormParams {
  products: SaleProduct[];
  customers: SaleCustomer[];
  safes: SaleSafe[];
  warehouses: SaleWarehouse[];
  currentUser: SaleUser | null;
  createProductMutation: CreateProductMutation;
}

export function useNewSaleForm({
  products,
  customers,
  safes,
  warehouses,
  currentUser,
  createProductMutation,
}: UseNewSaleFormParams) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Core form state ──────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [invoiceNote, setInvoiceNote] = useState('');
  const [discountMode, setDiscountMode] = useState<'pct' | 'amt'>('pct');
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [editingDisc, setEditingDisc] = useState<{
    pid: number;
    val: string;
    mode: 'pct' | 'amt';
  } | null>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustLoading, setQuickCustLoading] = useState(false);
  const heldInvoicesStorageKey = getTenantScopedStorageKey('muhkam_held_invoices');
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(heldInvoicesStorageKey) || '[]');
    } catch {
      return [];
    }
  });
  const [showHeld, setShowHeld] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [discountPct, setDiscountPct] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [payRows, setPayRows] = useState<PayRow[]>([]);
  const [payType, setPayType] = useState<'cash' | 'credit'>('cash');
  const [paySafe, setPaySafe] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payShake, setPayShake] = useState(false);
  const [payRowKey, setPayRowKey] = useState(0);
  const [recentlyAdded, setRecentlyAdded] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ pid: number; val: string } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [successInvoice, setSuccessInvoice] = useState<SuccessInvoice | null>(null);
  const [showCreateProduct, setShowCreateProduct] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const searchInputRef = useRef<HTMLInputElement>(null);
  const payAmountRef = useRef<HTMLInputElement>(null);
  const barcodeModeRef = useRef(barcodeMode);
  barcodeModeRef.current = barcodeMode;

  // ── Role/permission derived values ───────────────────────────────────────
  const isRestricted = currentUser?.role === 'cashier' || currentUser?.role === 'salesperson';

  const effectiveWarehouseId = isRestricted
    ? currentUser?.warehouse_id
      ? String(currentUser.warehouse_id)
      : ''
    : warehouseId;

  const effectiveSafeId = isRestricted ? (currentUser?.safe_id ?? null) : null;

  const effectiveWarehouseName =
    warehouses.find((w) => String(w.id) === effectiveWarehouseId)?.name ?? '—';

  const salespersonId = currentUser ? String(currentUser.id) : '';
  const salespersonName = currentUser?.name ?? '—';

  // ── Calculations ─────────────────────────────────────────────────────────
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchCat =
      !categoryFilter || p.category_name === categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.total_price, 0), [cart]);
  const discountAmount = useMemo(() => {
    const v = parseFloat(discountPct) || 0;
    return discountMode === 'pct' ? (cartSubtotal * v) / 100 : Math.min(v, cartSubtotal);
  }, [cartSubtotal, discountPct, discountMode]);
  const cartTotal = useMemo(() => cartSubtotal - discountAmount, [cartSubtotal, discountAmount]);

  const selectedCustomer = customers.find((c) => c.id === parseInt(customerId));

  const customerSaleItems = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: `${c.customer_code ? `[${c.customer_code}] ` : ''}${c.name}${Number(c.balance) > 0 ? ` (دين: ${Number(c.balance).toFixed(0)} ج.م)` : ''}`,
        searchKeys: [String(c.customer_code ?? ''), c.name],
      })),
    [customers]
  );

  const payPaidSoFar = payRows.reduce((s, r) => s + r.amount, 0);
  const payRemaining = Math.round((cartTotal - payPaidSoFar) * 100) / 100;
  const payPct = Math.min(100, cartTotal > 0 ? (payPaidSoFar / cartTotal) * 100 : 0);
  const payIsDone = Math.abs(payRemaining) < 0.05 && payRows.length > 0;
  const payCreditWarn = payRows.some((r) => r.type === 'credit') && !customerId;

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRestricted && warehouses.length > 0 && !warehouseId) {
      setWarehouseId(String(warehouses[0].id));
    }
  }, [warehouses, warehouseId, isRestricted]);

  useEffect(() => {
    const firstSafeId = effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null);
    setPaySafe(firstSafeId);
  }, [safes.length, effectiveSafeId]);

  useEffect(() => {
    if (payRows.length > 0) {
      setPayRows([]);
      setPayAmount('');
    }
  }, [cartTotal]);

  useEffect(() => {
    if (payRowKey > 0) setTimeout(() => payAmountRef.current?.focus(), 60);
  }, [payRowKey]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Barcode-mode: redirect any keypress to the search input
  useEffect(() => {
    const bc = (e: KeyboardEvent) => {
      if (!barcodeModeRef.current) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', bc);
    return () => document.removeEventListener('keydown', bc);
  }, []);

  // ── Cart helpers ─────────────────────────────────────────────────────────
  const calcLineTotal = (
    unit_price: number,
    quantity: number,
    item_disc = 0,
    item_disc_mode: 'pct' | 'amt' = 'pct'
  ) => {
    const discAmt = item_disc_mode === 'pct' ? (unit_price * item_disc) / 100 : item_disc;
    return Math.max(0, unit_price - discAmt) * quantity;
  };

  const updateItemDisc = (pid: number, val: string, mode: 'pct' | 'amt') => {
    const disc = Math.max(0, parseFloat(val) || 0);
    setCart((prev) =>
      prev.map((i) =>
        i.product_id !== pid
          ? i
          : {
              ...i,
              item_disc: disc,
              item_disc_mode: mode,
              total_price: calcLineTotal(i.unit_price, i.quantity, disc, mode),
            }
      )
    );
  };

  const updatePrice = useCallback(
    (pid: number, rawVal: string) => {
      const newPrice = parseFloat(rawVal);
      if (isNaN(newPrice) || newPrice < 0) return;
      const prod = products.find((p) => p.id === pid);
      const costPrice = prod ? Number(prod.cost_price) : 0;
      if (costPrice > 0 && newPrice < costPrice - 0.001) {
        toast({
          title: `⚠ السعر (${formatCurrency(newPrice)}) أقل من تكلفة الشراء (${formatCurrency(costPrice)})`,
          variant: 'destructive',
        });
        return;
      }
      setCart((prev) =>
        prev.map((i) =>
          i.product_id !== pid
            ? i
            : {
                ...i,
                unit_price: newPrice,
                total_price: calcLineTotal(newPrice, i.quantity, i.item_disc, i.item_disc_mode),
              }
        )
      );
    },
    [products, toast]
  );

  const addToCart = (product: SaleProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing)
        return prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                total_price: calcLineTotal(
                  i.unit_price,
                  i.quantity + 1,
                  i.item_disc,
                  i.item_disc_mode
                ),
              }
            : i
        );
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.sale_price,
          total_price: product.sale_price,
        },
      ];
    });
    setRecentlyAdded(product.id);
    setTimeout(() => setRecentlyAdded(null), 520);
  };

  const updateQty = (pid: number, delta: number) =>
    setCart((prev) =>
      prev.map((i) => {
        if (i.product_id !== pid) return i;
        const newQ = Math.max(1, i.quantity + delta);
        return {
          ...i,
          quantity: newQ,
          total_price: calcLineTotal(i.unit_price, newQ, i.item_disc, i.item_disc_mode),
        };
      })
    );

  const handleCreateProduct = (data: ProductFormData) => {
    createProductMutation.mutate(
      { data },
      {
        onSuccess: (newProduct: unknown) => {
          toast({ title: '✅ تم إضافة المنتج وإضافته للفاتورة' });
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          setShowCreateProduct(false);
          setSearch('');
          const created = newProduct as {
            id?: number;
            sale_price?: unknown;
            cost_price?: unknown;
            quantity?: unknown;
          } | null;
          if (created?.id) {
            addToCart({
              ...created,
              id: created.id,
              name: (created as { name?: string }).name ?? '',
              sale_price: Number(created.sale_price),
              cost_price: Number(created.cost_price),
              quantity: Number(created.quantity),
            });
          }
        },
        onError: () => toast({ title: 'حدث خطأ أثناء إضافة المنتج', variant: 'destructive' }),
      }
    );
  };

  // ── Hold / resume / delete invoice ───────────────────────────────────────
  const _handleNewSale = () => {
    setCart([]);
    setCustomerId('');
    setSearch('');
    setDiscountPct('');
    setInvoiceNote('');
    setDiscountMode('pct');
    setPayRows([]);
    setPayAmount('');
    setPayRowKey((k) => k + 1);
    setEditingDisc(null);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const holdInvoice = () => {
    if (cart.length === 0) return;
    const custName = customers.find((c) => c.id === parseInt(customerId))?.name ?? 'بدون عميل';
    const held: HeldInvoice = {
      id: Date.now().toString(),
      ts: Date.now(),
      cart,
      customerId,
      discountPct,
      discountMode,
      invoiceNote,
      label: custName,
    };
    const updated = [held, ...heldInvoices];
    setHeldInvoices(updated);
    localStorage.setItem(heldInvoicesStorageKey, JSON.stringify(updated));
    _handleNewSale();
    toast({ title: `✅ تم إيداع الفاتورة — ${custName}` });
  };

  const resumeHold = (id: string) => {
    const held = heldInvoices.find((h) => h.id === id);
    if (!held) return;
    setCart(held.cart);
    setCustomerId(held.customerId);
    setDiscountPct(held.discountPct);
    setDiscountMode(held.discountMode);
    setInvoiceNote(held.invoiceNote);
    const updated = heldInvoices.filter((h) => h.id !== id);
    setHeldInvoices(updated);
    localStorage.setItem(heldInvoicesStorageKey, JSON.stringify(updated));
    setShowHeld(false);
  };

  const deleteHold = (id: string) => {
    const updated = heldInvoices.filter((h) => h.id !== id);
    setHeldInvoices(updated);
    localStorage.setItem(heldInvoicesStorageKey, JSON.stringify(updated));
  };

  // ── Payment helpers ──────────────────────────────────────────────────────
  const triggerPayShake = () => {
    setPayShake(true);
    setTimeout(() => setPayShake(false), 400);
  };

  const confirmPayRow = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || amt > payRemaining + 0.05) {
      triggerPayShake();
      return;
    }
    const firstSafeId = effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null);
    setPayRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: payType,
        safe_id: payType === 'cash' ? (paySafe ?? firstSafeId) : null,
        amount: Math.min(amt, payRemaining),
      },
    ]);
    setPayAmount('');
    setPaySafe(effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null));
    setPayType('cash');
    setPayRowKey((k) => k + 1);
  };

  const fillPayRemaining = () => {
    if (payRemaining <= 0) return;
    const firstSafeId = effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null);
    setPayRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: payType,
        safe_id: payType === 'cash' ? (paySafe ?? firstSafeId) : null,
        amount: payRemaining,
      },
    ]);
    setPayAmount('');
    setPaySafe(effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null));
    setPayType('cash');
  };

  // ── Quick customer creation ──────────────────────────────────────────────
  const createQuickCustomer = async () => {
    if (!quickCustName.trim()) {
      toast({ title: 'اسم العميل مطلوب', variant: 'destructive' });
      return;
    }
    setQuickCustLoading(true);
    try {
      const res = await authFetch(api('/api/customers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickCustName.trim(),
          phone: quickCustPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل الإضافة');
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setCustomerId(String(data.id ?? data.customer?.id ?? ''));
      setShowQuickCustomer(false);
      setQuickCustName('');
      setQuickCustPhone('');
      toast({ title: `✅ تم إضافة العميل "${quickCustName.trim()}"` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'حدث خطأ';
      toast({ title: `❌ ${msg}`, variant: 'destructive' });
    } finally {
      setQuickCustLoading(false);
    }
  };

  // ── Search keyboard handler ──────────────────────────────────────────────
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const available = filteredProducts.filter((p) => Number(p.quantity) > 0);
    if (available.length > 0) {
      addToCart(available[0]);
      setSearch('');
      toast({ title: `✅ تمت إضافة "${available[0].name}" للسلة` });
    } else {
      toast({
        title:
          filteredProducts.length === 0 ? 'لا توجد منتجات مطابقة للبحث' : 'المنتج نفد من المخزون',
        variant: 'destructive',
      });
    }
  };

  return {
    // State
    search,
    setSearch,
    cart,
    setCart,
    customerId,
    setCustomerId,
    invoiceNote,
    setInvoiceNote,
    discountMode,
    setDiscountMode,
    barcodeMode,
    setBarcodeMode,
    editingDisc,
    setEditingDisc,
    showQuickCustomer,
    setShowQuickCustomer,
    quickCustName,
    setQuickCustName,
    quickCustPhone,
    setQuickCustPhone,
    quickCustLoading,
    heldInvoices,
    showHeld,
    setShowHeld,
    warehouseId,
    setWarehouseId,
    discountPct,
    setDiscountPct,
    categoryFilter,
    setCategoryFilter,
    payRows,
    setPayRows,
    payType,
    setPayType,
    paySafe,
    setPaySafe,
    payAmount,
    setPayAmount,
    payShake,
    payRowKey,
    setPayRowKey,
    recentlyAdded,
    editingPrice,
    setEditingPrice,
    checkoutError,
    setCheckoutError,
    successInvoice,
    setSuccessInvoice,
    showCreateProduct,
    setShowCreateProduct,
    // Refs
    searchInputRef,
    payAmountRef,
    // Derived
    isRestricted,
    effectiveWarehouseId,
    effectiveSafeId,
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
    // Handlers
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
  };
}
