/**
 * ListPagePattern — standard list/table page layout.
 *
 * Composes: PageHeader, PageToolbar, optional KPI row, table, pagination.
 * Switches between content/empty/loading/error states via `state` prop.
 * No data fetching, no permissions.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ListPageState = 'idle' | 'loading' | 'empty' | 'error';

export interface ListPagePatternProps {
  /** PageHeader slot. */
  headerSlot: React.ReactNode;
  /** PageToolbar slot. Optional. */
  toolbarSlot?: React.ReactNode;
  /** Summary KPI / metric row slot. Optional. */
  kpiSlot?: React.ReactNode;
  /** Table or grid slot — shown when state === 'idle'. */
  tableSlot: React.ReactNode;
  /** Pagination slot — shown when state === 'idle'. */
  paginationSlot?: React.ReactNode;
  /** EmptyState slot — shown when state === 'empty'. */
  emptySlot?: React.ReactNode;
  /** Skeleton / loading slot — shown when state === 'loading'. */
  loadingSlot?: React.ReactNode;
  /** ErrorState slot — shown when state === 'error'. */
  errorSlot?: React.ReactNode;
  /**
   * Current page state.
   * 'idle'    — show table + pagination
   * 'loading' — show loadingSlot
   * 'empty'   — show emptySlot
   * 'error'   — show errorSlot
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
  emptySlot,
  loadingSlot,
  errorSlot,
  state = 'idle',
  className,
}: ListPagePatternProps) {
  return (
    <div className={cn('erp-list-page', className)}>
      {/* Header */}
      <div className="erp-list-page-header">{headerSlot}</div>

      {/* Toolbar */}
      {toolbarSlot && (
        <div className="erp-list-page-toolbar">{toolbarSlot}</div>
      )}

      {/* KPI row */}
      {kpiSlot && (
        <div className="erp-list-page-kpi">{kpiSlot}</div>
      )}

      {/* Content area — switches by state */}
      <div className="erp-list-page-body">
        {state === 'loading' && (
          <div className="erp-list-page-state">
            {loadingSlot ?? (
              <div className="erp-list-page-state-placeholder" aria-busy="true" aria-label="جارٍ التحميل" />
            )}
          </div>
        )}

        {state === 'error' && (
          <div className="erp-list-page-state">
            {errorSlot}
          </div>
        )}

        {state === 'empty' && (
          <div className="erp-list-page-state">
            {emptySlot}
          </div>
        )}

        {state === 'idle' && (
          <>
            <div className="erp-list-page-table">{tableSlot}</div>
            {paginationSlot && (
              <div className="erp-list-page-pagination">{paginationSlot}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
