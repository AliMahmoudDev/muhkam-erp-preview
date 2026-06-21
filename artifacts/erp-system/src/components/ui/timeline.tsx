/**
 * Timeline — chronological event history display.
 *
 * No data fetching. Caller supplies pre-loaded items.
 * Items rendered newest-first or oldest-first depending on array order.
 *
 * Each item has:
 *   - timestamp (pre-formatted string)
 *   - actor     (user name / system)
 *   - content   (ReactNode — summary text, rich change description, etc.)
 *   - icon      (Lucide component, optional)
 *   - status    (drives icon container color)
 */
import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TimelineItemStatus =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

export interface TimelineItem {
  id: string;
  /** Pre-formatted timestamp — e.g. "١٤ يونيو ٢٠٢٦، ١٠:٣٢ ص". */
  timestamp: string;
  /** User or system actor. */
  actor?: string;
  /** Main content — text, rich markup, or any ReactNode. */
  content: React.ReactNode;
  /** Lucide icon component for the indicator. Defaults to Clock. */
  icon?: React.ElementType;
  /** Colours the icon indicator background. Default: 'default'. */
  status?: TimelineItemStatus;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  if (items.length === 0) return null;

  return (
    <ol
      className={cn('erp-timeline', className)}
      aria-label="سجل الأحداث"
    >
      {items.map((item, index) => {
        const Icon = item.icon ?? Clock;
        const isLast = index === items.length - 1;
        const status = item.status ?? 'default';

        return (
          <li key={item.id} className="erp-timeline-item">
            {/* ── Track: icon + connector line ── */}
            <div className="erp-timeline-track" aria-hidden="true">
              <div
                className={cn(
                  'erp-timeline-icon',
                  `erp-timeline-icon--${status}`,
                )}
              >
                <Icon />
              </div>
              {!isLast && <div className="erp-timeline-line" />}
            </div>

            {/* ── Content ── */}
            <div className="erp-timeline-content">
              {/* Meta: actor + time */}
              <div className="erp-timeline-meta">
                {item.actor && (
                  <span className="erp-timeline-actor">{item.actor}</span>
                )}
                <time className="erp-timeline-time">{item.timestamp}</time>
              </div>

              {/* Body */}
              <div className="erp-timeline-body">{item.content}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
