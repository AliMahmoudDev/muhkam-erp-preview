/**
 * DetailPagePattern — entity detail page layout.
 *
 * Layout hierarchy:
 *   1. Entity header  — name, ID, primary actions (optionally sticky)
 *   2. Meta strip     — status badges, secondary metadata (optional)
 *   3. Tabs bar       — section navigation (optional)
 *   4. Body           — state-driven:
 *        idle    → main content + optional timeline aside
 *        loading → loadingSlot
 *        empty   → emptySlot (entity not found)
 *        error   → errorSlot
 *
 * No data fetching. No business logic. No permissions.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type DetailPageState = 'idle' | 'loading' | 'empty' | 'error';

export interface DetailPagePatternProps {
  /**
   * Entity header slot — the canonical heading area for the entity.
   * Typically an <EntityHeader> component (name, ID, avatar, actions).
   * Required: every detail page must identify its entity.
   */
  entityHeaderSlot: React.ReactNode;

  /**
   * Meta / status slot — secondary metadata strip rendered between
   * the entity header and the tabs bar.
   * Use for status badges, assigned-to, dates, quick-edit chips.
   * Optional.
   */
  metaSlot?: React.ReactNode;

  /**
   * Tabs slot — <Tabs> component or a horizontal section nav.
   * Rendered below the entity header (and meta, if present).
   * Optional: omit for single-section detail pages.
   */
  tabsSlot?: React.ReactNode;

  /**
   * Main content slot — tab panels, detail sections, form sections.
   * Rendered in the main column when state === 'idle'.
   */
  mainContentSlot?: React.ReactNode;

  /**
   * Timeline / activity aside slot.
   * On wide screens: renders as a fixed-width aside column.
   * On narrow screens: stacks below mainContentSlot.
   * Optional.
   */
  timelineSlot?: React.ReactNode;

  /**
   * Loading slot — shown when state === 'loading'.
   * Pass a <LoadingPagePattern preset="detail"> or skeleton.
   * When omitted, an accessible aria-busy placeholder is shown.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Empty slot — shown when state === 'empty'.
   * Use for entity-not-found or no-data conditions.
   */
  emptySlot?: React.ReactNode;

  /**
   * Error slot — shown when state === 'error'.
   * Pass an <ErrorState> or <ErrorPagePattern> variant.
   */
  errorSlot?: React.ReactNode;

  /**
   * Current page state.
   * 'idle'    → entity header + meta + tabs + main content + timeline
   * 'loading' → entity header only + loadingSlot in body
   * 'empty'   → entity header only + emptySlot in body
   * 'error'   → errorSlot (full body, header hidden)
   */
  state?: DetailPageState;

  /**
   * When true, the entity header becomes sticky at the top of the
   * viewport so the entity identity stays visible during scrolling.
   */
  stickyHeader?: boolean;

  className?: string;
}

export function DetailPagePattern({
  entityHeaderSlot,
  metaSlot,
  tabsSlot,
  mainContentSlot,
  timelineSlot,
  loadingSlot,
  emptySlot,
  errorSlot,
  state = 'idle',
  stickyHeader = false,
  className,
}: DetailPagePatternProps) {
  const isLoading = state === 'loading';
  const showHeader = state !== 'error';
  const showMeta   = state === 'idle' && !!metaSlot;
  const showTabs   = state === 'idle' && !!tabsSlot;

  return (
    <div className={cn('erp-detail-page', className)}>

      {/* 1. Entity header — always shown except on full error */}
      {showHeader && (
        <div
          className={cn(
            'erp-detail-page-header',
            stickyHeader && 'erp-detail-page-header--sticky',
          )}
        >
          {entityHeaderSlot}
        </div>
      )}

      {/* 2. Meta / status strip */}
      {showMeta && (
        <div
          className="erp-detail-page-meta"
          role="region"
          aria-label="معلومات الحالة"
        >
          {metaSlot}
        </div>
      )}

      {/* 3. Tabs bar */}
      {showTabs && (
        <div className="erp-detail-page-tabs" role="navigation" aria-label="أقسام التفاصيل">
          {tabsSlot}
        </div>
      )}

      {/* 4. Body — state-driven */}
      <div
        className={cn(
          'erp-detail-page-body',
          state === 'idle' && timelineSlot && 'erp-detail-page-body--with-aside',
        )}
        aria-live="polite"
        aria-busy={isLoading}
      >

        {/* Loading */}
        {isLoading && (
          <div
            className="erp-detail-page-state"
            role="status"
            aria-label="جارٍ تحميل التفاصيل"
          >
            {loadingSlot ?? (
              <div
                className="erp-detail-page-loading-placeholder"
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* Empty / not found */}
        {state === 'empty' && (
          <div className="erp-detail-page-state">
            {emptySlot}
          </div>
        )}

        {/* Error — full body replacement */}
        {state === 'error' && (
          <div className="erp-detail-page-state" role="alert">
            {errorSlot}
          </div>
        )}

        {/* Idle — main content + optional timeline aside */}
        {state === 'idle' && (
          <>
            <div className="erp-detail-page-sections">
              {mainContentSlot}
            </div>
            {timelineSlot && (
              <aside
                className="erp-detail-page-aside"
                aria-label="السجل والنشاط"
              >
                {timelineSlot}
              </aside>
            )}
          </>
        )}

      </div>
    </div>
  );
}
