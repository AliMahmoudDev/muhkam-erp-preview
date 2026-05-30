import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';
import { api } from '@/lib/api';
import { Target, Trophy } from 'lucide-react';

interface TargetItem {
  user_id: number; user_name: string; role: string;
  target_amount: number; achieved_amount: number;
}

export function SalesTargetsWidget() {
  const ym = new Date().toISOString().slice(0, 7);
  const { data, isLoading } = useQuery<{ month: string; items: TargetItem[] }>({
    queryKey: ['/api/sales-targets', ym],
    queryFn: () => authFetch(api(`/api/sales-targets?month=${ym}`)).then(r => r.json()),
    staleTime: 60_000,
  });

  const active = (data?.items ?? []).filter(r => r.target_amount > 0);

  if (!isLoading && active.length === 0) return null;

  const monthLabel = new Date(ym + '-01').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  return (
    <div className="db-card mt-0">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="db-card-title">أهداف المبيعات</h3>
          <p className="db-card-sub">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)', color: '#f59e0b' }}>
          <Target style={{ width: 12, height: 12 }} />
          {active.length} مستخدم
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(row => {
            const pct = Math.min(100, (row.achieved_amount / row.target_amount) * 100);
            const color = pct >= 100 ? '#34d399' : pct >= 60 ? '#f59e0b' : '#f87171';
            const bgColor = pct >= 100 ? 'rgba(52,211,153,0.08)' : pct >= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(248,113,113,0.06)';
            return (
              <div key={row.user_id} className="p-3 rounded-xl space-y-2"
                style={{ background: bgColor, border: `1px solid ${color}22` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${color}20` }}>
                      <Trophy style={{ width: 14, height: 14, color }} />
                    </div>
                    <span className="text-white/80 text-sm font-semibold truncate">{row.user_name}</span>
                  </div>
                  <span className="text-xs font-black shrink-0" style={{ color }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--erp-bg-hover)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/35">
                    {row.achieved_amount.toLocaleString('ar-EG-u-nu-latn')} ج.م
                  </span>
                  <span className="text-white/25">
                    الهدف: {row.target_amount.toLocaleString('ar-EG-u-nu-latn')} ج.م
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
