import * as React from 'react';
import { cn } from '@/lib/utils';

export type PanelVariant = 'default' | 'sidebar' | 'topbar' | 'settings' | 'neutral';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ variant = 'default', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'erp-panel',
        variant !== 'default' && `erp-panel--${variant}`,
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = 'Panel';

export { Panel };
