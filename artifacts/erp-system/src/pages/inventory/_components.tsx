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
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px whitespace-nowrap ${
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
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors -mb-px whitespace-nowrap ${
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
  onClick,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  onClick?: () => void;
  hint?: string;
}) {
  const isClickable = !!onClick;
  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
      title={hint}
      className={`rounded-2xl p-4 border ${bg} flex items-center gap-3 transition-all ${
        isClickable
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.35)] hover:brightness-110 select-none'
          : ''
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white/40 text-xs">{label}</p>
        <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
        {isClickable && hint && (
          <p className="text-white/25 text-[10px] mt-0.5 truncate">{hint}</p>
        )}
      </div>
      {isClickable && (
        <svg className="w-3.5 h-3.5 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  );
}
