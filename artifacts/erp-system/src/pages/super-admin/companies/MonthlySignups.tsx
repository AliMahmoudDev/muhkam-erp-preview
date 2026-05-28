import { C } from '../types';
import type { Stats } from '../types';

export function MonthlySignups({ stats }: { stats: Stats }) {
  if (!stats.monthlySignups || !stats.monthlySignups.some(m => m.count > 0)) return null;

  const raw = stats.monthlySignups;
  const total = raw.reduce((s, m) => s + m.count, 0);
  const last = raw[raw.length - 1]?.count ?? 0;
  const prev = raw[raw.length - 2]?.count ?? 0;
  const growthPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
  const growing = growthPct >= 0;
  const maxVal = Math.max(...raw.map(m => m.count), 1);

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '16px', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: '20px',
    }}>
      <div style={{ flexShrink: 0, borderLeft: `3px solid ${C.orange}`, paddingLeft: '14px' }}>
        <div style={{ fontSize: '11px', color: C.muted, marginBottom: '4px', whiteSpace: 'nowrap' }}>
          التسجيلات — آخر 6 أشهر
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: C.orange, lineHeight: 1 }}>
            {total}
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 700,
            padding: '2px 8px', borderRadius: '20px',
            background: growing ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: growing ? C.success : C.danger,
            border: `1px solid ${growing ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {growing ? '↑' : '↓'}{Math.abs(growthPct)}%
          </span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        {raw.map((m, i) => {
          const pct = maxVal > 0 ? m.count / maxVal : 0;
          const isLast = i === raw.length - 1;
          const barH = Math.max(pct * 36, m.count > 0 ? 4 : 2);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                fontSize: '13px', fontWeight: isLast ? 900 : 600,
                color: isLast ? C.orange : m.count > 0 ? C.text : C.muted,
              }}>{m.count || '—'}</div>
              <div style={{
                width: '100%', height: `${barH}px`, borderRadius: '4px',
                background: isLast
                  ? `linear-gradient(to top, ${C.orange}, ${C.warning})`
                  : m.count > 0 ? `rgba(249,115,22,${0.2 + pct * 0.5})` : C.border,
              }} />
              <div style={{
                fontSize: '10px', color: isLast ? C.orange : C.muted,
                fontWeight: isLast ? 700 : 400, whiteSpace: 'nowrap',
              }}>{m.month}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
