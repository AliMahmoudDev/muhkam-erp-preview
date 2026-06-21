import * as React from 'react';
import { SearchX, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyTableVariant = 'no-data' | 'no-results';

interface EmptyConfig {
  Icon: React.ElementType;
  headline: string;
  description: string;
}

const VARIANT_CONFIG: Record<EmptyTableVariant, EmptyConfig> = {
  'no-data':    {
    Icon: Database,
    headline: 'لا توجد بيانات',
    description: 'لم يتم إضافة أي سجلات بعد.',
  },
  'no-results': {
    Icon: SearchX,
    headline: 'لا توجد نتائج',
    description: 'جرّب تعديل معايير البحث أو التصفية.',
  },
};

export interface EmptyTableProps {
  variant?: EmptyTableVariant;
  headline?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyTable({
  variant = 'no-data',
  headline,
  description,
  icon,
  action,
  className,
}: EmptyTableProps) {
  const { Icon, headline: defaultHeadline, description: defaultDesc } =
    VARIANT_CONFIG[variant];

  return (
    <div className={cn('erp-empty-table', className)}>
      <div className="erp-empty-table-icon" aria-hidden="true">
        {icon ?? <Icon />}
      </div>
      <p className="erp-empty-table-headline">
        {headline ?? defaultHeadline}
      </p>
      <p className="erp-empty-table-desc">
        {description ?? defaultDesc}
      </p>
      {action && (
        <div className="erp-empty-table-action">{action}</div>
      )}
    </div>
  );
}
