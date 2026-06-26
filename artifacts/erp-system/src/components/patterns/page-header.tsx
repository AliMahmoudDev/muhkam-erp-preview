/**
 * PageHeader — toolbar band for list and form pages.
 *
 * showIdentity=false (default):
 *   Title/subtitle props are kept for callsite compatibility but not
 *   rendered — they appear in the application topbar (auto-derived from
 *   route). Only actionsSlot and/or tabsSlot are rendered.
 *   When neither slot is provided the component returns null.
 *
 * showIdentity=true (pilot: Sales page):
 *   Renders title + subtitle directly inside the sticky band, alongside
 *   any actionsSlot, with tabsSlot at the bottom of the band.
 *   Validate on the Sales page before applying globally.
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
  /** Page title. Rendered in band when showIdentity=true; ignored otherwise. */
  title?: string;
  /** Page subtitle. Rendered in band when showIdentity=true; ignored otherwise. */
  subtitle?: string;
  /** Alias for subtitle — whichever is provided is used. */
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
   * Use for pages that have multiple top-level tabs (e.g. Sales, Inventory).
   * When present, the band's bottom border is replaced by the tab bar's
   * underline so the visual rhythm is seamless.
   */
  tabsSlot?: React.ReactNode;
  className?: string;
  /**
   * When true, renders title and subtitle inside the sticky band itself,
   * producing a single "Header Band" with identity + tabs + actions.
   *
   * Pilot: used on the Sales page to establish the Final Visual Shell
   * pattern. Do NOT set globally until the design is validated.
   *
   * @default false
   */
  showIdentity?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  sub,
  eyebrowSlot: _eyebrowSlot,
  statusSlot: _statusSlot,
  actionsSlot,
  tabsSlot,
  className,
  showIdentity = false,
}: PageHeaderProps) {
  const resolvedSubtitle = subtitle ?? sub;
  const hasIdentityContent = showIdentity && !!(title || resolvedSubtitle);
  const hasTopRow = hasIdentityContent || !!actionsSlot;

  if (!hasTopRow && !tabsSlot) return null;

  return (
    <div
      className={cn(
        'erp-page-header',
        tabsSlot ? 'erp-page-header--with-tabs' : '',
        showIdentity ? 'erp-page-header--with-identity' : '',
        className,
      )}
    >
      {hasTopRow && (
        <div className="erp-page-header-row">
          {hasIdentityContent && (
            <div className="erp-page-header-identity">
              {title && <h1 className="erp-page-header-title">{title}</h1>}
              {resolvedSubtitle && (
                <p className="erp-page-header-subtitle">{resolvedSubtitle}</p>
              )}
            </div>
          )}

          {actionsSlot && (
            <div
              className="erp-page-header-actions"
              role="toolbar"
              aria-label="إجراءات الصفحة"
            >
              {actionsSlot}
            </div>
          )}
        </div>
      )}

      {tabsSlot && (
        <div
          className="erp-page-header-tabs"
          style={!hasTopRow ? { marginBlockStart: 0 } : undefined}
        >
          {tabsSlot}
        </div>
      )}
    </div>
  );
}
