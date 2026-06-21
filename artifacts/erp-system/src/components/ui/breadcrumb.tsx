import * as React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  /** Display label. */
  label: string;
  /**
   * If provided renders as a link; if omitted this item is treated as
   * the current page and rendered as plain text (not a link).
   */
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /**
   * Custom separator. Defaults to <ChevronLeft> which navigation-v3.css
   * flips for RTL.
   */
  separator?: React.ReactNode;
  className?: string;
  /** Accessible label for the <nav> landmark. */
  ariaLabel?: string;
}

/**
 * Breadcrumb — semantic trail of ancestor links.
 *
 * RTL rules:
 *  - DOM order: [Home, sep, Section, sep, Current].
 *  - In `dir="rtl"` context flex reverses visually to: Current sep Section sep Home.
 *  - The ChevronLeft separator is flipped via CSS when dir="rtl" so it
 *    always points toward the parent item.
 *  - The current (last) item is never a link (aria-current="page").
 */
export function Breadcrumb({
  items,
  separator,
  className,
  ariaLabel = 'مسار التنقل',
}: BreadcrumbProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('erp-breadcrumb', className)}>
      <ol className="erp-breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isCurrent = isLast || !item.href;

          return (
            <li key={index} className="erp-breadcrumb-item">
              {isCurrent ? (
                <span
                  className="erp-breadcrumb-current"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="erp-breadcrumb-link">
                  {item.label}
                </a>
              )}

              {!isLast && (
                <span
                  className="erp-breadcrumb-sep"
                  aria-hidden="true"
                >
                  {separator ?? <ChevronLeft />}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * BreadcrumbList / BreadcrumbLink / BreadcrumbPage / BreadcrumbSeparator
 * — headless primitives for consumers who prefer composing manually.
 */
function BreadcrumbList({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn('erp-breadcrumb-list', className)} {...props} />;
}
BreadcrumbList.displayName = 'BreadcrumbList';

function BreadcrumbListItem({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn('erp-breadcrumb-item', className)} {...props} />;
}
BreadcrumbListItem.displayName = 'BreadcrumbListItem';

function BreadcrumbLink({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={cn('erp-breadcrumb-link', className)} {...props} />;
}
BreadcrumbLink.displayName = 'BreadcrumbLink';

function BreadcrumbPage({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-current="page"
      className={cn('erp-breadcrumb-current', className)}
      {...props}
    />
  );
}
BreadcrumbPage.displayName = 'BreadcrumbPage';

function BreadcrumbSeparator({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn('erp-breadcrumb-sep', className)}
      {...props}
    >
      {children ?? <ChevronLeft />}
    </span>
  );
}
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

export {
  BreadcrumbList,
  BreadcrumbListItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
