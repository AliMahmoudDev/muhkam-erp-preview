import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { safeArray } from "@/lib/safe-data";
import { useCreatePurchase, useGetProducts, useGetCustomers, useCreateProduct, useGetSettingsSafes, useGetSettingsWarehouses, useGetCategories } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Search, Plus, Minus, Trash2, ShoppingBag, Package, User, Vault, CheckCircle, XCircle, ClipboardList, RotateCcw, AlertCircle, Eye, Printer, Receipt, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/skeletons";
import { SearchableSelect } from "@/components/searchable-select";
import { ProductFormModal, ProductFormData } from "@/components/product-form-modal";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { api } from '@/lib/api';
import { openPrintWindow } from '@/lib/print-utils';
import { useAppSettings } from "@/contexts/app-settings";


type PurchaseCurrency = "EGP" | "USD" | "CNY";

const CURRENCY_SYMBOLS: Record<PurchaseCurrency, string> = {
  EGP: "ج.م", USD: "$", CNY: "¥",
};

const CURRENCY_LABELS: Record<PurchaseCurrency, string> = {
  EGP: "جنيه مصري", USD: "دولار أمريكي", CNY: "يوان صيني",
};

/* ─── Minimal shape types for settings lists ─── */
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
function NewPurchasePanel({ onDone }: { onDone: () => void }) {
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
  const createMutation = useCreatePurchase();
  const createProductMutation = useCreateProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categoriesRaw } = useGetCategories();
  const categories = safeArray(categoriesRaw);

  // Scope: filter safes/warehouses for cashier/salesperson
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

  // Auto-set warehouse (scoped to user's warehouse for cashier/salesperson)
  useEffect(() => {
    if (filteredWarehouses.length > 0 && !warehouseId) setWarehouseId(String(filteredWarehouses[0].id));
  }, [filteredWarehouses, warehouseId]);

  // Auto-set safe for cashier/salesperson
  useEffect(() => {
    if (isScopedRole && user?.safe_id && !safeId) setSafeId(String(user.safe_id));
  }, [isScopedRole, user?.safe_id, safeId]);

  // Auto-fetch latest exchange rate when currency changes
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

    // للائتمان: تأكد من وجود مخزن ائتمان للمورد
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
    <div className="purch-row flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <span className="text-white/40 shrink-0">{icon}</span>
      <span className="text-white/40 text-xs w-14 shrink-0">{label}</span>
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
              <Search className="w-4 h-4 text-white/40 shrink-0" />
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                className="bg-transparent text-white outline-none text-sm w-full placeholder:text-white/30"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="bg-black/30 text-white/70 border border-white/10 rounded-xl px-3 py-1.5 text-sm outline-none appearance-none"
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
                  className="glass-panel rounded-2xl p-3 text-right transition-all hover:-translate-y-0.5 hover:border-amber-500/40">
                  <div className="h-14 bg-white/5 rounded-xl mb-3 flex items-center justify-center border border-white/5">
                    <Package className="w-6 h-6 text-white/30" />
                  </div>
                  <p className="font-bold text-white text-sm truncate">{product.name}</p>
                  {(product.category_name || product.category) && <p className="text-xs text-amber-400/70 mt-0.5">{product.category_name || product.category}</p>}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-blue-400 font-bold text-sm">{formatCurrency(product.cost_price)}</span>
                    <span className="text-xs text-white/40">{product.quantity}</span>
                  </div>
                </button>
              ))}

              {/* Inline create card — shows when search finds nothing */}
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
                    <p className="text-white/30 text-xs mt-0.5 truncate max-w-[120px]">«{search}»</p>
                  </div>
                </button>
              )}

              {/* Empty state when no search */}
              {!search && filteredProducts.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-white/25">
                  <Package className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">لا توجد منتجات — اذهب إلى قسم المنتجات لإضافتها</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* سلة الشراء */}
        <div className="w-full lg:w-[400px] flex flex-col glass-panel rounded-2xl overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-white flex items-center gap-2 text-base">
                <ShoppingBag className="w-5 h-5 text-amber-400" /> فاتورة مشتريات
              </h3>
              <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold">{cart.length} صنف</span>
            </div>

            {/* اختيار العملة */}
            <div className="flex gap-1 mb-2 flex-wrap">
              {(Object.keys(CURRENCY_SYMBOLS) as PurchaseCurrency[]).map(cur => (
                <button key={cur} onClick={() => setCurrency(cur)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all ${currency === cur ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}>
                  {CURRENCY_SYMBOLS[cur]} {cur}
                </button>
              ))}
            </div>

            {/* سعر الصرف */}
            {currency !== "EGP" && (
              <div className="purch-exchange-wrap flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 mb-2">
                <span className="text-blue-300 text-xs font-bold shrink-0">سعر الصرف:</span>
                <span className="text-blue-200/60 text-xs shrink-0">1 {currency} =</span>
                <input
                  type="number" step="0.01" min="0.01"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  className="bg-transparent text-blue-200 outline-none text-xs font-bold w-20 text-right"
                />
                <span className="text-blue-200/60 text-xs shrink-0">ج.م</span>
              </div>
            )}

            {/* تكلفة الشحن */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-2">
              <span className="text-amber-300 text-xs font-bold shrink-0">🚢 مصاريف الشحن:</span>
              <input
                type="number" step="0.01" min="0"
                value={shippingCost}
                onChange={e => setShippingCost(e.target.value)}
                className="bg-transparent text-amber-200 outline-none text-xs font-bold w-20 text-right flex-1"
                placeholder="0"
              />
              <span className="text-amber-200/60 text-xs shrink-0">
                {currency !== "EGP" ? currency : "ج.م"}
              </span>
              {currency !== "EGP" && shippingCostNum > 0 && (
                <span className="text-amber-200/40 text-xs">
                  = {formatCurrency(shippingCostNum * rate)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {selectRow("المخزن", <Vault className="w-3.5 h-3.5" />,
                <SearchableSelect
                  items={filteredWarehouses.map(w => ({ value: String(w.id), label: w.name, searchKeys: [w.name] }))}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  placeholder="-- مخزن --"
                  emptyLabel="-- مخزن --"
                  clearable={false}
                  className="w-full"
                  inputClassName="w-full"
                />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20 gap-3 py-10">
                <ShoppingBag className="w-12 h-12 opacity-30" />
                <p className="text-sm">اضغط على منتج لإضافته</p>
              </div>
            ) : cart.map(item => (
              <div key={item.product_id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-white text-sm flex-1 ml-2 truncate">{item.product_name}</p>
                  <button onClick={() => setCart(prev => prev.filter(i => i.product_id !== item.product_id))} className="text-red-400/70 hover:text-red-400 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => updateQty(item.product_id, -1)} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"><Minus className="w-3 h-3 text-white" /></button>
                    <span className="text-white font-bold text-sm w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, 1)} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"><Plus className="w-3 h-3 text-white" /></button>
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-white/30 text-xs shrink-0">×</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={item.unit_price}
                      onChange={e => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                      className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none w-full text-right"
                    />
                    <span className="text-white/30 text-xs shrink-0">{currSym}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-blue-400 text-sm">{currSym} {item.total_price.toFixed(2)}</div>
                    {currency !== "EGP" && <div className="text-xs text-white/30">{formatCurrency(item.total_price * rate)}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10 bg-black/40 space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              {selectRow("العميل / الطرف", <User className="w-3.5 h-3.5" />,
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
                <div className="text-xs text-blue-400/80 bg-blue-500/5 border border-blue-500/20 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  🔄 عميل-مورد — الفاتورة ستُسجَّل في حساب هذا العميل مباشرةً
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

            {/* زر الائتمان */}
            <button
              onClick={() => setIsConsignment(v => !v)}
              className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                isConsignment
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60'
              }`}
            >
              <span className="text-base leading-none">📦</span>
              {isConsignment ? "ائتمان مفعّل — البضاعة للعرض فقط" : "ائتمان (بضاعة أمانة)"}
            </button>

            {!isConsignment && (
              <div className="flex gap-1">
                {[{ v: "cash", l: "نقدي" }, { v: "credit", l: "آجل" }, { v: "partial", l: "جزئي" }].map(opt => (
                  <button key={opt.v} onClick={() => setPaymentType(opt.v as "cash" | "credit" | "partial")}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${paymentType === opt.v ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            )}

            {isConsignment && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 text-xs text-violet-300/90 space-y-1">
                <p className="font-bold">📋 فاتورة ائتمان</p>
                <p className="text-violet-300/60">البضاعة تُودَع في مخزن الائتمان الخاص بالمورد ولا تُحسب مبيعاً حتى تُباع. اختر المورد من الحقل أعلاه.</p>
              </div>
            )}

            {paymentType === "partial" && (
              <input type="number" step="0.01" placeholder="المبلغ المدفوع نقداً الآن..." className="glass-input text-xs py-2" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
            )}

            <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-1.5">
              {currency !== "EGP" && (
                <div className="flex justify-between text-xs border-b border-white/10 pb-1.5">
                  <span className="text-blue-300/80">الإجمالي بـ {CURRENCY_LABELS[currency]}</span>
                  <span className="font-bold text-blue-300">{currSym} {cartTotal.toFixed(2)}</span>
                </div>
              )}
              {shippingCostNum > 0 && (
                <div className="flex justify-between text-xs text-amber-300/80">
                  <span>🚢 مصاريف الشحن</span>
                  <span>+ {formatCurrency(shippingCostNum * rate)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/70 text-sm font-semibold">
                  {currency !== "EGP" ? `الإجمالي بالجنيه المصري` : "إجمالي الفاتورة"}
                </span>
                <span className="font-black text-white text-lg">{formatCurrency(egpTotal)}</span>
              </div>
              {paymentType === "cash" && (
                <div className="flex justify-between text-xs border-t border-white/10 pt-1.5">
                  <span className="text-white/60">يُخصم من الخزينة</span>
                  <span className="text-red-400 font-bold">− {formatCurrency(egpTotal)}</span>
                </div>
              )}
              {paymentType === "partial" && paidAmount && (
                <>
                  <div className="flex justify-between text-xs border-t border-white/10 pt-1.5">
                    <span className="text-white/60">نقدي من الخزينة</span>
                    <span className="text-red-400 font-bold">− {formatCurrency(parseFloat(paidAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">على حساب العميل</span>
                    <span className="text-orange-400 font-bold">− {formatCurrency(egpTotal - (parseFloat(paidAmount) || 0))}</span>
                  </div>
                </>
              )}
              {partyKey && customerImpact !== 0 && (
                <div className="flex justify-between text-xs border-t border-white/10 pt-1.5">
                  <span className="text-white/60">أثر على حساب {selectedParty?.name}</span>
                  <span className="text-orange-400 font-bold">{formatCurrency(Math.abs(customerImpact))} (علينا)</span>
                </div>
              )}
              {paymentType === "credit" && partyKey && (
                <p className="text-xs text-orange-400/80 bg-orange-500/5 border border-orange-500/20 rounded-lg px-2 py-1.5">
                  ⚠ الفاتورة ستُرحَّل على حساب الطرف الآخر — نحن المدينون
                </p>
              )}
            </div>

            <button onClick={handleCheckout} disabled={createMutation.isPending || cart.length === 0 || !canCreate}
              className="w-full btn-primary py-3 text-sm disabled:opacity-50 font-bold"
              title={!canCreate ? "ليس لديك صلاحية إنشاء فاتورة شراء" : undefined}>
              {createMutation.isPending ? "جاري التسجيل..." : "✦ تسجيل فاتورة الشراء"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── موديل تفاصيل فاتورة الشراء مع طباعة ─── */
interface PurchaseDetail {
  id: number; invoice_no: string; date: string | null; created_at: string;
  supplier_name: string | null; customer_name: string | null;
  payment_type: string; total_amount: number; paid_amount: number; remaining_amount: number;
  status: string; posting_status: string; notes: string | null; currency?: string; exchange_rate?: number;
  items: { id: number; product_name: string; quantity: number; unit_price: number; total_price: number }[];
}

function PurchaseDetailModal({ purchaseId, onClose }: { purchaseId: number; onClose: () => void }) {
  const { settings } = useAppSettings();
  const { data: purchase, isLoading } = useQuery<PurchaseDetail>({
    queryKey: ["/api/purchases", purchaseId],
    queryFn: () => authFetch(api(`/api/purchases/${purchaseId}`)).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  const payLabels: Record<string, string> = { cash: "نقدي", credit: "آجل", partial: "جزئي" };

  const handlePrint = () => {
    if (!purchase) return;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const itemsHtml = purchase.items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.product_name)}</td>
        <td>${it.quantity}</td>
        <td>${it.unit_price.toFixed(2)}</td>
        <td>${it.total_price.toFixed(2)}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>فاتورة شراء — ${esc(purchase.invoice_no)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,sans-serif;background:#fff;color:#111;padding:24px;font-size:13px}
  .header{text-align:center;border-bottom:2px solid #f59e0b;padding-bottom:14px;margin-bottom:18px}
  .company{font-size:22px;font-weight:900;color:#92400e}
  .title{font-size:16px;font-weight:700;color:#b45309;margin-top:6px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:16px;padding:12px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-label{font-size:10px;color:#92400e;font-weight:600;text-transform:uppercase}
  .meta-value{font-weight:700;color:#111;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
  thead{background:#92400e;color:#fff}
  th,td{padding:8px 10px;text-align:right}
  td{border-bottom:1px solid #e5e7eb}
  tbody tr:nth-child(even){background:#fffbeb}
  .totals{border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;background:#fffbeb}
  .total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
  .total-final{font-size:18px;font-weight:900;border-top:2px solid #b45309;padding-top:8px;margin-top:6px;color:#92400e}
  .footer{text-align:center;margin-top:20px;font-size:11px;color:#9ca3af;border-top:1px dashed #d1d5db;padding-top:12px}
  @media print{body{padding:10px}}
</style></head><body>
<div class="header">
  <div class="company">${esc(settings.companyName || "محكم")}</div>
  <div class="title">فاتورة مشتريات — ${esc(purchase.invoice_no)}</div>
</div>
<div class="meta">
  <div class="meta-item"><span class="meta-label">رقم الفاتورة</span><span class="meta-value">${esc(purchase.invoice_no)}</span></div>
  <div class="meta-item"><span class="meta-label">التاريخ</span><span class="meta-value">${purchase.date || new Date(purchase.created_at).toLocaleDateString("ar-EG")}</span></div>
  <div class="meta-item"><span class="meta-label">المورد</span><span class="meta-value">${esc(purchase.supplier_name || purchase.customer_name || "—")}</span></div>
  <div class="meta-item"><span class="meta-label">طريقة الدفع</span><span class="meta-value">${payLabels[purchase.payment_type] || purchase.payment_type}</span></div>
</div>
${purchase.notes ? `<p style="margin-bottom:12px;font-size:12px;color:#6b7280;font-style:italic">${esc(purchase.notes)}</p>` : ""}
<table>
  <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span>الإجمالي</span><span>${purchase.total_amount.toFixed(2)} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${purchase.paid_amount.toFixed(2)} ج.م</span></div>
  ${purchase.remaining_amount > 0 ? `<div class="total-row" style="color:#dc2626"><span>المتبقي</span><span>${purchase.remaining_amount.toFixed(2)} ج.م</span></div>` : ""}
  <div class="total-row total-final"><span>الإجمالي الكلي</span><span>${purchase.total_amount.toFixed(2)} ج.م</span></div>
</div>
<div class="footer">شكراً لتعاملكم معنا — ${esc(settings.companyName || "محكم")}</div>
</body></html>`;
    openPrintWindow(html, { width: 800, height: 900, delay: 500, autoClose: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-3xl p-6 w-full max-w-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" /> تفاصيل فاتورة الشراء
          </h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={isLoading || !purchase}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 transition-colors text-sm font-bold">
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton-shimmer h-8 rounded-xl" />)}
          </div>
        ) : !purchase ? (
          <div className="text-center py-12 text-white/40">لم يتم العثور على الفاتورة</div>
        ) : (
          <div className="space-y-5">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/8">
              <div><p className="text-white/40 text-xs mb-1">رقم الفاتورة</p><p className="text-amber-400 font-bold font-mono">{purchase.invoice_no}</p></div>
              <div><p className="text-white/40 text-xs mb-1">التاريخ</p><p className="text-white text-sm">{purchase.date || new Date(purchase.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p></div>
              <div><p className="text-white/40 text-xs mb-1">المورد / البائع</p><p className="text-white font-semibold text-sm">{purchase.supplier_name || purchase.customer_name || "—"}</p></div>
              <div><p className="text-white/40 text-xs mb-1">طريقة الدفع</p><p className="text-white text-sm">{payLabels[purchase.payment_type] || purchase.payment_type}</p></div>
              {purchase.notes && (
                <div className="col-span-2"><p className="text-white/40 text-xs mb-1">ملاحظات</p><p className="text-white/70 text-sm italic">{purchase.notes}</p></div>
              )}
            </div>

            {/* Items table */}
            <div>
              <h4 className="text-white font-bold mb-3 text-sm">أصناف الفاتورة</h4>
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <table className="w-full text-right text-sm">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="p-3 text-white/50 font-medium">#</th>
                      <th className="p-3 text-white/50 font-medium">الصنف</th>
                      <th className="p-3 text-white/50 font-medium">الكمية</th>
                      <th className="p-3 text-white/50 font-medium">سعر الوحدة</th>
                      <th className="p-3 text-white/50 font-medium">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item, i) => (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/3">
                        <td className="p-3 text-white/40">{i + 1}</td>
                        <td className="p-3 text-white font-medium">{item.product_name}</td>
                        <td className="p-3 text-white/70">{item.quantity}</td>
                        <td className="p-3 text-white/70">{formatCurrency(item.unit_price)}</td>
                        <td className="p-3 text-blue-400 font-bold">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white/5 rounded-2xl border border-white/8 p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-white/50">الإجمالي</span><span className="text-white font-bold">{formatCurrency(purchase.total_amount)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-white/50">المدفوع</span><span className="text-emerald-400 font-bold">{formatCurrency(purchase.paid_amount)}</span></div>
              {purchase.remaining_amount > 0 && (
                <div className="flex justify-between text-sm border-t border-white/10 pt-2">
                  <span className="text-red-400/80">المتبقي</span>
                  <span className="text-red-400 font-bold">{formatCurrency(purchase.remaining_amount)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── سجل الفواتير مع التحكم بالترحيل ─── */
interface PurchaseRecord {
  id: number; invoice_no: string; date: string | null;
  supplier_name: string | null; payment_type: string;
  total_amount: number; paid_amount: number; remaining_amount: number;
  posting_status: string; status: string;
  currency?: string; exchange_rate?: number;
}

function PostingBadge({ status }: { status: string }) {
  if (status === "posted")    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">مرحَّل</span>;
  if (status === "cancelled") return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">ملغى</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-medium">مسودة</span>;
}

function PurchaseHistoryPanel() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const canCancel = hasPermission(user, "can_cancel_purchase");
  const qc = useQueryClient();
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  const { data: purchases = [], isLoading } = useQuery<PurchaseRecord[]>({
    queryKey: ["/api/purchases"],
    queryFn: () => authFetch(api("/api/purchases")).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/purchases"] });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/purchases/${id}/post`), { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الترحيل"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "✅ تم ترحيل الفاتورة وإنشاء القيد المحاسبي" }); invalidate(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/purchases/${id}/cancel`), { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الإلغاء"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم إلغاء الفاتورة وإنشاء قيد عكسي" }); invalidate(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <>
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-3 font-medium">رقم الفاتورة</th>
                <th className="p-3 font-medium">العميل</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">نوع الدفع</th>
                <th className="p-3 font-medium">حالة الترحيل</th>
                <th className="p-3 font-medium">التاريخ</th>
                <th className="p-3 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton cols={7} rows={5} />
                : purchases.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-white/40">لا توجد فواتير بعد</td></tr>
                : purchases.map(p => (
                  <tr key={p.id} className="border-b border-white/5 erp-table-row">
                    <td className="p-3 font-mono text-amber-400">{p.invoice_no}</td>
                    <td className="p-3 font-bold text-white">{p.supplier_name || '—'}</td>
                    <td className="p-3 font-bold text-blue-400">
                      {formatCurrency(p.total_amount)}
                      {p.currency && p.currency !== "EGP" && (
                        <span className="mr-1 text-xs text-blue-300/60 font-normal">({p.currency} × {p.exchange_rate?.toFixed(2)})</span>
                      )}
                    </td>
                    <td className="p-3 text-white/60">{p.payment_type === "cash" ? "نقدي" : p.payment_type === "credit" ? "آجل" : "جزئي"}</td>
                    <td className="p-3"><PostingBadge status={p.posting_status} /></td>
                    <td className="p-3 text-white/50">{p.date || '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedPurchaseId(p.id)} title="عرض التفاصيل"
                          className="btn-icon text-white/50 hover:text-white hover:bg-white/10">
                          <Eye className="w-4 h-4" />
                        </button>
                        {p.posting_status === "draft" && (
                          <button onClick={() => postMutation.mutate(p.id)} disabled={postMutation.isPending} title="ترحيل"
                            className="btn-icon text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {p.posting_status === "posted" && canCancel && (
                          <button onClick={() => cancelMutation.mutate(p.id)} disabled={cancelMutation.isPending} title="إلغاء"
                            className="btn-icon text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/returns?q=${encodeURIComponent(p.invoice_no)}`)}
                          title="عرض مرتجعات هذه الفاتورة"
                          className="btn-icon text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPurchaseId && (
        <PurchaseDetailModal purchaseId={selectedPurchaseId} onClose={() => setSelectedPurchaseId(null)} />
      )}
    </>
  );
}

/* ─── مرتجعات المشتريات ─── */
interface PurchaseReturnRecord {
  id: number; return_no: string; date: string | null;
  supplier_name: string | null; refund_type: string;
  total_amount: number; reason: string | null; created_at: string;
}

interface PurchaseItem {
  id: number; product_id: number; product_name: string;
  quantity: number; unit_price: number; total_price: number;
}

interface ReturnCartItem {
  product_id: number; product_name: string;
  quantity: number; max_quantity: number;
  unit_price: number; total_price: number;
  original_purchase_item_id: number | null;
}

function PurchaseReturnsPanel() {
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw);
  const suppliers = customers.filter(c => c.is_supplier);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const qc = useQueryClient();
  const { toast } = useToast();

  // سجل المرتجعات
  const { data: returns = [], isLoading } = useQuery<PurchaseReturnRecord[]>({
    queryKey: ["/api/purchase-returns"],
    queryFn: () => authFetch(api("/api/purchase-returns")).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  // فواتير الشراء
  const { data: purchasesRaw = [] } = useQuery<{ id: number; invoice_no: string; supplier_name: string | null; posting_status: string }[]>({
    queryKey: ["/api/purchases"],
    queryFn: () => authFetch(api("/api/purchases")).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [purchaseId, setPurchaseId] = useState<string>("");
  const [cart, setCart] = useState<ReturnCartItem[]>([]);
  const [refundType, setRefundType] = useState<"cash" | "balance_credit">("balance_credit");
  const [safeId, setSafeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // بنود فاتورة الشراء المختارة
  const { data: purchaseItems = [] } = useQuery<PurchaseItem[]>({
    queryKey: ["/api/purchases", purchaseId, "items"],
    queryFn: async () => {
      if (!purchaseId) return [];
      const r = await authFetch(api(`/api/purchases/${purchaseId}`));
      if (!r.ok) return [];
      const j = await r.json();
      return safeArray(j.items ?? []);
    },
    enabled: !!purchaseId,
  });

  const purchaseItemIds = purchaseItems.map(i => i.id).join(",");

  // عند اختيار فاتورة: تحميل بنودها تلقائياً
  useEffect(() => {
    if (purchaseItems.length > 0) {
      setCart(purchaseItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        max_quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.unit_price * i.quantity,
        original_purchase_item_id: i.id,
      })));
    }
  }, [purchaseItemIds]);

  const postedPurchases = purchasesRaw.filter(p => p.posting_status === "posted");

  const total = cart.reduce((s, i) => s + i.total_price, 0);

  const updateQty = (idx: number, val: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const q = Math.max(0.01, Math.min(item.max_quantity, val));
      return { ...item, quantity: q, total_price: q * item.unit_price };
    }));
  };

  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setSupplierId(""); setPurchaseId(""); setCart([]);
    setRefundType("balance_credit"); setSafeId(""); setReason(""); setNotes("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cart.length) throw new Error("أضف أصناف المرتجع");
      if (refundType === "cash" && !safeId) throw new Error("اختر الخزينة للاسترداد النقدي");
      const supplier = suppliers.find(s => String(s.id) === supplierId);
      const body = {
        purchase_id: purchaseId ? parseInt(purchaseId) : null,
        customer_id: supplierId ? parseInt(supplierId) : null,
        customer_name: supplier?.name ?? null,
        supplier_name: supplier?.name ?? null,
        items: cart.map(i => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total_price: i.total_price,
          original_purchase_item_id: i.original_purchase_item_id,
        })),
        reason: reason || null,
        notes: notes || null,
        date,
        refund_type: refundType,
        safe_id: safeId ? parseInt(safeId) : null,
      };
      const r = await authFetch(api("/api/purchase-returns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "خطأ في تسجيل المرتجع");
      return j;
    },
    onSuccess: () => {
      toast({ title: "✅ تم تسجيل مرتجع الشراء — البضاعة عادت للمخزون" });
      qc.invalidateQueries({ queryKey: ["/api/purchase-returns"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* زر إضافة مرتجع */}
      <div className="flex justify-end">
        <button onClick={() => { resetForm(); setShowForm(v => !v); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${showForm ? "bg-white/10 text-white/60" : "btn-primary"}`}>
          <Plus className="w-4 h-4" /> مرتجع شراء جديد
        </button>
      </div>

      {/* نموذج المرتجع */}
      {showForm && (
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">تسجيل مرتجع شراء</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* اختيار المورد */}
            <div>
              <label className="block text-white/60 text-xs font-semibold mb-1">المورد</label>
              <select className="glass-input" value={supplierId} onChange={e => { setSupplierId(e.target.value); setPurchaseId(""); setCart([]); }}>
                <option value="">— اختر المورد —</option>
                {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </div>

            {/* اختيار فاتورة (اختياري) */}
            <div>
              <label className="block text-white/60 text-xs font-semibold mb-1">فاتورة الشراء (اختياري)</label>
              <select className="glass-input" value={purchaseId} onChange={e => { setPurchaseId(e.target.value); setCart([]); }}>
                <option value="">— بدون ربط بفاتورة —</option>
                {postedPurchases.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.invoice_no}{p.supplier_name ? ` — ${p.supplier_name}` : ""}</option>
                ))}
              </select>
              {purchaseId && purchaseItems.length === 0 && (
                <p className="text-white/40 text-xs mt-1">جاري تحميل بنود الفاتورة…</p>
              )}
            </div>

            {/* التاريخ */}
            <div>
              <label className="block text-white/60 text-xs font-semibold mb-1">التاريخ</label>
              <input type="date" className="glass-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>

            {/* نوع الاسترداد */}
            <div>
              <label className="block text-white/60 text-xs font-semibold mb-1">نوع الاسترداد</label>
              <div className="flex gap-2">
                {(["balance_credit", "cash"] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => setRefundType(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${refundType === t ? (t === "cash" ? "bg-green-500/20 border-green-500/50 text-green-400" : "bg-blue-500/20 border-blue-500/50 text-blue-400") : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}>
                    {t === "cash" ? "💵 نقدي" : "📒 قيد دائن"}
                  </button>
                ))}
              </div>
            </div>

            {/* الخزينة (للنقدي) */}
            {refundType === "cash" && (
              <div>
                <label className="block text-white/60 text-xs font-semibold mb-1">الخزينة *</label>
                <select className="glass-input" value={safeId} onChange={e => setSafeId(e.target.value)}>
                  <option value="">— اختر الخزينة —</option>
                  {safes.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* السبب */}
            <div>
              <label className="block text-white/60 text-xs font-semibold mb-1">السبب</label>
              <input type="text" className="glass-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: منتج تالف" />
            </div>
          </div>

          {/* بنود المرتجع */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs font-semibold">أصناف المرتجع</span>
              {cart.length > 0 && <span className="text-amber-400 font-bold text-sm">{formatCurrency(total)}</span>}
            </div>

            {cart.length === 0 ? (
              <div className="bg-white/3 border border-white/10 rounded-2xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm">
                  {purchaseId ? "جاري تحميل بنود الفاتورة…" : "اختر فاتورة لتحميل بنودها تلقائياً"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{item.product_name}</p>
                      <p className="text-white/40 text-xs">{formatCurrency(item.unit_price)} / وحدة</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => updateQty(idx, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <input type="number" min={0.01} max={item.max_quantity} step={0.01}
                        value={item.quantity}
                        onChange={e => updateQty(idx, parseFloat(e.target.value) || 0)}
                        className="w-16 text-center bg-white/10 border border-white/20 rounded-lg text-white text-sm py-1" />
                      <button type="button" onClick={() => updateQty(idx, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-amber-400 font-bold text-sm w-24 text-left shrink-0">{formatCurrency(item.total_price)}</span>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-white/60 text-xs font-semibold mb-1">ملاحظات</label>
            <input type="text" className="glass-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري" />
          </div>

          {/* أزرار */}
          <div className="flex gap-3 pt-2">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || cart.length === 0}
              className="flex-1 btn-primary py-3 font-bold disabled:opacity-50">
              {createMutation.isPending ? "جاري التسجيل…" : `✦ تسجيل المرتجع — ${formatCurrency(total)}`}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-6 btn-secondary py-3">إلغاء</button>
          </div>
        </div>
      )}

      {/* سجل المرتجعات */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span className="text-white font-bold text-sm">سجل مرتجعات المشتريات</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-white/80 whitespace-nowrap text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-3 font-medium">رقم المرتجع</th>
                <th className="p-3 font-medium">المورد</th>
                <th className="p-3 font-medium">الإجمالي</th>
                <th className="p-3 font-medium">نوع الاسترداد</th>
                <th className="p-3 font-medium">السبب</th>
                <th className="p-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableSkeleton cols={6} rows={4} />
                : returns.length === 0
                  ? <tr><td colSpan={6} className="p-8 text-center text-white/40">لا توجد مرتجعات بعد</td></tr>
                  : returns.map(r => (
                    <tr key={r.id} className="border-b border-white/5 erp-table-row">
                      <td className="p-3 font-mono text-amber-400">{r.return_no}</td>
                      <td className="p-3 font-bold text-white">{r.supplier_name || '—'}</td>
                      <td className="p-3 font-bold text-blue-400">{formatCurrency(r.total_amount)}</td>
                      <td className="p-3">
                        {r.refund_type === "cash"
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">نقدي</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">قيد دائن</span>}
                      </td>
                      <td className="p-3 text-white/60">{r.reason || '—'}</td>
                      <td className="p-3 text-white/50">{r.date || r.created_at?.slice(0, 10) || '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── الصفحة الرئيسية ─── */
export default function Purchases() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const urlTab = new URLSearchParams(searchStr).get('tab') as "new" | "history" | "returns" | null;
  const [tab, setTab] = useState<"new" | "history" | "returns">(urlTab ?? "new");

  const changeTab = (t: "new" | "history" | "returns") => {
    setTab(t);
    navigate(`?tab=${t}`, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
          <button onClick={() => changeTab("new")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${tab === "new" ? "bg-amber-500 text-black shadow" : "text-white/50 hover:text-white"}`}>
            فاتورة شراء
          </button>
          <button onClick={() => changeTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${tab === "history" ? "bg-amber-500 text-black shadow" : "text-white/50 hover:text-white"}`}>
            <ClipboardList className="w-3.5 h-3.5" /> سجل الفواتير
          </button>
          <button onClick={() => changeTab("returns")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${tab === "returns" ? "bg-amber-500 text-black shadow" : "text-white/50 hover:text-white"}`}>
            <RotateCcw className="w-3.5 h-3.5" /> المرتجعات
          </button>
        </div>
      </div>

      {tab === "new" ? <NewPurchasePanel onDone={() => {}} />
        : tab === "history" ? <PurchaseHistoryPanel />
        : <PurchaseReturnsPanel />}
    </div>
  );
}
