/**
 * WorkflowStageBar — visual stage progression indicator.
 *
 * Owns stage PRESENTATION only — no workflow mutation logic.
 *
 * Stage states:
 *   pending    — not yet reached
 *   current    — active stage (brand color)
 *   completed  — passed (success green)
 *   error      — failed/blocked (error red)
 *   repair-qc  — quality check stage (violet only, per spec)
 *
 * Layout:
 *   horizontal — stages side-by-side (default, desktop)
 *   stacked    — vertical list (mobile / narrow containers)
 */
import * as React from 'react';
import { Check, AlertCircle, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkflowStageState =
  | 'pending'
  | 'current'
  | 'completed'
  | 'error'
  | 'repair-qc';

export interface WorkflowStage {
  id: string;
  label: string;
  state: WorkflowStageState;
  /** Optional timestamp shown under the label (pre-formatted). */
  timestamp?: string;
}

export interface WorkflowStageBarProps {
  stages: WorkflowStage[];
  orientation?: 'horizontal' | 'stacked';
  className?: string;
  /** Accessible label for the nav landmark. */
  ariaLabel?: string;
}

function StageIcon({ state }: { state: WorkflowStageState }) {
  if (state === 'completed') return <Check />;
  if (state === 'error')     return <AlertCircle />;
  if (state === 'repair-qc') return <ClipboardCheck />;
  return null;
}

export function WorkflowStageBar({
  stages,
  orientation = 'horizontal',
  className,
  ariaLabel = 'مراحل سير العمل',
}: WorkflowStageBarProps) {
  const currentIndex = stages.findIndex((s) => s.state === 'current');

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'erp-workflow-bar',
        orientation === 'horizontal' && 'erp-workflow-bar--h',
        orientation === 'stacked'    && 'erp-workflow-bar--v',
        className,
      )}
    >
      <ol className="erp-workflow-list">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;

          return (
            <li
              key={stage.id}
              className={cn(
                'erp-workflow-stage',
                `erp-workflow-stage--${stage.state}`,
              )}
              aria-current={stage.state === 'current' ? 'step' : undefined}
              aria-label={`${stage.label}${stage.state === 'current' ? ' — الحالية' : ''}`}
            >
              {/* ── Indicator ── */}
              <div className="erp-workflow-indicator" aria-hidden="true">
                <StageIcon state={stage.state} />
                {(stage.state === 'pending' || stage.state === 'current') && (
                  <span className="erp-workflow-indicator-dot" />
                )}
              </div>

              {/* ── Label + timestamp ── */}
              <div className="erp-workflow-stage-content">
                <span className="erp-workflow-stage-label">{stage.label}</span>
                {stage.timestamp && (
                  <time className="erp-workflow-stage-time">
                    {stage.timestamp}
                  </time>
                )}
              </div>

              {/* ── Connector to next stage ── */}
              {!isLast && (
                <div
                  className={cn(
                    'erp-workflow-connector',
                    orientation === 'horizontal' && 'erp-workflow-connector--h',
                    orientation === 'stacked'    && 'erp-workflow-connector--v',
                    index < (currentIndex === -1 ? 0 : currentIndex)
                      ? 'erp-workflow-connector--filled'
                      : '',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
