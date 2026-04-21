import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { useToast } from '@/hooks/use-toast';
import { Banknote, Save, Percent, Users, DollarSign, CalendarDays, ShieldCheck, Loader2 } from 'lucide-react';
import { PageHeader } from './_shared';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

interface AdvanceSettings {
  max_advance_percentage: number;
  max_concurrent_advances: number;
  min_salary_for_advance: number;
  repayment_tenure_months: number;
  requires_approval: boolean;
}

const DEFAULT_SETTINGS: AdvanceSettings = {
  max_advance_percentage: 50,
  max_concurrent_advances: 2,
  min_salary_for_advance: 3000,
  repayment_tenure_months: 1,
  requires_approval: true,
};

function Section({ icon: Icon, title, children }: { icon: React.FC<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden" style={{ background: 'var(--erp-bg-card)' }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
        <Icon className="w-4 h-4 text-amber-400" />
        <p className="text-white/70 text-xs font-bold uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function NumberField({
  icon: Icon,
  label,
  value,
  onChange,
  suffix,
  hint,
  min = 0,
  step = 1,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
        <Icon className="w-3.5 h-3.5 text-amber-400" />
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2.5 pl-14 bg-white/5 border border-white/10 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-amber-500/50 transition"
        />
        {suffix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-white/35">{hint}</p>}
    </div>
  );
}

export default function SalaryAdvanceTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AdvanceSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery<AdvanceSettings>({
    queryKey: ['/api/salary-advances/settings'],
    queryFn: () => authFetch(api('/api/salary-advances/settings')).then((r) => r.json()),
  });

  useEffect(() => {
    if (data) {
      setSettings({
        max_advance_percentage: Number(data.max_advance_percentage ?? 50),
        max_concurrent_advances: Number(data.max_concurrent_advances ?? 2),
        min_salary_for_advance: Number(data.min_salary_for_advance ?? 3000),
        repayment_tenure_months: Number(data.repayment_tenure_months ?? 1),
        requires_approval: data.requires_approval !== false,
      });
      setDirty(false);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: AdvanceSettings) =>
      authFetch(api('/api/salary-advances/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'فشل الحفظ');
        return d;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/salary-advances/settings'] });
      toast({ title: 'تم حفظ إعدادات السلف' });
      setDirty(false);
    },
    onError: (e: Error) => toast({ title: e.message, variant: 'destructive' }),
  });

  function update<K extends keyof AdvanceSettings>(key: K, value: AdvanceSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin ml-2" /> جاري التحميل…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات السلف"
        sub="تحكم في حدود وقواعد منح السلف للموظفين"
      />

      <Section icon={Percent} title="حدود السلفة">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            icon={Percent}
            label="الحد الأقصى من الراتب"
            value={settings.max_advance_percentage}
            onChange={(v) => update('max_advance_percentage', v)}
            suffix="%"
            hint="نسبة مئوية من راتب الموظف الأساسي"
            min={1}
            step={1}
          />
          <NumberField
            icon={DollarSign}
            label="الحد الأدنى للراتب المؤهل"
            value={settings.min_salary_for_advance}
            onChange={(v) => update('min_salary_for_advance', v)}
            suffix="ج.م"
            hint="لن يتم قبول سلف لمن يقل راتبهم عن هذا الحد"
            min={0}
            step={100}
          />
        </div>
      </Section>

      <Section icon={Users} title="ضوابط الطلبات">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            icon={Users}
            label="عدد السلف المتزامنة المسموح بها"
            value={settings.max_concurrent_advances}
            onChange={(v) => update('max_concurrent_advances', v)}
            suffix="سلفة"
            hint="عدد السلف النشطة في نفس الوقت لكل موظف"
            min={1}
            step={1}
          />
          <NumberField
            icon={CalendarDays}
            label="مدة السداد الافتراضية"
            value={settings.repayment_tenure_months}
            onChange={(v) => update('repayment_tenure_months', v)}
            suffix="شهر"
            hint="عدد الأشهر الافتراضي لسداد السلفة"
            min={1}
            step={1}
          />
        </div>
      </Section>

      <Section icon={ShieldCheck} title="الموافقة">
        <button
          type="button"
          onClick={() => update('requires_approval', !settings.requires_approval)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border transition ${
            settings.requires_approval
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <div className="text-right">
            <div className="text-sm font-bold text-white">طلب اعتماد قبل صرف السلفة</div>
            <p className="text-[11px] text-white/40 mt-0.5">
              عند التفعيل: السلف تحتاج موافقة من له صلاحية إدارة الرواتب قبل الاعتماد
            </p>
          </div>
          <div
            className={`relative w-12 h-6 rounded-full transition shrink-0 ${
              settings.requires_approval ? 'bg-emerald-500' : 'bg-white/15'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                settings.requires_approval ? 'right-0.5' : 'right-6'
              }`}
            />
          </div>
        </button>
      </Section>

      <div className="flex items-center justify-end gap-3 pt-2">
        {dirty && (
          <span className="text-[11px] text-amber-400 font-bold">• يوجد تغييرات لم تُحفظ</span>
        )}
        <button
          onClick={() => saveMut.mutate(settings)}
          disabled={!dirty || saveMut.isPending}
          className="erp-btn erp-btn-primary flex items-center gap-2 px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveMut.isPending ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}
