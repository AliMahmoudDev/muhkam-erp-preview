---
name: ERP shell page migration convention
description: How to migrate erp-system pages onto the shared PageHeader/SettingsPattern shell during the multi-phase UI-consistency effort.
---

# Phase 1 "Unified ERP Shell + Header Band" convention

The rule for migrating an erp-system page onto the shared shell:
- Page **actions** (primary/secondary buttons) → `PageHeader` `actionsSlot`.
- Page-level **module tabs** → `PageHeader` `tabsSlot` (remove any standalone `erp-tab-bar` duplicate).
- **Filter pills / sub-filters** stay as an ordinary row BELOW the header. When a bordered pill group was previously sized by a flex parent (e.g. parent flex with `mr-auto` on actions), add `w-fit` so the block stays content-width as a standalone child.
- `PageHeader` renders ONLY `actionsSlot` + `tabsSlot`; its `title`/`subtitle` props are accepted but NOT rendered (the topbar derives the page title from the route via NAV_ITEMS). Passing `title=` is harmless/self-documenting.
- Settings-style pages → shared `SettingsPattern` (`navSlot` desktop sticky 220px nav, `mobileTabSlot` in-flow horizontal strip, `contentSlot`). Do NOT re-add the app shell's padding — `layout.tsx` content area is the `overflow-y-auto` scroll container with its own padding, and the sticky nav anchors to it. The old bespoke settings layout used a full-bleed `h-[calc(100vh-64px)]` internal-scroll container; the shared pattern flows/scrolls like every other page instead.

**Why:** the transformation's philosophy is improve SHARED components, reuse everywhere, delete duplicated layouts/headers/tabs — not restyle per page. Button class unification is explicitly OUT of scope; keep each page's existing `btn-primary`/`erp-btn` classes when relocating them.

**How to apply:**
- Already-consistent + TESTED pages are the regression boundary — do NOT touch: `sales.tsx`, `inventory.tsx`, `customers.tsx`, `income.tsx` (income is the canonical PageHeader+actionsSlot reference).
- Pages migrated in Phase 1: `products.tsx`, `accounts.tsx`, `journal-entries.tsx`, `settings/index.tsx` (these have no dedicated tests — rely on tsc + eslint + HMR + the 286-test suite as the safety net).
- HARD rules every phase: never touch business logic/APIs/DB/permissions/calculations/auth; preserve all Arabic text, `aria-label`s, `data-testid`s; never weaken/skip tests or disable lint.
- The `screenshot` app_preview tool runs an UNAUTHENTICATED browser context, so `/settings` etc. redirect to the public landing page — it can't visually verify in-app authed views. Verify via tsc/eslint/tests/HMR instead.
