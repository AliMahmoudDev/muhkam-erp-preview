import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { safeArray } from "@/lib/safe-data";
import { authFetch } from "@/lib/auth-fetch";
import { useGetSaleById, useGetProducts, useGetCustomers, useGetSettingsSafes, useCreateProduct, useGetCategories } from "@workspace/api-client-react";
import { ProductFormModal, ProductFormData } from "@/components/product-form-modal";
import { useWarehouse } from "@/contexts/warehouse";
import { formatCurrency, formatDate } from "@/lib/format";
import { Search, Plus, Minus, Trash2, X, Printer, ShoppingCart, User, Package, Receipt, RotateCcw, Percent, Vault, Lock, CheckCircle, XCircle, ClipboardList, Banknote, Coins, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { hasPermission } from "@/lib/permissions";
import { TableSkeleton } from "@/components/skeletons";
import { ConfirmModal } from "@/components/confirm-modal";
import { SearchableSelect } from "@/components/searchable-select";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

interface SalesReturn {
  id: number; return_no: string; customer_name: string | null;
  total_amount: number; reason: string | null; created_at: string;
  refund_type: string | null; safe_name: string | null; date: string | null;
}

interface InvoiceSummary {
  id: number; invoice_no: string; date: string | null;
  customer_name: string | null; customer_id: number | null;
  payment_type: string; total_amount: number; paid_amount: number;
  remaining_amount: number; safe_id: number | null; safe_name: string | null;
  status: string; posting_status: string;
}
interface InvoiceDetail extends InvoiceSummary {
  items: {
    id: number; product_id: number; product_name: string;
    quantity: number; unit_price: number; total_price: number;
    quantity_returned: number | null;
  }[];
}
interface ReturnLineItem {
  original_sale_item_id: number;
  product_id: number; product_name: string;
  returnQty: number; maxQty: number; unit_price: number;
}

function SalesReturnsPanel() {
  const { user: currentUser } = useAuth();
  const canCancelSale = hasPermission(currentUser, "can_cancel_sale") === true;
  const isAdmin = currentUser?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();

  type Phase = "list" | "select-invoice" | "return-form" | "standalone";
  const [phase, setPhase] = useState<Phase>("list");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");

  // ── Return form state ──
  const [returnItems, setReturnItems] = useState<ReturnLineItem[]>([]);
  const [refundType, setRefundType] = useState<"cash" | "credit">("credit");
  const [safeId, setSafeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);

  // ── Standalone (admin) form state ──
  const resetStandalone = () => setStandalone({ customer_id: "", reason: "", item_id: "", quantity: "1", refund_type: "credit", safe_id: "", date: new Date().toISOString().split("T")[0] });
  const [standalone, setStandalone] = useState({ customer_id: "", reason: "", item_id: "", quantity: "1", refund_type: "credit", safe_id: "", date: new Date().toISOString().split("T")[0] });

  // ── Data ──
  const { data: returns_ = [], isLoading } = useQuery<SalesReturn[]>({
    queryKey: ["/api/sales-returns"],
    queryFn: () => authFetch(api("/api/sales-returns")).then(r => { if (!r.ok) throw new Error("خطأ في جلب البيانات"); return r.json(); }),
  });
  // ── Debounced search for invoice selector ──
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    if (phase !== "select-invoice") return;
    const t = setTimeout(() => setDebouncedSearch(invoiceSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [invoiceSearch, phase]);
  const invoiceSearchUrl = debouncedSearch
    ? `/api/sales?sort=desc&limit=100&q=${encodeURIComponent(debouncedSearch)}`
    : `/api/sales?sort=desc&limit=40`;
  const { data: salesList = [], isFetching: salesFetching } = useQuery<InvoiceSummary[]>({
    queryKey: ["/api/sales/search", debouncedSearch, phase],
    queryFn: () => authFetch(api(invoiceSearchUrl)).then(r => {
      if (!r.ok) throw new Error("خطأ");
      return r.json().then((d: InvoiceSummary[] | { data: InvoiceSummary[] }) =>
        Array.isArray(d) ? d : (d as { data: InvoiceSummary[] }).data ?? []
      );
    }),
    enabled: phase === "select-invoice",
  });
  const { data: saleDetail } = useQuery<InvoiceDetail>({
    queryKey: ["/api/sales", selectedSaleId],
    queryFn: () => authFetch(api(`/api/sales/${selectedSaleId}`)).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
    enabled: !!selectedSaleId && phase === "return-form",
  });
  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw).filter(c => c.is_customer !== false);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);

  // ── When sale detail loads → init return items ──
  const saleDetailItemIds = saleDetail?.items?.map(i => i.id).join(",") ?? "";
  useEffect(() => {
    if (!saleDetail?.items?.length) return;
    const returnable = saleDetail.items
      .map(i => ({
        original_sale_item_id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        maxQty: i.quantity - (i.quantity_returned ?? 0),
        returnQty: i.quantity - (i.quantity_returned ?? 0),
        unit_price: i.unit_price,
      }))
      .filter(i => i.maxQty > 0);
    setReturnItems(returnable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleDetailItemIds]);

  // ── Invoice search results (server-side, no local filtering) ──
  const filteredSales = useMemo(
    () => safeArray(salesList).filter(s => s.status !== "cancelled"),
    [salesList]
  );

  // ── Totals ──
  const activeReturnItems = returnItems.filter(i => i.returnQty > 0);
  const returnTotal = activeReturnItems.reduce((s, i) => s + i.returnQty * i.unit_price, 0);
  const totalReturns = returns_.reduce((s, r) => s + r.total_amount, 0);

  // ── Invoice return limits (derived from item quantity_returned tracked by backend) ──
  const invoiceAlreadyReturned = saleDetail?.items
    ? saleDetail.items.reduce((s, i) => s + (i.quantity_returned ?? 0) * i.unit_price, 0)
    : 0;
  const invoiceReturnableRemaining = saleDetail
    ? saleDetail.total_amount - invoiceAlreadyReturned
    : 0;
  const isOverInvoiceLimit = saleDetail != null && returnTotal > invoiceReturnableRemaining + 0.01;

  // ── Standalone form helpers ──
  const standaloneProduct = products.find(p => String(p.id) === standalone.item_id);
  const standaloneCustomer = customers.find(c => String(c.id) === standalone.customer_id);
  const standaloneCustomerItems = useMemo(() =>
    customers.map(c => ({
      value: String(c.id),
      label: `${c.customer_code ? `[${c.customer_code}] ` : ""}${c.name}`,
      searchKeys: [String(c.customer_code ?? ""), c.name],
    })), [customers]
  );
  const standalonePrice = standaloneProduct ? Number(standaloneProduct.sale_price) : 0;
  const standaloneTotal = (parseInt(standalone.quantity) || 1) * standalonePrice;

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: object) => authFetch(api("/api/sales-returns"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-returns"] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (selectedSaleId) qc.invalidateQueries({ queryKey: ["/api/sales", selectedSaleId] });
      setPhase("list");
      setSelectedSaleId(null);
      setReturnItems([]);
      resetStandalone();
      toast({ title: "✅ تم تسجيل المرتجع — البضاعة عادت للمخزون" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(api(`/api/sales-returns/${id}`), { method: "DELETE" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-returns"] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      qc.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      toast({ title: "تم الحذف وعكس جميع الحركات" });
    },
  });

  // ── Submit invoice-based return ──
  const handleSubmitReturn = () => {
    if (!activeReturnItems.length) { toast({ title: "حدد كمية إرجاع على الأقل لصنف واحد", variant: "destructive" }); return; }
    if (isOverInvoiceLimit) { toast({ title: "لا يمكن إرجاع أكثر من قيمة الفاتورة المتاحة للإرجاع", variant: "destructive" }); return; }
    if (refundType === "cash" && !safeId) { toast({ title: "اختر الخزينة للاسترداد النقدي", variant: "destructive" }); return; }
    createMutation.mutate({
      sale_id: selectedSaleId,
      customer_id: saleDetail?.customer_id ?? null,
      customer_name: saleDetail?.customer_name ?? null,
      reason: reason || null,
      refund_type: refundType,
      safe_id: refundType === "cash" ? parseInt(safeId) : null,
      date: returnDate,
      items: activeReturnItems.map(i => ({
        original_sale_item_id: i.original_sale_item_id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.returnQty,
        unit_price: i.unit_price,
        total_price: i.returnQty * i.unit_price,
      })),
    });
  };

  // ── Submit standalone return (admin) ──
  const handleStandaloneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!standalone.item_id) { toast({ title: "اختر الصنف المرتجع", variant: "destructive" }); return; }
    if (standalone.refund_type === "cash" && !standalone.safe_id) { toast({ title: "اختر الخزينة", variant: "destructive" }); return; }
    const qty = parseInt(standalone.quantity) || 1;
    createMutation.mutate({
      customer_id: standalone.customer_id ? parseInt(standalone.customer_id) : null,
      customer_name: standaloneCustomer?.name ?? null,
      reason: standalone.reason || null,
      refund_type: standalone.refund_type,
      safe_id: standalone.refund_type === "cash" ? parseInt(standalone.safe_id) : null,
      date: standalone.date,
      items: [{ product_id: parseInt(standalone.item_id), product_name: standaloneProduct?.name ?? "", quantity: qty, unit_price: standalonePrice, total_price: qty * standalonePrice }],
    });
  };

  // ── Payment type helpers ──
  const ptLabel = (pt: string) => pt === "cash" ? { label: "نقدي", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" } : pt === "credit" ? { label: "آجل", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" } : { label: "جزئي", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" };

  const updateReturnQty = (idx: number, val: number) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const q = Math.max(0, Math.min(item.maxQty, isNaN(val) ? 0 : val));
      return { ...item, returnQty: q };
    }));
  };

  return (
    <div className="space-y-4">
      {confirmDeleteId !== null && (
        <ConfirmModal
          title="حذف مرتجع مبيعات"
          description="سيتم حذف المرتجع وعكس تأثيره على رصيد العميل والمخزون نهائياً."
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) })}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex gap-3 items-center justify-between flex-wrap">
        {totalReturns > 0 && (
          <div className="glass-panel rounded-2xl px-5 py-2 border border-orange-500/20 bg-orange-500/5 text-sm">
            إجمالي المرتجعات: <span className="text-orange-400 font-black">{formatCurrency(totalReturns)}</span>
          </div>
        )}
        <div className="flex gap-2 mr-auto items-center">
          {isAdmin && (
            <button onClick={() => { resetStandalone(); setPhase("standalone"); }}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-white/15 text-white/40 hover:text-white/60 hover:border-white/25 transition-all">
              مرتجع مستقل
            </button>
          )}
          <button onClick={() => { setInvoiceSearch(""); setPhase("select-invoice"); }}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> مرتجع جديد
          </button>
        </div>
      </div>

      {/* ══ PHASE: select-invoice ══ */}
      {phase === "select-invoice" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">اختر الفاتورة المراد إرجاعها</h3>
                <p className="text-white/40 text-xs mt-0.5">ابحث بالرقم أو اسم العميل</p>
              </div>
              <button onClick={() => setPhase("list")} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="p-4 border-b border-white/10 shrink-0">
              <div className="relative">
                <Search className={`w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${salesFetching ? "text-amber-400 animate-pulse" : "text-white/30"}`} />
                <input autoFocus type="text" className="glass-input pr-9 w-full"
                  placeholder="رقم الفاتورة / اسم العميل / رمز العميل..."
                  value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} />
                {invoiceSearch && (
                  <button onClick={() => setInvoiceSearch("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!invoiceSearch && (
                <p className="text-white/30 text-xs mt-2 text-center">آخر 40 فاتورة — ابحث للعثور على المزيد</p>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {salesFetching && filteredSales.length === 0 ? (
                <div className="p-10 text-center text-white/40">جاري البحث…</div>
              ) : filteredSales.length === 0 ? (
                <div className="p-10 text-center text-white/40">لا توجد نتائج</div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="p-3 text-white/50 font-medium">رقم الفاتورة</th>
                      <th className="p-3 text-white/50 font-medium">العميل</th>
                      <th className="p-3 text-white/50 font-medium">نوع الدفع</th>
                      <th className="p-3 text-white/50 font-medium">التاريخ</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(sale => {
                      const pt = ptLabel(sale.payment_type);
                      return (
                        <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedSaleId(sale.id);
                            setRefundType(sale.payment_type === "cash" ? "cash" : "credit");
                            setSafeId(sale.safe_id ? String(sale.safe_id) : "");
                            setReason("");
                            setReturnDate(new Date().toISOString().split("T")[0]);
                            setReturnItems([]);
                            setPhase("return-form");
                          }}>
                          <td className="p-3 font-mono font-bold text-amber-400">{sale.invoice_no}</td>
                          <td className="p-3 text-white">{sale.customer_name || <span className="text-white/30">نقدي</span>}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${pt.cls}`}>{pt.label}</span></td>
                          <td className="p-3 text-white/40 text-xs">{sale.date || "—"}</td>
                          <td className="p-3">
                            <button className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ PHASE: return-form ══ */}
      {phase === "return-form" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
          <div className="glass-panel rounded-3xl w-full max-w-xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => { setPhase("select-invoice"); setSelectedSaleId(null); setReturnItems([]); }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div>
                  <p className="text-white/50 text-xs">مرتجع من فاتورة</p>
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {saleDetail ? saleDetail.invoice_no : "جاري التحميل..."}
                  </h3>
                </div>
              </div>
              {saleDetail && (
                <div className="text-left">
                  <p className="text-white/40 text-xs">{saleDetail.customer_name || "نقدي"}</p>
                  <p className="text-amber-400 font-bold text-sm">{formatCurrency(saleDetail.total_amount)}</p>
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Loading state */}
              {!saleDetail && (
                <div className="py-8 text-center text-white/40 text-sm">جاري تحميل بنود الفاتورة…</div>
              )}

              {/* All items already returned */}
              {saleDetail && returnItems.length === 0 && (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-500/40 mx-auto" />
                  <p className="text-white/40 text-sm">جميع أصناف هذه الفاتورة تم إرجاعها بالكامل</p>
                </div>
              )}

              {/* Items list */}
              {returnItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/50 text-xs font-semibold">أصناف الفاتورة</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setReturnItems(prev => prev.map(i => ({ ...i, returnQty: i.maxQty })))}
                        className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors font-bold">إرجاع الكل</button>
                      <span className="text-white/20">|</span>
                      <button type="button" onClick={() => setReturnItems(prev => prev.map(i => ({ ...i, returnQty: 0 })))}
                        className="text-xs text-white/30 hover:text-white/50 transition-colors">إلغاء الكل</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {returnItems.map((item, idx) => (
                      <div key={item.original_sale_item_id}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all ${item.returnQty > 0 ? "bg-orange-500/8 border-orange-500/20" : "bg-white/3 border-white/8"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{item.product_name}</p>
                          <p className="text-white/40 text-xs">{formatCurrency(item.unit_price)} × {item.maxQty} ← {item.maxQty !== (saleDetail?.items?.find(i => i.id === item.original_sale_item_id)?.quantity ?? item.maxQty) ? `متبقي` : `الكمية المباعة`}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => updateReturnQty(idx, item.returnQty - 1)}
                            className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center">
                            <Minus className="w-3 h-3" />
                          </button>
                          <input type="number" min={0} max={item.maxQty} step={1}
                            value={item.returnQty}
                            onChange={e => updateReturnQty(idx, parseFloat(e.target.value))}
                            className="w-14 text-center bg-white/10 border border-white/20 rounded-lg text-white text-sm py-1 font-bold" />
                          <button type="button" onClick={() => updateReturnQty(idx, item.returnQty + 1)}
                            className="w-7 h-7 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 flex items-center justify-center">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className={`text-sm font-bold w-20 text-left shrink-0 tabular-nums ${item.returnQty > 0 ? "text-orange-400" : "text-white/20"}`}>
                          {formatCurrency(item.returnQty * item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refund type — shown when items exist */}
              {returnItems.length > 0 && saleDetail && (
                <>
                  <div>
                    <label className="text-white/50 text-xs font-semibold block mb-2">نوع الاسترداد</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setRefundType("credit")}
                        className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${refundType === "credit" ? "bg-blue-500/25 border-blue-500/50 text-blue-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}>
                        📒 خصم رصيد العميل
                      </button>
                      <button type="button"
                        onClick={() => setRefundType("cash")}
                        className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${refundType === "cash" ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}>
                        💵 استرداد نقدي
                      </button>
                    </div>
                    {saleDetail.payment_type === "cash" && refundType === "credit" && (
                      <p className="text-amber-400/70 text-xs mt-1.5">⚠ الفاتورة الأصلية نقدية — يُنصح بالاسترداد نقدياً</p>
                    )}
                    {saleDetail.payment_type === "credit" && refundType === "cash" && (
                      <p className="text-blue-400/70 text-xs mt-1.5">⚠ الفاتورة الأصلية آجل — يُنصح بخصم الرصيد</p>
                    )}
                  </div>

                  {refundType === "cash" && (
                    <div>
                      <label className="text-white/50 text-xs font-semibold block mb-1">الخزينة الصارفة *</label>
                      <select className="glass-input w-full appearance-none" value={safeId} onChange={e => setSafeId(e.target.value)}>
                        <option value="" className="bg-gray-900">— اختر خزينة —</option>
                        {safes.map(s => <option key={s.id} value={String(s.id)} className="bg-gray-900">{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/50 text-xs font-semibold block mb-1">التاريخ</label>
                      <input type="date" className="glass-input" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-white/50 text-xs font-semibold block mb-1">سبب الإرجاع</label>
                      <input type="text" className="glass-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="عيب مصنعي..." />
                    </div>
                  </div>

                  {/* Invoice return limits summary */}
                  {saleDetail && invoiceAlreadyReturned > 0 && (
                    <div className="bg-white/3 border border-white/8 rounded-xl px-3 py-2 text-xs space-y-1">
                      <div className="flex justify-between text-white/40">
                        <span>تم إرجاعه سابقاً</span>
                        <span className="tabular-nums">{formatCurrency(invoiceAlreadyReturned)}</span>
                      </div>
                      <div className="flex justify-between text-white/55 font-bold">
                        <span>الحد الأقصى المتاح</span>
                        <span className="tabular-nums text-amber-400/80">{formatCurrency(invoiceReturnableRemaining)}</span>
                      </div>
                    </div>
                  )}

                  {activeReturnItems.length > 0 && (
                    <div className={`rounded-2xl px-4 py-3 flex justify-between items-center border transition-all ${
                      isOverInvoiceLimit
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-orange-500/10 border-orange-500/25"
                    }`}>
                      <div>
                        <span className={`text-sm font-bold ${isOverInvoiceLimit ? "text-red-400" : "text-white/60"}`}>
                          إجمالي المرتجع ({activeReturnItems.length} صنف)
                        </span>
                        {isOverInvoiceLimit && (
                          <p className="text-red-400 text-xs mt-0.5">⚠ يتجاوز الحد المسموح به</p>
                        )}
                      </div>
                      <span className={`font-black text-lg tabular-nums ${isOverInvoiceLimit ? "text-red-400" : "text-orange-400"}`}>
                        {formatCurrency(returnTotal)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer buttons */}
            {returnItems.length > 0 && saleDetail && (
              <div className="p-5 border-t border-white/10 shrink-0 flex gap-3">
                <button onClick={handleSubmitReturn}
                  disabled={createMutation.isPending || activeReturnItems.length === 0 || isOverInvoiceLimit}
                  className={`flex-1 py-3 font-bold disabled:opacity-40 rounded-xl transition-all ${isOverInvoiceLimit ? "bg-red-500/20 border border-red-500/30 text-red-400 cursor-not-allowed" : "btn-primary"}`}>
                  {createMutation.isPending ? "جاري التسجيل…" : isOverInvoiceLimit ? "⚠ تجاوز حد الإرجاع" : `✦ تسجيل المرتجع${returnTotal > 0 ? ` — ${formatCurrency(returnTotal)}` : ""}`}
                </button>
                <button onClick={() => { setPhase("list"); setSelectedSaleId(null); setReturnItems([]); }}
                  className="px-5 btn-secondary py-3">إلغاء</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ PHASE: standalone (admin only) ══ */}
      {phase === "standalone" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay">
          <form onSubmit={handleStandaloneSubmit} className="glass-panel rounded-3xl p-7 w-full max-w-md border border-white/10 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">مرتجع مستقل</h3>
                <p className="text-white/40 text-xs mt-0.5">مقتصر على المسؤول — بدون ربط بفاتورة</p>
              </div>
              <button type="button" onClick={() => setPhase("list")} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["credit", "cash"] as const).map(t => (
                <button key={t} type="button" onClick={() => setStandalone(f => ({ ...f, refund_type: t, safe_id: "" }))}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold border transition-all ${standalone.refund_type === t ? (t === "cash" ? "bg-emerald-500/30 border-emerald-500/60 text-emerald-300" : "bg-blue-500/30 border-blue-500/60 text-blue-300") : "bg-white/5 border-white/10 text-white/50"}`}>
                  {t === "cash" ? "استرداد نقدي" : "خصم رصيد"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">العميل</label>
              <SearchableSelect items={standaloneCustomerItems} value={standalone.customer_id}
                onChange={v => setStandalone(f => ({ ...f, customer_id: v }))}
                placeholder="ابحث باسم أو كود..." emptyLabel="-- نقدي --" />
            </div>
            {standalone.refund_type === "cash" && (
              <div>
                <label className="text-white/60 text-xs mb-1 block">الخزينة *</label>
                <select required className="glass-input w-full appearance-none" value={standalone.safe_id}
                  onChange={e => setStandalone(f => ({ ...f, safe_id: e.target.value }))}>
                  <option value="" className="bg-gray-900">-- اختر خزينة --</option>
                  {safes.map(s => <option key={s.id} value={String(s.id)} className="bg-gray-900">{s.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-white/60 text-xs mb-1 block">الصنف *</label>
              <select required className="glass-input w-full appearance-none" value={standalone.item_id}
                onChange={e => setStandalone(f => ({ ...f, item_id: e.target.value }))}>
                <option value="" className="bg-gray-900">-- اختر صنف --</option>
                {products.map(p => <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">الكمية</label>
                <input type="number" min="1" className="glass-input" value={standalone.quantity}
                  onChange={e => setStandalone(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">سعر الوحدة</label>
                <div className="glass-input opacity-70 cursor-not-allowed">
                  <span className="text-emerald-400 font-bold">{standaloneProduct ? formatCurrency(standalonePrice) : "—"}</span>
                </div>
              </div>
            </div>
            {standaloneTotal > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2 flex justify-between">
                <span className="text-white/60 text-sm">الإجمالي</span>
                <span className="text-orange-400 font-bold">{formatCurrency(standaloneTotal)}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1 block">التاريخ</label>
                <input type="date" className="glass-input" value={standalone.date}
                  onChange={e => setStandalone(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">السبب</label>
                <input type="text" className="glass-input" value={standalone.reason}
                  onChange={e => setStandalone(f => ({ ...f, reason: e.target.value }))} placeholder="اختياري..." />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={createMutation.isPending} className="flex-1 btn-primary py-3">
                {createMutation.isPending ? "جاري الحفظ..." : "تسجيل المرتجع"}
              </button>
              <button type="button" onClick={() => setPhase("list")} className="flex-1 btn-secondary py-3">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* ── History table ── */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="p-4 text-white/60">رقم المرتجع</th>
                <th className="p-4 text-white/60">العميل</th>
                <th className="p-4 text-white/60">الإجمالي</th>
                <th className="p-4 text-white/60">نوع الاسترداد</th>
                <th className="p-4 text-white/60">السبب</th>
                <th className="p-4 text-white/60">التاريخ</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={7} rows={5} />
              ) : returns_.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-white/40">لا توجد مرتجعات</td></tr>
              ) : returns_.map(r => (
                <tr key={r.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-4 font-bold text-amber-400 font-mono">{r.return_no}</td>
                  <td className="p-4 text-white">{r.customer_name || "عميل نقدي"}</td>
                  <td className="p-4 font-bold text-orange-400">{formatCurrency(r.total_amount)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${r.refund_type === "cash" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
                      {r.refund_type === "cash" ? `نقدي — ${r.safe_name || ""}` : "خصم رصيد"}
                    </span>
                  </td>
                  <td className="p-4 text-white/50">{r.reason || "—"}</td>
                  <td className="p-4 text-white/40 text-xs">{r.date || formatDate(r.created_at)}</td>
                  <td className="p-4">{canCancelSale && <button onClick={() => setConfirmDeleteId(r.id)} className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    partial: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    unpaid: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const labels: Record<string, string> = { paid: "مدفوع", partial: "جزئي", unpaid: "غير مدفوع" };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${map[status] || map.unpaid}`}>
      {labels[status] || status}
    </span>
  );
}

function PaymentBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    cash: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    credit: "bg-red-500/20 text-red-400 border-red-500/30",
    partial: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };
  const labels: Record<string, string> = { cash: "نقدي", credit: "آجل", partial: "جزئي" };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${map[type] || ''}`}>
      {labels[type] || type}
    </span>
  );
}

function SaleDetailModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  const { data: sale, isLoading } = useGetSaleById(saleId);

  const escHtml = (v: unknown): string => {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  };

  const handlePrint = () => {
    if (!sale) return;
    const payLabel: Record<string, string> = { cash: 'نقدي', credit: 'آجل', partial: 'جزئي' };
    const s = sale as any;
    const itemsHtml = (sale.items || []).map((item, i) =>
      `<tr><td>${i+1}</td><td><strong>${escHtml(item.product_name)}</strong></td><td>${Number(item.quantity)}</td><td>${Number(item.unit_price).toFixed(2)} ج.م</td><td>${(s as any)?.tax_rate != null ? `${Number((s as any).tax_rate).toFixed(0)}%` : "—"}</td><td><strong>${Number(item.total_price).toFixed(2)} ج.م</strong></td></tr>`
    ).join("");
    const taxAmount = Number(s.tax_amount ?? 0);
    const subtotal = Number(sale.total_amount) - taxAmount + Number(s.discount_amount ?? 0);
    const vatHtml = taxAmount > 0 ? `
      <div class="total-row"><span>المجموع قبل الضريبة</span><span>${subtotal.toFixed(2)} ج.م</span></div>
      <div class="total-row" style="color:#c05621;background:#fff8e1;padding:6px 8px;border-radius:4px;font-weight:700"><span>ضريبة القيمة المضافة (${Number(s.tax_rate ?? 14).toFixed(0)}%)</span><span>${taxAmount.toFixed(2)} ج.م</span></div>` : "";
    const discountHtml = Number(s.discount_amount) > 0 ? `
      <div class="total-row"><span>الخصم (${Number(s.discount_percent)}%)</span><span>- ${Number(s.discount_amount).toFixed(2)} ج.م</span></div>` : "";
    const remainHtml = Number(sale.remaining_amount) > 0 ?
      `<div class="total-row" style="color:red"><span>المتبقي</span><span><strong>${Number(sale.remaining_amount).toFixed(2)} ج.م</strong></span></div>` : "";
    const extraMeta = [
      s.warehouse_name ? `<div class="meta-item"><span class="meta-label">المخزن:</span><span class="meta-value">${escHtml(s.warehouse_name)}</span></div>` : "",
      s.salesperson_name ? `<div class="meta-item"><span class="meta-label">المندوب:</span><span class="meta-value">${escHtml(s.salesperson_name)}</span></div>` : "",
    ].join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><title>فاتورة ${sale.invoice_no}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#111;background:#fff;padding:24px;direction:rtl}
  .header{text-align:center;border-bottom:3px double #333;padding-bottom:14px;margin-bottom:16px}
  .company-name{font-size:28px;font-weight:900;letter-spacing:2px}
  .company-slogan{font-size:13px;color:#666;margin:4px 0}
  .company-info{font-size:12px;color:#555;margin-top:6px}
  .invoice-title{text-align:center;font-size:19px;font-weight:bold;margin:14px 0;background:#f3f3f3;padding:9px;border-radius:6px}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:16px;font-size:13px}
  .meta-item{display:flex;gap:6px}
  .meta-label{color:#777;font-weight:600;min-width:80px}
  .meta-value{font-weight:bold;color:#111}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px}
  thead{background:#222;color:#fff}
  th,td{padding:9px 10px;text-align:right}
  td{border-bottom:1px solid #e8e8e8}
  tbody tr:nth-child(even){background:#f7f7f7}
  .totals{border:2px solid #333;border-radius:6px;padding:12px 16px;font-size:13px}
  .total-row{display:flex;justify-content:space-between;padding:4px 0}
  .total-final{font-size:18px;font-weight:900;border-top:2px solid #333;padding-top:8px;margin-top:6px}
  .footer{text-align:center;margin-top:24px;font-size:12px;color:#999;border-top:1px dashed #ccc;padding-top:12px}
  @media print{body{padding:10px}}
</style></head>
<body>
<div class="header">
  <div class="company-name">مُحكم - MUHKAM ERP</div>
  <div class="company-slogan">الحلال = البركة | متخصصون في صيانة الهواتف المحمولة</div>
  <div class="company-info">📍 مصر — القاهرة &nbsp;&nbsp; 📞 01000000000</div>
</div>
<div class="invoice-title">فاتورة مبيعات — ${escHtml(sale.invoice_no)}</div>
<div class="meta-grid">
  <div class="meta-item"><span class="meta-label">رقم الفاتورة:</span><span class="meta-value">${escHtml(sale.invoice_no)}</span></div>
  <div class="meta-item"><span class="meta-label">التاريخ:</span><span class="meta-value">${escHtml(formatDate(sale.created_at))}</span></div>
  <div class="meta-item"><span class="meta-label">العميل:</span><span class="meta-value">${escHtml(sale.customer_name) || 'عميل نقدي'}</span></div>
  <div class="meta-item"><span class="meta-label">طريقة الدفع:</span><span class="meta-value">${escHtml(payLabel[sale.payment_type] || sale.payment_type)}</span></div>
  ${extraMeta}
</div>
<table>
  <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>ضريبة%</th><th>الإجمالي</th></tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  ${discountHtml}
  ${vatHtml}
  <div class="total-row total-final"><span>الإجمالي الكلي</span><span>${Number(sale.total_amount).toFixed(2)} ج.م</span></div>
  <div class="total-row"><span>المدفوع</span><span>${Number(sale.paid_amount).toFixed(2)} ج.م</span></div>
  ${remainHtml}
</div>
<div class="footer">شكراً لتعاملكم معنا — مُحكم - MUHKAM ERP</div>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=950");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-400" /> تفاصيل الفاتورة
          </h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} disabled={isLoading || !sale} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 transition-colors text-sm font-bold">
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-8">{Array.from({length:4}).map((_,i)=><div key={i} className="skeleton-shimmer h-8 rounded-xl"/>)}</div>
        ) : !sale ? (
          <div className="text-center py-12 text-white/40">لم يتم العثور على الفاتورة</div>
        ) : (
          <>
            {/* Screen view */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div><p className="text-white/50 text-sm">رقم الفاتورة</p><p className="text-amber-400 font-bold text-lg">{sale.invoice_no}</p></div>
                <div><p className="text-white/50 text-sm">التاريخ</p><p className="text-white">{formatDate(sale.created_at)}</p></div>
                <div><p className="text-white/50 text-sm">العميل</p><p className="text-white font-semibold">{sale.customer_name || 'عميل نقدي'}</p></div>
                <div><p className="text-white/50 text-sm">طريقة الدفع</p><PaymentBadge type={sale.payment_type} /></div>
                {(sale as any).warehouse_name && <div><p className="text-white/50 text-sm">المخزن</p><p className="text-white">{(sale as any).warehouse_name}</p></div>}
                {(sale as any).salesperson_name && <div><p className="text-white/50 text-sm">المندوب</p><p className="text-amber-300 font-semibold">{(sale as any).salesperson_name}</p></div>}
              </div>
              <div>
                <h4 className="text-white font-bold mb-3">أصناف الفاتورة</h4>
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white/5 border-b border-white/10">
                      <tr>
                        <th className="p-3 text-white/60">الصنف</th>
                        <th className="p-3 text-white/60">الكمية</th>
                        <th className="p-3 text-white/60">سعر الوحدة</th>
                        <th className="p-3 text-white/60">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sale.items || []).map((item, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="p-3 font-bold text-white">{item.product_name}</td>
                          <td className="p-3 text-white/70">{item.quantity}</td>
                          <td className="p-3 text-white/70">{formatCurrency(item.unit_price)}</td>
                          <td className="p-3 font-bold text-emerald-400">{formatCurrency(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                {(sale as any).discount_amount > 0 && <>
                  <div className="flex justify-between"><span className="text-white/60">الإجمالي قبل الخصم</span><span className="text-white">{formatCurrency(sale.total_amount + (sale as any).discount_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">الخصم ({(sale as any).discount_percent}%)</span><span className="text-red-400">- {formatCurrency((sale as any).discount_amount)}</span></div>
                </>}
                <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-white/60">الإجمالي</span><span className="font-bold text-white text-lg">{formatCurrency(sale.total_amount)}</span></div>
                <div className="flex justify-between"><span className="text-white/60">المدفوع</span><span className="font-bold text-emerald-400">{formatCurrency(sale.paid_amount)}</span></div>
                {sale.remaining_amount > 0 && (
                  <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-white/60">المتبقي</span><span className="font-bold text-red-400 text-lg">{formatCurrency(sale.remaining_amount)}</span></div>
                )}
                <div className="flex justify-between border-t border-white/10 pt-3"><span className="text-white/60">الحالة</span><StatusBadge status={sale.status} /></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SuccessInvoice {
  invoice_no: string;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  payment_type: string;
  items: CartItem[];
}

function WhatsAppSuccessModal({ invoice, onClose }: { invoice: SuccessInvoice; onClose: () => void }) {
  const paymentLabel: Record<string, string> = { cash: "نقدي", credit: "آجل", partial: "جزئي" };

  const buildWhatsAppMsg = () => {
    const lines = [
      `🧾 *فاتورة مبيعات - مُحكم - MUHKAM*`,
      `رقم الفاتورة: ${invoice.invoice_no}`,
      ``,
      `*الأصناف:*`,
      ...invoice.items.map(i => `• ${i.product_name} × ${i.quantity} = ${i.total_price.toFixed(2)} ج.م`),
      ``,
      `*الإجمالي: ${invoice.total_amount.toFixed(2)} ج.م*`,
      `طريقة الدفع: ${paymentLabel[invoice.payment_type] || invoice.payment_type}`,
      ``,
      `شكراً لتعاملكم معنا 🙏`,
    ];
    return encodeURIComponent(lines.join("\n"));
  };

  const phoneRaw = invoice.customer_phone?.replace(/\D/g, "") ?? "";
  const phone = phoneRaw.startsWith("0") ? "2" + phoneRaw : phoneRaw.startsWith("2") ? phoneRaw : "2" + phoneRaw;
  const waUrl = `https://wa.me/${phone}?text=${buildWhatsAppMsg()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel rounded-3xl p-8 w-full max-w-sm border border-emerald-500/30 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
          <Receipt className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-black text-white">تم إصدار الفاتورة</h3>
          <p className="text-amber-400 font-bold text-lg mt-1">{invoice.invoice_no}</p>
          <p className="text-white/50 text-sm mt-1">الإجمالي: <span className="text-white font-bold">{formatCurrency(invoice.total_amount)}</span></p>
          {invoice.customer_name && <p className="text-white/50 text-sm">العميل: <span className="text-white">{invoice.customer_name}</span></p>}
        </div>
        <div className="space-y-3">
          {invoice.customer_phone && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] font-bold hover:bg-[#25D366]/30 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              إرسال الفاتورة عبر واتساب
            </a>
          )}
          <button onClick={onClose} className="w-full btn-secondary py-3">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

type PayRow = { id: string; type: 'cash'|'credit'; safe_id: number|null; amount: number };

function NewSalePanel({ onDone }: { onDone: () => void }) {
  const { user: currentUser } = useAuth();
  const canEditPrice = hasPermission(currentUser, "can_edit_price") === true;
  const { data: productsRaw } = useGetProducts();
  const products = safeArray(productsRaw);
  const { data: customersRaw } = useGetCustomers();
  const customers = safeArray(customersRaw).filter(c => c.is_customer !== false);
  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createProductMutation = useCreateProduct();
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const { data: categoriesRaw } = useGetCategories();
  const categories = safeArray(categoriesRaw);

  const { data: warehousesRaw } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/settings/warehouses"],
    queryFn: () => authFetch(api("/api/settings/warehouses")).then(async r => {
      if (!r.ok) throw new Error("خطأ في جلب البيانات");
      const j = await r.json();
      return safeArray(j);
    }),
  });
  const warehouses = safeArray(warehousesRaw);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [discountPct, setDiscountPct] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [payRows, setPayRows] = useState<PayRow[]>([]);
  const [payType, setPayType] = useState<'cash'|'credit'>('cash');
  const [paySafe, setPaySafe] = useState<number|null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payShake, setPayShake] = useState(false);
  const [payRowKey, setPayRowKey] = useState(0);
  const payAmountRef = useRef<HTMLInputElement>(null);

  const isRestricted = currentUser?.role === "cashier" || currentUser?.role === "salesperson";

  // القيم الفعلية: للكاشير/المندوب تأتي من بيانات المستخدم؛ للإدارة من الاختيار اليدوي
  const effectiveWarehouseId = isRestricted
    ? (currentUser?.warehouse_id ? String(currentUser.warehouse_id) : "")
    : warehouseId;
  const effectiveSafeId = isRestricted
    ? (currentUser?.safe_id ?? null)
    : null;

  const effectiveWarehouseName = warehouses.find(w => String(w.id) === effectiveWarehouseId)?.name ?? "—";

  // اختيار المخزن الأول تلقائياً للمدير فقط
  useEffect(() => {
    if (!isRestricted && warehouses.length > 0 && !warehouseId) {
      setWarehouseId(String(warehouses[0].id));
    }
  }, [warehouses, warehouseId, isRestricted]);

  // المندوب هو المستخدم الحالي تلقائياً
  const salespersonId = currentUser ? String(currentUser.id) : "";
  const salespersonName = currentUser?.name ?? "—";
  const [successInvoice, setSuccessInvoice] = useState<SuccessInvoice | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: (data: object) => authFetch(api("/api/sales"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "خطأ غير متوقع في التسجيل"); return j; }),
    onSuccess: (data) => {
      const selectedCustomer = customers.find(c => c.id === parseInt(customerId));
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/safes"] });
      setCheckoutError(null);
      setPayRows([]); setPayAmount(''); setPayRowKey(k => k+1);
      setSuccessInvoice({
        invoice_no: data.invoice_no,
        total_amount: data.total_amount,
        customer_name: selectedCustomer?.name ?? null,
        customer_phone: selectedCustomer?.phone ?? null,
        payment_type: data.payment_type ?? "cash",
        items: [...cart],
      });
      setCart([]); setCustomerId(""); setDiscountPct("");
    },
    onError: (e: Error) => {
      setCheckoutError(e.message);
      toast({ title: "❌ فشل التسجيل", description: e.message, variant: "destructive" });
    },
  });

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    const matchCat = !categoryFilter || p.category_name === categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.total_price, 0), [cart]);
  const discountAmount = useMemo(() => cartSubtotal * (parseFloat(discountPct) || 0) / 100, [cartSubtotal, discountPct]);
  const cartTotal = useMemo(() => cartSubtotal - discountAmount, [cartSubtotal, discountAmount]);

  const [recentlyAdded, setRecentlyAdded] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<{ pid: number; val: string } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const updatePrice = useCallback((pid: number, rawVal: string) => {
    const newPrice = parseFloat(rawVal);
    if (isNaN(newPrice) || newPrice < 0) return;
    const prod = products.find(p => p.id === pid);
    const costPrice = prod ? Number(prod.cost_price) : 0;
    if (costPrice > 0 && newPrice < costPrice - 0.001) {
      toast({ title: `⚠ السعر (${formatCurrency(newPrice)}) أقل من تكلفة الشراء (${formatCurrency(costPrice)})`, variant: "destructive" });
      return;
    }
    setCart(prev => prev.map(i => i.product_id !== pid ? i : { ...i, unit_price: newPrice, total_price: newPrice * i.quantity }));
  }, [products, currentUser, toast]);

  const addToCart = (product: typeof products[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total_price: (i.quantity + 1) * i.unit_price } : i);
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.sale_price, total_price: product.sale_price }];
    });
    setRecentlyAdded(product.id);
    setTimeout(() => setRecentlyAdded(null), 520);
  };

  const handleCreateProduct = (data: ProductFormData) => {
    createProductMutation.mutate({ data }, {
      onSuccess: (newProduct: any) => {
        toast({ title: "✅ تم إضافة المنتج وإضافته للفاتورة" });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        setShowCreateProduct(false);
        setSearch("");
        if (newProduct?.id) {
          addToCart({ ...newProduct, sale_price: Number(newProduct.sale_price), cost_price: Number(newProduct.cost_price), quantity: Number(newProduct.quantity) });
        }
      },
      onError: () => toast({ title: "حدث خطأ أثناء إضافة المنتج", variant: "destructive" }),
    });
  };

  const updateQty = (pid: number, delta: number) => setCart(prev => prev.map(i => {
    if (i.product_id !== pid) return i;
    const newQ = Math.max(1, i.quantity + delta);
    return { ...i, quantity: newQ, total_price: newQ * i.unit_price };
  }));

  const selectedCustomer = customers.find(c => c.id === parseInt(customerId));

  const customerSaleItems = useMemo(() =>
    customers.map(c => ({
      value: String(c.id),
      label: `${c.customer_code ? `[${c.customer_code}] ` : ""}${c.name}${Number(c.balance) > 0 ? ` (دين: ${Number(c.balance).toFixed(0)} ج.م)` : ""}`,
      searchKeys: [String(c.customer_code ?? ""), c.name],
    })),
    [customers]
  );

  const payPaidSoFar = payRows.reduce((s, r) => s + r.amount, 0);
  const payRemaining = Math.round((cartTotal - payPaidSoFar) * 100) / 100;
  const payPct = Math.min(100, cartTotal > 0 ? (payPaidSoFar / cartTotal) * 100 : 0);
  const payIsDone = Math.abs(payRemaining) < 0.05 && payRows.length > 0;
  const payCreditWarn = payRows.some(r => r.type === 'credit') && !customerId;
  const canCheckout = cart.length > 0 && payIsDone && !checkoutMutation.isPending && !payCreditWarn;

  const triggerPayShake = () => { setPayShake(true); setTimeout(() => setPayShake(false), 400); };

  const confirmPayRow = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || amt > payRemaining + 0.05) { triggerPayShake(); return; }
    const firstSafeId = effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null);
    setPayRows(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      type: payType,
      safe_id: payType === 'cash' ? (paySafe ?? firstSafeId) : null,
      amount: Math.min(amt, payRemaining),
    }]);
    setPayAmount('');
    setPaySafe(effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null));
    setPayType('cash');
    setPayRowKey(k => k + 1);
  };

  const fillPayRemaining = () => setPayAmount(payRemaining.toFixed(0));

  useEffect(() => {
    const firstSafeId = effectiveSafeId ?? (safes.length > 0 ? safes[0].id : null);
    setPaySafe(firstSafeId);
  }, [safes.length, effectiveSafeId]);

  useEffect(() => {
    if (payRows.length > 0) { setPayRows([]); setPayAmount(''); }
  }, [cartTotal]);

  useEffect(() => {
    if (payRowKey > 0) setTimeout(() => payAmountRef.current?.focus(), 60);
  }, [payRowKey]);

  const handleCheckout = () => {
    if (!canCheckout) return;
    if (!effectiveWarehouseId) {
      toast({ title: "المخزن غير محدد — يرجى مراجعة المدير لإعداد حسابك", variant: "destructive" }); return;
    }
    const totalCash = payRows.filter(p => p.type === "cash").reduce((s, p) => s + p.amount, 0);
    const totalCredit = payRows.filter(p => p.type === "credit").reduce((s, p) => s + p.amount, 0);
    const pt: "cash"|"credit"|"partial" = totalCredit === 0 ? "cash" : totalCash === 0 ? "credit" : "partial";
    const primarySafe = payRows.find(p => p.type === "cash")?.safe_id ?? null;
    checkoutMutation.mutate({
      payment_type: pt, total_amount: cartTotal, paid_amount: totalCash,
      customer_id: selectedCustomer?.id ?? null, customer_name: selectedCustomer?.name ?? null,
      safe_id: primarySafe,
      warehouse_id: effectiveWarehouseId ? parseInt(effectiveWarehouseId) : null,
      salesperson_id: salespersonId ? parseInt(salespersonId) : null,
      discount_percent: parseFloat(discountPct) || 0, discount_amount: discountAmount,
      items: cart,
      payments: payRows.map(r => ({ type: r.type, safe_id: r.safe_id, amount: r.amount })),
    });
  };

  /* ── مرجع حقل البحث واختصارات لوحة المفاتيح ── */
  const searchInputRef = useRef<HTMLInputElement>(null);
  const _checkoutRef = useRef(handleCheckout);
  _checkoutRef.current = handleCheckout;

  // تركيز تلقائي عند فتح الصفحة
  useEffect(() => { searchInputRef.current?.focus(); }, []);

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F9 / Ctrl+S → إصدار فاتورة
      if (e.key === "F9") { e.preventDefault(); _checkoutRef.current(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); _checkoutRef.current(); return; }
      // ESC → مسح البحث
      if (e.key === "Escape") {
        setSearch(prev => { if (prev) { setTimeout(() => searchInputRef.current?.focus(), 0); return ""; } return prev; });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Enter في حقل البحث → إضافة أول منتج متاح للسلة
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const available = filteredProducts.filter(p => Number(p.quantity) > 0);
    if (available.length > 0) {
      addToCart(available[0]);
      setSearch("");
      toast({ title: `✅ تمت إضافة "${available[0].name}" للسلة` });
    } else {
      toast({ title: filteredProducts.length === 0 ? "لا توجد منتجات مطابقة للبحث" : "المنتج نفد من المخزون", variant: "destructive" });
    }
  };

  const selectRow = (label: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <span className="text-white/40 shrink-0">{icon}</span>
      <span className="text-white/40 text-xs w-14 shrink-0">{label}</span>
      {children}
    </div>
  );

  const _handleNewSale = () => {
    setCart([]); setCustomerId(""); setSearch(""); setDiscountPct("");
    setPayRows([]); setPayAmount(''); setPayRowKey(k => k + 1);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  return (
    <>
      {successInvoice && (
        <WhatsAppSuccessModal invoice={successInvoice} onClose={() => { setSuccessInvoice(null); onDone(); }} />
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
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              {search && filteredProducts.filter(p => Number(p.quantity) > 0).length > 0 && (
                <span className="shrink-0 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg whitespace-nowrap font-bold">
                  ↵ {filteredProducts.filter(p => Number(p.quantity) > 0).length === 1
                    ? filteredProducts[0].name.slice(0, 18)
                    : `${filteredProducts.filter(p => Number(p.quantity) > 0).length} نتيجة`}
                </span>
              )}
              {search && (
                <button onClick={() => setSearch("")} className="shrink-0 sale-muted-text hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Pill category filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => setCategoryFilter("")}
                className={`sale-cat-pill text-xs font-bold px-3 py-1 rounded-full shrink-0 ${!categoryFilter ? 'active' : ''}`}
              >كل الأصناف</button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(prev => prev === cat.name ? "" : cat.name)}
                  className={`sale-cat-pill text-xs font-bold px-3 py-1 rounded-full shrink-0 ${categoryFilter === cat.name ? 'active' : ''}`}
                >{cat.name}</button>
              ))}
            </div>
          </div>

          {/* شبكة المنتجات */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 pb-1">
              {filteredProducts.map(product => {
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
                    <p className="sale-product-name font-bold text-sm truncate leading-tight">{product.name}</p>
                    {product.category && (
                      <span className="text-[10px] text-amber-500/70 font-bold mt-0.5 block truncate">{product.category}</span>
                    )}
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-emerald-400 font-black text-sm tabular-nums">{formatCurrency(product.sale_price)}</span>
                      <span className={`sale-stock-badge text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                        outOfStock ? "!bg-red-500/15 !text-red-400"
                        : lowStock  ? "!bg-orange-500/15 !text-orange-400"
                        : ""
                      }`}>
                        {outOfStock ? "نفد" : lowStock ? `${product.quantity} ⚠` : product.quantity}
                      </span>
                    </div>
                    {!outOfStock && (
                      <div className="mt-2 py-1 rounded-lg text-[11px] font-black text-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(245,158,11,0.11)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.20)' }}>
                        + أضف للفاتورة
                      </div>
                    )}
                  </button>
                );
              })}

              {/* لا توجد منتجات → زر إضافة سريعة */}
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
                    <p className="sale-muted-text text-xs mt-0.5 truncate max-w-[120px] opacity-70">«{search}»</p>
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
                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${cart.length > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'sale-badge-empty'}`}>
                  {cart.length} صنف
                </span>
                {cart.length > 0 && (
                  <button onClick={_handleNewSale} title="تفريغ الفاتورة"
                    className="text-[11px] sale-muted-text hover:text-red-400 transition-colors flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> تفريغ
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
                  <span className="text-emerald-400 text-xs font-bold truncate">{effectiveWarehouseName}</span>
                </div>
              ) : (
                <div className="sale-field-row flex items-center gap-2 rounded-xl px-3 py-2">
                  <Vault className="w-3.5 h-3.5 sale-muted-text shrink-0" />
                  <span className="sale-label-text text-xs shrink-0">المخزن</span>
                  <select className="bg-transparent outline-none w-full appearance-none text-xs sale-text-primary" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                    {warehouses.map(w => <option key={w.id} value={w.id} className="bg-slate-900">{w.name}</option>)}
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

          {/* أصناف السلة — قابلة للتمرير */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 py-6">
                <div className="sale-empty-icon-bg w-16 h-16 rounded-2xl flex items-center justify-center">
                  <ShoppingCart className="w-7 h-7 sale-muted-text opacity-40" />
                </div>
                <p className="text-sm sale-muted-text font-bold opacity-50">اضغط على أي منتج للإضافة</p>
              </div>
            ) : cart.map(item => {
              const origPrice = products.find(p => p.id === item.product_id)?.sale_price ?? item.unit_price;
              const priceChanged = Math.abs(item.unit_price - Number(origPrice)) > 0.001;
              return (
                <div key={item.product_id} className="sale-cart-item rounded-2xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <button onClick={() => setCart(prev => prev.filter(i => i.product_id !== item.product_id))}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/22 text-red-400/60 hover:text-red-400 flex items-center justify-center transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 mr-2 min-w-0">
                      <p className="sale-text-primary font-bold text-sm truncate">{item.product_name}</p>
                      {priceChanged && <span className="text-amber-400 text-[10px]">⚠ سعر معدّل</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-400 text-base tabular-nums">{formatCurrency(item.total_price)}</span>
                    <div className="flex items-center gap-1.5">
                      {canEditPrice ? (
                        editingPrice?.pid === item.product_id ? (
                          <input type="number" step="0.01" autoFocus
                            className="sale-price-input w-20 rounded-lg px-2 py-0.5 text-xs outline-none tabular-nums"
                            value={editingPrice.val}
                            onChange={e => setEditingPrice(p => p ? { ...p, val: e.target.value } : null)}
                            onBlur={() => { updatePrice(item.product_id, editingPrice.val); setEditingPrice(null); }}
                            onKeyDown={e => { if (e.key === "Enter") { updatePrice(item.product_id, editingPrice.val); setEditingPrice(null); } if (e.key === "Escape") setEditingPrice(null); }}
                          />
                        ) : (
                          <button onClick={() => setEditingPrice({ pid: item.product_id, val: String(item.unit_price) })}
                            className={`text-xs tabular-nums transition-colors hover:text-amber-400 ${priceChanged ? "text-amber-400" : "sale-muted-text"}`}
                            title="اضغط لتعديل السعر">
                            × {formatCurrency(item.unit_price)}
                          </button>
                        )
                      ) : (
                        <span className={`text-xs tabular-nums ${priceChanged ? "text-amber-400" : "sale-muted-text"}`}>
                          × {formatCurrency(item.unit_price)}
                        </span>
                      )}
                      <button onClick={() => updateQty(item.product_id, -1)} className="sale-qty-btn w-7 h-7 rounded-lg flex items-center justify-center">
                        <Minus className="w-3 h-3 sale-text-primary" />
                      </button>
                      <span className="sale-text-primary font-black text-sm w-6 text-center tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, 1)} className="w-7 h-7 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/22 flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3 text-amber-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── قدم الفاتورة ─── */}
          <div className="sale-cart-footer p-3 space-y-2 shrink-0">

            {/* العميل */}
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
            </div>

            {/* رصيد العميل */}
            {selectedCustomer && (
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold ${
                Number(selectedCustomer.balance) > 0 ? "bg-red-500/10 border border-red-500/20"
                : Number(selectedCustomer.balance) < 0 ? "bg-emerald-500/10 border border-emerald-500/20"
                : "sale-field-row"
              }`}>
                <span className="sale-muted-text">رصيد العميل</span>
                <span className={Number(selectedCustomer.balance) > 0 ? "text-red-400" : Number(selectedCustomer.balance) < 0 ? "text-emerald-400" : "sale-muted-text"}>
                  {Number(selectedCustomer.balance) === 0 ? "متسوّى ✓"
                    : Number(selectedCustomer.balance) > 0 ? `دين: ${formatCurrency(Number(selectedCustomer.balance))}`
                    : `له: ${formatCurrency(Math.abs(Number(selectedCustomer.balance)))}`}
                </span>
              </div>
            )}

            {selectedCustomer?.phone && (
              <div className="text-xs text-[#25D366] flex items-center gap-1 px-1">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {selectedCustomer.phone}
              </div>
            )}

            {/* الخصم */}
            <div className="sale-field-row flex items-center gap-1.5 rounded-xl px-3 py-2">
              <Percent className="w-3 h-3 sale-muted-text shrink-0" />
              <span className="sale-label-text text-xs shrink-0">خصم %</span>
              <input type="number" min="0" max="100" step="1" placeholder="0"
                className="bg-transparent outline-none flex-1 text-xs sale-text-primary placeholder:opacity-25"
                value={discountPct} onChange={e => setDiscountPct(e.target.value)} />
              {discountAmount > 0 && <span className="text-red-400 text-xs font-bold shrink-0">-{formatCurrency(discountAmount)}</span>}
            </div>

            {/* ── الإجمالي ── */}
            <div className="sale-total-box rounded-2xl px-4 py-3 flex items-center justify-between">
              {discountAmount > 0 ? (
                <div className="text-left">
                  <p className="text-[10px] sale-muted-text line-through tabular-nums">{formatCurrency(cartSubtotal)}</p>
                  <p className="text-[10px] sale-label-text">بعد خصم {discountPct}%</p>
                </div>
              ) : (
                <span className="text-xs sale-label-text font-medium">إجمالي الفاتورة</span>
              )}
              <span className="font-black sale-text-primary tabular-nums" style={{ fontSize: '1.5rem', letterSpacing: '-0.5px', lineHeight: 1 }}>
                {formatCurrency(cartTotal)}
              </span>
            </div>

            {/* ══ قسم الدفع — دائماً مرئي ══ */}
            <div className="sale-pay-box rounded-2xl overflow-hidden">

              {/* شريط التقدم */}
              <div className="px-3 pt-2.5 pb-2">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-bold tabular-nums transition-colors" style={{
                    color: payIsDone ? '#10B981' : cart.length === 0 ? '#94A3B8' : '#F59E0B'
                  }}>
                    {payIsDone ? '✓ مكتمل'
                      : cart.length === 0 ? 'أضف منتجاً للبدء'
                      : payPaidSoFar > 0 ? `متبقي: ${formatCurrency(payRemaining)}`
                      : 'اختر طريقة الدفع'}
                  </span>
                  <span className="sale-muted-text">{Math.round(payPct)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${payPct}%`, background: payIsDone ? 'linear-gradient(90deg,#10B981,#34D399)' : 'linear-gradient(90deg,#F59E0B,#FBBF24)' }} />
                </div>
              </div>

              {/* الصفوف المؤكدة */}
              {payRows.length > 0 && (
                <div className="px-2 pb-2 space-y-1">
                  {payRows.map(row => (
                    <div key={row.id}
                      className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 ${row.type === 'credit' ? 'sale-pay-row-credit' : 'sale-pay-row-cash'}`}>
                      <button onClick={() => setPayRows(prev => prev.filter(r => r.id !== row.id))}
                        className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-red-400/60 hover:text-red-400 transition-colors"
                        style={{ background: 'rgba(239,68,68,0.08)' }}>
                        <X className="w-3 h-3" />
                      </button>
                      <span className={`text-xs shrink-0 flex items-center gap-1 ${row.type === 'credit' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {row.type === 'cash' ? <Coins className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {row.type === 'cash' ? (safes.find(s => s.id === row.safe_id)?.name ?? '—') : 'ائتمان'}
                      </span>
                      <span className="sale-text-primary font-black text-sm tabular-nums mr-auto">{formatCurrency(row.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* حقل الإدخال */}
              {!payIsDone && (
                <div className={`px-2 pb-2.5 ${payShake ? 'erp-shake' : ''}`}>
                  {/* أزرار نوع الدفع */}
                  <div className="flex gap-1.5 mb-2">
                    <button onClick={() => setPayType('cash')}
                      className={`sale-pay-btn flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${payType === 'cash' ? 'sale-pay-btn-cash-active' : 'sale-pay-btn-inactive'}`}>
                      <Coins className="w-3 h-3" /> نقدي
                    </button>
                    <button onClick={() => setPayType('credit')}
                      className={`sale-pay-btn flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${payType === 'credit' ? 'sale-pay-btn-credit-active' : 'sale-pay-btn-inactive'}`}>
                      <Clock className="w-3 h-3" /> آجل
                    </button>
                  </div>

                  {/* الخزينة + المبلغ */}
                  <div className="flex gap-1.5 items-stretch mb-1.5">
                    {payType === 'cash' ? (
                      <select value={paySafe ?? ''} onChange={e => setPaySafe(parseInt(e.target.value) || null)}
                        disabled={isRestricted}
                        className="sale-pay-safe flex-1 min-w-0"
                        style={{ cursor: isRestricted ? 'not-allowed' : 'pointer' }}>
                        {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      <div className="sale-pay-credit-ph flex-1 flex items-center justify-end text-xs">
                        ائتمان العميل
                      </div>
                    )}
                    <div className="relative shrink-0" style={{ width: 94 }}>
                      <input key={payRowKey} ref={payAmountRef} type="number" min="0" step="any"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmPayRow(); } }}
                        onFocus={e => e.target.select()}
                        placeholder={cart.length > 0 ? payRemaining.toFixed(0) : '0'}
                        disabled={cart.length === 0}
                        className="sale-pay-amount disabled:opacity-40"
                        dir="ltr"
                      />
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none sale-muted-text">ج.م</span>
                    </div>
                  </div>

                  {/* أزرار التأكيد */}
                  <div className="flex gap-1.5">
                    <button onClick={confirmPayRow} disabled={cart.length === 0} className="sale-pay-confirm shrink-0">
                      ↵ تأكيد
                    </button>
                    <button onClick={fillPayRemaining} disabled={cart.length === 0} className="sale-pay-fill">
                      كل المتبقي {cart.length > 0 ? `(${formatCurrency(payRemaining)})` : ''}
                    </button>
                  </div>
                </div>
              )}

              {/* تحذير الائتمان بدون عميل */}
              {payCreditWarn && (
                <div className="mx-2 mb-2 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
                  ⚠ اختر العميل أولاً للبيع الآجل
                </div>
              )}
            </div>

            {/* خطأ التسجيل */}
            {checkoutError && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
                <p className="text-red-400 text-xs font-bold">❌ فشل التسجيل</p>
                <p className="text-red-300/70 text-xs mt-0.5">{checkoutError}</p>
              </div>
            )}

            {/* ── زر إتمام البيع ── */}
            <button onClick={handleCheckout} disabled={!canCheckout}
              className="w-full py-3.5 rounded-xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{
                background: canCheckout ? "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)" : undefined,
                color: canCheckout ? "#000" : undefined,
                boxShadow: canCheckout ? "0 6px 22px rgba(245,158,11,0.38), 0 1px 3px rgba(0,0,0,0.2)" : "none",
                border: canCheckout ? 'none' : '1px solid rgba(255,255,255,0.08)',
                opacity: canCheckout ? 1 : 0.42,
              }}>
              {checkoutMutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> جارٍ التسجيل...</>
              ) : (
                <><Banknote className="w-4 h-4" /> إتمام البيع <kbd className="text-[10px] font-bold opacity-60 bg-black/10 px-1.5 py-0.5 rounded">F9</kbd></>
              )}
            </button>

            <div className="flex items-center justify-center gap-4 text-[11px] sale-muted-text opacity-40 pb-0.5">
              <span>⌨ Ctrl+S حفظ</span><span>·</span><span>Enter إضافة</span>
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

/* ─── سجل فواتير المبيعات مع التحكم بالترحيل ─── */
interface SaleRecord {
  id: number; invoice_no: string; date: string | null;
  customer_name: string | null; payment_type: string;
  total_amount: number; paid_amount: number; remaining_amount: number;
  posting_status: string; status: string;
}

function SalesPostingBadge({ status }: { status: string }) {
  if (status === "posted")    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">مرحَّل</span>;
  if (status === "cancelled") return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">ملغى</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-medium">مسودة</span>;
}

function buildSaleWhatsAppUrl(s: SaleRecord): string {
  const paymentLabel: Record<string, string> = { cash: "نقدي", credit: "آجل", partial: "جزئي" };
  const lines = [
    `🧾 *فاتورة مبيعات - مُحكم - MUHKAM*`,
    `رقم الفاتورة: ${s.invoice_no}`,
    s.customer_name ? `العميل: ${s.customer_name}` : "",
    `الإجمالي: ${Number(s.total_amount).toFixed(2)} ج.م`,
    `طريقة الدفع: ${paymentLabel[s.payment_type] || s.payment_type}`,
    ``,
    `شكراً لتعاملكم معنا 🙏`,
  ].filter(Boolean);
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}

function SalesHistoryPanel() {
  const { user: currentUser } = useAuth();
  const canCancelSale = hasPermission(currentUser, "can_cancel_sale") === true;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentWarehouseId } = useWarehouse();
  const warehouseParam = currentWarehouseId ? `?warehouse_id=${currentWarehouseId}` : "";

  const { data: sales = [], isLoading } = useQuery<SaleRecord[]>({
    queryKey: ["/api/sales", currentWarehouseId],
    queryFn: () => authFetch(api(`/api/sales${warehouseParam}`)).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/sales"] });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/sales/${id}/post`), { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الترحيل"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "✅ تم ترحيل الفاتورة وإنشاء القيد المحاسبي" }); invalidate(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(api(`/api/sales/${id}/cancel`), { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "فشل الإلغاء"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم إلغاء الفاتورة وإنشاء قيد عكسي" }); invalidate(); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
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
              <th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton cols={7} rows={5} />
              : sales.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-white/40">لا توجد فواتير بعد</td></tr>
              : sales.map(s => (
                <tr key={s.id} className="border-b border-white/5 erp-table-row">
                  <td className="p-3 font-mono text-amber-400">{s.invoice_no}</td>
                  <td className="p-3 font-bold text-white">{s.customer_name || 'نقدي'}</td>
                  <td className="p-3 font-bold text-emerald-400">{formatCurrency(s.total_amount)}</td>
                  <td className="p-3 text-white/60">{s.payment_type === "cash" ? "نقدي" : s.payment_type === "credit" ? "آجل" : "جزئي"}</td>
                  <td className="p-3"><SalesPostingBadge status={s.posting_status} /></td>
                  <td className="p-3 text-white/50">{s.date || '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {s.posting_status === "draft" && canCancelSale && (
                        <button onClick={() => postMutation.mutate(s.id)} disabled={postMutation.isPending} title="ترحيل"
                          className="btn-icon text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {s.posting_status === "posted" && canCancelSale && (
                        <button onClick={() => cancelMutation.mutate(s.id)} disabled={cancelMutation.isPending} title="إلغاء"
                          className="btn-icon text-amber-400 hover:text-amber-300 hover:bg-amber-500/10">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <a href={buildSaleWhatsAppUrl(s)} target="_blank" rel="noopener noreferrer"
                        title="إرسال عبر واتساب"
                        className="btn-icon text-[#25D366] hover:text-[#20ba58] hover:bg-[#25D366]/10">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Sales() {
  const { user: currentUser } = useAuth();
  const canCreateSale = hasPermission(currentUser, "can_create_sale") === true;
  const canReturnSale = hasPermission(currentUser, "can_return_sale") === true;

  const [tab, setTab] = useState<"new" | "history" | "returns">(canCreateSale ? "new" : "history");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  const effectiveTab = (tab === "new" && !canCreateSale) ? "history"
    : (tab === "returns" && !canReturnSale) ? "history"
    : tab;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
          {canCreateSale && (
            <button onClick={() => setTab("new")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${effectiveTab === "new" ? "bg-amber-500 text-black shadow" : "text-white/50 hover:text-white"}`}>
              ➕ فاتورة بيع جديدة
            </button>
          )}
          <button onClick={() => setTab("history")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${effectiveTab === "history" ? "bg-amber-500 text-black shadow" : "text-white/50 hover:text-white"}`}>
            <ClipboardList className="w-3.5 h-3.5" /> سجل الفواتير
          </button>
          {canReturnSale && (
            <button onClick={() => setTab("returns")} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${effectiveTab === "returns" ? "bg-orange-500 text-white shadow" : "text-white/50 hover:text-white"}`}>
              ↩ المرتجعات
            </button>
          )}
        </div>
      </div>

      {selectedSaleId && <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />}

      {effectiveTab === "history" ? <SalesHistoryPanel />
        : effectiveTab === "returns" ? <SalesReturnsPanel />
        : <NewSalePanel onDone={() => {}} />}
    </div>
  );
}
