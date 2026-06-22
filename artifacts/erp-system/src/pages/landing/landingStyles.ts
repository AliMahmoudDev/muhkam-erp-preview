/**
 * Landing page CSS — v4 redesign.
 * Philosophy: Premium · Quiet · Confident · Timeless.
 * One accent (#6366F1). Dark neutrals. No gradients. No glow.
 */

export const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* ── Keyframes ── */
@keyframes v4-up {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: none; }
}
@keyframes v4-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Scroll reveal ── */
.v4-reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity .65s cubic-bezier(.16,1,.3,1), transform .65s cubic-bezier(.16,1,.3,1);
}
.v4-reveal.v4-in { opacity: 1; transform: none; }
.v4-d1 { transition-delay: .05s }
.v4-d2 { transition-delay: .10s }
.v4-d3 { transition-delay: .15s }
.v4-d4 { transition-delay: .20s }
.v4-d5 { transition-delay: .25s }
.v4-d6 { transition-delay: .30s }

/* ── Navigation links ── */
.v4-nav-link {
  color: #52525B;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color .15s ease;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  padding: 0;
}
.v4-nav-link:hover { color: #F8F8FA; }

/* ── Buttons ── */
.v4-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 28px;
  height: 46px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: #6366F1;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  transition: background .15s ease, transform .05s ease;
  text-decoration: none;
}
.v4-btn-primary:hover  { background: #4F46E5; }
.v4-btn-primary:active { transform: scale(0.99); }
.v4-btn-primary:disabled { opacity: .45; cursor: not-allowed; }

.v4-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 22px;
  height: 46px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  color: #71717A;
  border: 1px solid #27272A;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  transition: color .15s ease, border-color .15s ease;
  text-decoration: none;
}
.v4-btn-ghost:hover { color: #F8F8FA; border-color: #3F3F46; }

/* ── Feature cards ── */
.v4-feat-card {
  transition: border-color .2s ease, transform .2s ease;
  cursor: default;
}
.v4-feat-card:hover {
  border-color: rgba(99, 102, 241, 0.5) !important;
  transform: translateY(-2px);
}

/* ── Preview frame shadow ── */
.v4-preview-frame {
  box-shadow: 0 32px 96px rgba(0, 0, 0, 0.5), 0 0 0 1px #1C1C21;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .v4-nav-links, .v4-nav-btns { display: none !important; }
  .v4-hamburger { display: flex !important; }
  .v4-hero-title { font-size: clamp(44px, 12vw, 72px) !important; }
  .v4-features-grid { grid-template-columns: 1fr !important; }
  .v4-trust-grid { grid-template-columns: 1fr 1fr !important; }
  .v4-trust-divider { display: none !important; }
  .v4-preview-grid { grid-template-columns: 1fr !important; }
  .v4-footer-inner { flex-direction: column !important; align-items: flex-end !important; gap: 20px !important; }
  .v4-hero-cta { flex-direction: column !important; align-items: stretch !important; }
  .v4-hero-cta .v4-btn-primary,
  .v4-hero-cta .v4-btn-ghost { width: 100%; justify-content: center; }
}
@media (min-width: 769px) { .v4-hamburger { display: none !important; } }
`;

export const mono: React.CSSProperties = {
  fontFamily: "'Tajawal', system-ui, sans-serif",
};

export const cardSurface: React.CSSProperties = {
  background: '#111115',
  border: '1px solid #1C1C21',
  borderRadius: 12,
};
