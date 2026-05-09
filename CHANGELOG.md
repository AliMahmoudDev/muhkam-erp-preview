# Changelog — سجل التغييرات

All notable changes to **MUHKAM ERP (مُحكم)** are documented here.  
جميع التغييرات الجوهرية لنظام **مُحكم ERP** موثقة هنا.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).  
يتبع هذا الملف معيار [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) والإصدار الدلالي [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — قيد التطوير

### Planned — مخطط له
- Redis connection pinning for reliable RLS enforcement per request
- Full-text Arabic search across products and customers
- Email notifications for subscription expiry
- Webhook support for external integrations
- Multi-currency transaction ledger (full support beyond display)

---

## [2.0.0] — 2025-06-01

### Added — مُضاف

- **prom-client metrics library**: Replaced hand-rolled Prometheus text output with the official `prom-client` npm library (`src/lib/prom-metrics.ts`). Standard metrics registered:
  - `http_requests_total` Counter — labels: `method`, `route`, `status_code`
  - `http_request_duration_seconds` Histogram — labels: `method`, `route`
  - `active_connections` Gauge
  - `memory_usage_bytes` Gauge
  - `nodejs_uptime_seconds` Gauge
  - Legacy aliases (`request_count_total`, `response_time_ms` Summary with p50/p95/p99, `error_count_total`, `uptime_seconds`) kept for backward-compatible dashboards.
- **تكامل مكتبة prom-client**: تم استبدال مخرجات Prometheus المكتوبة يدويًا بمكتبة `prom-client` الرسمية مع مقاييس قياسية ومقاييس متوافقة مع الإصدارات السابقة.
- **Zod v4 validation on all 33 route files** — Arabic error messages, `safeParse` pattern, structured `details` arrays for field-level errors.
- **تحقق Zod v4 على جميع ملفات المسارات الـ 33** — رسائل خطأ بالعربية، نمط `safeParse`، مصفوفات `details` منظمة.
- **306 automated tests** across 33 test files (Vitest) covering all major API surfaces, auth flows, tenant isolation, and security controls.
- **306 اختبار آلي** في 33 ملف اختبار (Vitest) تغطي جميع واجهات API الرئيسية.
- **Architecture Decision Records** (`docs/ADR/`) documenting JWT cookie strategy, WAC inventory costing, PostgreSQL RLS, and pnpm monorepo rationale.
- **سجلات قرارات المعمارية** (`docs/ADR/`) توثق اختيارات JWT و WAC و RLS و pnpm.
- **Audit log** — comprehensive forensic trail for all critical actions.
- **ZKTeco biometric integration** — ADMS push protocol (`/iclock/cdata`) for attendance devices.
- **2FA (TOTP)** for super-admin using Speakeasy — QR code setup, verify, and disable flows.
- **Backup & Restore** — AES-256-GCM encrypted JSON backups with scheduled nightly runs.
- **Incentive schemes** — configurable slab-based employee incentive rules with daily accruals.
- **Salary advances** with installment deduction from payroll.

### Changed — مُعدَّل

- `pnpm-workspace.yaml` overrides: added `@opentelemetry/api: '^1.9.1'` and `drizzle-orm@*` `packageExtension` to eliminate duplicate module instances.
- `lib/db/package.json`: added `@opentelemetry/api` devDependency to align drizzle-orm peer resolution across workspace packages.
- `GET /api/metrics/prometheus` now calls `await registry.metrics()` instead of a manually constructed text string.
- Backend build switched from `tsc` to **esbuild** (`build.mjs`) — significantly faster CI builds.
- Logging switched to **Pino** (structured JSON) replacing `console.log`.
- All routes split into individual files under `artifacts/api-server/src/routes/`.

### Security — أمان

- `tsc --noEmit` enforced at exit 0 — zero TypeScript errors in CI.
- Dependency deduplication prevents split-brain type errors from mismatched module instances.
- `superAdminIPGuard` middleware protecting all `/api/super/*` routes.
- Per-tenant rate limiting layered on top of global IP rate limits.
- Session blacklist — logout invalidation via Redis (with in-memory fallback).
- Refresh token rotation — one-time-use refresh tokens stored in `refresh_tokens` table.

### Refactored — مُعاد هيكلته

- Business logic for safe transfers extracted to `services/safe-transfer.service.ts`.
- Request metrics middleware refactored: hand-rolled counter and prom-client now record in parallel within the same `res.on('finish')` handler.

---

## [1.1.0] — 2025-03-01

### Added — مُضاف

- **Multi-tenant SaaS architecture**: `companies` table, subscription management, plan tiers (basic / professional / enterprise).
- **معمارية SaaS متعددة المستأجرين**: جدول الشركات، إدارة الاشتراكات، مستويات الخطط.
- **PostgreSQL Row-Level Security (RLS)** on all tenant tables — defense-in-depth layer using session variables (`rls_init.ts`).
- **أمان على مستوى الصفوف (RLS) في PostgreSQL** على جميع الجداول المستأجرة.
- **Payroll engine**: GOSI contributions, leave accrual, end-of-service (EOS) calculation, Saudi Labour Law compliance.
- **محرك الرواتب**: اشتراكات GOSI، استحقاق الإجازات، مكافأة نهاية الخدمة، توافق نظام العمل السعودي.
- **Repair pipeline**: full device-repair lifecycle — job creation, technician assignment, parts tracking, delivery, and customer receipts.
- **سلسلة إصلاح الأجهزة**: دورة حياة كاملة — إنشاء الطلب، الفنيون، القطع، التسليم، الإيصالات.
- **Bank reconciliation** — statement import, line-item matching, unreconciled item reporting.
- **مطابقة البنك** — استيراد الكشوفات، مطابقة البنود، تقارير البنود غير المطابقة.
- **Fixed assets** — acquisition, straight-line / reducing-balance depreciation, disposal.
- **الأصول الثابتة** — الاقتناء، الإهلاك بالقسط الثابت / المتناقص، التصرف.
- **Budget management** — periods, line items, variance reporting.
- **إدارة الميزانية** — الفترات، البنود، تقارير الانحراف.
- **Accruals** — accrued-expense scheduling and recognition.
- **المستحقات** — جدولة النفقات المستحقة والاعتراف بها.
- **Super Admin Dashboard** — tenant management, revenue analytics, system alerts, audit log, announcements, health monitor.
- **لوحة المشرف الأعلى** — إدارة المستأجرين، التحليلات، التنبيهات، سجل التدقيق.
- Subscription guard middleware (`tenant-guard.ts`) — 7-day grace period for reads, immediate block on writes after expiry.
- `getTenant(req)` strict helper replacing all `?? 1` company_id fallbacks.

### Changed — مُعدَّل

- Inventory costing switched to **WAC (Weighted Average Cost)** for IFRS/GAAP alignment (see ADR-002).
- تم تغيير تكلفة المخزون إلى **المتوسط المرجح للتكلفة (WAC)** للتوافق مع IFRS/GAAP.
- Authentication moved to **httpOnly cookies** (primary) with Bearer header as fallback (see ADR-001).
- User role re-fetched from DB on every authenticated request — JWT payload no longer trusted for role.
- Frontend migrated from React 18 to **React 19**.
- Tailwind upgraded to **v4** with new `@tailwindcss/vite` plugin.

### Security — أمان

- httpOnly + Secure + SameSite=Strict cookies for JWT — XSS cannot steal tokens (see ADR-001).
- `helmet` security headers added (HSTS, CSP, X-Frame-Options, noSniff).
- `hpp` middleware to prevent HTTP Parameter Pollution.
- XSS body sanitiser (`xss` library) on all write endpoints.
- Brute-force login protection with account lockout and auth rate limiting (10 req / 60 s).
- IP allowlist (`SUPER_ADMIN_IPS`) for super-admin routes.
- Idempotency keys table to prevent duplicate write submissions.

### Fixed — مُصلَح

- Trial-period guard race condition resolved with atomic DB check.
- Exchange-rate endpoint now returns 404 (not 500) for unknown currency pairs.
- Customer ledger debit/credit direction corrected for credit sales.
- Fiscal year period lock not enforced on purchase returns — fixed.

### Tests Added — اختبارات مُضافة

- Tenant isolation integration tests (`__tests__/integration/tenant-isolation.test.ts`).
- Concurrency tests for safe-transfer double-spend prevention.
- Full-route test suites added for: accounts, bank reconciliation, budgets, customers, devices, employees, expenses, fixed assets, inventory, notifications, products, purchases, repairs, sales, settings, suppliers, vouchers, warranty.

---

## [1.0.0] — 2025-01-20

### Added — مُضاف

- **Initial release** of MUHKAM ERP (مُحكم) — Arabic-first multi-tenant ERP for Saudi SMEs.
- **الإصدار الأول** من مُحكم ERP — نظام ERP عربي للشركات السعودية الصغيرة والمتوسطة.
- **Monorepo** with pnpm workspaces: `artifacts/api-server`, `artifacts/erp-system`, `artifacts/erp-mobile`, `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`.
- **هيكل Monorepo** مع مساحات عمل pnpm.
- **Core accounting**: chart of accounts, journal entries, trial balance, income statement, balance sheet.
- **محاسبة أساسية**: دليل الحسابات، القيود اليومية، ميزان المراجعة، قائمة الدخل، الميزانية العمومية.
- **Sales & purchases**: full order-to-cash and procure-to-pay cycles with 15% VAT support.
- **مبيعات ومشتريات**: دورات كاملة مع دعم ضريبة القيمة المضافة 15%.
- **Inventory management**: products, warehouses, stock transfers, physical stock counts, stock movements audit trail.
- **إدارة المخزون**: المنتجات، المستودعات، نقل المخزون، الجرد، سجل حركات المخزون.
- **Customer & supplier management** with ledger tracking.
- **إدارة العملاء والموردين** مع تتبع دفتر الأستاذ.
- **HR core**: employees, departments, job titles, contracts, documents, contacts.
- **موارد بشرية أساسية**: الموظفون، الأقسام، المسميات الوظيفية، العقود، المستندات.
- **Authentication**: JWT via httpOnly cookies, role-based access control (super_admin / admin / manager / accountant / cashier / salesperson / viewer).
- **المصادقة**: JWT عبر ملفات تعريف الارتباط httpOnly، تحكم وصول قائم على الأدوار.
- **Safe (cash register) management** with deposit, payment, receipt, and treasury vouchers.
- **إدارة الخزائن** مع سندات الإيداع والصرف والقبض والخزينة.
- **Fiscal year management** with period locking — financial writes blocked in closed periods.
- **إدارة السنوات المالية** مع قفل الفترات.
- **OpenAPI spec** (`lib/api-spec/openapi.yaml`) with Orval-generated Zod schemas and React Query hooks.
- **مواصفة OpenAPI** مع مخططات Zod وhooks React Query مولَّدة تلقائياً.
- Express 5, Drizzle ORM, PostgreSQL, Zod v4, Vitest, pino structured logging.
- Arabic RTL UI with dark glass-morphism design system.
- واجهة عربية RTL بتصميم زجاجي داكن.

[Unreleased]: https://github.com/your-org/muhkam-erp/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/your-org/muhkam-erp/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/your-org/muhkam-erp/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/your-org/muhkam-erp/releases/tag/v1.0.0
