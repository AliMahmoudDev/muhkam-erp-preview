import { C, FONT } from '../types';
import type { Stats } from '../types';
import type { CoMutate } from './types';

export function ExpiringAlert({
  stats,
  coMutate,
}: {
  stats: Stats;
  coMutate: CoMutate;
}) {
  if (stats.expiringSoon <= 0) return null;

  return (
    <div style={{
      background: 'rgba(239,68,68,0.06)',
      border: '1.5px solid rgba(239,68,68,0.3)',
      borderRadius: '16px',
      padding: '18px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <span style={{ fontWeight: 800, color: C.danger, fontSize: '15px' }}>
          {stats.expiringSoon} شركة اشتراكها ينتهي خلال 7 أيام
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {stats.expiringSoonList.map(c => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.card, borderRadius: '10px', padding: '10px 16px',
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: c.days_left <= 2 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)',
                color: c.days_left <= 2 ? C.danger : C.warning,
                borderRadius: '8px', padding: '3px 10px',
                fontSize: '13px', fontWeight: 700,
              }}>
                {c.days_left === 0 ? 'ينتهي اليوم' : `${c.days_left} يوم`}
              </span>
              <span style={{ fontSize: '13px', color: C.text, fontWeight: 600 }}>{c.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: C.muted }}>{c.end_date}</span>
              <button
                onClick={() => coMutate.mutate({
                  url: `/api/super/companies/${c.id}/extend`,
                  body: { days: 30, plan_type: c.plan_type },
                })}
                style={{
                  padding: '5px 12px', borderRadius: '8px',
                  border: '1px solid rgba(249,115,22,0.4)',
                  background: 'rgba(249,115,22,0.1)',
                  color: C.warning, fontSize: '12px',
                  fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                ⏳ تمديد 30 يوم
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
