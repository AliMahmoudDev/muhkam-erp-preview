import * as React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant =
  | 'positive'
  | 'critical'
  | 'negative'
  | 'neutral'
  | 'informative'
  | 'repair-qc';

interface VariantConfig {
  cssClass: string;
  Icon: React.ElementType;
  defaultLabel: string;
}

const VARIANT_MAP: Record<StatusBadgeVariant, VariantConfig> = {
  positive:    { cssClass: 'erp-status-badge--positive',    Icon: CheckCircle2,  defaultLabel: 'ناجح'     },
  critical:    { cssClass: 'erp-status-badge--critical',    Icon: AlertTriangle, defaultLabel: 'تحذير'    },
  negative:    { cssClass: 'erp-status-badge--negative',    Icon: XCircle,       defaultLabel: 'خطأ'      },
  neutral:     { cssClass: 'erp-status-badge--neutral',     Icon: Clock,         defaultLabel: 'محايد'    },
  informative: { cssClass: 'erp-status-badge--informative', Icon: Info,          defaultLabel: 'معلومات'  },
  'repair-qc': { cssClass: 'erp-status-badge--repair-qc',  Icon: Wrench,        defaultLabel: 'مراقبة الجودة' },
};

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label?: string;
  icon?: React.ReactNode;
  'aria-label'?: string;
  className?: string;
}

export function StatusBadge({
  variant,
  label,
  icon,
  'aria-label': ariaLabel,
  className,
}: StatusBadgeProps) {
  const { cssClass, Icon, defaultLabel } = VARIANT_MAP[variant];
  const displayLabel = label ?? defaultLabel;

  return (
    <span
      role="status"
      aria-label={ariaLabel ?? displayLabel}
      className={cn('erp-status-badge', cssClass, className)}
    >
      <span className="erp-status-badge-icon" aria-hidden="true">
        {icon ?? <Icon />}
      </span>
      {displayLabel}
    </span>
  );
}
