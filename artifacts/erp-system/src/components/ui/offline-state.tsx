/**
 * OfflineState — connectivity problem indicator.
 *
 * No business logic. Caller is responsible for detecting offline status
 * and passing it as a prop.
 * The retry slot accepts any button/action; pass null to omit.
 */
import * as React from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OfflineStateProps {
  /** Text displayed as the last synchronisation timestamp. Optional. */
  lastSync?: string;
  /**
   * Slot for a retry button or action node.
   * If omitted, no action is shown.
   */
  retrySlot?: React.ReactNode;
  className?: string;
}

export function OfflineState({
  lastSync,
  retrySlot,
  className,
}: OfflineStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="لا يوجد اتصال بالإنترنت"
      className={cn('erp-offline-state', className)}
    >
      {/* Icon */}
      <div className="erp-offline-state-icon" aria-hidden="true">
        <WifiOff />
      </div>

      {/* Text */}
      <div className="erp-offline-state-body">
        <p className="erp-offline-state-title">لا يوجد اتصال بالإنترنت</p>
        <p className="erp-offline-state-desc">
          تحقق من اتصالك وأعد المحاولة.
        </p>
        {lastSync && (
          <p className="erp-offline-state-sync">
            آخر مزامنة: {lastSync}
          </p>
        )}
      </div>

      {/* Retry slot */}
      {retrySlot && (
        <div className="erp-offline-state-retry">{retrySlot}</div>
      )}
    </div>
  );
}
