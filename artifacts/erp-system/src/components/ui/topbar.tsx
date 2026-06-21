import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Topbar — page chrome shell.
 *
 * RTL-first: `start` slot = logical start = physical RIGHT in RTL.
 * Renders at `var(--topbar-height)` and uses only height tokens.
 * Contains no business logic or permission checks.
 *
 * Slots:
 *   `start`   — logo / hamburger / collapse toggle
 *   `center`  — search or page title
 *   `end`     — action icons, notifications, avatar
 */
export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Logical start: logo / nav toggle (right side in RTL). */
  start?: React.ReactNode;
  /** Centre content: search, page title, etc. */
  center?: React.ReactNode;
  /** Logical end: action icons, user menu (left side in RTL). */
  end?: React.ReactNode;
}

const Topbar = React.forwardRef<HTMLElement, TopbarProps>(
  ({ start, center, end, className, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn('erp-topbar', className)}
      {...props}
    >
      {start && (
        <div className="erp-topbar-start">{start}</div>
      )}

      <div className="erp-topbar-center">
        {center ?? children}
      </div>

      {end && (
        <div className="erp-topbar-end">{end}</div>
      )}
    </header>
  ),
);
Topbar.displayName = 'Topbar';

/**
 * TopbarSearch — styled search slot for the Topbar.
 * Renders as a visual button/input wrapper.
 * Wire your own search logic inside.
 */
export interface TopbarSearchProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string;
  kbd?: string;
}

function TopbarSearch({
  placeholder = 'بحث...',
  kbd,
  className,
  children,
  ...props
}: TopbarSearchProps) {
  return (
    <div className={cn('erp-topbar-search', className)} {...props}>
      {children ?? (
        <>
          <span className="erp-topbar-search-placeholder">{placeholder}</span>
          {kbd && (
            <kbd className="erp-search-kbd" aria-label={`اختصار ${kbd}`}>
              {kbd}
            </kbd>
          )}
        </>
      )}
    </div>
  );
}
TopbarSearch.displayName = 'TopbarSearch';

export { Topbar, TopbarSearch };
