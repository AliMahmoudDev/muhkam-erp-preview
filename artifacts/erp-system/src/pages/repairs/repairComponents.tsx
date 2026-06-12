import { AlertCircle } from 'lucide-react';
import { STATUS_MAP } from './repairConstants';

/* ── ScoreRing component ── */
export function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform="rotate(-90 36 36)" style={{ transition: 'stroke-dasharray 0.5s' }} />
        <text x="36" y="40" textAnchor="middle" fill="white" fontSize="14" fontWeight="900">{score}%</text>
      </svg>
      <span className="text-[10px] text-ink/40">حالة الجهاز</span>
    </div>
  );
}

/* ── StatusBadge component ── */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: 'text-ink/60', bg: 'bg-surface border-line', icon: AlertCircle };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${s.color} ${s.bg}`}>
      <Icon className="w-2.5 h-2.5" />
      {s.label}
    </span>
  );
}
