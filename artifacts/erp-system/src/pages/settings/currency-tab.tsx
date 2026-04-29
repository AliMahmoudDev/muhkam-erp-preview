import { useState, useEffect } from "react";
import { useAppSettings } from "@/contexts/app-settings";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import {
  Check, Save, CheckCircle2, DollarSign, AlignLeft, CaseSensitive,
  Sun, Loader2, Calendar, Hash, Phone, CalendarDays,
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

/* ══════════════════════ Main Tab ═════════════════════════════════════════ */

export default function CurrencyTab() {
  const { settings, update } = useAppSettings();
  const { toast } = useToast();

  /* ── main settings state ── */
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

  /* ── exchange rates state (merged here) ── */
  const [rates,       setRates]       = useState<Record<string, string>>({});
  const [ratesLoading, setRatesLoading] = useState(true);
  const [savingRate,  setSavingRate]  = useState<Record<string, boolean>>({});
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
      .catch(() => {/* silent — server may be starting */})
      .finally(() => setRatesLoading(false));
  }, []);

  const saveRate = async (code: string) => {
    const v = parseFloat(rates[code]);
    if (!v || v <= 0) {
      toast({ title: "قيمة غير صحيحة", description: "أدخل سعر صرف أكبر من صفر", variant: "destructive" });
      return;
    }
    setSavingRate(s => ({ ...s, [code]: true }));
    try {
      const res = await authFetch(xrateApi("/api/exchange-rates"), {
        method: "POST",
        body: JSON.stringify({ currency: code, rate: v, date: today }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: `✓ تم حفظ سعر ${code}`, description: `1 ${code} = ${v.toFixed(2)} ج.م` });
    } catch (e) {
      toast({
        title: "خطأ في حفظ سعر الصرف",
        description: e instanceof Error ? e.message : "تعذّر الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setSavingRate(s => ({ ...s, [code]: false }));
    }
  };

  const saveAllRates = async () => {
    const toSave = EXCHANGE_CURRENCIES.filter(c => parseFloat(rates[c.code]) > 0);
    if (!toSave.length) {
      toast({ title: "لا توجد أسعار للحفظ", description: "أدخل سعراً واحداً على الأقل", variant: "destructive" });
      return;
    }
    setSavingRate(s => { const n = { ...s }; toSave.forEach(c => (n[c.code] = true)); return n; });
    let ok = 0; let fail = 0;
    for (const c of toSave) {
      try {
        const res = await authFetch(xrateApi("/api/exchange-rates"), {
          method: "POST",
          body: JSON.stringify({ currency: c.code, rate: parseFloat(rates[c.code]), date: today }),
        });
        if (!res.ok) throw new Error(await res.text());
        ok++;
      } catch { fail++; }
      finally { setSavingRate(s => ({ ...s, [c.code]: false })); }
    }
    if (fail === 0) toast({ title: "✓ تم حفظ أسعار الصرف", description: `${ok} عملة — ${today}` });
    else toast({ title: `تم حفظ ${ok} وفشل ${fail}`, variant: "destructive" });
  };

  const isLightMode = settings.theme === "light";

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

      {/* ══ 1+2. العملة الرئيسية + أسعار الصرف — بطاقة موحدة ═══════════ */}
      <div className="border border-white/5 rounded-2xl overflow-hidden" style={{ background: "var(--erp-bg-card)" }}>

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">العملات وأسعار الصرف</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/25 font-mono">{today}</span>
            <button
              onClick={saveAllRates}
              disabled={Object.values(savingRate).some(Boolean)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
              style={{ background: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              {Object.values(savingRate).some(Boolean)
                ? <><Loader2 className="w-3 h-3 animate-spin" /> جاري الحفظ...</>
                : <><Save className="w-3 h-3" /> حفظ الأسعار</>}
            </button>
          </div>
        </div>

        {/* ─── Hint ───────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-1">
          <p className="text-white/30 text-[11px]">
            اختر العملة الرئيسية بالضغط على الصف · أدخل سعر الصرف مقابل الجنيه المصري لكل عملة ثم احفظ
          </p>
        </div>

        {/* ─── Table ──────────────────────────────────────────────────── */}
        {ratesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="p-4 space-y-2">

            {/* ── EGP row (no rate needed — always base) ─────────────── */}
            {(() => {
              const o = CURRENCY_OPTIONS[0]; // EGP
              const active = currency === o.code;
              return (
                <button
                  key={o.code}
                  onClick={() => setCurrency(o.code)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-right transition-all ${
                    active
                      ? "bg-amber-500/10 border-amber-500/60 shadow-[0_0_14px_rgba(245,158,11,0.12)]"
                      : "bg-[#0D1424] border-white/5 hover:border-amber-500/25 hover:bg-amber-500/5"
                  }`}
                >
                  <span className="text-2xl shrink-0">{o.flag}</span>
                  <div className="flex-1 text-right">
                    <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{o.label}</p>
                    <p className="text-white/30 text-xs">{o.code} · {o.symbol}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-1 rounded-lg font-bold"
                      style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                      العملة الأساسية للنظام
                    </span>
                    {active && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                  </div>
                </button>
              );
            })()}

            {/* ── USD & CNY rows (with exchange rate input) ───────────── */}
            {EXCHANGE_CURRENCIES.map(c => {
              const active = currency === c.code;
              const isSaving = savingRate[c.code] ?? false;
              const hasValue = parseFloat(rates[c.code] ?? "") > 0;
              return (
                <div
                  key={c.code}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    active
                      ? "bg-amber-500/10 border-amber-500/60 shadow-[0_0_14px_rgba(245,158,11,0.12)]"
                      : "bg-[#0D1424] border-white/5"
                  }`}
                >
                  {/* Currency info — clickable to set as main */}
                  <button
                    className="flex items-center gap-4 flex-1 min-w-0 text-right"
                    onClick={() => setCurrency(c.code as CurrencyCode)}
                  >
                    <span className="text-2xl shrink-0">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${active ? "text-amber-400" : "text-white/80"}`}>{c.label}</p>
                      <p className="text-white/30 text-xs">{c.code} · {c.symbol}</p>
                    </div>
                    {active && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                  </button>

                  {/* Rate input area */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-white/30 text-xs whitespace-nowrap">1 {c.symbol} =</span>
                    <input
                      type="number" step="0.01" min="0.01" placeholder="0.00"
                      value={rates[c.code] ?? ""}
                      onChange={e => setRates(r => ({ ...r, [c.code]: e.target.value }))}
                      className="w-28 bg-[#1A2235] border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm text-left focus:outline-none focus:border-blue-500/50 focus:bg-[#1E2A40] transition-colors"
                      dir="ltr"
                    />
                    <span className="text-white/40 text-xs whitespace-nowrap">ج.م</span>
                    <button
                      onClick={() => saveRate(c.code)}
                      disabled={isSaving || !hasValue}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                      style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)" }}
                    >
                      {isSaving
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><Save className="w-3 h-3" /> حفظ</>}
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        {/* ─── Footer note ────────────────────────────────────────────── */}
        <div className="px-5 pb-4 pt-1">
          <p className="text-white/20 text-[11px]">
            * تُحفظ أسعار الصرف في قاعدة البيانات وتُطبَّق تلقائياً على فواتير المشتريات · العملة الرئيسية تُحفظ مع إعدادات المتجر بالضغط على زر «حفظ الإعدادات»
          </p>
        </div>

      </div>

      {/* ══ 3. إعدادات الأرقام ════════════════════════════════════════════ */}
      <Section icon={CaseSensitive} title="إعدادات الأرقام">
        <div className="space-y-2">
          {([
            { fmt: "western"      as NumberFormat, label: "أرقام غربية",       preview: "1٬234" },
            { fmt: "arabic-indic" as NumberFormat, label: "أرقام عربية-هندية", preview: "١٬٢٣٤" },
          ] as const).map(row => {
            const active = numFmt === row.fmt;
            return (
              <div
                key={row.fmt}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  active
                    ? "bg-amber-500/8 border-amber-500/40"
                    : "bg-[#0D1424] border-white/5 hover:border-white/10"
                }`}
              >
                {/* ── Left: format type selector ── */}
                <button
                  onClick={() => setNumFmt(row.fmt)}
                  className="flex items-center gap-2.5 min-w-[150px] shrink-0 text-right"
                >
                  <span className={`font-mono text-base font-black tracking-wide ${active ? "text-amber-400" : "text-white/40"}`}>
                    {row.preview}
                  </span>
                  <span className={`text-xs font-bold ${active ? "text-amber-300" : "text-white/35"}`}>
                    {row.label}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>

                {/* ── Divider ── */}
                <div className="w-px h-6 bg-white/8 shrink-0" />

                {/* ── Right: sub-option chips ── */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Decimal group */}
                  {([
                    { dp: 0 as DecimalPlaces, label: "بدون كسور" },
                    { dp: 2 as DecimalPlaces, label: "بكسور"     },
                  ] as const).map(o => (
                    <button
                      key={o.dp}
                      onClick={() => setDecimalPlaces(o.dp)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        decimalPlaces === o.dp
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-[#1A2235] text-white/35 border border-white/8 hover:border-amber-500/25 hover:text-white/60"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}

                  <div className="w-px h-4 bg-white/8 mx-0.5 shrink-0" />

                  {/* Separator group */}
                  {([
                    { sep: "comma"  as ThousandsSeparator, label: "بدون نقطة" },
                    { sep: "period" as ThousandsSeparator, label: "نقطة ."      },
                  ] as const).map(o => (
                    <button
                      key={o.sep}
                      onClick={() => setThousandsSep(o.sep)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        thousandsSep === o.sep
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-[#1A2235] text-white/35 border border-white/8 hover:border-amber-500/25 hover:text-white/60"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
