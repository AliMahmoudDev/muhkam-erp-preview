/**
 * ReportPagePattern — read-only report page layout.
 *
 * Layout hierarchy:
 *   1. Header     — PageHeader (title, period label)
 *   2. Parameters — filter controls (date range, dimensions)
 *   3. Summary    — KPI / metric card row
 *   4. Export bar — export-to-PDF / Excel actions
 *   5. Body       — state-driven:
 *        idle    → chartSlot then tableSlot
 *        loading → loadingSlot
 *        empty   → emptySlot (no data for the chosen period)
 *        error   → errorSlot
 *
 * Read-only surface. No calculation logic. No data fetching.
 * All data arrives via slots.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type ReportPageState = 'idle' | 'loading' | 'empty' | 'error';

export interface ReportPagePatternProps {
  /**
   * PageHeader slot — report title, subtitle, period range label.
   * Required: every report page must be identified.
   */
  headerSlot: React.ReactNode;

  /**
   * Parameter slot — date-range pickers, dimension selectors, filters.
   * Renders in a filter-panel card above the summary row.
   * Optional.
   */
  parameterSlot?: React.ReactNode;

  /**
   * Summary KPI slot — 2–6 metric summary cards.
   * Renders above the chart and table.
   * Optional.
   */
  summarySlot?: React.ReactNode;

  /**
   * Export actions slot — PDF, Excel, print buttons.
   * Renders in a toolbar row above the chart.
   * Optional.
   */
  exportSlot?: React.ReactNode;

  /**
   * Primary chart slot — the main visualisation (bar, line, pie, etc.).
   * Full-width. Rendered first in the content area.
   * Optional: omit for table-only reports.
   */
  chartSlot?: React.ReactNode;

  /**
   * Table slot — the data table with rows/columns.
   * Rendered below the chart. Supports horizontal scroll on narrow screens.
   * Optional: omit for chart-only reports.
   */
  tableSlot?: React.ReactNode;

  /**
   * Loading slot — shown when state === 'loading'.
   * Pass a <LoadingPagePattern> preset or custom skeleton.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Empty slot — shown when state === 'empty'.
   * Use for "no data in selected period" feedback.
   */
  emptySlot?: React.ReactNode;

  /**
   * Error slot — shown when state === 'error'.
   */
  errorSlot?: React.ReactNode;

  /**
   * Current report state.
   * 'idle'    → chart + table (based on which slots are provided)
   * 'loading' → loadingSlot
   * 'empty'   → emptySlot
   * 'error'   → errorSlot
   */
  state?: ReportPageState;

  className?: string;
}

export function ReportPagePattern({
  headerSlot,
  parameterSlot,
  summarySlot,
  exportSlot,
  chartSlot,
  tableSlot,
  loadingSlot,
  emptySlot,
  errorSlot,
  state = 'idle',
  className,
}: ReportPagePatternProps) {
  const isLoading = state === 'loading';

  return (
    <div className={cn('erp-report-page', className)}>

      {/* 1. Header */}
      <div className="erp-report-page-header">
        {headerSlot}
      </div>

      {/* 2. Parameters filter panel */}
      {parameterSlot && (
        <div
          className="erp-report-page-params"
          role="region"
          aria-label="معاملات التقرير"
        >
          {parameterSlot}
        </div>
      )}

      {/* 3. Summary KPI row — always visible above content */}
      {summarySlot && (
        <div
          className="erp-report-page-summary"
          role="region"
          aria-label="ملخص التقرير"
        >
          {summarySlot}
        </div>
      )}

      {/* 4. Export toolbar */}
      {exportSlot && (
        <div
          className="erp-report-page-export"
          role="toolbar"
          aria-label="تصدير التقرير"
        >
          {exportSlot}
        </div>
      )}

      {/* 5. Content body — state-driven */}
      <div
        className="erp-report-page-body"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {/* Loading */}
        {isLoading && (
          <div
            className="erp-report-page-state"
            role="status"
            aria-label="جارٍ تحميل التقرير"
          >
            {loadingSlot ?? (
              <div
                className="erp-report-page-loading-placeholder"
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* Empty — no data for period */}
        {state === 'empty' && (
          <div className="erp-report-page-state">
            {emptySlot}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="erp-report-page-state" role="alert">
            {errorSlot}
          </div>
        )}

        {/* Idle — chart then table */}
        {state === 'idle' && (
          <>
            {chartSlot && (
              <div
                className="erp-report-page-chart"
                role="region"
                aria-label="الرسم البياني"
              >
                {chartSlot}
              </div>
            )}
            {tableSlot && (
              <div
                className="erp-report-page-table"
                role="region"
                aria-label="جدول البيانات"
              >
                {tableSlot}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
