/**
 * ErrorState — specific failure with a recovery path.
 *
 * Always includes an actionable retry/recovery option.
 * Never shows a generic "حدث خطأ" without context.
 * aria-live="polite" so screen readers announce on mount/update.
 *
 * Variants:
 *   default    — general error
 *   network    — connectivity / timeout failure
 *   permission — 403/permission failure (see also AccessDenied for full page)
 *   server     — 5xx / backend failure
 */
import * as React from 'react';
import {
  AlertCircle,
  WifiOff,
  Lock,
  ServerCrash,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ErrorStateVariant = 'default' | 'network' | 'permission' | 'server';

interface VariantDefaults {
  Icon: React.ElementType;
  title: string;
  description: string;
}

const VARIANT_DEFAULTS: Record<ErrorStateVariant, VariantDefaults> = {
  default: {
    Icon: AlertCircle,
    title: 'حدث خطأ',
    description: 'تعذّر إتمام العملية. يُرجى المحاولة مرة أخرى.',
  },
  network: {
    Icon: WifiOff,
    title: 'تعذّر الاتصال بالخادم',
    description: 'تحقق من اتصالك بالإنترنت وأعد المحاولة.',
  },
  permission: {
    Icon: Lock,
    title: 'غير مُخوَّل',
    description: 'لا تملك الصلاحية اللازمة لعرض هذا المحتوى.',
  },
  server: {
    Icon: ServerCrash,
    title: 'خطأ في الخادم',
    description: 'واجه الخادم مشكلة داخلية. تواصل مع الدعم إذا تكرّر هذا.',
  },
};

export interface ErrorStateProps {
  variant?: ErrorStateVariant;
  /** Overrides variant default title. */
  title?: string;
  /** Overrides variant default description. */
  description?: string;
  /** Custom icon element; falls back to variant default. */
  icon?: React.ReactNode;
  /** Retry callback — renders a retry button when provided. */
  onRetry?: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
  /**
   * Optional technical detail (error code, stack excerpt).
   * Collapsed behind a disclosure initially.
   */
  technicalDetails?: string;
  className?: string;
}

export function ErrorState({
  variant = 'default',
  title,
  description,
  icon,
  onRetry,
  retryLabel = 'أعد المحاولة',
  technicalDetails,
  className,
}: ErrorStateProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const Icon = defaults.Icon;
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'erp-error-state',
        `erp-error-state--${variant}`,
        className,
      )}
    >
      {/* Icon */}
      <div className="erp-error-state-icon" aria-hidden="true">
        {icon ?? <Icon />}
      </div>

      {/* Text */}
      <div className="erp-error-state-body">
        <p className="erp-error-state-title">
          {title ?? defaults.title}
        </p>
        <p className="erp-error-state-desc">
          {description ?? defaults.description}
        </p>
      </div>

      {/* Retry */}
      {onRetry && (
        <button
          type="button"
          className="erp-error-state-retry"
          onClick={onRetry}
        >
          <RotateCcw aria-hidden="true" />
          {retryLabel}
        </button>
      )}

      {/* Technical details disclosure */}
      {technicalDetails && (
        <div className="erp-error-state-details">
          <button
            type="button"
            className="erp-error-state-details-toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((p) => !p)}
          >
            <span>التفاصيل التقنية</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'erp-error-state-details-chevron',
                detailsOpen && 'erp-error-state-details-chevron--open',
              )}
            />
          </button>
          {detailsOpen && (
            <pre className="erp-error-state-details-content">
              {technicalDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
