/**
 * SettingsPattern — settings page layout.
 *
 * Layout hierarchy:
 *   1. Header       — PageHeader (optional, for settings with a title bar)
 *   2. Shell        — two-column on desktop: nav sidebar | content column
 *       Mobile tab  — replaces nav sidebar on narrow viewports
 *       Nav         — sticky category navigation sidebar
 *       Content     — main settings area:
 *         a. Main content  — form fields, toggles, section panels
 *         b. Save bar      — independent save surface (per-section save)
 *         c. Danger zone   — destructive actions with a visual separator
 *
 * No settings logic. No API calls. No permission checks.
 * Each settings section manages its own save surface via saveBarSlot.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsPatternProps {
  /**
   * Page header slot — title and optional actions for the settings page.
   * Optional: omit if the page is already within a titled shell.
   */
  headerSlot?: React.ReactNode;

  /**
   * Category nav slot — vertical list of setting categories.
   * Renders in a sticky sidebar on desktop; hidden on mobile.
   */
  navSlot?: React.ReactNode;

  /**
   * Mobile tab slot — horizontal tab bar replacing the sidebar nav
   * on narrow viewports. Optional: if omitted, the nav is simply hidden.
   */
  mobileTabSlot?: React.ReactNode;

  /**
   * Main settings content slot — section panels, form fields, toggles,
   * and per-section save/cancel buttons.
   * This is the primary content area.
   */
  contentSlot: React.ReactNode;

  /**
   * Independent save bar slot — a save / cancel action surface
   * for the currently active settings section. Rendered between
   * the main content and the danger zone. Caller controls visibility
   * (show only when there are unsaved changes in the active section).
   */
  saveBarSlot?: React.ReactNode;

  /**
   * Danger zone slot — destructive actions (delete account, reset,
   * clear data, etc.). Rendered below the save bar with a prominent
   * visual separator. Caller is responsible for confirmation dialogs.
   */
  dangerZoneSlot?: React.ReactNode;

  className?: string;
}

export function SettingsPattern({
  headerSlot,
  navSlot,
  mobileTabSlot,
  contentSlot,
  saveBarSlot,
  dangerZoneSlot,
  className,
}: SettingsPatternProps) {
  return (
    <div className={cn('erp-settings-page', className)}>

      {/* 1. Optional page header */}
      {headerSlot && (
        <div className="erp-settings-header">
          {headerSlot}
        </div>
      )}

      {/* 2. Shell — nav sidebar + content column */}
      <div
        className={cn(
          'erp-settings-shell',
          navSlot && 'erp-settings-shell--with-nav',
        )}
      >
        {/* Mobile tab nav — shown only on narrow viewports */}
        {mobileTabSlot && (
          <div className="erp-settings-mobile-tabs">
            {mobileTabSlot}
          </div>
        )}

        {/* Category nav sidebar — hidden on mobile */}
        {navSlot && (
          <nav
            className="erp-settings-nav"
            aria-label="تصنيفات الإعدادات"
          >
            {navSlot}
          </nav>
        )}

        {/* Content column */}
        <div className="erp-settings-content">

          {/* a. Main settings content */}
          <div className="erp-settings-main">
            {contentSlot}
          </div>

          {/* b. Independent save bar — per-section save surface */}
          {saveBarSlot && (
            <div
              className="erp-settings-save-bar"
              role="toolbar"
              aria-label="حفظ الإعدادات"
            >
              {saveBarSlot}
            </div>
          )}

          {/* c. Danger zone — with CSS border separator */}
          {dangerZoneSlot && (
            <section
              className="erp-settings-danger"
              aria-label="منطقة الخطر"
            >
              {dangerZoneSlot}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
