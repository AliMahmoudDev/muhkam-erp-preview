---
name: V3 Design Token Architecture
description: Dual CSS token system in erp-system — Tailwind semantic tokens for shadcn/ui + ERP-specific tokens; V3 source file location and brand values.
---

## Rule
`src/styles/muhkam-theme-v3.css` is the single source of truth for all `--erp-*` tokens. Never define them again in `index.css` or component files. Import this file near the top of `index.css`.

**Why:** The previous pattern scattered token definitions in `index.css` at line ~1645 (":root + html.light block labeled FINAL DESIGN PASS v4"), causing duplicates and drift. V3 consolidates them.

## How to apply
- Dark mode: `:root, html, html.dark { --erp-brand: #C48A31; ... }`
- Light mode: `html.light { --erp-brand: #B87924; ... }`
- `--erp-accent` is a legacy alias for `--erp-brand` (kept for backward compatibility with index.css rules)

## Dual-token coexistence
- **Tailwind semantic** (`--background`, `--primary`, `--card`, `--border`, `--ring`, etc.) — consumed by shadcn/ui components (button, card, dialog, select). Defined in `:root` block in `index.css` as HSL values.
- **ERP design tokens** (`--erp-brand`, `--erp-text-1`, `--erp-bg-sidebar`, `--erp-border-md`, etc.) — consumed by ERP-specific components: layout.tsx, theme-toggle.tsx, glass-input, stat cards, etc.

## Key token values
- Brand dark: `#C48A31` (warm refined gold, NOT purple/violet)
- Brand light: `#B87924` (deeper gold for light backgrounds)
- `--erp-brand-dim`: `rgba(196,138,49,0.55)` dark / `rgba(184,121,36,0.65)` light — for icons at reduced opacity
- `--erp-brand-muted`: background wash for brand-tinted containers
- `--erp-brand-border`: border color for brand-tinted containers
- `--erp-focus-border` + `--erp-focus-shadow`: used by `.erp-input:focus-visible` and `.glass-input:focus`

## Layout.tsx pattern
Computed JS color vars (sidebarBg, topbarBg, textPrimary, etc.) all reference CSS vars: `'var(--erp-bg-sidebar)'` etc. The `isDark` boolean is still present for edge cases (native `<option>` bg, MobileNav prop, TopbarSearch iconColor/inputColor) — those cannot use CSS vars.
