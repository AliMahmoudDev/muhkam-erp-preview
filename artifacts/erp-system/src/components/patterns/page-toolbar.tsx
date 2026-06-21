/**
 * PageToolbar — filter/search/action toolbar for list pages.
 *
 * Three slots: search, filters, actions.
 * Wraps cleanly to a second row on narrow viewports.
 * No business logic — pure layout composition.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageToolbarProps {
  /** Search input slot (e.g. <SearchInput>). */
  searchSlot?: React.ReactNode;
  /** Filter controls slot (e.g. <FilterBar>, dropdowns, date range). */
  filtersSlot?: React.ReactNode;
  /** Action buttons slot (e.g. export, import, toggle view). */
  actionsSlot?: React.ReactNode;
  className?: string;
}

export function PageToolbar({
  searchSlot,
  filtersSlot,
  actionsSlot,
  className,
}: PageToolbarProps) {
  const hasLeft  = !!(searchSlot || filtersSlot);
  const hasRight = !!actionsSlot;

  return (
    <div
      className={cn('erp-page-toolbar', className)}
      role="toolbar"
      aria-label="أدوات الصفحة"
    >
      {hasLeft && (
        <div className="erp-page-toolbar-start">
          {searchSlot && (
            <div className="erp-page-toolbar-search">{searchSlot}</div>
          )}
          {filtersSlot && (
            <div className="erp-page-toolbar-filters">{filtersSlot}</div>
          )}
        </div>
      )}

      {hasRight && (
        <div className="erp-page-toolbar-end">{actionsSlot}</div>
      )}
    </div>
  );
}
