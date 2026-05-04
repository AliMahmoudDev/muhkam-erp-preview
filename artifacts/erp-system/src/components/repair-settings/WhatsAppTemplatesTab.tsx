import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { REPAIR_SETTING_KEYS, REPAIR_WA_DEFAULTS } from "./shared";

const WA_PLACEHOLDERS: Array<{ key: string; desc: string }> = [
  { key: "{{اسم_العميل}}",   desc: "اسم العميل" },
  { key: "{{رقم_البطاقة}}",  desc: "رقم بطاقة الصيانة" },
  { key: "{{الماركة}}",      desc: "ماركة الجهاز" },
  { key: "{{الموديل}}",      desc: "موديل الجهاز" },
  { key: "{{الحالة}}",       desc: "الحالة الحالية" },
  { key: "{{التكلفة}}",      desc: "التكلفة الإجمالية" },
];

export default function WhatsAppTemplatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/system"],
    queryFn: () => authFetch(api("/api/settings/system")).then(r => r.json()),
    staleTime: 30_000,
  });

  const [readyBuf, setReadyBuf]       = useState("");
  const [progressBuf, setProgressBuf] = useState("");
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    setReadyBuf(settings[REPAIR_SETTING_KEYS.waReady] || REPAIR_WA_DEFAULTS.ready);
    setProgressBuf(settings[REPAIR_SETTING_KEYS.waProgress] || REPAIR_WA_DEFAULTS.progress);
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      for (const [k, v] of [
        [REPAIR_SETTING_KEYS.waReady, readyBuf] as const,
        [REPAIR_SETTING_KEYS.waProgress, progressBuf] as const,
      ]) {
        const r = await authFetch(api("/api/settings/system"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: k, value: v }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e?.error || "تعذّر الحفظ");
        }
      }
      await qc.invalidateQueries({ queryKey: ["/api/settings/system"] });
      toast({ title: "✓ تم حفظ القوالب" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      toast({ title: msg || "تعذّر الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const resetTo = (which: "ready" | "progress") => {
    if (which === "ready")    setReadyBuf(REPAIR_WA_DEFAULTS.ready);
    if (which === "progress") setProgressBuf(REPAIR_WA_DEFAULTS.progress);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/8 border border-green-500/20">
          <MessageCircle className="w-5 h-5 text-green-400/85 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-green-300/80 mb-1">قوالب رسائل الواتساب</p>
            <p className="text-[12px] text-green-300/50 leading-relaxed">
              عدّل نص الرسائل التي تُرسل للعميل من بطاقة الصيانة. استخدم المتغيّرات أدناه وستُستبدل تلقائياً.
            </p>
          </div>
        </div>

        {/* Placeholders cheat sheet */}
        <div className="rounded-xl border border-white/8 overflow-hidden bg-white/[0.02]">
          <div className="px-4 py-2 border-b border-white/8">
            <span className="text-[11px] font-bold text-white/40 tracking-widest uppercase">المتغيّرات المتاحة</span>
          </div>
          <div className="px-3 py-2 flex flex-wrap gap-1.5">
            {WA_PLACEHOLDERS.map(p => (
              <span key={p.key} title={p.desc}
                className="text-[11px] px-2 py-1 rounded-md bg-white/5 text-amber-300/80 font-mono border border-white/8">
                {p.key}
              </span>
            ))}
          </div>
        </div>

        {/* Ready template */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white/50">رسالة "الجهاز جاهز للاستلام"</span>
            <button onClick={() => resetTo("ready")} className="text-[10px] text-white/30 hover:text-white/60">↺ افتراضي</button>
          </div>
          <textarea value={readyBuf} onChange={e => setReadyBuf(e.target.value)}
            rows={6} dir="rtl"
            className="erp-input w-full text-sm py-2.5 leading-relaxed font-sans border-0 rounded-none bg-transparent" />
        </div>

        {/* Progress template */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white/50">رسالة "تحديث الحالة"</span>
            <button onClick={() => resetTo("progress")} className="text-[10px] text-white/30 hover:text-white/60">↺ افتراضي</button>
          </div>
          <textarea value={progressBuf} onChange={e => setProgressBuf(e.target.value)}
            rows={6} dir="rtl"
            className="erp-input w-full text-sm py-2.5 leading-relaxed font-sans border-0 rounded-none bg-transparent" />
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving || isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 transition-all disabled:opacity-40">
            <Save className="w-4 h-4" /> {saving ? "جاري الحفظ..." : "حفظ القوالب"}
          </button>
        </div>
      </div>
    </div>
  );
}


