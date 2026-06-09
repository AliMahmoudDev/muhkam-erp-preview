import { api } from '@/lib/api';
import { uploadFileToR2, resolveUploadedFileUrl } from '@/lib/file-upload';
/**
 * company-tab.tsx — إعدادات الشركة والعلامة التجارية
 * يحفظ عبر POST /api/settings/system
 */
import { useState, useEffect, useRef } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Phone,
  MapPin,
  FileText,
  Globe,
  Loader2,
  Save,
  CheckCircle2,
  Mail,
  Printer,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import { PageHeader, FieldLabel, SInput } from './_shared';

interface CompanySettings {
  company_name: string;
  company_phone: string;
  company_email: string;
  company_address: string;
  company_tax_id: string;
  company_website: string;
  invoice_header: string;
  invoice_footer: string;
  company_notes: string;
  company_logo: string;
}

const EMPTY: CompanySettings = {
  company_name: '',
  company_phone: '',
  company_email: '',
  company_address: '',
  company_tax_id: '',
  company_website: '',
  invoice_header: '',
  invoice_footer: '',
  company_notes: '',
  company_logo: '',
};

const FIELDS: {
  key: keyof CompanySettings;
  label: string;
  placeholder: string;
  icon: React.FC<{ className?: string }>;
  type?: string;
}[] = [
  {
    key: 'company_name',
    label: 'اسم الشركة',
    placeholder: 'مثال: شركة حلال تك للتجارة',
    icon: Building2,
  },
  {
    key: 'company_email',
    label: 'البريد الإلكتروني',
    placeholder: 'مثال: info@company.com',
    icon: Mail,
  },
  { key: 'company_phone', label: 'رقم الهاتف', placeholder: 'مثال: 201000000000+', icon: Phone },
  {
    key: 'company_address',
    label: 'العنوان',
    placeholder: 'مثال: القاهرة، مدينة نصر',
    icon: MapPin,
  },
  { key: 'company_tax_id', label: 'الرقم الضريبي', placeholder: 'مثال: 123456789', icon: FileText },
  {
    key: 'company_website',
    label: 'الموقع الإلكتروني',
    placeholder: 'مثال: https://example.com',
    icon: Globe,
  },
];

export default function CompanyTab() {
  const { toast } = useToast();

  const [form, setForm] = useState<CompanySettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: 'حجم الصورة كبير جداً — الحد الأقصى 500 كيلوبايت', variant: 'destructive' });
      return;
    }

    try {
      const uploaded = await uploadFileToR2(file, 'company');
      update('company_logo', uploaded.url);
      toast({ title: 'تم رفع شعار الشركة بنجاح' });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'فشل رفع شعار الشركة',
        variant: 'destructive',
      });
    } finally {
      e.currentTarget.value = '';
    }
  };

  /* ── جلب الإعدادات الحالية ── */
  useEffect(() => {
    void (async () => {
      try {
        const r = await authFetch(api('/api/settings/system'));
        if (r.ok) {
          const d = (await r.json()) as Partial<CompanySettings>;
          setForm((prev) => ({ ...prev, ...d }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (key: keyof CompanySettings, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
  };

  /* ── حفظ جميع المفاتيح ── */
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const keys = Object.keys(form) as (keyof CompanySettings)[];
      await Promise.all(
        keys.map((k) =>
          authFetch(api('/api/settings/system'), {
            method: 'POST',
            body: JSON.stringify({ key: k, value: form[k] }),
          })
        )
      );
      setSaved(true);
      setDirty(false);
      toast({ title: '✅ تم حفظ بيانات الشركة' });
    } catch {
      toast({ title: 'فشل الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="بيانات الشركة"
        sub="الهوية التجارية تظهر في الفواتير والتقارير"
        action={
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 rounded-xl text-amber-400 font-bold text-xs transition-all disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ' : 'حفظ التغييرات'}
          </button>
        }
      />

      {/* ═══ Logo Upload ═══ */}
      <div className="bg-[var(--erp-bg-card)] border border-[var(--erp-border-md)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--erp-border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <ImagePlus className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <p className="font-bold text-[var(--erp-text-1)] text-sm">شعار الشركة</p>
            <p className="text-[var(--erp-text-4)] text-xs">
              يظهر في رأس الفواتير والتقارير المطبوعة
            </p>
          </div>
        </div>
        <div className="p-5 flex items-center gap-5">
          {/* Preview */}
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center overflow-hidden bg-white/3 shrink-0">
            {form.company_logo ? (
              <img
                src={resolveUploadedFileUrl(form.company_logo)}
                alt="شعار"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-white/20">
                <ImagePlus className="w-6 h-6" />
                <span className="text-[10px]">الشعار</span>
              </div>
            )}
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 font-bold text-xs transition-all"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {form.company_logo ? 'تغيير الشعار' : 'رفع شعار'}
            </button>
            {form.company_logo && (
              <button
                type="button"
                onClick={() => update('company_logo', '')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-xs transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف الشعار
              </button>
            )}
            <p className="text-white/25 text-[10px]">PNG أو JPG — الحد الأقصى 500 كيلوبايت</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          بطاقة — بيانات الشركة الأساسية
      ════════════════════════════════════════════════════ */}
      <div className="bg-[var(--erp-bg-card)] border border-[var(--erp-border-md)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--erp-border)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-[var(--erp-text-1)] text-sm">المعلومات الأساسية</p>
            <p className="text-[var(--erp-text-4)] text-xs">
              تُستخدم في رأس الفواتير والتقارير المطبوعة
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-white/25 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري التحميل...
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.key} className={f.key === 'company_name' ? 'sm:col-span-2' : ''}>
                  <FieldLabel>
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-white/30" />
                      {f.label}
                    </span>
                  </FieldLabel>
                  <SInput
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                </div>
              );
            })}

            {/* رأس وتذييل الفاتورة */}
            <div className="sm:col-span-2">
              <FieldLabel>
                <span className="flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-white/30" />
                  رأس الفاتورة (invoice header)
                </span>
              </FieldLabel>
              <textarea
                rows={2}
                placeholder="نص يظهر في أعلى كل فاتورة مطبوعة، مثال: بسم الله الرحمن الرحيم"
                value={form.invoice_header}
                onChange={(e) => update('invoice_header', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 resize-none transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>تذييل الفاتورة (invoice footer)</FieldLabel>
              <textarea
                rows={2}
                placeholder="نص يظهر في أسفل كل فاتورة مطبوعة، مثال: شكراً لتعاملكم معنا"
                value={form.invoice_footer}
                onChange={(e) => update('invoice_footer', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 resize-none transition-colors"
              />
            </div>

            {/* ملاحظات */}
            <div className="sm:col-span-2">
              <FieldLabel>ملاحظات إضافية</FieldLabel>
              <textarea
                rows={3}
                placeholder="أي معلومات إضافية تظهر أسفل الفواتير..."
                value={form.company_notes}
                onChange={(e) => update('company_notes', e.target.value)}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/40 resize-none transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* معاينة — كيف تبدو البيانات في الفاتورة */}
      {!loading && (form.company_name || form.company_phone || form.company_address) && (
        <div className="bg-[var(--erp-bg-card)] border border-amber-500/25 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--erp-border)] bg-amber-500/5">
            <p className="text-amber-400 text-xs font-bold">معاينة — رأس الفاتورة</p>
          </div>
          <div className="p-5 space-y-1 text-right">
            {form.company_name && (
              <p className="text-[var(--erp-text-1)] font-black text-base">{form.company_name}</p>
            )}
            {form.company_address && (
              <p className="text-[var(--erp-text-3)] text-sm">{form.company_address}</p>
            )}
            {form.company_phone && (
              <p className="text-[var(--erp-text-3)] text-sm">{form.company_phone}</p>
            )}
            {form.company_tax_id && (
              <p className="text-[var(--erp-text-4)] text-xs">
                الرقم الضريبي: {form.company_tax_id}
              </p>
            )}
            {form.company_website && (
              <p className="text-amber-400/60 text-xs">{form.company_website}</p>
            )}
            {form.company_notes && (
              <p className="text-[var(--erp-text-4)] text-xs mt-2 border-t border-[var(--erp-border)] pt-2">
                {form.company_notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
