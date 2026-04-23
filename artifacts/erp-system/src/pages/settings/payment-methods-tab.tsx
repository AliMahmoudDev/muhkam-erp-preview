/**
 * payment-methods-tab.tsx — إعدادات طرق الدفع المتاحة في النظام
 */
import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import {
  Banknote, CreditCard, ArrowLeftRight, CalendarRange,
  Save, Loader2, CheckCircle2, Info,
} from 'lucide-react';
import { PageHeader } from './_shared';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api  = (p: string) => `${BASE}${p}`;

/* ── أنواع طرق الدفع ── */
export type PaymentMethodKey = 'cash' | 'card' | 'bank_transfer' | 'installment';

export interface PaymentMethodConfig {
  enabled:  boolean;
  label:    string;
  note:     string;
}

export type PaymentMethodsSettings = Record<PaymentMethodKey, PaymentMethodConfig>;

export const PAYMENT_METHODS_DEFAULTS: PaymentMethodsSettings = {
  cash:          { enabled: true,  label: 'نقدي',          note: 'دفع نقدي مباشر'              },
  card:          { enabled: false, label: 'شبكة / بطاقة',  note: 'بطاقة ائتمان أو مدى'         },
  bank_transfer: { enabled: false, label: 'تحويل بنكي',    note: 'تحويل عبر البنك أو المحفظة' },
  installment:   { enabled: false, label: 'تقسيط',         note: 'دفع على أقساط متفق عليها'   },
};

const METHOD_ICONS: Record<PaymentMethodKey, React.FC<{ className?: string }>> = {
  cash:          Banknote,
  card:          CreditCard,
  bank_transfer: ArrowLeftRight,
  installment:   CalendarRange,
};

const METHOD_COLORS: Record<PaymentMethodKey, string> = {
  cash:          'emerald',
  card:          'blue',
  bank_transfer: 'violet',
  installment:   'amber',
};

/* تحميل الإعدادات من السيرفر */
async function loadPaymentSettings(): Promise<PaymentMethodsSettings> {
  try {
    const r = await authFetch(api('/api/settings/system'));
    if (!r.ok) return { ...PAYMENT_METHODS_DEFAULTS };
    const data = await r.json() as Record<string, string>;
    const raw  = data['payment_methods'];
    if (!raw) return { ...PAYMENT_METHODS_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PaymentMethodsSettings>;
    const merged: PaymentMethodsSettings = { ...PAYMENT_METHODS_DEFAULTS };
    (Object.keys(PAYMENT_METHODS_DEFAULTS) as PaymentMethodKey[]).forEach(k => {
      if (parsed[k]) merged[k] = { ...PAYMENT_METHODS_DEFAULTS[k], ...parsed[k] };
    });
    return merged;
  } catch {
    return { ...PAYMENT_METHODS_DEFAULTS };
  }
}

export default function PaymentMethodsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PaymentMethodsSettings>({ ...PAYMENT_METHODS_DEFAULTS });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [dirty,    setDirty]    = useState(false);

  /* تحميل الإعدادات */
  useEffect(() => {
    loadPaymentSettings()
      .then(s => { setSettings(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = useCallback((key: PaymentMethodKey) => {
    if (key === 'cash') {
      toast({ title: 'لا يمكن تعطيل الدفع النقدي', variant: 'destructive' });
      return;
    }
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }));
    setDirty(true);
    setSaved(false);
  }, [toast]);

  const updateLabel = useCallback((key: PaymentMethodKey, label: string) => {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], label } }));
    setDirty(true);
    setSaved(false);
  }, []);

  const updateNote = useCallback((key: PaymentMethodKey, note: string) => {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], note } }));
    setDirty(true);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await authFetch(api('/api/settings/system'), {
        method: 'POST',
        body:   JSON.stringify({ key: 'payment_methods', value: JSON.stringify(settings) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'فشل الحفظ');
      setSaved(true);
      setDirty(false);
      toast({ title: '✅ تم حفظ إعدادات طرق الدفع' });
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      toast({ title: 'فشل الحفظ', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = (Object.keys(settings) as PaymentMethodKey[]).filter(k => settings[k].enabled).length;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/5 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="طرق الدفع"
        sub="حدد طرق الدفع المتاحة في نقطة البيع والمبيعات"
        action={
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all
              ${dirty ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
          >
            {saving  ? <Loader2     className="w-3.5 h-3.5 animate-spin" />
             : saved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
             :         <Save        className="w-3.5 h-3.5" />}
            {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ' : 'حفظ التغييرات'}
          </button>
        }
      />

      {/* ملاحظة توضيحية */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/6 border border-blue-500/15 text-xs text-blue-300/80">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
        <span>
          طرق الدفع المُفعَّلة هنا (<strong className="text-blue-300">{enabledCount} مُفعَّلة</strong>) ستظهر في نافذة تسوية الدفع عند البيع.
          الدفع النقدي دائم ولا يمكن تعطيله.
        </span>
      </div>

      {/* بطاقات طرق الدفع */}
      <div className="space-y-3">
        {(Object.keys(settings) as PaymentMethodKey[]).map(key => {
          const cfg    = settings[key];
          const Icon   = METHOD_ICONS[key];
          const color  = METHOD_COLORS[key];
          const locked = key === 'cash';

          return (
            <div
              key={key}
              className={`rounded-2xl border overflow-hidden transition-all duration-200
                ${cfg.enabled
                  ? `bg-${color}-500/6 border-${color}-500/20`
                  : 'bg-white/3 border-white/8'}`}
            >
              {/* رأس البطاقة */}
              <div className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  ${cfg.enabled ? `bg-${color}-500/15` : 'bg-white/8'}`}>
                  <Icon className={`w-5 h-5 ${cfg.enabled ? `text-${color}-400` : 'text-white/30'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm ${cfg.enabled ? 'text-white' : 'text-white/50'}`}>
                      {cfg.label}
                    </p>
                    {locked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                        إلزامي
                      </span>
                    )}
                  </div>
                  <p className="text-white/35 text-xs mt-0.5">{cfg.note}</p>
                </div>

                {/* مفتاح التفعيل */}
                <button
                  onClick={() => toggle(key)}
                  disabled={locked}
                  className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0
                    ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}
                    ${cfg.enabled ? `bg-${color}-500` : 'bg-white/15'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300
                    ${cfg.enabled ? 'right-0.5' : 'left-0.5'}`}
                  />
                </button>
              </div>

              {/* حقول التخصيص — تظهر فقط عند التفعيل */}
              {cfg.enabled && !locked && (
                <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/6 pt-3">
                  <div>
                    <label className="block text-[10px] text-white/35 font-semibold uppercase tracking-wide mb-1.5">
                      اسم الزر في شاشة الدفع
                    </label>
                    <input
                      type="text"
                      value={cfg.label}
                      onChange={e => updateLabel(key, e.target.value)}
                      maxLength={20}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500/40 transition-colors"
                      placeholder="مثال: فيزا / مدى"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/35 font-semibold uppercase tracking-wide mb-1.5">
                      ملاحظة توضيحية (اختياري)
                    </label>
                    <input
                      type="text"
                      value={cfg.note}
                      onChange={e => updateNote(key, e.target.value)}
                      maxLength={50}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500/40 transition-colors"
                      placeholder="وصف مختصر لطريقة الدفع"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ملخص */}
      <div className="p-4 rounded-2xl bg-white/3 border border-white/6 space-y-2">
        <p className="text-white/40 text-xs font-bold uppercase tracking-wide">ملخص طرق الدفع المُفعَّلة</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(settings) as PaymentMethodKey[])
            .filter(k => settings[k].enabled)
            .map(k => {
              const color = METHOD_COLORS[k];
              const Icon  = METHOD_ICONS[k];
              return (
                <span
                  key={k}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-${color}-500/12 text-${color}-400 border border-${color}-500/20`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {settings[k].label}
                </span>
              );
            })}
        </div>
      </div>
    </div>
  );
}
