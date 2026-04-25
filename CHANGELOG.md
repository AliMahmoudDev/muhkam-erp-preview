# MUHKAM ERP — Changelog

All significant changes to the system are documented here. Entries are ordered newest-first.

Format:
```
## [version] — YYYY-MM-DD
### Added / Changed / Fixed / Security / Removed
- Description of change
```

---

## [2.0.0] — 2026-04-25

### Added
- **Full monorepo migration** to pnpm workspaces with separate packages for `api-server`, `erp-system`, `erp-mobile`, and shared `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`
- **Expo mobile app** (`erp-mobile`) with Expo Router, Expo Secure Store, and React Native Reanimated
- **Multi-tenant SaaS architecture** — `companies` table, subscription management, plan tiers
- **Super Admin Dashboard** — full management UI for all tenant companies with revenue analytics, alerts, audit log, announcements, health monitor, and plan pricing editor
- **Subscription guard middleware** (`tenant-guard.ts`) — 7-day grace period for read operations, immediate block on writes after expiry
- **Row Level Security (RLS)** on all tenant tables — defense-in-depth layer using PostgreSQL session variables
- **Refresh token rotation** — one-time-use refresh tokens stored in `refresh_tokens` table
- **Session blacklist** — logout invalidation via Redis (or in-memory fallback)
- **2FA (TOTP)** for super admin using Speakeasy — QR code setup, verify, and disable flows
- **Backup & Restore** — encrypted (AES-256-GCM) JSON backups with scheduled nightly runs
- **Audit log** — comprehensive forensic trail for all critical actions across the platform
- **Bank reconciliation** module
- **Fixed assets & depreciation** module
- **Budgets & cost centers** module
- **Accruals** module
- **Consignment inventory** tracking
- **Fiscal year management** with period locking — financial writes blocked in closed periods
- **Exchange rates** (multi-currency support)
- **ZKTeco biometric integration** — `/iclock/cdata` endpoint for device sync
- **Employee incentive schemes** — tiered commission slabs with monthly accrual
- **Salary advances** with installment repayment deduction from payroll
- **Leave management** — types, policies, blackout dates, approval workflow
- **Attendance deduction tiers** — automatic salary deductions based on attendance violations
- **Device repair tracking** and **warranty records**
- **Safe transfers with fees** — fixed or percentage-based transfer fee calculation
- **Stock transfers** between warehouses
- **Physical inventory count sessions** (`stock_count_sessions`)
- **Scrap items** and **bad debt** tracking
- **Announcements system** — super admin can broadcast system-wide messages
- **IP allowlist** for super admin routes (`SUPER_ADMIN_IPS` env var)
- **Idempotency keys** table to prevent duplicate write submissions
- **OpenAPI spec** (`lib/api-spec/openapi.yaml`) with Orval-generated Zod schemas and React Query hooks
- **Swagger UI** served at `/api-docs` for development

### Changed
- Authentication moved to **httpOnly cookies** (primary) with Bearer header as fallback
- User role re-fetched from DB on every request — token payload no longer trusted for role
- `getTenant(req)` strict helper replaces `?? 1` company_id fallbacks throughout all routes
- Backend build switched from `tsc` to **esbuild** via `build.mjs` — significantly faster builds
- Logging switched to **Pino** (structured JSON) replacing `console.log`
- Frontend migrated from React 18 to **React 19**
- Tailwind upgraded to **v4** with new `@tailwindcss/vite` plugin
- All routes split into individual files under `artifacts/api-server/src/routes/`
- Business logic for safe transfers extracted to `services/safe-transfer.service.ts`

### Security
- Helmet HTTP security headers added
- HPP (HTTP Parameter Pollution) protection added
- XSS body sanitizer (`xss` library) on all write endpoints
- Brute-force login protection with account lockout
- Rate limiting on login endpoint (10 req / 15 min)
- `superAdminIPGuard` middleware protecting all `/api/super/*` routes
- Cashier/salesperson users blocked from logging in without `warehouse_id` and `safe_id` configured

---

## [1.5.0] — 2025-12-01

### Added
- HR module: Payroll processing, salary structures, and components
- HR module: Employee documents and contacts
- Reports module: Trial balance, profit/loss, customer balance report
- Opening balances for chart of accounts

### Changed
- Database connection pooling tuned (`max: 50, min: 5, idleTimeoutMillis: 30s`)
- Product stock quantity now stored as denormalized column + rebuilt from stock movements on repair

### Fixed
- Customer ledger debit/credit direction corrected for credit sales
- Fiscal year period lock not enforced on purchase returns — fixed

---

## [1.2.0] — 2025-09-15

### Added
- Double-entry accounting: journal entries, chart of accounts, trial balance
- Receipt, payment, deposit, and treasury vouchers
- Safe (cash register) transfers between safes
- Financial period locking (fiscal years)
- Multi-warehouse inventory support
- Stock movements audit trail

### Changed
- `customers` table unified to cover suppliers (`is_supplier` flag)
- Sales invoices now link to `safe_id` for cash tracking

---

## [1.0.0] — 2025-06-01

### Added
- Initial release of MUHKAM ERP
- Core modules: Products, Customers, Sales, Purchases, Expenses, Income
- Basic POS with barcode scanning
- User management with role-based access (admin, manager, cashier)
- Company settings (branding, currency, address)
- Dashboard with sales summary
- Arabic RTL UI with dark glass-morphism design
- JWT authentication with bcrypt PIN hashing

---

## Upcoming / Roadmap

- [ ] Redis connection pinning for reliable RLS enforcement
- [ ] Full-text search across products and customers
- [ ] Email notifications for subscription expiry
- [ ] Webhook support for external integrations
- [ ] Mobile app feature parity with web (currently partial)
- [ ] Multi-currency transactions (full support)
- [ ] Automated tax calculation and reporting
