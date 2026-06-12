import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { useInvalidateVatSettings } from '@/hooks/useVatSettings';
import {
  Save,
  CheckCircle2,
  Percent,
  ToggleLeft,
  ToggleRight,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from './_shared';

export default function VatTab() {
  const { toast } = useToast();
  const invalidateVat = useInvalidateVatSettings();

  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState('14');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authFetch('/api/settings/system')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setVatEnabled(data['vat_enabled'] === 'true');
        setVatRate(data['vat_rate'] ?? '14');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const rate = parseFloat(vatRate);
    if (vatEnabled && (isNaN(rate) || rate <= 0 || rate > 100)) {
      toast({
        title: 'نسبة غير صحيحة',
        description: 'أدخل نسبة ضريبة بين 0.1% و 100%',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        authFetch('/api/settings/system', {
          method: 'POST',
          body: JSON.stringify({ key: 'vat_enabled', value: vatEnabled ? 'true' : 'false' }),
        }),
        authFetch('/api/settings/system', {
          method: 'POST',
          body: JSON.stringify({ key: 'vat_rate', value: String(rate || 14) }),
        }),
      ]);

      invalidateVat();
      setSaved(true);
      toast({
        title: vatEnabled
          ? `✓ تم تفعيل ضريبة القيمة المضافة (${rate}%)`
          : '✓ تم تعطيل ضريبة القيمة المضافة',
        description: vatEnabled
          ? 'ستظهر الضريبة تلقائياً في فواتير المبيعات والمشتريات'
          : 'لن تُحسب الضريبة في أي فاتورة جديدة',
      });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'خطأ في الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-surface rounded-xl" />
        <div className="h-32 bg-surface rounded-2xl" />
      </div>
    );
  }

  const rateNum = parseFloat(vatRate) || 14;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ضريبة القيمة المضافة"
        sub="تفعيل أو تعطيل حساب الضريبة على الفواتير — مناسب للشركات المسجّلة وغير المسجّلة في الضريبة"
      />

      {/* Main Toggle Card */}
      <div
        className="rounded-2xl border overflow-hidden transition-all"
        style={{
          background: 'var(--erp-bg-card)',
          borderColor: vatEnabled ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.05)',
          boxShadow: vatEnabled ? '0 0 30px rgba(245,158,11,0.08)' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={{
                background: vatEnabled ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
              }}
            >
              <Percent
                className={`w-4.5 h-4.5 ${vatEnabled ? 'text-amber-400' : 'text-ink/30'}`}
              />
            </div>
            <div>
              <p className="text-ink font-bold text-sm">ضريبة القيمة المضافة (VAT)</p>
              <p className="text-ink/40 text-xs mt-0.5">
                {vatEnabled ? `مفعّلة — ${rateNum}% على الفواتير` : 'معطّلة — لا تُحسب الضريبة'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setVatEnabled((v) => !v)}
            className="transition-all focus:outline-none"
            aria-label={vatEnabled ? 'تعطيل الضريبة' : 'تفعيل الضريبة'}
          >
            {vatEnabled ? (
              <ToggleRight className="w-10 h-10 text-amber-400" />
            ) : (
              <ToggleLeft className="w-10 h-10 text-ink/25" />
            )}
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Rate input — only visible when enabled */}
          <div
            className="overflow-hidden transition-all"
            style={{
              maxHeight: vatEnabled ? '200px' : '0px',
              opacity: vatEnabled ? 1 : 0,
              transition: 'max-height 0.3s ease, opacity 0.25s ease',
            }}
          >
            <div
              className="border border-line rounded-2xl p-4"
              style={{ background: 'var(--erp-bg-elevated, #0D1424)' }}
            >
              <p className="text-ink/60 text-xs font-bold uppercase tracking-wider mb-3">
                نسبة الضريبة
              </p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.5"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-amber-500/50 ltr text-right"
                    dir="ltr"
                    placeholder="14"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    %
                  </span>
                </div>
                <div className="flex gap-2">
                  {[5, 10, 14, 15].map((r) => (
                    <button
                      key={r}
                      onClick={() => setVatRate(String(r))}
                      className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                      style={{
                        background:
                          parseFloat(vatRate) === r
                            ? 'rgba(245,158,11,0.2)'
                            : 'rgba(255,255,255,0.05)',
                        color: parseFloat(vatRate) === r ? '#F59E0B' : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${parseFloat(vatRate) === r ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-ink/30 text-xs mt-2.5">
                النسبة المطبّقة في مصر: 14% للسلع والخدمات العامة
              </p>
            </div>
          </div>

          {/* Preview */}
          {vatEnabled && (
            <div
              className="rounded-xl border border-amber-500/15 p-4"
              style={{ background: 'rgba(245,158,11,0.05)' }}
            >
              <p className="text-amber-400/80 text-xs font-bold mb-3">معاينة الفاتورة</p>
              <div className="space-y-1.5 text-sm">
                {[
                  { label: 'سعر المنتج', value: 100 },
                  {
                    label: `ضريبة القيمة المضافة (${rateNum}%)`,
                    value: (100 * rateNum) / 100,
                    highlight: true,
                  },
                  { label: 'الإجمالي النهائي', value: 100 + (100 * rateNum) / 100, bold: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span
                      className={
                        row.bold
                          ? 'text-ink font-bold'
                          : row.highlight
                            ? 'text-amber-400/80'
                            : 'text-ink/50'
                      }
                    >
                      {row.label}
                    </span>
                    <span
                      className={`font-mono ${row.bold ? 'text-ink font-black' : row.highlight ? 'text-amber-400' : 'text-ink/50'}`}
                    >
                      {row.value.toFixed(2)} ج.م
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info note */}
          <div
            className="flex items-start gap-3 p-3.5 rounded-xl border"
            style={{
              background: vatEnabled ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.03)',
              borderColor: vatEnabled ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)',
            }}
          >
            <Info
              className={`w-4 h-4 shrink-0 mt-0.5 ${vatEnabled ? 'text-blue-400/70' : 'text-ink/25'}`}
            />
            <p
              className={`text-xs leading-relaxed ${vatEnabled ? 'text-blue-300/70' : 'text-ink/30'}`}
            >
              {vatEnabled
                ? 'عند تفعيل الضريبة، ستظهر خانة «نسبة الضريبة» في نماذج المبيعات والمشتريات، وسيُضاف مبلغ الضريبة تلقائياً للإجمالي.'
                : 'هذا الإعداد للشركات غير المسجّلة في منظومة الضريبة على القيمة المضافة. يمكن تفعيله في أي وقت لاحقاً.'}
            </p>
          </div>
        </div>
      </div>

      {/* Compliance note */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl border border-line"
        style={{ background: 'var(--erp-bg-card)' }}
      >
        <ShieldCheck className="w-4 h-4 text-emerald-400/60 shrink-0 mt-0.5" />
        <div>
          <p className="text-ink/60 text-xs font-bold mb-1">التزام ضريبي</p>
          <p className="text-ink/30 text-xs leading-relaxed">
            يجب تسجيل المنشأة في مصلحة الضرائب المصرية (TA) للحصول على رقم تسجيل ضريبي قبل تحصيل
            الضريبة من العملاء. النسبة الموحّدة حالياً 14%.
          </p>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        style={{
          background: saved
            ? 'rgba(52,211,153,0.9)'
            : 'linear-gradient(to right, #F59E0B, #D97706)',
          color: '#000',
          boxShadow: saved ? '0 4px 20px rgba(52,211,153,0.3)' : '0 4px 20px rgba(245,158,11,0.25)',
        }}
      >
        {saved ? (
          <>
            <CheckCircle2 className="w-4 h-4" /> تم الحفظ
          </>
        ) : (
          <>
            <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : 'حفظ إعداد الضريبة'}
          </>
        )}
      </button>
    </div>
  );
}
