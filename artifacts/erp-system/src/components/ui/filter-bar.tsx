import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  wrap?: boolean;
}

export function FilterBar({
  wrap = true,
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label="خيارات التصفية"
      className={cn(
        'erp-filter-bar',
        wrap && 'erp-filter-bar--wrap',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
