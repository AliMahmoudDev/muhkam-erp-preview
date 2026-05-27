/* ══════════════════════════════════════════════════
   BADGES
══════════════════════════════════════════════════ */

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ display:'inline-flex', padding:'2px 9px', borderRadius:6, fontSize:11, fontWeight:700, background:bg, color }}>{label}</span>;
}

export function AttBadge({ s }: { s: string }) {
  const M: Record<string, [string, string, string]> = {
    present:  ['حاضر',         '#34d399', 'rgba(52,211,153,0.13)'],
    absent:   ['غائب',         '#f87171', 'rgba(248,113,113,0.13)'],
    late:     ['متأخر',        '#fbbf24', 'rgba(251,191,36,0.13)'],
    on_leave: ['إجازة',        '#60a5fa', 'rgba(96,165,250,0.13)'],
    holiday:  ['إجازة رسمية', '#a78bfa', 'rgba(167,139,250,0.13)'],
    half_day: ['نصف يوم',     '#fb923c', 'rgba(251,146,60,0.13)'],
  };
  const [label, color, bg] = M[s] ?? [s||'—', '#94a3b8', 'rgba(148,163,184,0.1)'];
  return <Badge label={label} color={color} bg={bg} />;
}

export function StatusBadge({ s, map }: { s: string; map: Record<string, [string, string, string]> }) {
  const [label, color, bg] = map[s] ?? [s, '#94a3b8', 'rgba(148,163,184,0.1)'];
  return <Badge label={label} color={color} bg={bg} />;
}
