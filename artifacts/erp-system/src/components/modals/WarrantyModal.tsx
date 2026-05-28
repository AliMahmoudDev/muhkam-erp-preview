import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, ShieldCheck, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { REPAIR_SETTING_KEYS } from "@/components/RepairSettingsModal";

interface Props {
  jobId: number;
  jobNo: string;
  customerName: string;
  deviceBrand: string;
  deviceModel: string;
  onClose: () => void;
  onCreated: (newJobId: number, newJobNo: string) => void;
}

export default function WarrantyModal({
  jobId, jobNo, customerName, deviceBrand, deviceModel,
  onClose, onCreated,
}: Props) {
  const [problemDescription, setProblemDescription] = useState("");
  const [notes, setNotes]                           = useState("");
  const [loading, setLoading]                       = useState(false);
  const [error, setError]                           = useState<string | null>(null);
  const [created, setCreated]                       = useState<{ id: number; job_no: string } | null>(null);

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/system"],
    queryFn: () => authFetch(api("/api/settings/system")).then(r => r.json()),
    staleTime: 60_000,
  });
  const warrantyDays = Number(settings[REPAIR_SETTING_KEYS.warrantyDays] ?? "30") || 30;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!problemDescription.trim()) {
      setError("يرجى وصف المشكلة");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/repair-jobs/${jobId}/create-warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_description: problemDescription.trim(), notes: notes.trim() || null }),
      });
      const data = await res.json() as { error?: string; id?: number; job_no?: string };
      if (!res.ok) { setError(data.error ?? "حدث خطأ"); setLoading(false); return; }
      setCreated({ id: data.id!, job_no: data.job_no! });
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
      dir="rtl"
      onClick={(e) => { if (e.target === e.currentTarget && !created) onClose(); }}
    >
      <div
        className="rounded-2xl border w-full max-w-md shadow-2xl overflow-hidden"
        style={{ background: "rgba(10,8,25,0.98)", borderColor: "rgba(139,92,246,0.35)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)" }}>
              <ShieldCheck className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">فتح طلب ضمان</h3>
              <p className="text-[10px] text-white/40">مرتبط بـ {jobNo}</p>
            </div>
          </div>
          {!created && (
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Created success */}
        {created ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}>
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-black text-base">تم فتح بطاقة الضمان</p>
              <p className="text-white/50 text-xs mt-1">رقم البطاقة الجديدة: <span className="text-violet-300 font-bold">{created.job_no}</span></p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => onCreated(created.id, created.job_no)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all"
                style={{ background: "rgba(139,92,246,0.6)", border: "1px solid rgba(139,92,246,0.5)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                انتقل للبطاقة الجديدة
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border text-xs text-white/60 hover:text-white transition-all"
                style={{ borderColor: "rgba(255,255,255,0.12)" }}
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="p-5 space-y-4">
            {/* Device info */}
            <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-1.5 text-white/50">
                <span className="font-bold text-white/80">{customerName}</span>
                <span>·</span>
                <span>{deviceBrand} {deviceModel}</span>
              </div>
              <p className="text-[10px] text-white/30">سيتم نسخ بيانات العميل والجهاز تلقائياً للبطاقة الجديدة</p>
            </div>

            {/* Problem description */}
            <div>
              <label className="block text-[11px] font-bold text-white/60 mb-1.5">وصف المشكلة الجديدة <span className="text-red-400">*</span></label>
              <textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                rows={3}
                placeholder="اكتب وصف مشكلة الضمان..."
                className="w-full rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/25 outline-none resize-none transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold text-white/60 mb-1.5">ملاحظات إضافية (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="هل يوجد تكلفة إضافية؟ تفاصيل أخرى؟"
                className="w-full rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              />
            </div>

            {/* Info note */}
            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-violet-300/80 leading-relaxed">
                ستُنشأ بطاقة صيانة جديدة مرتبطة بالبطاقة الأصلية برقم <strong>{jobNo}/W1</strong>. ستمر البطاقة بالمسار المعتاد من الاستقبال.
                <br />
                <span className="text-[10px] text-violet-200/70">مدة الضمان الافتراضية: <strong>{warrantyDays}</strong> يوم من تاريخ التسليم الأصلي.</span>
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <p className="text-[11px] text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: "rgba(139,92,246,0.65)", border: "1px solid rgba(139,92,246,0.45)" }}
              >
                {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الإنشاء...</> : <><ShieldCheck className="w-3.5 h-3.5" /> إنشاء بطاقة الضمان</>}
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
