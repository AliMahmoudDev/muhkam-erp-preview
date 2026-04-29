const STORAGE_KEY = 'halal_erp_settings';

type CurrencyCode = 'EGP' | 'USD' | 'CNY';
type ThousandsSeparator = 'comma' | 'period' | 'space' | 'arabic-comma';

const CURRENCY_MAP: Record<CurrencyCode, { locale: string; symbol: string }> = {
  EGP: { locale: 'ar-EG-u-nu-latn', symbol: 'ج.م' },
  USD: { locale: 'en-US',           symbol: '$'    },
  CNY: { locale: 'zh-CN',           symbol: '¥'    },
};

/* ─── numeral helpers ──────────────────────────────────────── */

function toWestern(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0630));
}

function toArabicIndic(str: string): string {
  return str.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0x0630));
}

function getActiveCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.currency && CURRENCY_MAP[parsed.currency as CurrencyCode]) {
        return parsed.currency as CurrencyCode;
      }
    }
  } catch {}
  return 'EGP';
}

function getActiveNumberFormat(): 'western' | 'arabic-indic' {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.numberFormat === 'arabic-indic') return 'arabic-indic';
    }
  } catch {}
  return 'western';
}

function getActiveDecimalPlaces(): 0 | 2 | 3 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const dp = parsed.decimalPlaces;
      if (dp === 0 || dp === 2 || dp === 3) return dp;
    }
  } catch {}
  return 2;
}

function getActiveThousandsSep(): ThousandsSeparator {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sep = parsed.thousandsSeparator;
      if (['comma', 'period', 'space', 'arabic-comma'].includes(sep)) return sep as ThousandsSeparator;
    }
  } catch {}
  return 'comma';
}

/** Apply the stored number-format preference to an already-formatted string */
function applyNumberFormat(str: string, fmt: 'western' | 'arabic-indic'): string {
  if (fmt === 'arabic-indic') return toArabicIndic(toWestern(str));
  return toWestern(str);
}

/** Apply custom thousands separator to a formatted number string */
function applyThousandsSep(str: string, sep: ThousandsSeparator): string {
  if (sep === 'comma') return str; // default Intl output uses comma
  return str
    .replace(/,/g, sep === 'period' ? '.' : sep === 'space' ? ' ' : '،');
}

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '0.00';
  const code = getActiveCurrency();
  const { locale, symbol } = CURRENCY_MAP[code];
  const numFmt  = getActiveNumberFormat();
  const dp      = getActiveDecimalPlaces();
  const tSep    = getActiveThousandsSep();
  try {
    const raw = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(amount);
    return applyNumberFormat(applyThousandsSep(raw, tSep), numFmt);
  } catch {
    const raw = `${amount.toFixed(dp)} ${symbol}`;
    return applyNumberFormat(applyThousandsSep(raw, tSep), numFmt);
  }
}

/**
 * Format a plain number according to the stored number-format preference.
 */
export function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '0';
  const fmt  = getActiveNumberFormat();
  const tSep = getActiveThousandsSep();
  const raw  = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return applyNumberFormat(applyThousandsSep(raw, tSep), fmt);
}

/**
 * Preview-only formatter — does NOT read from localStorage.
 * Used for live previews where the user has not yet saved settings.
 */
export function formatCurrencyPreview(
  amount: number,
  currency: CurrencyCode,
  numberFormat: 'western' | 'arabic-indic'
): string {
  const { locale, symbol } = CURRENCY_MAP[currency];
  try {
    const raw = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return applyNumberFormat(raw, numberFormat);
  } catch {
    const raw = `${amount.toFixed(2)} ${symbol}`;
    return applyNumberFormat(raw, numberFormat);
  }
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return '-';
  }
}
