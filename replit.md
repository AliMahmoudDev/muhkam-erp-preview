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