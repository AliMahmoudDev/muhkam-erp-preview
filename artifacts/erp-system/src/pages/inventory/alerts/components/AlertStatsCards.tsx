import { TrendingDown, AlertTriangle, Bell } from 'lucide-react';

interface AlertStatsCardsProps {
  zeroCount: number;
  lowCount: number;
  showZeroOnly: boolean;
  setShowZeroOnly: (v: boolean) => void;
  setFilterWH: (v: number | 'all') => void;
}

export function AlertStatsCards({
  zeroCount,
  lowCount,
  showZeroOnly,
  setShowZeroOnly,
  setFilterWH,
}: AlertStatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div
        role="button"
        tabIndex={0}
        title="اضغط لعرض المنتجات النافدة فقط"
        onClick={() => { setShowZeroOnly(true); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowZeroOnly(true); }}
        className={`rounded-2xl p-4 border flex items-center gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] ${
          showZeroOnly
            ? 'bg-red-500/20 border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.15)]'
            : zeroCount > 0
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-surface border-line'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
          <TrendingDown className={`w-5 h-5 ${zeroCount > 0 ? 'text-red-400' : 'text-ink/20'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink/40 text-xs">نفد المخزون</p>
          <p className={`text-2xl font-bold ${zeroCount > 0 ? 'text-red-400' : 'text-ink/30'}`}>{zeroCount}</p>
          <p className="text-ink/20 text-[10px] mt-0.5">انقر للتصفية</p>
        </div>
        {showZeroOnly && (
          <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        title="اضغط لعرض المنتجات تحت حد الطلب"
        onClick={() => { setShowZeroOnly(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowZeroOnly(false); }}
        className={`rounded-2xl p-4 border flex items-center gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] ${
          !showZeroOnly
            ? 'bg-amber-500/20 border-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.15)]'
            : lowCount > 0
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-surface border-line'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
          <AlertTriangle className={`w-5 h-5 ${lowCount > 0 ? 'text-amber-400' : 'text-ink/20'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink/40 text-xs">تحت حد الطلب</p>
          <p className={`text-2xl font-bold ${lowCount > 0 ? 'text-amber-400' : 'text-ink/30'}`}>{lowCount}</p>
          <p className="text-ink/20 text-[10px] mt-0.5">انقر للتصفية</p>
        </div>
        {!showZeroOnly && (
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        title="عرض جميع التنبيهات"
        onClick={() => { setShowZeroOnly(false); setFilterWH('all'); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowZeroOnly(false); setFilterWH('all'); } }}
        className="rounded-2xl p-4 border bg-surface border-line flex items-center gap-3 transition-all cursor-pointer select-none hover:-translate-y-0.5 hover:brightness-110 hover:bg-surface hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)]"
      >
        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center shrink-0">
          <Bell className={`w-5 h-5 ${zeroCount + lowCount > 0 ? 'text-ink/40' : 'text-ink/20'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-ink/40 text-xs">إجمالي التنبيهات</p>
          <p className={`text-2xl font-bold ${zeroCount + lowCount > 0 ? 'text-ink' : 'text-ink/30'}`}>
            {zeroCount + lowCount}
          </p>
          <p className="text-ink/20 text-[10px] mt-0.5">إعادة تعيين الفلاتر</p>
        </div>
      </div>
    </div>
  );
}
