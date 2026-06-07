import { Coins, Clock, Plus, Trash2, UserCog, Wrench, X, Package } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PartLine, PayRow, PayType, Warehouse, Product, DiscMode, PreSavedPart, lineDiscountAmount, lineNet } from "./types";
import { DeliveryPaymentSection } from "@/pages/repairs/RepairExtensions";

const fmtCurrency = (n: number) => formatCurrency(n);

interface Props {
  /* Warehouse */
  warehouses: Warehouse[];
  selectedWarehouseId: number | null;
  setSelectedWarehouseId: (v: number | null) => void;
  /* Product search */
  filteredProducts: Product[];
  productSearch: string;
  setProductSearch: (v: string) => void;
  showProductDrop: boolean;
  setShowProductDrop: (v: boolean) => void;
  productSearchRef: React.RefObject<HTMLInputElement | null>;
  addQty: string;
  setAddQty: (v: string) => void;
  addPrice: string;
  setAddPrice: (v: string) => void;
  selectedProduct: Product | null;
  /* Pre-saved repair parts (read-only) */
  preSavedParts: PreSavedPart[];
  /* Part lines */
  partLines: PartLine[];
  setPartLines: (fn: (prev: PartLine[]) => PartLine[]) => void;
  selectProduct: (p: Product) => void;
  addPartLine: () => void;
  updateLineDiscount: (id: string, value: number, mode: DiscMode) => void;
  /* External repair */
  showExtForm: boolean;
  setShowExtForm: (fn: (v: boolean) => boolean) => void;
  extVendor: string;
  setExtVendor: (v: string) => void;
  extDesc: string;
  setExtDesc: (v: string) => void;
  extPrice: string;
  setExtPrice: (v: string) => void;
  addExternalLine: () => void;
  /* Payment */
  safes: { id: number; name: string; balance: string | number }[];
  payRows: PayRow[];
  setPayRows: (fn: (prev: PayRow[]) => PayRow[]) => void;
  payType: PayType;
  setPayType: (v: PayType) => void;
  paySafe: number | null;
  setPaySafe: (v: number | null) => void;
  payAmount: string;
  setPayAmount: (v: string) => void;
  paidSoFar: number;
  grandTotal: number;
  remaining: number;
  payIsDone: boolean;
  addPayRow: () => void;
  fillAll: () => void;
  /* Broker */
  brokerName: string;
  setBrokerName: (v: string) => void;
  brokerComm: string;
  setBrokerComm: (v: string) => void;
  /* Delivery Payment (from RepairExtensions) */
  deliveryPayment: { payment_type: string; safe_id: number | null };
  setDeliveryPayment: (v: { payment_type: string; safe_id: number | null }) => void;
}

export default function DeliveryGateForm({
  warehouses, selectedWarehouseId, setSelectedWarehouseId,
  filteredProducts, productSearch, setProductSearch, showProductDrop, setShowProductDrop,
  productSearchRef, addQty, setAddQty, addPrice, setAddPrice, selectedProduct,
  preSavedParts, partLines, setPartLines, selectProduct, addPartLine, updateLineDiscount,
  showExtForm, setShowExtForm, extVendor, setExtVendor, extDesc, setExtDesc, extPrice, setExtPrice, addExternalLine,
  safes, payRows, setPayRows, payType, setPayType, paySafe, setPaySafe, payAmount, setPayAmount,
  paidSoFar, grandTotal, remaining, payIsDone, addPayRow, fillAll,
  brokerName, setBrokerName, brokerComm, setBrokerComm,
  deliveryPayment, setDeliveryPayment,
}: Props) {
  return (
    <div className="overflow-y-auto max-h-[65vh]">

      {/* قطع الإصلاح المحفوظة مسبقاً (للقراءة فقط) */}
      {preSavedParts.length > 0 && (
        <div className="px-5 pt-4 pb-3 border-b border-white/5">
          <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            قطع الغيار المستخدمة في الإصلاح
            <span className="text-[10px] font-normal text-white/40 mr-1">محفوظة تلقائياً</span>
          </h4>
          <div className="space-y-1.5">
            {preSavedParts.map((p, i) => (
              <div key={i} className="px-3 py-2 rounded-xl flex items-center gap-2"
                style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
                <span className="flex-1 text-[11px] text-white/80 truncate">{p.product_name}</span>
                <span className="text-[10px] text-white/50 shrink-0">{p.quantity} × {fmtCurrency(p.unit_price)}</span>
                <span className="text-[11px] font-bold text-amber-300 shrink-0">{fmtCurrency(p.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* قطع غيار إضافية عند التسليم */}
      <div className="px-5 pt-4 pb-3 border-b border-white/5">
        <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-[9px] text-blue-300 font-black">١</span>
          قطع إضافية عند التسليم (اختياري)
        </h4>

        {warehouses.length > 1 && (
          <div className="mb-3">
            <label className="text-[10px] font-bold text-white/50 mb-1 block">المخزن</label>
            <select value={selectedWarehouseId ?? ""} onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value) || null)}
              className="w-full max-w-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none focus:border-blue-400/40">
              <option value="">-- اختر المخزن --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px] relative">
            <label className="text-[10px] font-bold text-white/50 mb-1 block">اختر قطعة من المخزن</label>
            <input ref={productSearchRef} value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); }}
              onFocus={() => setShowProductDrop(true)}
              onBlur={() => setTimeout(() => setShowProductDrop(false), 180)}
              placeholder="ابحث عن منتج..."
              className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/40"
            />
            {showProductDrop && filteredProducts.length > 0 && (
              <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-xl border border-white/10 overflow-hidden"
                style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 200, overflowY: "auto" }}>
                {filteredProducts.map(p => (
                  <button key={p.id} type="button" onMouseDown={() => selectProduct(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-right hover:bg-white/5">
                    <span className="text-[11px] text-white/85 truncate">{p.name}</span>
                    <span className="text-[10px] text-white/40 shrink-0 mr-2">{fmtCurrency(Number(p.sell_price))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 56 }}>
            <label className="text-[10px] font-bold text-white/50 mb-1 block">الكمية</label>
            <input type="number" min={1} value={addQty} onChange={(e) => setAddQty(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none text-center" />
          </div>
          <div style={{ width: 80 }}>
            <label className="text-[10px] font-bold text-white/50 mb-1 block">السعر</label>
            <input type="number" min={0} step="any" value={addPrice} onChange={(e) => setAddPrice(e.target.value)}
              placeholder="0.00" dir="ltr"
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none" />
          </div>
          <button type="button" onClick={addPartLine} disabled={!selectedProduct}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-30 shrink-0"
            style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}>
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>

        <div className="mt-2">
          <button type="button" onClick={() => setShowExtForm(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(192,132,252,0.3)", color: "#D8B4FE" }}>
            <Wrench className="w-3 h-3" /> {showExtForm ? "إغلاق" : "+ إصلاح خارجي (ورشة برّا)"}
          </button>
        </div>

        {showExtForm && (
          <div className="mt-2 p-3 rounded-xl flex flex-wrap gap-2 items-end"
            style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] font-bold text-purple-200/70 mb-1 block">وصف الإصلاح</label>
              <input value={extDesc} onChange={(e) => setExtDesc(e.target.value)} placeholder="مثلاً: تغيير شاشة"
                className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-purple-400/25 text-[11px] text-white focus:outline-none focus:border-purple-400/50" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-purple-200/70 mb-1 block">اسم الورشة (اختياري)</label>
              <input value={extVendor} onChange={(e) => setExtVendor(e.target.value)} placeholder="ورشة الأمل"
                className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-purple-400/25 text-[11px] text-white focus:outline-none focus:border-purple-400/50" />
            </div>
            <div style={{ width: 110 }}>
              <label className="text-[10px] font-bold text-purple-200/70 mb-1 block">التكلفة على العميل</label>
              <input type="number" min={0} step="any" value={extPrice} onChange={(e) => setExtPrice(e.target.value)} placeholder="0.00" dir="ltr"
                className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-purple-400/25 text-[11px] text-white focus:outline-none focus:border-purple-400/50" />
            </div>
            <button type="button" onClick={addExternalLine}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0"
              style={{ background: "rgba(168,85,247,0.25)", border: "1px solid rgba(192,132,252,0.4)", color: "#E9D5FF" }}>
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </div>
        )}

        {partLines.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {partLines.map(l => {
              const d = lineDiscountAmount(l);
              const isExt = l.source === 'external';
              const cardStyle = isExt
                ? { background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.22)" }
                : { background: "rgba(59,130,246,0.06)",  border: "1px solid rgba(59,130,246,0.15)" };
              return (
                <div key={l.id} className="px-3 py-2 rounded-xl" style={cardStyle}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPartLines(prev => prev.filter(x => x.id !== l.id))}
                      className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400"
                      style={{ background: "rgba(239,68,68,0.08)" }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {isExt && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                        style={{ background: "rgba(168,85,247,0.2)", color: "#E9D5FF", border: "1px solid rgba(192,132,252,0.35)" }}>
                        <Wrench className="w-2.5 h-2.5 inline-block ml-0.5" /> خارجي
                      </span>
                    )}
                    <span className="flex-1 text-[11px] text-white/80 truncate">{l.product_name}</span>
                    <span className="text-[10px] text-white/50 shrink-0">{l.quantity} × {fmtCurrency(l.unit_price)}</span>
                    <span className={`text-[11px] font-bold shrink-0 ${isExt ? "text-purple-300" : "text-blue-300"}`}>{fmtCurrency(lineNet(l))}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-7">
                    <span className="text-[10px] text-white/45">خصم على الصنف:</span>
                    <input type="number" min={0} step="any" value={l.discount_value}
                      onChange={(e) => updateLineDiscount(l.id, parseFloat(e.target.value) || 0, l.discount_mode)}
                      className="w-20 px-2 py-0.5 rounded-md bg-white/[0.03] border border-amber-400/20 text-[10px] text-white text-center focus:outline-none" dir="ltr" />
                    <button type="button"
                      onClick={() => updateLineDiscount(l.id, l.discount_value, l.discount_mode === 'pct' ? 'amt' : 'pct')}
                      className="w-6 h-6 rounded-md text-[10px] font-black text-amber-300 border border-amber-400/30 hover:bg-amber-400/10">
                      {l.discount_mode === 'pct' ? '%' : 'ج'}
                    </button>
                    {d > 0 && <span className="text-[10px] font-bold text-red-300">- {fmtCurrency(d)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* الإجمالي */}
      <div className="px-5 py-3 border-b border-white/5 bg-white/[0.015]">
        <div className="flex items-center justify-between text-[12px] font-black">
          <span className="text-white">الإجمالي المستحق على العميل</span>
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
              <div key={row.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${row.type === "credit" ? "bg-indigo-500/8 border border-indigo-500/20" : "bg-emerald-500/8 border border-emerald-500/20"}`}>
                <button type="button" onClick={() => setPayRows(prev => prev.filter(r => r.id !== row.id))}
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400"
                  style={{ background: "rgba(239,68,68,0.08)" }}>
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
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`, background: payIsDone ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FBBF24)" }} />
            </div>
          </div>
        )}

        {!payIsDone && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <button onClick={() => setPayType("cash")} className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "cash" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-white/[0.03] text-white/50 border border-white/10"}`}>
                <Coins className="w-3 h-3" /> نقدي
              </button>
              <button onClick={() => setPayType("credit")} className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === "credit" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40" : "bg-white/[0.03] text-white/50 border border-white/10"}`}>
                <Clock className="w-3 h-3" /> آجل
              </button>
            </div>
            <div className="flex gap-1.5 items-stretch">
              {payType === "cash" && safes.length > 0 ? (
                <select value={paySafe ?? ""} onChange={(e) => setPaySafe(parseInt(e.target.value) || null)}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none">
                  {safes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div className="flex-1 flex items-center justify-end text-[11px] text-indigo-300/70 px-2 rounded-lg bg-indigo-500/5 border border-indigo-500/15">ائتمان العميل</div>
              )}
              <div className="relative shrink-0" style={{ width: 96 }}>
                <input type="number" min={0} step="any" value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPayRow(); } }}
                  onFocus={(e) => e.target.select()}
                  placeholder={grandTotal > 0 ? remaining.toFixed(0) : "0"}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white placeholder:text-white/30 focus:outline-none" dir="ltr" />
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-white/30">ج.م</span>
              </div>
              <button type="button" onClick={addPayRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0"
                style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(52,211,153,0.3)", color: "#6EE7B7" }}>
                <Plus className="w-3.5 h-3.5" /> إضافة
              </button>
              {remaining > 0 && (
                <button type="button" onClick={fillAll}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold shrink-0 text-amber-300"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                  كل المبلغ
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* الوسيط */}
      <div className="px-5 pt-3 pb-4">
        <h4 className="text-[12px] font-black text-white/80 mb-3 flex items-center gap-2">
          <UserCog className="w-3.5 h-3.5 text-violet-400" /> الوسيط (اختياري)
        </h4>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-white/50 mb-1 block">اسم الوسيط</label>
            <input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="اتركه فارغاً إن لم يكن هناك وسيط"
              className="w-full px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none" />
          </div>
          <div style={{ width: 100 }}>
            <label className="text-[10px] text-white/50 mb-1 block">العمولة (ج.م)</label>
            <input type="number" min={0} step="any" value={brokerComm} onChange={(e) => setBrokerComm(e.target.value)} placeholder="0" dir="ltr"
              className="w-full px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-[11px] text-white focus:outline-none" />
          </div>
        </div>
      </div>

      {/* طريقة الدفع عند التسليم (من RepairExtensions) */}
      <div className="px-5 pt-3 pb-4 border-t border-white/5">
        <DeliveryPaymentSection
          value={deliveryPayment}
          onChange={setDeliveryPayment}
          safes={safes}
        />
      </div>
    </div>
  );
}
