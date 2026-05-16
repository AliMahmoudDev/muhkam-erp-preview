import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { useWarehouses } from "@/hooks/useWarehouses";
import { formatCurrency } from "@/lib/format";
import {
  Loader2, X, PackageCheck, Coins, Clock, Plus, Trash2, UserCog, ChevronLeft,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { safeArray } from "@/lib/safe-data";
import { JobLite, Product, Warehouse, PayRow, PayType, PartLine } from "./types";

function fmtCurrency(n: number) { return formatCurrency(n); }

interface BillingPhaseProps {
  job: JobLite;
  phase: "billing";
  partLines: PartLine[];
  setPartLines: React.Dispatch<React.SetStateAction<PartLine[]>>;
  payRows: PayRow[];
  setPayRows: React.Dispatch<React.SetStateAction<PayRow[]>>;
  payType: PayType;
  setPayType: React.Dispatch<React.SetStateAction<PayType>>;
  paySafe: number | null;
  setPaySafe: React.Dispatch<React.SetStateAction<number | null>>;
  payAmount: string;
  setPayAmount: React.Dispatch<React.SetStateAction<string>>;
  productSearch: string;
  setProductSearch: React.Dispatch<React.SetStateAction<string>>;
  showProductDrop: boolean;
  setShowProductDrop: React.Dispatch<React.SetStateAction<boolean>>;
  addQty: string;
  setAddQty: React.Dispatch<React.SetStateAction<string>>;
  addPrice: string;
  setAddPrice: React.Dispatch<React.SetStateAction<string>>;
  selectedProduct: Product | null;
  setSelectedProduct: React.Dispatch<React.SetStateAction<Product | null>>;
  selectedWarehouseId: number | null;
  setSelectedWarehouseId: React.Dispatch<React.SetStateAction<number | null>>;
  brokerName: string;
  setBrokerName: React.Dispatch<React.SetStateAction<string>>;
  brokerComm: string;
  setBrokerComm: React.Dispatch<React.SetStateAction<string>>;
  billingLoading: boolean;
  billingErrors: string[];
  onBillingSave: () => void;
  onClose: () => void;
  onBack: () => void;
}

export default function BillingPhase({
  job, partLines, setPartLines,
  payRows, setPayRows, payType, setPayType, paySafe, setPaySafe, payAmount, setPayAmount,
  productSearch, setProductSearch, showProductDrop, setShowProductDrop,
  addQty, setAddQty, addPrice, setAddPrice,
  selectedProduct, setSelectedProduct, selectedWarehouseId, setSelectedWarehouseId,
  brokerName, setBrokerName, brokerComm, setBrokerComm,
  billingLoading, billingErrors, onBillingSave, onClose, onBack,
}: BillingPhaseProps) {
  const { toast: _toast } = useToast();
  const productSearchRef = useRef<HTMLInputElement>(null);

  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw) as { id: number; name: string }[];

  const { warehouses: warehousesRaw } = useWarehouses();
  const warehouses = warehousesRaw as Warehouse[];

  const { data: productsRaw } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedWarehouseId],
    queryFn: () => {
      const url = selectedWarehouseId
        ? api(`/api/products?warehouse_id=${selectedWarehouseId}`)
        : api("/api/products");
      return authFetch(url).then(r => r.json());
    },
  });
  const products: Product[] = safeArray(productsRaw) as Product[];

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 30);
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, productSearch]);

  const partsTotal    = partLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const finalCostBase = Number(job.final_cost ?? 0);
  const grandTotal    = finalCostBase + partsTotal;
  const paidSoFar     = payRows.reduce((s, r) => s + r.amount, 0);
  const remaining     = Math.max(0, grandTotal - paidSoFar);
  const payIsDone     = grandTotal > 0 ? paidSoFar >= grandTotal - 0.005 : payRows.length > 0;

  function selectProduct(p: Product) {
    setSelectedProduct(p);
    setProductSearch(p.name);
    setAddPrice(String(Number(p.sell_price) || ""));
    setShowProductDrop(false);
  }

  function addPartLine() {
    if (!selectedProduct) return;
    const qty   = Math.max(1, parseInt(addQty) || 1);
    const price = parseFloat(addPrice) || 0;
    setPartLines(prev => [
      ...prev,
      {
        id:           `${Date.now()}-${Math.random()}`,
        product_id:   selectedProduct.id,
        product_name: selectedProduct.name,
        quantity:     qty,
        unit_price:   price,
        warehouse_id: selectedWarehouseId,
      },
    ]);
    setSelectedProduct(null);
    setProductSearch("");
    setAddQty("1");
    setAddPrice("");
    productSearchRef.current?.focus();
  }

  function addPayRow() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || amt > remaining + 0.05) return;
    setPayRows(prev => [
      ...prev,
      {
        id:      `${Date.now()}-${Math.random()}`,
        type:    payType,
        safe_id: payType === "cash" ? (paySafe ?? (safes[0]?.id ?? null)) : null,
        amount:  Math.min(amt, remaining),
      },
    ]);
    setPayAmount("");
  }

  function fillAll() {
    if (remaining <= 0) return;
    setPayRows(prev => [
      ...prev,
      {
        id:      `${Date.now()}-${Math.random()}`,
        type:    payType,
        safe_id: payType === "cash" ? (paySafe ?? (safes[0]?.id ?? null)) : null,
        amount:  remaining,
      },
    ]);
    setPayAmount("");
  }

  return (
    <>
      <div className="overflow-y-auto max-h-[68vh]">
        {/* القطع المستخدمة */}
        <div className="px-5 pt-4 pb-3 border-b border-white/5">
          <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-[9px] text-blue-300 font-black">١</span>
            القطع المستخدمة من المخزن (اختياري)
          </h4>

          {warehouses.length > 1 && (
            <div className="mb-3">
              <label className="text-[10px] font-bold text-white/50 mb-1 block">المخزن</label>
              <select
                value={selectedWarehouseId ?? ""}
                onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value) || null)}
                className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40"
              >
                <option value="">-- اختر المخزن --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <label className="text-[10px] font-bold text-white/50 mb-1 block">اختر قطعة من المخزن</label>
              <input
                ref={productSearchRef}
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); setSelectedProduct(null); }}
                onFocus={() => setShowProductDrop(true)}
                onBlur={() => setTimeout(() => setShowProductDrop(false), 180)}
                placeholder="ابحث عن منتج..."
                className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/40"
              />
              {showProductDrop && filteredProducts.length > 0 && (
                <div
                  className="absolute top-full right-0 left-0 z-50 mt-1 rounded-xl border border-white/10 overflow-hidden"
                  style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 220, overflowY: "auto" }}
                >
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => selectProduct(p)}
                      className="w-full flex items-center justify-between px-3 py-2 text-right hover:bg-white/5 transition-colors"
                    >
                      <span className="text-[11px] text-white/85 truncate">{p.name}</span>
                      <span className="text-[10px] text-white/40 shrink-0 mr-2">{fmtCurrency(Number(p.sell_price))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: 72 }}>
              <label className="text-[10px] font-bold text-white/50 mb-1 block">الكمية</label>
              <input
                type="number" min={1} value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40 text-center"
              />
            </div>

            <div style={{ width: 100 }}>
              <label className="text-[10px] font-bold text-white/50 mb-1 block">سعر الوحدة (ج.م)</label>
              <input
                type="number" min={0} step="any" value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40"
                dir="ltr"
              />
            </div>

            <button
              type="button"
              onClick={addPartLine}
              disabled={!selectedProduct}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}
            >
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </div>

          {partLines.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {partLines.map(l => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
                >
                  <button
                    type="button"
                    onClick={() => setPartLines(prev => prev.filter(x => x.id !== l.id))}
                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors"
                    style={{ background: "rgba(239,68,68,0.08)" }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <span className="flex-1 text-[11px] text-white/80 truncate">{l.product_name}</span>
                  <span className="text-[10px] text-white/50 shrink-0">{l.quantity} × {fmtCurrency(l.unit_price)}</span>
                  <span className="text-[11px] font-bold text-blue-300 shrink-0">{fmtCurrency(l.quantity * l.unit_price)}</span>
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <span className="text-[11px] font-bold text-blue-300">إجمالي القطع: {fmtCurrency(partsTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ملخص المبلغ */}
        <div className="px-5 py-3 border-b border-white/5 bg-white/[0.015]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/50">تكلفة الإصلاح المسجّلة</span>
            <span className="font-bold text-white">{fmtCurrency(finalCostBase)}</span>
          </div>
          {partsTotal > 0 && (
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-white/50">قطع مضافة</span>
              <span className="font-bold text-blue-300">+ {fmtCurrency(partsTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[12px] font-black mt-2 pt-2 border-t border-white/8">
            <span className="text-white">الإجمالي المستحق</span>
            <span className="text-lime-300">{fmtCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* طريقة الدفع */}
        <div className="px-5 pt-4 pb-3 border-b border-white/5">
          <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[9px] text-emerald-300 font-black">٢</span>
            طريقة الدفع
          </h4>

          {payRows.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {payRows.map(row => (
                <div
                  key={row.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${row.type === "credit" ? "bg-indigo-500/8 border border-indigo-500/20" : "bg-emerald-500/8 border border-emerald-500/20"}`}
                >
                  <button
                    type="button"
                    onClick={() => setPayRows(prev => prev.filter(r => r.id !== row.id))}
                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors"
                    style={{ background: "rgba(239,68,68,0.08)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className={`text-[11px] font-bold shrink-0 flex items-center gap-1 ${row.type === "credit" ? "text-indigo-400" : "text-emerald-400"}`}>
                    {row.type === "cash" ? <Coins className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {row.type === "cash" ? (safes.find(s => s.id === row.safe_id)?.name ?? "نقدي") : "آجل"}
                  </span>
                  <span className="font-black text-sm text-white mr-auto">{fmtCurrency(row.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {grandTotal > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-white/50 mb-1">
                <span>{payIsDone ? "✓ مكتمل" : `متبقي: ${fmtCurrency(remaining)}`}</span>
                <span>{Math.min(100, Math.round((paidSoFar / grandTotal) * 100))}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`,
                    background: payIsDone
                      ? "linear-gradient(90deg,#10B981,#34D399)"
                      : "linear-gradient(90deg,#F59E0B,#FBBF24)",
                  }}
                />
              </div>
            </div>
          )}

          {!payIsDone && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPayType("cash")}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "cash" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-white/[0.03] text-white/50 border border-white/10 hover:bg-white/[0.06]"}`}
                >
                  <Coins className="w-3 h-3" /> نقدي
                </button>
                <button
                  onClick={() => setPayType("credit")}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "credit" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "bg-white/[0.03] text-white/50 border border-white/10 hover:bg-white/[0.06]"}`}
                >
                  <Clock className="w-3 h-3" /> آجل
                </button>
              </div>
              <div className="flex gap-1.5 items-stretch">
                {payType === "cash" && safes.length > 0 ? (
                  <select
                    value={paySafe ?? ""}
                    onChange={(e) => setPaySafe(parseInt(e.target.value) || null)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-emerald-400/40"
                  >
                    {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <div className="flex-1 flex items-center justify-end text-[11px] text-indigo-300/70 px-2 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                    ائتمان العميل
                  </div>
                )}
                <div className="relative shrink-0" style={{ width: 100 }}>
                  <input
                    type="number" min={0} step="any" value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPayRow(); } }}
                    onFocus={(e) => e.target.select()}
                    placeholder={grandTotal > 0 ? remaining.toFixed(0) : "0"}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400/40"
                    dir="ltr"
                  />
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-white/30">ج.م</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={addPayRow}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/80 hover:text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  ↵ تأكيد
                </button>
                <button
                  onClick={fillAll}
                  disabled={remaining <= 0}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 hover:text-white transition-all disabled:opacity-30"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
                >
                  كل المتبقي ({fmtCurrency(remaining)})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* الوسيط */}
        <div className="px-5 pt-4 pb-4">
          <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-[9px] text-amber-300 font-black">٣</span>
            <UserCog className="w-3.5 h-3.5 text-amber-300" />
            الوسيط (اختياري)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-white/50 mb-1 block">اسم الوسيط</label>
              <input
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="اسم الوسيط..."
                className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-white/50 mb-1 block">قيمة العمولة (ج.م)</label>
              <input
                type="number" min={0} step="any" value={brokerComm}
                onChange={(e) => setBrokerComm(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400/40"
                dir="ltr"
              />
            </div>
          </div>
          {(brokerName.trim() || Number(brokerComm) > 0) && (
            <p className="mt-2 text-[10px] text-amber-300/70">
              ⓘ ستُخصم العمولة من الإيراد الصافي للفني عند حساب الرواتب.
            </p>
          )}
        </div>
      </div>

      {billingErrors.length > 0 && (
        <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
          <ul className="list-disc list-inside">
            {billingErrors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
          </ul>
        </div>
      )}

      <div className="px-5 py-4 border-t border-white/8 flex flex-wrap gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs transition-all"
          disabled={billingLoading}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          رجوع للفحص
        </button>
        <button
          onClick={onBillingSave}
          disabled={billingLoading}
          className="flex-1 min-w-[200px] py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          style={{ background: "rgba(132,204,22,0.85)", border: "1px solid rgba(163,230,53,0.5)", color: "#0d1f00" }}
        >
          {billingLoading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#0d1f00" }} /> جارٍ الحفظ...</>
            : <><PackageCheck className="w-3.5 h-3.5" /> حفظ وتأكيد "جاهز للتسليم"</>}
        </button>
        <button
          onClick={onClose}
          disabled={billingLoading}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-xs"
        >
          إلغاء
        </button>
      </div>
    </>
  );
}
