/**
 * SuperAdminPattern — SaaS control-room layout.
 *
 * Structure:
 *   1. Header      — super-admin identity bar + global actions
 *   2. Alerts      — critical system-wide alerts strip
 *   3. Shell       — nav sidebar | main content | audit aside
 *        navSlot       (sticky category nav, 220px)
 *        contentSlot   (main control-room content, flex 1)
 *        auditSlot     (audit log / activity, 280px, hidden ≤1200px)
 *
 * Uses the same design system as the rest of MUHKAM.
 * The ".erp-super-admin" root applies a subtle visual marker
 * (header border in status-error) to distinguish this privileged shell.
 * No permission checks. No tenant logic. No API calls.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type SuperAdminState = 'idle' | 'loading' | 'error';

export interface SuperAdminPatternProps {
  /**
   * Header slot — super admin identity, session info, global controls.
   * Rendered in a surface bar at the very top of the control room.
   */
  headerSlot?: React.ReactNode;

  /**
   * Critical alerts slot — system-wide alerts (down tenants, payment
   * failures, security events). Stacks vertically below the header.
   */
  alertsSlot?: React.ReactNode;

  /**
   * Nav slot — vertical control-panel navigation (companies, billing,
   * users, monitoring, debug). Renders in a sticky sidebar.
   */
  navSlot?: React.ReactNode;

  /**
   * Main content slot — the active control-room panel.
   */
  contentSlot: React.ReactNode;

  /**
   * Audit / activity slot — real-time audit log, event stream.
   * Rendered as a narrow aside column on wide screens (≥1200px).
   * Hidden on smaller screens.
   */
  auditSlot?: React.ReactNode;

  /**
   * Loading slot — shown when state === 'loading'.
   */
  loadingSlot?: React.ReactNode;

  /**
   * Error slot — shown when state === 'error'.
   */
  errorSlot?: React.ReactNode;

  /**
   * Current state.
   * 'idle'    → normal layout
   * 'loading' → loadingSlot in content area
   * 'error'   → errorSlot in content area
   */
  state?: SuperAdminState;

  className?: string;
}

export function SuperAdminPattern({
  headerSlot,
  alertsSlot,
  navSlot,
  contentSlot,
  auditSlot,
  loadingSlot,
  errorSlot,
  state = 'idle',
  className,
}: SuperAdminPatternProps) {
  const isLoading = state === 'loading';

  return (
    <div className={cn('erp-super-admin', className)}>

      {/* 1. Control-room header */}
      {headerSlot && (
        <div
          className="erp-super-admin-header"
          role="banner"
          aria-label="لوحة التحكم العليا"
        >
          {headerSlot}
        </div>
      )}

      {/* 2. Critical alerts strip */}
      {alertsSlot && (
        <div
          className="erp-super-admin-alerts"
          role="region"
          aria-label="التنبيهات الحرجة"
          aria-live="polite"
        >
          {alertsSlot}
        </div>
      )}

      {/* 3. Main shell — nav | content | audit */}
      <div
        className={cn(
          'erp-super-admin-shell',
          navSlot && 'erp-super-admin-shell--with-nav',
          auditSlot && 'erp-super-admin-shell--with-audit',
        )}
      >
        {/* Nav sidebar */}
        {navSlot && (
          <nav
            className="erp-super-admin-nav"
            aria-label="قائمة التحكم"
          >
            {navSlot}
          </nav>
        )}

        {/* Content area — state-driven */}
        <main
          className="erp-super-admin-main"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {isLoading && (
            <div
              className="erp-super-admin-state"
              role="status"
              aria-label="جارٍ التحميل"
            >
              {loadingSlot ?? (
                <div
                  className="erp-super-admin-loading-placeholder"
                  aria-hidden="true"
                />
              )}
            </div>
          )}
          {state === 'error' && (
            <div className="erp-super-admin-state" role="alert">
              {errorSlot}
            </div>
          )}
          {state === 'idle' && contentSlot}
        </main>

        {/* Audit / activity aside */}
        {auditSlot && (
          <aside
            className="erp-super-admin-aside"
            aria-label="سجل التدقيق"
          >
            {auditSlot}
          </aside>
        )}
      </div>

    </div>
  );
}
