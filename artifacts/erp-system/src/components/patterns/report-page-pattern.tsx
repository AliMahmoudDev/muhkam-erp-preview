/**
 * ReportPagePattern — read-only report page layout.
 *
 * Composes: PageHeader, parameter controls, summary KPIs,
 * chart/table content, export actions.
 * No calculation logic. All data arrives via slots.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ReportPagePatternProps {
  /** PageHeader slot. */
  headerSlot: React.ReactNode;
  /**
   * Parameter slot — date range pickers, dimension dropdowns, etc.
   * Renders in a collapsible filter panel area.
   */
  parameterSlot?: React.ReactNode;
  /**
   * Summary KPI slot — metric cards shown above the main content.
   */
  summarySlot?: React.ReactNode;
  /**
   * Main content slot — charts, tables, or pivot grids.
   */
  contentSlot: React.ReactNode;
  /**
   * Export action slot — export to PDF/Excel buttons.
   * Rendered in a toolbar row above contentSlot.
   */
  exportSlot?: React.ReactNode;
  className?: string;
}

export function ReportPagePattern({
  headerSlot,
  parameterSlot,
  summarySlot,
  contentSlot,
  exportSlot,
  className,
}: ReportPagePatternProps) {
  return (
    <div className={cn('erp-report-page', className)}>
      {/* Header */}
      <div className="erp-report-page-header">{headerSlot}</div>

      {/* Parameters panel */}
      {parameterSlot && (
        <div className="erp-report-page-params" aria-label="معاملات التقرير">
          {parameterSlot}
        </div>
      )}

      {/* Summary KPIs */}
      {summarySlot && (
        <div className="erp-report-page-summary">{summarySlot}</div>
      )}

      {/* Export toolbar */}
      {exportSlot && (
        <div
          className="erp-report-page-export"
          role="toolbar"
          aria-label="تصدير التقرير"
        >
          {exportSlot}
        </div>
      )}

      {/* Main content */}
      <div className="erp-report-page-content">{contentSlot}</div>
    </div>
  );
}
