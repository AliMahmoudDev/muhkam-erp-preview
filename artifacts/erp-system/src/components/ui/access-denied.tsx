/**
 * AccessDenied — permission problem, not an application failure.
 *
 * No blame language. Does not expose which permission is missing.
 * Offers back/home navigation slots.
 * Optional role/context props display helpful contextual copy.
 */
import * as React from 'react';
import { ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccessDeniedProps {
  /**
   * Human-readable name of the role the user has.
   * If provided: "حسابك بصلاحية X لا يتيح الوصول لهذا القسم."
   */
  role?: string;
  /**
   * Name of the section/feature that was denied.
   * If provided: "لا يمكن الوصول إلى: X"
   */
  context?: string;
  /** Renders a "go back" action (any node — link or button). */
  backSlot?: React.ReactNode;
  /** Renders a "go home" action. */
  homeSlot?: React.ReactNode;
  className?: string;
}

export function AccessDenied({
  role,
  context,
  backSlot,
  homeSlot,
  className,
}: AccessDeniedProps) {
  const description = role
    ? `حسابك بصلاحية "${role}" لا يتيح الوصول إلى هذا القسم. تواصل مع مسؤول النظام إذا كنت بحاجة إلى هذه الميزة.`
    : 'ليس لديك صلاحية الوصول إلى هذا القسم. تواصل مع مسؤول النظام إذا كنت بحاجة إلى هذه الميزة.';

  return (
    <div
      role="alert"
      className={cn('erp-access-denied', className)}
    >
      {/* Icon */}
      <div className="erp-access-denied-icon" aria-hidden="true">
        <ShieldOff />
      </div>

      {/* Text */}
      <div className="erp-access-denied-body">
        {context && (
          <p className="erp-access-denied-context">
            لا يمكن الوصول إلى: {context}
          </p>
        )}
        <p className="erp-access-denied-title">صلاحية غير كافية</p>
        <p className="erp-access-denied-desc">{description}</p>
      </div>

      {/* Actions */}
      {(backSlot || homeSlot) && (
        <div className="erp-access-denied-actions">
          {backSlot}
          {homeSlot}
        </div>
      )}
    </div>
  );
}
