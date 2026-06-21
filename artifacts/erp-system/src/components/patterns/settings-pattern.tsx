/**
 * SettingsPattern — settings page layout.
 *
 * Composes: category navigation, main content, danger zone.
 * On mobile, the category nav is replaced by a tab slot.
 * No business logic, no permission checks.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsPatternProps {
  /**
   * Category nav slot — vertical list of setting categories.
   * Renders in the sidebar column on desktop.
   */
  navSlot?: React.ReactNode;
  /**
   * Main settings content slot — form fields, toggles, panels.
   */
  contentSlot: React.ReactNode;
  /**
   * Danger zone slot — destructive actions section.
   * Rendered below main content with a visual separator.
   */
  dangerZoneSlot?: React.ReactNode;
  /**
   * Mobile tab slot — replaces navSlot on mobile viewports.
   * Optional: if omitted, navSlot is hidden on mobile.
   */
  mobileTabSlot?: React.ReactNode;
  className?: string;
}

export function SettingsPattern({
  navSlot,
  contentSlot,
  dangerZoneSlot,
  mobileTabSlot,
  className,
}: SettingsPatternProps) {
  return (
    <div
      className={cn(
        'erp-settings-page',
        navSlot && 'erp-settings-page--with-nav',
        className,
      )}
    >
      {/* Mobile tab nav — shown only on narrow viewports */}
      {mobileTabSlot && (
        <div className="erp-settings-mobile-tabs">{mobileTabSlot}</div>
      )}

      {/* Category nav — sidebar */}
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
        {/* Main content */}
        <div className="erp-settings-main">{contentSlot}</div>

        {/* Danger zone */}
        {dangerZoneSlot && (
          <section
            className="erp-settings-danger"
            aria-label="منطقة الخطر"
          >
            <div className="erp-settings-danger-divider" aria-hidden="true" />
            {dangerZoneSlot}
          </section>
        )}
      </div>
    </div>
  );
}
