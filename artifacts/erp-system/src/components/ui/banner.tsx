import * as React from 'react';
import {
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

interface BannerConfig {
  cssClass: string;
  Icon: React.ElementType;
}

const BANNER_CONFIG: Record<BannerVariant, BannerConfig> = {
  info:    { cssClass: 'erp-banner--info',    Icon: Info         },
  warning: { cssClass: 'erp-banner--warning', Icon: AlertTriangle },
  error:   { cssClass: 'erp-banner--error',   Icon: XCircle      },
  success: { cssClass: 'erp-banner--success', Icon: CheckCircle2 },
};

export interface BannerProps {
  variant?: BannerVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function Banner({
  variant = 'info',
  title,
  description,
  icon,
  action,
  dismissible = false,
  onDismiss,
  className,
}: BannerProps) {
  const [visible, setVisible] = React.useState(true);
  const { cssClass, Icon } = BANNER_CONFIG[variant];

  if (!visible) return null;

  function handleDismiss() {
    setVisible(false);
    onDismiss?.();
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn('erp-banner', cssClass, className)}
    >
      <span className="erp-banner-icon" aria-hidden="true">
        {icon ?? <Icon />}
      </span>

      <div className="erp-banner-text">
        {title       && <p className="erp-banner-title">{title}</p>}
        {description && <p className="erp-banner-desc">{description}</p>}
      </div>

      {action && <div className="erp-banner-action">{action}</div>}

      {dismissible && (
        <button
          type="button"
          className="erp-banner-close"
          onClick={handleDismiss}
          aria-label="إغلاق الإشعار"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
