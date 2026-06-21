import * as React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

export interface ChartContainerProps {
  title?: React.ReactNode;
  legend?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  children: React.ReactNode;
}

export function ChartContainer({
  title,
  legend,
  loading = false,
  empty = false,
  emptyMessage = 'لا توجد بيانات للعرض',
  className,
  children,
}: ChartContainerProps) {
  return (
    <div className={cn('erp-chart-container', className)}>
      {(title !== undefined || legend !== undefined) && (
        <div className="erp-chart-header">
          {title  && <h3 className="erp-chart-title">{title}</h3>}
          {legend && <div className="erp-chart-legend">{legend}</div>}
        </div>
      )}

      <div className="erp-chart-body">
        {loading ? (
          <div className="erp-chart-state" aria-busy="true">
            <Spinner size="md" />
          </div>
        ) : empty ? (
          <div className="erp-chart-state">
            <p className="erp-chart-empty-msg">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
