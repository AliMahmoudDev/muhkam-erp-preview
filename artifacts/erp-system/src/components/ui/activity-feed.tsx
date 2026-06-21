/**
 * ActivityFeed — grouped activity list.
 *
 * No data fetching. Caller supplies pre-loaded, pre-grouped items.
 * Groups are typically date-based ("اليوم", "أمس", "١٤ يونيو").
 *
 * Each item records: entity · action verb · user · time.
 */
import * as React from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActivityItem {
  id: string;
  /** Entity type/name (e.g. "فاتورة #1042", "عميل: محمد"). Optional. */
  entity?: string;
  /** Verb in Arabic (e.g. "أنشأ", "حدّث", "حذف", "أرسل"). */
  action: string;
  /** User who performed the action. Optional (system actions have none). */
  user?: string;
  /** Pre-formatted time string (e.g. "١٠:٣٢ ص"). */
  time: string;
  /** Icon component for this specific activity type. */
  icon?: React.ElementType;
}

export interface ActivityGroup {
  /** Pre-formatted group heading (e.g. "اليوم", "أمس", "١٤ يونيو ٢٠٢٦"). */
  date: string;
  items: ActivityItem[];
}

export interface ActivityFeedProps {
  groups: ActivityGroup[];
  /** Shown when groups is empty. */
  emptySlot?: React.ReactNode;
  className?: string;
}

export function ActivityFeed({
  groups,
  emptySlot,
  className,
}: ActivityFeedProps) {
  if (groups.length === 0) {
    return (
      <div className={cn('erp-activity-feed', className)}>
        {emptySlot ?? (
          <p className="erp-activity-empty">لا يوجد نشاط حتى الآن.</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('erp-activity-feed', className)}
      aria-label="سجل النشاط"
    >
      {groups.map((group) => (
        <div key={group.date} className="erp-activity-group">
          {/* Group date header */}
          <div
            className="erp-activity-group-label"
            aria-label={`النشاط: ${group.date}`}
          >
            {group.date}
          </div>

          {/* Items */}
          <ul className="erp-activity-list">
            {group.items.map((item) => {
              const Icon = item.icon ?? Activity;

              return (
                <li key={item.id} className="erp-activity-item">
                  {/* Icon */}
                  <div
                    className="erp-activity-item-icon"
                    aria-hidden="true"
                  >
                    <Icon />
                  </div>

                  {/* Text */}
                  <div className="erp-activity-item-body">
                    <p className="erp-activity-item-text">
                      {item.user && (
                        <span className="erp-activity-item-user">
                          {item.user}
                        </span>
                      )}
                      <span className="erp-activity-item-action">
                        {item.action}
                      </span>
                      {item.entity && (
                        <span className="erp-activity-item-entity">
                          {item.entity}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Time */}
                  <time className="erp-activity-item-time">{item.time}</time>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
