/**
 * AppPage — root page shell.
 *
 * Every page in the app should be wrapped in AppPage.
 * Governs dir, spacing rhythm, max-width policy, and scroll region.
 * No business logic, no data fetching.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type AppPageMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface AppPageProps {
  children: React.ReactNode;
  /** Maximum content width. Defaults to 'full'. */
  maxWidth?: AppPageMaxWidth;
  /**
   * Optional title region above main content
   * (e.g. a top-of-page breadcrumb or section label).
   */
  titleSlot?: React.ReactNode;
  className?: string;
}

export function AppPage({
  children,
  maxWidth = 'full',
  titleSlot,
  className,
}: AppPageProps) {
  return (
    <div
      dir="rtl"
      className={cn(
        'erp-app-page',
        maxWidth !== 'full' && `erp-app-page--${maxWidth}`,
        className,
      )}
    >
      {titleSlot && (
        <div className="erp-app-page-title">{titleSlot}</div>
      )}
      <main className="erp-app-page-main">{children}</main>
    </div>
  );
}
