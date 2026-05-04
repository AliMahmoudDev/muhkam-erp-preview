import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { safeArray } from '@/lib/safe-data';
import { authFetch } from '@/lib/auth-fetch';
import {
  useGetProducts,
  useGetCustomers,
  useGetSettingsSafes,
  useCreateProduct,
  useGetCategories,
} from '@workspace/api-client-react';
import { ProductFormModal, ProductFormData } from '@/components/product-form-modal';
import { formatCurrency } from '@/lib/format';
import {
  Search, Plus, Minus, Trash2, X, ShoppingCart, User, Package,
  Percent, Vault, Lock, Coins, Clock, FileText, UserPlus, ScanLine,
  RotateCcw, PauseCircle, PlayCircle, Banknote, Tag,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth';
import { hasPermission } from '@/lib/permissions';
import { SearchableSelect } from '@/components/searchable-select';
import { api } from '@/lib/api';
import { CartItem, HeldInvoice, PayRow, SuccessInvoice } from './salesTypes';
import WhatsAppSuccessModal from './WhatsAppSuccessModal';

export function NewSalePanel({ onDone }: { onDone: () => void }) {
  const { user: currentUser } = useAuth();
  const canEditPrice = hasPermission(currentUser, 'can_edit_price') === true;
  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw).filter((c) => c.is_customer !== false);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createProductMutation = useCreateProduct();
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const { data: categoriesRaw } = useGetCategories();
  const categories = safeArray(categoriesRaw);

  const { data: warehousesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/settings/warehouses'],
    queryFn: () =>
      authFetch(api('/api/settings/warehouses')).then(async (r) => {
        if (!r.ok) throw new Error('خطأ في جلب البيانات');
        const j = await r.json();
        return safeArray(j);
      }),
  });
  const warehouses = safeArray(warehousesRaw);

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
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('muhkam_held_invoices') || '[]');
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
  const payAmountRef = useRef<HTMLInputElement>(null);

  const isRestricted = currentUser?.role === 'cashier' || currentUser?.role === 'salesperson';

  const effectiveWarehouseId = isRestricted
    ? currentUser?.warehouse_id
      ? String(currentUser.warehouse_id)
      : ''
    : warehouseId;
  const effectiveSafeId = isRestricted ? (currentUser?.safe_id ?? null) : null;

  const effectiveWarehouseName =
    warehouses.find((w) => String(w.id) === effectiveWarehouseId)?.name ?? '—';

  useEffect(() => {
    if (!isRestricted && warehouses.length > 0 && !warehouseId) {
      setWarehouseId(String(warehouses[0].id));
    }
  }, [warehouses, warehouseId, isRestricted]);

  const salespersonId = currentUser ? String(currentUser.id) : '';
  const salespersonName = currentUser?.name ?? '—';
  const [successInvoice, setSuccessInvoice] = useState<SuccessInvoice | null>(null);

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
      const selectedCustomer = customers.find((c) => c.id === parseInt(customerId));
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/safes'] });
      setCheckoutError(null);
      setPayRows([]);
      setPayAmount('');
      setPayRowKey((k) => k + 1);
      setSuccessInvoice({
        invoice_no: data.invoice_no,
        total_amount: data.total_amount,
        customer_name: selectedCustomer?.name ?? null,
        customer_phone: selectedCustomer?.phone ?? null,
        payment_type: data.payment_type ?? 'cash',
        items: [...cart],
        payments: payRows.map((r) => ({
          label: r.type === 'credit'
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

  const [recentlyAdded, setRecentlyAdded] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ pid: number; val: string } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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

  const addToCart = (product: (typeof products)[0]) => {
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

  const handleCreateProduct = (data: ProductFormData) => {
    createProductMutation.mutate(
      { data },
      {
        onSuccess: (newProduct: unknown) => {
          toast({ title: '✅ تم إضافة المنتج وإضافته للفاتورة' });
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          setShowCreateProduct(false);
          setSearch('');
          const created = newProduct as { id?: number; sale_price?: unknown; cost_price?: unknown; quantity?: unknown } | null;
          if (created?.id) {
            addToCart({
              ...created,
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
  const canCheckout = cart.length > 0 && payIsDone && !checkoutMutation.isPending && !payCreditWarn;

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

  const handleCheckout = () => {
    if (!canCheckout) return;
    if (!effectiveWarehouseId) {
      toast({ title: 'المخزن غير محدد — يرجى مراجعة المدير لإعداد حسابك', variant: 'destructive' });
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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const _checkoutRef = useRef(handleCheckout);
  _checkoutRef.current = handleCheckout;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

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

  const barcodeModeRef = useRef(barcodeMode);
  barcodeModeRef.current = barcodeMode;
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
    localStorage.setItem('muhkam_held_invoices', JSON.stringify(updated));
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
    localStorage.setItem('muhkam_held_invoices', JSON.stringify(updated));
    setShowHeld(false);
  };

  const deleteHold = (id: string) => {
    const updated = heldInvoices.filter((h) => h.id !== id);
    setHeldInvoices(updated);
    localStorage.setItem('muhkam_held_invoices', JSON.stringify(updated));
  };

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

      <div className="flex flex-col lg:flex-row gap-3" style={{ height: 'calc(100vh - 178px)' }}>
        {/* ═══════════════════════════════════════
            يسار — كتالوج المنتجات
        ═══════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          {/* شريط البحث + الفئات */}
          <div className="sale-search-bar rounded-2xl px-3 pt-3 pb-2 shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-400/60 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="ابحث عن منتج... (Enter للإضافة)"
                className="sale-search-input bg-transparent text-sm w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              {search && filteredProducts.filter((p) => Number(p.quantity) > 0).length > 0 && (
                <span className="shrink-0 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap font-bold">
                  ↵{' '}
                  {filteredProducts.filter((p) => Number(p.quantity) > 0).length === 1
                    ? filteredProducts[0].name.slice(0, 18)
                    : `${filteredProducts.filter((p) => Number(p.quantity) > 0).length} نتيجة`}
                </span>
              )}
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="shrink-0 sale-muted-text hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setBarcodeMode((v) => !v)}
                title={barcodeMode ? 'إيقاف وضع الباركود' : 'تفعيل وضع الباركود'}
                className={`shrink-0 transition-colors rounded-lg p-1 ${barcodeMode ? 'text-amber-400 bg-amber-500/15' : 'sale-muted-text hover:text-amber-400'}`}
              >
                <ScanLine className="w-4 h-4" />
              </button>
            </div>
            {barcodeMode && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-1 pb-0.5 animate-pulse">
                <ScanLine className="w-3 h-3" />
                وضع الباركود نشط — امسح الكود وسيُضاف تلقائياً
              </div>
            )}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => setCategoryFilter('')}
                className={`sale-cat-pill text-xs font-bold px-3 py-1 rounded-full shrink-0 ${!categoryFilter ? 'active' : ''}`}
              >
                كل الأصناف
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter((prev) => (prev === cat.name ? '' : cat.name))}
                  className={`sale-cat-pill text-xs font-bold px-3 py-1 rounded-full shrink-0 ${categoryFilter === cat.name ? 'active' : ''}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* شبكة المنتجات */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-1">
              {filteredProducts.map((product) => {
                const outOfStock = product.quantity <= 0;
                const lowStock = !outOfStock && product.quantity <= 5;
                const isFlashing = recentlyAdded === product.id;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`sale-product-card group rounded-2xl p-3.5 text-right overflow-hidden ${isFlashing ? 'pos-card-flash' : ''}`}
                  >
                    <div className="sale-product-icon-bg h-12 rounded-xl mb-3 flex items-center justify-center">
                      <Package className="sale-product-icon w-5 h-5" />
                    </div>
                    <p className="sale-product-name font-bold text-sm truncate leading-tight">
                      {product.name}
                    </p>
                    {product.category && (
                      <span className="text-[10px] text-amber-500/70 font-bold mt-0.5 block truncate">
                        {product.category}
                      </span>
                    )}
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-emerald-400 font-black text-sm tabular-nums">
                        {formatCurrency(product.sale_price)}
                      </span>
                      <span
                        className={`sale-stock-badge text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                          outOfStock
                            ? '!bg-red-500/15 !text-red-400'
                            : lowStock
                              ? '!bg-orange-500/15 !text-orange-400'
                              : ''
                        }`}
                      >
                        {outOfStock ? 'نفد' : lowStock ? `${product.quantity} ⚠` : product.quantity}
                      </span>
                    </div>
                    {!outOfStock && (
                      <div
                        className="mt-2 py-1 rounded-lg text-[11px] font-black text-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: 'rgba(245,158,11,0.11)',
                          color: '#F59E0B',
                          border: '1px solid rgba(245,158,11,0.20)',
                        }}
                      >
                        + أضف للفاتورة
                      </div>
                    )}
                  </button>
                );
              })}

              {search && filteredProducts.length === 0 && (
                <button
                  onClick={() => setShowCreateProduct(true)}
                  className="rounded-2xl p-3.5 text-right border border-dashed border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/60 transition-all flex flex-col items-center justify-center gap-2 min-h-[140px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-violet-300 text-xs font-bold">إضافة منتج جديد</p>
                    <p className="sale-muted-text text-xs mt-0.5 truncate max-w-[120px] opacity-70">
                      «{search}»
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            يمين — لوحة الفاتورة
        ═══════════════════════════════════════ */}
        <div className="w-full lg:w-[385px] flex flex-col sale-cart-panel rounded-2xl overflow-hidden shrink-0">
          {/* رأس اللوحة */}
          <div className="sale-cart-header px-4 pt-3 pb-2.5 border-b sale-border shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-full ${cart.length > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'sale-badge-empty'}`}
                >
                  {cart.length} صنف
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={_handleNewSale}
                    title="تفريغ الفاتورة"
                    className="text-[11px] sale-muted-text hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> تفريغ
                  </button>
                )}
                {cart.length > 0 && (
                  <button
                    onClick={holdInvoice}
                    title="إيداع الفاتورة"
                    className="text-[11px] sale-muted-text hover:text-blue-400 transition-colors flex items-center gap-1"
                  >
                    <PauseCircle className="w-3 h-3" /> إيداع
                  </button>
                )}
                {heldInvoices.length > 0 && (
                  <button
                    onClick={() => setShowHeld((v) => !v)}
                    title="الفواتير المودعة"
                    className="text-[11px] relative flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <PlayCircle className="w-3 h-3" />
                    <span className="bg-blue-500/25 px-1.5 py-0.5 rounded-full font-black">
                      {heldInvoices.length}
                    </span>
                  </button>
                )}
              </div>
              <h3 className="font-black sale-text-primary flex items-center gap-2 text-sm">
                <ShoppingCart className="w-4 h-4 text-amber-400" /> فاتورة مبيعات
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {isRestricted ? (
                <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
                  <Vault className="w-3.5 h-3.5 sale-muted-text shrink-0" />
                  <span className="sale-label-text text-xs shrink-0">الفرع</span>
                  <span className="text-emerald-400 text-xs font-bold truncate">
                    {effectiveWarehouseName}
                  </span>
                </div>
              ) : (
                <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
                  <Vault className="w-3.5 h-3.5 sale-muted-text shrink-0" />
                  <span className="sale-label-text text-xs shrink-0">المخزن</span>
                  <select
                    className="bg-transparent outline-none w-full appearance-none text-xs sale-text-primary"
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id} className="bg-slate-900">
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sale-field-row border !border-amber-500/22 flex items-center gap-2 rounded-xl px-3 py-2">
                <Lock className="w-3.5 h-3.5 text-amber-400/55 shrink-0" />
                <span className="sale-label-text text-xs shrink-0">المندوب</span>
                <span className="text-amber-400 text-xs font-bold truncate">{salespersonName}</span>
              </div>
            </div>
          </div>

          {/* ═══ أصناف الفاتورة ═══ */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6">
                <div className="sale-empty-icon-bg w-16 h-16 rounded-2xl flex items-center justify-center">
                  <ShoppingCart className="w-7 h-7 sale-muted-text opacity-40" />
                </div>
                <p className="text-sm sale-muted-text font-bold opacity-50">
                  اضغط على أي منتج للإضافة
                </p>
              </div>
            ) : (
              <>
                {showHeld && heldInvoices.length > 0 && (
                  <div className="mx-2 mb-1 rounded-xl overflow-hidden border border-blue-500/20 bg-blue-500/5 shrink-0">
                    {heldInvoices.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-2 px-3 py-1.5 border-b border-blue-500/10 last:border-0 hover:bg-blue-500/10 transition-colors"
                      >
                        <button
                          onClick={() => resumeHold(h.id)}
                          className="flex-1 flex items-center gap-2 text-right"
                        >
                          <PlayCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold sale-text-primary truncate">
                              {h.label}
                            </p>
                            <p className="text-[10px] sale-muted-text">
                              {h.cart.length} صنف ·{' '}
                              {new Date(h.ts).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => deleteHold(h.id)}
                          className="w-5 h-5 flex items-center justify-center text-red-400/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sale-invoice-header flex items-center gap-1 px-3 py-1.5 shrink-0">
                  <span className="sale-muted-text text-[10px] font-bold flex-1">المنتج</span>
                  <span className="sale-muted-text text-[10px] font-bold w-[58px] text-center">الكمية</span>
                  <span className="sale-muted-text text-[10px] font-bold w-[46px] text-center">سعر</span>
                  <span className="sale-muted-text text-[10px] font-bold w-[44px] text-center flex items-center justify-center gap-0.5">
                    <Tag className="w-2.5 h-2.5" />خصم
                  </span>
                  <span className="sale-muted-text text-[10px] font-bold w-[60px] text-center">الإجمالي</span>
                  <span className="w-5 shrink-0" />
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
                  {cart.map((item, index) => {
                    const origPrice =
                      products.find((p) => p.id === item.product_id)?.sale_price ?? item.unit_price;
                    const priceChanged = Math.abs(item.unit_price - Number(origPrice)) > 0.001;
                    const shortNum = (n: number) =>
                      n >= 1000
                        ? n.toLocaleString('en', { maximumFractionDigits: 0 })
                        : n.toFixed(n % 1 === 0 ? 0 : 1);
                    return (
                      <div
                        key={item.product_id}
                        className="sale-invoice-row group flex items-center gap-1 px-2 py-2"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="sale-row-num">{index + 1}</span>
                          <div className="min-w-0">
                            <p className="sale-text-primary text-xs font-bold truncate leading-tight">
                              {item.product_name}
                            </p>
                            {priceChanged && (
                              <span className="text-amber-400 text-[9px] font-bold leading-none">
                                ⚠ معدّل
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="w-[58px] flex items-center justify-center gap-0.5 shrink-0">
                          <button
                            onClick={() => updateQty(item.product_id, -1)}
                            className="sale-qty-btn-sm w-[20px] h-[20px] rounded-md flex items-center justify-center"
                          >
                            <Minus className="w-2.5 h-2.5 sale-text-primary" />
                          </button>
                          <span className="sale-text-primary font-black text-xs w-[18px] text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.product_id, 1)}
                            className="sale-qty-btn-sm-amber w-[20px] h-[20px] rounded-md flex items-center justify-center"
                          >
                            <Plus className="w-2.5 h-2.5 text-amber-400" />
                          </button>
                        </div>

                        <div className="w-[46px] shrink-0 flex items-center justify-center">
                          {canEditPrice ? (
                            editingPrice?.pid === item.product_id ? (
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                className="sale-price-input w-full rounded-md px-1 py-0.5 text-[10px] outline-none tabular-nums text-center"
                                value={editingPrice.val}
                                onChange={(e) =>
                                  setEditingPrice((p) => (p ? { ...p, val: e.target.value } : null))
                                }
                                onBlur={() => {
                                  updatePrice(item.product_id, editingPrice.val);
                                  setEditingPrice(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updatePrice(item.product_id, editingPrice.val);
                                    setEditingPrice(null);
                                  }
                                  if (e.key === 'Escape') setEditingPrice(null);
                                }}
                              />
                            ) : (
                              <button
                                onClick={() =>
                                  setEditingPrice({
                                    pid: item.product_id,
                                    val: String(item.unit_price),
                                  })
                                }
                                className={`text-[10px] tabular-nums transition-colors hover:text-amber-400 text-center truncate w-full ${priceChanged ? 'text-amber-400' : 'sale-muted-text'}`}
                                title="اضغط لتعديل السعر"
                              >
                                {shortNum(item.unit_price)}
                              </button>
                            )
                          ) : (
                            <span
                              className={`text-[10px] tabular-nums text-center ${priceChanged ? 'text-amber-400' : 'sale-muted-text'}`}
                            >
                              {shortNum(item.unit_price)}
                            </span>
                          )}
                        </div>

                        <div className="w-[44px] shrink-0 flex items-center justify-center">
                          {editingDisc?.pid === item.product_id ? (
                            <div className="flex items-center gap-0.5 w-full">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                autoFocus
                                className="sale-price-input flex-1 min-w-0 rounded-md px-0.5 py-0.5 text-[10px] outline-none tabular-nums text-center"
                                value={editingDisc.val}
                                onChange={(e) =>
                                  setEditingDisc((d) => (d ? { ...d, val: e.target.value } : null))
                                }
                                onBlur={() => {
                                  updateItemDisc(item.product_id, editingDisc.val, editingDisc.mode);
                                  setEditingDisc(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateItemDisc(item.product_id, editingDisc.val, editingDisc.mode);
                                    setEditingDisc(null);
                                  }
                                  if (e.key === 'Escape') setEditingDisc(null);
                                }}
                              />
                              <button
                                className="text-[9px] text-amber-400 font-black shrink-0 hover:opacity-70"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setEditingDisc((d) =>
                                    d ? { ...d, mode: d.mode === 'pct' ? 'amt' : 'pct' } : null
                                  );
                                }}
                              >
                                {editingDisc.mode === 'pct' ? '%' : 'ج'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setEditingDisc({
                                  pid: item.product_id,
                                  val: String(item.item_disc ?? ''),
                                  mode: item.item_disc_mode ?? 'pct',
                                })
                              }
                              className={`text-[10px] tabular-nums text-center w-full transition-colors hover:text-rose-400 ${item.item_disc ? 'text-rose-400 font-bold' : 'sale-muted-text opacity-40 hover:opacity-100'}`}
                              title="اضغط لإضافة خصم على الصنف"
                            >
                              {item.item_disc
                                ? `${shortNum(item.item_disc)}${item.item_disc_mode === 'pct' ? '%' : 'ج'}`
                                : '—'}
                            </button>
                          )}
                        </div>

                        <span className="w-[60px] shrink-0 text-center font-black text-emerald-400 text-xs tabular-nums">
                          {shortNum(item.total_price)}
                        </span>

                        <button
                          onClick={() =>
                            setCart((prev) => prev.filter((i) => i.product_id !== item.product_id))
                          }
                          className="w-5 h-5 shrink-0 rounded-lg flex items-center justify-center transition-all text-transparent group-hover:text-red-400/50 hover:!text-red-400 hover:bg-red-500/15"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {cart.length > 1 && (
                  <div className="sale-invoice-subtotal border-t sale-border flex items-center justify-between px-3 py-1.5 shrink-0">
                    <span className="sale-muted-text text-[10px] tabular-nums">
                      {cart.reduce((s, i) => s + i.quantity, 0)} وحدة
                    </span>
                    <span className="sale-muted-text text-[10px] font-bold tabular-nums">
                      مجموع: {cartSubtotal.toLocaleString('en', { maximumFractionDigits: 0 })} ج.م
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── قدم الفاتورة ─── */}
          <div className="sale-cart-footer p-3 space-y-2 shrink-0">
            <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
              <User className="w-3.5 h-3.5 sale-muted-text shrink-0" />
              <span className="sale-label-text text-xs shrink-0">العميل</span>
              <SearchableSelect
                items={customerSaleItems}
                value={customerId}
                onChange={setCustomerId}
                placeholder="ابحث باسم أو كود..."
                emptyLabel="عميل نقدي"
                className="w-full min-w-0"
                inputClassName="bg-transparent text-xs"
              />
              <button
                onClick={() => setShowQuickCustomer(true)}
                title="عميل جديد"
                className="shrink-0 sale-muted-text hover:text-emerald-400 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showQuickCustomer && (
              <div className="sale-field-row rounded-xl px-3 py-2.5 space-y-2 border border-emerald-500/25">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <UserPlus className="w-3 h-3" />
                    عميل جديد
                  </span>
                  <button
                    onClick={() => {
                      setShowQuickCustomer(false);
                      setQuickCustName('');
                      setQuickCustPhone('');
                    }}
                    className="sale-muted-text hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="اسم العميل *"
                  autoFocus
                  className="w-full bg-transparent text-xs sale-text-primary placeholder:opacity-40 outline-none border-b sale-border pb-1"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="رقم الهاتف (اختياري)"
                  className="w-full bg-transparent text-xs sale-text-primary placeholder:opacity-40 outline-none border-b sale-border pb-1"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createQuickCustomer();
                  }}
                />
                <button
                  onClick={createQuickCustomer}
                  disabled={quickCustLoading || !quickCustName.trim()}
                  className="w-full text-xs font-black py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
                >
                  {quickCustLoading ? 'جارٍ الإضافة...' : '+ إضافة العميل'}
                </button>
              </div>
            )}

            {selectedCustomer && (
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${
                  Number(selectedCustomer.balance) > 0
                    ? 'bg-red-500/10 border border-red-500/20'
                    : Number(selectedCustomer.balance) < 0
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'sale-field-row'
                }`}
              >
                <span className="sale-muted-text">رصيد العميل</span>
                <span
                  className={
                    Number(selectedCustomer.balance) > 0
                      ? 'text-red-400'
                      : Number(selectedCustomer.balance) < 0
                        ? 'text-emerald-400'
                        : 'sale-muted-text'
                  }
                >
                  {Number(selectedCustomer.balance) === 0
                    ? 'متسوّى ✓'
                    : Number(selectedCustomer.balance) > 0
                      ? `دين: ${formatCurrency(Number(selectedCustomer.balance))}`
                      : `له: ${formatCurrency(Math.abs(Number(selectedCustomer.balance)))}`}
                </span>
              </div>
            )}

            {selectedCustomer?.phone && (
              <div className="text-xs text-[#25D366] flex items-center gap-1 px-1">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {selectedCustomer.phone}
              </div>
            )}

            <div className="sale-field-row flex items-center gap-1.5 rounded-xl px-3 py-2">
              <Percent className="w-3 h-3 sale-muted-text shrink-0" />
              <span className="sale-label-text text-xs shrink-0">خصم الفاتورة</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                className="bg-transparent outline-none flex-1 text-xs sale-text-primary placeholder:opacity-25"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
              <button
                onClick={() => {
                  setDiscountMode((m) => (m === 'pct' ? 'amt' : 'pct'));
                  setDiscountPct('');
                }}
                className="text-xs font-black sale-muted-text hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 shrink-0"
                title="تبديل بين % ومبلغ"
              >
                {discountMode === 'pct' ? '%' : 'ج'}
              </button>
              {discountAmount > 0 && (
                <span className="text-red-400 text-xs font-bold shrink-0">
                  -{formatCurrency(discountAmount)}
                </span>
              )}
            </div>

            <div className="sale-field-row flex items-center gap-1.5 rounded-xl px-3 py-2">
              <FileText className="w-3 h-3 sale-muted-text shrink-0" />
              <span className="sale-label-text text-xs shrink-0">ملاحظات</span>
              <input
                type="text"
                placeholder="ملاحظة على الفاتورة..."
                className="bg-transparent outline-none flex-1 text-xs sale-text-primary placeholder:opacity-25"
                value={invoiceNote}
                onChange={(e) => setInvoiceNote(e.target.value)}
              />
              {invoiceNote && (
                <button
                  onClick={() => setInvoiceNote('')}
                  className="shrink-0 sale-muted-text hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="sale-total-box rounded-2xl px-4 py-3 flex items-center justify-between">
              {discountAmount > 0 ? (
                <div className="text-left">
                  <p className="text-[10px] sale-muted-text line-through tabular-nums">
                    {formatCurrency(cartSubtotal)}
                  </p>
                  <p className="text-[10px] sale-label-text">
                    {discountMode === 'pct'
                      ? `بعد خصم ${discountPct}%`
                      : `بعد خصم ${formatCurrency(discountAmount)}`}
                  </p>
                </div>
              ) : (
                <span className="text-xs sale-label-text font-medium">إجمالي الفاتورة</span>
              )}
              <span
                className="font-black sale-text-primary tabular-nums"
                style={{ fontSize: '1.5rem', letterSpacing: '-0.5px', lineHeight: 1 }}
              >
                {formatCurrency(cartTotal)}
              </span>
            </div>

            {/* ══ قسم الدفع ══ */}
            <div className="sale-pay-box rounded-2xl overflow-hidden">
              <div className="px-3 pt-2.5 pb-2">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span
                    className="font-bold tabular-nums transition-colors"
                    style={{
                      color: payIsDone ? '#10B981' : cart.length === 0 ? '#94A3B8' : '#F59E0B',
                    }}
                  >
                    {payIsDone
                      ? '✓ مكتمل'
                      : cart.length === 0
                        ? 'أضف منتجاً للبدء'
                        : payPaidSoFar > 0
                          ? `متبقي: ${formatCurrency(payRemaining)}`
                          : 'اختر طريقة الدفع'}
                  </span>
                  <span className="sale-muted-text">{Math.round(payPct)}%</span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--erp-bg-hover)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${payPct}%`,
                      background: payIsDone
                        ? 'linear-gradient(90deg,#10B981,#34D399)'
                        : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
                    }}
                  />
                </div>
              </div>

              {payRows.length > 0 && (
                <div className="px-2 pb-2 space-y-1">
                  {payRows.map((row) => (
                    <div
                      key={row.id}
                      className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 ${row.type === 'credit' ? 'sale-pay-row-credit' : 'sale-pay-row-cash'}`}
                    >
                      <button
                        onClick={() => setPayRows((prev) => prev.filter((r) => r.id !== row.id))}
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                        style={{ background: 'rgba(239,68,68,0.08)' }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <span
                        className={`text-xs shrink-0 flex items-center gap-1 ${row.type === 'credit' ? 'text-indigo-400' : 'text-emerald-400'}`}
                      >
                        {row.type === 'cash' ? (
                          <Coins className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {row.type === 'cash'
                          ? (safes.find((s) => s.id === row.safe_id)?.name ?? '—')
                          : 'ائتمان'}
                      </span>
                      <span className="sale-text-primary font-black text-sm tabular-nums mr-auto">
                        {formatCurrency(row.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!payIsDone && (
                <div className={`px-2 pb-2.5 ${payShake ? 'erp-shake' : ''}`}>
                  <div className="flex gap-1.5 mb-2">
                    <button
                      onClick={() => setPayType('cash')}
                      className={`sale-pay-btn flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${payType === 'cash' ? 'sale-pay-btn-cash-active' : 'sale-pay-btn-inactive'}`}
                    >
                      <Coins className="w-3 h-3" /> نقدي
                    </button>
                    <button
                      onClick={() => setPayType('credit')}
                      className={`sale-pay-btn flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${payType === 'credit' ? 'sale-pay-btn-credit-active' : 'sale-pay-btn-inactive'}`}
                    >
                      <Clock className="w-3 h-3" /> آجل
                    </button>
                  </div>

                  <div className="flex gap-1.5 items-stretch mb-1.5">
                    {payType === 'cash' ? (
                      <select
                        value={paySafe ?? ''}
                        onChange={(e) => setPaySafe(parseInt(e.target.value) || null)}
                        disabled={isRestricted}
                        className="sale-pay-safe flex-1 min-w-0"
                        style={{ cursor: isRestricted ? 'not-allowed' : 'pointer' }}
                      >
                        {safes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="sale-pay-credit-ph flex-1 flex items-center justify-end text-xs">
                        ائتمان العميل
                      </div>
                    )}
                    <div className="relative shrink-0" style={{ width: 94 }}>
                      <input
                        key={payRowKey}
                        ref={payAmountRef}
                        type="number"
                        min="0"
                        step="any"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmPayRow();
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        placeholder={cart.length > 0 ? payRemaining.toFixed(0) : '0'}
                        disabled={cart.length === 0}
                        className="sale-pay-amount disabled:opacity-40"
                        dir="ltr"
                      />
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none sale-muted-text">
                        ج.م
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={confirmPayRow}
                      disabled={cart.length === 0}
                      className="sale-pay-confirm shrink-0"
                    >
                      ↵ تأكيد
                    </button>
                    <button
                      onClick={fillPayRemaining}
                      disabled={cart.length === 0}
                      className="sale-pay-fill"
                    >
                      كل المتبقي {cart.length > 0 ? `(${formatCurrency(payRemaining)})` : ''}
                    </button>
                  </div>
                </div>
              )}

              {payCreditWarn && (
                <div
                  className="mx-2 mb-2 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: 'rgba(245,158,11,0.10)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    color: '#F59E0B',
                  }}
                >
                  ⚠ اختر العميل أولاً للبيع الآجل
                </div>
              )}
            </div>

            {checkoutError && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
                <p className="text-red-400 text-xs font-bold">❌ فشل التسجيل</p>
                <p className="text-red-300/70 text-xs mt-0.5">{checkoutError}</p>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={!canCheckout}
              className="w-full py-3.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: canCheckout
                  ? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
                  : undefined,
                color: canCheckout ? '#000' : undefined,
                boxShadow: canCheckout
                  ? '0 6px 22px rgba(245,158,11,0.38), 0 1px 3px rgba(0,0,0,0.2)'
                  : 'none',
                border: canCheckout ? 'none' : '1px solid rgba(255,255,255,0.08)',
                opacity: canCheckout ? 1 : 0.42,
              }}
            >
              {checkoutMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />{' '}
                  جارٍ التسجيل...
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4" /> إتمام البيع{' '}
                  <kbd className="text-[10px] font-bold opacity-60 bg-black/10 px-1.5 py-0.5 rounded">
                    F9
                  </kbd>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-4 text-[11px] sale-muted-text opacity-40 pb-0.5">
              <span>⌨ Ctrl+S حفظ</span>
              <span>·</span>
              <span>Enter إضافة</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes erp-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        .erp-shake { animation: erp-shake 0.35s ease; }
      `}</style>
    </>
  );
}
