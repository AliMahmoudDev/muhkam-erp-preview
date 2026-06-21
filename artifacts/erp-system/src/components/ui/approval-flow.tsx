/**
 * ApprovalFlow — approval steps display.
 *
 * No permission logic. Caller decides which action slots to render
 * based on the current user's role and the step's state.
 *
 * Step states:
 *   pending   — awaiting action
 *   current   — the step awaiting action RIGHT NOW (highlighted)
 *   approved  — approved (green check)
 *   rejected  — rejected (red X)
 */
import * as React from 'react';
import { Check, X, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ApprovalStepStatus =
  | 'pending'
  | 'current'
  | 'approved'
  | 'rejected';

export interface ApprovalStep {
  id: string;
  /** Step name (e.g. "مدير المبيعات", "المحاسبة", "الإدارة"). */
  label: string;
  status: ApprovalStepStatus;
  /** Name of the assigned approver. */
  approverName?: string;
  /** Pre-formatted timestamp of the action. */
  timestamp?: string;
  /** Note or comment left by approver. */
  note?: string;
  /**
   * Approve action slot. Visible only when status === 'current'.
   * Caller wires the mutation logic.
   */
  approveSlot?: React.ReactNode;
  /**
   * Reject action slot. Visible only when status === 'current'.
   */
  rejectSlot?: React.ReactNode;
  /**
   * Slot for a rejection reason input or text.
   * Visible when status === 'rejected'.
   */
  rejectionReasonSlot?: React.ReactNode;
}

export interface ApprovalFlowProps {
  steps: ApprovalStep[];
  className?: string;
  /** Accessible label for the list. */
  ariaLabel?: string;
}

function StepIcon({ status }: { status: ApprovalStepStatus }) {
  if (status === 'approved') return <Check aria-hidden="true" />;
  if (status === 'rejected') return <X     aria-hidden="true" />;
  if (status === 'current')  return <Clock aria-hidden="true" />;
  return null;
}

export function ApprovalFlow({
  steps,
  className,
  ariaLabel = 'مسار الاعتماد',
}: ApprovalFlowProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('erp-approval-flow', className)}
    >
      <ol className="erp-approval-list">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCurrent = step.status === 'current';

          return (
            <li
              key={step.id}
              className={cn(
                'erp-approval-step',
                `erp-approval-step--${step.status}`,
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* ── Track ── */}
              <div className="erp-approval-track" aria-hidden="true">
                <div className={cn(
                  'erp-approval-indicator',
                  `erp-approval-indicator--${step.status}`,
                )}>
                  <StepIcon status={step.status} />
                  {step.status === 'pending' && (
                    <span className="erp-approval-indicator-num">
                      {index + 1}
                    </span>
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'erp-approval-connector',
                      step.status === 'approved' && 'erp-approval-connector--done',
                    )}
                  />
                )}
              </div>

              {/* ── Content ── */}
              <div className="erp-approval-content">
                <div className="erp-approval-header">
                  <span className="erp-approval-label">{step.label}</span>
                  {step.timestamp && (
                    <time className="erp-approval-time">{step.timestamp}</time>
                  )}
                </div>

                {step.approverName && (
                  <div className="erp-approval-approver">
                    <User
                      className="erp-approval-approver-icon"
                      aria-hidden="true"
                    />
                    <span>{step.approverName}</span>
                  </div>
                )}

                {step.note && (
                  <p className="erp-approval-note">{step.note}</p>
                )}

                {/* Rejection reason slot */}
                {step.status === 'rejected' && step.rejectionReasonSlot && (
                  <div className="erp-approval-rejection">
                    {step.rejectionReasonSlot}
                  </div>
                )}

                {/* Current step actions: approve + reject */}
                {isCurrent && (step.approveSlot || step.rejectSlot) && (
                  <div className="erp-approval-step-actions">
                    {step.approveSlot}
                    {step.rejectSlot}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
