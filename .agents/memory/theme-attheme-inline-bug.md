---
name: Theme @theme inline bug
description: How Tailwind v4 @theme inline caused bg-canvas to always be dark, and the correct fix pattern.
---

## The Bug

In Tailwind v4, `@theme inline { --color-X: <value> }` does NOT create a CSS custom property — it **inlines the value** directly into generated utilities. So:

```css
@theme inline {
  --color-canvas: var(--primitive-slate-dark-3, #14141F);
}
```

Generates: `.bg-canvas { background-color: var(--primitive-slate-dark-3, #14141F) }` — always dark, never switches with `html.light`.

## The Fix

Reference CSS variables that are themselves switchable (defined with `html.light` overrides in tokens.css):

```css
@theme inline {
  --color-canvas: var(--bg-app);      /* → --color-canvas in tokens.css, switches */
  --color-surface: var(--bg-surface); /* → --color-surface-0, switches */
  --color-raised: var(--bg-elevated); /* → --color-surface-1, switches */
}
```

**Why:** The @theme inline value IS inlined into utilities, but if it's a `var(--something)` that references a real CSS variable (from tokens.css), the browser resolves it at runtime using the live CSS custom property value — which respects `html.light` overrides.

**How to apply:** Whenever adding a new semantic token to `@theme inline`, NEVER reference primitive tokens directly (`--primitive-slate-dark-X`). Always reference the backward-compat alias (`--bg-*`, `--text-*`, etc.) from `tokens.css` which properly switches.

## Safety Net

Also add explicit `html.light .bg-canvas`, `html.light .bg-surface`, `html.light .bg-raised` overrides in `index.css` as a CSS-level fallback in case the variable chain is ambiguous.

## Backward Compat Aliases (tokens.css)

These are defined in `:root, html, html.dark {}` and reference `--color-*` tokens that switch in `html.light`:
- `--bg-app → var(--color-canvas)` — page background
- `--bg-surface → var(--color-surface-0)` — card/panel surface
- `--bg-elevated → var(--color-surface-1)` — elevated surfaces
