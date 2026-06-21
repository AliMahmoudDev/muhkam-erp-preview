/**
 * FormPagePattern — create/edit form page layout.
 *
 * Composes: PageHeader, form sections, sticky action bar.
 * The unsaved-changes banner area is a slot only — no change-detection logic.
 * No data fetching, no submission logic.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FormPagePatternProps {
  /** PageHeader slot. */
  headerSlot: React.ReactNode;
  /**
   * Form sections slot — fieldsets, panels, or section cards.
   * The form element itself should be provided by the caller.
   */
  formSectionsSlot: React.ReactNode;
  /**
   * Sticky action bar slot — save/cancel/submit buttons.
   * Sticks to the bottom of the viewport on scroll.
   */
  actionBarSlot?: React.ReactNode;
  /**
   * Unsaved-changes area slot — a banner or indicator.
   * This pattern does NOT track unsaved state; caller supplies when needed.
   */
  unsavedBannerSlot?: React.ReactNode;
  className?: string;
}

export function FormPagePattern({
  headerSlot,
  formSectionsSlot,
  actionBarSlot,
  unsavedBannerSlot,
  className,
}: FormPagePatternProps) {
  return (
    <div className={cn('erp-form-page', className)}>
      {/* Header */}
      <div className="erp-form-page-header">{headerSlot}</div>

      {/* Unsaved changes banner */}
      {unsavedBannerSlot && (
        <div
          className="erp-form-page-unsaved"
          role="status"
          aria-live="polite"
        >
          {unsavedBannerSlot}
        </div>
      )}

      {/* Form sections */}
      <div className="erp-form-page-body">{formSectionsSlot}</div>

      {/* Sticky action bar */}
      {actionBarSlot && (
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
