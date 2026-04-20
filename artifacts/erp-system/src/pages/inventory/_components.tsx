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
      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px ${
        isActive
          ? 'border-violet-400 text-violet-300'
          : 'border-transparent text-white/50 hover:text-white/80'
      }`}
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
      className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px ${
        isActive
          ? 'border-amber-400 text-amber-300'
          : 'border-transparent text-white/50 hover:text-white/80'
      }`}
    >
      {icon}
      {label}
      {badge > 0 && (
        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 min-w-[1.25rem] text-center">
          {badge}
        </span>
      )}
    </button>
  );
}

export function StatCard({
  label,
  value,
  icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${bg} flex items-center gap-3`}>
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-white/40 text-xs">{label}</p>
        <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
      </div>
    </div>
  );
}
