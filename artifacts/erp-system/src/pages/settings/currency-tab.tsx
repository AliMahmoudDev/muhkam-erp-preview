import { useState, useEffect } from "react";
import { useAppSettings } from "@/contexts/app-settings";
import { formatCurrencyPreview } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import {
  Check, Save, CheckCircle2, DollarSign, AlignLeft, CaseSensitive,
  Sun, TrendingUp, Loader2, Calendar, Hash, Phone, CalendarDays,
  Moon, LayoutList, Type,
} from "lucide-react";
import { PageHeader } from "./_shared";
import type {
  CurrencyCode, NumberFormat, FontFamily, LightVariant,
  DateFormat, DecimalPlaces, ThousandsSeparator, PhoneFormat,
  WeekStartDay, DarkThemeVariant, DisplayDensity, FontSize,
} from "@/contexts/app-settings";

/* ══════════════════════ Static option lists ══════════════════════════════ */

const CURRENCY_OPTIONS: { code: CurrencyCode; flag: string; label: string; symbol: string }[] = [
  { code: "EGP", flag: "🇪🇬", label: "جنيه مصري",    symbol: "ج.م" },
  { code: "USD", flag: "🇺🇸", label: "دولار أمريكي", symbol: "$"   },
  { code: "CNY", flag: "🇨🇳", label: "يوان صيني",    symbol: "¥"   },
];

const EXCHANGE_CURRENCIES = [
  { code: "USD", flag: "🇺🇸", label: "دولار أمريكي", symbol: "$" },
  { code: "CNY", flag: "🇨🇳", label: "يوان صيني",    symbol: "¥" },
] as const;

const NUMBER_FORMAT_OPTIONS: { value: NumberFormat; label: string; example: string }[] = [
  { value: "western",      label: "أرقام غربية",       example: "1,234.56" },
  { value: "arabic-indic", label: "أرقام عربية-هندية", example: "١٬٢٣٤٫٥٦" },
];

const DECIMAL_PLACES_OPTIONS: { value: DecimalPlaces; label: string; example: string }[] = [
  { value: 0, label: "بدون كسور",   example: "1,234" },
  { value: 2, label: "منزلتان",     example: "1,234.56" },
  { value: 3, label: "ثلاث منازل", example: "1,234.567" },
];

const THOUSANDS_SEP_OPTIONS: { value: ThousandsSeparator; label: string; example: string }[] = [
  { value: "comma",         label: "فاصلة  ,",       example: "1,000,000" },
  { value: "period",        label: "نقطة  .",          example: "1.000.000" },
  { value: "space",         label: "مسافة",            example: "1 000 000" },
  { value: "arabic-comma",  label: "فاصلة عربية  ،",  example: "1،000،000" },
];

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; example: string }[] = [
  { value: "dd/mm/yyyy",  label: "يوم/شهر/سنة",  example: "25/01/2025" },
  { value: "yyyy-mm-dd",  label: "سنة-شهر-يوم",  example: "2025-01-25" },
  { value: "dd-mm-yyyy",  label: "يوم-شهر-سنة",  example: "25-01-2025" },
];

const PHONE_FORMAT_OPTIONS: { value: PhoneFormat; label: string; example: string }[] = [
  { value: "local",         label: "محلي",          example: "01012345678" },
  { value: "international", label: "دولي",           example: "+201012345678" },
];

const WEEK_START_OPTIONS: { value: WeekStartDay; label: string; flag: string }[] = [
  { value: "saturday", label: "السبت",    flag: "🇸🇦" },
  { value: "sunday",   label: "الأحد",   flag: "🇺🇸" },
  { value: "monday",   label: "الاثنين", flag: "🇪🇺" },
];

const DARK_THEME_OPTIONS: { value: DarkThemeVariant; label: string; desc: string; bgFrom: string; bgTo: string }[] = [
  { value: "default",         label: "افتراضي",           desc: "رمادي داكن كلاسيكي",     bgFrom: "#0D1117", bgTo: "#0A0E1A" },
  { value: "deep-blue",       label: "أزرق عميق",         desc: "بحري غامق بلمسة زرقاء",  bgFrom: "#050D1F", bgTo: "#03091A" },
  { value: "midnight-purple", label: "بنفسجي منتصف الليل", desc: "داكن بصبغة بنفسجية",   bgFrom: "#0D0A1E", bgTo: "#090618" },
];

const DENSITY_OPTIONS: { value: DisplayDensity; label: string; desc: string; icon: string }[] = [
  { value: "compact",     label: "مضغوط",   desc: "صفوف أقل ارتفاعاً، عرض أكثر",      icon: "⬛" },
  { value: "comfortable", label: "مريح",    desc: "التوازن الافتراضي",                   icon: "🟫" },
  { value: "spacious",    label: "واسع",    desc: "مسافات أكبر، أسهل للقراءة",          icon: "🟦" },
];

const FONT_OPTIONS: { key: FontFamily; label: string; preview: string }[] = [
  { key: "Cairo",   label: "القاهرة",  preview: "أبجد هوز — Cairo"   },
  { key: "Tajawal", label: "تجوال",    preview: "أبجد هوز — Tajawal" },
  { key: "Almarai", label: "المرعى",   preview: "أبجد هوز — Almarai" },
  { key: "Changa",  label: "تشانجا",   preview: "أبجد هوز — Changa"  },
  { key: "Inter",   label: "Inter",    preview: "ABCD efgh — Inter"   },
];

const FONT_WEIGHT_OPTIONS = [
  { value: 400, label: "عادي",  labelEn: "Regular" },
  { value: 500, label: "متوسط", labelEn: "Medium"  },
  { value: 700, label: "عريض",  labelEn: "Bold"    },
] as const;

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; px: string }[] = [
  { value: "sm", label: "صغير",      px: "13px" },
  { value: "md", label: "متوسط",     px: "15px" },
  { value: "lg", label: "كبير",      px: "17px" },
  { value: "xl", label: "كبير جداً", px: "19px" },
];

/* ══════════════════════ Shared UI ════════════════════════════════════════ */

function Section({
  icon: Icon, title, children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden" style={{ background: "var(--erp-bg-card)" }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
        <Icon className="w-4 h-4 text-amber-400" />
        <p className="text-white/70 text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function OptionPill<T extends string | number>({
  value, active, label, sub, onClick,
}: {
  value: T; active: boolean; label: string; sub?: string; onClick: (v: T) => void;
}) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-right transition-all text-sm ${
        active
          ? "bg-amber-500/10 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
          : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
      }`}
    >
      <div>
        <p className={`font-bold ${active ? "text-amber-400" : "text-white/80"}`}>{label}</p>
        {sub && <p className="text-white/30 text-xs mt-0.5 font-mono">{sub}</p>}
      </div>
      {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
    </button>
  );
}

/* ══════════════════════ Exchange Rates ═══════════════════════════════════ */

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const xrateApi = (p: string) => `${BASE_URL}${p}`;

function ExchangeRatesSection() {
  const { toast } = useToast();
  const [rates, setRates]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<Record<string, boolean>>({});
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    authFetch(xrateApi("/api/exchange-rates/latest"))
      .then(r => r.json())
      .then((data: Record<string, number>) => {
        const mapped: Record<string, string> = {};
        EXCHANGE_CURRENCIES.forEach(c => {
          mapped[c.code] = data[c.code] ? String(data[c.code]) : "";
        });
        setRates(mapped);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSingle = async (code: string) => {
    const v = parseFloat(rates[code]);
    if (!v || v <= 0) {
      toast({ title: "قيمة غير صحيحة", description: "أدخل سعر صرف أكبر من صفر", variant: "destructive" });
      return;
    }
    setSaving(s => ({ ...s, [code]: true }));
    try {
      const res = await authFetch(xrateApi("/api/exchange-rates"), {
        method: "POST",
        body: JSON.stringify({ currency: code, rate: v, date: today }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: `✓ سعر ${code}`, description: `1 ${code} = ${v.toFixed(2)} ج.م` });
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } finally {
      setSaving(s => ({ ...s, [code]: false }));
    }
  };

  const saveAll = async () => {
    const toSave = EXCHANGE_CURRENCIES.filter(c => parseFloat(rates[c.code]) > 0);
    if (!toSave.length) return;
    setSaving(s => { const n = { ...s }; toSave.forEach(c => (n[c.code] = true)); return n; });
    try {
      await Promise.all(toSave.map(c =>
        authFetch(xrateApi("/api/exchange-rates"), {
          method: "POST",
          body: JSON.stringify({ currency: c.code, rate: parseFloat(rates[c.code]), date: today }),
        })
      ));
      toast({ title: "✓ تم حفظ أسعار الصرف", description: `${toSave.length} عملة — ${today}` });
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } finally {
      setSaving({});
    }
  };

  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden" style={{ background: "var(--erp-bg-card)" }}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <p className="text-white/70 text-xs font-bold uppercase tracking-wider">أسعار الصرف اليومية</p>
        </div>
        <span className="text-xs text-white/30 font-mono">{today}</span>
      </div>
      <div className="p-5">
        <p className="text-white/40 text-xs mb-4">سعر العملة مقابل الجنيه المصري — يُستخدم تلقائياً في فواتير المشتريات</p>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {EXCHANGE_CURRENCIES.map(c => (
              <div key={c.code} className="flex items-center gap-3 bg-[#0D1424] rounded-xl p-3 border border-white/5">
                <span className="text-xl shrink-0">{c.flag}</span>
                <div className="w-20 shrink-0">
                  <p className="text-white/80 text-sm font-bold">{c.code}</p>
                  <p className="text-white/30 text-xs">{c.label}</p>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-white/30 text-xs shrink-0">1 {c.symbol} =</span>
                  <input
                    type="number" step="0.01" min="0.01" placeholder="0.00"
                    value={rates[c.code] ?? ""}
                    onChange={e => setRates(r => ({ ...r, [c.code]: e.target.value }))}
                    className="flex-1 bg-[#1A2235] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 text-left ltr"
                    dir="ltr"
                  />
                  <span className="text-white/50 text-xs shrink-0">ج.م</span>
                </div>
                <button
                  onClick={() => saveSingle(c.code)}
                  disabled={saving[c.code] || !rates[c.code]}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                  style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  {saving[c.code] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "حفظ"}
                </button>
              </div>
            ))}
            <button
              onClick={saveAll}
              disabled={Object.values(saving).some(Boolean)}
              className="w-full mt-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              {Object.values(saving).some(Boolean)
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <><Save className="w-4 h-4" /> حفظ الأسعار</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════ Main Tab ═════════════════════════════════════════ */

export default function CurrencyTab() {
  const { settings, update } = useAppSettings();
  const { toast } = useToast();

  const [currency,          setCurrency]          = useState<CurrencyCode>(settings.currency);
  const [numFmt,            setNumFmt]            = useState<NumberFormat>(settings.numberFormat ?? "western");
  const [decimalPlaces,     setDecimalPlaces]     = useState<DecimalPlaces>(settings.decimalPlaces ?? 2);
  const [thousandsSep,      setThousandsSep]      = useState<ThousandsSeparator>(settings.thousandsSeparator ?? "comma");
  const [dateFormat,        setDateFormat]        = useState<DateFormat>(settings.dateFormat ?? "dd/mm/yyyy");
  const [invoicePrefix,     setInvoicePrefix]     = useState<string>(settings.invoicePrefix ?? "INV-");
  const [phoneFormat,       setPhoneFormat]       = useState<PhoneFormat>(settings.phoneFormat ?? "local");
  const [weekStartDay,      setWeekStartDay]      = useState<WeekStartDay>(settings.weekStartDay ?? "saturday");
  const [fontFamily,        setFontFamily]        = useState<FontFamily>(settings.fontFamily);
  const [fontWeight,        setFontWeight]        = useState<number>(settings.fontWeightNormal ?? 400);
  const [fontSize,          setFontSize]          = useState<FontSize>(settings.fontSize ?? "md");
  const [darkThemeVariant,  setDarkThemeVariant]  = useState<DarkThemeVariant>(settings.darkThemeVariant ?? "default");
  const [lightVariant,      setLightVariant]      = useState<LightVariant>(settings.lightVariant ?? "soft");
  const [displayDensity,    setDisplayDensity]    = useState<DisplayDensity>(settings.displayDensity ?? "comfortable");
  const [saved,             setSaved]             = useState(false);

  const isLightMode = settings.theme === "light";

  /* ── preview sample amounts ── */
  const previewAmounts = [100, 1234.56, 50000];

  const handleSave = () => {
    update({
      currency,
      numberFormat: numFmt,
      decimalPlaces,
      thousandsSeparator: thousandsSep,
      dateFormat,
      invoicePrefix: invoicePrefix.trim() || "INV-",
      phoneFormat,
      weekStartDay,
      fontFamily,
      fontWeightNormal: fontWeight,
      fontSize,
      darkThemeVariant,
      lightVariant,
      displayDensity,
    });
    setSaved(true);
    toast({ title: "تم حفظ الإعدادات ✓", description: "تم تطبيق إعدادات المتجر على كامل النظام" });
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader title="إعدادات المتجر" sub="تخصيص العملة والتواريخ والتنسيقات والمظهر العام للنظام" />

      {/* ══ 1. أسعار الصرف ════════════════════════════════════════════════ */}
      <ExchangeRatesSection />

      {/* ══ 2. العملة الرئيسية ════════════════════════════════════════════ */}
      <Section icon={DollarSign} title="العملة الرئيسية">
        <div className="grid grid-cols-3 gap-3">
          {CURRENCY_OPTIONS.map(o => {
            const active = currency === o.code;
            return (
              <button key={o.code} onClick={() => setCurrency(o.code)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-right transition-all hover:-translate-y-0.5 ${
                  active ? "bg-amber-500/10 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.2)]" : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                }`}>
                <span className="text-2xl">{o.flag}</span>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{o.label}</p>
                  <p className="text-white/30 text-xs">{o.code} · {o.symbol}</p>
                </div>
                {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ══ 3. الأرقام والأماكن العشرية ══════════════════════════════════ */}
      <Section icon={CaseSensitive} title="إعدادات الأرقام">
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-3">شكل الأرقام</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {NUMBER_FORMAT_OPTIONS.map(o => (
            <OptionPill key={o.value} value={o.value} active={numFmt === o.value}
              label={o.label} sub={o.example} onClick={(v) => setNumFmt(v as NumberFormat)} />
          ))}
        </div>

        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-3">عدد المنازل العشرية</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {DECIMAL_PLACES_OPTIONS.map(o => (
            <OptionPill key={o.value} value={o.value} active={decimalPlaces === o.value}
              label={o.label} sub={o.example} onClick={(v) => setDecimalPlaces(v as DecimalPlaces)} />
          ))}
        </div>

        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-3">فاصل الآلاف</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {THOUSANDS_SEP_OPTIONS.map(o => (
            <OptionPill key={o.value} value={o.value} active={thousandsSep === o.value}
              label={o.label} sub={o.example} onClick={(v) => setThousandsSep(v as ThousandsSeparator)} />
          ))}
        </div>

        <div className="bg-[#0D1424] rounded-xl p-4 border border-white/5">
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-3">معاينة مباشرة</p>
          <div className="grid grid-cols-3 gap-2">
            {previewAmounts.map(n => (
              <div key={n} className="bg-[#111827] rounded-lg p-2.5 text-center border border-white/5">
                <p className="text-amber-400 font-black text-sm">{formatCurrencyPreview(n, currency, numFmt)}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══ 4. تنسيق التاريخ ══════════════════════════════════════════════ */}
      <Section icon={Calendar} title="تنسيق التاريخ">
        <div className="grid grid-cols-3 gap-3">
          {DATE_FORMAT_OPTIONS.map(o => (
            <OptionPill key={o.value} value={o.value} active={dateFormat === o.value}
              label={o.label} sub={o.example} onClick={(v) => setDateFormat(v as DateFormat)} />
          ))}
        </div>
      </Section>

      {/* ══ 5. بادئة الفاتورة ═════════════════════════════════════════════ */}
      <Section icon={Hash} title="بادئة رقم الفاتورة">
        <p className="text-white/40 text-xs mb-3">تُضاف في بداية رقم كل فاتورة مطبوعة — مثال: <span className="text-amber-400 font-mono">INV-001</span></p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={invoicePrefix}
            onChange={e => setInvoicePrefix(e.target.value)}
            maxLength={10}
            placeholder="INV-"
            className="flex-1 bg-[#1A2235] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 font-mono text-left ltr"
            dir="ltr"
          />
          <div className="bg-[#0D1424] border border-white/5 rounded-xl px-4 py-2.5 text-amber-400 font-mono text-sm min-w-[90px] text-center">
            {(invoicePrefix || "INV-")}001
          </div>
        </div>
      </Section>

      {/* ══ 6. تنسيق الهاتف + يوم بداية الأسبوع ═════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Section icon={Phone} title="تنسيق رقم الهاتف">
          <div className="space-y-3">
            {PHONE_FORMAT_OPTIONS.map(o => (
              <OptionPill key={o.value} value={o.value} active={phoneFormat === o.value}
                label={o.label} sub={o.example} onClick={(v) => setPhoneFormat(v as PhoneFormat)} />
            ))}
          </div>
        </Section>
        <Section icon={CalendarDays} title="بداية الأسبوع">
          <div className="space-y-3">
            {WEEK_START_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setWeekStartDay(o.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all ${
                  weekStartDay === o.value ? "bg-amber-500/10 border-amber-500/60" : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                }`}>
                <span className="text-xl">{o.flag}</span>
                <p className={`font-bold text-sm flex-1 ${weekStartDay === o.value ? "text-amber-400" : "text-white/80"}`}>{o.label}</p>
                {weekStartDay === o.value && <Check className="w-4 h-4 text-amber-400" />}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* ══ 7. ثيم الوضع الداكن ══════════════════════════════════════════ */}
      <Section icon={Moon} title="ثيم الوضع الداكن">
        <div className="grid grid-cols-3 gap-3">
          {DARK_THEME_OPTIONS.map(o => {
            const active = darkThemeVariant === o.value;
            return (
              <button key={o.value} onClick={() => setDarkThemeVariant(o.value)}
                className={`relative flex flex-col gap-3 p-4 rounded-2xl border-2 text-right transition-all overflow-hidden ${
                  active ? "border-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.2)]" : "border-white/8 hover:border-amber-500/30"
                }`}
                style={{ background: o.bgFrom }}>
                <div className="w-full h-10 rounded-xl border border-white/5"
                  style={{ background: `linear-gradient(135deg, ${o.bgFrom}, ${o.bgTo})` }} />
                {active && (
                  <span className="absolute top-3 left-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" />
                  </span>
                )}
                <div>
                  <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{o.label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{o.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ══ 8. حجم الخط ══════════════════════════════════════════════════ */}
      <Section icon={Type} title="حجم الخط">
        <div className="grid grid-cols-4 gap-3">
          {FONT_SIZE_OPTIONS.map(o => {
            const active = fontSize === o.value;
            return (
              <button key={o.value} onClick={() => setFontSize(o.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  active ? "bg-amber-500/10 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)]" : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                }`}>
                <span className={`font-black ${active ? "text-amber-400" : "text-white/50"}`}
                  style={{ fontSize: o.px }}>أ</span>
                <p className={`font-bold text-xs ${active ? "text-amber-400" : "text-white/60"}`}>{o.label}</p>
                <p className="text-white/25 text-[10px]">{o.px}</p>
                {active && <Check className="w-3 h-3 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ══ 9. كثافة العرض ═══════════════════════════════════════════════ */}
      <Section icon={LayoutList} title="كثافة العرض">
        <div className="grid grid-cols-3 gap-3">
          {DENSITY_OPTIONS.map(o => {
            const active = displayDensity === o.value;
            return (
              <button key={o.value} onClick={() => setDisplayDensity(o.value)}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all text-center ${
                  active ? "bg-amber-500/10 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)]" : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                }`}>
                <span className="text-2xl">{o.icon}</span>
                <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{o.label}</p>
                <p className="text-white/30 text-xs">{o.desc}</p>
                {active && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ══ الخطوط ════════════════════════════════════════════════════════ */}
      <Section icon={AlignLeft} title="إعدادات الخطوط">
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-3">نوع الخط</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {FONT_OPTIONS.map(f => {
            const active = fontFamily === f.key;
            return (
              <button key={f.key} onClick={() => setFontFamily(f.key)}
                className={`flex flex-col gap-1.5 p-4 rounded-xl border text-right transition-all ${
                  active ? "bg-amber-500/10 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)]" : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                }`}>
                <div className="flex items-center justify-between">
                  <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{f.label}</p>
                  {active && <Check className="w-4 h-4 text-amber-400" />}
                </div>
                <p className="text-white/40 text-xs" style={{ fontFamily: `'${f.key}', sans-serif` }}>{f.preview}</p>
              </button>
            );
          })}
        </div>

        <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-3">وزن الخط</p>
        <div className="grid grid-cols-3 gap-3">
          {FONT_WEIGHT_OPTIONS.map(w => {
            const active = fontWeight === w.value;
            return (
              <button key={w.value} onClick={() => setFontWeight(w.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  active ? "bg-amber-500/10 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.15)]" : "bg-[#1A2235] border-[#2D3748] hover:border-amber-500/30"
                }`}>
                <span className={`text-2xl ${active ? "text-amber-400" : "text-white/50"}`}
                  style={{ fontFamily: `'${fontFamily}', sans-serif`, fontWeight: w.value }}>أ</span>
                <div className="text-center">
                  <p className={`font-bold text-xs ${active ? "text-amber-400" : "text-white/70"}`}>{w.label}</p>
                  <p className="text-white/25 text-[10px]">{w.labelEn} · {w.value}</p>
                </div>
                {active && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ══ الوضع الفاتح ══════════════════════════════════════════════════ */}
      <Section icon={Sun} title="مظهر الواجهة الفاتحة">
        {!isLightMode ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1A2235] border border-white/5">
            <Sun className="w-4 h-4 text-white/20 shrink-0" />
            <p className="text-white/30 text-sm">فعّل الوضع الفاتح أولاً من زر تبديل الثيم في الشريط العلوي</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { v: "soft" as LightVariant,          label: "ناعم — Soft",              desc: "خلفية كريمية هادئة، ظلال ناعمة",     bg: "#FAFAFA", previewBg: "#FFFFFF", borderCol: "#E5E7EB" },
              { v: "high-contrast" as LightVariant,  label: "تباين عالٍ — High Contrast", desc: "خلفية بيضاء نقية، حدود داكنة", bg: "#FFFFFF", previewBg: "#FFFFFF", borderCol: "#9CA3AF" },
            ] as const).map(opt => {
              const active = lightVariant === opt.v;
              return (
                <button key={opt.v} onClick={() => setLightVariant(opt.v)}
                  className={`relative flex flex-col gap-3 p-4 rounded-2xl border-2 text-right transition-all overflow-hidden ${
                    active ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]" : "border-gray-200 hover:border-amber-300"
                  }`} style={{ background: opt.bg }}>
                  {active && (
                    <span className="absolute top-3 left-3 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                  <div className="w-full rounded-xl overflow-hidden border shadow-sm" style={{ background: opt.previewBg, borderColor: opt.borderCol }}>
                    <div className="h-5 flex items-center gap-1.5 px-2" style={{ background: opt.v === "soft" ? "#F5F5F5" : "#E8EBF0", borderBottom: `1px solid ${opt.borderCol}` }}>
                      <div className="w-8 h-1.5 rounded-full" style={{ background: opt.borderCol }} />
                      <div className="w-12 h-1.5 rounded-full" style={{ background: opt.borderCol }} />
                    </div>
                    <div className="p-2 flex gap-1.5">
                      <div className="flex-1 h-7 rounded-lg" style={{ background: opt.v === "soft" ? "#F5F5F5" : "#FFFFFF", border: `1px solid ${opt.borderCol}` }} />
                      <div className="flex-1 h-7 rounded-lg" style={{ background: opt.v === "soft" ? "#F5F5F5" : "#FFFFFF", border: `1px solid ${opt.borderCol}` }} />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{opt.label}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* ══ زر الحفظ ══════════════════════════════════════════════════════ */}
      <button
        onClick={handleSave}
        className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
        style={{
          background: saved ? "rgba(52,211,153,0.9)" : "linear-gradient(to right, #F59E0B, #D97706)",
          color: "#000",
          boxShadow: saved ? "0 4px 20px rgba(52,211,153,0.3)" : "0 4px 20px rgba(245,158,11,0.25)",
        }}
      >
        {saved
          ? <><CheckCircle2 className="w-4 h-4" /> تم الحفظ</>
          : <><Save className="w-4 h-4" /> حفظ جميع الإعدادات</>}
      </button>
      <p className="text-white/25 text-xs text-center">سيتم تطبيق جميع التغييرات فوراً على كل الشاشات والتقارير والفواتير</p>
    </div>
  );
}
