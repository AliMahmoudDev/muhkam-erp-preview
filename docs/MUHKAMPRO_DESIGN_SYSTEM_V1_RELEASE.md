# MUHKAMPRO Design System V1 — Release Document

> **Release stage:** Sprint 20 — Documentation & Commit  
> **Scope:** Frontend only (`artifacts/erp-system`)  
> **Sprints covered:** Sprint 01 → Sprint 19  
> **Date:** June 2026

---

## Release Goal

Establish a stable, documented, production-ready design system for MUHKAMPRO ERP that:

- Replaces all legacy glassmorphism, amber, purple, and random-gradient styling with a coherent dark workspace aesthetic.
- Provides RTL-first Arabic typography, spacing, and component conventions.
- Delivers consistent dark/light mode support across every page, form, table, modal, and print output.
- Passes typecheck, lint, and production build with zero errors.

---

## Design Principles

| Principle | Statement |
|-----------|-----------|
| **RTL-first** | The entire system targets Arabic RTL. LTR is not a design target. `dir="rtl"` is set on `<html>`. Tailwind physical utilities (`left/right/pl/pr`) are used intentionally, not as direction-logical mistakes. |
| **Flat dark workspace** | No glow, no glass, no random gradients. Surfaces are flat semi-transparent fills over a deep teal-tinted background. |
| **Token-driven** | Every color, shadow, spacing, and typographic value must resolve to a CSS custom property defined in `tokens.css`. Hardcoded hex or `rgb()` values in component code are a bug. |
| **One component, one style** | Each component class lives in one canonical file. No duplicate styling across multiple CSS files. |
| **Print-safe** | Print output (thermal receipt, A4 PDF) is tested separately. No emojis, no profit data, no hardcoded brand names in customer-facing output. |
| **Light mode parity** | Every dark-mode rule has a `html.light` counterpart. Light mode is not an afterthought. |

---

## Color Direction

### Brand

| Token | Value | Usage |
|-------|-------|-------|
| `--brand` | `#2DD4BF` | Primary CTA, active nav, focus rings, progress |
| `--brand-hover` | `#5EEAD4` | Hover state for brand elements |
| `--brand-dim` | `rgba(45,212,191,0.45)` | Icon fills, decorative accents |
| `--brand-muted` | `rgba(45,212,191,0.10)` | Active nav background |
| `--brand-border` | `rgba(45,212,191,0.22)` | Focused input borders |

**Rejected colors (do not reintroduce):** amber, purple, cyan-500, indigo, violet. All replaced by Sprint 15.

### Surfaces (Dark Mode)

| Token | Value | Role |
|-------|-------|------|
| `--bg-app` | `#0B1110` | Page root background |
| `--bg-surface` | `#111A18` | Cards, panels, modals |
| `--bg-surface-alt` | `#17211F` | Elevated nested surfaces |
| `--bg-sidebar` | `#0E1715` | Sidebar background |
| `--bg-topbar` | `rgba(11,17,16,0.92)` | Topbar (blur backdrop) |
| `--bg-input` | `rgba(255,255,255,0.05)` | Input fields |

### Surfaces (Light Mode)

Light mode overrides are declared under `html.light { … }` in `tokens.css`. Key overrides:

| Token (light) | Value |
|--------------|-------|
| `--bg-app` | `#F8FAFC` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-sidebar` | `#F1F5F9` |

### Text Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--text-1` | `#F8FAFC` | Headings, primary labels |
| `--text-2` | `#CBD5E1` | Body text, descriptions |
| `--text-3` | `#94A3B8` | Secondary labels, metadata |
| `--text-4` | `#64748B` | Disabled, placeholder |
| `--text-hint` | `rgba(255,255,255,0.32)` | Hint text in inputs |

### Status Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--status-success` | `#34D399` | Paid, completed, in-stock |
| `--status-warning` | `#FBBF24` | Partial, pending, expiring |
| `--status-danger` | `#F87171` | Overdue, cancelled, error |
| `--status-info` | `#60A5FA` | Info badges, links |
| `--status-external-repair` | `#D8B4FE` | External repair jobs |
| `--status-urgent` | `#F97316` | Urgent flags |

### Borders

| Token | Value |
|-------|-------|
| `--edge` | `rgba(255,255,255,0.08)` |
| `--edge-md` | `rgba(255,255,255,0.13)` |
| `--edge-strong` | `rgba(255,255,255,0.18)` |

---

## Typography Direction

**Primary font:** Cairo (`'Cairo', 'Tajawal', sans-serif`) — loaded via Google Fonts with Arabic + Latin subsets.  
**Fallback font:** Tajawal — used for loading screens and subscription-expired page.

### Scale (defined in `styles/typography.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | `12px` | Badges, labels, metadata |
| `--text-sm` | `13px` | Table rows, secondary text |
| `--text-md` | `14px` | Body default |
| `--text-lg` | `16px` | Section headers |
| `--text-xl` | `20px` | Page titles |
| `--text-2xl` | `24px` | Modal headings |

### Weight Scale

| Token | Value |
|-------|-------|
| `--fw-regular` | 400 |
| `--fw-medium` | 500 |
| `--fw-semibold` | 600 |
| `--fw-bold` | 700 |
| `--fw-black` | 800 |

### Special Utility Classes

| Class | Purpose |
|-------|---------|
| `.font-numeric` / `.tabular-nums` | Financial numbers, invoice totals |
| `.erp-number` | Monospace tabular numbers in tables |
| `.nav-section-label` | Uppercase sidebar section dividers |
| `.erp-divider-label` | Same pattern used in panels |

### RTL Rules

- Arabic numbers in financial columns use `text-left` (physical) intentionally — this is correct alignment for monospace digit columns in RTL tables. This is not a bug.
- `direction: rtl` is set globally. Logical CSS properties (`start/end`) are used in new shadcn primitives (`dialog.tsx`). Physical properties (`left/right`) are used in older components and are correct for this exclusively-RTL app.

---

## Component System Summary

### Style Files (in `styles/components/`)

| File | Covers |
|------|--------|
| `button.css` | `.erp-btn`, `.erp-btn-primary`, `.erp-btn-secondary`, `.erp-btn-sm/md/lg`, `.btn-icon`, `.btn-icon-danger/primary/info/green` |
| `card.css` | `.erp-card`, `.erp-card-lift`, `.erp-card-skeleton` |
| `table.css` | `.erp-table-row`, `.erp-table-td`, `.erp-table-th`, hover states, section rows |
| `form.css` | `.erp-input`, `.erp-label`, `.erp-field`, `.erp-error`, `.erp-help`, `.erp-select`, `.erp-searchable` |
| `badge.css` | `.erp-badge` + status variants |
| `dialog.css` | `.erp-dialog-overlay`, `.erp-dialog-content` |
| `navigation.css` | `.erp-nav-item`, `.erp-nav-icon`, active/hover states |
| `sidebar.css` | Sidebar shell, collapsed state, section dividers |
| `topbar.css` | Topbar height, backdrop blur, user avatar |
| `toolbar.css` | Page-level action toolbars |
| `dashboard.css` | KPI stat cards, chart containers |
| `empty-state.css` | `.erp-empty-state`, `.erp-empty-icon`, `.erp-empty-label`, `.erp-empty-panel` |
| `skeleton.css` | `.erp-skeleton`, shimmer animation |
| `pagination.css` | Page navigation controls |

### Primitive UI Components (in `components/ui/`)

Radix UI + shadcn primitives adapted for the MUHKAMPRO design system:

`badge`, `button`, `card`, `dialog`, `input`, `label`, `select`, `separator`, `sheet`, `skeleton`, `spinner`, `textarea`, `toast`, `toaster`, `toggle`, `tooltip`

All primitives are themed via CSS variables — no hardcoded colors.

### Application Components (selected)

| Component | Notes |
|-----------|-------|
| `EmptyState` | Rich (icon + headline + description + action) and simple variants |
| `ErrorBoundary` | Catches React errors, logs to `/api/health/client-error`, retry button, no emoji |
| `LoadingPage` | Full-screen Suspense fallback with breathing logo + progress bar |
| `OfflineBanner` | Fixed bottom toast: offline / back-online states |
| `SubscriptionBanner` | Expiry warning ribbon in topbar |
| `ThemeToggle` | Dark/light mode toggle stored in `html.light` class |
| `AlertBell` | Smart business alerts (low stock, debt thresholds) |
| `MobileNav` | Bottom navigation bar (mobile); tabs configurable per user via API |
| `PageTransition` | Fade-in animation wrapper for route changes |
| `SearchCommand` | Command palette for global page search (`⌘K`) |
| `PaginationBar` | Shared pagination component |
| `skeletons.tsx` | `TableSkeleton`, `CardSkeleton`, `StatCardSkeleton` |

---

## Layout & Navigation Summary

### Desktop Sidebar

- Collapsible (icon-only when collapsed; full-width when expanded).
- Sections defined in `NAV_SECTIONS` constant in `layout.tsx` — 9 logical groups covering all modules.
- Active route detection via `useLocation` from wouter.
- Brand logo / company logo displayed at top via `resolveUploadedFileUrl`.
- Role-based nav filtering via `canAccess(item, userRole)` from `lib/rbac.ts`.

### Topbar

- Height fixed at `56px`, backdrop blur `20px`.
- Contains: warehouse selector, global search (command palette), alert bell, notification bell, user avatar + role dot, logout.
- Theme toggle in topbar.

### Mobile Navigation

- Fixed bottom bar, `56px` tall, `lg:hidden`.
- Up to 5 configurable tabs saved to `/api/dashboard/mobile-nav` (per-user).
- Hides when the on-screen keyboard is open (detected via `window.visualViewport`).
- Customizer modal for tab reordering.

### Routing

- `wouter` (not React Router). Route definitions in `App.tsx`.
- Protected routes check auth via `useAuth` context.
- Feature gates check subscription via `useSubscription`.

### Navigation IA (Sprint 09)

9 sidebar sections replace the old flat nav:

| Section | Modules |
|---------|---------|
| القائمة | Dashboard |
| المبيعات | POS, Sales, Returns |
| المخزون والمنتجات | Products, Price Lists, Inventory, Transfers |
| الشراء | Purchases, Customers |
| الأجهزة والصيانة | Devices, Repairs |
| المالية | Treasury, Vouchers, Expenses, Income, Reports |
| الموارد البشرية | Employees, Attendance, Payroll |
| المحاسبة | Accounts, Journal Entries, Fiscal Years, Audit Log, Fixed Assets, Accruals, Bank Reconciliation, Budgets, Cost Centers |
| النظام | Settings, Branches, My Portal |

---

## Dashboard IA Summary

### Sprint 08 Dashboard Refactor

- KPI stat cards above the fold: revenue, customers, orders, alerts count.
- Charts (Recharts): daily sales trend, category breakdown.
- Recent sales table with status badges.
- Repairs pipeline section with job counts by status.

### Dashboard Context

- `useAppSettings` context: company name, currency symbol, accent color, font, logo.
- `useWarehouse` context: active warehouse selection persisted across sessions.
- `useSubscription` context: plan type, expiry date, banner/blocking logic.

---

## Reports & Settings IA Summary

### Reports (Sprint 10)

Reports page split into grouped sub-navigation:

| Group | Reports |
|-------|---------|
| المالية | Profit & Loss, Trial Balance, Balance Sheet, VAT |
| المبيعات | Sales Analysis, Customer Aging, Customer Classifications |
| المخزون | Inventory Valuation, Stock Movement |
| المصروفات | Expense Reports |
| الموارد البشرية | Payroll Summary, Attendance |

### Settings (Sprint 11 IA)

Settings organized into logical tab groups:

| Group | Tabs |
|-------|------|
| الشركة | Company Info, Branding, Currency |
| العمليات | Invoice, VAT, Pricing, Advance Settings |
| المالية | Opening Balance, Financial Lock |
| البيانات | Data Management, Backup |
| المستخدمون | Users & Roles |

---

## Auth Polish Summary (Sprint 12)

- Login page: Cairo font, RTL field labels, eye toggle on password, company logo support.
- Access Denied page (`403`): full-screen design system card with ShieldOff icon, role display, home button.
- Not Found page (`404`): SearchX icon, user-facing Arabic copy (no developer messages in production).
- Subscription Expired page: full-screen blocking card with Clock icon, WhatsApp + email contact links, retry + logout actions.
- ErrorBoundary: AlertTriangle icon (replaced emoji), Arabic error message, retry button.
- Loading page: breathing logo animation, Cairo/Tajawal font, teal progress bar.

---

## Print & PDF QA Summary (Sprint 18)

### Issues Found and Fixed

| File | Fix |
|------|-----|
| `printSaleReceipt.ts` | Removed profit/cost columns from customer thermal receipt |
| `_shared.ts` | Removed hardcoded `"هالال تك"` brand name; replaced with dynamic company name |
| `reports-pdf.ts` | Same hardcoded brand removal |
| `printSaleReceipt.ts` | Removed emojis (📞 📍 🙏 📦) |
| `_shared.ts`, `printSaleReceipt.ts`, `reports-pdf.ts`, `invoices-pdf.ts`, `purchases-pdf.ts` | Added Cairo Google Font `@import` for consistent Arabic PDF rendering |
| Print CSS (5 files) | Added `@page { margin: 12mm 14mm; }` for correct print margins |

### Print Rules Established

- No emojis in any print/PDF output.
- No profit, cost_price, or purchase_price in customer-facing output.
- Cairo font must be imported in every file that generates `<style>` blocks for print.
- Brand name must come from `settings.company_name` — never hardcoded.

---

## Responsive QA Summary (Sprint 14)

### Mobile Breakpoints

- `sm:` — 640px+
- `md:` — 768px+
- `lg:` — 1024px+ (desktop sidebar appears, mobile nav hides)

### Overflow Handling

- 50+ files use `overflow-x-auto` wrapping `<table>` elements.
- All data tables have `min-w-[Xpx]` to force horizontal scroll on narrow screens instead of layout collapse.

### Mobile-Specific Patterns

- Modals: `max-h-[90vh] overflow-y-auto` on modal scroll containers.
- Forms: `flex-col` on mobile, `flex-row` on desktop.
- POS cart: full-screen on mobile, split panel on desktop.
- MobileNav hides when keyboard is open.

---

## Production Readiness QA Summary (Sprint 19)

### Issues Found and Fixed

| File | Issue | Fix |
|------|-------|-----|
| `pages/not-found.tsx` | Developer message shown to users | Full redesign with user-facing Arabic copy |
| `components/error-boundary.tsx` | ⚠️ emoji | Replaced with Lucide `AlertTriangle` |
| `pages/subscription-expired.tsx` | ⏰ emoji | Replaced with Lucide `Clock` |
| `components/ui/sheet.tsx` | `sm:text-left` in RTL context | Fixed to `sm:text-right` |
| `components/ui/sheet.tsx` | `sm:space-x-2` (LTR-only spacing) | Replaced with `gap-2` |

### Audit Findings — Intentionally Unchanged

| Pattern | Reason |
|---------|--------|
| `text-left` on financial number columns | Intentional: correct alignment for monospace digits in RTL tables |
| `padding-left` on `.erp-select` arrow | Correct for RTL: dropdown chevron goes on the logical end (left physical) |
| `margin-left` in loading animation keyframe | Cosmetic animation; not direction-sensitive |
| `toFixed()` without locale in some files | Business logic — out of sprint scope |

---

## Known Remaining TODOs

These are documented issues that are out of scope for this release. They do not block the design system v1 release.

| Area | Issue | Priority |
|------|-------|----------|
| `ChecklistTab.tsx` L150/161 | Two unused `eslint-disable` directives for `react-hooks/exhaustive-deps` | Low |
| Large JS chunks | Several chunks >300 kB (exceljs, jspdf, recharts, html2canvas) | Medium — code-split pass needed |
| Mobile modals | `PaymentModal` and `ReceiptModal` lack `max-h` limits on short screens | Medium |
| Dialog button order | `Dialog`-based pages (cost-centers, accruals) place primary button last (left in RTL); custom `.erp-modal` components place it first (right in RTL) | Low — cosmetic inconsistency |
| Number locale | Some `toFixed()` calls without `toLocaleString` | Low — does not affect Arabic display |

---

## Do Not Reintroduce

The following patterns were deliberately removed. Do not add them back.

### Brand Colors

- **Amber / yellow as brand** — replaced by teal (`#2DD4BF`). Amber is reserved for `--status-warning` only.
- **Purple / violet / indigo as brand** — fully removed in Sprint 15. `#D8B4FE` remains only for `--status-external-repair` (a specific repair job type badge).
- **Cyan-500 / indigo-500 as accent** — removed. Use `var(--brand)` exclusively.

### Visual Style

- **Glassmorphism as default** — `backdrop-filter: blur` is used only in topbar/sidebar overlays (structural chrome). It is not used for cards, modals, or content areas.
- **Random gradients** — no `linear-gradient` or `radial-gradient` in component backgrounds. Gradients belong in illustrations or marketing pages only.
- **Glow effects on content** — `box-shadow` glow (`0 0 Xpx var(--brand)`) was removed from cards and buttons. Only focus rings use a glow.

### Code Patterns

- **Visual-only inline styles** — `style={{ background: '#hexcode' }}` hardcoded in JSX. All colors must resolve to CSS tokens. Exception: brand WhatsApp link (`#25D366` with `eslint-disable` comment explaining it is a third-party brand color).
- **Duplicate component styling** — defining the same component style in both `index.css` and a component CSS file. Source of truth is `styles/components/*.css`.
- **Emojis in UI or print output** — all emojis have been replaced by Lucide icons. Emojis render inconsistently across platforms and printers.

### Print / Customer Output

- **Hardcoded company name in print** — brand name must always come from `settings.company_name`. Never hardcode `"هالال تك"` or any other name.
- **Profit / cost data in customer prints** — `profit`, `cost_price`, `purchase_price`, and `margin` must never appear in thermal receipts or customer-facing invoices.
- **Hardcoded footer text in customer prints** — footer copy must be configurable or generic. No hardcoded Arabic praise phrases tied to a specific brand.

---

## Safe Future Work

These items are scoped, understood, and safe to implement in future sprints without breaking the design system.

### Frontend

| Item | Notes |
|------|-------|
| **Weekly dashboard API** | Dashboard currently shows day/month data; a weekly aggregation endpoint is needed for the trend chart |
| **Advanced command palette** | Current search palette (Sprint 17) covers page navigation; extend to search customers, invoices, and repairs by ID/name |
| **Keyboard shortcuts** | `⌘K` for search is live; add `⌘N` (new sale), `⌘B` (back), `Escape` chaining |
| **PDF template variants** | Current PDF generation uses jsPDF with inline styles; migrate to HTML-to-canvas or a dedicated template for cleaner Arabic layout |
| **Performance pass** | Code-split exceljs, jspdf, and html2canvas (together ~1.5 MB) into lazy chunks; target LCP <2s on 4G |
| **Dialog button order standardization** | Unify primary-button position across all modal types (currently inconsistent between `Dialog`-based and `.erp-modal`-based components) |
| **Mobile modal overflow audit** | Add `max-h-[90vh] overflow-y-auto` to `PaymentModal` and `ReceiptModal` |

### Architecture (requires planning)

| Item | Notes |
|------|-------|
| **AI assistant** | Integrate after all core modules are stable. Not a priority until all financial workflows are complete and tested. |
| **RTL logical properties migration** | Migrate physical `left/right/pl/pr` to logical `start/end/ps/pe` Tailwind utilities across the whole codebase — only worthwhile if a LTR locale is ever added |
| **Design token dark/light auto-generation** | Replace manual `html.light { … }` overrides with a CSS `color-scheme` + `prefers-color-scheme` approach |

---

## Validation Commands & Latest Results

### Commands

```bash
# TypeScript type check
pnpm --filter @workspace/erp-system run typecheck

# ESLint
pnpm --filter @workspace/erp-system run lint

# Production build
pnpm run build
```

### Latest Results (Sprint 19 → Sprint 20)

| Check | Result | Notes |
|-------|--------|-------|
| `typecheck` | ✅ Pass | 0 errors |
| `lint` | ✅ Pass | 0 errors, 2 pre-existing warnings in `ChecklistTab.tsx` (unused eslint-disable directives) |
| `build` | ✅ Pass | Built in ~53s; 4007 modules transformed |

### Pre-existing Lint Warnings (not blocking)

```
artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx
  150:5  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')
  161:5  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/exhaustive-deps')

✖ 2 problems (0 errors, 2 warnings)
```

These warnings existed before Sprint 20 and are tracked in Known Remaining TODOs.

---

*MUHKAMPRO Design System V1 — documented Sprint 20, June 2026*
