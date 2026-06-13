import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, CalendarDays, Save } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function FiscalYearStartCard() {
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await authFetch(api('/api/settings/system'));
      if (r.ok) {
        const d = (await r.json()) as Record<string, string>;
        if (d.fiscal_year_start) setDate(d.fiscal_year_start);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!date) {
      toast({ title: 'اختر تاريخاً أولاً', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const r = await authFetch(api('/api/settings/system'), {
        method: 'POST',
        body: JSON.stringify({ key: 'fiscal_year_start', value: date }),
      });
      if (!r.ok) throw new Error();
      setSaved(true);
      toast({ title: '✅ تم حفظ تاريخ بداية السنة المالية' });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast({ title: 'فشل الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
        <CalendarDays className="w-5 h-5 text-amber-400" />
      </div>
      <div className="flex-1">
        <p className="text-ink font-bold text-sm">تاريخ بداية السنة المالية</p>
        <p className="text-ink/40 text-xs mt-0.5">
          يُحدد نقطة البداية للفترة المحاسبية الأولى — يؤثر على التقارير والمقارنات الدورية
        </p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
          className="glass-input rounded-xl px-3 py-2 text-sm outline-none transition-all w-40"
        />
        <button
          onClick={handleSave}
          disabled={saving || !date}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 font-bold text-xs transition-all disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saving ? 'جاري...' : saved ? 'تم' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
