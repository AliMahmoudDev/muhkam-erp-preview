/**
 * DetailPagePattern — entity detail page layout.
 *
 * Composes: EntityHeader, Tabs/sections, optional Timeline/ActivityFeed.
 * Supports optional sticky header.
 * No data fetching, no permissions.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DetailPagePatternProps {
  /**
   * EntityHeader slot — the canonical entity heading area.
   * Required by convention on detail pages.
   */
  entityHeaderSlot: React.ReactNode;
  /**
   * Tabs slot — <Tabs> component or a horizontal section nav.
   * Renders below the entity header.
   */
  tabsSlot?: React.ReactNode;
  /**
   * Sections slot — main content area (tab panels or sections).
   */
  sectionsSlot?: React.ReactNode;
  /**
   * Timeline / activity slot — rendered in a side column on wide screens,
   * or below sections on narrow screens.
   */
  timelineSlot?: React.ReactNode;
  /**
   * When true, the entity header becomes position: sticky inset-block-start 0.
   */
  stickyHeader?: boolean;
  className?: string;
}

export function DetailPagePattern({
  entityHeaderSlot,
  tabsSlot,
  sectionsSlot,
  timelineSlot,
  stickyHeader = false,
  className,
}: DetailPagePatternProps) {
  return (
    <div className={cn('erp-detail-page', className)}>
      {/* Entity header — optionally sticky */}
      <div
        className={cn(
          'erp-detail-page-header',
          stickyHeader && 'erp-detail-page-header--sticky',
        )}
      >
        {entityHeaderSlot}
      </div>

      {/* Tabs bar */}
      {tabsSlot && (
        <div className="erp-detail-page-tabs">{tabsSlot}</div>
      )}

      {/* Body: sections + optional timeline */}
      <div
        className={cn(
          'erp-detail-page-body',
          timelineSlot && 'erp-detail-page-body--with-aside',
        )}
      >
        {/* Main sections */}
        <div className="erp-detail-page-sections">
          {sectionsSlot}
        </div>

        {/* Timeline / activity aside */}
        {timelineSlot && (
          <aside className="erp-detail-page-aside" aria-label="السجل والنشاط">
            {timelineSlot}
          </aside>
        )}
      </div>
    </div>
  );
}
