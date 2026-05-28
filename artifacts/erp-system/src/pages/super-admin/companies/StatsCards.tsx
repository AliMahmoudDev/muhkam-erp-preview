import { AnimatedNumber } from '../ui';
import { C } from '../types';
import type { StatCard, ActiveTab } from './types';

export function StatsCards({
  statCards,
  setActiveTab,
  setStatusFilter,
}: {
  statCards: StatCard[];
  setActiveTab: (t: ActiveTab) => void;
  setStatusFilter: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        gap: '12px',
        marginBottom: '28px',
      }}
    >
      {statCards.map((s) => (
        <div
          key={s.label}
          onClick={() => {
            setActiveTab(s.tab);
            if (s.filter !== null && s.tab === 'companies') setStatusFilter(s.filter);
            setTimeout(() => {
              document.getElementById('companies-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }}
          style={{
            background: C.card,
            borderRadius: '14px',
            border: `1px solid ${C.border}`,
            borderTop: `3px solid ${s.color}`,
            padding: '16px 10px 14px',
            textAlign: 'center',
            transition: 'all 0.2s',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}30`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{
            position: 'absolute', top: '-10px', right: '-10px',
            width: '50px', height: '50px', borderRadius: '50%',
            background: `${s.color}18`, pointerEvents: 'none',
          }} />
          <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>
            <AnimatedNumber target={s.value} />
          </div>
          <div style={{ fontSize: '11px', color: C.text, marginTop: '6px', fontWeight: 700, lineHeight: 1.3 }}>
            {s.label}
          </div>
          <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px' }}>{s.sub}</div>
          <div style={{
            position: 'absolute', bottom: '6px', left: '8px',
            fontSize: '10px', color: s.color, opacity: 0.6,
          }}>↗</div>
        </div>
      ))}
    </div>
  );
}
