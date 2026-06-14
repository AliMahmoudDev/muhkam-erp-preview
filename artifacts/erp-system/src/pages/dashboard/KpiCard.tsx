import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export interface KpiDef {
  label: string;
  value: number;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  iconBg: string;
  iconClr: string;
  badge: { up: boolean; label: string };
  rawValue?: boolean;
}

export function KpiCard({ card, index }: { card: KpiDef; index: number }) {
  const Icon = card.icon;
  return (
    <div
      className="db-kpi-card db-kpi-hover"
      style={{
        background: card.gradient,
        boxShadow: `0 10px 40px rgba(0,0,0,0.34), 0 0 0 1px var(--edge-md), inset 0 1px 0 var(--edge-md)`,
        animationDelay: `${index * 0.08}s`,
      }}
    >
      <div className="db-kpi-shimmer" />
      <div className="db-kpi-glow" style={{ background: card.glow }} />
      <div className="db-kpi-dots" />
      <div className="db-kpi-content">
        <div className="db-kpi-header">
          <p className="db-kpi-label">{card.label}</p>
          <div className="db-kpi-icon" style={{ background: card.iconBg }}>
            <Icon style={{ width: 21, height: 21, color: card.iconClr }} />
          </div>
        </div>
        <p className="db-kpi-value">
          {card.rawValue ? String(card.value) : formatCurrency(card.value)}
        </p>
        <div
          className="inline-flex items-center gap-1"
          style={{
            padding: '4px 10px',
            borderRadius: '20px',
            background: card.badge.up ? 'rgba(52,211,153,0.20)' : 'rgba(248,113,113,0.20)',
            border: `1px solid ${card.badge.up ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)'}`,
            fontSize: '11px',
            fontWeight: 700,
            color: card.badge.up ? 'var(--status-success)' : 'var(--status-danger)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {card.badge.up ? (
            <ArrowUpRight style={{ width: 12, height: 12 }} />
          ) : (
            <ArrowDownRight style={{ width: 12, height: 12 }} />
          )}
          <span>{card.badge.label}</span>
        </div>
      </div>
    </div>
  );
}
