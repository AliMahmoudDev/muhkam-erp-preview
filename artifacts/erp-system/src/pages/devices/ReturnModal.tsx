import { useState } from "react";
import { RotateCcw, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Device } from './types';
import { apiPost } from './index';

/* ════════════════════════════════════════════════════════
   RETURN DEVICE MODAL
════════════════════════════════════════════════════════ */
export const RETURN_REASONS = [
  "عيب مصنعي",
  "الجهاز لا يعمل بشكل صحيح",
  "لم يعجب العميل",
  "وجد جهاز آخر",
  "تغيير رأي العميل",
  "الجهاز تالف",
  "خلاف على السعر",
  "أخرى",
];

export function ReturnModal({ device, onClose, onDone }: { device: Device; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleReturn = async () => {
    setSaving(true);
    try {
      await apiPost(`/api/devices/${device.id}/return`, {
        return_reason: reason === "أخرى" ? customReason.trim() || "أخرى" : reason,
      });
      toast({ title: "✅ تم إرجاع الجهاز وأصبح متاحاً" });
      onDone(); onClose();
    } catch {
      toast({ title: "خطأ في عملية الإرجاع", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const returnPrice = device.sold_price ?? device.sale_price;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="glass-panel rounded-2xl border border-amber-500/20 w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-ink">إرجاع الجهاز من العميل</span>
          </div>
          <button onClick={onClose} className="btn-icon text-ink/40 hover:text-ink">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Device info */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 text-sm space-y-1">
            <p className="text-ink/80 font-bold">{device.brand} {device.model}</p>
            <p className="text-ink/40 text-xs">{device.device_no} — {device.color ?? ""}</p>
            {device.sold_to_customer_name && (
              <p className="text-ink/50 text-xs">العميل: {device.sold_to_customer_name}</p>
            )}
          </div>

          {/* Return price (read-only, equals sale price) */}
          <div>
            <label className="text-[11px] text-ink/40 mb-1 block text-right">سعر الإرجاع (نفس سعر الفاتورة)</label>
            <div className="erp-input w-full text-sm flex items-center justify-between opacity-70 cursor-not-allowed">
              <span className="text-emerald-300 font-bold">
                {parseFloat(returnPrice ?? "0").toLocaleString("ar-EG")} ج.م
              </span>
              <span className="text-ink/30 text-xs">غير قابل للتعديل</span>
            </div>
          </div>

          {/* Return reason */}
          <div>
            <label className="text-[11px] text-ink/40 mb-1 block text-right">سبب الإرجاع *</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="erp-input w-full text-sm">
              {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === "أخرى" && (
              <input value={customReason} onChange={e => setCustomReason(e.target.value)}
                placeholder="اكتب سبب الإرجاع" className="erp-input w-full text-sm mt-1.5" />
            )}
          </div>

          <p className="text-[11px] text-amber-400/70 bg-amber-500/8 border border-amber-500/15 rounded-lg p-2.5">
            سيتم إرجاع الجهاز لحالة «متاح» وحفظ سبب الإرجاع في ملاحظات الجهاز.
          </p>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-line text-ink/50 text-sm hover:text-ink/80">
            إلغاء
          </button>
          <button onClick={handleReturn} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            تأكيد الإرجاع
          </button>
        </div>
      </div>
    </div>
  );
}
