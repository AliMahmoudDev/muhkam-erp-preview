import * as React from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  icon,
  className,
  children,
}: StatCardProps) {
  return (
    <div className={cn('erp-stat-card', className)}>
      {icon && (
        <div className="erp-stat-card-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="erp-stat-card-body">
        <p className="erp-stat-card-label">{label}</p>
        <p className="erp-stat-card-value">{value}</p>
        {children}
      </div>
    </div>
  );
}
