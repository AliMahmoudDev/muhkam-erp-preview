import { api } from '@/lib/api';
/**
 * alerts-tab.tsx — إعدادات التنبيهات والإشعارات
 */
import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, Package, ShieldCheck, CreditCard, Loader2, Save, CheckCircle2,
} from "lucide-react";
import { PageHeader, FieldLabel, SInput } from "./_shared";


interface AlertSettings {
  alert_low_stock_enabled:  string;
  alert_low_stock_qty:      string;
  alert_warranty_enabled:   string;
  alert_warranty_days:      string;
  alert_debt_enabled:       string;
  alert_debt_days:          string;
}

const EMPTY: AlertSettings = {
  alert_low_stock_enabled: "1",
  alert_low_stock_qty:     "5",
  alert_warranty_enabled:  "1",
  alert_warranty_days:     "3",
  alert_debt_enabled:      "1",
  alert_debt_days:         "30",
};

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${on ? "bg-amber-500" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${on ? "right-0.5" : "left-0.5"}`} />
    </button>
  );
}

interface AlertCardProps {
  icon: React.FC<{ className?: string }>;
  color: string;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function AlertCard({ icon: Icon, color, title, desc, enabled, onToggle, children }: AlertCardProps) {
  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
      enabled ? "border-amber-500/20 bg-amber-500/[0.04]" : "border-white/8 bg-[var(--erp-bg-card)]"
    }`}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className={`font-bold text-sm ${enabled ? "text-white" : "text-white/60"}`}>{title}</p>
            <p className="text-white/35 text-xs mt-0.5">{desc}</p>
          </div>
        </div>
        <Toggle on={enabled} onToggle={onToggle} />
      </div>
      {enabled && children && (
        <div className="px-5 pb-4 border-t border-white/5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function AlertsTab() {
  const { toast } = useToast();
  const [form,    setForm]    = useState<AlertSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dirty,   setDirty]   = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await authFetch(api("/api/settings/system"));
        if (r.ok) {
          const d = await r.json() as Partial<AlertSettings>;
          setForm(prev => ({ ...prev, ...d }));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const update = (key: keyof AlertSettings, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true); setSaved(false);
  };
  const toggle = (key: keyof AlertSettings) =>
    update(key, form[key] === "1" ? "0" : "1");

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        (Object.keys(form) as (keyof AlertSettings)[]).map(k =>
          authFetch(api("/api/settings/system"), {
            method: "POST",
            body: JSON.stringify({ key: k, value: form[k] }),
          })
        )
      );
      setSaved(true); setDirty(false);
      toast({ title: "✅ تم حفظ إعدادات التنبيهات" });
    } catch {
      toast({ title: "فشل الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="التنبيهات والإشعارات"
        sub="تحكم في متى وكيف يُنبّهك النظام على الأحداث المهمة"
        action={
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 rounded-xl text-amber-400 font-bold text-xs transition-all disabled:opacity-40"
          >
            {saving   ? <Loader2      className="w-3.5 h-3.5 animate-spin" />
            : saved   ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            :           <Save         className="w-3.5 h-3.5" />}
            {saving ? "جاري الحفظ..." : saved ? "تم الحفظ" : "حفظ التغييرات"}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-white/25 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Low stock alert */}
          <AlertCard
            icon={Package}
            color="bg-orange-500/15 text-orange-400"
            title="تنبيه انخفاض المخزون"
            desc="يُنبّهك عندما تنخفض كمية أي منتج عن حد معين"
            enabled={form.alert_low_stock_enabled === "1"}
            onToggle={() => toggle("alert_low_stock_enabled")}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <FieldLabel>حد الكمية الدنيا (قطعة)</FieldLabel>
                <SInput
                  type="number" min="1" max="999"
                  value={form.alert_low_stock_qty}
                  onChange={e => update("alert_low_stock_qty", e.target.value)}
                  placeholder="5"
                />
              </div>
              <div className="mt-5 text-white/30 text-sm">
                عند وصول الكمية إلى <span className="text-amber-400 font-bold">{form.alert_low_stock_qty || "5"}</span> قطع أو أقل
              </div>
            </div>
          </AlertCard>

          {/* Warranty alert */}
          <AlertCard
            icon={ShieldCheck}
            color="bg-blue-500/15 text-blue-400"
            title="تنبيه انتهاء الضمان"
            desc="يُنبّهك قبل انتهاء فترة ضمان الأجهزة الموجودة"
            enabled={form.alert_warranty_enabled === "1"}
            onToggle={() => toggle("alert_warranty_enabled")}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <FieldLabel>عدد الأيام قبل الانتهاء</FieldLabel>
                <SInput
                  type="number" min="1" max="90"
                  value={form.alert_warranty_days}
                  onChange={e => update("alert_warranty_days", e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="mt-5 text-white/30 text-sm">
                تنبيه قبل <span className="text-blue-400 font-bold">{form.alert_warranty_days || "3"}</span> أيام من انتهاء الضمان
              </div>
            </div>
          </AlertCard>

          {/* Overdue debt alert */}
          <AlertCard
            icon={CreditCard}
            color="bg-red-500/15 text-red-400"
            title="تنبيه الديون المتأخرة"
            desc="يُنبّهك عند تجاوز مديونيات العملاء لفترة محددة"
            enabled={form.alert_debt_enabled === "1"}
            onToggle={() => toggle("alert_debt_enabled")}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <FieldLabel>عدد أيام التأخير</FieldLabel>
                <SInput
                  type="number" min="1" max="365"
                  value={form.alert_debt_days}
                  onChange={e => update("alert_debt_days", e.target.value)}
                  placeholder="30"
                />
              </div>
              <div className="mt-5 text-white/30 text-sm">
                تنبيه إذا تجاوزت الديون <span className="text-red-400 font-bold">{form.alert_debt_days || "30"}</span> يوماً
              </div>
            </div>
          </AlertCard>

          {/* Info box */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
            <Bell className="w-4 h-4 text-white/25 mt-0.5 shrink-0" />
            <p className="text-white/30 text-xs leading-relaxed">
              التنبيهات تظهر في لوحة التحكم وصفحات المخزون والضمان والعملاء بشكل بادجات وإشعارات. 
              لا يوجد إرسال بريد إلكتروني حالياً.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
