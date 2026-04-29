import { useState, useEffect } from "react";
import { useAppSettings } from "@/contexts/app-settings";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import {
  Check, Save, CheckCircle2, DollarSign, CaseSensitive,
  Loader2, Type,
} from "lucide-react";
import { PageHeader } from "./_shared";
import type {
  CurrencyCode, NumberFormat, FontFamily,
  DecimalPlaces, ThousandsSeparator, FontSize,
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
  const [fontFamily,        setFontFamily]        = useState<FontFamily>(settings.fontFamily);
  const [fontWeight,        setFontWeight]        = useState<number>(settings.fontWeightNormal ?? 400);
  const [fontSize,          setFontSize]          = useState<FontSize>(settings.fontSize ?? "md");
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

  const handleSave = () => {
    update({
      currency,
      numberFormat: numFmt,
      decimalPlaces,
      thousandsSeparator: thousandsSep,
      fontFamily,
      fontWeightNormal: fontWeight,
      fontSize,
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

      {/* ══ 5. إعدادات الخطوط (موحّدة) ══════════════════════════════════ */}
      <Section icon={Type} title="إعدادات الخطوط">
        <div className="divide-y divide-white/5">

          {/* ── نوع الخط ── */}
          <div className="flex items-center gap-4 py-3 first:pt-0">
            <span className="text-white/40 text-xs font-bold w-20 shrink-0 text-right">نوع الخط</span>
            <div className="flex-1 flex flex-wrap gap-2">
              {FONT_OPTIONS.map(f => {
                const active = fontFamily === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFontFamily(f.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-right transition-all ${
                      active
                        ? "bg-amber-500/15 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.12)]"
                        : "bg-[#1A2235] border-white/8 hover:border-amber-500/30"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${active ? "text-amber-400" : "text-white/60"}`}
                      style={{ fontFamily: `'${f.key}', sans-serif` }}
                    >
                      {f.label}
                    </span>
                    <span className="text-white/20 text-[10px] font-mono hidden sm:inline"
                      style={{ fontFamily: `'${f.key}', sans-serif` }}>
                      {f.key === "Inter" ? "Abc" : "أبج"}
                    </span>
                    {active && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── حجم الخط + وزن الخط — سطر واحد ── */}
          <div className="flex items-center gap-4 py-3 last:pb-0">
            <span className="text-white/40 text-xs font-bold w-20 shrink-0 text-right">الحجم والوزن</span>
            <div className="flex items-center gap-3 flex-1">

              {/* حجم الخط — select */}
              <div className="relative flex-1 max-w-[180px]">
                <label className="absolute -top-[9px] right-3 px-1 text-[10px] font-bold text-white/30 bg-[#0D1424] leading-none z-10">
                  حجم الخط
                </label>
                <select
                  value={fontSize}
                  onChange={e => setFontSize(e.target.value as FontSize)}
                  dir="rtl"
                  className="w-full appearance-none bg-[#0D1424] border border-white/12 rounded-lg px-3 py-2.5 text-sm text-white/80 font-bold focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                  style={{ fontFamily: `'${fontFamily}', sans-serif` }}
                >
                  {FONT_SIZE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}
                      style={{ background: "#0D1117" }}>
                      {o.label} — {o.px}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">▾</span>
              </div>

              {/* وزن الخط — select */}
              <div className="relative flex-1 max-w-[180px]">
                <label className="absolute -top-[9px] right-3 px-1 text-[10px] font-bold text-white/30 bg-[#0D1424] leading-none z-10">
                  وزن الخط
                </label>
                <select
                  value={fontWeight}
                  onChange={e => setFontWeight(Number(e.target.value))}
                  dir="rtl"
                  className="w-full appearance-none bg-[#0D1424] border border-white/12 rounded-lg px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                  style={{ fontFamily: `'${fontFamily}', sans-serif`, fontWeight }}
                >
                  {FONT_WEIGHT_OPTIONS.map(w => (
                    <option key={w.value} value={w.value}
                      style={{ background: "#0D1117", fontWeight: w.value }}>
                      {w.label} — {w.labelEn}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">▾</span>
              </div>

              {/* معاينة حية */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-[#0D1424] shrink-0">
                <span
                  className="text-amber-400/80"
                  style={{
                    fontFamily: `'${fontFamily}', sans-serif`,
                    fontSize: FONT_SIZE_OPTIONS.find(o => o.value === fontSize)?.px ?? '15px',
                    fontWeight,
                    lineHeight: 1,
                  }}
                >أبجد</span>
                <span
                  className="text-white/20"
                  style={{
                    fontFamily: `'${fontFamily}', sans-serif`,
                    fontSize: FONT_SIZE_OPTIONS.find(o => o.value === fontSize)?.px ?? '15px',
                    fontWeight,
                    lineHeight: 1,
                  }}
                >Abc</span>
              </div>

            </div>
          </div>

        </div>
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
