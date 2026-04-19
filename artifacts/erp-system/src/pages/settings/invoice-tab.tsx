/**
 * invoice-tab.tsx — إعدادات الفاتورة والطباعة
 */
import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  Printer, FileText, QrCode, Copy, LayoutGrid, Loader2, Save, CheckCircle2, Check,
} from "lucide-react";
import { PageHeader, FieldLabel, SInput } from "./_shared";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;

interface InvoiceSettings {
  invoice_paper_size:       string;
  invoice_show_qr:          string;
  invoice_copies:           string;
  invoice_show_discount:    string;
  invoice_show_tax_line:    string;
  invoice_show_profit:      string;
  invoice_show_serial:      string;
}

const EMPTY: InvoiceSettings = {
  invoice_paper_size:    "a4",
  invoice_show_qr:       "1",
  invoice_copies:        "1",
  invoice_show_discount: "1",
  invoice_show_tax_line: "1",
  invoice_show_profit:   "0",
  invoice_show_serial:   "1",
};

const PAPER_SIZES = [
  { id: "a4",       label: "A4",            sub: "210 × 297 mm",  icon: "📄" },
  { id: "thermal",  label: "حراري 80mm",    sub: "80 × طول متغير", icon: "🧾" },
  { id: "a5",       label: "A5",            sub: "148 × 210 mm",  icon: "📃" },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 ${on ? "bg-amber-500" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${on ? "right-0.5" : "left-0.5"}`} />
    </button>
  );
}

function ToggleRow({ label, sub, on, onToggle }: { label: string; sub?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className={`text-sm font-semibold ${on ? "text-white" : "text-white/50"}`}>{label}</p>
        {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.FC<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "var(--erp-bg-card)" }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <p className="text-white/70 text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function InvoiceTab() {
  const { toast } = useToast();
  const [form,    setForm]    = useState<InvoiceSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dirty,   setDirty]   = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await authFetch(api("/api/settings/system"));
        if (r.ok) {
          const d = await r.json() as Partial<InvoiceSettings>;
          setForm(prev => ({ ...prev, ...d }));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const update = (key: keyof InvoiceSettings, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true); setSaved(false);
  };
  const toggle = (key: keyof InvoiceSettings) =>
    update(key, form[key] === "1" ? "0" : "1");

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        (Object.keys(form) as (keyof InvoiceSettings)[]).map(k =>
          authFetch(api("/api/settings/system"), {
            method: "POST",
            body: JSON.stringify({ key: k, value: form[k] }),
          })
        )
      );
      setSaved(true); setDirty(false);
      toast({ title: "✅ تم حفظ إعدادات الفاتورة" });
    } catch {
      toast({ title: "فشل الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="إعدادات الفاتورة"
        sub="تخصيص شكل ومحتوى الفواتير المطبوعة"
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
        <div className="space-y-5">
          {/* Paper size */}
          <Section icon={Printer} title="حجم الورق">
            <div className="grid grid-cols-3 gap-3">
              {PAPER_SIZES.map(s => {
                const active = form.invoice_paper_size === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => update("invoice_paper_size", s.id)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      active
                        ? "bg-amber-500/10 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                        : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-2 left-2 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-black" />
                      </span>
                    )}
                    <span className="text-2xl">{s.icon}</span>
                    <div className="text-center">
                      <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{s.label}</p>
                      <p className="text-white/30 text-[11px] mt-0.5">{s.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Copies */}
          <Section icon={Copy} title="عدد النسخ">
            <div className="flex items-center gap-4">
              <div className="w-36">
                <FieldLabel>عدد النسخ الافتراضي</FieldLabel>
                <SInput
                  type="number" min="1" max="5"
                  value={form.invoice_copies}
                  onChange={e => update("invoice_copies", e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="mt-5 text-white/30 text-sm leading-relaxed">
                يُطبع <span className="text-amber-400 font-bold">{form.invoice_copies || "1"}</span> {form.invoice_copies === "1" ? "نسخة" : "نسخ"} تلقائياً عند الطباعة
              </div>
            </div>
          </Section>

          {/* Content toggles */}
          <Section icon={LayoutGrid} title="محتوى الفاتورة">
            <div className="divide-y divide-white/5">
              <ToggleRow
                label="رمز QR"
                sub="يظهر في أسفل الفاتورة للتحقق السريع"
                on={form.invoice_show_qr === "1"}
                onToggle={() => toggle("invoice_show_qr")}
              />
              <ToggleRow
                label="عمود الخصم"
                sub="إظهار الخصم على كل بند ومجموع الخصم"
                on={form.invoice_show_discount === "1"}
                onToggle={() => toggle("invoice_show_discount")}
              />
              <ToggleRow
                label="سطر الضريبة"
                sub="إظهار مبلغ ضريبة القيمة المضافة منفصلاً"
                on={form.invoice_show_tax_line === "1"}
                onToggle={() => toggle("invoice_show_tax_line")}
              />
              <ToggleRow
                label="الرقم التسلسلي للجهاز"
                sub="إظهار S/N في بنود خدمات الإصلاح"
                on={form.invoice_show_serial === "1"}
                onToggle={() => toggle("invoice_show_serial")}
              />
              <ToggleRow
                label="هامش الربح"
                sub="للاستخدام الداخلي فقط — لا يُشارك مع العميل"
                on={form.invoice_show_profit === "1"}
                onToggle={() => toggle("invoice_show_profit")}
              />
            </div>
          </Section>

          {/* Info */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
            <FileText className="w-4 h-4 text-white/25 mt-0.5 shrink-0" />
            <p className="text-white/30 text-xs leading-relaxed">
              إعدادات الفاتورة تُطبّق على جميع الفواتير المطبوعة من نظام المبيعات والمشتريات.
              بعض الإعدادات قد تتأثر بمعلومات الشركة الموجودة في تبويب بيانات الشركة.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
