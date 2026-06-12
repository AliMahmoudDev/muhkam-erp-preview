import { useState, useMemo, useEffect } from "react";
import { safeArray } from "@/lib/safe-data";
import { useGetProducts, useGetCustomers, useGetSettingsSafes, useGetSettingsWarehouses, useGetCategories } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Search, Plus, Minus, Trash2, ShoppingBag, Package, User, Vault } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/searchable-select";
import { ProductFormModal, ProductFormData } from "@/components/product-form-modal";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { api } from '@/lib/api';

type PurchaseCurrency = "EGP" | "USD" | "CNY";

const CURRENCY_SYMBOLS: Record<PurchaseCurrency, string> = {
  EGP: "ج.م", USD: "$", CNY: "¥",
};

const CURRENCY_LABELS: Record<PurchaseCurrency, string> = {
  EGP: "جنيه مصري", USD: "دولار أمريكي", CNY: "يوان صيني",
};

interface Safe      { id: number; name: string; balance?: number | string }
interface Warehouse { id: number; name: string }
interface Customer  {
  id:            number;
  name:          string;
  customer_code?: string | null;
  balance?:      number | string | null;
  is_supplier?:  boolean;
}

interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/* ─── فاتورة شراء جديدة ─── */
export default function PurchaseFormModal({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const canCreate = hasPermission(user, "can_create_purchase");

  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray<Customer>(customersRaw);
  const suppliers = customers.filter(c => c.is_supplier);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray<Safe>(safesRaw);
  const { data: warehousesRaw } = useGetSettingsWarehouses();
  const warehouses = safeArray<Warehouse>(warehousesRaw);
  const createMutation = useMutation({
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      const r = await authFetch(api('/api/purchases'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const createProductMutation = useMutation({
    mutationFn: async ({ data }: { data: Record<string, unknown> }) => {
      const r = await authFetch(api('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'خطأ');
      return j;
    },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categoriesRaw } = useGetCategories();
  const categories = safeArray(categoriesRaw);

  const isScopedRole = user?.role === "cashier" || user?.role === "salesperson";
  const filteredSafes = isScopedRole && user?.safe_id
    ? safes.filter((s) => s.id === user.safe_id)
    : safes;
  const filteredWarehouses = isScopedRole && user?.warehouse_id
    ? warehouses.filter((w) => w.id === user.warehouse_id)
    : warehouses;

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentType, setPaymentType] = useState<"cash" | "credit" | "partial">("cash");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [partyKey, setPartyKey] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [safeId, setSafeId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [currency, setCurrency] = useState<PurchaseCurrency>("EGP");
  const [exchangeRate, setExchangeRate] = useState<string>("1");
  const [shippingCost, setShippingCost] = useState<string>("0");
  const [isConsignment, setIsConsignment] = useState(false);
  const [consignmentWarehouseId, setConsignmentWarehouseId] = useState<number | null>(null);

  useEffect(() => {
    if (filteredWarehouses.length > 0 && !warehouseId) setWarehouseId(String(filteredWarehouses[0].id));
  }, [filteredWarehouses, warehouseId]);

  useEffect(() => {
    if (isScopedRole && user?.safe_id && !safeId) setSafeId(String(user.safe_id));
  }, [isScopedRole, user?.safe_id, safeId]);

  useEffect(() => {
    if (currency === "EGP") { setExchangeRate("1"); return; }
    authFetch(api(`/api/exchange-rates/latest?currency=${currency}`))
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, number> | null) => {
        if (data && data[currency]) setExchangeRate(String(data[currency]));
      })
      .catch(() => {});
  }, [currency]);

  const filteredProducts = products.filter(p => {
    const matchS = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchC = !categoryFilter || p.category_name === categoryFilter || p.category === categoryFilter;
    return matchS && matchC;
  });

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.total_price, 0), [cart]);
  const rate = parseFloat(exchangeRate) || 1;
  const shippingCostNum = parseFloat(shippingCost) || 0;
  const egpTotal = useMemo(() => {
    const itemsTotal = currency === "EGP" ? cartTotal : cartTotal * rate;
    return itemsTotal + shippingCostNum * rate;
  }, [cartTotal, currency, rate, shippingCostNum]);
  const currSym = CURRENCY_SYMBOLS[currency];

  const partyItems = useMemo(() => {
    return suppliers.map(s => ({
      value: `c:${s.id}`,
      label: `${s.customer_code ? `[${s.customer_code}] ` : ""}${s.name}${Number(s.balance) !== 0 ? ` (رصيد: ${Number(s.balance).toFixed(0)})` : ""}`,
      searchKeys: [String(s.customer_code ?? ""), s.name],
      group: "العملاء (يُشترى منهم)",
    }));
  }, [suppliers]);

  const selectedParty = useMemo(() => {
    if (!partyKey) return null;
    if (partyKey.startsWith("c:")) {
      const id = parseInt(partyKey.slice(2));
      const c = customers.find(x => x.id === id);
      return c ? { type: "customer" as const, id: c.id, name: c.name, balance: Number(c.balance) } : null;
    }
    return null;
  }, [partyKey, customers]);

  const customerImpact = useMemo(() => {
    const cid = selectedParty?.type === "customer" ? selectedParty.id : parseInt(customerId);
    if (!cid) return 0;
    if (paymentType === "cash") return 0;
    if (paymentType === "credit") return -egpTotal;
    return -(egpTotal - (parseFloat(paidAmount) || 0));
  }, [selectedParty, customerId, paymentType, paidAmount, egpTotal]);

  const addToCart = (product: typeof products[0]) => {
    setCart(prev => {
      const ex = prev.find(i => i.product_id === product.id);
      if (ex) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price } : i);
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.cost_price, total_price: product.cost_price }];
    });
  };

  const updateQty = (pid: number, delta: number) => setCart(prev => prev.map(i => {
    if (i.product_id !== pid) return i;
    const newQ = Math.max(1, i.quantity + delta);
    return { ...i, quantity: newQ, total_price: newQ * i.unit_price };
  }));

  const updatePrice = (pid: number, price: number) => setCart(prev => prev.map(i =>
    i.product_id !== pid ? i : { ...i, unit_price: price, total_price: i.quantity * price }
  ));

  const handleCheckout = async () => {
    if (cart.length === 0) { toast({ title: "السلة فارغة", variant: "destructive" }); return; }
    if (isConsignment && !partyKey) {
      toast({ title: "يجب اختيار المورد لفاتورة الائتمان", variant: "destructive" }); return;
    }
    if (!isConsignment && (paymentType === "credit" || paymentType === "partial") && !partyKey) {
      toast({ title: "يجب اختيار الطرف الآخر للآجل أو الجزئي", variant: "destructive" }); return;
    }
    if (!isConsignment && (paymentType === "cash" || paymentType === "partial") && !safeId) {
      toast({ title: "يجب اختيار الخزينة للدفع النقدي", variant: "destructive" }); return;
    }

    const actualPaid = isConsignment ? 0 : (paymentType === "cash" ? egpTotal : paymentType === "credit" ? 0 : parseFloat(paidAmount) || 0);

    let finalCustomerId: number | null = null;
    let finalCustomerName: string | null = null;
    if (selectedParty?.type === "customer") {
      finalCustomerId = selectedParty.id;
      finalCustomerName = selectedParty.name;
    } else if (selectedParty?.type === "manual") {
      finalCustomerName = selectedParty.name;
    }

    let finalConsignmentWarehouseId: number | null = consignmentWarehouseId;
    if (isConsignment && selectedParty) {
      try {
        const whRes = await authFetch(api("/api/consignment/warehouses/ensure"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplier_name: selectedParty.name,
            supplier_id: selectedParty.type === "customer" ? selectedParty.id : undefined,
          }),
        });
        if (whRes.ok) {
          const wh = await whRes.json();
          finalConsignmentWarehouseId = wh.id;
          setConsignmentWarehouseId(wh.id);
        }
      } catch {
        toast({ title: "فشل إنشاء مخزن الائتمان", variant: "destructive" });
        return;
      }
    }

    const convertedItems = cart.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: currency === "EGP" ? item.unit_price : parseFloat((item.unit_price * rate).toFixed(4)),
      total_price: currency === "EGP" ? item.total_price : parseFloat((item.total_price * rate).toFixed(4)),
      unit_price_foreign: currency !== "EGP" ? item.unit_price : undefined,
    }));

    const effectivePaymentType = isConsignment ? "credit" : paymentType;
    const effectiveWarehouseId = isConsignment && finalConsignmentWarehouseId
      ? finalConsignmentWarehouseId
      : (warehouseId ? parseInt(warehouseId) : null);

    createMutation.mutate({
      data: {
        customer_id: finalCustomerId,
        customer_name: finalCustomerName,
        safe_id: isConsignment ? null : (safeId ? parseInt(safeId) : null),
        warehouse_id: effectiveWarehouseId,
        payment_type: effectivePaymentType,
        total_amount: egpTotal,
        paid_amount: actualPaid,
        currency,
        exchange_rate: rate,
        shipping_cost: shippingCostNum || undefined,
        is_consignment: isConsignment,
        consignment_warehouse_id: isConsignment ? finalConsignmentWarehouseId : null,
        items: convertedItems,
      }
    }, {
      onSuccess: () => {
        const msg = isConsignment
          ? "✅ تم تسجيل فاتورة الائتمان — البضاعة في مخزن الائتمان"
          : "✅ تم تسجيل فاتورة الشراء — تم تحديث المخزن والخزينة";
        toast({ title: msg });
        queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings/safes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/settings/warehouses"] });
        authFetch(api("/api/exchange-rates"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currency, rate, date: new Date().toISOString().split("T")[0] }),
        }).catch(() => {});
        setCart([]); setPaidAmount(""); setPartyKey(""); setCustomerId(""); setSafeId("");
        if (!isConsignment) setPaymentType("cash");
        setConsignmentWarehouseId(null);
        onDone();
      },
      onError: (e: Error) => toast({ title: e.message, variant: "destructive" })
    });
  };

  const handleCreateProduct = (data: ProductFormData) => {
    createProductMutation.mutate({ data }, {
      onSuccess: (newProduct: unknown) => {
        toast({ title: "✅ تم إضافة المنتج بنجاح" });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        setShowCreateProduct(false);
        setSearch("");
        const created = newProduct as { id?: number; cost_price?: unknown; sale_price?: unknown; quantity?: unknown } | null;
        if (created?.id) {
          addToCart({ ...created, cost_price: Number(created.cost_price), sale_price: Number(created.sale_price), quantity: Number(created.quantity) });
        }
      },
      onError: () => toast({ title: "حدث خطأ أثناء إضافة المنتج", variant: "destructive" }),
    });
  };

  const selectRow = (label: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div className="purch-row flex items-center gap-2 bg-surface border border-line rounded-xl px-3 py-2 focus-within:border-amber-500/50 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.12)] transition-all">
      <span className="text-ink/50 shrink-0">{icon}</span>
      <span className="text-ink/50 text-xs w-14 shrink-0 font-medium">{label}</span>
      {children}
    </div>
  );

  return (
    <>
      {showCreateProduct && (
        <ProductFormModal
          title="إضافة منتج جديد"
          onSave={handleCreateProduct}
          onClose={() => setShowCreateProduct(false)}
          isPending={createProductMutation.isPending}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-220px)]">
        {/* شبكة المنتجات */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="glass-panel rounded-2xl p-3 mb-3 shrink-0 flex flex-wrap gap-2 items-center">
            <div className="purch-search-wrap flex items-center gap-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-ink/40 shrink-0" />
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                className="bg-transparent text-ink outline-none text-sm w-full placeholder:text-ink/30"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="bg-black/30 text-ink/70 border border-line rounded-xl px-3 py-1.5 text-sm outline-none appearance-none"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="">كل الأصناف</option>
              {categories.map(cat => <option key={cat.id} value={cat.name} className="bg-gray-900">{cat.name}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto glass-panel rounded-2xl p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <button key={product.id} onClick={() => addToCart(product)}
                  className="group glass-panel rounded-2xl p-3 text-right transition-all hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-[0_10px_28px_rgba(245,158,11,0.14),0_2px_10px_rgba(0,0,0,0.2)]">
                  <div className="h-14 bg-surface rounded-xl mb-3 flex items-center justify-center border border-line group-hover:bg-amber-500/10 group-hover:border-amber-500/25 transition-all">
                    <Package className="w-6 h-6 text-ink/45 group-hover:text-amber-400/80 transition-colors" />
                  </div>
                  <p className="font-bold text-ink/92 text-sm truncate">{product.name}</p>
                  {(product.category_name || product.category) && <p className="text-xs text-amber-400/70 mt-0.5 truncate">{product.category_name || product.category}</p>}
                  <div className="flex justify-between items-center mt-2.5">
                    <span className="text-blue-300 font-black text-sm tabular-nums">{formatCurrency(product.cost_price)}</span>
                    <span className="text-[10px] text-ink/45 bg-surface px-1.5 py-0.5 rounded-md font-bold tabular-nums">{product.quantity}</span>
                  </div>
                  <div className="mt-2 py-1 rounded-lg text-[11px] font-black text-center opacity-0 group-hover:opacity-100 transition-opacity bg-amber-500/11 text-amber-400 border border-amber-500/20">
                    + أضف للفاتورة
                  </div>
                </button>
              ))}

              {search && filteredProducts.length === 0 && (
                <button
                  onClick={() => setShowCreateProduct(true)}
                  className="glass-panel rounded-2xl p-3 text-right border border-dashed border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/60 transition-all flex flex-col items-center justify-center gap-2 min-h-[110px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-violet-300 text-xs font-bold">إضافة منتج جديد</p>
                    <p className="text-ink/30 text-xs mt-0.5 truncate max-w-[120px]">«{search}»</p>
                  </div>
                </button>
              )}

              {!search && filteredProducts.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-ink/25">
                  <Package className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">لا توجد منتجات — اذهب إلى قسم المنتجات لإضافتها</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ سلة الشراء ═══ */}
        <div className="w-full lg:w-[380px] flex flex-col purch-cart-panel rounded-2xl overflow-hidden shrink-0">
          {/* ─── رأس لوحة الشراء (مدمج) ─── */}
          <div className="purch-cart-header px-3 pt-3 pb-2.5 shrink-0">
            {/* عنوان + عداد */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-ink flex items-center gap-1.5 text-sm">
                <ShoppingBag className="w-4 h-4 text-amber-400" /> فاتورة مشتريات
              </h3>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${cart.length > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-surface text-ink/30 border border-line'}`}>
                {cart.length} صنف
              </span>
            </div>

            {/* اختيار العملة */}
            <div className="flex gap-1 mb-1.5">
              {(Object.keys(CURRENCY_SYMBOLS) as PurchaseCurrency[]).map(cur => (
                <button key={cur} onClick={() => setCurrency(cur)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-all ${currency === cur ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-surface text-ink/35 border-line hover:bg-surface hover:text-ink/60'}`}>
                  {CURRENCY_SYMBOLS[cur]} {cur}
                </button>
              ))}
            </div>

            {/* المخزن + مصاريف الشحن في صف واحد */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5 bg-surface border border-line rounded-xl px-2.5 py-1.5 focus-within:border-amber-500/40 transition-all">
                <Vault className="w-3 h-3 text-ink/35 shrink-0" />
                <select
                  className="bg-transparent text-ink/80 outline-none text-[10px] w-full appearance-none font-bold truncate"
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                >
                  {filteredWarehouses.map(w => (
                    <option key={w.id} value={String(w.id)} className="bg-slate-900">{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 bg-surface border border-line rounded-xl px-2.5 py-1.5 focus-within:border-amber-500/40 transition-all">
                <span className="text-[11px] shrink-0">🚢</span>
                <input
                  type="number" step="0.01" min="0"
                  value={shippingCost}
                  onChange={e => setShippingCost(e.target.value)}
                  className="bg-transparent text-amber-200/80 outline-none text-[10px] font-bold w-full text-right"
                  placeholder="شحن 0"
                />
                <span className="text-ink/30 text-[10px] shrink-0">{currency !== "EGP" ? currency : "ج"}</span>
              </div>
            </div>

            {/* سعر الصرف — يظهر فقط عند عملة أجنبية */}
            {currency !== "EGP" && (
              <div className="mt-1.5 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-2.5 py-1.5">
                <span className="text-blue-300 text-[10px] font-bold shrink-0">صرف: 1 {currency} =</span>
                <input
                  type="number" step="0.01" min="0.01"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  className="bg-transparent text-blue-200 outline-none text-[10px] font-bold flex-1 text-right"
                />
                <span className="text-blue-200/50 text-[10px] shrink-0">ج.م</span>
              </div>
            )}
          </div>

          {/* ─── أصناف السلة ─── */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 cart-items-area">
            {cart.length === 0 ? (
              <div className="h-full min-h-[80px] flex flex-col items-center justify-center text-ink/20 gap-2 py-6">
                <ShoppingBag className="w-10 h-10 opacity-25" />
                <p className="text-xs font-bold">اضغط على منتج لإضافته</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product_id} className="pos-cart-item flex items-center gap-1.5 px-2.5 py-2 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-bold text-xs truncate leading-tight">{item.product_name}</p>
                  <p className="text-ink/40 text-[10px] tabular-nums">{item.unit_price.toFixed(2)} {currSym}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => updateQty(item.product_id, -1)} className="pos-qty-btn w-6 h-6 rounded-lg flex items-center justify-center">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-ink font-black text-xs w-5 text-center tabular-nums">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="pos-qty-btn pos-qty-btn-add w-6 h-6 rounded-lg flex items-center justify-center">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="shrink-0 w-[68px]">
                  <input
                    type="number" step="0.01" min="0"
                    value={item.unit_price}
                    onChange={e => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                    className="bg-surface border border-amber-500/25 rounded-lg px-1.5 py-1 text-[10px] text-amber-200 outline-none w-full text-right font-bold focus:border-amber-500/55 transition-colors"
                  />
                  <p className="text-blue-300 font-black text-[10px] text-right tabular-nums mt-0.5">
                    {item.total_price.toFixed(currency === "EGP" ? 0 : 2)}
                    {currency !== "EGP" && <span className="text-ink/30 text-[9px] mr-0.5">{currSym}</span>}
                  </p>
                </div>
                <button
                  onClick={() => setCart(prev => prev.filter(i => i.product_id !== item.product_id))}
                  className="pos-del-btn w-6 h-6 shrink-0 flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* ─── تذييل الدفع ─── */}
          <div className="purch-cart-footer p-3 space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              {selectRow("المورد / الطرف", <User className="w-3.5 h-3.5" />,
                <SearchableSelect
                  items={partyItems}
                  value={partyKey}
                  onChange={setPartyKey}
                  placeholder="ابحث باسم أو كود..."
                  emptyLabel="-- اختر الطرف --"
                  className="w-full min-w-0"
                  inputClassName="bg-transparent text-xs"
                />
              )}
              {selectedParty?.type === "customer" && (
                <div className="text-[10px] text-blue-400/80 bg-blue-500/5 border border-blue-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                  🔄 عميل-مورد — يُسجَّل في حسابه مباشرةً
                </div>
              )}
              {(paymentType === "cash" || paymentType === "partial") && (
                selectRow("الخزينة", <Vault className="w-3.5 h-3.5 text-amber-400/70" />,
                  <SearchableSelect
                    items={filteredSafes.map(s => ({ value: String(s.id), label: `${s.name} (${formatCurrency(Number(s.balance))})`, searchKeys: [s.name] }))}
                    value={safeId}
                    onChange={setSafeId}
                    placeholder="-- اختر الخزينة --"
                    emptyLabel="-- اختر الخزينة --"
                    className="w-full"
                    inputClassName="w-full"
                  />
                )
              )}
            </div>

            <button
              onClick={() => setIsConsignment(v => !v)}
              className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                isConsignment
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-surface text-ink/40 border-line hover:bg-surface hover:text-ink/60'
              }`}
            >
              <span className="text-base leading-none">📦</span>
              {isConsignment ? "ائتمان مفعّل — البضاعة للعرض فقط" : "ائتمان (بضاعة أمانة)"}
            </button>

            {!isConsignment && (
              <div className="flex gap-1">
                {[{ v: "cash", l: "نقدي" }, { v: "credit", l: "آجل" }, { v: "partial", l: "جزئي" }].map(opt => (
                  <button key={opt.v} onClick={() => setPaymentType(opt.v as "cash" | "credit" | "partial")}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${paymentType === opt.v ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-surface text-ink/50 border-line hover:bg-surface'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            )}

            {isConsignment && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 text-[10px] text-violet-300/90">
                <p className="font-bold">📋 ائتمان — البضاعة في مخزن المورد حتى تُباع</p>
              </div>
            )}

            {paymentType === "partial" && !isConsignment && (
              <input type="number" step="0.01" placeholder="المبلغ المدفوع نقداً الآن..." className="glass-input text-xs py-2" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            )}

            {/* إجمالي الفاتورة */}
            <div className="sale-total-box rounded-2xl overflow-hidden">
              <div className="px-3 py-2.5 space-y-1.5">
                {currency !== "EGP" && (
                  <div className="flex justify-between text-[10px] border-b border-line pb-1.5">
                    <span className="text-blue-300/80">إجمالي بـ {CURRENCY_LABELS[currency]}</span>
                    <span className="font-bold text-blue-300">{currSym} {cartTotal.toFixed(2)}</span>
                  </div>
                )}
                {shippingCostNum > 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-amber-300/80">🚢 مصاريف الشحن</span>
                    <span className="text-amber-300">+ {formatCurrency(shippingCostNum * rate)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-ink/70 text-sm font-semibold">
                    {currency !== "EGP" ? "الإجمالي بالجنيه" : "إجمالي الفاتورة"}
                  </span>
                  <span className="font-black text-ink text-lg tabular-nums">{formatCurrency(egpTotal)}</span>
                </div>
                {paymentType === "cash" && (
                  <div className="flex justify-between text-[10px] border-t border-line pt-1.5">
                    <span className="text-ink/60">يُخصم من الخزينة</span>
                    <span className="text-red-400 font-bold">− {formatCurrency(egpTotal)}</span>
                  </div>
                )}
                {paymentType === "partial" && paidAmount && (
                  <>
                    <div className="flex justify-between text-[10px] border-t border-line pt-1.5">
                      <span className="text-ink/60">نقدي من الخزينة</span>
                      <span className="text-red-400 font-bold">− {formatCurrency(parseFloat(paidAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-ink/60">على حساب العميل</span>
                      <span className="text-orange-400 font-bold">− {formatCurrency(egpTotal - (parseFloat(paidAmount) || 0))}</span>
                    </div>
                  </>
                )}
                {partyKey && customerImpact !== 0 && (
                  <div className="flex justify-between text-[10px] border-t border-line pt-1.5">
                    <span className="text-ink/60">أثر على حساب {selectedParty?.name}</span>
                    <span className="text-orange-400 font-bold">{formatCurrency(Math.abs(customerImpact))} (علينا)</span>
                  </div>
                )}
                {paymentType === "credit" && partyKey && (
                  <p className="text-[10px] text-orange-400/80 bg-orange-500/5 border border-orange-500/20 rounded-lg px-2 py-1.5">
                    ⚠ الفاتورة ستُرحَّل على حساب الطرف الآخر — نحن المدينون
                  </p>
                )}
              </div>
            </div>

            <button onClick={handleCheckout} disabled={createMutation.isPending || cart.length === 0 || !canCreate}
              className="w-full btn-primary py-3 text-sm disabled:opacity-50 font-bold rounded-2xl"
              title={!canCreate ? "ليس لديك صلاحية إنشاء فاتورة شراء" : undefined}>
              {createMutation.isPending ? "جاري التسجيل..." : "✦ تسجيل فاتورة الشراء"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
