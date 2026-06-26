---
name: glass-input / erp-input unification
description: Legacy glass-* input/surface classes must mirror canonical erp-* and use accent tokens, never hardcoded brand colors.
---

# glass-input ↔ erp-input unification

Legacy `.glass-input` (used on ~29 pages, incl. 3 with `<textarea class="glass-input">`)
must visually mirror the canonical `.erp-input`, and its focus MUST use
`var(--focus-edge)` / `var(--focus-ring)` — never a hardcoded color.

**Why:** This app has a user-configurable accent color; `--focus-edge`/`--focus-ring`
derive from `var(--color-accent)` (see `styles/tokens.css`). A hardcoded amber focus
(the old value `rgba(245,158,11,...)`) silently ignored the user's accent, so legacy
inputs looked different from token-driven ones and didn't respond to branding changes.

**How to apply:**
- Edit the canonical `.glass-input` block in `index.css` (the `!important` one under the
  Arabic "يحل كل التضارب السابق" banner). It wins the cascade via `!important`.
- Match `.erp-input` for border (1px), background, placeholder, and tokenized focus.
- Do NOT set height/padding/font-size on `.glass-input` — textareas use it and a fixed
  height would clip them. Box model is left alone on purpose.
- Light mode: add `box-shadow: none !important` in the final `html.light .glass-input`
  block to neutralize a stale earlier `html.light .glass-input` shadow (index.css ~2007).

**Known leftover (non-blocking):** stale hardcoded amber `.glass-input:focus-visible`
rules still exist earlier in `index.css` (~1389, ~2763). They're overridden by the later
`.glass-input:focus` `!important` rule, but should be cleaned if touching that area again.

**Caveat:** `index.css` (~6.9k lines) has MANY scattered, cascade-dependent, `!important`
definitions of the same class, with explicit "CANONICAL" banner comments marking the
winning block. Prefer surgical edits to the canonical block over broad rewrites.
