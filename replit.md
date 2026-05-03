# مُحكم - MUHKAM ERP Workspace

## Overview
This project is a full-stack Arabic ERP System (نظام ERP) designed for Halal Tech, an Egyptian mobile repair shop. Its primary purpose is to provide a comprehensive management solution with an Arabic RTL interface and a dark glass-morphism UI. Key capabilities include dynamic currency, font, accent color, and company branding, all configurable from the Settings without requiring code changes. The system covers essential business functions such as sales (POS), purchases, inventory management, financial transactions, and reporting.

The system aims to streamline operations, provide accurate financial tracking, and offer robust reporting for businesses, particularly focusing on the specific needs of the Halal Tech repair shop. It provides a complete overview of business operations, from inventory and sales to detailed profit analysis and financial auditing.

## User Preferences
I prefer iterative development with a focus on core features first. I value clear, detailed explanations for complex architectural decisions and new functionalities. Please ask before implementing any major changes or refactoring large portions of the codebase. I expect the agent to prioritize fixing critical bugs and stabilizing existing features before developing new ones. I prefer a communication style that is direct and technical, but also open to discussing alternative approaches.

## System Architecture

The system is built as a monorepo using pnpm workspaces. The architecture separates the API server (`api-server`) from the frontend application (`erp-system`) and defines shared libraries for the database (`db`), API specification (`api-spec`), and generated clients.

**UI/UX Decisions:**
- **Language & Direction:** Arabic RTL interface.
- **Theme:** Dark glass-morphism UI.
- **Customization:** Dynamic currency, font, accent color, company branding, and login background presets are configurable via `AppSettingsProvider` and stored in `localStorage`.
- **Component Design:** Design System v3 with CSS tokens for consistent styling across components like cards, tables, inputs, buttons, modals, and badges. All new pages/components must use `erp-*` classes only.

**Technical Implementations:**
- **Global Safe Data Helpers (`src/lib/safe-data.ts`):** `safeArray<T>(value)` and `safeObject<T>(value, fallback)` normalize API responses for type safety.
- **Authentication & RBAC:** JWT-based authentication (HS256) and a 3-layer Role-Based Access Control (RBAC) system (role defaults → user overrides → page guards). `Guard` component enforces route-level access, and backend routes are protected by middleware. Roles include `admin`, `manager`, `cashier`, `salesperson`.
- **Inventory System:** Production-grade system with per-warehouse stock computation from `stock_movements`. Supports inventory audits, count sessions, and stock transfers with validation.
- **Profit Calculation Engine:** Uses a weighted average cost method to update product `cost_price` and store it at the moment of sale for accurate historical profit reporting.
- **Financial Transaction Engine:** Ensures atomic money movements using `db.transaction()`, recording all operations in a central `transactions` ledger.
- **Opening Balance System:** Allows entering opening balances for treasuries, products, customers, and suppliers.
- **Data Integrity Enforcement Layer (`artifacts/api-server/src/lib/integrity.ts`):** Provides functions to check and repair journal balance, account drift, customer drift, and inventory drift.
- **Auto-Accounting Link (`artifacts/api-server/src/lib/auto-account.ts`):** Automatically creates linked ledger accounts when customers/suppliers are created.
- **Financial Lock System (إغلاق الفترات المالية):** Accounting-grade period lock system preventing writes/deletes on documents dated before a `closing_date`, with admin override and audit trails.
- **SaaS Multi-Tenant Platform:** Supports company registration, trial subscriptions, email/password auth, and a super admin dashboard. All data is isolated by `company_id`. Includes HR Suite (Departments, Job Titles, Employees, Payroll, Attendance, Leaves, Incentives, Salary Advances), and Branch management.
- **Customer Classifications (تصنيفات العملاء):** Allows classifying customers for better management.
- **POS System v2.0 (`/pos`):** Dedicated full-screen cashier terminal with barcode scanning, return mode, thermal receipt printing, and permission-driven features.
- **Posting Control System:** All financial documents (sales, purchases, vouchers) follow a `draft` → `posted` → `cancelled` lifecycle, with explicit user actions for posting and cancellation.
- **Backup / Restore / Reset System:** Server-side full JSON dump and restore functionality for all business data, alongside a database reset option.
- **Smart Alerts System:** Triggers alerts based on various business conditions (e.g., low stock, customer debt) with role-based targeting and resolution tracking.
- **Repair Pipeline System:** Manages repair jobs with a configurable pipeline, status transitions, parts management, and financial tracking.
- **Used Devices Module:** Manages the lifecycle of used mobile devices, including purchase, sale, maintenance, and detailed tracking.
- **Warranty Tracking System:** Records and tracks product warranties with automated expiry calculations and customer notifications.
- **Customer/Supplier Coding System:** Auto-generates sequential codes for customers and suppliers, with normalized name deduplication.
- **Unified Customers Architecture:** `suppliers` concept removed; all supplier functions are now handled through `customers` with an `is_supplier=true` flag.
- **Advanced Accounting:** Implemented accurate historical cost tracking for purchase and sales returns, full reversal logic for cancelled sales and purchases, and correct COGS accounting.
- **Advanced Reports:** Includes a refactored reports module with various financial and operational reports, including a health check, profit & loss, daily profit, product profit, sales analysis, customer statement, cash flow, top items, inventory, sales invoices, purchase invoices, voucher history, VAT report, and trial balance.
- **Audit Log Viewer (`/audit-log`):** Provides a comprehensive, filterable audit log with JSON diff viewing.
- **Invoice Printing:** Reusable `InvoicePrint` component for generating Arabic RTL invoices with company branding and VAT details.
- **CSV Export:** Reports can be exported to CSV with UTF-8 BOM for Arabic Excel compatibility.
- **VAT Payable Journal Entries:** Correct double-entry accounting for VAT.
- **Customer Aging Report:** Analyzes outstanding customer and supplier debts across different age buckets.
- **Journal Entry Reversal:** Allows reversing posted journal entries with automated reverse entries.
- **Customizable Repair Dashboard Cards:** Allows administrators to configure dashboard cards for the repairs module.
- **Pipeline V2:** Introduces a `shipped` status and side branches (e.g., `waiting_parts`, `rejected`, `cancelled`) for more flexible repair job status transitions.
- **Employee Self-Service Portal (`/my-portal`):** An embedded page for employees to view their job info, attendance, salary advances, leaves, and other HR-related data.

**Feature Specifications:**
- **Navigation Pages:** Dashboard, Sales (POS + Returns), Purchases (+ Returns), Customers, Profits, Expenses, Income, Receipt Vouchers, Deposit Vouchers, Safe Transfers, Unified Activity Log, Financial Transactions Ledger, Chart of Accounts, Journal Entries, Reports, Settings, Inventory Audit, Employees, Branches, Devices, Repairs, Warranty, Fiscal Years, Audit Log, Employee Self-Service Portal.

## Design Audit Fixes (April 2026)

### Light Mode Fixes
- Added comprehensive CSS overrides in `index.css` for all hardcoded dark hex color classes (`bg-[#0f1729]`, `bg-[#1A2235]`, `bg-[#111827]`, `bg-[#0B1120]`, `bg-[#0D1424]`, `bg-[#0F1623]`, `bg-[#0a0f1a]`, `bg-[#1a1a2e]`, `bg-[#1a1530]`, `border-[#2D3748]`)
- Fixed all dialogs in accruals, bank-reconciliation, budgets, cost-centers to use semantic `bg-card border-border text-card-foreground` classes
- Fixed settings sidebar (`settings/index.tsx`) to use theme-aware CSS class `.settings-sidebar` instead of inline style
- Fixed VAT tab, financial-lock tab, currency tab inputs to use `bg-muted/40 border-border text-foreground`
- Fixed `App.tsx` POS loading screen from hardcoded `hsl(225,28%,4%)` to `hsl(var(--background))`
- Added `.skeleton-layer`, `.skeleton-layer-dim`, `.stat-card-skeleton` CSS classes for theme-aware skeleton backgrounds

### HTML Structure Fixes (React Hydration)
- Fixed `employees.tsx`: `TableSkeleton` was rendered inside a `<div>` — now wrapped in proper `<table><tbody>`
- Fixed `employees.tsx`: loans/deductions loading panels used `<TableSkeleton>` (which renders `<tr>` elements) inside `<div>` — replaced with div-based card skeletons
- Fixed `attendance.tsx`: same `TableSkeleton` inside `<div>` issue

### API Server Reliability
- Removed `waitForPort = 8080` from API Server workflow to fix startup reliability issues. Server starts on port 8080 successfully without the Replit platform timeout interfering.

## External Dependencies

- **Node.js**: Version 24
- **Package Manager**: pnpm
- **TypeScript**: Version 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)
- **Frontend Framework**: React
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charting**: Recharts
- **Icons**: Lucide icons
- **Fonts**: Google Fonts
- **Data Export/Import**: XLSX (for product export/import)
- **Testing (Backend)**: Vitest + Supertest
- **Testing (Frontend)**: Vitest + React Testing Library
- **Mobile App Framework**: Expo 54 + expo-router v6
- **Mobile UI**: `@tanstack/react-query`, `@expo-google-fonts/inter`, `react-native-safe-area-context`
- **Security**: Helmet.js
- **API Documentation**: Swagger UI
- **CI/CD**: GitHub Actions, Docker, Docker Compose, pm2 (for deployment)
## May 2026 Updates

### Purchase Invoice Shipping Cost (مصاريف الشحن)
- Added `shipping_cost` column to `purchases` table
- Added `shipping_cost` field to `CreatePurchaseBody` (api-zod schema)
- Backend WAC (Weighted Average Cost) calculation now distributes shipping cost proportionally across purchase items by their EGP value
- Frontend: amber-styled shipping cost input appears in the purchase form (always visible, supports foreign currency with auto-conversion to EGP)
- Shipping cost breakdown shown in the invoice summary totals

### Global Product Pricing (هامش ربح عالمي)
- New API endpoint: `POST /api/products/bulk-margin-update` — accepts `margin_percent` and optional `category_id`
- Updates `sale_price` for all matching products as: `cost_price × (1 + margin/100)`
- New "تسعير المنتجات" tab added to `/settings` page with confirmation dialog and result feedback

### Customer Price Lists (قوائم أسعار العملاء)
- New DB tables: `price_lists` and `price_list_items` (with cascade delete)
- Added `price_list_id` and `price_list_markup` columns to `customers` table
- Full CRUD API routes at `/api/price-lists` and `/api/price-lists/:id`
- Customer-specific price lookup: `GET /api/price-lists/customer-price/:customer_id/:product_id`
- New `/price-lists` page with product picker modal, markup % per product, and expandable detail view
- Customer edit form now shows price list selector + per-customer markup % override
- Nav item "قوائم الأسعار" added to sidebar (admin/manager only)


### Maintenance Module Settings (May 2026 — wave 2)
Migrated maintenance per-tenant settings off `localStorage` into the existing `system_settings` table, plus a new dedicated CRUD table for accessories. **All UI text is Arabic-only** (per requirement); manufacturer/model names are the only Latin strings allowed.

**New DB table** — `repair_accessories` (`lib/db/src/schema/repair-accessories.ts`):
- `id`, `company_id` (FK), `key_`, `label_ar`, `emoji`, `sort_order`, `active`, `is_system`
- Unique on `(company_id, key)`

**New API route** — `/api/repair-accessories` (admin gated for write):
- `GET` (auto-seeds 7 defaults: charger/box/case/sim_tray/earphones/cable/other)
- `POST` / `PATCH` / `DELETE`

**`system_settings` keys** (defined in `RepairSettingsModal.tsx` → `REPAIR_SETTING_KEYS`):
- `repair.qr_base_url` — base URL for customer tracking QR
- `repair.default_warranty_days` — shown in `WarrantyModal` info banner
- `repair.wa_template_ready` / `repair.wa_template_progress` — editable WhatsApp templates with Arabic placeholders: `{{اسم_العميل}}`, `{{رقم_البطاقة}}`, `{{الماركة}}`, `{{الموديل}}`, `{{الحالة}}`, `{{التكلفة}}` — substituted via `applyTemplate()` (regex matches `[^}\s]+` so Arabic identifiers work).

**New tabs in `RepairSettingsModal.tsx`**:
- `الإكسسوارات` — CRUD UI for `repair_accessories`, edit/toggle/delete with `is_system` protection
- `الافتراضيات` — admin-only mdة الضمان الافتراضية (warranty days only — inspection prices intentionally removed; inspection is free of charge)
- `قوالب الواتس` — admin-only editable Ready/Progress templates with placeholder cheat-sheet

**Frontend wiring in `repairs.tsx`**:
- `useAccessoriesList()` hook replaces hardcoded `ACCESSORIES_LIST`
- `useRepairSettings()` hook reads `system_settings`
- `printJobQR` and `jobTrackingUrl` in `JobDetail` read base URL from settings (no localStorage)

### E2E Repair Lifecycle Verification (May 2026)
Full repair pipeline tested end-to-end via API (`/tmp/e2e.mjs`): customer → job → all 11 stages → pre-delivery (parts + payment) → shipping → delivered. **All 100% working.** DB side effects verified:
- Stock auto-decremented (50 → 49) with `stock_movements` row (`movement_type=repair_part`, ref to `repair_job`)
- `repair_payments` row inserted; safe balance credited (0 → 1500)
- `repair_job_parts` row created with correct product/qty/price
- Job timestamps set: `pre_delivery_reviewed_at`, `shipping_settled_at`, `delivered_at`

**API contract gotchas discovered for callers**:
- `POST /qa-checklist` body fields: `items` (NOT `qa_checklist`), `notes` (NOT `qa_notes`), each item `{id,label,status:'pass'|'fail'|'n/a'}`
- `POST /pre-delivery` payment must be **nested**: `{ payment: { payment_type, paid_amount, safe_id, payments: [{type:'cash'|'credit', safe_id, amount}] } }` — flat `payments`/`paid_amount` at root are ignored silently
- `final_cost` MUST be set via PATCH before transitioning to `repaired`
- Server stringifies checklist arrays — pass raw arrays, NOT pre-stringified
