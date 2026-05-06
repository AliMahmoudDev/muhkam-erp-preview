import { api } from '@/lib/api';
// ✔ POS UX CLEANED — SINGLE ENTRY POINT
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { safeArray } from '@/lib/safe-data';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { authFetch } from '@/lib/auth-fetch';
import { useGetCustomers, useGetSettingsSafes } from '@workspace/api-client-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/format';
import { SearchableSelect } from '@/components/searchable-select';
import { SplitPaymentModal, type SplitPaymentEntry } from '@/components/SplitPaymentModal';
import {
  Search,
  AlertTriangle,
  Zap,
  X,
  Store,
  Vault,
  RotateCcw,
  RefreshCw,
  Settings,
} from 'lucide-react';
import {
  type CartItem,
  type SuccessInvoice,
  SuccessModal,
} from './PosReceipt';
import { PosCart } from './PosCart';
import { PosPayment } from './PosPayment';

/* ─────────────────────────────────────────────────────────────
   RETURN-ONLY TYPES (cart/invoice types live in PosReceipt)
───────────────────────────────────────────────────────────── */
interface ReturnSaleItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ReturnSale {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer_name: string | null;
  total_amount: number;
  payment_type: string;
  date: string | null;
  status: string;
  items: ReturnSaleItem[];
}

interface ReturnItem {
  id: number;
  product_id: number;
  product_name: string;
  max_qty: number;
  return_qty: number;
  unit_price: number;
}

/* ─────────────────────────────────────────────────────────────
   ADMIN POS SETUP — اختيار الفرع والخزينة للمدير
───────────────────────────────────────────────────────────── */
function AdminPOSSetup({ onStart }: { onStart: (w: number, s: number) => void }) {
  const { data: warehousesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () =>
      authFetch(api('/api/settings/warehouses')).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        return safeArray(j);
      }),
  });
  const warehouses = safeArray(warehousesRaw);
  const { data: rawSafesData } = useGetSettingsSafes();
  const rawSafes = safeArray(rawSafesData);
  const safes = rawSafes as { id: number; name: string }[];

  const [wId, setWId] = useState<string>(() => localStorage.getItem('pos:lastWarehouse') ?? '');
  const [sId, setSId] = useState<string>(() => localStorage.getItem('pos:lastSafe') ?? '');

  const warehouseItems = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name, searchKeys: [w.name] })),
    [warehouses]
  );
  const safeItems = useMemo(
    () => safes.map((s) => ({ value: String(s.id), label: s.name, searchKeys: [s.name] })),
    [safes]
  );

  const ready = !!wId && !!sId;

  function handleStart() {
    if (!ready) return;
    localStorage.setItem('pos:lastWarehouse', wId);
    localStorage.setItem('pos:lastSafe', sId);
    onStart(Number(wId), Number(sId));
  }

  return (
    <div className="erp-page fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="erp-panel w-full max-w-md p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="erp-title text-xl">اختيار الفرع والخزينة</h2>
          <p className="erp-text-muted">وضع المدير — يُختار يدوياً ولا يُحفظ في الملف الشخصي</p>
        </div>

        {/* Warehouse */}
        <div className="space-y-1.5">
          <label className="erp-label flex items-center gap-1.5">
            <Vault className="w-3.5 h-3.5" />
            الفرع / المخزن
          </label>
          <SearchableSelect
            items={warehouseItems}
            value={wId}
            onChange={setWId}
            placeholder="ابحث باسم الفرع..."
            emptyLabel="— اختر الفرع —"
            clearable={false}
          />
        </div>

        {/* Safe */}
        <div className="space-y-1.5">
          <label className="erp-label flex items-center gap-1.5">
            <Vault className="w-3.5 h-3.5" />
            الخزينة
          </label>
          <SearchableSelect
            items={safeItems}
            value={sId}
            onChange={setSId}
            placeholder="ابحث باسم الخزينة..."
            emptyLabel="— اختر الخزينة —"
            clearable={false}
          />
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className={`w-full h-11 text-base ${ready ? 'erp-btn-primary' : 'erp-btn-disabled'}`}
        >
          <Zap className="w-4 h-4" />
          بدء البيع
        </button>

        {ready && (
          <p className="text-center erp-text-muted">
            {warehouseItems.find((w) => w.value === wId)?.label} ·{' '}
            {safeItems.find((s) => s.value === sId)?.label}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN POS PAGE
───────────────────────────────────────────────────────────── */
export default function POSPage() {
  const { user } = useAuth();
  /* ── Permissions ── */
  const canEditPrice = hasPermission(user, 'can_edit_price') === true;
  const canCash = hasPermission(user, 'can_cash_sale') === true;
  const canCredit = hasPermission(user, 'can_credit_sale') === true;
  const canReturnSale = hasPermission(user, 'can_return_sale') === true;

  /* ── Role detection ── */
  const isAdmin = user?.role === 'admin';

  /* ── User-bound IDs (never from body for cashier) ── */
  const profileWarehouse = user?.warehouse_id ?? null;
  const profileSafe = user?.safe_id ?? null;

  /* ── Admin manual selection (session-only, not saved to DB) ── */
  const [adminSetup, setAdminSetup] = useState<{
    warehouseId: number | null;
    safeId: number | null;
  }>({
    warehouseId: null,
    safeId: null,
  });

  /* ── Resolve final IDs ── */
  const warehouseId = profileWarehouse ?? adminSetup.warehouseId;
  const safeId = profileSafe ?? adminSetup.safeId;

  /* ── Block: non-admin without warehouse/safe ── */
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

    /* ── Admin: show branch/safe picker ── */
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
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  /* ── Data ── */
  const { data: products = [] } = useQuery<
    {
      id: number;
      name: string;
      sku: string | null;
      quantity: number;
      sale_price: number;
      cost_price: number;
      barcode?: string | null;
    }[]
  >({
    queryKey: ['/api/products'],
    queryFn: () =>
      authFetch(api('/api/products')).then(async (r) => {
        if (!r.ok) throw new Error(`API Error: ${r.status}`);
        return r.json();
      }),
    staleTime: 60_000,
  });
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw);
  const { data: safesBodyRaw } = useGetSettingsSafes();
  const safes = safeArray(safesBodyRaw);
  const { data: warehousesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () =>
      authFetch(api('/api/settings/warehouses')).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        return safeArray(j);
      }),
    staleTime: 5 * 60_000,
  });
  const warehouses = safeArray(warehousesRaw);

  /* ── Display names ── */
  const warehouseName = warehouses.find((w) => w.id === warehouseId)?.name ?? `فرع ${warehouseId}`;
  const safeName = safes.find((s) => s.id === safeId)?.name ?? `خزينة ${safeId}`;

  /* ── State ── */
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

  /* ── Return mode ── */
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  /* ── Refs ── */
  const searchRef = useRef<HTMLInputElement>(null);
  const checkoutRef = useRef<() => void>(() => {});

  /* ── Auto-focus on mount ── */
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  /* ── Filtered products ── */
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

  /* ── Cart calculations ── */
  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.total_price, 0), [cart]);
  const discountAmt = useMemo(
    () => (cartSubtotal * (parseFloat(discountPct) || 0)) / 100,
    [cartSubtotal, discountPct]
  );
  const cartTotal = useMemo(() => cartSubtotal - discountAmt, [cartSubtotal, discountAmt]);

  /* ── Customer list for select ── */
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

  /* ── Add to cart ── */
  const addToCart = useCallback(
    (product: (typeof products)[0]) => {
      if (Number(product.quantity) <= 0) {
        toast({ title: `⚠ "${product.name}" نفد من المخزون`, variant: 'destructive' });
        return;
      }
      setCart((prev) => {
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
      setRecentlyAdded(product.id);
      setTimeout(() => setRecentlyAdded(null), 500);
    },
    [products, toast]
  );

  /* ── Update quantity ── */
  const updateQty = (pid: number, delta: number) => {
    setCart((prev) => {
      return prev.map((i) => {
        if (i.product_id !== pid) return i;
        const newQ = Math.max(1, i.quantity + delta);
        if (newQ > i.stock) {
          toast({ title: `⚠ الكمية المتاحة: ${i.stock}`, variant: 'destructive' });
          return i;
        }
        return { ...i, quantity: newQ, total_price: newQ * i.unit_price };
      });
    });
  };

  const removeItem = (pid: number) => setCart((prev) => prev.filter((i) => i.product_id !== pid));

  /* ── Update price (if allowed) ── */
  const commitPrice = (pid: number, val: string) => {
    const newPrice = parseFloat(val);
    if (isNaN(newPrice) || newPrice < 0) {
      setEditingPriceId(null);
      return;
    }
    const prod = products.find((p) => p.id === pid);
    const cost = prod ? Number(prod.cost_price) : 0;
    if (cost > 0 && newPrice < cost - 0.001) {
      toast({ title: `⚠ السعر أقل من التكلفة (${formatCurrency(cost)})`, variant: 'destructive' });
    }
    setCart((prev) =>
      prev.map((i) =>
        i.product_id !== pid
          ? i
          : { ...i, unit_price: newPrice, total_price: newPrice * i.quantity }
      )
    );
    setEditingPriceId(null);
  };

  /* ── Checkout mutation ── */
  const checkoutMutation = useMutation({
    mutationFn: (data: object) =>
      authFetch(api('/api/sales'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': `pos-${Date.now()}-${Math.random()}`,
        },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'خطأ');
        return j;
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/sales'] });
      qc.invalidateQueries({ queryKey: ['/api/products'] });
      qc.invalidateQueries({ queryKey: ['/api/customers'] });
      qc.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      qc.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setCheckoutError(null);
      setShowSplitPayment(false);
      setSuccessInvoice({
        invoice_no: data.invoice_no,
        total_amount: data.total_amount,
        customer_name: selectedCustomer?.name ?? null,
        customer_phone: selectedCustomer?.phone ?? null,
        payment_type: data.payment_type ?? 'cash',
        items: [...cart],
        warehouseName: warehouses.find((w) => w.id === warehouseId)?.name,
        safeName: safes.find((s) => s.id === safeId)?.name,
        cashierName: user?.name ?? user?.username ?? undefined,
      });
      /* Reset */
      setCart([]);
      setCustomerId('');
      setDiscountPct('');
      setTimeout(() => searchRef.current?.focus(), 100);
    },
    onError: (e: Error) => {
      setCheckoutError(e.message);
      toast({ title: '❌ فشل التسجيل', description: e.message, variant: 'destructive' });
    },
  });

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

  /* ── Return: load full invoice when user selects a result ── */
  const selectReturnInvoice = useCallback(
    async (saleId: number) => {
      setReturnFetching(true);
      setReturnSale(null);
      setReturnItems([]);
      setReturnSearchResults([]);
      try {
        const r = await authFetch(api(`/api/sales/${saleId}`));
        const full: ReturnSale = await r.json();
        if (!r.ok) throw new Error('خطأ في تحميل الفاتورة');
        setReturnSale(full);
        setReturnInvoiceNo(full.invoice_no);
        setReturnItems(
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
        setReturnFetching(false);
      }
    },
    [toast]
  );

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
      setReturnMode(false);
      setReturnSale(null);
      setReturnItems([]);
      setReturnInvoiceNo('');
      setReturnReason('');
    },
    onError: (e: Error) => {
      toast({ title: '❌ فشل المرتجع', description: e.message, variant: 'destructive' });
    },
  });

  const handleReturn = useCallback(() => {
    if (!returnSale) return;
    const activeItems = returnItems.filter((i) => i.return_qty > 0);
    if (activeItems.length === 0) {
      toast({ title: 'اختر صنفاً واحداً على الأقل', variant: 'destructive' });
      return;
    }
    const total = activeItems.reduce((s, i) => s + i.return_qty * i.unit_price, 0);
    returnMutation.mutate({
      sale_id: returnSale.id,
      customer_id: returnSale.customer_id,
      customer_name: returnSale.customer_name,
      items: activeItems.map((i) => ({
        original_sale_item_id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.return_qty,
        unit_price: i.unit_price,
        total_price: i.return_qty * i.unit_price,
      })),
      reason: returnReason,
      notes: '',
      date: new Date().toISOString().split('T')[0],
      refund_type: returnRefundType,
      safe_id: safeId,
      total_amount: total,
    });
  }, [returnSale, returnItems, returnReason, returnRefundType, safeId, returnMutation, toast]);

  /* ── handleCheckout — opens the split payment modal ── */
  const handleCheckout = useCallback(() => {
    if (cart.length === 0) {
      toast({ title: 'السلة فارغة', variant: 'destructive' });
      return;
    }
    setShowSplitPayment(true);
  }, [cart, toast]);

  /* ── handleSplitConfirm — called by modal with payment breakdown ── */
  const handleSplitConfirm = useCallback(
    (payments: SplitPaymentEntry[]) => {
      /* أنواع الدفع الفورية (غير آجل): نقدي + شبكة + تحويل + تقسيط */
      const immediatePaid = payments
        .filter((p) => p.type !== 'credit')
        .reduce((s, p) => s + p.amount, 0);
      const totalCredit = payments
        .filter((p) => p.type === 'credit')
        .reduce((s, p) => s + p.amount, 0);
      const pt: 'cash' | 'credit' | 'partial' =
        totalCredit === 0 ? 'cash' : immediatePaid === 0 ? 'credit' : 'partial';
      /* الخزينة الأساسية: أول دفعة نقدية ثم أي دفعة أخرى */
      const primarySafe =
        payments.find((p) => p.type === 'cash')?.safe_id ??
        payments.find((p) => p.safe_id)?.safe_id ??
        safeId;

      checkoutMutation.mutate({
        payment_type: pt,
        total_amount: cartTotal,
        paid_amount: immediatePaid,
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer?.name ?? null,
        safe_id: primarySafe,
        warehouse_id: warehouseId,
        salesperson_id: user?.id ?? null,
        discount_percent: parseFloat(discountPct) || 0,
        discount_amount: discountAmt,
        items: cart.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
        })),
        payments,
      });
    },
    [
      cart,
      cartTotal,
      selectedCustomer,
      safeId,
      warehouseId,
      user,
      discountPct,
      discountAmt,
      checkoutMutation,
    ]
  );

  /* keep ref current */
  checkoutRef.current = handleCheckout;

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      /* F9 → checkout */
      if (e.key === 'F9') {
        e.preventDefault();
        checkoutRef.current();
        return;
      }
      /* F2 → focus search */
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      /* Ctrl+Backspace → clear cart */
      if ((e.ctrlKey || e.metaKey) && e.key === 'Backspace') {
        e.preventDefault();
        setCart([]);
        return;
      }
      /* ESC — priority: modal → returnMode → cart confirm → navigate */
      if (e.key === 'Escape') {
        if (successInvoice) {
          setSuccessInvoice(null);
          return;
        }
        if (showExitConfirm) {
          setShowExitConfirm(false);
          return;
        }
        if (returnMode) {
          setReturnMode(false);
          setReturnSale(null);
          setReturnItems([]);
          setReturnInvoiceNo('');
          return;
        }
        if (cart.length > 0) {
          setShowExitConfirm(true);
          return;
        }
        navigate('/sales');
        return;
      }
      /* Enter → barcode exact match first, then first result */
      if (e.key === 'Enter' && document.activeElement === searchRef.current) {
        e.preventDefault();
        const trimmed = search.trim();
        if (trimmed && filtered.length > 0) {
          const barcodeMatch = products.find(
            (p) => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
          );
          const target = barcodeMatch ?? filtered[0];
          addToCart(target);
          if (barcodeMatch) setSearch('');
        }
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    filtered,
    addToCart,
    products,
    search,
    successInvoice,
    returnMode,
    cart,
    showExitConfirm,
    navigate,
  ]);

  /* ── Stock badge ── */
  const stockClass = (qty: number) =>
    qty <= 0 ? 'erp-badge-danger' : qty <= 5 ? 'erp-badge-warning' : 'erp-badge-neutral';

  /* ── Derived sizes for cashier mode ── */
  const cm = cashierMode;

  return (
    <div className="erp-page fixed inset-0 flex flex-col overflow-hidden" dir="rtl">
      {/* ════════════════════ EXIT CONFIRM MODAL ════════════════ */}
      {showExitConfirm && (
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
                السلة تحتوي على {cart.length} صنف. هل تريد الخروج بدون إتمام البيع؟
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 erp-btn-secondary rounded-xl py-2 text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  setCart([]);
                  setShowExitConfirm(false);
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

      {/* ════════════════════ TOP STATUS BAR ════════════════════ */}
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
          background: 'var(--erp-bg-soft)',
          borderBottom: '1px solid var(--erp-border)',
        }}
      >
        {/* Branch · Safe · User */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="erp-label text-[10px]">الفرع</p>
              <p className="erp-text font-bold text-sm leading-tight">{warehouseName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Vault className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <p className="erp-label text-[10px]">الخزينة</p>
              <p className="erp-text font-bold text-sm leading-tight">{safeName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 text-black"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            >
              {(user?.name ?? '?').slice(0, 2)}
            </div>
            <p className="erp-text-muted text-sm font-medium">{user?.name}</p>
          </div>
        </div>

        {/* Keyboard hints + cashier toggle */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2">
            {[
              ['F2', 'بحث'],
              ['Enter', 'إضافة'],
              ['F9', 'دفع'],
              ['ESC', 'خروج'],
              ['⌃⌫', 'مسح'],
            ].map(([k, l]) => (
              <div key={k} className="flex items-center gap-1">
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold erp-label"
                  style={{
                    background: 'var(--erp-bg-elevated)',
                    border: '1px solid var(--erp-border-strong)',
                  }}
                >
                  {k}
                </kbd>
                <span className="erp-label text-[10px]">{l}</span>
              </div>
            ))}
          </div>
          {/* Return mode toggle — only shown if user has can_return_sale */}
          {canReturnSale && (
            <button
              onClick={() => {
                setReturnMode((v) => !v);
                setReturnSale(null);
                setReturnItems([]);
                setReturnInvoiceNo('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                returnMode ? 'bg-red-500 text-white' : 'erp-btn-secondary'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {returnMode ? 'إلغاء المرتجع' : 'مرتجع'}
            </button>
          )}

          {/* Cashier mode toggle */}
          <button
            onClick={() => setCashierMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              cashierMode ? 'bg-amber-500 text-black' : 'erp-btn-secondary'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {cashierMode ? 'عادي' : 'وضع الكاشير'}
          </button>

          {/* Admin: change branch/safe */}
          {isAdmin && (
            <button
              onClick={onResetSetup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold erp-btn-ghost transition-all"
              title="تغيير الفرع والخزينة"
            >
              <Settings className="w-3.5 h-3.5" />
              تغيير
            </button>
          )}
        </div>
      </header>

      {/* ════════════════════ BODY ════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ════ PRODUCTS PANEL (right in RTL) ════ */}
        <div
          className="flex flex-col flex-1 min-w-0"
          style={{ borderLeft: '1px solid var(--erp-border)' }}
        >
          {/* Search bar */}
          <div
            className="px-3 shrink-0"
            style={{
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem',
              background: 'var(--erp-bg-soft)',
              borderBottom: '1px solid var(--erp-border)',
            }}
          >
            <div className="relative">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 erp-text-muted"
                style={{ color: 'var(--erp-text-3)' }}
              />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث عن صنف... (F2)"
                className="erp-input pr-10"
                style={{
                  fontSize: cm ? '1rem' : '0.875rem',
                  paddingTop: cm ? '0.75rem' : '0.625rem',
                  paddingBottom: cm ? '0.75rem' : '0.625rem',
                }}
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch('');
                    searchRef.current?.focus();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 erp-text-muted hover:opacity-100 opacity-50 transition-opacity"
                  style={{ color: 'var(--erp-text-3)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Products count */}
          {search && (
            <div
              className="px-3 py-1"
              style={{
                background: 'var(--erp-bg-soft)',
                borderBottom: '1px solid var(--erp-border)',
              }}
            >
              <span className="erp-label text-[11px]">{filtered.length} نتيجة</span>
            </div>
          )}

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="erp-empty h-full">
                <Search className="w-8 h-8" style={{ color: 'var(--erp-text-4)' }} />
                <p>{search ? 'لا توجد نتائج مطابقة' : 'لا توجد منتجات'}</p>
              </div>
            ) : (
              <div
                className={`grid gap-2 ${
                  cm
                    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4'
                    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                }`}
              >
                {filtered.map((p) => {
                  const qty = Number(p.quantity);
                  const outOfStock = qty <= 0;
                  const isJustAdded = recentlyAdded === p.id;
                  const inCart = cart.find((i) => i.product_id === p.id);

                  let cardStyle: React.CSSProperties = {
                    background: 'var(--erp-bg-card)',
                    border: `1px solid var(--erp-border)`,
                    borderRadius: '0.875rem',
                    transition: 'all 0.15s ease',
                  };
                  if (outOfStock) {
                    cardStyle = { ...cardStyle, opacity: 0.4, cursor: 'not-allowed' };
                  } else if (isJustAdded) {
                    cardStyle = {
                      ...cardStyle,
                      border: '1px solid rgba(245,158,11,0.7)',
                      background: 'rgba(245,158,11,0.08)',
                      transform: 'scale(0.97)',
                    };
                  } else if (inCart) {
                    cardStyle = {
                      ...cardStyle,
                      border: '1px solid rgba(16,185,129,0.4)',
                      background: 'rgba(16,185,129,0.06)',
                    };
                  }

                  return (
                    <button
                      key={p.id}
                      onClick={() => !outOfStock && addToCart(p)}
                      disabled={outOfStock}
                      className="relative flex flex-col text-right p-3 active:scale-[0.97]"
                      style={cardStyle}
                    >
                      {/* In-cart badge */}
                      {inCart && (
                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">
                          {inCart.quantity}
                        </div>
                      )}
                      {/* Name */}
                      <p
                        className="erp-text font-bold leading-snug line-clamp-2 mb-2 flex-1"
                        style={{ fontSize: cm ? '0.9375rem' : '0.8125rem' }}
                      >
                        {p.name}
                      </p>
                      {/* Price + Stock */}
                      <div className="flex items-end justify-between gap-1 mt-auto">
                        <p
                          className="text-amber-500 font-black"
                          style={{ fontSize: cm ? '1.125rem' : '0.9375rem' }}
                        >
                          {formatCurrency(p.sale_price)}
                        </p>
                        <span className={`${stockClass(qty)} text-[10px]`}>
                          {qty > 0 ? qty : 'نفد'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ════ RETURN PANEL ════ */}
        {returnMode && (
          <div
            className="flex flex-col shrink-0 overflow-hidden"
            style={{
              width: cm ? '420px' : '380px',
              background: 'var(--erp-bg-soft)',
              borderRight: 'none',
              borderTop: 'none',
              borderBottom: 'none',
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center gap-2 shrink-0"
              style={{
                borderBottom: '1px solid var(--erp-border)',
                background: 'rgba(239,68,68,0.08)',
              }}
            >
              <RotateCcw className="w-4 h-4 text-red-400" />
              <span className="erp-subtitle text-red-400">وضع المرتجع</span>
            </div>

            {/* Invoice search */}
            <div
              className="px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid var(--erp-border)' }}
            >
              <p className="erp-label text-xs mb-1.5">رقم الفاتورة / اسم العميل / رمز العميل</p>
              <div className="relative">
                <div className="flex items-center gap-2 erp-input pr-3 pl-2 py-2">
                  <Search
                    className={`w-4 h-4 shrink-0 transition-colors ${returnSearchFetching || returnFetching ? 'text-amber-500 animate-pulse' : 'text-white/30'}`}
                    style={{
                      color:
                        returnSearchFetching || returnFetching ? undefined : 'var(--erp-text-3)',
                    }}
                  />
                  <input
                    value={returnInvoiceNo}
                    onChange={(e) => {
                      setReturnInvoiceNo(e.target.value);
                      if (returnSale) {
                        setReturnSale(null);
                        setReturnItems([]);
                      }
                    }}
                    placeholder="رقم الفاتورة / اسم العميل / رمز العميل..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'var(--erp-text)' }}
                    dir="rtl"
                  />
                  {returnInvoiceNo && (
                    <button
                      onClick={() => {
                        setReturnInvoiceNo('');
                        setReturnSale(null);
                        setReturnItems([]);
                        setReturnSearchResults([]);
                      }}
                      className="text-white/30 hover:text-white/60 shrink-0"
                      style={{ color: 'var(--erp-text-3)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Results dropdown */}
                {!returnSale && returnInvoiceNo && (
                  <div
                    className="mt-1 rounded-xl overflow-hidden max-h-52 overflow-y-auto"
                    style={{
                      background: 'var(--erp-bg-elevated)',
                      border: '1px solid var(--erp-border)',
                    }}
                  >
                    {returnSearchFetching ? (
                      <div className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-3)' }}>
                        جاري البحث…
                      </div>
                    ) : returnSearchResults.length === 0 ? (
                      <div className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-3)' }}>
                        لا توجد نتائج
                      </div>
                    ) : (
                      returnSearchResults.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => selectReturnInvoice(s.id)}
                          className="w-full text-right px-4 py-2.5 text-sm transition-colors hover:opacity-80 flex justify-between items-center gap-2 border-b last:border-0"
                          style={{
                            borderColor: 'var(--erp-border)',
                            background: 'transparent',
                            color: 'var(--erp-text)',
                          }}
                        >
                          <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                            <span className="font-bold text-amber-500 text-xs" dir="ltr">
                              {s.invoice_no}
                            </span>
                            <span
                              className="text-xs truncate"
                              style={{ color: 'var(--erp-text-2)' }}
                            >
                              {s.customer_name || 'نقدي'}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span
                              className="text-xs font-bold"
                              style={{ color: 'var(--erp-text)' }}
                            >
                              {s.payment_type === 'cash'
                                ? 'نقدي'
                                : s.payment_type === 'credit'
                                  ? 'آجل'
                                  : 'جزئي'}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--erp-text-3)' }}>
                              {s.date || '—'}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!returnInvoiceNo && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--erp-text-3)' }}>
                  ابحث بالرقم أو الاسم أو الرمز
                </p>
              )}
            </div>

            {/* Sale info + items */}
            {returnSale && (
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div
                  className="rounded-xl p-3 space-y-1"
                  style={{
                    background: 'var(--erp-bg-elevated)',
                    border: '1px solid var(--erp-border)',
                  }}
                >
                  <div className="flex justify-between">
                    <span className="erp-label text-xs">الفاتورة</span>
                    <span className="erp-text font-bold text-sm" dir="ltr">
                      {returnSale.invoice_no}
                    </span>
                  </div>
                  {returnSale.customer_name && (
                    <div className="flex justify-between">
                      <span className="erp-label text-xs">العميل</span>
                      <span className="erp-text text-sm">{returnSale.customer_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="erp-label text-xs">الإجمالي</span>
                    <span className="text-amber-500 font-bold text-sm">
                      {formatCurrency(returnSale.total_amount)}
                    </span>
                  </div>
                </div>

                <p className="erp-label text-xs">الأصناف المرتجعة</p>
                {returnItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl p-3"
                    style={{
                      background: 'var(--erp-bg-card)',
                      border: '1px solid var(--erp-border)',
                    }}
                  >
                    <p className="erp-text text-sm font-bold mb-2">{item.product_name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="erp-label text-xs">الكمية (max {item.max_qty})</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            setReturnItems((prev) =>
                              prev.map((it, i) =>
                                i !== idx
                                  ? it
                                  : { ...it, return_qty: Math.max(0, it.return_qty - 1) }
                              )
                            )
                          }
                          className="w-7 h-7 rounded-lg flex items-center justify-center erp-btn-ghost text-lg font-bold"
                        >
                          −
                        </button>
                        <span className="erp-number w-6 text-center">{item.return_qty}</span>
                        <button
                          onClick={() =>
                            setReturnItems((prev) =>
                              prev.map((it, i) =>
                                i !== idx
                                  ? it
                                  : { ...it, return_qty: Math.min(it.max_qty, it.return_qty + 1) }
                              )
                            )
                          }
                          className="w-7 h-7 rounded-lg flex items-center justify-center erp-btn-ghost text-lg font-bold"
                        >
                          +
                        </button>
                      </div>
                      <span className="erp-number text-sm">
                        {formatCurrency(item.return_qty * item.unit_price)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Reason */}
                <div>
                  <p className="erp-label text-xs mb-1.5">سبب المرتجع</p>
                  <input
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="اختياري..."
                    className="erp-input w-full text-sm"
                  />
                </div>

                {/* Refund type */}
                <div>
                  <p className="erp-label text-xs mb-1.5">طريقة الاسترداد</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['cash', 'نقدي'],
                        ['credit', 'رصيد'],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setReturnRefundType(v)}
                        className={`py-2 rounded-xl text-sm font-bold transition-all ${
                          returnRefundType === v
                            ? v === 'cash'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-blue-500 text-white'
                            : 'erp-btn-ghost'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total + submit */}
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="erp-label text-sm">إجمالي المرتجع</span>
                    <span className="text-red-400 font-black text-lg">
                      {formatCurrency(
                        returnItems
                          .filter((i) => i.return_qty > 0)
                          .reduce((s, i) => s + i.return_qty * i.unit_price, 0)
                      )}
                    </span>
                  </div>
                  <button
                    onClick={handleReturn}
                    disabled={returnMutation.isPending}
                    className="w-full py-3 rounded-xl font-bold text-white transition-all"
                    style={{
                      background: returnMutation.isPending
                        ? 'rgba(239,68,68,0.4)'
                        : 'rgba(239,68,68,0.85)',
                    }}
                  >
                    {returnMutation.isPending ? 'جارٍ التسجيل...' : 'تأكيد المرتجع'}
                  </button>
                </div>
              </div>
            )}

            {!returnSale && !returnFetching && !returnInvoiceNo && (
              <div className="erp-empty flex-1">
                <RefreshCw
                  className="w-10 h-10 mx-auto mb-3 opacity-20"
                  style={{ color: 'var(--erp-text-3)' }}
                />
                <p className="erp-text-muted text-sm">ابحث بالرقم أو الاسم أو رمز العميل</p>
              </div>
            )}
            {returnFetching && !returnSale && (
              <div className="erp-empty flex-1">
                <RefreshCw
                  className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40"
                  style={{ color: 'var(--erp-text-3)' }}
                />
                <p className="erp-text-muted text-sm">جاري تحميل الفاتورة…</p>
              </div>
            )}
          </div>
        )}

        {/* ════ CART + PAYMENT PANEL ════ */}
        {!returnMode && (
          <div
            className="flex flex-col shrink-0 erp-card-soft"
            style={{
              width: cm ? '420px' : '360px',
              background: 'var(--erp-bg-soft)',
              borderRight: 'none',
              borderTop: 'none',
              borderBottom: 'none',
            }}
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
              clearCart={() => setCart([])}
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
              isPending={checkoutMutation.isPending}
              onCheckout={handleCheckout}
            />
          </div>
        )}
      </div>

      {/* ════ SPLIT PAYMENT MODAL ════ */}
      {showSplitPayment && (
        <SplitPaymentModal
          total={cartTotal}
          safes={safes as { id: number; name: string }[]}
          defaultSafeId={safeId}
          isRestricted={!isAdmin}
          canCash={canCash}
          canCredit={canCredit}
          hasCustomer={!!customerId}
          isPending={checkoutMutation.isPending}
          onConfirm={handleSplitConfirm}
          onClose={() => {
            setShowSplitPayment(false);
            setCheckoutError(null);
          }}
        />
      )}

      {/* ════ SUCCESS MODAL ════ */}
      {successInvoice && (
        <SuccessModal
          invoice={successInvoice}
          onClose={() => {
            setSuccessInvoice(null);
            setTimeout(() => searchRef.current?.focus(), 100);
          }}
        />
      )}
    </div>
  );
}
