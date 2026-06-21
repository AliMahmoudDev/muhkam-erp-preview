/**
 * EntityHeader — canonical heading area for all entity detail pages.
 *
 * Required by convention on every entity detail page.
 * Contains: name (h1), subtitle/id, status badge, metrics row, action row.
 * Max 3 visible actions by composition convention — enforced by the consumer.
 * No business logic or permission filtering inside.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EntityHeaderProps {
  /** Primary entity name — rendered as <h1>. */
  name: string;
  /** Supporting subtitle, document type, or entity category. */
  subtitle?: React.ReactNode;
  /**
   * Short identifier displayed next to the subtitle (e.g. "#1042", "INV-0032").
   * Displayed in monospace-adjacent style.
   */
  entityId?: React.ReactNode;
  /**
   * Status badge slot. Accepts any ReactNode — typically a <StatusBadge>.
   * Positioned inline with the name.
   */
  statusSlot?: React.ReactNode;
  /**
   * Metrics row slot. Accepts any ReactNode — typically 2–4 <KPICard secondary>.
   * Rendered below the name row.
   */
  metricsSlot?: React.ReactNode;
  /**
   * Actions slot. Max 3 visible actions by composition convention.
   * Consumer is responsible for overflow (a "more" menu for additional actions).
   */
  actionsSlot?: React.ReactNode;
  className?: string;
}

export function EntityHeader({
  name,
  subtitle,
  entityId,
  statusSlot,
  metricsSlot,
  actionsSlot,
  className,
}: EntityHeaderProps) {
  return (
    <header className={cn('erp-entity-header', className)}>
      {/* ── Top row: name + status + actions ── */}
      <div className="erp-entity-header-top">
        <div className="erp-entity-header-identity">
          {/* Subtitle / type + id */}
          {(subtitle || entityId) && (
            <div className="erp-entity-header-sub">
              {subtitle && (
                <span className="erp-entity-header-subtitle">{subtitle}</span>
              )}
              {entityId && (
                <span className="erp-entity-header-id">{entityId}</span>
              )}
            </div>
          )}

          {/* Name row: h1 + status */}
          <div className="erp-entity-header-name-row">
            <h1 className="erp-entity-header-name">{name}</h1>
            {statusSlot && (
              <div className="erp-entity-header-status" aria-label="الحالة">
                {statusSlot}
              </div>
            )}
          </div>
        </div>

        {/* Actions slot */}
        {actionsSlot && (
          <div
            className="erp-entity-header-actions"
            role="toolbar"
            aria-label="إجراءات"
          >
            {actionsSlot}
          </div>
        )}
      </div>

      {/* ── Metrics row ── */}
      {metricsSlot && (
        <div className="erp-entity-header-metrics">{metricsSlot}</div>
      )}
    </header>
  );
}
