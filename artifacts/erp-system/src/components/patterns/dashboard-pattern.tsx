/**
 * DashboardPattern — home/dashboard page layout.
 *
 * Answers the question "Is everything under control?" through a deliberate
 * visual hierarchy:
 *   1. Header         — who/when
 *   2. Status strip   — green/amber/red health signal (statusSlot)
 *   3. Alert strip    — actionable issues (alertsSlot)
 *   4. KPI row        — the key numbers (kpiSlot)
 *   5. Primary chart  — the main trend / story (primaryChartSlot)
 *   6. Secondary grid — breakdown charts (secondaryChartsSlot)
 *   7. Main row       — recent table + activity aside (tableSlot + activitySlot)
 *   8. Secondary      — additional widgets / quick actions (secondarySlot)
 *
 * No data fetching. No business logic. All content arrives via slots.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DashboardPatternProps {
  /**
   * Header slot — page heading, greeting, date, user name.
   * Rendered at the very top of the dashboard.
   */
  headerSlot?: React.ReactNode;

  /**
   * Status strip slot — compact health-signal row
   * (e.g. "كل شيء على ما يرام" / warning / critical banner).
   * Answers "Is everything under control?" immediately below the header.
   */
  statusSlot?: React.ReactNode;

  /**
   * Alerts slot — smart alert banners (low stock, overdue debts, etc.).
   * Rendered as a stacked column; each child is one alert.
   */
  alertsSlot?: React.ReactNode;

  /**
   * KPI row slot — 3–6 metric cards in a responsive grid.
   */
  kpiSlot?: React.ReactNode;

  /**
   * Primary chart slot — the hero/main trend chart.
   * Renders full-width to command visual focus.
   */
  primaryChartSlot?: React.ReactNode;

  /**
   * Secondary charts slot — supplementary breakdown charts
   * rendered in a responsive 2-column grid.
   */
  secondaryChartsSlot?: React.ReactNode;

  /**
   * Table slot — a data table (recent sales, repairs, invoices, etc.).
   * Placed in the main row alongside the optional activity aside.
   */
  tableSlot?: React.ReactNode;

  /**
   * Activity slot — ActivityFeed or Timeline widget.
   * When provided, renders as a fixed-width aside next to the table.
   */
  activitySlot?: React.ReactNode;

  /**
   * Secondary content slot — additional widgets, quick-action cards,
   * or any lower-priority content.
   */
  secondarySlot?: React.ReactNode;

  className?: string;
}

export function DashboardPattern({
  headerSlot,
  statusSlot,
  alertsSlot,
  kpiSlot,
  primaryChartSlot,
  secondaryChartsSlot,
  tableSlot,
  activitySlot,
  secondarySlot,
  className,
}: DashboardPatternProps) {
  const hasMainRow = !!(tableSlot || activitySlot);

  return (
    <div className={cn('erp-dashboard', className)}>

      {/* 1. Page header */}
      {headerSlot && (
        <div className="erp-dashboard-header" role="banner">
          {headerSlot}
        </div>
      )}

      {/* 2. Status strip — health signal */}
      {statusSlot && (
        <div
          className="erp-dashboard-status"
          role="status"
          aria-live="polite"
          aria-label="حالة النظام"
        >
          {statusSlot}
        </div>
      )}

      {/* 3. Alert strip — actionable issues */}
      {alertsSlot && (
        <div
          className="erp-dashboard-alerts"
          role="region"
          aria-label="التنبيهات"
        >
          {alertsSlot}
        </div>
      )}

      {/* 4. KPI row */}
      {kpiSlot && (
        <div
          className="erp-dashboard-kpi"
          role="region"
          aria-label="المؤشرات الرئيسية"
        >
          {kpiSlot}
        </div>
      )}

      {/* 5. Primary chart — hero trend */}
      {primaryChartSlot && (
        <div
          className="erp-dashboard-primary-chart"
          role="region"
          aria-label="الرسم البياني الرئيسي"
        >
          {primaryChartSlot}
        </div>
      )}

      {/* 6. Secondary charts grid */}
      {secondaryChartsSlot && (
        <div
          className="erp-dashboard-secondary-charts"
          role="region"
          aria-label="الرسوم البيانية التفصيلية"
        >
          {secondaryChartsSlot}
        </div>
      )}

      {/* 7. Main row — table + activity aside */}
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

      {/* 8. Secondary content */}
      {secondarySlot && (
        <div
          className="erp-dashboard-secondary"
          role="region"
          aria-label="المحتوى الإضافي"
        >
          {secondarySlot}
        </div>
      )}

    </div>
  );
}
