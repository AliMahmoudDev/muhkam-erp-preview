/**
 * EmptyPagePattern — full-page empty state wrapper.
 *
 * Wraps <EmptyState> with page-level vertical centering and spacing.
 * Use when a route has no data to show at all (first-time or no-results).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyPagePatternProps {
  /**
   * EmptyState slot — an <EmptyState> component or any ReactNode.
   * The pattern provides the vertical centring and spacing.
   */
  emptySlot?: React.ReactNode;
  className?: string;
}

export function EmptyPagePattern({
  emptySlot,
  className,
}: EmptyPagePatternProps) {
  return (
    <div
      className={cn('erp-empty-page', className)}
      role="main"
      aria-label="لا توجد بيانات"
    >
      {emptySlot}
    </div>
  );
}
