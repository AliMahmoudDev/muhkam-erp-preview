import { type LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  msg?: string;
  height?: number;
  icon?: LucideIcon;
  headline?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  msg,
  height = 160,
  icon: Icon = Inbox,
  headline,
  description,
  action,
}: EmptyStateProps) {
  const hasRichContent = headline || description || action;

  if (hasRichContent) {
    return (
      <div className="erp-empty-state erp-empty-state--rich" style={{ minHeight: height }}>
        <div className="erp-empty-icon">
          <Icon style={{ width: 24, height: 24 }} />
        </div>
        {headline && <p className="erp-empty-headline">{headline}</p>}
        {(description || msg) && (
          <p className="erp-empty-label">{description ?? msg}</p>
        )}
        {action && <div className="erp-empty-action">{action}</div>}
      </div>
    );
  }

  return (
    <div className="erp-empty-state" style={{ height }}>
      <div className="erp-empty-icon">
        <Icon style={{ width: 22, height: 22 }} />
      </div>
      <p className="erp-empty-label">{msg}</p>
    </div>
  );
}
