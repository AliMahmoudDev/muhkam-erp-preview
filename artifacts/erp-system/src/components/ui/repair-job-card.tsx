/**
 * RepairJobCard — repair job summary card.
 *
 * Presentation only: no workflow mutation logic.
 * Status and stage are slots — caller passes badges/chips.
 * Card is optionally clickable (passes onClick).
 */
import * as React from 'react';
import { User, Wrench, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RepairJobCardProps {
  /** Job / ticket number (e.g. "REP-0042"). */
  jobNo: string;
  /** Customer name. */
  customerName: string;
  /** Device make/model (e.g. "iPhone 15 Pro"). */
  deviceName: string;
  /** Reported problem summary. */
  problem?: string;
  /**
   * Slot for status badge (e.g. <StatusBadge>) or workflow stage chip.
   * Positioned in the card header.
   */
  statusSlot?: React.ReactNode;
  /**
   * Stage name text (e.g. "قيد الإصلاح") shown below the job number.
   * Use when statusSlot is a badge and you also need a stage label.
   */
  stageName?: string;
  /** Assigned technician name. */
  technicianName?: string;
  /** Pre-formatted due date. */
  dueDate?: string;
  /** Pre-formatted creation timestamp. */
  createdAt: string;
  /**
   * Slot for card actions (view, edit, etc.).
   * Positioned in the card footer.
   */
  actionsSlot?: React.ReactNode;
  /** Makes the entire card clickable. */
  onClick?: () => void;
  className?: string;
}

export function RepairJobCard({
  jobNo,
  customerName,
  deviceName,
  problem,
  statusSlot,
  stageName,
  technicianName,
  dueDate,
  createdAt,
  actionsSlot,
  onClick,
  className,
}: RepairJobCardProps) {
  const isInteractive = !!onClick;

  return (
    <article
      className={cn(
        'erp-repair-card',
        isInteractive && 'erp-repair-card--interactive',
        className,
      )}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }
          : undefined
      }
      aria-label={isInteractive ? `فتح طلب الإصلاح ${jobNo}` : undefined}
    >
      {/* ── Header: job no + status ── */}
      <div className="erp-repair-card-header">
        <div className="erp-repair-card-id-wrap">
          <span className="erp-repair-card-job-no">{jobNo}</span>
          {stageName && (
            <span className="erp-repair-card-stage">{stageName}</span>
          )}
        </div>
        {statusSlot && (
          <div className="erp-repair-card-status">{statusSlot}</div>
        )}
      </div>

      {/* ── Customer + Device ── */}
      <div className="erp-repair-card-device">
        <div className="erp-repair-card-row">
          <User
            className="erp-repair-card-meta-icon"
            aria-hidden="true"
          />
          <span className="erp-repair-card-customer">{customerName}</span>
        </div>
        <div className="erp-repair-card-row">
          <Wrench
            className="erp-repair-card-meta-icon"
            aria-hidden="true"
          />
          <span className="erp-repair-card-device-name">{deviceName}</span>
        </div>
      </div>

      {/* ── Problem ── */}
      {problem && (
        <p className="erp-repair-card-problem">{problem}</p>
      )}

      {/* ── Footer: technician / dates / actions ── */}
      <div className="erp-repair-card-footer">
        <div className="erp-repair-card-meta">
          {technicianName && (
            <div className="erp-repair-card-row erp-repair-card-row--meta">
              <User
                className="erp-repair-card-meta-icon"
                aria-hidden="true"
              />
              <span className="erp-repair-card-technician">
                {technicianName}
              </span>
            </div>
          )}
          <div className="erp-repair-card-row erp-repair-card-row--meta">
            <Clock
              className="erp-repair-card-meta-icon"
              aria-hidden="true"
            />
            <time className="erp-repair-card-created">{createdAt}</time>
          </div>
          {dueDate && (
            <div className="erp-repair-card-row erp-repair-card-row--meta">
              <Calendar
                className="erp-repair-card-meta-icon"
                aria-hidden="true"
              />
              <time className="erp-repair-card-due">{dueDate}</time>
            </div>
          )}
        </div>

        {actionsSlot && (
          <div
            className="erp-repair-card-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {actionsSlot}
          </div>
        )}
      </div>
    </article>
  );
}
