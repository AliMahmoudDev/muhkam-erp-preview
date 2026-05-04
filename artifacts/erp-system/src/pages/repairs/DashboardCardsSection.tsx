import { useState } from 'react';
import { Clock, Wrench, History, AlertCircle, ChevronDown, Bell } from 'lucide-react';
import {
  CARD_ICON_REGISTRY, STATUS_MAP, relativeTimeAr,
} from './repairConstants';
import type { DashboardCard, DashboardData } from './repairConstants';

interface DashboardCardsSectionProps {
  dashboard: DashboardData | undefined;
  activeStatusFilter: string;
  onCardClick: (card: DashboardCard) => void;
  onStatusClick: (status: string) => void;
}

export default function DashboardCardsSection({
  dashboard, activeStatusFilter, onCardClick, onStatusClick,
}: DashboardCardsSectionProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!dashboard) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] h-24 flex items-center justify-center text-white/30 text-xs">
        جارٍ تحميل لوحة الصيانة...
      </div>
    );
  }

  const cards = dashboard.cards ?? [];
  const totalAll = dashboard.total_all || 0;

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center text-white/40 text-xs">
        لم يتم إعداد أي كارت بعد. افتح الإعدادات ← كروت اللوحة لإضافة كارت.
      </div>
    );
  }

  const barSegments = cards.map(c => ({
    id: c.id,
    color: c.color,
    pct: totalAll > 0 ? Math.max((c.count / totalAll) * 100, 6) : 100 / cards.length,
  }));

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/35 font-bold tracking-widest uppercase">توزيع المهام</span>
          <span className="text-[10px] text-white/45 font-mono">{totalAll} إجمالي</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-white/5 flex" dir="ltr">
          {barSegments.map((seg, i) => (
            <div key={seg.id}
              className="h-full transition-all duration-500"
              style={{
                width: `${seg.pct}%`,
                background: seg.color,
                marginInlineStart: i === 0 ? 0 : 1,
                opacity: totalAll === 0 ? 0.25 : 0.85,
              }}
              title={cards[i]?.name} />
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {cards.map(card => {
          const Icon = CARD_ICON_REGISTRY[card.icon] ?? Wrench;
          const pct = totalAll > 0 ? (card.count / totalAll) * 100 : 0;
          const isActive = activeStatusFilter === card.statuses.join(',');
          const isExpanded = expandedId === card.id;
          const isAlerting = card.alert_threshold != null && card.count >= card.alert_threshold;
          const grow = Math.max(card.count, 1);

          return (
            <button
              key={card.id}
              onClick={() => {
                setExpandedId(prev => (prev === card.id ? null : card.id));
                onCardClick(card);
              }}
              className={`group relative rounded-2xl border bg-gradient-to-br to-transparent p-3 flex flex-col gap-1 text-right transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                isActive ? 'ring-2 ring-offset-2 ring-offset-black/40' : ''
              } ${isAlerting ? 'animate-pulse-slow' : ''}`}
              style={{
                flex: `${grow} 1 120px`,
                minWidth: 120,
                background: `linear-gradient(135deg, ${card.color}1F, transparent)`,
                borderColor: isActive ? card.color : `${card.color}33`,
                ...(isActive ? { boxShadow: `0 0 0 2px ${card.color}66` } : {}),
              } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="w-4 h-4 shrink-0" style={{ color: card.color }} />
                {isAlerting && <Bell className="w-3 h-3 text-amber-400 animate-pulse" />}
                <span className="text-[9px] font-bold uppercase tracking-widest truncate flex-1"
                  style={{ color: `${card.color}cc` }}>
                  {card.name}
                </span>
              </div>
              <div className="text-3xl font-black leading-none tracking-tight" style={{ color: card.color }}>
                {card.count}
              </div>
              <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: `${card.color}26` }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: card.color }} />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/45 mt-0.5 min-h-[14px]">
                {card.last_update ? (
                  <>
                    <Clock className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {card.last_update.job_no} · {relativeTimeAr(card.last_update.at)}
                    </span>
                  </>
                ) : (
                  <span className="text-white/25">لا تحديثات</span>
                )}
                <ChevronDown className={`w-3 h-3 mr-auto shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  style={{ color: `${card.color}aa` }} />
              </div>
            </button>
          );
        })}
      </div>

      {expandedId != null && (() => {
        const card = cards.find(c => c.id === expandedId);
        if (!card) return null;
        const Icon = CARD_ICON_REGISTRY[card.icon] ?? Wrench;
        return (
          <div className="rounded-2xl border p-3 transition-all"
            style={{
              background: `linear-gradient(135deg, ${card.color}14, transparent)`,
              borderColor: `${card.color}40`,
            }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
              <span className="text-[12px] font-bold" style={{ color: card.color }}>
                {card.name} — تفصيل
              </span>
              <span className="text-[10px] text-white/45 font-mono">({card.count})</span>
              <button onClick={() => setExpandedId(null)}
                className="mr-auto text-white/30 hover:text-white/70 text-[11px] font-bold">
                إخفاء
              </button>
            </div>
            {card.breakdown.length === 0 ? (
              <div className="text-white/35 text-[11px] py-2">لا توجد مهام في هذه الحالات</div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {card.breakdown.map(b => {
                  const meta = STATUS_MAP[b.key] ?? { label: b.key, color: 'text-white/60', bg: 'bg-white/5 border-white/10', icon: AlertCircle };
                  return (
                    <button key={b.key} onClick={() => onStatusClick(b.key)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:scale-[1.03] ${meta.bg} ${meta.color} ${
                        activeStatusFilter === b.key ? 'ring-1 ring-white/40' : ''
                      }`}>
                      {meta.label}
                      <span className="text-[10px] opacity-70 font-mono">{b.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {card.last_update && (
              <div className="flex items-center gap-2 text-[11px] text-white/55 pt-2 border-t border-white/8">
                <History className="w-3 h-3 shrink-0" style={{ color: card.color }} />
                <span className="font-mono text-white/70">{card.last_update.job_no}</span>
                <span className="text-white/30">·</span>
                <span className="truncate">{card.last_update.customer_name}</span>
                {card.last_update.status_to && (
                  <>
                    <span className="text-white/30">←</span>
                    <span className="text-white/70">
                      {STATUS_MAP[card.last_update.status_to]?.label ?? card.last_update.status_to}
                    </span>
                  </>
                )}
                <span className="mr-auto text-white/35">{relativeTimeAr(card.last_update.at)}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
