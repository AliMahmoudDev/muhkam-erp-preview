import * as React from 'react';
import { cn } from '@/lib/utils';

export type MetricLayout = 'inline' | 'stacked';

export interface MetricProps {
  label: string;
  value: React.ReactNode;
  layout?: MetricLayout;
  className?: string;
}

export function Metric({
  label,
  value,
  layout = 'inline',
  className,
}: MetricProps) {
  return (
    <div
      className={cn(
        'erp-metric',
        layout === 'stacked' && 'erp-metric--stacked',
        className,
      )}
    >
      <span className="erp-metric-value">{value}</span>
      <span className="erp-metric-label">{label}</span>
    </div>
  );
}
