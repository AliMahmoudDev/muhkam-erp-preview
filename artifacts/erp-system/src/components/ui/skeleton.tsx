/**
 * Skeleton — structural loading placeholder.
 *
 * Updated in place: adds typed `variant` prop and `aria-hidden` default.
 * Existing usages that pass only `className` continue to work unchanged
 * (default variant = 'block' provides the same rectangular shape).
 *
 * Variants:
 *   block   — rectangular region (default)
 *   line    — single text line
 *   circle  — avatar / icon placeholder
 *   card    — card-shaped composite placeholder
 *   table   — multi-row table placeholder (use SkeletonTable instead)
 *
 * Reduced motion: animation is disabled via @media prefers-reduced-motion
 * in feedback.css; a static tinted block is shown instead.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type SkeletonVariant = 'block' | 'line' | 'circle' | 'card' | 'table';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Shape/layout variant. Default: 'block'. */
  variant?: SkeletonVariant;
}

function Skeleton({ variant = 'block', className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'erp-skeleton',
        `erp-skeleton--${variant}`,
        className,
      )}
      {...props}
    />
  );
}
Skeleton.displayName = 'Skeleton';

/* ─── SkeletonLine — shorthand ──────────────────────────────── */
function SkeletonLine({
  className,
  ...props
}: Omit<SkeletonProps, 'variant'>) {
  return <Skeleton variant="line" className={className} {...props} />;
}
SkeletonLine.displayName = 'SkeletonLine';

/* ─── SkeletonCircle — shorthand ────────────────────────────── */
function SkeletonCircle({
  className,
  ...props
}: Omit<SkeletonProps, 'variant'>) {
  return <Skeleton variant="circle" className={className} {...props} />;
}
SkeletonCircle.displayName = 'SkeletonCircle';

/* ─── SkeletonTable — composite table placeholder ───────────── */
export interface SkeletonTableProps {
  /** Number of placeholder rows. Default: 5. */
  rows?: number;
  /** Number of columns per row. Default: 4. */
  cols?: number;
  className?: string;
}

function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('erp-skeleton-table', className)}
    >
      {/* Header row */}
      <div className="erp-skeleton-table-row erp-skeleton-table-header">
        {Array.from({ length: cols }).map((_, ci) => (
          <Skeleton
            key={ci}
            variant="line"
            className="erp-skeleton-table-cell erp-skeleton-table-cell--header"
          />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="erp-skeleton-table-row">
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton
              key={ci}
              variant="line"
              className="erp-skeleton-table-cell"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
SkeletonTable.displayName = 'SkeletonTable';

/* ─── SkeletonCard — composite card placeholder ─────────────── */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('erp-skeleton-card-shell', className)}>
      {/* Header: avatar + title lines */}
      <div className="erp-skeleton-card-header">
        <Skeleton variant="circle" className="erp-skeleton-card-avatar" />
        <div className="erp-skeleton-card-title-wrap">
          <Skeleton variant="line" className="erp-skeleton-card-title" />
          <Skeleton variant="line" className="erp-skeleton-card-subtitle" />
        </div>
      </div>
      {/* Body: content lines */}
      <Skeleton variant="line" className="erp-skeleton-card-body-line" />
      <Skeleton variant="line" className="erp-skeleton-card-body-line erp-skeleton-card-body-line--short" />
    </div>
  );
}
SkeletonCard.displayName = 'SkeletonCard';

export { Skeleton, SkeletonLine, SkeletonCircle, SkeletonTable, SkeletonCard };
