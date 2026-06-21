import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KPITrendDirection = 'up-good' | 'up-bad';
export type KPISize = 'primary' | 'secondary';

export interface KPICardProps {
  label: string;
  value: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  comparisonLabel?: string;
  icon?: React.ReactNode;
  trendDirection?: KPITrendDirection;
  size?: KPISize;
  className?: string;
}

export function KPICard({
  label,
  value,
  delta,
  deltaLabel,
  comparisonLabel,
  icon,
  trendDirection = 'up-good',
  size = 'primary',
  className,
}: KPICardProps) {
  const hasDelta = delta !== undefined;
  const isPositive = hasDelta && delta > 0;
  const isNegative = hasDelta && delta < 0;

  const trendGood =
    (trendDirection === 'up-good' && isPositive) ||
    (trendDirection === 'up-bad'  && isNegative);
  const trendBad =
    (trendDirection === 'up-good' && isNegative) ||
    (trendDirection === 'up-bad'  && isPositive);

  return (
    <div
      className={cn(
        'erp-kpi-card',
        size === 'secondary' && 'erp-kpi-card--secondary',
        className,
      )}
    >
      {icon && (
        <div className="erp-kpi-icon" aria-hidden="true">
          {icon}
        </div>
      )}

      <div className="erp-kpi-body">
        <p className="erp-kpi-label">{label}</p>
        <p className="erp-kpi-value">{value}</p>

        {hasDelta && (
          <div
            className={cn(
              'erp-kpi-delta',
              trendGood && 'erp-kpi-delta--positive',
              trendBad  && 'erp-kpi-delta--negative',
            )}
          >
            {isPositive && <TrendingUp  aria-hidden="true" />}
            {isNegative && <TrendingDown aria-hidden="true" />}
            <span>
              {isPositive && '+'}
              {delta.toFixed(1)}%
              {deltaLabel && ` ${deltaLabel}`}
            </span>
          </div>
        )}

        {comparisonLabel && (
          <p className="erp-kpi-period">{comparisonLabel}</p>
        )}
      </div>
    </div>
  );
}
