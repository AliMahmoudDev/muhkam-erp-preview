---
name: Token Design System
description: 4-layer ERP design token system — naming constraints, cascade order, migration commands.
---

## Architecture (4 layers)

1. **tokens.css** — `artifacts/erp-system/src/styles/tokens.css` — single source of truth for all CSS variables
2. **`@theme inline`** in `index.css` — maps tokens → Tailwind utility classes
3. **codemod** — `artifacts/erp-system/scripts/codemod-tokens.mjs` — one-time migration script (idempotent)
4. **ESLint rule** — `erp/no-hardcoded-colors` in `eslint.config.js` — prevents regressions

## Critical naming decision: `--edge-*` NOT `--border-*`

shadcn/ui's `index.css :root` block defines `--border: 220 13% 82%` (HSL channels, not a color value).
The `@import './styles/tokens.css'` resolves BEFORE the inline `:root` block (CSS import order), so the
inline `:root` OVERWRITES tokens.css. Using `--border` for our rgba border token causes cascade conflict.

**Fix:** Use `--edge`, `--edge-md`, `--edge-strong` for border tokens.
In Tailwind `@theme inline`: `--color-line: var(--edge)` → enables `border-line` utility class.

## Legacy `--erp-*` aliases

All existing components use `var(--erp-brand)`, `var(--erp-text-1)`, etc.
These are kept as forwarding aliases in tokens.css (dark + light sections) pointing to the new primary tokens.
Do NOT remove them until all components are migrated.

## Codemod results (migration complete)

- 5,263 replacements across 211 files
- text-white → text-ink: 3,353 replacements → **0 residual**
- bg-white/* → bg-surface/bg-raised: 887 replacements → **0 residual**
- border-white/* → border-line: 1,023 replacements → **0 residual**
- Hex colors in style props: 17 inline-style replacements

## CSS dead code removed

Deleted ~268 lines from `index.css`: `html.light .text-white/*`, `html.light .bg-white/*`,
`html.light .hover:bg-white/*`, `html.light .hover:text-white/*`, `html.light .group-hover:text-white/*`
override ladders — all dead after codemod. Semantic color overrides (amber/emerald/red) were kept.

## Codemod regex note

`border-white/[0.xx]` bracket notation requires lookahead instead of trailing `\b` (since `]` is non-word):
```js
/\b((?:[a-z-]+:)*)border-white\/(\[[\d.]+\]|\d+)(?=[\s"'`\]|,;)}]|$)/g
```

**Why:** `\b` after `]` doesn't match (both sides are non-word chars → no boundary).

## Tokens available as Tailwind classes

`bg-app`, `bg-surface`, `bg-raised`, `text-ink`, `text-ink-2`, `text-ink-3`, `border-line`,
`text-brand`, `text-success`, `text-warning`, `text-danger`, `text-info`
