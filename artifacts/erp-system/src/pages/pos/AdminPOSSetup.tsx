import { useState, useMemo } from 'react';
import { safeArray } from '@/lib/safe-data';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { useWarehouses } from '@/hooks/useWarehouses';
import { SearchableSelect } from '@/components/searchable-select';
import { Store, Vault, Zap } from 'lucide-react';

export default function AdminPOSSetup({ onStart }: { onStart: (w: number, s: number) => void }) {
  const { warehouses } = useWarehouses();
  const { data: rawSafesData } = useGetSettingsSafes();
  const rawSafes = safeArray(rawSafesData);
  const safes = rawSafes as { id: number; name: string }[];

  const [wId, setWId] = useState<string>(() => localStorage.getItem('pos:lastWarehouse') ?? '');
  const [sId, setSId] = useState<string>(() => localStorage.getItem('pos:lastSafe') ?? '');

  const warehouseItems = useMemo(
    () => warehouses.map((w) => ({ value: String(w.id), label: w.name, searchKeys: [w.name] })),
    [warehouses]
  );
  const safeItems = useMemo(
    () => safes.map((s) => ({ value: String(s.id), label: s.name, searchKeys: [s.name] })),
    [safes]
  );

  const ready = !!wId && !!sId;

  function handleStart() {
    if (!ready) return;
    localStorage.setItem('pos:lastWarehouse', wId);
    localStorage.setItem('pos:lastSafe', sId);
    onStart(Number(wId), Number(sId));
  }

  return (
    <div className="erp-page fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="erp-panel w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="erp-title text-xl">اختيار الفرع والخزينة</h2>
          <p className="erp-text-muted">وضع المدير — يُختار يدوياً ولا يُحفظ في الملف الشخصي</p>
        </div>

        <div className="space-y-1.5">
          <label className="erp-label flex items-center gap-1.5">
            <Vault className="w-3.5 h-3.5" />
            الفرع / المخزن
          </label>
          <SearchableSelect
            items={warehouseItems}
            value={wId}
            onChange={setWId}
            placeholder="ابحث باسم الفرع..."
            emptyLabel="— اختر الفرع —"
            clearable={false}
          />
        </div>

        <div className="space-y-1.5">
          <label className="erp-label flex items-center gap-1.5">
            <Vault className="w-3.5 h-3.5" />
            الخزينة
          </label>
          <SearchableSelect
            items={safeItems}
            value={sId}
            onChange={setSId}
            placeholder="ابحث باسم الخزينة..."
            emptyLabel="— اختر الخزينة —"
            clearable={false}
          />
        </div>

        <button
          onClick={handleStart}
          className={`w-full h-11 text-base ${ready ? 'erp-btn-primary' : 'erp-btn-disabled'}`}
        >
          <Zap className="w-4 h-4" />
          بدء البيع
        </button>

        {ready && (
          <p className="text-center erp-text-muted">
            {warehouseItems.find((w) => w.value === wId)?.label} ·{' '}
            {safeItems.find((s) => s.value === sId)?.label}
          </p>
        )}
      </div>
    </div>
  );
}
