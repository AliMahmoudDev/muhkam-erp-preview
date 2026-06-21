/**
 * EmptyState — no-data / no-results / first-time guidance.
 *
 * NOT an error state. Use ErrorState for failures.
 * CSS classes consumed from the existing empty-state.css
 * (`.erp-empty-state`, `.erp-empty-icon`, etc.) — no duplication.
 *
 * Variants:
 *   no-data      — entity list is empty, invite to create
 *   no-results   — search / filter returned nothing; shows query + clear action
 *   first-time   — onboarding, celebratory first-use state
 */
import * as React from 'react';
import { Database, SearchX, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EmptyStateVariant = 'no-data' | 'no-results' | 'first-time';

interface VariantDefaults {
  Icon: React.ElementType;
  title: string;
  description: string;
}

const VARIANT_DEFAULTS: Record<EmptyStateVariant, VariantDefaults> = {
  'no-data': {
    Icon: Database,
    title: 'لا توجد بيانات بعد',
    description: 'ابدأ بإضافة أول سجل.',
  },
  'no-results': {
    Icon: SearchX,
    title: 'لا توجد نتائج',
    description: 'جرّب تعديل كلمة البحث أو إزالة بعض الفلاتر.',
  },
  'first-time': {
    Icon: Sparkles,
    title: 'مرحباً بك',
    description: 'ابدأ إعداد هذا القسم لأوّل مرة.',
  },
};

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /** Overrides the variant default title. */
  title?: string;
  /** Overrides the variant default description. */
  description?: string;
  /** Custom icon; falls back to variant default. */
  icon?: React.ReactNode;
  /**
   * Primary CTA button or any action node.
   * For no-results, typically a "clear filters" button.
   */
  action?: React.ReactNode;
  /**
   * no-results only: shows the search query that returned no results.
   * e.g. query="apple" renders: 'لا توجد نتائج لـ "apple"'
   */
  query?: string;
  className?: string;
}

export function EmptyState({
  variant = 'no-data',
  title,
  description,
  icon,
  action,
  query,
  className,
}: EmptyStateProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const resolvedTitle =
    title ??
    (variant === 'no-results' && query
      ? `لا توجد نتائج لـ "${query}"`
      : defaults.title);
  const resolvedDescription = description ?? defaults.description;
  const Icon = defaults.Icon;

  return (
    <div
      className={cn(
        'erp-empty-state erp-empty-state--rich',
        `erp-empty-state--${variant}`,
        className,
      )}
    >
      <div className="erp-empty-icon" aria-hidden="true">
        {icon ?? <Icon />}
      </div>

      <p className="erp-empty-headline">{resolvedTitle}</p>
      <p className="erp-empty-label">{resolvedDescription}</p>

      {action && (
        <div className="erp-empty-action">{action}</div>
      )}
    </div>
  );
}
