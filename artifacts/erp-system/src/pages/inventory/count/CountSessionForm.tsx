import { ClipboardList, TrendingUp } from 'lucide-react';
import type { CountMode } from './types';

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
    <div className="bg-[#111827] border border-line rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-ink/70 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-violet-400" /> إعدادات جلسة الجرد
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-ink/50 text-xs mb-1.5">
            المخزن <span className="text-red-400">*</span>
          </label>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(Number(e.target.value))}
            className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          >
            <option value={0} className="bg-[#1a1a2e]">
              — اختر مخزناً —
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id} className="bg-[#1a1a2e]">
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-ink/50 text-xs mb-1.5">
            تاريخ الجرد <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
            className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          />
        </div>
        <div>
          <label className="block text-ink/50 text-xs mb-1.5">
            وقت الجرد <span className="text-red-400">*</span>
          </label>
          <input
            type="time"
            value={countTime}
            onChange={(e) => setCountTime(e.target.value)}
            className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
          />
        </div>
        <div>
          <label className="block text-ink/50 text-xs mb-1.5">ملاحظات الجلسة (اختياري)</label>
          <input
            type="text"
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="مثال: جرد نهاية الشهر"
            className="w-full bg-surface border border-line rounded-xl px-3 py-2 text-ink text-sm placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
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
                    : 'bg-violet-500 text-ink'
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
