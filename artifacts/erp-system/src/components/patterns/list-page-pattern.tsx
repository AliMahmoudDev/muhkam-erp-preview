/**
 * ListPagePattern — standard list / table page layout.
 *
 * Layout hierarchy:
 *   1. Header  — PageHeader (title, actions)
 *   2. Toolbar — PageToolbar (search, filters, bulk actions)
 *   3. KPI     — optional summary metric row
 *   4. Body    — switches by state:
 *        idle    → table + pagination
 *        loading → loadingSlot (or built-in aria-busy placeholder)
 *        empty   → emptySlot
 *        error   → errorSlot
 *
 * No data fetching. No business logic. No permissions.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ListPageState = 'idle' | 'loading' | 'empty' | 'error';

export interface ListPagePatternProps {
  /**
   * PageHeader slot — title, subtitle, primary action button.
   * Required: every list page must have a heading.
   */
  headerSlot: React.ReactNode;

  /**
   * PageToolbar slot — search input, filter chips, bulk-action bar.
   * Optional: omit for simple lists with no filtering.
   */
  toolbarSlot?: React.ReactNode;

  /**
   * Summary KPI / metric row slot — 2–4 small stat chips above the table.
   * Optional: use for high-value lists (sales, repairs, invoices).
   */
  kpiSlot?: React.ReactNode;

  /**
   * Table or grid slot — the main data surface.
   * Rendered only when state === 'idle'.
   * Optional so the pattern can be used without passing a table
   * while in loading / empty / error states.
   */
  tableSlot?: React.ReactNode;

  /**
   * Pagination slot — page controls rendered below the table.
   * Rendered only when state === 'idle'.
   */
  paginationSlot?: React.ReactNode;

  /**
   * Loading slot — shown when state === 'loading'.
   * Pass a <SkeletonTable> or <LoadingPagePattern> preset.
   * When omitted, an accessible aria-busy region is shown.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Empty state slot — shown when state === 'empty'.
   * Pass an <EmptyState> component.
   */
  emptySlot?: React.ReactNode;

  /**
   * Error slot — shown when state === 'error'.
   * Pass an <ErrorState> or <ErrorPagePattern> variant.
   */
  errorSlot?: React.ReactNode;

  /**
   * Current page state.
   * 'idle'    → table + pagination
   * 'loading' → loadingSlot (aria-busy)
   * 'empty'   → emptySlot
   * 'error'   → errorSlot
   */
  state?: ListPageState;

  className?: string;
}

export function ListPagePattern({
  headerSlot,
  toolbarSlot,
  kpiSlot,
  tableSlot,
  paginationSlot,
  loadingSlot,
  emptySlot,
  errorSlot,
  state = 'idle',
  className,
}: ListPagePatternProps) {
  const isLoading = state === 'loading';

  return (
    <div className={cn('erp-list-page', className)}>

      {/* 1. Header */}
      <div className="erp-list-page-header">
        {headerSlot}
      </div>

      {/* 2. Toolbar */}
      {toolbarSlot && (
        <div className="erp-list-page-toolbar" role="toolbar" aria-label="أدوات القائمة">
          {toolbarSlot}
        </div>
      )}

      {/* 3. KPI summary row */}
      {kpiSlot && (
        <div
          className="erp-list-page-kpi"
          role="region"
          aria-label="ملخص الأرقام"
        >
          {kpiSlot}
        </div>
      )}

      {/* 4. Content body — state-driven */}
      <div
        className={cn(
          'erp-list-page-body',
          isLoading && 'erp-list-page-body--loading',
        )}
        aria-live="polite"
        aria-busy={isLoading}
      >
        {/* Loading */}
        {isLoading && (
          <div
            className="erp-list-page-state"
            role="status"
            aria-label="جارٍ تحميل البيانات"
          >
            {loadingSlot ?? (
              <div
                className="erp-list-page-loading-placeholder"
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="erp-list-page-state" role="alert">
            {errorSlot}
          </div>
        )}

        {/* Empty */}
        {state === 'empty' && (
          <div className="erp-list-page-state">
            {emptySlot}
          </div>
        )}

        {/* Idle — table + pagination */}
        {state === 'idle' && (
          <>
            <div className="erp-list-page-table">
              {tableSlot}
            </div>
            {paginationSlot && (
              <div className="erp-list-page-pagination">
                {paginationSlot}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
