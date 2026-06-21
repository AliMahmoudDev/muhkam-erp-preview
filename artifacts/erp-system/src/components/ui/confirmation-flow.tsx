/**
 * ConfirmationFlow — consequence-based confirmation dialog.
 *
 * Variants:
 *   reversible             — low-stakes action; can be undone
 *   confirmation           — moderate-stakes; cannot easily be undone
 *   critical-confirmation  — destructive; user must type the entity name
 *
 * RTL footer order: Cancel is first in DOM → appears on the RIGHT in RTL
 * (the safe/default position). Confirm is second → appears on the LEFT.
 *
 * Accessibility:
 *   - Focus lands on the Cancel button by default.
 *   - For critical variant, Confirm is disabled until entity name is typed.
 *   - aria-describedby links the consequence text to the dialog.
 */
import * as React from 'react';
import { AlertTriangle, Trash2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type ConfirmationVariant =
  | 'reversible'
  | 'confirmation'
  | 'critical-confirmation';

export interface ConfirmationFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Consequence severity level. */
  variant?: ConfirmationVariant;
  /**
   * Name of the entity being acted upon.
   * Shown in the title and — for critical — required to type to confirm.
   */
  entityName?: string;
  /**
   * Consequences of the action — shown in the dialog body.
   * Be specific: "ستُحذف جميع بيانات العميل والفواتير المرتبطة به."
   */
  consequenceText?: string;
  /**
   * Label for the confirm button.
   * Should match the action verb: "حذف" / "أرشفة" / "إلغاء".
   */
  confirmLabel?: string;
  /** Label for the cancel button. */
  cancelLabel?: string;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Optional title override. */
  title?: string;
  className?: string;
}

/* Map variant → dialog variant for DialogContent styling */
const DIALOG_VARIANT_MAP: Record<
  ConfirmationVariant,
  'default' | 'confirmation' | 'critical-confirmation'
> = {
  reversible:             'confirmation',
  confirmation:           'confirmation',
  'critical-confirmation': 'critical-confirmation',
};

const VARIANT_ICON: Record<ConfirmationVariant, React.ElementType> = {
  reversible:             Info,
  confirmation:           AlertTriangle,
  'critical-confirmation': Trash2,
};

const VARIANT_DEFAULT_TITLE: Record<ConfirmationVariant, string> = {
  reversible:             'تأكيد الإجراء',
  confirmation:           'تأكيد الإجراء',
  'critical-confirmation': 'تأكيد الحذف',
};

const VARIANT_DEFAULT_CONFIRM: Record<ConfirmationVariant, string> = {
  reversible:             'تأكيد',
  confirmation:           'تأكيد',
  'critical-confirmation': 'حذف',
};

const CONSEQUENCE_ID = 'erp-confirm-consequence';
const TYPING_ID     = 'erp-confirm-typing-label';

export function ConfirmationFlow({
  open,
  onOpenChange,
  variant = 'confirmation',
  entityName,
  consequenceText,
  confirmLabel,
  cancelLabel = 'إلغاء',
  onConfirm,
  title,
  className,
}: ConfirmationFlowProps) {
  const [typedValue, setTypedValue] = React.useState('');
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const isCritical = variant === 'critical-confirmation';
  const Icon = VARIANT_ICON[variant];
  const resolvedTitle =
    title ??
    (entityName
      ? `${VARIANT_DEFAULT_TITLE[variant]}: ${entityName}`
      : VARIANT_DEFAULT_TITLE[variant]);
  const resolvedConfirmLabel =
    confirmLabel ?? VARIANT_DEFAULT_CONFIRM[variant];

  /* Reset typed value when dialog closes / reopens */
  React.useEffect(() => {
    if (!open) setTypedValue('');
  }, [open]);

  /* Confirm is disabled for critical until entity name is typed exactly */
  const confirmDisabled =
    isCritical && entityName
      ? typedValue.trim() !== entityName.trim()
      : false;

  function handleConfirm() {
    if (confirmDisabled) return;
    onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant={DIALOG_VARIANT_MAP[variant]}
        className={cn('erp-confirmation-flow', className)}
        onOpenAutoFocus={(e) => {
          /* Focus the cancel button by default */
          e.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <div className="erp-confirmation-flow-icon-wrap" aria-hidden="true">
            <Icon className="erp-confirmation-flow-icon" />
          </div>
          <DialogTitle>{resolvedTitle}</DialogTitle>
        </DialogHeader>

        {/* Consequence text */}
        {consequenceText && (
          <DialogDescription id={CONSEQUENCE_ID}>
            {consequenceText}
          </DialogDescription>
        )}

        {/* Critical: entity name typing confirmation */}
        {isCritical && entityName && (
          <div className="erp-confirmation-flow-typing">
            <label
              id={TYPING_ID}
              htmlFor="erp-confirm-input"
              className="erp-confirmation-flow-typing-label"
            >
              اكتب <strong>{entityName}</strong> للتأكيد:
            </label>
            <input
              id="erp-confirm-input"
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
              }}
              autoComplete="off"
              spellCheck={false}
              aria-labelledby={TYPING_ID}
              aria-required="true"
              aria-invalid={typedValue.length > 0 && confirmDisabled}
              className="erp-confirmation-flow-input"
              placeholder={entityName}
            />
          </div>
        )}

        {/*
          RTL footer order:
          DOM: [Cancel, Confirm]
          RTL visual: Cancel (right/safe) — Confirm (left/destructive)
        */}
        <DialogFooter className="erp-confirmation-flow-footer">
          <DialogClose asChild>
            <button
              ref={cancelRef}
              type="button"
              className="erp-confirmation-flow-btn erp-confirmation-flow-btn--cancel"
            >
              {cancelLabel}
            </button>
          </DialogClose>

          <button
            type="button"
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled}
            aria-describedby={consequenceText ? CONSEQUENCE_ID : undefined}
            onClick={handleConfirm}
            className={cn(
              'erp-confirmation-flow-btn',
              isCritical
                ? 'erp-confirmation-flow-btn--critical'
                : 'erp-confirmation-flow-btn--confirm',
            )}
          >
            {resolvedConfirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
