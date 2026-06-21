import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TableToolbarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  primaryAction?: React.ReactNode;
}

export function TableToolbar({
  primaryAction,
  className,
  children,
  ...props
}: TableToolbarProps) {
  return (
    <div className={cn('erp-table-toolbar', className)} {...props}>
      <div className="erp-table-toolbar-filters">{children}</div>
      {primaryAction && (
        <div className="erp-table-toolbar-primary">{primaryAction}</div>
      )}
    </div>
  );
}
