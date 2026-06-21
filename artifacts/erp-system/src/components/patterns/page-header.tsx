/**
 * PageHeader — canonical heading area for list and form pages.
 *
 * Different from EntityHeader (which is for entity detail pages).
 * PageHeader is for top-of-page titles in list/report/form contexts.
 *
 * Convention: actionsSlot should contain at most 1 primary action button
 * and secondary actions. Overflow handled by caller (e.g. a "more" menu).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Main page title — rendered as <h1>. */
  title: string;
  /** Supporting subtitle or description. */
  subtitle?: string;
  /**
   * Eyebrow slot — breadcrumb trail, section label, or category chip.
   * Rendered above the title.
   */
  eyebrowSlot?: React.ReactNode;
  /**
   * Status slot — a status badge or indicator inline with the title.
   */
  statusSlot?: React.ReactNode;
  /**
   * Actions slot — primary + secondary actions.
   * Convention: max 1 primary action button.
   */
  actionsSlot?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrowSlot,
  statusSlot,
  actionsSlot,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('erp-page-header', className)}>
      {/* Eyebrow / breadcrumb */}
      {eyebrowSlot && (
        <div className="erp-page-header-eyebrow">{eyebrowSlot}</div>
      )}

      {/* Title row + actions */}
      <div className="erp-page-header-row">
        <div className="erp-page-header-identity">
          <div className="erp-page-header-title-row">
            <h1 className="erp-page-header-title">{title}</h1>
            {statusSlot && (
              <div className="erp-page-header-status">{statusSlot}</div>
            )}
          </div>
          {subtitle && (
            <p className="erp-page-header-subtitle">{subtitle}</p>
          )}
        </div>

        {actionsSlot && (
          <div
            className="erp-page-header-actions"
            role="toolbar"
            aria-label="إجراءات الصفحة"
          >
            {actionsSlot}
          </div>
        )}
      </div>
    </div>
  );
}
