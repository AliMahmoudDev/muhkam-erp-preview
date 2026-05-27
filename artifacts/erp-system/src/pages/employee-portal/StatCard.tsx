/* ══════════════════════════════════════════════════
   STAT CARD
══════════════════════════════════════════════════ */

export function StatCard({ label, value, icon, color, bg }: { label: string; value: string|number; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{ borderRadius:12, padding:'12px 16px', background:bg, display:'flex', flexDirection:'column', gap:6, flex:1, minWidth:110 }}>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ color, opacity:0.8 }}>{icon}</span>
        <span style={{ fontSize:11, color, fontWeight:600, opacity:0.8 }}>{label}</span>
      </div>
      <span style={{ fontSize:26, fontWeight:900, color, fontVariantNumeric:'tabular-nums' }}>{value}</span>
    </div>
  );
}
