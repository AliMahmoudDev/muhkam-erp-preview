import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * MobileNavigation — fixed bottom tab bar.
 *
 * Purely presentational; no API calls, no permission filtering.
 * Uses <a> elements so any router can intercept clicks.
 * Respects iOS/Android safe-area via CSS env(safe-area-inset-bottom).
 *
 * Rules:
 *  - Max 5 items (spec). Items beyond 5 are silently dropped.
 *  - The optional `moreSlot` provides a customiser entry point.
 *  - Active item: accent colour + background + aria-current="page".
 */

export interface MobileNavItem {
  id: string;
  label: string;
  /** Lucide icon or any React element type. */
  icon: React.ElementType;
  href: string;
}

export interface MobileNavigationProps {
  items: MobileNavItem[];
  /** ID of the currently active item. */
  activeId?: string;
  /** Slot for a "More" / customiser button after the regular tabs. */
  moreSlot?: React.ReactNode;
  className?: string;
}

export function MobileNavigation({
  items,
  activeId,
  moreSlot,
  className,
}: MobileNavigationProps) {
  const visibleItems = items.slice(0, 5);

  return (
    <nav
      role="navigation"
      aria-label="قائمة التنقل الرئيسية"
      className={cn('erp-mobile-nav', className)}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;

        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'erp-mobile-nav-item',
              isActive && 'erp-mobile-nav-item--active',
            )}
          >
            <span className="erp-mobile-nav-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="erp-mobile-nav-label">{item.label}</span>
          </a>
        );
      })}

      {moreSlot && (
        <div className="erp-mobile-nav-more">{moreSlot}</div>
      )}
    </nav>
  );
}
