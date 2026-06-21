/**
 * SuccessFeedback — completion confirmation with entity/action naming.
 *
 * Variants map to the action that was performed.
 * Duration / dismissal is handled by the parent (e.g. Toast) — this
 * component is purely presentational.
 *
 * Variants:
 *   saved     — changes persisted
 *   created   — new record added
 *   updated   — existing record modified
 *   deleted   — record removed
 *   archived  — record archived
 */
import * as React from 'react';
import {
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Trash2,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SuccessFeedbackVariant =
  | 'saved'
  | 'created'
  | 'updated'
  | 'deleted'
  | 'archived';

interface VariantDefaults {
  Icon: React.ElementType;
  title: (entity?: string) => string;
  description: (entity?: string) => string;
}

const VARIANT_DEFAULTS: Record<SuccessFeedbackVariant, VariantDefaults> = {
  saved: {
    Icon: CheckCircle2,
    title: (e) => (e ? `تم حفظ ${e}` : 'تم الحفظ'),
    description: (e) => (e ? `تم حفظ ${e} بنجاح.` : 'تم حفظ التغييرات بنجاح.'),
  },
  created: {
    Icon: PlusCircle,
    title: (e) => (e ? `تم إنشاء ${e}` : 'تم الإنشاء'),
    description: (e) => (e ? `تم إنشاء ${e} بنجاح.` : 'تم إنشاء السجل بنجاح.'),
  },
  updated: {
    Icon: RefreshCw,
    title: (e) => (e ? `تم تحديث ${e}` : 'تم التحديث'),
    description: (e) =>
      e ? `تم تحديث ${e} بنجاح.` : 'تم تحديث السجل بنجاح.',
  },
  deleted: {
    Icon: Trash2,
    title: (e) => (e ? `تم حذف ${e}` : 'تم الحذف'),
    description: (e) => (e ? `تم حذف ${e} بنجاح.` : 'تم حذف السجل بنجاح.'),
  },
  archived: {
    Icon: Archive,
    title: (e) => (e ? `تم أرشفة ${e}` : 'تم الأرشفة'),
    description: (e) =>
      e ? `تم أرشفة ${e} بنجاح.` : 'تم نقل السجل إلى الأرشيف.',
  },
};

export interface SuccessFeedbackProps {
  variant?: SuccessFeedbackVariant;
  /**
   * Human-readable entity name (e.g. "الفاتورة #1042").
   * Woven into the title and description.
   */
  entity?: string;
  /** Custom title — overrides variant default. */
  title?: string;
  /** Custom description — overrides variant default. */
  description?: string;
  /** Custom icon — overrides variant default. */
  icon?: React.ReactNode;
  /**
   * Undo slot — renders an undo link/button when provided.
   * Only meaningful for reversible actions.
   */
  undoSlot?: React.ReactNode;
  className?: string;
}

export function SuccessFeedback({
  variant = 'saved',
  entity,
  title,
  description,
  icon,
  undoSlot,
  className,
}: SuccessFeedbackProps) {
  const defaults = VARIANT_DEFAULTS[variant];
  const Icon = defaults.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'erp-success-feedback',
        `erp-success-feedback--${variant}`,
        className,
      )}
    >
      {/* Icon */}
      <div className="erp-success-feedback-icon" aria-hidden="true">
        {icon ?? <Icon />}
      </div>

      {/* Text */}
      <div className="erp-success-feedback-body">
        <p className="erp-success-feedback-title">
          {title ?? defaults.title(entity)}
        </p>
        <p className="erp-success-feedback-desc">
          {description ?? defaults.description(entity)}
        </p>
      </div>

      {/* Undo */}
      {undoSlot && (
        <div className="erp-success-feedback-undo">{undoSlot}</div>
      )}
    </div>
  );
}
