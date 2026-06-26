---
name: Design system adoption state
description: Token usage counts and deliberate skip decisions after the 10-phase UI/UX consistency transformation on erp-system.
---

## Final token adoption counts (post Phase 10)
- `erp-label`: 114 usages
- `erp-input` (incl. former glass-input): 208 usages — `glass-input` fully retired (0 remaining)
- `erp-status` / `erp-badge`: 50 usages
- `erp-card`: 25 usages
- `erp-kpi` / `erp-kpi-label`: 42 usages
- `erp-section-title`: 2 usages (clean opaque-ink h3 targets only)

## Phases completed
1. PageHeader / SettingsPattern
2. PageToolbar + SearchInput + CSS
3. EmptyTable + Loading
4. Forms — erp-label, erp-field, erp-modal-header/footer
5. Cards — erp-kpi-label, erp-card
6. Status Badges — erp-status-*, erp-badge-* (journal-entries, vouchers, fixed-assets, inventory/count, transfers)
7. Section Titles — erp-section-title (ReorderPanel, TopReportsTab)
8. Form Labels sweep — CustomerClassifications, ReturnModal, ExpenseReportsModal, CountSessionForm, POModal, TransferTab, RepairExtensions, SafeModals, currency-tab
9. glass-input → erp-input normalization (23 files), remaining treasury/currency-tab labels
10. Raw input migration (CountSessionForm, TransferTab, POModal, PartialProductSelector, SafeModals)

## Deliberate skip decisions
- **VatReport tinted KPI cards** (bg-blue-500/8, bg-amber-500/8, bg-red-500/8) — intentionally contextual color per VAT type; do NOT migrate to erp-card.
- **AlertStatsCards** — interactive filter cards with state-dependent styling; skip.
- **SubBadge / VSubBadge** in vouchers + VouchersHistoryReport — multi-color semantic map (blue/teal/orange/amber per counterparty type); keep as-is.
- **ProductProfitReport profit-margin badge** — intentional 3-level conditional color (≥30%/≥15%/else); skip.
- **ReportTable stock-level badge** — intentional 3-color system (out/low/ok); skip.
- **financial-lock-tab locked/unlocked badge** — a `button`, not a `span`; intentionally styled as a lock pill button; skip.
- **Section h3/h4 with text-ink/70** — muted sub-section-within-card headings; NOT erp-section-title targets (erp-section-title = text-1, full opacity).
- **RepairExtensions camera label** — composite label with Camera icon + font-bold + flex-items-center; erp-label doesn't accommodate icon flex layout.
- **EmployeeDetail h3 mini popup** — inside a w-80 dropdown popup; erp-section-title (16px) too large for that context.

## CSS equivalences
- `glass-input` === `erp-input`: defined together in form.css line 39–62, identical rules.
- `erp-label` font-weight: 600 (!important) — "font-bold" labels (700) safely migrate; 600 is the design standard.
- `erp-status` base + modifier is the preferred pattern; `erp-badge-*` (older) is self-contained and already widely adopted — both are valid and defined in badge.css.

**Why:** Future agent should not re-migrate skipped items or undo these decisions. The design system is internally consistent; deviations are intentional.
