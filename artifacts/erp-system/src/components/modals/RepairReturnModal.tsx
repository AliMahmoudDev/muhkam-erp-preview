import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Loader2, AlertTriangle, CheckCircle2, Package, Trash2, Wallet } from "lucide-react";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { safeArray } from "@/lib/safe-data";
import { useAuth } from "@/contexts/auth";

interface SafeRow { id: number; name: string; balance: string | number; }

interface JobPart {
  id: number;
  product_name: string;
  quantity: number | string;
  unit_price: number | string;
  source?: string | null;
  warehouse_id?: number | null;
  is_returned?: boolean;
}

type PartDisposition = "stock" | "scrap" | "ignore";

interface Props {
  jobId: number;
  jobNo: string;
  finalCost: number | string;
  customerName: string;
  parts: JobPart[];
  onClose: () => void;
  onDone: () => void;
}

export default function RepairReturnModal({
  jobId, jobNo, finalCost, customerName, parts, onClose, onDone,
}: Props) {
  const availableParts = parts.filter((p) => !p.is_returned);

  const { user } = useAuth();
  const { data: safesRaw } = useGetSettingsSafes();
  const allSafes: SafeRow[] = safeArray(safesRaw) as SafeRow[];
  const isScopedRole = user?.role === "cashier" || user?.role === "salesperson";
  const safes = isScopedRole && user?.safe_id
    ? allSafes.filter((s) => s.id === user.safe_id)
    : allSafes;

  const [refundAmount, setRefundAmount]   = useState(String(Number(finalCost ?? 0).toFixed(2)));
  const [safeId, setSafeId]               = useState<string>("");
  const [problemDesc, setProblemDesc]     = useState("");
  const [notes, setNotes]                 = useState("");

  /* Auto-select الخزنة الوحيدة المتاحة */
  useEffect(() => {
    if (safes.length === 1 && !safeId) setSafeId(String(safes[0].id));
  }, [safes.length]);
  const [dispositions, setDispositions]   = useState<Record<number, PartDisposition>>(() => {
    const d: Record<number, PartDisposition> = {};
    for (const p of availableParts) {
      d[p.id] = p.warehouse_id ? "stock" : "ignore";
    }
    return d;
  });
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [done, setDone]                   = useState(false);

  function setDisp(partId: number, value: PartDisposition) {
    setDispositions((prev) => ({ ...prev, [partId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!problemDesc.trim()) { setError("يرجى وصف سبب الإرجاع"); return; }
    const amount = Number(refundAmount);
    if (isNaN(amount) || amount < 0) { setError("المبلغ المسترد غير صحيح"); return; }
    if (amount > 0 && !safeId)       { setError("يرجى اختيار الخزنة لخصم المبلغ المسترد منها"); return; }

    const partsPayload = availableParts
      .filter((p) => dispositions[p.id] !== "ignore")
      .map((p) => ({ part_id: p.id, destination: dispositions[p.id] }));

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repair-jobs/${jobId}/customer-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          refund_amount:       amount,
          safe_id:             amount > 0 ? Number(safeId) : null,
          problem_description: problemDesc.trim(),
          notes:               notes.trim() || null,
          parts:               partsPayload,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "حدث خطأ"); setLoading(false); return; }
      setDone(true);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  const dispLabel: Record<PartDisposition, string> = {
    stock:  "أعد للمخزن",
    scrap:  "توالف",
    ignore: "لا شيء",
  };
  const dispColor: Record<PartDisposition, string> = {
    stock:  "emerald",
    scrap:  "red",
    ignore: "white",
  };

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget && !done) onClose(); }}
    >
      <div
        className="rounded-2xl border w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
        style={{ background: "rgba(10,8,25,0.98)", borderColor: "rgba(239,68,68,0.3)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <RotateCcw className="w-4.5 h-4.5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">مرتجع عميل</h3>
              <p className="text-[10px] text-white/40">بطاقة صيانة {jobNo} · {customerName}</p>
            </div>
          </div>
          {!done && (
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Done */}
        {done ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}>
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-black text-base">تم تسجيل المرتجع</p>
              <p className="text-white/50 text-xs mt-1">تم استرداد المبلغ وتحديث القطع</p>
            </div>
            <button
              onClick={onDone}
              className="mt-4 px-6 py-2.5 rounded-xl text-xs font-black text-white transition-all"
              style={{ background: "rgba(16,185,129,0.4)", border: "1px solid rgba(16,185,129,0.4)" }}
            >
              حسناً
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col overflow-hidden">
            <div className="overflow-y-auto p-5 space-y-4">

              {/* Refund amount */}
              <div>
                <label className="block text-[11px] font-bold text-white/60 mb-1.5">المبلغ المُسترد <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder:text-white/25 outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/40">ج.م</span>
                </div>
              </div>

              {/* Safe selector — يظهر فقط عند وجود مبلغ مسترد */}
              {Number(refundAmount) > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1.5 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    الخزنة (لخصم المبلغ المسترد منها) <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={safeId}
                    onChange={(e) => setSafeId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs text-white outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
                  >
                    <option value="" className="bg-[#1a1530]">— اختر الخزنة —</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#1a1530]">
                        {s.name} — رصيد: {Number(s.balance).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {safes.length === 0 && (
                    <p className="text-[10px] text-amber-400/80 mt-1">⚠ لا توجد خزن متاحة لحسابك</p>
                  )}
                </div>
              )}

              {/* Problem description */}
              <div>
                <label className="block text-[11px] font-bold text-white/60 mb-1.5">سبب الإرجاع / وصف المشكلة <span className="text-red-400">*</span></label>
                <textarea
                  value={problemDesc}
                  onChange={(e) => setProblemDesc(e.target.value)}
                  rows={2}
                  placeholder="اكتب سبب إرجاع الجهاز..."
                  className="w-full rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/25 outline-none resize-none transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>

              {/* Parts disposition */}
              {availableParts.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-2">مصير القطع المستخدمة</label>
                  <div className="space-y-2">
                    {availableParts.map((part) => {
                      const disp = dispositions[part.id] ?? "ignore";
                      return (
                        <div
                          key={part.id}
                          className="rounded-xl p-3"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div>
                              <p className="text-[12px] font-bold text-white">{part.product_name}</p>
                              <p className="text-[10px] text-white/40">الكمية: {Number(part.quantity)} · السعر: {Number(part.unit_price).toFixed(2)} ج.م</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {(["stock", "scrap", "ignore"] as PartDisposition[]).map((d) => {
                              const isActive = disp === d;
                              const color = dispColor[d];
                              const Icon = d === "stock" ? Package : d === "scrap" ? Trash2 : X;
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setDisp(part.id, d)}
                                  disabled={d === "stock" && !part.warehouse_id}
                                  className={[
                                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
                                    isActive
                                      ? `bg-${color}-500/25 border-${color}-500/50 text-${color}-300`
                                      : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20",
                                    d === "stock" && !part.warehouse_id ? "opacity-30 cursor-not-allowed" : "",
                                  ].join(" ")}
                                >
                                  <Icon className="w-3 h-3" />
                                  {dispLabel[d]}
                                </button>
                              );
                            })}
                          </div>
                          {!part.warehouse_id && disp === "stock" && (
                            <p className="text-[9px] text-amber-400/80 mt-1">⚠ هذه القطعة بدون مخزن محدد — لن تُعاد للمخزن</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableParts.length === 0 && (
                <div className="rounded-xl p-3 text-center text-[11px] text-white/30" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  لا توجد قطع مسجّلة على هذه البطاقة
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-white/60 mb-1.5">ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                  className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-1.5 p-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <p className="text-[11px] text-red-300">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-5 pt-0 shrink-0">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(239,68,68,0.55)", border: "1px solid rgba(239,68,68,0.4)" }}
              >
                {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</> : <><RotateCcw className="w-3.5 h-3.5" /> تسجيل المرتجع</>}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border text-xs text-white/60 hover:text-white transition-all disabled:opacity-40"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
