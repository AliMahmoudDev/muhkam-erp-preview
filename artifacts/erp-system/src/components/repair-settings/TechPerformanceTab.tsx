import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { BarChart2, Wrench, PackageCheck, Clock, RefreshCw, AlertCircle } from 'lucide-react';

interface TechnicianStat {
  technician_id: number;
  technician_name: string;
  total_jobs: number;
  delivered: number;
  active_jobs: number;
  avg_duration_days: number | null;
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl p-3 gap-0.5"
      style={{ background: `${color}12`, border: `1px solid ${color}30` }}
    >
      <span className="text-[18px] font-black tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] font-semibold" style={{ color: `${color}99` }}>
        {label}
      </span>
    </div>
  );
}

function deliveryRate(total: number, delivered: number): number {
  if (total === 0) return 0;
  return Math.round((delivered / total) * 100);
}

export default function TechPerformanceTab() {
  const {
    data: stats = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<TechnicianStat[]>({
    queryKey: ['/api/repair-jobs/technician-stats'],
    queryFn: () => authFetch(api('/api/repair-jobs/technician-stats')).then((r) => r.json()),
    select: (d) => (Array.isArray(d) ? d : []),
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div>
          <h3 className="text-[15px] font-black text-white">أداء الفنيين</h3>
          <p className="text-[11px] text-white/40 mt-0.5">
            ملخص إنجاز كل فني — مباشر من قاعدة البيانات
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white/60 hover:text-white transition-all disabled:opacity-40"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center h-48 gap-2 text-white/30">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">جارٍ التحميل...</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-red-400/70">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-semibold">تعذّر تحميل البيانات</p>
            <button
              onClick={() => void refetch()}
              className="text-xs px-3 py-1.5 rounded-lg font-bold"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {!isLoading && !isError && stats.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-white/25">
            <BarChart2 className="w-10 h-10" />
            <p className="text-sm font-semibold">لا توجد بيانات أداء حالياً</p>
            <p className="text-xs text-white/15">ستظهر البيانات بعد تعيين فنيين لبطاقات الصيانة</p>
          </div>
        )}

        {!isLoading && !isError && stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {stats.map((t) => {
              const rate = deliveryRate(t.total_jobs, t.delivered);
              const rateColor = rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171';

              return (
                <div
                  key={t.technician_id}
                  className="rounded-2xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.01]"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 4px 24px -8px rgba(0,0,0,0.4)',
                  }}
                >
                  {/* Name + active badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[15px] text-white"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                      >
                        {t.technician_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-white truncate">
                          {t.technician_name}
                        </p>
                        <p className="text-[10px] text-white/35 font-medium">فني صيانة</p>
                      </div>
                    </div>
                    {t.active_jobs > 0 && (
                      <span
                        className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums"
                        style={{
                          background: 'rgba(251,191,36,0.15)',
                          color: '#fcd34d',
                          border: '1px solid rgba(251,191,36,0.30)',
                        }}
                      >
                        {t.active_jobs} نشطة
                      </span>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <StatBadge label="مُسنَدة" value={t.total_jobs} color="#818cf8" />
                    <StatBadge label="مُسلَّمة" value={t.delivered} color="#34d399" />
                    <StatBadge
                      label="متوسط المدة"
                      value={t.avg_duration_days != null ? `${t.avg_duration_days}ي` : '—'}
                      color="#38bdf8"
                    />
                  </div>

                  {/* Delivery rate bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-white/35 font-semibold flex items-center gap-1">
                        <PackageCheck className="w-3 h-3" /> نسبة التسليم
                      </span>
                      <span
                        className="text-[11px] font-black tabular-nums"
                        style={{ color: rateColor }}
                      >
                        {rate}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.07)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${rate}%`,
                          background: rateColor,
                          boxShadow: `0 0 8px ${rateColor}66`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer hints */}
                  <div className="flex items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1">
                      <Wrench className="w-2.5 h-2.5" /> {t.total_jobs} إجمالي
                    </span>
                    {t.avg_duration_days != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {t.avg_duration_days} يوم متوسط
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
