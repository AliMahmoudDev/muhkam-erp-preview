# MUHKAM ERP Design System Audit

## Summary

- inline_style: 2401
- hardcoded_hex: 2294
- inline_background: 598
- gradient: 146
- backdrop_blur: 123
- tailwind_white_bg: 98
- tailwind_white_text: 94
- tailwind_arbitrary_bg: 82
- tailwind_white_border: 59

## Top Problem Files

- 845 — `artifacts/erp-system/src/index.css`
- 309 — `artifacts/erp-system/src/pages/LandingPage.tsx`
- 215 — `artifacts/erp-system/src/pages/super-admin/tab-monitoring.tsx`
- 182 — `artifacts/erp-system/src/pages/employee-portal/index.tsx`
- 142 — `artifacts/erp-system/src/pages/landing/LandingMockups.tsx`
- 123 — `artifacts/erp-system/src/pages/login.tsx`
- 89 — `artifacts/erp-system/src/pages/super-admin/panels/company-panel.tsx`
- 82 — `artifacts/erp-system/src/components/layout.tsx`
- 80 — `artifacts/erp-system/src/pages/settings/currency-tab.tsx`
- 79 — `artifacts/erp-system/src/pages/reports/BalanceSheetReport.tsx`
- 76 — `artifacts/erp-system/src/pages/dashboard.tsx`
- 73 — `artifacts/erp-system/src/components/employee-gateway.tsx`
- 72 — `artifacts/erp-system/src/pages/super-admin/tab-health.tsx`
- 69 — `artifacts/erp-system/src/pages/employee-portal/TechnicianSections.tsx`
- 65 — `artifacts/erp-system/src/components/SplitPaymentModal.tsx`
- 63 — `artifacts/erp-system/src/components/notification-bell.tsx`
- 62 — `artifacts/erp-system/src/pages/reports/profit-loss/ReportTable.tsx`
- 62 — `artifacts/erp-system/src/pages/super-admin/settings/TelegramPanel.tsx`
- 61 — `artifacts/erp-system/src/components/ShortcutsCustomizer.tsx`
- 56 — `artifacts/erp-system/src/pages/super-admin/audit-actions.ts`
- 55 — `artifacts/erp-system/src/pages/super-admin/settings/BackupPanel.tsx`
- 52 — `artifacts/erp-system/src/pages/super-admin/modals/snapshot-modal.tsx`
- 51 — `artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx`
- 51 — `artifacts/erp-system/src/pages/reports/CashFlowReport.tsx`
- 50 — `artifacts/erp-system/src/pages/super-admin/tab-announcements.tsx`
- 46 — `artifacts/erp-system/src/pages/super-admin/modals/company/ResetPasswordResultModal.tsx`
- 45 — `artifacts/erp-system/src/pages/super-admin/tab-revenue.tsx`
- 44 — `artifacts/erp-system/src/components/MobileNavCustomizer.tsx`
- 44 — `artifacts/erp-system/src/pages/reports/balance-sheet/DrillPanels.tsx`
- 41 — `artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx`
- 41 — `artifacts/erp-system/src/pages/super-admin/modals/company/CreateCompanyResultModal.tsx`
- 41 — `artifacts/erp-system/src/pages/super-admin/settings/SecurityPanel.tsx`
- 41 — `artifacts/erp-system/src/pages/super-admin/tab-settings.tsx`
- 40 — `artifacts/erp-system/src/components/notifications/NotificationItem.tsx`
- 39 — `artifacts/erp-system/src/pages/reports/AgingReport.tsx`
- 39 — `artifacts/erp-system/src/pages/super-admin/settings/AuditLogPanel.tsx`
- 38 — `artifacts/erp-system/src/pages/login/RegisterForm.tsx`
- 37 — `artifacts/erp-system/src/pages/super-admin/tab-alerts.tsx`
- 37 — `artifacts/erp-system/src/pages/super-admin/tab-plans.tsx`
- 36 — `artifacts/erp-system/src/components/logout-checkout-modal.tsx`
- 35 — `artifacts/erp-system/src/pages/super-admin/ui.tsx`
- 33 — `artifacts/erp-system/src/components/modals/RepairReturnModal.tsx`
- 33 — `artifacts/erp-system/src/pages/branches.tsx`
- 33 — `artifacts/erp-system/src/pages/subscription-expired.tsx`
- 32 — `artifacts/erp-system/src/components/RepairSettingsModal.tsx`
- 29 — `artifacts/erp-system/src/components/alert-bell.tsx`
- 29 — `artifacts/erp-system/src/pages/super-admin/companies/CompanyTableRow.tsx`
- 27 — `artifacts/erp-system/src/components/RepairPipeline.tsx`
- 27 — `artifacts/erp-system/src/pages/employee-portal/AdvanceRequestModal.tsx`
- 27 — `artifacts/erp-system/src/pages/inventory/alerts/components/POModal.tsx`
- 27 — `artifacts/erp-system/src/pages/pos/PosReturnPanel.tsx`
- 27 — `artifacts/erp-system/src/pages/settings/_shared.tsx`
- 27 — `artifacts/erp-system/src/pages/super-admin/modals/company/DeleteCompanyModal.tsx`
- 27 — `artifacts/erp-system/src/pages/super-admin/overview/OverviewActivity.tsx`
- 26 — `artifacts/erp-system/src/components/modals/WarrantyModal.tsx`
- 26 — `artifacts/erp-system/src/pages/super-admin/companies/CreateCompanyForm.tsx`
- 26 — `artifacts/erp-system/src/pages/super-admin/overview/OverviewHealthCards.tsx`
- 26 — `artifacts/erp-system/src/pages/super-admin/tab-audit-log.tsx`
- 24 — `artifacts/erp-system/src/components/idle-checkout-modal.tsx`
- 23 — `artifacts/erp-system/src/components/alerts/AlertItem.tsx`
- 23 — `artifacts/erp-system/src/pages/reports/balance-sheet/StatementRows.tsx`
- 21 — `artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx`
- 21 — `artifacts/erp-system/src/pages/sales/SalePaymentSection.tsx`
- 20 — `artifacts/erp-system/src/components/AlertSettingBanner.tsx`
- 19 — `artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx`
- 19 — `artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx`
- 19 — `artifacts/erp-system/src/pages/super-admin/companies/CompanyCard.tsx`
- 19 — `artifacts/erp-system/src/pages/super-admin/layout/sa-nav.tsx`
- 19 — `artifacts/erp-system/src/pages/super-admin/settings/RestoreModal.tsx`
- 17 — `artifacts/erp-system/src/components/announcement-banner.tsx`
- 17 — `artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx`
- 17 — `artifacts/erp-system/src/pages/settings/vat-tab.tsx`
- 17 — `artifacts/erp-system/src/pages/super-admin/managers/ManagerRow.tsx`
- 16 — `artifacts/erp-system/src/pages/price-lists/helpers.ts`
- 16 — `artifacts/erp-system/src/pages/repairs/DashboardCardsSection.tsx`
- 16 — `artifacts/erp-system/src/pages/reports/index.tsx`
- 15 — `artifacts/erp-system/src/pages/employees/sales-targets-tab.tsx`
- 15 — `artifacts/erp-system/src/pages/repairs/JobDetail.tsx`
- 15 — `artifacts/erp-system/src/pages/transfers.tsx`
- 14 — `artifacts/erp-system/src/pages/dashboard/SalesTargetsWidget.tsx`

## Detailed Findings

### inline_style
`artifacts/erp-system/src/App.tsx:214`

```tsx
style={{ background: 'hsl(var(--background))' }}
```

### inline_background
`artifacts/erp-system/src/App.tsx:214`

```tsx
style={{ background: 'hsl(var(--background))' }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:23`

```tsx
amber:  { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)',  text: '#f59e0b', toggle: '#f59e0b' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:24`

```tsx
orange: { bg: 'rgba(249,115,22,0.07)',  border: 'rgba(249,115,22,0.22)',  text: '#fb923c', toggle: '#f97316' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:25`

```tsx
blue:   { bg: 'rgba(59,130,246,0.07)',  border: 'rgba(59,130,246,0.22)',  text: '#60a5fa', toggle: '#3b82f6' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:26`

```tsx
red:    { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.22)',   text: '#f87171', toggle: '#ef4444' },
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:99`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:105`

```tsx
<span style={{ fontSize: 15 }}>{icon}</span>
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:106`

```tsx
<span style={{ fontWeight: 700, color: c.text, fontSize: 12.5, whiteSpace: 'nowrap' }}>
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:114`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:121`

```tsx
<span style={{
```

### inline_background
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:126`

```tsx
background: '#fff', transition: 'all 0.2s',
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:130`

```tsx
<span style={{ color: 'var(--erp-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:136`

```tsx
<span style={{ color: 'var(--erp-text-4)', fontSize: 11 }}>|</span>
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:138`

```tsx
<span style={{ color: 'var(--erp-text-3)', fontSize: 11, whiteSpace: 'nowrap' }}>
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:147`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:149`

```tsx
background: 'var(--erp-bg-hover)',
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:155`

```tsx
<span style={{ color: 'var(--erp-text-3)', fontSize: 11 }}>{thresholdUnit}</span>
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:164`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:172`

```tsx
{saving   ? <Loader2      style={{ width: 10, height: 10 }} className="animate-spin" />
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:173`

```tsx
: saved   ? <CheckCircle2 style={{ width: 10, height: 10 }} />
```

### inline_style
`artifacts/erp-system/src/components/AlertSettingBanner.tsx:174`

```tsx
:           <Save         style={{ width: 10, height: 10 }} />}
```

### backdrop_blur
`artifacts/erp-system/src/components/BarcodeScanner.tsx:58`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNav.tsx:87`

```tsx
const colActive   = '#f59e0b';
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:97`

```tsx
style={{
```

### backdrop_blur
`artifacts/erp-system/src/components/MobileNav.tsx:104`

```tsx
backdropFilter: 'blur(20px)',
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:115`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:121`

```tsx
<Icon style={{ width: 20, height: 20 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:122`

```tsx
<span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:135`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/MobileNav.tsx:137`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:143`

```tsx
<Settings style={{ width: 18, height: 18 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNav.tsx:144`

```tsx
<span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:96`

```tsx
const txtPrim   = isDark ? 'rgba(255,255,255,0.90)' : '#0D1117';
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:103`

```tsx
style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
```

### inline_background
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:103`

```tsx
style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
```

### backdrop_blur
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:103`

```tsx
style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }}
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:108`

```tsx
style={{ background: bg, border: hdrBdr }}
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:114`

```tsx
style={{ borderBottom: hdrBdr }}
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:118`

```tsx
style={{ color: txtMuted, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
```

### inline_background
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:118`

```tsx
style={{ color: txtMuted, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:120`

```tsx
<X style={{ width: 18, height: 18 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:122`

```tsx
<span style={{ fontWeight: 800, fontSize: 15, color: txtPrim }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:126`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:128`

```tsx
color: atLimit ? '#f87171' : '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:138`

```tsx
<div className="overflow-y-auto" style={{ maxHeight: '62vh', padding: '16px 16px 0' }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:140`

```tsx
<p style={{ fontSize: 10, fontWeight: 800, color: txtMuted, letterSpacing: '0.05em', marginBottom: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:143`

```tsx
<div className="space-y-1.5" style={{ marginBottom: 20 }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:145`

```tsx
<p style={{ fontSize: 12, color: txtMuted, textAlign: 'center', padding: '14px 0' }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:155`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:156`

```tsx
background: 'rgba(245,158,11,0.07)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:160`

```tsx
<Icon style={{ width: 15, height: 15, color: '#f59e0b', flexShrink: 0 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:160`

```tsx
<Icon style={{ width: 15, height: 15, color: '#f59e0b', flexShrink: 0 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:161`

```tsx
<span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: txtPrim }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:167`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:170`

```tsx
background: 'none', border: 'none',
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:175`

```tsx
<ChevronUp style={{ width: 14, height: 14 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:180`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:183`

```tsx
background: 'none', border: 'none',
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:188`

```tsx
<ChevronDown style={{ width: 14, height: 14 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:192`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:194`

```tsx
background: 'none', border: 'none',
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:198`

```tsx
<X style={{ width: 14, height: 14 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:207`

```tsx
<p style={{ fontSize: 10, fontWeight: 800, color: txtMuted, letterSpacing: '0.05em', marginBottom: 8 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:210`

```tsx
<span style={{ color: '#f87171', fontWeight: 700, marginRight: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:210`

```tsx
<span style={{ color: '#f87171', fontWeight: 700, marginRight: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:215`

```tsx
<div className="space-y-1.5" style={{ marginBottom: 20 }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:222`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:228`

```tsx
<Icon style={{ width: 15, height: 15, color: txtMuted, flexShrink: 0 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:229`

```tsx
<span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: txtPrim }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:235`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:239`

```tsx
color: atLimit ? txtMuted : '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:244`

```tsx
<Plus style={{ width: 13, height: 13 }} />
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:253`

```tsx
<div className="px-5 py-4" style={{ borderTop: hdrBdr }}>
```

### inline_style
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:258`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:260`

```tsx
? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
```

### gradient
`artifacts/erp-system/src/components/MobileNavCustomizer.tsx:260`

```tsx
? 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)'
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:239`

```tsx
style={{ background: "rgba(0,0,0,0.75)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:239`

```tsx
style={{ background: "rgba(0,0,0,0.75)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:245`

```tsx
style={{ background: "rgba(15,10,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:245`

```tsx
style={{ background: "rgba(15,10,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/RepairPipeline.tsx:245`

```tsx
style={{ background: "rgba(15,10,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:274`

```tsx
style={{ background: "rgba(124,58,237,0.7)", border: "1px solid rgba(139,92,246,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:274`

```tsx
style={{ background: "rgba(124,58,237,0.7)", border: "1px solid rgba(139,92,246,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:395`

```tsx
style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(124,58,237,0.05) 100%)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:395`

```tsx
style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(124,58,237,0.05) 100%)" }}
```

### gradient
`artifacts/erp-system/src/components/RepairPipeline.tsx:395`

```tsx
style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(124,58,237,0.05) 100%)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:400`

```tsx
<div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: "rgba(139,92,246,0.10)", borderColor: "rgba(139,92,246,0.25)" }}>
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:400`

```tsx
<div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: "rgba(139,92,246,0.10)", borderColor: "rgba(139,92,246,0.25)" }}>
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:410`

```tsx
<div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:410`

```tsx
<div className="flex items-center gap-2 px-4 py-2 border-b" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }}>
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:434`

```tsx
style={{ background: "rgba(124,58,237,0.18)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:434`

```tsx
style={{ background: "rgba(124,58,237,0.18)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:446`

```tsx
style={{ background: "rgba(16,185,129,0.10)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:446`

```tsx
style={{ background: "rgba(16,185,129,0.10)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:456`

```tsx
style={{ background: "rgba(139,92,246,0.10)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:456`

```tsx
style={{ background: "rgba(139,92,246,0.10)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:466`

```tsx
style={{ background: "rgba(239,68,68,0.10)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:466`

```tsx
style={{ background: "rgba(239,68,68,0.10)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:477`

```tsx
style={{ background: "rgba(124,58,237,0.10)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:477`

```tsx
style={{ background: "rgba(124,58,237,0.10)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:493`

```tsx
style={{ background: "rgba(255,255,255,0.06)" }}
```

### inline_background
`artifacts/erp-system/src/components/RepairPipeline.tsx:493`

```tsx
style={{ background: "rgba(255,255,255,0.06)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairPipeline.tsx:499`

```tsx
style={{ width: `calc(${progressPct}% - 0px)`, maxWidth: "calc(100% - 5rem)" }}
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:61`

```tsx
style={{
```

### backdrop_blur
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:63`

```tsx
backdropFilter: 'blur(14px) saturate(140%)',
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:72`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:84`

```tsx
style={{ top: -120, right: -120, width: 360, height: 360 }}
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:88`

```tsx
style={{ bottom: -160, left: -140, width: 380, height: 380, animationDelay: '1.5s' }}
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:97`

```tsx
background: 'linear-gradient(180deg, rgba(0,0,0,0.025), rgba(0,0,0,0.010))',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:97`

```tsx
background: 'linear-gradient(180deg, rgba(0,0,0,0.025), rgba(0,0,0,0.010))',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:102`

```tsx
'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))',
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:111`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:112`

```tsx
background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:112`

```tsx
background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:112`

```tsx
background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:123`

```tsx
style={{ boxShadow: '0 0 10px rgba(52,211,153,0.7), 0 0 0 2px #0e1320' }}
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:123`

```tsx
style={{ boxShadow: '0 0 10px rgba(52,211,153,0.7), 0 0 0 2px #0e1320' }}
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:147`

```tsx
? { background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)' }
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:149`

```tsx
background: 'rgba(255,255,255,0.03)',
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:183`

```tsx
? { background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.09)' }
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:185`

```tsx
background: 'rgba(255,255,255,0.03)',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:203`

```tsx
'linear-gradient(180deg, rgba(0,0,0,0.025) 0%, rgba(0,0,0,0.010) 100%)',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:208`

```tsx
'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.004) 100%)',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:235`

```tsx
'linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.04) 70%, transparent 100%)',
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:247`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:248`

```tsx
background: 'linear-gradient(180deg, #fcd34d, #f59e0b)',
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:248`

```tsx
background: 'linear-gradient(180deg, #fcd34d, #f59e0b)',
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:248`

```tsx
background: 'linear-gradient(180deg, #fcd34d, #f59e0b)',
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:255`

```tsx
style={{
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:257`

```tsx
? 'linear-gradient(135deg, rgba(245,158,11,0.30), rgba(217,119,6,0.12))'
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:296`

```tsx
? { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }
```

### inline_background
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:298`

```tsx
background: 'rgba(255,255,255,0.025)',
```

### inline_style
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:328`

```tsx
style={{
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:330`

```tsx
? 'radial-gradient(1200px 600px at 50% -200px, rgba(245,158,11,0.07), transparent 60%)'
```

### gradient
`artifacts/erp-system/src/components/RepairSettingsModal.tsx:331`

```tsx
: 'radial-gradient(1200px 600px at 50% -200px, rgba(245,158,11,0.025), transparent 60%), rgba(0,0,0,0.20)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:29`

```tsx
{ id: 'new-sale',        label: 'فاتورة مبيعات جديدة',  icon: ShoppingCart, path: '/sales/new',        color: '#f59e0b' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:30`

```tsx
{ id: 'new-receipt',     label: 'سند قبض',               icon: ReceiptText,  path: '/receipts/new',     color: '#34d399' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:31`

```tsx
{ id: 'new-repair',      label: 'بطاقة صيانة جديدة',    icon: Wrench,       path: '/repairs/new',      color: '#818cf8' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:32`

```tsx
{ id: 'new-purchase',    label: 'فاتورة مشتريات',        icon: ShoppingBag,  path: '/purchases/new',    color: '#60a5fa' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:33`

```tsx
{ id: 'new-customer',    label: 'إضافة عميل',            icon: Users,        path: '/customers/new',    color: '#fb923c' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:34`

```tsx
{ id: 'inventory',       label: 'المخزون',               icon: Package,      path: '/inventory',        color: '#a78bfa' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:35`

```tsx
{ id: 'payment-voucher', label: 'سند صرف',               icon: CreditCard,   path: '/payments/new',     color: '#f87171' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:36`

```tsx
{ id: 'expense',         label: 'تسجيل مصروف',           icon: DollarSign,   path: '/expenses/new',     color: '#f9a8d4' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:37`

```tsx
{ id: 'journal',         label: 'قيد يومية',             icon: Landmark,     path: '/accounting/new',   color: '#67e8f9' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:38`

```tsx
{ id: 'reports',         label: 'التقارير',              icon: FileText,     path: '/reports',          color: '#86efac' },
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:39`

```tsx
{ id: 'new-supplier',    label: 'إضافة مورد',            icon: PlusCircle,   path: '/suppliers/new',    color: '#fcd34d' },
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:68`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:70`

```tsx
background: 'rgba(0,0,0,0.65)',
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:77`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:78`

```tsx
background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:78`

```tsx
background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
```

### gradient
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:78`

```tsx
background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:91`

```tsx
<div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:93`

```tsx
<h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, margin: 0 }}>تخصيص الاختصارات</h2>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:93`

```tsx
<h2 style={{ color: '#f1f5f9', fontSize: 17, fontWeight: 700, margin: 0 }}>تخصيص الاختصارات</h2>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:94`

```tsx
<p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '4px 0 0' }}>اختر حتى 8 اختصارات وارتّبها</p>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:98`

```tsx
style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:98`

```tsx
style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:100`

```tsx
<X style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.6)' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:104`

```tsx
<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:106`

```tsx
<div style={{ flex: 1, overflowY: 'auto', padding: 20, borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:107`

```tsx
<p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>الاختصارات المتاحة</p>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:108`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:116`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:128`

```tsx
<div style={{ width: 34, height: 34, borderRadius: 9, background: s.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:129`

```tsx
<Icon style={{ width: 16, height: 16, color: s.color }} />
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:131`

```tsx
<span style={{ color: active ? '#f1f5f9' : 'rgba(255,255,255,0.65)', fontSize: 14, flex: 1 }}>{s.label}</span>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:131`

```tsx
<span style={{ color: active ? '#f1f5f9' : 'rgba(255,255,255,0.65)', fontSize: 14, flex: 1 }}>{s.label}</span>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:132`

```tsx
{active && <Check style={{ width: 15, height: 15, color: s.color, flexShrink: 0 }} />}
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:140`

```tsx
<div style={{ width: 220, flexShrink: 0, overflowY: 'auto', padding: 20 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:141`

```tsx
<p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:145`

```tsx
<p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>لم يتم اختيار أي اختصار بعد</p>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:147`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:155`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:159`

```tsx
background: 'rgba(255,255,255,0.05)',
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:163`

```tsx
<Icon style={{ width: 14, height: 14, color: def.color, flexShrink: 0 }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:164`

```tsx
<span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.label}</span>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:165`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:166`

```tsx
<button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: 2, opacity: idx === 0 ? 0.2 : 0.7 }}>
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:166`

```tsx
<button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', padding: 2, opacity: idx === 0 ? 0.2 : 0.7 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:167`

```tsx
<ArrowUp style={{ width: 12, height: 12, color: '#94a3b8' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:167`

```tsx
<ArrowUp style={{ width: 12, height: 12, color: '#94a3b8' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:169`

```tsx
<button onClick={() => move(idx, 1)} disabled={idx === selected.length - 1} style={{ background: 'none', border: 'none', cursor: idx === selected.length - 1 ? 'default' : 'pointer', padding: 2, opacity: idx === selected.
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:169`

```tsx
<button onClick={() => move(idx, 1)} disabled={idx === selected.length - 1} style={{ background: 'none', border: 'none', cursor: idx === selected.length - 1 ? 'default' : 'pointer', padding: 2, opacity: idx === selected.
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:170`

```tsx
<ArrowDown style={{ width: 12, height: 12, color: '#94a3b8' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:170`

```tsx
<ArrowDown style={{ width: 12, height: 12, color: '#94a3b8' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:175`

```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.5 }}
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:175`

```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.5 }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:177`

```tsx
<X style={{ width: 12, height: 12, color: '#f87171' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:177`

```tsx
<X style={{ width: 12, height: 12, color: '#f87171' }} />
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:187`

```tsx
<div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:190`

```tsx
style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer' }}
```

### inline_background
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:190`

```tsx
style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer' }}
```

### inline_style
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:197`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:199`

```tsx
background: saving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
```

### gradient
`artifacts/erp-system/src/components/ShortcutsCustomizer.tsx:199`

```tsx
background: saving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:42`

```tsx
cash:          { active: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)',  text: '#34D399', bg: 'rgba(16,185,129,0.07)'  },
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:43`

```tsx
card:          { active: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)',  text: '#60A5FA', bg: 'rgba(59,130,246,0.07)'  },
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:44`

```tsx
bank_transfer: { active: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  text: '#A78BFA', bg: 'rgba(139,92,246,0.07)'  },
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:45`

```tsx
installment:   { active: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)',  text: '#FCD34D', bg: 'rgba(245,158,11,0.07)'  },
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:46`

```tsx
credit:        { active: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.35)',  text: '#818CF8', bg: 'rgba(99,102,241,0.07)'  },
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:155`

```tsx
style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:155`

```tsx
style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
```

### backdrop_blur
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:155`

```tsx
style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:160`

```tsx
style={{ background: 'linear-gradient(145deg, rgba(15,15,25,0.99), rgba(8,8,18,0.99))' }}
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:160`

```tsx
style={{ background: 'linear-gradient(145deg, rgba(15,15,25,0.99), rgba(8,8,18,0.99))' }}
```

### gradient
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:160`

```tsx
style={{ background: 'linear-gradient(145deg, rgba(15,15,25,0.99), rgba(8,8,18,0.99))' }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:162`

```tsx
<div style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }} />
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:162`

```tsx
<div style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }} />
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:162`

```tsx
<div style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }} />
```

### gradient
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:162`

```tsx
<div style={{ height: 2, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)' }} />
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:179`

```tsx
<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:179`

```tsx
<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:187`

```tsx
<span className="font-bold tabular-nums transition-colors" style={{ color: isDone ? '#10B981' : '#F59E0B' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:187`

```tsx
<span className="font-bold tabular-nums transition-colors" style={{ color: isDone ? '#10B981' : '#F59E0B' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:192`

```tsx
<div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--erp-bg-hover)' }}>
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:192`

```tsx
<div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--erp-bg-hover)' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:195`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:198`

```tsx
? 'linear-gradient(90deg, #10B981, #34D399)'
```

### gradient
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:198`

```tsx
? 'linear-gradient(90deg, #10B981, #34D399)'
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:199`

```tsx
: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
```

### gradient
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:199`

```tsx
: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:219`

```tsx
style={{ background: c.bg, border: `1px solid ${c.border.replace('0.35', '0.20')}` }}
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:224`

```tsx
style={{ background: 'rgba(239,68,68,0.08)' }}
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:224`

```tsx
style={{ background: 'rgba(239,68,68,0.08)' }}
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:231`

```tsx
<span className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1" style={{ background: c.active, color: c.text }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:246`

```tsx
style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.28)' }}
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:246`

```tsx
style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.28)' }}
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:260`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:281`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:282`

```tsx
background: 'rgba(255,255,255,0.06)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:291`

```tsx
<option key={s.id} value={s.id} style={{ background: '#0f0f19', color: '#fff' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:291`

```tsx
<option key={s.id} value={s.id} style={{ background: '#0f0f19', color: '#fff' }}>
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:291`

```tsx
<option key={s.id} value={s.id} style={{ background: '#0f0f19', color: '#fff' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:299`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:312`

```tsx
<div className="relative shrink-0" style={{ width: 112 }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:325`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:326`

```tsx
background: 'rgba(255,255,255,0.07)',
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:333`

```tsx
<span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'rgba(255,255,255,0.25)' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:344`

```tsx
style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 2px 10px rgba(245,158,11,0.28)' }}
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:344`

```tsx
style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 2px 10px rgba(245,158,11,0.28)' }}
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:344`

```tsx
style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 2px 10px rgba(245,158,11,0.28)' }}
```

### gradient
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:344`

```tsx
style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 2px 10px rgba(245,158,11,0.28)' }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:351`

```tsx
style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#F59E0B' }}
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:351`

```tsx
style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#F59E0B' }}
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:351`

```tsx
style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#F59E0B' }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:363`

```tsx
style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:363`

```tsx
style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:363`

```tsx
style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:369`

```tsx
<div style={{ height: 1, background: 'var(--erp-border)' }} />
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:369`

```tsx
<div style={{ height: 1, background: 'var(--erp-border)' }} />
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:380`

```tsx
{ label: 'متبقي', val: remaining, color: isDone ? '#10B981' : '#F59E0B' },
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:383`

```tsx
<span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:386`

```tsx
<span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>{item.label}</span>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:392`

```tsx
<div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:392`

```tsx
<div className="flex gap-2 px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
```

### inline_style
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:396`

```tsx
style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.40)' }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:406`

```tsx
? { background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 4px 20px rgba(245,158,11,0.35)' }
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:406`

```tsx
? { background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 4px 20px rgba(245,158,11,0.35)' }
```

### gradient
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:406`

```tsx
? { background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', color: '#0a0500', boxShadow: '0 4px 20px rgba(245,158,11,0.35)' }
```

### inline_background
`artifacts/erp-system/src/components/SplitPaymentModal.tsx:407`

```tsx
: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.20)', cursor: 'not-allowed' }
```

### hardcoded_hex
`artifacts/erp-system/src/components/alert-bell.tsx:167`

```tsx
const bgPanel = isDark ? '#161f30' : '#ffffff';
```

### hardcoded_hex
`artifacts/erp-system/src/components/alert-bell.tsx:187`

```tsx
color: isActive ? '#f59e0b' : textSub,
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:193`

```tsx
<div ref={dropdownRef} style={{ position: 'relative' }}>
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:197`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:216`

```tsx
<Bell style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:219`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/alert-bell.tsx:226`

```tsx
background: hasCritical ? '#ef4444' : '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:244`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:264`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:271`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:278`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:279`

```tsx
<span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>التنبيهات</span>
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:283`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alert-bell.tsx:288`

```tsx
background: 'rgba(245,158,11,0.14)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/alert-bell.tsx:289`

```tsx
color: '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:297`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alert-bell.tsx:302`

```tsx
background: 'rgba(239,68,68,0.15)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/alert-bell.tsx:303`

```tsx
color: '#ef4444',
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:310`

```tsx
<div style={{ display: 'flex', gap: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:315`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alert-bell.tsx:319`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:329`

```tsx
<RefreshCw style={{ width: 10, height: 10 }} /> تحديث
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:335`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alert-bell.tsx:339`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:352`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alert-bell.tsx:356`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:370`

```tsx
<div style={{ display: 'flex', gap: 4, paddingBottom: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:384`

```tsx
<div style={{ overflowY: 'auto', flex: 1 }}>
```

### inline_style
`artifacts/erp-system/src/components/alert-bell.tsx:401`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:60`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:94`

```tsx
<div style={{ marginTop: 4, flexShrink: 0 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:96`

```tsx
<CheckCircle style={{ width: 14, height: 14, color: '#22c55e' }} />
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:96`

```tsx
<CheckCircle style={{ width: 14, height: 14, color: '#22c55e' }} />
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:99`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:104`

```tsx
background: alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:110`

```tsx
<div style={{ flex: 1, minWidth: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:113`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:128`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:137`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:146`

```tsx
color: alert.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:152`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:162`

```tsx
<span style={{ fontSize: 10, color: textSub }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:171`

```tsx
<span style={{ fontSize: 10, color: '#f59e0b', marginRight: 'auto' }}>
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:171`

```tsx
<span style={{ fontSize: 10, color: '#f59e0b', marginRight: 'auto' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:176`

```tsx
<span style={{ fontSize: 10, color: '#22c55e' }}>
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:176`

```tsx
<span style={{ fontSize: 10, color: '#22c55e' }}>
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:184`

```tsx
<div style={{ marginTop: 6, display: 'flex', gap: 5 }}>
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:188`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:193`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:203`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:208`

```tsx
background: 'rgba(34,197,94,0.08)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/alerts/AlertItem.tsx:209`

```tsx
color: '#22c55e',
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertList.tsx:49`

```tsx
style={{ padding: '36px 16px', textAlign: 'center', color: textSub, fontSize: 13 }}
```

### inline_style
`artifacts/erp-system/src/components/alerts/AlertList.tsx:51`

```tsx
<div style={{ fontSize: 28, marginBottom: 8 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/announcement-banner.tsx:28`

```tsx
info:    { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "ℹ️" },
```

### hardcoded_hex
`artifacts/erp-system/src/components/announcement-banner.tsx:29`

```tsx
success: { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534", icon: "✅" },
```

### hardcoded_hex
`artifacts/erp-system/src/components/announcement-banner.tsx:30`

```tsx
warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "⚠️" },
```

### hardcoded_hex
`artifacts/erp-system/src/components/announcement-banner.tsx:31`

```tsx
danger:  { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: "🚨" },
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:88`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:106`

```tsx
<span style={{ fontSize: "16px", flexShrink: 0 }}>{style.icon}</span>
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:109`

```tsx
<div style={{ flex: 1, minWidth: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:110`

```tsx
<span style={{ fontWeight: 800 }}>{ann.title}</span>
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:112`

```tsx
<span style={{ fontWeight: 500, marginRight: "8px", opacity: 0.85 }}>
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:120`

```tsx
<div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:124`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/announcement-banner.tsx:125`

```tsx
background: "none", border: "none", cursor: "pointer",
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:132`

```tsx
<span style={{ fontSize: "11px", opacity: 0.7, fontWeight: 700 }}>
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:138`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/announcement-banner.tsx:139`

```tsx
background: "none", border: "none", cursor: "pointer",
```

### inline_style
`artifacts/erp-system/src/components/announcement-banner.tsx:153`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/announcement-banner.tsx:154`

```tsx
background: "none", border: "none", cursor: "pointer",
```

### backdrop_blur
`artifacts/erp-system/src/components/confirm-modal.tsx:41`

```tsx
className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm modal-overlay"
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:62`

```tsx
if (h < 12) return { text: 'صباح الخير', Icon: Sun, color: '#f59e0b' };
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:63`

```tsx
if (h < 17) return { text: 'مساء الخير', Icon: Coffee, color: '#8b5cf6' };
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:64`

```tsx
return { text: 'مساء النور', Icon: Moon, color: '#6366f1' };
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:212`

```tsx
const bg = isDark ? '#070d1a' : '#f0f4ff';
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:213`

```tsx
const card = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:215`

```tsx
const text = isDark ? '#f1f5f9' : '#0f172a';
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:221`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:236`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:244`

```tsx
style={{
```

### gradient
`artifacts/erp-system/src/components/employee-gateway.tsx:252`

```tsx
? 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)'
```

### gradient
`artifacts/erp-system/src/components/employee-gateway.tsx:253`

```tsx
: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:257`

```tsx
style={{
```

### gradient
`artifacts/erp-system/src/components/employee-gateway.tsx:265`

```tsx
? 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)'
```

### gradient
`artifacts/erp-system/src/components/employee-gateway.tsx:266`

```tsx
: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:272`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:282`

```tsx
<div style={{ textAlign: 'center', marginBottom: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:286`

```tsx
style={{ height: 48, objectFit: 'contain', marginBottom: 8 }}
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:295`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:304`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:312`

```tsx
<GreetIcon style={{ width: 22, height: 22, color: greetColor }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:313`

```tsx
<span style={{ fontSize: 15, color: muted, fontWeight: 600 }}>{greeting}</span>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:315`

```tsx
<h1 style={{ fontSize: 26, fontWeight: 800, color: text, margin: 0, lineHeight: 1.3 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:319`

```tsx
<p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:325`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:335`

```tsx
<Shield style={{ width: 12, height: 12, color: muted }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:336`

```tsx
<span style={{ fontSize: 12, color: muted, fontWeight: 600 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:344`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:353`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:361`

```tsx
<Clock style={{ width: 16, height: 16, color: muted }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:364`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:375`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:383`

```tsx
<Calendar style={{ width: 13, height: 13, color: muted }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:384`

```tsx
<span style={{ fontSize: 13, color: muted }}>{nowDate}</span>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:391`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:399`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:410`

```tsx
<div style={{ textAlign: 'center', color: muted }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:412`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:422`

```tsx
style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:424`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:424`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:425`

```tsx
<AlertCircle style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:426`

```tsx
<span style={{ fontSize: 13, fontWeight: 600 }}>لم تسجّل حضورك بعد</span>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:431`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:439`

```tsx
background: 'linear-gradient(135deg, #10b981, #059669)',
```

### inline_background
`artifacts/erp-system/src/components/employee-gateway.tsx:439`

```tsx
background: 'linear-gradient(135deg, #10b981, #059669)',
```

### gradient
`artifacts/erp-system/src/components/employee-gateway.tsx:439`

```tsx
background: 'linear-gradient(135deg, #10b981, #059669)',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:448`

```tsx
style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }}
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:451`

```tsx
<LogIn style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:458`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:463`

```tsx
color: '#34d399',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:466`

```tsx
<CheckCircle2 style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:467`

```tsx
<span style={{ fontSize: 13, fontWeight: 600 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:473`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:478`

```tsx
color: '#818cf8',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:481`

```tsx
<LogOut style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:482`

```tsx
<span style={{ fontSize: 13, fontWeight: 600 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:493`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:504`

```tsx
style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0, marginTop: 1 }}
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:504`

```tsx
style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0, marginTop: 1 }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:507`

```tsx
<p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:507`

```tsx
<p style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:511`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:525`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:534`

```tsx
<Fingerprint style={{ width: 14, height: 14 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:540`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:545`

```tsx
color: '#34d399',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:549`

```tsx
<Fingerprint style={{ width: 14, height: 14 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:557`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/employee-gateway.tsx:566`

```tsx
background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
```

### inline_background
`artifacts/erp-system/src/components/employee-gateway.tsx:566`

```tsx
background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
```

### gradient
`artifacts/erp-system/src/components/employee-gateway.tsx:566`

```tsx
background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:585`

```tsx
<ArrowLeft style={{ width: 20, height: 20 }} />
```

### inline_style
`artifacts/erp-system/src/components/employee-gateway.tsx:589`

```tsx
<p style={{ textAlign: 'center', fontSize: 11, color: muted, marginTop: -8 }}>
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:68`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:69`

```tsx
position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:74`

```tsx
<div style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:75`

```tsx
background: '#0f1729', border: '1px solid rgba(255,255,255,0.10)',
```

### inline_background
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:75`

```tsx
background: '#0f1729', border: '1px solid rgba(255,255,255,0.10)',
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:80`

```tsx
<div style={{
```

### inline_background
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:82`

```tsx
background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.25)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:86`

```tsx
<Clock style={{ width: 32, height: 32, color: '#f59e0b' }} />
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:86`

```tsx
<Clock style={{ width: 32, height: 32, color: '#f59e0b' }} />
```

### hardcoded_hex
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:89`

```tsx
<h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:89`

```tsx
<h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:92`

```tsx
<p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', margin: '0 0 24px', lineHeight: 1.6 }}>
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:97`

```tsx
<div style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:98`

```tsx
fontSize: 48, fontWeight: 900, color: secs <= 60 ? '#ef4444' : '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:106`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:109`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:112`

```tsx
background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
```

### inline_background
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:112`

```tsx
background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
```

### gradient
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:112`

```tsx
background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:116`

```tsx
<RefreshCw style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:129`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:133`

```tsx
background: 'rgba(239,68,68,0.08)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:134`

```tsx
color: '#ef4444', fontSize: 14, fontWeight: 600,
```

### inline_style
`artifacts/erp-system/src/components/idle-checkout-modal.tsx:137`

```tsx
<LogOut style={{ width: 15, height: 15 }} />
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:66`

```tsx
super_admin: '#f97316',
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:67`

```tsx
admin: '#f59e0b',
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:68`

```tsx
manager: '#60a5fa',
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:69`

```tsx
cashier: '#34d399',
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:70`

```tsx
salesperson: '#a78bfa',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:137`

```tsx
<div ref={wrapRef} style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:139`

```tsx
<Search style={{ width: 14, height: 14, color: iconColor, flexShrink: 0 }} />
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:150`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:154`

```tsx
background: 'transparent',
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:158`

```tsx
caretColor: '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:167`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:169`

```tsx
background: 'none',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:176`

```tsx
<X style={{ width: 12, height: 12 }} />
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:190`

```tsx
<item.icon style={{ width: 14, height: 14, opacity: 0.55, flexShrink: 0 }} />
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:341`

```tsx
const textPrimary = isDark ? 'rgba(255,255,255,0.92)' : '#0f172a';
```

### tailwind_white_bg
`artifacts/erp-system/src/components/layout.tsx:350`

```tsx
className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-black focus:p-2 focus:rounded"
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:359`

```tsx
style={{
```

### backdrop_blur
`artifacts/erp-system/src/components/layout.tsx:366`

```tsx
backdropFilter: 'blur(24px)',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:374`

```tsx
style={{
```

### gradient
`artifacts/erp-system/src/components/layout.tsx:383`

```tsx
? 'linear-gradient(135deg,rgba(245,158,11,0.06) 0%,transparent 60%)'
```

### gradient
`artifacts/erp-system/src/components/layout.tsx:384`

```tsx
: 'linear-gradient(135deg,rgba(245,158,11,0.05) 0%,transparent 60%)',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:389`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:401`

```tsx
style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:409`

```tsx
<div style={{ flex: 1, minWidth: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:411`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:414`

```tsx
color: isDark ? '#f59e0b' : '#b45309',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:423`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:440`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:460`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:474`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:482`

```tsx
<div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:484`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:491`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:505`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:507`

```tsx
background: 'transparent',
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:518`

```tsx
<option value="" style={{ background: isDark ? '#111827' : '#fff' }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:518`

```tsx
<option value="" style={{ background: isDark ? '#111827' : '#fff' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:525`

```tsx
style={{ background: isDark ? '#111827' : '#fff' }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:525`

```tsx
style={{ background: isDark ? '#111827' : '#fff' }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:539`

```tsx
style={{ scrollbarWidth: 'none', padding: sidebarCollapsed ? '4px 8px' : '0 12px' }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:565`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:572`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:581`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:594`

```tsx
style={{ paddingTop: si === 0 ? 10 : 16, paddingBottom: 4 }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:602`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:627`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:632`

```tsx
color: active ? '#f59e0b' : 'inherit',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:635`

```tsx
{!sidebarCollapsed && <span style={{ flex: 1 }}>{item.name}</span>}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:648`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:658`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:684`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:688`

```tsx
color: '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:694`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:696`

```tsx
color: '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:712`

```tsx
style={{ height: 40, borderTop: sidebarBdr, flexShrink: 0 }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:715`

```tsx
<span style={{ fontSize: 10, color: textMuted }}>MuhKam Advanced</span>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:734`

```tsx
style={{ minWidth: 0 }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:741`

```tsx
style={{
```

### backdrop_blur
`artifacts/erp-system/src/components/layout.tsx:746`

```tsx
backdropFilter: 'blur(20px)',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:755`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:760`

```tsx
background: 'linear-gradient(to bottom, #f59e0b, #d97706)',
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:760`

```tsx
background: 'linear-gradient(to bottom, #f59e0b, #d97706)',
```

### gradient
`artifacts/erp-system/src/components/layout.tsx:760`

```tsx
background: 'linear-gradient(to bottom, #f59e0b, #d97706)',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:763`

```tsx
<div style={{ minWidth: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:765`

```tsx
style={{ fontSize: 14.5, fontWeight: 800, color: textPrimary, lineHeight: 1.2 }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:774`

```tsx
<div className="hidden md:flex justify-center" style={{ flexShrink: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:786`

```tsx
style={{ background: chipBg, border: chipBdr, flexShrink: 0 }}
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:790`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:794`

```tsx
background: 'linear-gradient(135deg,#f59e0b,#d97706)',
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:794`

```tsx
background: 'linear-gradient(135deg,#f59e0b,#d97706)',
```

### gradient
`artifacts/erp-system/src/components/layout.tsx:794`

```tsx
background: 'linear-gradient(135deg,#f59e0b,#d97706)',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:801`

```tsx
<div style={{ minWidth: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:803`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:816`

```tsx
<div className="flex items-center gap-1" style={{ marginTop: 1 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:818`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/layout.tsx:822`

```tsx
background: ROLE_DOT[user.role] ?? '#94a3b8',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:826`

```tsx
<span style={{ fontSize: 10, color: textMuted, fontWeight: 600 }}>
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:832`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:844`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/layout.tsx:849`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:858`

```tsx
<LogOut style={{ width: 14, height: 14 }} />
```

### inline_style
`artifacts/erp-system/src/components/layout.tsx:866`

```tsx
<div className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/loading-page.tsx:8`

```tsx
<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: 'var(--erp-bg-app, #0a0e1a)' }}>
```

### inline_style
`artifacts/erp-system/src/components/loading-page.tsx:8`

```tsx
<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: 'var(--erp-bg-app, #0a0e1a)' }}>
```

### inline_background
`artifacts/erp-system/src/components/loading-page.tsx:8`

```tsx
<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: 'var(--erp-bg-app, #0a0e1a)' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/loading-page.tsx:18`

```tsx
<div className="w-20 h-20 rounded-2xl border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10 animate-[logo-breathe_2.5s_ease-in-out_infinite]" style={{ background: 'var(--erp-bg-card, 
```

### inline_style
`artifacts/erp-system/src/components/loading-page.tsx:18`

```tsx
<div className="w-20 h-20 rounded-2xl border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10 animate-[logo-breathe_2.5s_ease-in-out_infinite]" style={{ background: 'var(--erp-bg-card, 
```

### inline_background
`artifacts/erp-system/src/components/loading-page.tsx:18`

```tsx
<div className="w-20 h-20 rounded-2xl border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10 animate-[logo-breathe_2.5s_ease-in-out_infinite]" style={{ background: 'var(--erp-bg-card, 
```

### gradient
`artifacts/erp-system/src/components/loading-page.tsx:18`

```tsx
<div className="w-20 h-20 rounded-2xl border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10 animate-[logo-breathe_2.5s_ease-in-out_infinite]" style={{ background: 'var(--erp-bg-card, 
```

### hardcoded_hex
`artifacts/erp-system/src/components/loading-page.tsx:20`

```tsx
<rect x="20" y="16" width="140" height="4" rx="2" fill="#F59E0B"/>
```

### hardcoded_hex
`artifacts/erp-system/src/components/loading-page.tsx:21`

```tsx
<text x="90" y="115" fontFamily="Arial, sans-serif" fontSize="88" fontWeight="bold" textAnchor="middle" fill="#F59E0B">م</text>
```

### hardcoded_hex
`artifacts/erp-system/src/components/loading-page.tsx:22`

```tsx
<circle cx="90" cy="148" r="6" fill="#F59E0B" opacity="0.7"/>
```

### inline_style
`artifacts/erp-system/src/components/loading-page.tsx:31`

```tsx
<h1 className="text-2xl font-bold text-[var(--erp-text-1)] tracking-wide" style={{ fontFamily: 'Tajawal, sans-serif' }}>
```

### inline_style
`artifacts/erp-system/src/components/loading-page.tsx:45`

```tsx
<p className="text-sm text-[var(--erp-text-3)] mt-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:48`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:49`

```tsx
position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:55`

```tsx
<div style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:56`

```tsx
background: '#0f1729', border: '1px solid rgba(255,255,255,0.10)',
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:56`

```tsx
background: '#0f1729', border: '1px solid rgba(255,255,255,0.10)',
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:61`

```tsx
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:62`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:63`

```tsx
<div style={{
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:65`

```tsx
background: 'rgba(239,68,68,0.12)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:68`

```tsx
<LogOut style={{ width: 18, height: 18, color: '#ef4444' }} />
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:68`

```tsx
<LogOut style={{ width: 18, height: 18, color: '#ef4444' }} />
```

### hardcoded_hex
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:70`

```tsx
<h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:70`

```tsx
<h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:76`

```tsx
style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.40)', cursor: 'pointer', padding: 4 }}
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:76`

```tsx
style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.40)', cursor: 'pointer', padding: 4 }}
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:78`

```tsx
<X style={{ width: 18, height: 18 }} />
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:84`

```tsx
<p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:87`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:91`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:94`

```tsx
background: 'linear-gradient(135deg, #10b981, #059669)',
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:94`

```tsx
background: 'linear-gradient(135deg, #10b981, #059669)',
```

### gradient
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:94`

```tsx
background: 'linear-gradient(135deg, #10b981, #059669)',
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:98`

```tsx
{loading ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <LogIn style={{ width: 15, height: 15 }} />}
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:103`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:106`

```tsx
background: 'rgba(99,102,241,0.08)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:107`

```tsx
color: '#818cf8', fontSize: 14, fontWeight: 600,
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:114`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:117`

```tsx
background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:127`

```tsx
<p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:130`

```tsx
<div style={{ display: 'flex', gap: 10 }}>
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:133`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:136`

```tsx
background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:137`

```tsx
color: '#ef4444', fontSize: 14, fontWeight: 700,
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:140`

```tsx
<LogOut style={{ width: 15, height: 15 }} />
```

### inline_style
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:145`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/logout-checkout-modal.tsx:148`

```tsx
background: 'rgba(255,255,255,0.04)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/CloseSafeModal.tsx:96`

```tsx
table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#1a1a2e;color:white;padding:6px 10px;text-align:right;font-size:11px}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/CloseSafeModal.tsx:97`

```tsx
td{padding:5px 10px;border-bottom:1px solid #eee}.tr td{font-weight:bold;background:#f5f5f5}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/CloseSafeModal.tsx:99`

```tsx
.sm{background:#f9f9f9;padding:10px;border-radius:6px;margin-top:12px}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/CloseSafeModal.tsx:128`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:59`

```tsx
${g.receiptData.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(g.receiptData.problem_description)}</div>` : ""}
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:119`

```tsx
style={{ background: "rgba(0,0,0,0.88)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:119`

```tsx
style={{ background: "rgba(0,0,0,0.88)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:124`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:124`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}>
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:124`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:130`

```tsx
style={{ background: "rgba(132,204,22,0.15)", border: "1px solid rgba(163,230,53,0.3)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:130`

```tsx
style={{ background: "rgba(132,204,22,0.15)", border: "1px solid rgba(163,230,53,0.3)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:148`

```tsx
style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:148`

```tsx
style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(96,165,250,0.25)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:307`

```tsx
style={{ background: g.totalRem > 0 ? "rgba(245,158,11,0.10)" : "rgba(16,185,129,0.10)", border: `1px solid ${g.totalRem > 0 ? "rgba(245,158,11,0.3)" : "rgba(52,211,153,0.3)"}` }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:331`

```tsx
style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:331`

```tsx
style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:336`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:336`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:343`

```tsx
style={{ background: "rgba(59,130,246,0.75)", border: "1px solid rgba(96,165,250,0.45)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:343`

```tsx
style={{ background: "rgba(59,130,246,0.75)", border: "1px solid rgba(96,165,250,0.45)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:348`

```tsx
style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryGateModal.tsx:348`

```tsx
style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:148`

```tsx
${data.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(data.problem_description)}</div>` : ""}
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:217`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:217`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:223`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:223`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:223`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:257`

```tsx
<div className="rounded-xl border border-[var(--erp-border)] p-4 text-[11px] space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:257`

```tsx
<div className="rounded-xl border border-[var(--erp-border)] p-4 text-[11px] space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:293`

```tsx
style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:293`

```tsx
style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:301`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/DeliveryReceiptModal.tsx:301`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:162`

```tsx
th{background:#f5f5f5;font-weight:bold;}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:178`

```tsx
${data.problem_description ? `<div style="margin-top:6px;padding:4px;background:#f5f5f5;border-radius:4px;"><strong>المشكلة:</strong> ${esc(data.problem_description)}</div>` : ""}
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:298`

```tsx
style={{ background: "rgba(0,0,0,0.85)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:298`

```tsx
style={{ background: "rgba(0,0,0,0.85)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:304`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:304`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:304`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:340`

```tsx
<div className="rounded-xl border border-[var(--erp-border)] p-4 text-[11px] space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:340`

```tsx
<div className="rounded-xl border border-[var(--erp-border)] p-4 text-[11px] space-y-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:355`

```tsx
<div key={sv.id} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:355`

```tsx
<div key={sv.id} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:423`

```tsx
<option key={s.id} value={s.id} className="bg-[#1a1530]">
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:423`

```tsx
<option key={s.id} value={s.id} className="bg-[#1a1530]">
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:473`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:473`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:482`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:482`

```tsx
style={{ background: "rgba(59,130,246,0.7)", border: "1px solid rgba(96,165,250,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:491`

```tsx
style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:491`

```tsx
style={{ background: "rgba(34,197,94,0.7)", border: "1px solid rgba(74,222,128,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:500`

```tsx
style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/FinalInvoiceModal.tsx:500`

```tsx
style={{ background: "rgba(16,185,129,0.75)", border: "1px solid rgba(52,211,153,0.45)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/PaymentModal.tsx:90`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
```

### inline_style
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:201`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:201`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:207`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:207`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:207`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:289`

```tsx
<section className="rounded-xl border border-cyan-400/25 p-3" style={{ background: "rgba(34,211,238,0.05)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:289`

```tsx
<section className="rounded-xl border border-cyan-400/25 p-3" style={{ background: "rgba(34,211,238,0.05)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:344`

```tsx
style={{ background: "rgba(255,255,255,0.02)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:344`

```tsx
style={{ background: "rgba(255,255,255,0.02)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:384`

```tsx
<section className="rounded-xl border border-amber-400/20 p-3" style={{ background: "rgba(245,158,11,0.04)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:384`

```tsx
<section className="rounded-xl border border-amber-400/20 p-3" style={{ background: "rgba(245,158,11,0.04)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:435`

```tsx
style={{ background: "rgba(132,204,22,0.7)", border: "1px solid rgba(163,230,53,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/PreDeliveryModal.tsx:435`

```tsx
style={{ background: "rgba(132,204,22,0.7)", border: "1px solid rgba(163,230,53,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:313`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:313`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:319`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:319`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:319`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:413`

```tsx
<div className="sticky top-0 z-10 px-4 py-2.5 border-b border-[var(--erp-border)] bg-indigo-500/10 backdrop-blur">
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:467`

```tsx
<div className="sticky top-0 z-10 px-4 py-2.5 border-b border-[var(--erp-border)] bg-purple-500/10 backdrop-blur">
```

### inline_style
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:677`

```tsx
style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:677`

```tsx
style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:707`

```tsx
style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/QualityCheckModal.tsx:707`

```tsx
style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ReadyForDeliveryModal.tsx:246`

```tsx
style={{ background: "rgba(0,0,0,0.82)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ReadyForDeliveryModal.tsx:246`

```tsx
style={{ background: "rgba(0,0,0,0.82)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ReadyForDeliveryModal.tsx:252`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ReadyForDeliveryModal.tsx:252`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/ReadyForDeliveryModal.tsx:252`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ReadyForDeliveryModal.tsx:259`

```tsx
style={{
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/ReceiptModal.tsx:93`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:119`

```tsx
style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:119`

```tsx
style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:119`

```tsx
style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:125`

```tsx
style={{ background: "rgba(10,8,25,0.98)", borderColor: "rgba(239,68,68,0.3)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:125`

```tsx
style={{ background: "rgba(10,8,25,0.98)", borderColor: "rgba(239,68,68,0.3)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:128`

```tsx
<div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:130`

```tsx
<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:130`

```tsx
<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:148`

```tsx
<div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:148`

```tsx
<div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:158`

```tsx
style={{ background: "rgba(16,185,129,0.4)", border: "1px solid rgba(16,185,129,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:158`

```tsx
style={{ background: "rgba(16,185,129,0.4)", border: "1px solid rgba(16,185,129,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:178`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:178`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:195`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:195`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.3)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:197`

```tsx
<option value="" className="bg-[#1a1530]">— اختر الخزنة —</option>
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:197`

```tsx
<option value="" className="bg-[#1a1530]">— اختر الخزنة —</option>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:199`

```tsx
<option key={s.id} value={s.id} className="bg-[#1a1530]">
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:199`

```tsx
<option key={s.id} value={s.id} className="bg-[#1a1530]">
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:219`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:219`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:234`

```tsx
style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:234`

```tsx
style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:278`

```tsx
<div className="rounded-xl p-3 text-center text-[11px] text-[var(--erp-text-3)]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:278`

```tsx
<div className="rounded-xl p-3 text-center text-[11px] text-[var(--erp-text-3)]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:292`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:292`

```tsx
style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:297`

```tsx
<div className="flex items-center gap-1.5 p-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:297`

```tsx
<div className="flex items-center gap-1.5 p-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:310`

```tsx
style={{ background: "rgba(239,68,68,0.55)", border: "1px solid rgba(239,68,68,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:310`

```tsx
style={{ background: "rgba(239,68,68,0.55)", border: "1px solid rgba(239,68,68,0.4)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/RepairReturnModal.tsx:319`

```tsx
style={{ borderColor: "rgba(255,255,255,0.12)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:101`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:101`

```tsx
style={{ background: "rgba(0,0,0,0.78)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:107`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:107`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:107`

```tsx
style={{ background: "rgba(15,12,30,0.97)", backdropFilter: "blur(20px)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:153`

```tsx
<option key={s.id} value={s.id} className="bg-[#1a1530]">
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:153`

```tsx
<option key={s.id} value={s.id} className="bg-[#1a1530]">
```

### inline_style
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:190`

```tsx
style={{ background: "rgba(14,165,233,0.7)", border: "1px solid rgba(56,189,248,0.4)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ShippingCostModal.tsx:190`

```tsx
style={{ background: "rgba(14,165,233,0.7)", border: "1px solid rgba(56,189,248,0.4)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/TransferModal.tsx:84`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:75`

```tsx
style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:75`

```tsx
style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:75`

```tsx
style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:83`

```tsx
style={{ background: 'rgba(10,8,25,0.98)', borderColor: 'rgba(139,92,246,0.35)' }}
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:83`

```tsx
style={{ background: 'rgba(10,8,25,0.98)', borderColor: 'rgba(139,92,246,0.35)' }}
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:88`

```tsx
style={{ borderColor: 'rgba(255,255,255,0.07)' }}
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:93`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:94`

```tsx
background: 'rgba(139,92,246,0.2)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:117`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:118`

```tsx
background: 'rgba(16,185,129,0.15)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:135`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:136`

```tsx
background: 'rgba(139,92,246,0.6)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:146`

```tsx
style={{ borderColor: 'rgba(255,255,255,0.12)' }}
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:162`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:163`

```tsx
background: 'rgba(255,255,255,0.04)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:190`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:191`

```tsx
background: 'rgba(255,255,255,0.05)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:208`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:209`

```tsx
background: 'rgba(255,255,255,0.05)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:218`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:219`

```tsx
background: 'rgba(139,92,246,0.08)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:238`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:239`

```tsx
background: 'rgba(239,68,68,0.1)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:253`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:254`

```tsx
background: 'rgba(139,92,246,0.65)',
```

### inline_style
`artifacts/erp-system/src/components/modals/WarrantyModal.tsx:273`

```tsx
style={{ borderColor: 'rgba(255,255,255,0.12)' }}
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:106`

```tsx
style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:106`

```tsx
style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:150`

```tsx
style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 200, overflowY: "auto" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:150`

```tsx
style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 200, overflowY: "auto" }}>
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:150`

```tsx
style={{ background: "rgba(20,16,40,0.98)", backdropFilter: "blur(12px)", maxHeight: 200, overflowY: "auto" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:161`

```tsx
<div style={{ width: 56 }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:166`

```tsx
<div style={{ width: 80 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:174`

```tsx
style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:174`

```tsx
style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:174`

```tsx
style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(96,165,250,0.3)", color: "#93C5FD" }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:182`

```tsx
style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(192,132,252,0.3)", color: "#D8B4FE" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:182`

```tsx
style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(192,132,252,0.3)", color: "#D8B4FE" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:182`

```tsx
style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(192,132,252,0.3)", color: "#D8B4FE" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:189`

```tsx
style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:189`

```tsx
style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:203`

```tsx
<div style={{ width: 110 }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:214`

```tsx
<div style={{ width: 110 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:251`

```tsx
style={{ background: "rgba(168,85,247,0.25)", border: "1px solid rgba(192,132,252,0.4)", color: "#E9D5FF" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:251`

```tsx
style={{ background: "rgba(168,85,247,0.25)", border: "1px solid rgba(192,132,252,0.4)", color: "#E9D5FF" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:251`

```tsx
style={{ background: "rgba(168,85,247,0.25)", border: "1px solid rgba(192,132,252,0.4)", color: "#E9D5FF" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:265`

```tsx
? { background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.22)" }
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:266`

```tsx
: { background: "rgba(59,130,246,0.06)",  border: "1px solid rgba(59,130,246,0.15)" };
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:272`

```tsx
style={{ background: "rgba(239,68,68,0.08)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:272`

```tsx
style={{ background: "rgba(239,68,68,0.08)" }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:277`

```tsx
style={{ background: "rgba(168,85,247,0.2)", color: "#E9D5FF", border: "1px solid rgba(192,132,252,0.35)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:277`

```tsx
style={{ background: "rgba(168,85,247,0.2)", color: "#E9D5FF", border: "1px solid rgba(192,132,252,0.35)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:277`

```tsx
style={{ background: "rgba(168,85,247,0.2)", color: "#E9D5FF", border: "1px solid rgba(192,132,252,0.35)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:314`

```tsx
style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:314`

```tsx
style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:326`

```tsx
style={{ background: "rgba(239,68,68,0.08)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:326`

```tsx
style={{ background: "rgba(239,68,68,0.08)" }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:347`

```tsx
style={{ width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`, background: payIsDone ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FBBF24)" }} />
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:347`

```tsx
style={{ width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`, background: payIsDone ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FBBF24)" }} />
```

### gradient
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:347`

```tsx
style={{ width: `${Math.min(100, (paidSoFar / grandTotal) * 100)}%`, background: payIsDone ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#F59E0B,#FBBF24)" }} />
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:371`

```tsx
<div className="relative shrink-0" style={{ width: 96 }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:382`

```tsx
style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(52,211,153,0.3)", color: "#6EE7B7" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:382`

```tsx
style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(52,211,153,0.3)", color: "#6EE7B7" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:382`

```tsx
style={{ background: "rgba(16,185,129,0.18)", border: "1px solid rgba(52,211,153,0.3)", color: "#6EE7B7" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:388`

```tsx
style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
```

### inline_background
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:388`

```tsx
style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/delivery-gate/DeliveryGateForm.tsx:410`

```tsx
<div style={{ width: 110 }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:208`

```tsx
style={{ background: "rgba(239,68,68,0.08)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:208`

```tsx
style={{ background: "rgba(239,68,68,0.08)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:231`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:234`

```tsx
? "linear-gradient(90deg,#10B981,#34D399)"
```

### gradient
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:234`

```tsx
? "linear-gradient(90deg,#10B981,#34D399)"
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:235`

```tsx
: "linear-gradient(90deg,#F59E0B,#FBBF24)",
```

### gradient
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:235`

```tsx
: "linear-gradient(90deg,#F59E0B,#FBBF24)",
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:272`

```tsx
<div className="relative shrink-0" style={{ width: 100 }}>
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:289`

```tsx
style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:289`

```tsx
style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:297`

```tsx
style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:297`

```tsx
style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:363`

```tsx
style={{ background: "rgba(132,204,22,0.85)", border: "1px solid rgba(163,230,53,0.5)", color: "#0d1f00" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:363`

```tsx
style={{ background: "rgba(132,204,22,0.85)", border: "1px solid rgba(163,230,53,0.5)", color: "#0d1f00" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:363`

```tsx
style={{ background: "rgba(132,204,22,0.85)", border: "1px solid rgba(163,230,53,0.5)", color: "#0d1f00" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:366`

```tsx
? <><Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#0d1f00" }} /> جارٍ الحفظ...</>
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/BillingPhase.tsx:366`

```tsx
? <><Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#0d1f00" }} /> جارٍ الحفظ...</>
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:80`

```tsx
style={{ background: "rgba(132,204,22,0.2)", border: "1px solid rgba(163,230,53,0.3)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:80`

```tsx
style={{ background: "rgba(132,204,22,0.2)", border: "1px solid rgba(163,230,53,0.3)" }}
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:95`

```tsx
<div className="sticky top-0 z-10 px-4 py-2.5 border-b border-[var(--erp-border)] bg-purple-500/10 backdrop-blur">
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:188`

```tsx
<div className="sticky top-0 z-10 px-4 py-2.5 border-b border-[var(--erp-border)] bg-indigo-500/10 backdrop-blur">
```

### backdrop_blur
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:217`

```tsx
<div className="sticky top-0 z-10 px-4 py-2.5 border-b border-[var(--erp-border)] bg-purple-500/10 backdrop-blur">
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:344`

```tsx
style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:344`

```tsx
style={{ background: "rgba(16,185,129,0.85)", border: "1px solid rgba(52,211,153,0.5)" }}
```

### inline_style
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:372`

```tsx
style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
```

### inline_background
`artifacts/erp-system/src/components/modals/ready-for-delivery/QcPhase.tsx:372`

```tsx
style={{ background: "rgba(239,68,68,0.85)", border: "1px solid rgba(248,113,113,0.5)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:202`

```tsx
const bgPanel  = isDark ? '#161f30' : '#ffffff';
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:209`

```tsx
<div ref={dropdownRef} style={{ position: 'relative' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:214`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:227`

```tsx
<Inbox style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:229`

```tsx
<span style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:232`

```tsx
background: '#f59e0b', color: '#fff',
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:232`

```tsx
background: '#f59e0b', color: '#fff',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:241`

```tsx
<div style={{
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:251`

```tsx
<div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:252`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:253`

```tsx
<span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>رسائلي</span>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:255`

```tsx
<span style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:257`

```tsx
background: 'rgba(245,158,11,0.14)', color: '#f59e0b',
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:257`

```tsx
background: 'rgba(245,158,11,0.14)', color: '#f59e0b',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:261`

```tsx
<div style={{ display: 'flex', gap: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:266`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:268`

```tsx
border: `1px solid ${border}`, background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:274`

```tsx
<RefreshCw style={{ width: 10, height: 10 }} /> تحديث
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:279`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:281`

```tsx
border: `1px solid ${border}`, background: 'transparent',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:286`

```tsx
<Check style={{ width: 10, height: 10 }} /> قراءة الكل
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:293`

```tsx
<div style={{ overflowY: 'auto', flex: 1 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:320`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:322`

```tsx
background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
```

### backdrop_blur
`artifacts/erp-system/src/components/notification-bell.tsx:322`

```tsx
background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:328`

```tsx
<div style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:329`

```tsx
background: isDark ? '#1a2540' : '#ffffff',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:336`

```tsx
<div style={{
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:342`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:343`

```tsx
<div style={{ fontSize: 22 }}>💰</div>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:345`

```tsx
<div style={{ fontSize: 14, fontWeight: 800, color: isDark ? '#fff' : '#111' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:348`

```tsx
<div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', marginTop: 2 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:355`

```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 6 }}
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:355`

```tsx
style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 6 }}
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:357`

```tsx
<X style={{ width: 16, height: 16 }} />
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:362`

```tsx
<div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:363`

```tsx
<div style={{ fontSize: 13, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:369`

```tsx
<div style={{ textAlign: 'center', padding: '24px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 13 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:376`

```tsx
<div style={{
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:378`

```tsx
background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:379`

```tsx
fontSize: 12, color: '#ef4444',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:387`

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:395`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:398`

```tsx
border: `2px solid ${isSelected ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:405`

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:406`

```tsx
<div style={{
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:411`

```tsx
<div style={{ textAlign: 'right' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:412`

```tsx
<div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fff' : '#111' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:415`

```tsx
<div style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', marginTop: 2 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:420`

```tsx
<div style={{ textAlign: 'left' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:421`

```tsx
<div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.85)' : '#111'), fontVariantNumeric: 'tabular-nums' }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:421`

```tsx
<div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.85)' : '#111'), fontVariantNumeric: 'tabular-nums' }}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:425`

```tsx
<div style={{ fontSize: 10, color: '#22c55e', marginTop: 2, textAlign: 'left' }}>✓ محدد</div>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:425`

```tsx
<div style={{ fontSize: 10, color: '#22c55e', marginTop: 2, textAlign: 'left' }}>✓ محدد</div>
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:436`

```tsx
<div style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:436`

```tsx
<div style={{ fontSize: 11, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:443`

```tsx
<div style={{
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:450`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notification-bell.tsx:454`

```tsx
: '#22c55e',
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:465`

```tsx
? <><RefreshCw style={{ width: 13, height: 13 }} /> جاري الاعتماد...</>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:466`

```tsx
: <><Check style={{ width: 13, height: 13 }} /> اعتماد وصرف السلفة</>
```

### inline_style
`artifacts/erp-system/src/components/notification-bell.tsx:472`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/notification-bell.tsx:475`

```tsx
background: 'transparent',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:31`

```tsx
advance_pending:   '#f59e0b',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:32`

```tsx
advance_approved:  '#22c55e',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:33`

```tsx
advance_rejected:  '#ef4444',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:34`

```tsx
bonus_granted:     '#22c55e',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:35`

```tsx
deduction_added:   '#ef4444',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:36`

```tsx
custody_settled:   '#3b82f6',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:37`

```tsx
custody_assigned:  '#a78bfa',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:38`

```tsx
transfer_request:  '#a78bfa',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:39`

```tsx
transfer_approved: '#3b82f6',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:40`

```tsx
transfer_shipped:  '#f59e0b',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:41`

```tsx
transfer_received: '#22c55e',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:42`

```tsx
generic:           '#94a3b8',
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:92`

```tsx
const color = TYPE_COLOR[n.type] ?? '#94a3b8';
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:98`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:110`

```tsx
<div style={{
```

### inline_background
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:113`

```tsx
background: `${color}22`, fontSize: 14,
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:115`

```tsx
<div style={{ flex: 1, minWidth: 0 }}>
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:116`

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:117`

```tsx
<div style={{
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:121`

```tsx
<span style={{ fontSize: 10, color: textSub, flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:123`

```tsx
<div style={{
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:128`

```tsx
<span style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:130`

```tsx
fontSize: 9, color: '#f59e0b', fontWeight: 700,
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:136`

```tsx
<div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:140`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:143`

```tsx
background: '#22c55e', color: '#fff',
```

### inline_background
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:143`

```tsx
background: '#22c55e', color: '#fff',
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:149`

```tsx
<Wallet style={{ width: 10, height: 10 }} />
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:155`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:158`

```tsx
background: '#ef4444', color: '#fff',
```

### inline_background
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:158`

```tsx
background: '#ef4444', color: '#fff',
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:164`

```tsx
<X style={{ width: 10, height: 10 }} />
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:174`

```tsx
style={{ marginTop: 8 }}
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:182`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:191`

```tsx
<div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:195`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:198`

```tsx
background: '#ef4444', color: '#fff',
```

### inline_background
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:198`

```tsx
background: '#ef4444', color: '#fff',
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:207`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/notifications/NotificationItem.tsx:210`

```tsx
background: 'transparent', color: textSub,
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationList.tsx:52`

```tsx
<div style={{ padding: '36px 16px', textAlign: 'center', color: textSub, fontSize: 13 }}>
```

### inline_style
`artifacts/erp-system/src/components/notifications/NotificationList.tsx:53`

```tsx
<div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
```

### backdrop_blur
`artifacts/erp-system/src/components/onboarding.tsx:113`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
```

### inline_style
`artifacts/erp-system/src/components/onboarding.tsx:142`

```tsx
style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06), rgba(255,255,255,0.02))" }}>
```

### inline_background
`artifacts/erp-system/src/components/onboarding.tsx:142`

```tsx
style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06), rgba(255,255,255,0.02))" }}>
```

### gradient
`artifacts/erp-system/src/components/onboarding.tsx:142`

```tsx
style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06), rgba(255,255,255,0.02))" }}>
```

### inline_style
`artifacts/erp-system/src/components/onboarding.tsx:156`

```tsx
style={{ width: `${(doneCount / 3) * 100}%` }} />
```

### backdrop_blur
`artifacts/erp-system/src/components/product-form-modal.tsx:267`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-overlay">
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:236`

```tsx
background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.10) 100%)",
```

### gradient
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:236`

```tsx
background: "linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(217,119,6,0.10) 100%)",
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:238`

```tsx
color: "#92400e",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:241`

```tsx
background: "linear-gradient(135deg, rgba(245,158,11,0.28) 0%, rgba(217,119,6,0.12) 100%)",
```

### gradient
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:241`

```tsx
background: "linear-gradient(135deg, rgba(245,158,11,0.28) 0%, rgba(217,119,6,0.12) 100%)",
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:243`

```tsx
color: "#fef3c7",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:247`

```tsx
background: "rgba(0,0,0,0.04)",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:251`

```tsx
background: "rgba(255,255,255,0.04)",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:256`

```tsx
background: "rgba(245,158,11,0.12)",
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:258`

```tsx
color: "#92400e",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:260`

```tsx
background: "rgba(245,158,11,0.15)",
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:262`

```tsx
color: "#fde68a",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:265`

```tsx
background: "rgba(0,0,0,0.04)",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:269`

```tsx
background: "rgba(255,255,255,0.03)",
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:279`

```tsx
style={{
```

### gradient
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:281`

```tsx
? "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.02) 60%, transparent 100%)"
```

### gradient
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:282`

```tsx
: "linear-gradient(180deg, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0.01) 60%, transparent 100%)",
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:317`

```tsx
? { background: "rgba(245,158,11,0.15)", color: "#92400e", border: "1px solid rgba(245,158,11,0.30)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:317`

```tsx
? { background: "rgba(245,158,11,0.15)", color: "#92400e", border: "1px solid rgba(245,158,11,0.30)" }
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:318`

```tsx
: { background: "rgba(0,0,0,0.25)", color: "#fde68a", border: "1px solid rgba(252,211,77,0.25)" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:318`

```tsx
: { background: "rgba(0,0,0,0.25)", color: "#fde68a", border: "1px solid rgba(252,211,77,0.25)" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:330`

```tsx
? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)", color: "rgba(15,23,42,0.45)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:331`

```tsx
: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:340`

```tsx
style={{ borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.06)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:357`

```tsx
? { background: "rgba(245,158,11,0.15)", color: "#92400e" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:357`

```tsx
? { background: "rgba(245,158,11,0.15)", color: "#92400e" }
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:358`

```tsx
: { background: "rgba(0,0,0,0.25)", color: "#fde68a" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:358`

```tsx
: { background: "rgba(0,0,0,0.25)", color: "#fde68a" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:371`

```tsx
? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "rgba(15,23,42,0.40)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:372`

```tsx
: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:385`

```tsx
<div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={isLight ? { borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" } : { borderBottom: "1px solid rgba(255,255,255,0.08)", backgrou
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:414`

```tsx
<div className="flex items-center gap-2 px-4 py-2.5 shrink-0" style={isLight ? { borderBottom: "1px solid rgba(0,0,0,0.08)", background: "rgba(0,0,0,0.02)" } : { borderBottom: "1px solid rgba(255,255,255,0.08)", backgrou
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:445`

```tsx
? { background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.08)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:446`

```tsx
: { background: "rgba(255,255,255,0.012)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:452`

```tsx
? { background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:453`

```tsx
: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:485`

```tsx
? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:486`

```tsx
: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)" }}
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:496`

```tsx
? { background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)" }
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:497`

```tsx
: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:507`

```tsx
background: "#1e293b",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:507`

```tsx
background: "#1e293b",
```

### backdrop_blur
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:508`

```tsx
backdropFilter: "blur(20px)",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:513`

```tsx
background: "rgba(15,19,32,0.98)",
```

### backdrop_blur
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:514`

```tsx
backdropFilter: "blur(20px)",
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:540`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:541`

```tsx
background: "linear-gradient(135deg, rgba(245,158,11,0.85), rgba(217,119,6,0.65))",
```

### gradient
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:541`

```tsx
background: "linear-gradient(135deg, rgba(245,158,11,0.85), rgba(217,119,6,0.65))",
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:619`

```tsx
style={isLight ? { background: "rgba(0,0,0,0.025)" } : undefined}>
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:621`

```tsx
style={isLight ? { color: "#b45309" } : undefined}
```

### hardcoded_hex
`artifacts/erp-system/src/components/repair-settings/ChecklistTab.tsx:624`

```tsx
style={isLight ? { color: "#b45309" } : undefined}
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:135`

```tsx
style={{ background: `${c.color}22`, borderColor: `${c.color}40` }}>
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:135`

```tsx
style={{ background: `${c.color}22`, borderColor: `${c.color}40` }}>
```

### backdrop_blur
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:311`

```tsx
<div className="fixed inset-0 z-[70] flex items-start justify-center pt-8 pb-8 bg-black/70 backdrop-blur-md" dir="rtl"
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:314`

```tsx
style={{ maxWidth: 580, maxHeight: "90vh" }}>
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:319`

```tsx
style={{ background: `${color}22`, border: `1px solid ${color}40` }}>
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:319`

```tsx
style={{ background: `${color}22`, border: `1px solid ${color}40` }}>
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:320`

```tsx
<PreviewIcon className="w-4 h-4" style={{ color }} />
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:335`

```tsx
style={{ background: `linear-gradient(135deg, ${color}22, transparent)`, borderColor: `${color}40` }}>
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:335`

```tsx
style={{ background: `linear-gradient(135deg, ${color}22, transparent)`, borderColor: `${color}40` }}>
```

### gradient
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:335`

```tsx
style={{ background: `linear-gradient(135deg, ${color}22, transparent)`, borderColor: `${color}40` }}>
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:337`

```tsx
<PreviewIcon className="w-4 h-4" style={{ color }} />
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:338`

```tsx
<span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: `${color}cc` }}>
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:342`

```tsx
<div className="text-3xl font-black leading-none tracking-tight" style={{ color }}>
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:345`

```tsx
<div className="h-1 rounded-full mt-1" style={{ background: `${color}33` }}>
```

### inline_background
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:345`

```tsx
<div className="h-1 rounded-full mt-1" style={{ background: `${color}33` }}>
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:346`

```tsx
<div className="h-full rounded-full transition-all" style={{ width: "40%", background: color }} />
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:381`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:413`

```tsx
<span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
```

### inline_style
`artifacts/erp-system/src/components/repair-settings/DashboardCardsTab.tsx:447`

```tsx
style={{
```

### tailwind_white_bg
`artifacts/erp-system/src/components/repair-settings/DeviceModelsTab.tsx:95`

```tsx
? "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
```

### tailwind_white_bg
`artifacts/erp-system/src/components/repair-settings/DeviceModelsTab.tsx:98`

```tsx
? "px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
```

### tailwind_white_bg
`artifacts/erp-system/src/components/repair-settings/ServiceTypesTab.tsx:196`

```tsx
className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${value.is_active ? 'right-0.5' : 'left-0.5'}`}
```

### inline_style
`artifacts/erp-system/src/components/searchable-select.tsx:126`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/searchable-select.tsx:139`

```tsx
style={{ borderBottom: "1px solid var(--erp-border)", color: "var(--erp-text-3)" }}
```

### inline_style
`artifacts/erp-system/src/components/searchable-select.tsx:194`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/searchable-select.tsx:195`

```tsx
background: "transparent",
```

### inline_style
`artifacts/erp-system/src/components/searchable-select.tsx:223`

```tsx
style={{ color: "var(--erp-text-3)", flexShrink: 0, padding: "0.125rem" }}
```

### inline_style
`artifacts/erp-system/src/components/searchable-select.tsx:231`

```tsx
style={{ color: "var(--erp-text-3)" }}
```

### inline_style
`artifacts/erp-system/src/components/skeletons.tsx:17`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/subscription-banner.tsx:4`

```tsx
* • 8-14 days  → yellow banner (#FEF3C7)
```

### hardcoded_hex
`artifacts/erp-system/src/components/subscription-banner.tsx:5`

```tsx
* • 1-7 days   → orange banner (#FED7AA) with ⚠️ icon
```

### hardcoded_hex
`artifacts/erp-system/src/components/subscription-banner.tsx:76`

```tsx
const bg       = isOrange ? "#FED7AA" : "#FEF3C7";
```

### hardcoded_hex
`artifacts/erp-system/src/components/subscription-banner.tsx:77`

```tsx
const text     = isOrange ? "#7C2D12" : "#78350F";
```

### hardcoded_hex
`artifacts/erp-system/src/components/subscription-banner.tsx:78`

```tsx
const border   = isOrange ? "#FB923C" : "#FCD34D";
```

### inline_style
`artifacts/erp-system/src/components/subscription-banner.tsx:89`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/subscription-banner.tsx:98`

```tsx
<div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
```

### inline_style
`artifacts/erp-system/src/components/subscription-banner.tsx:99`

```tsx
{isOrange && <span style={{ fontSize: "16px" }}>⚠️</span>}
```

### inline_style
`artifacts/erp-system/src/components/subscription-banner.tsx:107`

```tsx
<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
```

### inline_style
`artifacts/erp-system/src/components/subscription-banner.tsx:113`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/components/subscription-banner.tsx:115`

```tsx
background: isOrange ? "#EA580C" : "#D97706",
```

### inline_style
`artifacts/erp-system/src/components/subscription-banner.tsx:126`

```tsx
style={{ background: "none", border: "none", cursor: "pointer", color: text, opacity: 0.7, padding: "2px" }}
```

### inline_background
`artifacts/erp-system/src/components/subscription-banner.tsx:126`

```tsx
style={{ background: "none", border: "none", cursor: "pointer", color: text, opacity: 0.7, padding: "2px" }}
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:15`

```tsx
style={{ width: 80, height: 36 }}
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:20`

```tsx
style={{
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:34`

```tsx
style={{ width: 36, height: 36, opacity: isDark ? 1 : 0.35, transition: "opacity 0.3s" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/theme-toggle.tsx:39`

```tsx
style={{ color: isDark ? "#fcd34d" : "#94a3b8" }}
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:39`

```tsx
style={{ color: isDark ? "#fcd34d" : "#94a3b8" }}
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:47`

```tsx
style={{ width: 36, height: 36, opacity: isDark ? 0.35 : 1, transition: "opacity 0.3s" }}
```

### hardcoded_hex
`artifacts/erp-system/src/components/theme-toggle.tsx:52`

```tsx
style={{ color: isDark ? "#64748b" : "#f59e0b" }}
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:52`

```tsx
style={{ color: isDark ? "#64748b" : "#f59e0b" }}
```

### inline_style
`artifacts/erp-system/src/components/theme-toggle.tsx:60`

```tsx
style={{
```

### inline_background
`artifacts/erp-system/src/components/theme-toggle.tsx:65`

```tsx
background: "white",
```

### hardcoded_hex
`artifacts/erp-system/src/components/ui/toast.tsx:39`

```tsx
"bg-[#0D1424]/95 border-emerald-500/30 backdrop-blur-md [--progress-color:theme(colors.emerald.500)]",
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/ui/toast.tsx:39`

```tsx
"bg-[#0D1424]/95 border-emerald-500/30 backdrop-blur-md [--progress-color:theme(colors.emerald.500)]",
```

### backdrop_blur
`artifacts/erp-system/src/components/ui/toast.tsx:39`

```tsx
"bg-[#0D1424]/95 border-emerald-500/30 backdrop-blur-md [--progress-color:theme(colors.emerald.500)]",
```

### hardcoded_hex
`artifacts/erp-system/src/components/ui/toast.tsx:41`

```tsx
"bg-[#0D1424]/95 border-red-500/30 backdrop-blur-md [--progress-color:theme(colors.red.500)]",
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/ui/toast.tsx:41`

```tsx
"bg-[#0D1424]/95 border-red-500/30 backdrop-blur-md [--progress-color:theme(colors.red.500)]",
```

### backdrop_blur
`artifacts/erp-system/src/components/ui/toast.tsx:41`

```tsx
"bg-[#0D1424]/95 border-red-500/30 backdrop-blur-md [--progress-color:theme(colors.red.500)]",
```

### hardcoded_hex
`artifacts/erp-system/src/components/ui/toast.tsx:43`

```tsx
"bg-[#0D1424]/95 border-amber-500/30 backdrop-blur-md [--progress-color:theme(colors.amber.500)]",
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/ui/toast.tsx:43`

```tsx
"bg-[#0D1424]/95 border-amber-500/30 backdrop-blur-md [--progress-color:theme(colors.amber.500)]",
```

### backdrop_blur
`artifacts/erp-system/src/components/ui/toast.tsx:43`

```tsx
"bg-[#0D1424]/95 border-amber-500/30 backdrop-blur-md [--progress-color:theme(colors.amber.500)]",
```

### hardcoded_hex
`artifacts/erp-system/src/components/ui/toast.tsx:45`

```tsx
"bg-[#0D1424]/95 border-blue-500/30 backdrop-blur-md [--progress-color:theme(colors.blue.500)]",
```

### tailwind_arbitrary_bg
`artifacts/erp-system/src/components/ui/toast.tsx:45`

```tsx
"bg-[#0D1424]/95 border-blue-500/30 backdrop-blur-md [--progress-color:theme(colors.blue.500)]",
```

### backdrop_blur
`artifacts/erp-system/src/components/ui/toast.tsx:45`

```tsx
"bg-[#0D1424]/95 border-blue-500/30 backdrop-blur-md [--progress-color:theme(colors.blue.500)]",
```

### inline_style
`artifacts/erp-system/src/components/ui/toaster.tsx:71`

```tsx
style={{
```

### hardcoded_hex
`artifacts/erp-system/src/contexts/app-settings.tsx:154`

```tsx
default: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)',
```

### gradient
`artifacts/erp-system/src/contexts/app-settings.tsx:154`

```tsx
default: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)',
```

### hardcoded_hex
`artifacts/erp-system/src/contexts/app-settings.tsx:155`

```tsx
midnight: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
```

### gradient
`artifacts/erp-system/src/contexts/app-settings.tsx:155`

```tsx
midnight: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
```

### hardcoded_hex
`artifacts/erp-system/src/contexts/app-settings.tsx:156`

```tsx
forest: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)',
```

### gradient
`artifacts/erp-system/src/contexts/app-settings.tsx:156`

```tsx
forest: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)',
```

### hardcoded_hex
`artifacts/erp-system/src/contexts/app-settings.tsx:157`

```tsx
sunset: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f1f 50%, #1a0a0a 100%)',
```

### gradient
`artifacts/erp-system/src/contexts/app-settings.tsx:157`

```tsx
sunset: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f1f 50%, #1a0a0a 100%)',
```

### hardcoded_hex
`artifacts/erp-system/src/contexts/app-settings.tsx:158`

```tsx
ocean: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a0f1a 100%)',
```

### gradient
`artifacts/erp-system/src/contexts/app-settings.tsx:158`

```tsx
ocean: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a0f1a 100%)',
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:127`

```tsx
-webkit-text-fill-color: #1e293b !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:133`

```tsx
-webkit-box-shadow: 0 0 0 1000px #fefcff inset !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:134`

```tsx
-webkit-text-fill-color: #0f0c29 !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:135`

```tsx
caret-color: #0f0c29;
```

### gradient
`artifacts/erp-system/src/index.css:225`

```tsx
background: linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.05) 100%);
```

### gradient
`artifacts/erp-system/src/index.css:226`

```tsx
-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
```

### gradient
`artifacts/erp-system/src/index.css:247`

```tsx
background: var(--card-border-gradient, linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)));
```

### gradient
`artifacts/erp-system/src/index.css:248`

```tsx
-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
```

### gradient
`artifacts/erp-system/src/index.css:258`

```tsx
background: linear-gradient(135deg, hsla(38,95%,55%,0.12) 0%, hsla(225,25%,8%,0.9) 100%);
```

### gradient
`artifacts/erp-system/src/index.css:259`

```tsx
--card-border-gradient: linear-gradient(135deg, rgba(245,158,11,0.3), rgba(255,255,255,0.02));
```

### gradient
`artifacts/erp-system/src/index.css:263`

```tsx
background: linear-gradient(135deg, hsla(160,84%,39%,0.12) 0%, hsla(225,25%,8%,0.9) 100%);
```

### gradient
`artifacts/erp-system/src/index.css:264`

```tsx
--card-border-gradient: linear-gradient(135deg, rgba(16,185,129,0.3), rgba(255,255,255,0.02));
```

### gradient
`artifacts/erp-system/src/index.css:268`

```tsx
background: linear-gradient(135deg, hsla(0,84%,60%,0.10) 0%, hsla(225,25%,8%,0.9) 100%);
```

### gradient
`artifacts/erp-system/src/index.css:269`

```tsx
--card-border-gradient: linear-gradient(135deg, rgba(239,68,68,0.3), rgba(255,255,255,0.02));
```

### gradient
`artifacts/erp-system/src/index.css:273`

```tsx
background: linear-gradient(135deg, hsla(217,91%,60%,0.10) 0%, hsla(225,25%,8%,0.9) 100%);
```

### gradient
`artifacts/erp-system/src/index.css:274`

```tsx
--card-border-gradient: linear-gradient(135deg, rgba(59,130,246,0.3), rgba(255,255,255,0.02));
```

### gradient
`artifacts/erp-system/src/index.css:278`

```tsx
background: linear-gradient(135deg, hsla(262,83%,58%,0.10) 0%, hsla(225,25%,8%,0.9) 100%);
```

### gradient
`artifacts/erp-system/src/index.css:279`

```tsx
--card-border-gradient: linear-gradient(135deg, rgba(139,92,246,0.3), rgba(255,255,255,0.02));
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:285`

```tsx
@apply bg-white/5 text-white placeholder:text-white/30 rounded-xl px-4 py-2 w-full outline-none;
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:285`

```tsx
@apply bg-white/5 text-white placeholder:text-white/30 rounded-xl px-4 py-2 w-full outline-none;
```

### gradient
`artifacts/erp-system/src/index.css:312`

```tsx
background: linear-gradient(
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:329`

```tsx
background-color: #fbbf24;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:334`

```tsx
background-color: #d97706;
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:344`

```tsx
@apply text-white font-medium px-5 py-2.5 rounded-xl;
```

### gradient
`artifacts/erp-system/src/index.css:489`

```tsx
radial-gradient(900px 380px at 100% -10%, rgba(245,158,11,0.10), transparent 60%),
```

### gradient
`artifacts/erp-system/src/index.css:490`

```tsx
radial-gradient(700px 420px at -10% 110%, rgba(99,102,241,0.07), transparent 55%),
```

### gradient
`artifacts/erp-system/src/index.css:491`

```tsx
radial-gradient(500px 300px at 50% 50%, rgba(34,211,238,0.025), transparent 60%),
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:492`

```tsx
linear-gradient(180deg, #0e1320 0%, #090c14 100%);
```

### gradient
`artifacts/erp-system/src/index.css:492`

```tsx
linear-gradient(180deg, #0e1320 0%, #090c14 100%);
```

### gradient
`artifacts/erp-system/src/index.css:505`

```tsx
.rs-glow--amber  { background: radial-gradient(circle, rgba(245,158,11,0.35), transparent 70%); }
```

### gradient
`artifacts/erp-system/src/index.css:506`

```tsx
.rs-glow--violet { background: radial-gradient(circle, rgba(139,92,246,0.20), transparent 70%); }
```

### gradient
`artifacts/erp-system/src/index.css:507`

```tsx
.rs-glow--cyan   { background: radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%); }
```

### gradient
`artifacts/erp-system/src/index.css:567`

```tsx
background: linear-gradient(90deg,
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:600`

```tsx
color: #34d399;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:612`

```tsx
color: #f87171;
```

### gradient
`artifacts/erp-system/src/index.css:622`

```tsx
background: linear-gradient(to left, transparent, rgba(255,255,255,0.06), transparent);
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:631`

```tsx
background: #22c55e;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:632`

```tsx
box-shadow: 0 0 6px #22c55e;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:679`

```tsx
--erp-bg-app: #0B0F14;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:680`

```tsx
--erp-bg-sidebar: #0E131A;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:682`

```tsx
--erp-bg-card: #11161D;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:683`

```tsx
--erp-bg-card-hover: #171D25;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:684`

```tsx
--erp-bg-input: #0E131A;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:685`

```tsx
--erp-bg-muted: #151B23;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:687`

```tsx
--erp-text-1: #F4F6F8;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:688`

```tsx
--erp-text-2: #CBD2D9;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:689`

```tsx
--erp-text-3: #8D98A5;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:690`

```tsx
--erp-text-inverse: #0B0F14;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:695`

```tsx
--erp-brand: #C48A31;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:696`

```tsx
--erp-brand-hover: #D79A3A;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:700`

```tsx
--erp-success: #16A34A;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:701`

```tsx
--erp-warning: #D97706;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:702`

```tsx
--erp-danger: #DC2626;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:703`

```tsx
--erp-info: #2563EB;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:742`

```tsx
--erp-bg-app: #F7F8FA;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:743`

```tsx
--erp-bg-sidebar: #FFFFFF;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:745`

```tsx
--erp-bg-card: #FFFFFF;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:746`

```tsx
--erp-bg-card-hover: #F1F4F8;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:747`

```tsx
--erp-bg-input: #FFFFFF;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:748`

```tsx
--erp-bg-muted: #F1F4F8;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:750`

```tsx
--erp-text-1: #111827;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:751`

```tsx
--erp-text-2: #374151;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:752`

```tsx
--erp-text-3: #6B7280;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:753`

```tsx
--erp-text-inverse: #FFFFFF;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:758`

```tsx
--erp-brand: #B87924;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:759`

```tsx
--erp-brand-hover: #A5681D;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:763`

```tsx
--erp-success: #15803D;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:764`

```tsx
--erp-warning: #B45309;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:765`

```tsx
--erp-danger: #B91C1C;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:766`

```tsx
--erp-info: #1D4ED8;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:906`

```tsx
color: #f87171;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:914`

```tsx
color: #f59e0b;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:922`

```tsx
color: #60a5fa;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:930`

```tsx
color: #34d399;
```

### gradient
`artifacts/erp-system/src/index.css:966`

```tsx
background: linear-gradient(
```

### gradient
`artifacts/erp-system/src/index.css:977`

```tsx
background: linear-gradient(
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:997`

```tsx
.status-paid   { color: #34d399; background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.20); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:998`

```tsx
.status-unpaid { color: #f87171; background: rgba(248,113,113,0.10); border: 1px solid rgba(248,113,113,0.20); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:999`

```tsx
.status-partial { color: #fbbf24; background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.20); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1155`

```tsx
html.light .erp-table-td { color: #1e293b; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1168`

```tsx
html.light .erp-table-th { color: #64748b; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1188`

```tsx
.btn-icon-danger:hover  { color: #f87171; background: rgba(248,113,113,0.10); transform: translateY(-1px); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1189`

```tsx
.btn-icon-primary:hover { color: #f59e0b; background: rgba(245,158,11,0.10);  transform: translateY(-1px); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1190`

```tsx
.btn-icon-info:hover    { color: #60a5fa; background: rgba(96,165,250,0.10);  transform: translateY(-1px); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1191`

```tsx
.btn-icon-green:hover   { color: #34d399; background: rgba(52,211,153,0.10);  transform: translateY(-1px); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1253`

```tsx
background: #fffef9;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1263`

```tsx
background: #111827;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1291`

```tsx
html.light .erp-search-item { color: #334155; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1293`

```tsx
html.light .erp-search-item.active { background: rgba(245,158,11,0.07); color: #0f172a; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1308`

```tsx
.status-paid    { color: #34d399; background: rgba(52,211,153,0.10); border: 1px solid rgba(52,211,153,0.18); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1309`

```tsx
.status-unpaid  { color: #f87171; background: rgba(248,113,113,0.10); border: 1px solid rgba(248,113,113,0.18); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1310`

```tsx
.status-partial { color: #fbbf24; background: rgba(251,191,36,0.10);  border: 1px solid rgba(251,191,36,0.18); }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1333`

```tsx
html.light .erp-hero-cell  { background: #fafafa; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1334`

```tsx
html.light .erp-hero-cell:hover { background: #f5f5f5; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1363`

```tsx
html.light .erp-page-title    { color: #0f172a; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1364`

```tsx
html.light .erp-page-subtitle { color: #64748b; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1384`

```tsx
html.light .erp-section-title { color: #0f172a; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1385`

```tsx
html.light .erp-section-sub   { color: #64748b; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1419`

```tsx
html.light .erp-empty-label { color: #94a3b8; }
```

### gradient
`artifacts/erp-system/src/index.css:1446`

```tsx
background: linear-gradient(
```

### gradient
`artifacts/erp-system/src/index.css:1457`

```tsx
background: linear-gradient(
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1507`

```tsx
--erp-bg-sidebar:   #0B1120;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1508`

```tsx
--erp-bg-main:      #0D1424;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1523`

```tsx
--erp-accent:       #f59e0b;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1524`

```tsx
--erp-accent-hover: #fbbf24;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1525`

```tsx
--erp-success:      #34d399;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1526`

```tsx
--erp-warning:      #fbbf24;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1527`

```tsx
--erp-danger:       #f87171;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1528`

```tsx
--erp-info:         #60a5fa;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1537`

```tsx
--erp-bg-app:       #f0f2f7;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1538`

```tsx
--erp-bg-sidebar:   #f8fafc;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1539`

```tsx
--erp-bg-main:      #f0f2f7;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1541`

```tsx
--erp-bg-card:      #ffffff;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1544`

```tsx
--erp-text-1:       #0d1117;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1545`

```tsx
--erp-text-2:       #1e293b;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1546`

```tsx
--erp-text-3:       #475569;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1547`

```tsx
--erp-text-4:       #64748b;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1551`

```tsx
--erp-accent:       #d97706;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1552`

```tsx
--erp-accent-hover: #b45309;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1553`

```tsx
--erp-success:      #059669;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1554`

```tsx
--erp-warning:      #d97706;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1555`

```tsx
--erp-danger:       #dc2626;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1556`

```tsx
--erp-info:         #2563eb;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1567`

```tsx
background: #ffffff !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1576`

```tsx
html.light .glass-input::placeholder { color: #94a3b8 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1580`

```tsx
background: #ffffff !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1586`

```tsx
background: #ffffff !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1612`

```tsx
html.light .erp-topbar-search::placeholder { color: #94a3b8 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1614`

```tsx
background: #ffffff !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1619`

```tsx
background: #ffffff !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1636`

```tsx
background: linear-gradient(135deg, #fff7ed 0%, #ffffff 40%, #eff6ff 100%) !important;
```

### gradient
`artifacts/erp-system/src/index.css:1636`

```tsx
background: linear-gradient(135deg, #fff7ed 0%, #ffffff 40%, #eff6ff 100%) !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1641`

```tsx
html.light .erp-hero-cell .hero-label { color: #64748b !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1642`

```tsx
html.light .erp-hero-cell .hero-value { color: #0d1117 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1643`

```tsx
html.light .erp-hero-cell .hero-sub   { color: #64748b !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1647`

```tsx
background: #f8fafc !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1651`

```tsx
color: #64748b !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1672`

```tsx
html.light .erp-badge-success  { background: #dcfce7 !important; color: #166534 !important; border-color: #bbf7d0 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1673`

```tsx
html.light .erp-badge-danger   { background: #fee2e2 !important; color: #991b1b !important; border-color: #fecaca !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1674`

```tsx
html.light .erp-badge-warning  { background: #fef3c7 !important; color: #92400e !important; border-color: #fde68a !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1675`

```tsx
html.light .erp-badge-pending  { background: #f0f9ff !important; color: #1e40af !important; border-color: #bfdbfe !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1676`

```tsx
html.light .erp-badge-info     { background: #e0f2fe !important; color: #0c4a6e !important; border-color: #bae6fd !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1684`

```tsx
background: #ffffff !important;
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1698`

```tsx
html.light .erp-empty-icon  { color: #cbd5e1 !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1701`

```tsx
/* ── 14. ALL missing Tailwind bg-white variants ──────────── */
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1702`

```tsx
html.light .bg-white\/20  { background: rgba(0,0,0,0.06)  !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1703`

```tsx
html.light .bg-white\/25  { background: rgba(0,0,0,0.07)  !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1704`

```tsx
html.light .bg-white\/30  { background: rgba(0,0,0,0.08)  !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1705`

```tsx
html.light .bg-white\/40  { background: rgba(0,0,0,0.09)  !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1706`

```tsx
html.light .bg-white\/50  { background: rgba(0,0,0,0.10)  !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1707`

```tsx
html.light .bg-white\/60  { background: rgba(0,0,0,0.12)  !important; }
```

### tailwind_white_bg
`artifacts/erp-system/src/index.css:1708`

```tsx
html.light .bg-white\/70  { background: rgba(0,0,0,0.14)  !important; }
```

### tailwind_white_border
`artifacts/erp-system/src/index.css:1715`

```tsx
/* ── 15. ALL missing Tailwind border-white variants ──────── */
```

### tailwind_white_border
`artifacts/erp-system/src/index.css:1716`

```tsx
html.light .border-white\/25 { border-color: rgba(0,0,0,0.10) !important; }
```

### tailwind_white_border
`artifacts/erp-system/src/index.css:1717`

```tsx
html.light .border-white\/30 { border-color: rgba(0,0,0,0.12) !important; }
```

### tailwind_white_border
`artifacts/erp-system/src/index.css:1718`

```tsx
html.light .border-white\/40 { border-color: rgba(0,0,0,0.14) !important; }
```

### tailwind_white_border
`artifacts/erp-system/src/index.css:1719`

```tsx
html.light .border-white\/50 { border-color: rgba(0,0,0,0.16) !important; }
```

### tailwind_white_border
`artifacts/erp-system/src/index.css:1720`

```tsx
html.light .border-white\/60 { border-color: rgba(0,0,0,0.18) !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1725`

```tsx
html.light .text-orange-400  { color: #c2410c !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1726`

```tsx
html.light .text-purple-400  { color: #7e22ce !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1727`

```tsx
html.light .text-cyan-400    { color: #0e7490 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1728`

```tsx
html.light .text-pink-400    { color: #be185d !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1729`

```tsx
html.light .text-teal-400    { color: #0f766e !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1730`

```tsx
html.light .text-indigo-400  { color: #3730a3 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1731`

```tsx
html.light .text-rose-400    { color: #be123c !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1732`

```tsx
html.light .text-sky-400     { color: #0369a1 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1733`

```tsx
html.light .text-lime-400    { color: #3f6212 !important; }
```

### hardcoded_hex
`artifacts/erp-system/src/index.css:1734`

```tsx
html.light .text-fuchsia-400 { color: #86198f !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1768`

```tsx
/* ── 17a. text-white/* overrides in soft light mode ─────── */
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1769`

```tsx
html.light .text-white        { color: var(--erp-text-1) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1770`

```tsx
html.light .text-white\/90    { color: var(--erp-text-1) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1771`

```tsx
html.light .text-white\/80    { color: var(--erp-text-1) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1772`

```tsx
html.light .text-white\/70    { color: var(--erp-text-2) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1773`

```tsx
html.light .text-white\/60    { color: var(--erp-text-2) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1774`

```tsx
html.light .text-white\/55    { color: var(--erp-text-2) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1775`

```tsx
html.light .text-white\/50    { color: var(--erp-text-3) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1776`

```tsx
html.light .text-white\/45    { color: var(--erp-text-3) !important; }
```

### tailwind_white_text
`artifacts/erp-system/src/index.css:1777`

```tsx
html.light .text-white\/40    { color: var(--erp-text-3) !important; }
```

