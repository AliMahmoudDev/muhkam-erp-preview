/**
 * PageHeader — toolbar band for list and form pages.
 *
 * The page title and subtitle are now shown in the application topbar,
 * so PageHeader only renders the actionsSlot and/or tabsSlot.
 * When neither is provided the component returns null (no visible band).
 *
 * Convention: actionsSlot should contain at most 1 primary action button
 * and secondary actions. Overflow handled by caller (e.g. a "more" menu).
 *
 * tabsSlot: optional module-level tab bar.
 * When provided, it renders at the bottom of the sticky band so tabs
 * appear as part of the band rather than below it.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Kept for callsite compatibility — no longer rendered visually. */
  title?: string;
  /** Kept for callsite compatibility — no longer rendered visually. */
  subtitle?: string;
  /** Kept for callsite compatibility — no longer rendered visually. */
  sub?: string;
  /** Kept for callsite compatibility — no longer rendered visually. */
  eyebrowSlot?: React.ReactNode;
  /** Kept for callsite compatibility — no longer rendered visually. */
  statusSlot?: React.ReactNode;
  /**
   * Actions slot — primary + secondary actions.
   * Convention: max 1 primary action button.
   */
  actionsSlot?: React.ReactNode;
  /**
   * Tabs slot — module-level tab bar rendered at the bottom of the band.
   * Use for pages that have multiple top-level tabs (e.g. Inventory).
   * When present, the band's bottom border is replaced by the tab bar's
   * underline so the visual rhythm is seamless.
   */
  tabsSlot?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title: _title,
  subtitle: _subtitle,
  sub: _sub,
  eyebrowSlot: _eyebrowSlot,
  statusSlot: _statusSlot,
  actionsSlot,
  tabsSlot,
  className,
}: PageHeaderProps) {
  if (!actionsSlot && !tabsSlot) return null;

  return (
    <div
      className={cn(
        'erp-page-header',
        tabsSlot ? 'erp-page-header--with-tabs' : '',
        className,
      )}
    >
      {actionsSlot && (
        <div className="erp-page-header-row">
          <div style={{ flex: 1 }} />
          <div
            className="erp-page-header-actions"
            role="toolbar"
            aria-label="إجراءات الصفحة"
          >
            {actionsSlot}
          </div>
        </div>
      )}

      {tabsSlot && (
        <div
          className="erp-page-header-tabs"
          style={!actionsSlot ? { marginBlockStart: 0 } : undefined}
        >
          {tabsSlot}
        </div>
      )}
    </div>
  );
}
