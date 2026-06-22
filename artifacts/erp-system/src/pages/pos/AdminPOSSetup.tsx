import { useState, useMemo } from 'react';
import { safeArray } from '@/lib/safe-data';
import { useGetSettingsSafes } from '@workspace/api-client-react';
import { useWarehouses } from '@/hooks/useWarehouses';
import { SearchableSelect } from '@/components/searchable-select';
import { Store, Vault, Zap } from 'lucide-react';
import { getTenantScopedStorageKey } from '@/lib/tenant-storage';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminPOSSetup({ onStart }: { onStart: (w: number, s: number) => void }) {
  const { warehouses } = useWarehouses();
  const { data: rawSafesData } = useGetSettingsSafes();
  const rawSafes = safeArray(rawSafesData);
  const safes = rawSafes as { id: number; name: string }[];

  const posLastWarehouseKey = getTenantScopedStorageKey('pos:lastWarehouse');
  const posLastSafeKey = getTenantScopedStorageKey('pos:lastSafe');

  const [wId, setWId] = useState<string>(() => localStorage.getItem(posLastWarehouseKey) ?? '');
  const [sId, setSId] = useState<string>(() => localStorage.getItem(posLastSafeKey) ?? '');

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
    localStorage.setItem(posLastWarehouseKey, wId);
    localStorage.setItem(posLastSafeKey, sId);
    onStart(Number(wId), Number(sId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg)]" dir="rtl">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8 text-[var(--brand)]" />
          </div>
          <h2 className="text-xl font-bold">اختيار الفرع والخزينة</h2>
          <p className="opacity-60 text-sm">وضع المدير — يُختار يدوياً ولا يُحفظ في الملف الشخصي</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs opacity-50 flex items-center gap-1.5">
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
          <label className="text-xs opacity-50 flex items-center gap-1.5">
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

        <Button
          className="w-full h-11 text-base"
          onClick={handleStart}
          disabled={!ready}
        >
          <Zap className="w-4 h-4" />
          بدء البيع
        </Button>

        {ready && (
          <p className="text-center opacity-60 text-sm">
            {warehouseItems.find((w) => w.value === wId)?.label} ·{' '}
            {safeItems.find((s) => s.value === sId)?.label}
          </p>
        )}
      </Card>
    </div>
  );
}
