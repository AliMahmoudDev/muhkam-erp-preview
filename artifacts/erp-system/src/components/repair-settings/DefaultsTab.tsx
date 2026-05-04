import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { api } from "@/lib/api";
import { REPAIR_SETTING_KEYS } from "./shared";

export default function DefaultsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings/system"],
    queryFn: () => authFetch(api("/api/settings/system")).then(r => r.json()),
    staleTime: 30_000,
  });

  const initialWarranty = settings[REPAIR_SETTING_KEYS.warrantyDays] ?? "30";
  const [warrantyBuf, setWarrantyBuf] = useState(initialWarranty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setWarrantyBuf(initialWarranty); }, [initialWarranty]);

  const save = async () => {
    setSaving(true);
    try {
      const wd = Math.max(0, Math.min(3650, Math.round(Number(warrantyBuf) || 0)));
      const r = await authFetch(api("/api/settings/system"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: REPAIR_SETTING_KEYS.warrantyDays, value: String(wd) }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || "تعذّر الحفظ");
      }
      await qc.invalidateQueries({ queryKey: ["/api/settings/system"] });
      toast({ title: "✓ تم حفظ الإعدادات" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined;
      toast({ title: msg || "تعذّر الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
          <Shield className="w-5 h-5 text-emerald-400/85 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-emerald-300/80 mb-1">القيم الافتراضية للصيانة</p>
            <p className="text-[12px] text-emerald-300/50 leading-relaxed">
              مدة الضمان الافتراضية تظهر تلقائياً في بطاقة الضمان عند تسليم الجهاز للعميل.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/8">
            <span className="text-[12px] font-semibold text-white/50">مدة الضمان الافتراضية بعد الإصلاح</span>
          </div>
          <div className="p-4 flex items-center gap-3">
            <input type="number" min={0} max={3650} value={warrantyBuf}
              onChange={e => setWarrantyBuf(e.target.value)}
              className="erp-input w-28 text-center text-sm py-1.5" />
            <span className="text-white/45 text-sm">يوم</span>
            <span className="text-[11px] text-white/25 mr-auto">يستخدم في بطاقات الضمان عند تسليم الجهاز</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={save} disabled={saving || isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 transition-all disabled:opacity-40">
            <Save className="w-4 h-4" /> {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </div>
      </div>
    </div>
  );
}


