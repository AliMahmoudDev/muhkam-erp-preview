import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { formatCurrency } from '@/lib/format';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Building2, X, TrendingDown } from 'lucide-react';
import { CATEGORIES, METHODS } from '../constants';
import { Combobox } from '@/components/ui/combobox';

export function AddAssetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    code: '',
    category: 'equipment',
    description: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: '',
    residual_value: '',
    useful_life_months: '',
    depreciation_method: 'straight_line',
  });

  const mutation = useMutation({
    mutationFn: (data: object) =>
      authFetch(api('/api/fixed-assets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/fixed-assets'] });
      toast({ title: '✅ تم إضافة الأصل بنجاح' });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'خطأ', description: e.message, variant: 'destructive' }),
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const monthlyCost =
    form.purchase_cost && form.residual_value !== undefined && form.useful_life_months
      ? (
          (Number(form.purchase_cost) - Number(form.residual_value || 0)) /
          Number(form.useful_life_months)
        ).toFixed(2)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel rounded-3xl w-full max-w-2xl border border-line shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-line sticky top-0 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-surface border border-line flex items-center justify-center">
              <Building2 className="w-5 h-5 text-ink/50" />
            </div>
            <h3 className="text-lg font-bold text-ink">إضافة أصل ثابت جديد</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-surface hover:bg-raised">
            <X className="w-4 h-4 text-ink/70" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-ink/50 mb-1">اسم الأصل *</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="مثال: جهاز لحام كهربائي"
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">الكود (اختياري)</label>
              <input
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder="سيُنشأ تلقائياً"
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">التصنيف</label>
              <Combobox
                options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v }))}
                value={form.category}
                onChange={(v) => set('category', v)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">تاريخ الشراء *</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => set('purchase_date', e.target.value)}
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">طريقة الإهلاك</label>
              <Combobox
                options={Object.entries(METHODS).map(([k, v]) => ({ value: k, label: v }))}
                value={form.depreciation_method}
                onChange={(v) => set('depreciation_method', v)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">تكلفة الشراء (ج.م) *</label>
              <input
                type="number"
                min="0"
                value={form.purchase_cost}
                onChange={(e) => set('purchase_cost', e.target.value)}
                placeholder="0.00"
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">القيمة المتبقية (ج.م)</label>
              <input
                type="number"
                min="0"
                value={form.residual_value}
                onChange={(e) => set('residual_value', e.target.value)}
                placeholder="0.00"
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink/50 mb-1">العمر الإنتاجي (بالشهور) *</label>
              <input
                type="number"
                min="1"
                value={form.useful_life_months}
                onChange={(e) => set('useful_life_months', e.target.value)}
                placeholder="مثال: 60 = 5 سنوات"
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-ink/50 mb-1">ملاحظات</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                className="w-full glass-input px-4 py-3 rounded-2xl text-ink text-sm resize-none"
              />
            </div>
          </div>

          {monthlyCost && (
            <div className="p-4 rounded-2xl bg-surface border border-line flex items-center gap-3">
              <TrendingDown className="w-5 h-5 text-ink/50 shrink-0" />
              <div>
                <p className="text-xs text-ink/50">
                  الإهلاك الشهري المقدر ({METHODS[form.depreciation_method]})
                </p>
                <p className="text-ink font-bold text-lg">
                  {formatCurrency(Number(monthlyCost))}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => mutation.mutate(form)}
              disabled={
                !form.name || !form.purchase_cost || !form.useful_life_months || mutation.isPending
              }
              className="flex-1 btn-primary py-3 disabled:opacity-50"
            >
              {mutation.isPending ? '...' : 'إضافة الأصل'}
            </button>
            <button onClick={onClose} className="px-6 btn-secondary py-3">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
