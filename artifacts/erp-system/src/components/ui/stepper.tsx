import * as React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Stepper — workflow/progress indicator.
 * NOT a navigation menu — use for ordered task sequences only.
 *
 * Accessibility:
 *   - Renders as <ol> (ordered list) for correct screen-reader semantics.
 *   - Current step gets aria-current="step".
 *   - Step state communicated via aria-label on the indicator.
 *
 * Orientation:
 *   horizontal  — steps side-by-side, connector is a horizontal line.
 *   vertical    — steps stacked, connector is a vertical line.
 */

export type StepState = 'pending' | 'current' | 'completed' | 'error';
export type StepperOrientation = 'horizontal' | 'vertical';

export interface Step {
  /** Short visible label. */
  label: string;
  /** Optional supporting text shown below the label. */
  description?: string;
  /** Step lifecycle state. */
  state: StepState;
}

export interface StepperProps {
  steps: Step[];
  orientation?: StepperOrientation;
  className?: string;
}

const STATE_ARIA: Record<StepState, string> = {
  pending:   'معلّق',
  current:   'الخطوة الحالية',
  completed: 'مكتمل',
  error:     'خطأ',
};

export function Stepper({
  steps,
  orientation = 'horizontal',
  className,
}: StepperProps) {
  return (
    <ol
      className={cn(
        'erp-stepper',
        orientation === 'horizontal' && 'erp-stepper--horizontal',
        orientation === 'vertical'   && 'erp-stepper--vertical',
        className,
      )}
    >
      {steps.map((step, index) => (
        <StepperStep
          key={index}
          step={step}
          index={index}
          total={steps.length}
          orientation={orientation}
        />
      ))}
    </ol>
  );
}

function StepperStep({
  step,
  index,
  total,
  orientation,
}: {
  step: Step;
  index: number;
  total: number;
  orientation: StepperOrientation;
}) {
  const isLast = index === total - 1;

  return (
    <li
      className={cn(
        'erp-stepper-step',
        `erp-stepper-step--${step.state}`,
      )}
      aria-current={step.state === 'current' ? 'step' : undefined}
    >
      {/* Indicator circle */}
      <div
        className="erp-stepper-indicator"
        aria-label={`${index + 1}: ${step.label} — ${STATE_ARIA[step.state]}`}
        aria-hidden="true"
      >
        {step.state === 'completed' && (
          <Check className="erp-stepper-indicator-icon" />
        )}
        {step.state === 'error' && (
          <AlertCircle className="erp-stepper-indicator-icon" />
        )}
        {(step.state === 'current' || step.state === 'pending') && (
          <span className="erp-stepper-indicator-number">
            {index + 1}
          </span>
        )}
      </div>

      {/* Label + description */}
      <div className="erp-stepper-content">
        <span className="erp-stepper-label">{step.label}</span>
        {step.description && (
          <span className="erp-stepper-desc">{step.description}</span>
        )}
      </div>

      {/* Connector line to next step */}
      {!isLast && (
        <div
          className={cn(
            'erp-stepper-connector',
            orientation === 'horizontal' && 'erp-stepper-connector--h',
            orientation === 'vertical'   && 'erp-stepper-connector--v',
          )}
          aria-hidden="true"
        />
      )}
    </li>
  );
}
