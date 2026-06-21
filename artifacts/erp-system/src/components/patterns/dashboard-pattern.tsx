/**
 * DashboardPattern — home/dashboard page layout.
 *
 * Composes: greeting/header, KPI row, alerts, charts, table/activity,
 * secondary content.
 * No data fetching. All content arrives via slots.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DashboardPatternProps {
  /**
   * Greeting / header slot — welcome message, date, user name.
   * Rendered at the top of the dashboard.
   */
  headerSlot?: React.ReactNode;
  /**
   * KPI row slot — 3–6 metric cards in a responsive grid.
   */
  kpiSlot?: React.ReactNode;
  /**
   * Alerts slot — smart alert banners (low stock, overdue, etc.).
   */
  alertsSlot?: React.ReactNode;
  /**
   * Charts slot — chart cards in a responsive grid.
   */
  chartsSlot?: React.ReactNode;
  /**
   * Table slot — a data table (recent sales, repairs, etc.).
   */
  tableSlot?: React.ReactNode;
  /**
   * Activity slot — ActivityFeed or Timeline widget.
   */
  activitySlot?: React.ReactNode;
  /**
   * Secondary content slot — additional widgets, quick actions, etc.
   */
  secondarySlot?: React.ReactNode;
  className?: string;
}

export function DashboardPattern({
  headerSlot,
  kpiSlot,
  alertsSlot,
  chartsSlot,
  tableSlot,
  activitySlot,
  secondarySlot,
  className,
}: DashboardPatternProps) {
  const hasMainRow = !!(tableSlot || activitySlot);

  return (
    <div className={cn('erp-dashboard', className)}>
      {/* Greeting / header */}
      {headerSlot && (
        <div className="erp-dashboard-header">{headerSlot}</div>
      )}

      {/* Alerts row */}
      {alertsSlot && (
        <div
          className="erp-dashboard-alerts"
          role="region"
          aria-label="التنبيهات"
        >
          {alertsSlot}
        </div>
      )}

      {/* KPI row */}
      {kpiSlot && (
        <div
          className="erp-dashboard-kpi"
          role="region"
          aria-label="المؤشرات الرئيسية"
        >
          {kpiSlot}
        </div>
      )}

      {/* Charts grid */}
      {chartsSlot && (
        <div
          className="erp-dashboard-charts"
          role="region"
          aria-label="التحليلات"
        >
          {chartsSlot}
        </div>
      )}

      {/* Main row: table + activity */}
      {hasMainRow && (
        <div
          className={cn(
            'erp-dashboard-main',
            activitySlot && 'erp-dashboard-main--with-aside',
          )}
        >
          {tableSlot && (
            <div className="erp-dashboard-table">{tableSlot}</div>
          )}
          {activitySlot && (
            <aside
              className="erp-dashboard-activity"
              aria-label="النشاط الأخير"
            >
              {activitySlot}
            </aside>
          )}
        </div>
      )}

      {/* Secondary content */}
      {secondarySlot && (
        <div className="erp-dashboard-secondary">{secondarySlot}</div>
      )}
    </div>
  );
}
