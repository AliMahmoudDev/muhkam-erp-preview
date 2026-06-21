/**
 * LoadingPagePattern — full-page loading skeleton wrapper.
 *
 * Wraps skeleton components with page-level spacing.
 * When skeletonSlot is omitted, renders a generic skeleton preset
 * appropriate for the chosen variant.
 */
import * as React from 'react';
import {
  Skeleton,
  SkeletonLine,
  SkeletonTable,
} from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type LoadingPageVariant = 'list' | 'detail' | 'form' | 'dashboard';

export interface LoadingPagePatternProps {
  /**
   * Custom skeleton slot. When omitted, a built-in preset is rendered
   * based on `variant`.
   */
  skeletonSlot?: React.ReactNode;
  /**
   * Built-in preset variant used when skeletonSlot is omitted.
   * Default: 'list'
   */
  variant?: LoadingPageVariant;
  className?: string;
}

function ListSkeleton() {
  return (
    <div className="erp-loading-page-preset" aria-busy="true" aria-label="جارٍ التحميل">
      {/* Header area */}
      <div className="erp-loading-page-header-skel">
        <SkeletonLine className="erp-loading-page-title-skel" />
        <SkeletonLine className="erp-loading-page-sub-skel" />
      </div>
      {/* Toolbar */}
      <div className="erp-loading-page-toolbar-skel">
        <Skeleton className="erp-loading-page-search-skel" />
        <Skeleton className="erp-loading-page-btn-skel" />
      </div>
      {/* Table */}
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="erp-loading-page-preset" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="erp-loading-page-header-skel">
        <SkeletonLine className="erp-loading-page-title-skel" />
        <SkeletonLine className="erp-loading-page-sub-skel" />
      </div>
      <div className="erp-loading-page-kpi-skel">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="erp-loading-page-kpi-card-skel" />
        ))}
      </div>
      <Skeleton className="erp-loading-page-tabs-skel" />
      <SkeletonTable rows={4} cols={3} />
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="erp-loading-page-preset" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="erp-loading-page-header-skel">
        <SkeletonLine className="erp-loading-page-title-skel" />
      </div>
      <div className="erp-loading-page-form-skel">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="erp-loading-page-field-skel">
            <SkeletonLine className="erp-loading-page-label-skel" />
            <Skeleton className="erp-loading-page-input-skel" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="erp-loading-page-preset" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="erp-loading-page-header-skel">
        <SkeletonLine className="erp-loading-page-title-skel" />
      </div>
      <div className="erp-loading-page-kpi-skel">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="erp-loading-page-kpi-card-skel" />
        ))}
      </div>
      <div className="erp-loading-page-charts-skel">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="erp-loading-page-chart-skel" />
        ))}
      </div>
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}

const PRESETS: Record<LoadingPageVariant, React.FC> = {
  list:      ListSkeleton,
  detail:    DetailSkeleton,
  form:      FormSkeleton,
  dashboard: DashboardSkeleton,
};

export function LoadingPagePattern({
  skeletonSlot,
  variant = 'list',
  className,
}: LoadingPagePatternProps) {
  const Preset = PRESETS[variant];

  return (
    <div className={cn('erp-loading-page', className)}>
      {skeletonSlot ?? <Preset />}
    </div>
  );
}
