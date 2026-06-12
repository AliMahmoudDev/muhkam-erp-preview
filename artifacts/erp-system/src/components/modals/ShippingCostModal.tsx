/**
 * ShippingCostModal — بوّابة "قيد الشحن" → "تم التسليم"
 *
 * يستقبل من المستخدم: تكلفة الشحن + الخزنة التي ستُخصم منها + ملاحظة.
 * عند الحفظ:
 *   POST /api/repair-jobs/:id/shipping
 *     - إن كانت التكلفة > 0 → ينشئ مصروفاً تلقائياً + يخصم من الخزنة + يُسجل قيد محاسبي.
 *     - إن كانت = 0 → يُسجَّل فقط أنه لا يوجد شحن مدفوع (لا مصروف).
 *   ثم onSaved() — يطلب من الأب نقل البطاقة إلى delivered.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Truck, Loader2, X, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { useGetSettingsSafes } from "@workspace/api-client-react";
import { safeArray } from "@/lib/safe-data";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";

interface JobLite {
  id: number;
  job_no: string;
  shipping_cost?: string | number | null;
}

interface Props {
  job: JobLite;
  onClose: () => void;
  onSaved: () => void;
}

interface SafeRow { id: number; name: string; balance: string | number; }

export default function ShippingCostModal({ job, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: safesRaw } = useGetSettingsSafes();
  const allSafes: SafeRow[] = safeArray(safesRaw) as SafeRow[];

  const isScopedRole = user?.role === "cashier" || user?.role === "salesperson";
  const safes = isScopedRole && user?.safe_id
    ? allSafes.filter((s) => s.id === user.safe_id)
    : allSafes;

  const [cost, setCost]       = useState<string>(String(job.shipping_cost ?? "0"));
  const [safeId, setSafeId]   = useState<string>("");
  const [notes, setNotes]     = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<string[]>([]);

  useEffect(() => {
    if (safes.length === 1 && !safeId) setSafeId(String(safes[0].id));
  }, [safes.length]);

  const numericCost = Number(cost);
  const isZero      = !Number.isFinite(numericCost) || numericCost === 0;
  const needsSafe   = !isZero;

  async function handleSave() {
    if (!Number.isFinite(numericCost) || numericCost < 0) {
      setErrors(["تكلفة الشحن غير صحيحة"]);
      return;
    }
    if (needsSafe && !safeId) {
      setErrors(["يجب اختيار خزنة لخصم تكلفة الشحن منها"]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      const res = await authFetch(api(`/api/repair-jobs/${job.id}/shipping`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_cost: numericCost,
          safe_id:       needsSafe ? Number(safeId) : null,
          notes:         notes.trim() || undefined,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setErrors([data.error ?? "تعذّر تسجيل تكلفة الشحن"]);
        setLoading(false);
        return;
      }
      toast({
        title: "تم تسجيل تكلفة الشحن",
        description: isZero ? "تم تأكيد عدم وجود تكلفة شحن" : `تم خصم ${numericCost.toFixed(2)} ج وإنشاء مصروف تلقائي`,
      });
      onSaved();
    } catch {
      setErrors(["تعذّر الاتصال بالخادم"]);
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl border border-line w-full max-w-md shadow-2xl"
        style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
              <Truck className="w-4.5 h-4.5 text-sky-300" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">تسجيل تكلفة الشحن</h3>
              <p className="text-[11px] text-ink/50">البطاقة <span className="text-ink font-bold">{job.job_no}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-ink/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-ink/55 mb-1">تكلفة الشحن (ج.م)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-sm text-ink focus:outline-none focus:border-sky-400/40"
              placeholder="0.00"
            />
            <p className="text-[10px] text-ink/40 mt-1">
              {isZero
                ? "أدخل 0 لتأكيد عدم وجود تكلفة شحن (لن يُنشأ مصروف)."
                : "سيتم إنشاء مصروف تلقائياً تحت فئة \"مصاريف شحن صيانة\" وخصم المبلغ من الخزنة."}
            </p>
          </div>

          {needsSafe && (
            <div>
              <label className="block text-[10px] font-bold text-ink/55 mb-1">الخزنة المختارة</label>
              <select
                value={safeId}
                onChange={(e) => setSafeId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-[11px] text-ink focus:outline-none focus:border-sky-400/40"
              >
                <option value="">— اختر الخزنة —</option>
                {safes.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#1a1530]">
                    {s.name} — رصيد: {Number(s.balance).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-ink/55 mb-1">ملاحظة (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-[11px] text-ink placeholder:text-ink/30 focus:outline-none focus:border-sky-400/40"
              placeholder="مثلاً: شحن عبر أرامكس - نمرة الشحنة 12345..."
            />
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mx-5 mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <p className="text-[11px] font-bold text-red-400">خطأ:</p>
            </div>
            <ul className="list-disc list-inside">
              {errors.map((e, i) => <li key={i} className="text-[11px] text-red-300">{e}</li>)}
            </ul>
          </div>
        )}

        <div className="px-5 py-4 border-t border-line flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-ink text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{ background: "rgba(14,165,233,0.7)", border: "1px solid rgba(56,189,248,0.4)" }}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الحفظ...</>
              : <><Truck className="w-3.5 h-3.5" /> {isZero ? "تأكيد بدون تكلفة وانتقال إلى \"تم التسليم\"" : "حفظ تكلفة الشحن وانتقال إلى \"تم التسليم\""}</>}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-line text-ink/60 hover:text-ink text-xs"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
