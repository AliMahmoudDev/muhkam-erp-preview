import { Badge } from '@/components/ui/badge';
import type { Tab } from './_shared';

export function TabBtn({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  active: Tab;
  onClick: (t: Tab) => void;
}) {
  const isActive = id === active;
  return (
    <button
      onClick={() => onClick(id)}
      className={`erp-tab${isActive ? ' erp-tab--active' : ''}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function TabBtnBadge({
  id,
  label,
  icon,
  badge,
  active,
  onClick,
}: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  badge: number;
  active: Tab;
  onClick: (t: Tab) => void;
}) {
  const isActive = id === active;
  return (
    <button
      onClick={() => onClick(id)}
      className={`erp-tab${isActive ? ' erp-tab--active' : ''}`}
    >
      {icon}
      {label}
      {badge > 0 && (
        <Badge variant="count">{badge}</Badge>
      )}
    </button>
  );
}
