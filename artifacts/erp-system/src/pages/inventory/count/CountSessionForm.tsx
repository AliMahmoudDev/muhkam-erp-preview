import { ClipboardList, TrendingUp } from 'lucide-react';
import type { CountMode } from './types';
import { Combobox } from '@/components/ui/combobox';

export function CountSessionForm({
  warehouses,
  selectedWarehouse,
  setSelectedWarehouse,
  countDate,
  setCountDate,
  countTime,
  setCountTime,
  sessionNotes,
  setSessionNotes,
  countMode,
  setCountMode,
}: {
  warehouses: { id: number; name: string }[];
  selectedWarehouse: number;
  setSelectedWarehouse: (v: number) => void;
  countDate: string;
  setCountDate: (v: string) => void;
  countTime: string;
  setCountTime: (v: string) => void;
  sessionNotes: string;
  setSessionNotes: (v: string) => void;
  countMode: CountMode;
  setCountMode: (v: CountMode) => void;
}) {
  return (
    <div className="bg-canvas border border-line rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-ink/70 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-ink/50" /> إعدادات جلسة الجرد
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="erp-label">
            المخزن <span className="text-red-400">*</span>
          </label>
          <Combobox
            options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
            value={selectedWarehouse ? String(selectedWarehouse) : ''}
            onChange={(v) => setSelectedWarehouse(v ? Number(v) : 0)}
            placeholder="— اختر مخزناً —"
            className="w-full"
          />
        </div>
        <div>
          <label className="erp-label">
            تاريخ الجرد <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
            className="erp-input w-full text-sm"
          />
        </div>
        <div>
          <label className="erp-label">
            وقت الجرد <span className="text-red-400">*</span>
          </label>
          <input
            type="time"
            value={countTime}
            onChange={(e) => setCountTime(e.target.value)}
            className="erp-input w-full text-sm"
          />
        </div>
        <div>
          <label className="erp-label">ملاحظات الجلسة (اختياري)</label>
          <input
            type="text"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="مثال: جرد نهاية الشهر"
            className="erp-input w-full text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-4 pt-1">
        <span className="text-ink/50 text-xs">نوع الجرد:</span>
        <div className="flex gap-2">
          {[
            { v: 'full' as const, label: 'شامل — كل المنتجات' },
            { v: 'positive' as const, label: 'منتجات موجبة' },
            { v: 'partial' as const, label: 'جزئي — منتجات محددة' },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setCountMode(opt.v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                countMode === opt.v
                  ? opt.v === 'positive'
                    ? 'bg-green-600 text-ink'
                    : 'bg-amber-500 text-black'
                  : 'bg-surface text-ink/50 hover:text-ink'
              }`}
            >
              {opt.v === 'positive' && <TrendingUp className="w-3 h-3 inline me-1" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
