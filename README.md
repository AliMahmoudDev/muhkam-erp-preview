# مُحكم — MUHKAM ERP

A comprehensive, multi-tenant Arabic Enterprise Resource Planning (ERP) system built for retail and service businesses, specifically tailored for the mobile repair and electronics industry.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Monorepo Structure](#monorepo-structure)
4. [Feature Modules](#feature-modules)
5. [Tech Stack](#tech-stack)
6. [Setup Instructions](#setup-instructions)
7. [Environment Variables](#environment-variables)
8. [API Structure](#api-structure)
9. [User Roles](#user-roles)
10. [Deployment](#deployment)

---

## Overview

MUHKAM ERP is a SaaS platform where a super-admin manages multiple tenant companies. Each company gets its own isolated data environment. The system supports:

- Full Arabic RTL UI with a dark glass-morphism design
- Multi-tenant data isolation via `company_id` on every table
- PostgreSQL Row Level Security (RLS) as a defense-in-depth layer
- Subscription-based access control (trial / paid plans)
- Double-entry accounting and financial reporting
- POS (Point of Sale) with barcode/QR scanning
- HR, payroll, attendance (with ZKTeco biometric integration)
- Inventory management with multi-warehouse support
- Device repair tracking and warranty management

---

## Architecture

```
Browser (React + Vite)
        │
        │  HTTPS (proxied via Replit / Nginx in production)
        ▼
Express API Server (Node.js / TypeScript)
        │
        ├─── JWT Auth Middleware
        ├─── requireTenant Middleware   ← resolves company_id
        ├─── tenantGuard Middleware     ← checks subscription status
        │
        ▼
PostgreSQL (Drizzle ORM)
        │
        ├─── Row Level Security (RLS)   ← defense-in-depth
        └─── Per-table company_id       ← primary isolation
```

**Request lifecycle for a tenant user:**
1. JWT cookie validated → user fetched from DB → company checked for active status
2. `requireTenant` resolves `company_id` and attaches it to `req`
3. `tenantGuard` checks subscription expiry (cached 60s) — expired = 402
4. Route handler adds `WHERE company_id = X` to every query
5. RLS policy on the DB double-checks the company context

**Super admin requests** skip steps 2–4 and operate cross-tenant.

---

## Monorepo Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express backend (TypeScript)
│   │   ├── src/
│   │   │   ├── routes/      # One file per feature module (50+ routes)
│   │   │   ├── middleware/  # auth.ts, tenant-guard.ts, rate-limit, etc.
│   │   │   ├── services/    # Business logic (safe-transfer, seed-defaults, etc.)
│   │   │   └── lib/         # Utilities: audit-log, backup, monitor, permissions
│   │   └── build.mjs        # esbuild bundler script
│   │
│   ├── erp-system/          # React 19 + Vite web frontend
│   │   └── src/
│   │       ├── pages/       # One page per ERP module
│   │       ├── components/  # Shared UI components
│   │       ├── contexts/    # Auth context, company context
│   │       └── lib/         # api.ts, auth-fetch.ts, helpers
│   │
│   ├── erp-mobile/          # Expo / React Native mobile app
│   └── mockup-sandbox/      # Vite-powered UI prototyping environment
│
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   │   └── src/schema/      # ~48 table definition files
│   ├── api-spec/            # OpenAPI YAML spec
│   ├── api-zod/             # Zod schemas generated from API spec
│   └── api-client-react/    # React Query hooks generated from spec
│
└── scripts/                 # Utility scripts (post-merge, sync-pages, etc.)
```

---

## Feature Modules

### Sales & POS
- Create sales invoices with barcode/QR scanning
- Manage returns and refunds
- Sales targets per employee
- Customer ledger and debt tracking

### Purchasing
- Purchase orders and supplier management
- Purchase returns
- Supplier account integration

### Inventory
- Multi-warehouse stock management
- Stock movements, transfers between warehouses
- Stock count sessions (physical inventory)
- Scrap items tracking
- Consignment inventory

### Financial Accounting
- Double-entry bookkeeping with journal entries
- Chart of accounts (tree structure)
- Trial balance and P&L reports
- Receipt, payment, deposit, and treasury vouchers
- Safe (cash register) transfers between safes
- Bank accounts and bank reconciliation
- Fiscal year management with period locking
- Opening balances
- Exchange rates (multi-currency)
- Budgets and cost centers
- Fixed assets with depreciation
- Accruals

### Human Resources
- Employee management (full profile, documents, contacts)
- Departments and job titles
- Payroll processing with salary structures
- Salary advances
- Attendance tracking (manual + ZKTeco biometric device integration)
- Leave management (types, policies, blackout dates, approvals)
- Employee incentive schemes
- Bonuses and custody items
- Attendance deduction tiers

### Device Repair & Warranty
- Repair job orders
- Device tracking
- Warranty records

### SaaS Management (Super Admin)
- Multi-tenant company management
- Subscription management (extend, suspend, activate)
- Revenue dashboard (MRR, ARR, ARPU)
- Smart alerts (expiring subscriptions, system health)
- System announcements
- Audit log (forensic trail of all super-admin actions)
- Database backup and restore
- 2FA (TOTP) for super admin
- Plan pricing management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + Vite 7 |
| Styling | Tailwind CSS 4 + glass-morphism design system |
| UI primitives | Radix UI |
| State / data fetching | TanStack Query (React Query) |
| Routing | Wouter |
| Animations | Framer Motion + GSAP |
| Charts | Recharts |
| Backend framework | Express 5 (Node.js) |
| Language | TypeScript throughout |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Replit HeliumDB) |
| Session store | In-memory (Redis optional) |
| Auth | JWT (access 4h) + refresh tokens (7d) |
| 2FA | TOTP via Speakeasy |
| Logging | Pino (structured JSON) |
| Build tool | esbuild (backend), Vite (frontend) |
| Package manager | pnpm (workspace) |
| Mobile | Expo / React Native |

---

## Setup Instructions

### Prerequisites
- Node.js 20+
- pnpm 10+
- PostgreSQL 16

### Development (Replit)

The project runs natively on Replit with the built-in PostgreSQL database.

**1. Install dependencies**
```bash
pnpm install
```

**2. Push database schema**
```bash
pnpm --filter @workspace/db push
```

**3. Start the backend** (port 8080)
```bash
pnpm --filter @workspace/api-server run dev
```

**4. Start the frontend** (port 5000)
```bash
pnpm --filter @workspace/erp-system run dev
```

The frontend proxies all `/api/*` requests to the backend at `localhost:8080`.

### Default Credentials (Development)

| Role | Username | PIN |
|------|----------|-----|
| Super Admin | `superadmin` | `693014` |
| Company Admin | `admin` | `202576` |

These are seeded automatically on first startup via `src/lib/seed-defaults.ts`.

### Production (VPS / Docker)

```bash
# Build backend
pnpm --filter @workspace/api-server run build

# Build frontend (outputs to artifacts/erp-system/dist/public)
pnpm --filter @workspace/erp-system run build

# The backend serves the built frontend statically
NODE_ENV=production node artifacts/api-server/dist/index.mjs
```

Use Nginx as a reverse proxy in production. See `nginx.conf` at the project root.

---

## Environment Variables

See `.env.example` at the project root for a template. Variables used by the backend:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Access token signing secret (min 32 chars, 64 recommended) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret (different from JWT_SECRET) |
| `PORT` | Yes | Backend server port (default: 8080) |
| `NODE_ENV` | Yes (prod) | Set to `production` in production |
| `TOTP_ENCRYPTION_KEY` | Yes | Exactly 32 characters — AES-256-CBC key for encrypting TOTP secrets |
| `ALLOWED_ORIGINS` | Yes (prod) | Comma-separated frontend origins for CORS. Empty = allow all (not recommended) |
| `SUPER_ADMIN_PIN` | Seed | Force-reset the super admin PIN on next startup. Remove after use |
| `DEFAULT_ADMIN_PIN` | Seed | Force-reset the default company admin PIN on next startup. Remove after use |
| `BACKUP_ENCRYPTION_KEY` | Optional | Passphrase for AES-256-GCM backup encryption. Unset = plaintext backups |
| `REDIS_URL` | Optional | Redis URL for session blacklist and brute-force tracking |
| `SUPER_ADMIN_IPS` | Optional | Comma-separated IP allowlist for super admin routes. Empty = allow all |
| `BACKUP_DIR` | Optional | Directory path for backup files (default: `/root/db-backups`) |
| `LOG_LEVEL` | Optional | Pino log level: `trace` / `debug` / `info` / `warn` / `error` (default: `info`) |
| `FRONTEND_DIST` | Optional | Override path to built frontend static files |
| `DB_PASSWORD` | Optional | Separate password field (if not embedded in DATABASE_URL) |

---

## API Structure

All API routes are prefixed with `/api`.

### Public Routes (no auth required)
```
POST   /api/auth/login             (PIN login)
POST   /api/auth/login/email       (email login)
POST   /api/auth/2fa/login         (TOTP second-factor login)
POST   /api/auth/refresh           (refresh access token)
POST   /api/auth/register          (register new user — if enabled)
GET    /api/auth/users             (list usernames for login UI)
GET    /api/health
GET    /api/iclock/*               (ZKTeco device sync — public endpoint for biometric devices)
```

### Super Admin Routes (`role = super_admin` required)
```
# Dashboard & Stats
GET    /api/super/stats
GET    /api/super/revenue
GET    /api/super/alerts
GET    /api/super/health

# Company Management
GET    /api/super/companies
GET    /api/super/companies/:id
POST   /api/super/companies
PUT    /api/super/companies/:id
DELETE /api/super/companies/:id
POST   /api/super/companies/:id/extend
POST   /api/super/companies/:id/activate
POST   /api/super/companies/:id/suspend
POST   /api/super/companies/:id/reset-admin-password
GET    /api/super/export/companies         (CSV export)

# Manager Accounts
GET    /api/super/managers
POST   /api/super/managers
PATCH  /api/super/managers/:id
PATCH  /api/super/managers/:id/toggle      (enable/disable)
DELETE /api/super/managers/:id

# Announcements
GET    /api/super/announcements
POST   /api/super/announcements
PATCH  /api/super/announcements/:id
DELETE /api/super/announcements/:id

# Plan Pricing
GET    /api/super/plan-settings
PUT    /api/super/plan-settings/:key

# Backup & Security
POST   /api/super/backup/create
GET    /api/super/backup/list
GET    /api/super/backup/download/:filename
GET    /api/super/encryption-key           (retrieve backup encryption key)
POST   /api/system/restore

# Audit Log
GET    /api/super/audit-log
```

### Tenant Routes (company users)
All routes below require a valid JWT and an active subscription.

```
# Auth (authenticated)
GET    /api/auth/me
POST   /api/auth/logout
GET    /api/auth/subscription
GET    /api/auth/2fa/setup
POST   /api/auth/2fa/verify
POST   /api/auth/2fa/disable
GET    /api/auth/2fa/status

# Products & Inventory
GET/POST/PUT/DELETE  /api/products
GET    /api/inventory
POST   /api/inventory/adjust
GET/POST             /api/stock-transfers
GET/POST             /api/stock-count-sessions

# Customers & Sales
GET/POST/PUT/DELETE  /api/customers
GET/POST/PUT/DELETE  /api/sales
GET/POST/DELETE      /api/sales-returns     (no PUT — returns are immutable once created)

# Purchasing
GET/POST             /api/purchases
POST   /api/purchases/:id/post             (post a draft purchase)
POST   /api/purchases/:id/cancel           (cancel a purchase)
GET/POST/DELETE      /api/purchase-returns  (no PUT — returns are immutable once created)

# Financial
GET/POST/PUT/DELETE  /api/expenses
GET/POST/PUT/DELETE  /api/income
GET/POST/PUT/DELETE  /api/accounts
GET/POST/PUT/DELETE  /api/transactions
GET/POST             /api/receipt-vouchers
GET/POST             /api/payment-vouchers
GET/POST             /api/deposit-vouchers
GET/POST             /api/treasury-vouchers
GET/POST             /api/safe-transfers

# HR
GET/POST/PUT/DELETE  /api/employees
GET/POST/PUT/DELETE  /api/payroll
GET/POST/PUT/DELETE  /api/attendance
GET/POST/PUT/DELETE  /api/leaves
GET/POST/PUT/DELETE  /api/salary-advances
GET/POST/PUT/DELETE  /api/branches
GET/POST/PUT/DELETE  /api/incentives

# Reports & Analytics
GET    /api/reports/*
GET    /api/dashboard
GET    /api/profits
GET    /api/metrics

# Settings & Configuration
GET/POST/PUT         /api/settings
GET/POST/PUT         /api/fiscal-years
GET/POST/PUT/DELETE  /api/categories
GET/POST/PUT/DELETE  /api/exchange-rates
```

---

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | Platform owner — manages all tenant companies |
| `admin` | Company administrator — full access to their company |
| `manager` | Manager — broad access, some admin-only actions blocked |
| `cashier` | POS operator — must have warehouse + safe assigned |
| `salesperson` | Sales staff — must have warehouse + safe assigned |
| `accountant` | Accounting access |
| `viewer` | Read-only access |

---

## Deployment

The project ships with these files at the repository root:
- `nginx.conf` — Nginx reverse proxy configuration
- `ecosystem.config.cjs` — PM2 process manager configuration
- `docker-compose.yml` — Docker orchestration
- `deploy.sh` — Production startup script
- `DEPLOY.md` — Detailed deployment guide

In production the Express server serves the static React build from `artifacts/erp-system/dist/public/`, eliminating the need for a separate frontend server.
