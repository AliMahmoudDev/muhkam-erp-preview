/**
 * FormPagePattern — create / edit form page layout.
 *
 * Layout hierarchy:
 *   1. Header          — PageHeader (title, breadcrumb, back link)
 *   2. Unsaved banner  — change-detection indicator (optional)
 *   3. Body            — state-driven:
 *        idle    → form sections
 *        loading → loadingSlot (skeleton while initial data fetches)
 *        empty   → emptySlot (entity not found)
 *        error   → errorSlot
 *   4. Action bar      — sticky save / cancel / submit (optional)
 *
 * No data fetching. No submission logic. No change-detection.
 * No validation. All state arrives from the caller.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type FormPageState = 'idle' | 'loading' | 'empty' | 'error';

export interface FormPagePatternProps {
  /**
   * PageHeader slot — title, subtitle, breadcrumb, back navigation.
   * Required: every form page must identify its context.
   */
  headerSlot: React.ReactNode;

  /**
   * Unsaved-changes banner slot — a Banner or Alert component shown
   * when the form has uncommitted changes.
   * This pattern does NOT track unsaved state; the caller supplies
   * this slot and controls its visibility.
   */
  unsavedBannerSlot?: React.ReactNode;

  /**
   * Form sections slot — fieldsets, section cards, tab panels.
   * The `<form>` element itself should be provided by the caller.
   * Rendered only when state === 'idle'.
   */
  formSectionsSlot?: React.ReactNode;

  /**
   * Sticky action bar slot — primary Save, Cancel, and secondary
   * action buttons. Sticks to the bottom of the viewport.
   * Omit to use inline actions inside formSectionsSlot instead.
   */
  actionBarSlot?: React.ReactNode;

  /**
   * Loading slot — shown while initial entity data is fetching
   * (state === 'loading'). Pass a <LoadingPagePattern preset="form">
   * or a custom skeleton. When omitted, a built-in placeholder is shown.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Empty slot — shown when the target entity does not exist
   * (state === 'empty'). Pass an <EmptyState> or <ErrorPagePattern variant="not-found">.
   */
  emptySlot?: React.ReactNode;

  /**
   * Error slot — shown when data fetching failed (state === 'error').
   * Pass an <ErrorState> with an onRetry callback.
   */
  errorSlot?: React.ReactNode;

  /**
   * Current page state.
   * 'idle'    → form sections + action bar
   * 'loading' → loadingSlot (action bar hidden)
   * 'empty'   → emptySlot (action bar hidden)
   * 'error'   → errorSlot (action bar hidden)
   */
  state?: FormPageState;

  className?: string;
}

export function FormPagePattern({
  headerSlot,
  unsavedBannerSlot,
  formSectionsSlot,
  actionBarSlot,
  loadingSlot,
  emptySlot,
  errorSlot,
  state = 'idle',
  className,
}: FormPagePatternProps) {
  const isLoading = state === 'loading';
  const isIdle    = state === 'idle';
  const showActionBar = isIdle && !!actionBarSlot;

  return (
    <div
      className={cn(
        'erp-form-page',
        showActionBar && 'erp-form-page--with-action-bar',
        className,
      )}
    >
      {/* 1. Header */}
      <div className="erp-form-page-header">
        {headerSlot}
      </div>

      {/* 2. Unsaved-changes banner — caller controls visibility */}
      {unsavedBannerSlot && (
        <div
          className="erp-form-page-unsaved"
          role="status"
          aria-live="polite"
        >
          {unsavedBannerSlot}
        </div>
      )}

      {/* 3. Body — state-driven */}
      <div
        className="erp-form-page-body"
        aria-live="polite"
        aria-busy={isLoading}
      >
        {/* Loading */}
        {isLoading && (
          <div
            className="erp-form-page-state"
            role="status"
            aria-label="جارٍ تحميل البيانات"
          >
            {loadingSlot ?? (
              <div
                className="erp-form-page-loading-placeholder"
                aria-hidden="true"
              />
            )}
          </div>
        )}

        {/* Empty / not found */}
        {state === 'empty' && (
          <div className="erp-form-page-state">
            {emptySlot}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="erp-form-page-state" role="alert">
            {errorSlot}
          </div>
        )}

        {/* Idle — form sections */}
        {isIdle && (
          <div className="erp-form-page-sections">
            {formSectionsSlot}
          </div>
        )}
      </div>

      {/* 4. Sticky action bar — only in idle state */}
      {showActionBar && (
        <div
          className="erp-form-page-action-bar"
          role="toolbar"
          aria-label="إجراءات النموذج"
        >
          {actionBarSlot}
        </div>
      )}
    </div>
  );
}
