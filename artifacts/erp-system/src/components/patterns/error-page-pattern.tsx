/**
 * ErrorPagePattern — full-page error/access/offline wrapper.
 *
 * Wraps <ErrorState>, <AccessDenied>, or <OfflineState> with
 * page-level centering and spacing.
 * Variant drives which built-in component is shown when errorSlot is omitted.
 */
import * as React from 'react';
import { ErrorState }   from '@/components/ui/error-state';
import { AccessDenied } from '@/components/ui/access-denied';
import { OfflineState } from '@/components/ui/offline-state';
import { cn } from '@/lib/utils';

export type ErrorPageVariant =
  | 'error'
  | 'access-denied'
  | 'offline'
  | 'not-found';

export interface ErrorPagePatternProps {
  /**
   * Custom error slot. When provided, rendered as-is.
   * When omitted, the built-in component for `variant` is rendered.
   */
  errorSlot?: React.ReactNode;
  /**
   * Built-in variant used when errorSlot is omitted.
   * 'error'         → <ErrorState variant="default">
   * 'access-denied' → <AccessDenied>
   * 'offline'       → <OfflineState>
   * 'not-found'     → <ErrorState> with 404 messaging
   */
  variant?: ErrorPageVariant;
  /**
   * Retry callback — wired to the built-in ErrorState component.
   * Ignored when errorSlot is provided or variant is not 'error'.
   */
  onRetry?: () => void;
  className?: string;
}

function BuiltinError({
  variant,
  onRetry,
}: {
  variant: ErrorPageVariant;
  onRetry?: () => void;
}) {
  if (variant === 'access-denied') return <AccessDenied />;
  if (variant === 'offline')       return <OfflineState />;
  if (variant === 'not-found') {
    return (
      <ErrorState
        variant="default"
        title="الصفحة غير موجودة"
        description="لم نتمكن من العثور على الصفحة التي تبحث عنها."
      />
    );
  }
  /* 'error' — default */
  return <ErrorState variant="default" onRetry={onRetry} />;
}

export function ErrorPagePattern({
  errorSlot,
  variant = 'error',
  onRetry,
  className,
}: ErrorPagePatternProps) {
  return (
    <div className={cn('erp-error-page', className)} role="main">
      {errorSlot ?? <BuiltinError variant={variant} onRetry={onRetry} />}
    </div>
  );
}
