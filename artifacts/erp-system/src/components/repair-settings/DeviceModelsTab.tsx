import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { BRAND_CATEGORIES } from './DashboardCardsTab';
import { Combobox } from '@/components/ui/combobox';

interface DeviceModel {
  id: number;
  brand: string;
  category: string;
  model: string;
  sort_order: number;
}

export default function DeviceModelsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selBrand, setSelBrand] = useState('');
  const [selCat, setSelCat] = useState('');
  const [newModel, setNewModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: models = [], isLoading } = useQuery<DeviceModel[]>({
    queryKey: ['/api/repair-device-models'],
    queryFn: () =>
      authFetch(api('/api/repair-device-models'))
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
  });

  const cats = selBrand ? (BRAND_CATEGORIES[selBrand] ?? []) : [];

  const filtered = useMemo(
    () =>
      models.filter(
        (m) => (!selBrand || m.brand === selBrand) && (!selCat || m.category === selCat)
      ),
    [models, selBrand, selCat]
  );

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, DeviceModel[]>> = {};
    for (const m of selBrand || selCat ? filtered : models) {
      if (!map[m.brand]) map[m.brand] = {};
      if (!map[m.brand][m.category]) map[m.brand][m.category] = [];
      map[m.brand][m.category].push(m);
    }
    return map;
  }, [filtered, models, selBrand, selCat]);

  const handleAdd = async () => {
    if (!selBrand || !selCat || !newModel.trim()) {
      toast({ title: 'أدخل الماركة والفئة والموديل', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const r = await authFetch(api('/api/repair-device-models'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: selBrand, category: selCat, model: newModel.trim() }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? 'خطأ');
      }
      await qc.invalidateQueries({ queryKey: ['/api/repair-device-models'] });
      setNewModel('');
      toast({ title: 'تم إضافة الموديل بنجاح' });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل الحفظ', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await authFetch(api(`/api/repair-device-models/${id}`), { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['/api/repair-device-models'] });
      toast({ title: 'تم حذف الموديل' });
    } catch {
      toast({ title: 'فشل الحذف', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-line bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-line">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
          <h3 className="font-semibold text-base text-ink">موديلات مخصّصة</h3>
        </div>
        <p className="text-xs text-ink/50">
          أضف موديلات جديدة تظهر في قائمة الموديل عند إنشاء بطاقة صيانة
        </p>
      </div>

      {/* Add form */}
      <div className="px-6 py-4 border-b border-line bg-surface">
        <p className="text-xs font-medium mb-3 text-ink/60">إضافة موديل جديد</p>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Combobox
              options={[
                { value: '', label: '— الماركة —' },
                ...Object.keys(BRAND_CATEGORIES).map((b) => ({ value: b, label: b })),
              ]}
              value={selBrand}
              onChange={(v) => { setSelBrand(v); setSelCat(''); }}
              className="flex-1"
            />
            <Combobox
              options={[
                { value: '', label: '— الفئة —' },
                ...cats.map((c) => ({ value: c, label: c })),
              ]}
              value={selCat}
              onChange={(v) => setSelCat(v)}
              disabled={!selBrand}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="مثال: iPhone 17 Pro Max"
              className={`flex-1 ${inputCls}`}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !selBrand || !selCat || !newModel.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-40 bg-amber-500/80 hover:bg-amber-500 text-black"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              {saving ? 'جارٍ الحفظ…' : 'إضافة'}
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-2.5 border-b border-line flex gap-2 items-center">
        <span className="text-xs text-ink/40">تصفية:</span>
        <Combobox
          options={[
            { value: '', label: 'الكل' },
            ...Object.keys(BRAND_CATEGORIES).map((b) => ({ value: b, label: b })),
          ]}
          value={selBrand}
          onChange={(v) => { setSelBrand(v); setSelCat(''); }}
          className="text-xs"
        />
        <Combobox
          options={[
            { value: '', label: 'كل الفئات' },
            ...cats.map((c) => ({ value: c, label: c })),
          ]}
          value={selCat}
          onChange={(v) => setSelCat(v)}
          disabled={!selBrand}
          className="text-xs"
        />
        {models.length > 0 && (
          <span className="mr-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200/85 border border-amber-500/25">
            {filtered.length} موديل
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="text-sm text-center py-8 text-ink/30">جارٍ التحميل…</div>
        ) : models.length === 0 ? (
          <div className="text-center py-12 text-ink/30">
            <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p className="text-sm">لا توجد موديلات مضافة بعد</p>
            <p className="text-xs mt-1 opacity-70">استخدم النموذج أعلاه لإضافة موديل جديد</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink/30">
            لا توجد نتائج للتصفية الحالية
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([brand, catMap]) => (
              <div key={brand}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200/85 border border-amber-500/25">
                    {brand}
                  </span>
                </div>
                <div className="space-y-2 pr-2">
                  {Object.entries(catMap).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-[11px] font-medium mb-1.5 text-ink/40">{cat}</p>
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 divide-y divide-white/5">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2"
                          >
                            <span className="text-sm text-ink/85">{item.model}</span>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              className="p-1 rounded-lg transition-colors text-red-400/60 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
