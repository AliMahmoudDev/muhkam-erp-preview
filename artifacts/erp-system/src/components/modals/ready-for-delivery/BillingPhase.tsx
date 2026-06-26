import { useRef } from 'react';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/format';
import {
  Loader2,
  X,
  Coins,
  Clock,
  Wrench,
  Package,
  PackageCheck,
  UserCog,
  ChevronLeft,
} from 'lucide-react';
import { safeArray } from '@/lib/safe-data';
import { JobLite, Product, PayRow, PayType, PartLine } from './types';
import { Combobox } from '@/components/ui/combobox';

function fmtCurrency(n: number) {
  return formatCurrency(n);
}

interface BillingPhaseProps {
  job: JobLite;
  phase: 'billing';
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
  serviceLines: Array<{
    id: number;
    service_type_name_snapshot: string;
    amount: string | number;
    technician_name: string | null;
    linked_parts?: Array<{ id: number; product_name: string; quantity_allocated?: string }>;
  }>;
  billingLoading: boolean;
  billingErrors: string[];
  onBillingSave: () => void;
  onClose: () => void;
  onBack: () => void;
}

export default function BillingPhase({
  job,
  partLines,
  setPartLines,
  payRows,
  setPayRows,
  payType,
  setPayType,
  paySafe,
  setPaySafe,
  payAmount,
  setPayAmount,
  brokerName,
  setBrokerName,
  brokerComm,
  setBrokerComm,
  serviceLines,
  billingLoading,
  billingErrors,
  onBillingSave,
  onClose,
  onBack,
}: BillingPhaseProps) {
  /* these props remain in the interface so ReadyForDeliveryModal can still pass them
     for potential future use; they are intentionally unused in the current render */
  void partLines;
  void setPartLines;
  const productSearchRef = useRef<HTMLInputElement>(null);
  void productSearchRef;

  const { data: safesRaw } = useGetSettingsSafes();
  const safes = safeArray(safesRaw) as { id: number; name: string }[];

  const servicesTotal = serviceLines.reduce((s, sv) => s + Number(sv.amount ?? 0), 0);
  const finalCostBase = Number(job.final_cost ?? 0);
  /* إجمالي العميل = مجموع بنود الخدمة فقط (أو التكلفة المسجّلة إن لم تكن هناك خدمات) */
  const grandTotal = servicesTotal > 0 ? servicesTotal : finalCostBase;
  const paidSoFar = payRows.reduce((s, r) => s + r.amount, 0);
  const remaining = Math.max(0, grandTotal - paidSoFar);
  const payIsDone = grandTotal > 0 ? paidSoFar >= grandTotal - 0.005 : payRows.length > 0;

  function addPayRow() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || amt > remaining + 0.05) return;
    setPayRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: payType,
        safe_id: payType === 'cash' ? (paySafe ?? safes[0]?.id ?? null) : null,
        amount: Math.min(amt, remaining),
      },
    ]);
    setPayAmount('');
  }

  function fillAll() {
    if (remaining <= 0) return;
    setPayRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type: payType,
        safe_id: payType === 'cash' ? (paySafe ?? safes[0]?.id ?? null) : null,
        amount: remaining,
      },
    ]);
    setPayAmount('');
  }

  return (
    <>
      <div className="overflow-y-auto max-h-[68vh]">
        {/* ── فاتورة العميل — بنود الخدمة ── */}
        <div className="px-5 pt-4 pb-3 border-b border-line">
          <h4 className="text-[12px] font-black text-ink/80 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[9px] text-emerald-300 font-black">
              ١
            </span>
            <Wrench className="w-3.5 h-3.5 text-emerald-400/70" />
            بنود الخدمة
          </h4>

          {serviceLines.length === 0 ? (
            <div className="rounded-xl border border-line p-4 text-center">
              <p className="text-[11px] text-ink/40">لا توجد بنود خدمة مسجّلة</p>
              {finalCostBase > 0 && (
                <p className="text-[11px] text-ink/60 mt-1">
                  التكلفة المسجّلة:{' '}
                  <span className="font-bold text-ink">{fmtCurrency(finalCostBase)}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {serviceLines.map((sv, idx) => {
                const amt = Number(sv.amount ?? 0);
                const parts = sv.linked_parts ?? [];
                return (
                  <div key={sv.id} className="rounded-xl border border-line bg-surface p-3">
                    {/* رقم + اسم الخدمة + المبلغ */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[9px] text-emerald-300 font-black mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-ink truncate">
                            {sv.service_type_name_snapshot || 'خدمة'}
                          </p>
                          {/* قطع الغيار المرتبطة — الأسماء فقط للعميل */}
                          {parts.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {parts.map((p) => (
                                <span
                                  key={p.id}
                                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300/80"
                                >
                                  <Package className="w-2.5 h-2.5 shrink-0" />
                                  {p.product_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] font-black text-emerald-300 font-mono tabular-nums">
                        {fmtCurrency(amt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ملخص الإجمالي ── */}
        <div className="px-5 py-3 border-b border-line bg-surface">
          {servicesTotal > 0 && (
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-ink/50">مجموع بنود الخدمة</span>
              <span className="font-bold text-emerald-300">{fmtCurrency(servicesTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[13px] font-black pt-1 border-t border-line">
            <span className="text-ink">الإجمالي المستحق</span>
            <span className="text-lime-300">{fmtCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* طريقة الدفع */}
        <div className="px-5 pt-4 pb-3 border-b border-line">
          <h4 className="text-[12px] font-black text-ink/80 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-[9px] text-emerald-300 font-black">
              ٢
            </span>
            طريقة الدفع
          </h4>

          {payRows.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {payRows.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${row.type === 'credit' ? 'bg-blue-500/8 border border-blue-500/20' : 'bg-emerald-500/8 border border-emerald-500/20'}`}
                >
                  <button
                    type="button"
                    onClick={() => setPayRows((prev) => prev.filter((r) => r.id !== row.id))}
                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span
                    className={`text-[11px] font-bold shrink-0 flex items-center gap-1 ${row.type === 'credit' ? 'text-blue-400' : 'text-emerald-400'}`}
                  >
                    {row.type === 'cash' ? (
                      <Coins className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {row.type === 'cash'
                      ? (safes.find((s) => s.id === row.safe_id)?.name ?? 'نقدي')
                      : 'آجل'}
                  </span>
                  <span className="font-black text-sm text-ink mr-auto">
                    {fmtCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {grandTotal > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-ink/50 mb-1">
                <span>{payIsDone ? '✓ مكتمل' : `متبقي: ${fmtCurrency(remaining)}`}</span>
                <span>{Math.min(100, Math.round((paidSoFar / grandTotal) * 100))}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-surface">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`,
                    background: payIsDone
                      ? 'linear-gradient(90deg,#10B981,#34D399)'
                      : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
                  }}
                />
              </div>
            </div>
          )}

          {!payIsDone && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPayType('cash')}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === 'cash' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-surface text-ink/50 border border-line hover:bg-surface'}`}
                >
                  <Coins className="w-3 h-3" /> نقدي
                </button>
                <button
                  onClick={() => setPayType('credit')}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${payType === 'credit' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-surface text-ink/50 border border-line hover:bg-surface'}`}
                >
                  <Clock className="w-3 h-3" /> آجل
                </button>
              </div>
              <div className="flex gap-1.5 items-stretch">
                {payType === 'cash' && safes.length > 0 ? (
                  <Combobox
                    options={safes.map((s) => ({ value: String(s.id), label: s.name }))}
                    value={paySafe ? String(paySafe) : ''}
                    onChange={(v) => setPaySafe(v ? parseInt(v) : null)}
                    className="flex-1 min-w-0 text-[11px]"
                    searchable={false}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-end text-[11px] text-blue-300/70 px-2 rounded-lg bg-blue-500/5 border border-blue-500/15">
                    ائتمان العميل
                  </div>
                )}
                <div className="relative shrink-0" style={{ width: 100 }}>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPayRow();
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    placeholder={grandTotal > 0 ? remaining.toFixed(0) : '0'}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-emerald-400/40"
                    dir="ltr"
                  />
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none text-ink/30">
                    ج.م
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={addPayRow}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-ink/80 hover:text-ink transition-all"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--edge-md)',
                  }}
                >
                  ↵ تأكيد
                </button>
                <button
                  onClick={fillAll}
                  disabled={remaining <= 0}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-emerald-300 hover:text-ink transition-all disabled:opacity-30"
                  style={{
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  كل المتبقي ({fmtCurrency(remaining)})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* الوسيط */}
        <div className="px-5 pt-4 pb-4">
          <h4 className="text-[12px] font-black text-ink/80 mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-[9px] text-amber-300 font-black">
              ٣
            </span>
            <UserCog className="w-3.5 h-3.5 text-amber-300" />
            الوسيط (اختياري)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-ink/50 mb-1 block">اسم الوسيط</label>
              <input
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="اسم الوسيط..."
                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-amber-400/40"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-ink/50 mb-1 block">
                قيمة العمولة (ج.م)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={brokerComm}
                onChange={(e) => setBrokerComm(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-amber-400/40"
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
            {billingErrors.map((e, i) => (
              <li key={i} className="text-[11px] text-red-300">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-4 border-t border-line flex flex-wrap gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line text-ink/60 hover:text-ink text-xs transition-all"
          disabled={billingLoading}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          رجوع للفحص
        </button>
        <button
          onClick={onBillingSave}
          disabled={billingLoading}
          className="flex-1 min-w-[200px] py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          style={{
            background: 'rgba(132,204,22,0.85)',
            border: '1px solid rgba(163,230,53,0.5)',
            color: 'var(--text-1)',
          }}
        >
          {billingLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-1)' }} />{' '}
              جارٍ الحفظ...
            </>
          ) : (
            <>
              <PackageCheck className="w-3.5 h-3.5" /> حفظ وتأكيد "جاهز للتسليم"
            </>
          )}
        </button>
        <button
          onClick={onClose}
          disabled={billingLoading}
          className="px-4 py-2.5 rounded-xl border border-line text-ink/60 hover:text-ink text-xs"
        >
          إلغاء
        </button>
      </div>
    </>
  );
}
