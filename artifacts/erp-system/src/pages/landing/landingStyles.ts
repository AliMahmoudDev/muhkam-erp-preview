/**
 * Landing page CSS injected at runtime.
 * Extracted from LandingPage.tsx for maintainability.
 */
export const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

@keyframes lp-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes lp-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes lp-bar-grow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes lp-count-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.lp-fade { opacity: 0; transform: translateY(16px); transition: opacity .55s ease, transform .55s ease; }
.lp-fade.lp-in { opacity: 1; transform: none; }
.lp-d1 { transition-delay: .04s } .lp-d2 { transition-delay: .09s } .lp-d3 { transition-delay: .14s }
.lp-d4 { transition-delay: .19s } .lp-d5 { transition-delay: .24s } .lp-d6 { transition-delay: .29s }

.lp-card {
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.lp-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.35) !important;
  box-shadow: 0 4px 24px rgba(59, 130, 246, 0.08), 0 1px 3px rgba(0,0,0,0.3);
}

.lp-bar { transform-origin: bottom; animation: lp-bar-grow 1s cubic-bezier(.34,1.56,.64,1) both; animation-play-state: paused; }
.lp-chart-live .lp-bar { animation-play-state: running; }

.lp-stat-num { display: inline-block; animation: lp-count-in .5s ease both; animation-play-state: paused; }
.lp-stats-live .lp-stat-num { animation-play-state: running; }

.lp-link {
  color: #94A3B8; transition: color .15s ease;
  text-decoration: none; cursor: pointer;
}
.lp-link:hover { color: #F8FAFC; }

.lp-btn-primary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer;
  background: #2563EB; color: #FFFFFF;
  font-size: 14px; font-weight: 600; font-family: inherit;
  transition: background .15s ease, transform .05s ease;
}
.lp-btn-primary:hover { background: #1D4ED8; }
.lp-btn-primary:active { transform: scale(0.985); }

.lp-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 24px; border-radius: 8px; cursor: pointer;
  background: transparent; color: #E2E8F0;
  border: 1px solid #334155;
  font-size: 14px; font-weight: 600; font-family: inherit;
  transition: background .15s ease, border-color .15s ease;
}
.lp-btn-secondary:hover { background: #1E293B; border-color: #475569; }

@media (max-width: 900px) {
  .lp-nav-links, .lp-nav-btns { display: none !important; }
  .lp-hamburger { display: flex !important; }
  .lp-grid-2, .lp-grid-3, .lp-grid-4 { grid-template-columns: 1fr !important; }
  .lp-bento { grid-template-columns: 1fr !important; }
  .lp-bento .lp-wide, .lp-bento .lp-full { grid-column: span 1 !important; }
  .lp-spotlight { grid-template-columns: 1fr !important; }
  .lp-hero-mockup { display: none !important; }
}
@media (min-width: 901px) { .lp-hamburger { display: none !important; } }
`;

/** Shared style: font family */
export const mono: React.CSSProperties = { fontFamily: "'Tajawal', system-ui, sans-serif" };

/** Shared style: card surface */
export const cardSurface: React.CSSProperties = {
  background: '#0F172A',
  border: '1px solid #1E293B',
  borderRadius: 12,
};
