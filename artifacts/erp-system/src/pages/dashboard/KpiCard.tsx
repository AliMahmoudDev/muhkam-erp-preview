import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export interface KpiDef {
  label: string;
  value: number;
  icon: LucideIcon;
  badge: { up: boolean; label: string };
  rawValue?: boolean;
  /* legacy fields — accepted but unused visually */
  gradient?: string;
  glow?: string;
  iconBg?: string;
  iconClr?: string;
}

export function KpiCard({ card, index }: { card: KpiDef; index: number }) {
  const Icon = card.icon;
  return (
    <div
      className="erp-kpi"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Header: label + icon */}
      <div className="erp-kpi-header">
        <p className="erp-kpi-label">{card.label}</p>
        <div className="erp-kpi-icon">
          <Icon />
        </div>
      </div>

      {/* Value */}
      <p className="erp-kpi-value">
        {card.rawValue ? String(card.value) : formatCurrency(card.value)}
      </p>

      {/* Trend badge */}
      <div className={`erp-kpi-trend ${card.badge.up ? 'erp-kpi-trend--up' : 'erp-kpi-trend--down'}`}>
        {card.badge.up
          ? <ArrowUpRight />
          : <ArrowDownRight />
        }
        <span>{card.badge.label}</span>
      </div>
    </div>
  );
}
