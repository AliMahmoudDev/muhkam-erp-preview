<div align="center">

# مُحكم ERP

**نظام تخطيط موارد المؤسسات للشركات الصغيرة والمتوسطة في العالم العربي**

*Enterprise Resource Planning — Built for Arabic SMEs*

---

[![CI — Test, Lint, Type Check](https://github.com/your-org/muhkam-erp/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/muhkam-erp/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-359%20passing-brightgreen?style=flat-square&logo=vitest)](https://github.com/your-org/muhkam-erp)
[![TypeScript](https://img.shields.io/badge/TypeScript-zero%20errors-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Security Score](https://img.shields.io/badge/security%20score-9.3%2F10-success?style=flat-square&logo=shield)](docs/ADR/ADR-001-jwt-httponly-cookies.md)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-20%20LTS-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

<br/>

[🌐 العرض الحي — Live Demo](https://halaltec.com) &nbsp;·&nbsp; [📖 دليل التشغيل](docs/RUNBOOK.md) &nbsp;·&nbsp; [🏗️ قرارات المعمارية](docs/ADR/) &nbsp;·&nbsp; [🔒 الأمان](SECURITY.md)

</div>

---

## 📋 المحتويات — Contents

- [نظرة عامة — Overview](#-نظرة-عامة--overview)
- [الإحصائيات التقنية — Technical Stats](#-الإحصائيات-التقنية--technical-stats)
- [المكدس التقني — Tech Stack](#-المكدس-التقني--tech-stack)
- [المعمارية — Architecture](#-المعمارية--architecture)
- [البدء السريع — Quick Start](#-البدء-السريع--quick-start)
- [هيكل المشروع — Project Structure](#-هيكل-المشروع--project-structure)
- [التوثيق — Documentation](#-التوثيق--documentation)
- [المساهمة — Contributing](#-المساهمة--contributing)

---

## 🎯 نظرة عامة — Overview

<table>
<tr>
<td width="50%" valign="top">

### العربية

**مُحكم ERP** نظام متكامل لإدارة موارد الشركات، مصمم خصيصًا للشركات الصغيرة والمتوسطة في السوق العربي.

يوفر النظام:
- 🏢 **تعددية المستأجرين** — عزل كامل للبيانات بين الشركات
- 💰 **محاسبة متكاملة** — قيود يومية، ميزانية عمومية، أرباح وخسائر
- 📦 **إدارة المخزون** — تتبع دقيق بالتكلفة المتوسطة المرجحة (WAC)
- 👥 **الموارد البشرية** — رواتب، حضور، إجازات، سلف
- 🔧 **إدارة الإصلاحات** — ورشة الأجهزة والضمانات
- 📱 **تطبيق جوال** — كاشير ومبيعات على iOS وAndroid
- 🌍 **دعم اللغة العربية** — واجهة RTL وتقارير بالعربية
- 🖥️ **نقطة بيع (POS)** — مع قارئ QR وباركود

الهدف: شركات التجزئة والخدمات في المملكة العربية السعودية ودول الخليج.

</td>
<td width="50%" valign="top">

### English

**MUHKAM ERP** is a full-featured enterprise resource planning system built specifically for Arabic-speaking SMEs in the Gulf region.

The system covers:
- 🏢 **Multi-tenant SaaS** — complete data isolation per company
- 💰 **Full accounting** — journal entries, balance sheet, P&L
- 📦 **Inventory management** — WAC costing, multi-warehouse
- 👥 **HR & Payroll** — salaries, attendance, leaves, advances
- 🔧 **Repair management** — device workshop and warranty tracking
- 📱 **Mobile POS** — cashier and sales on iOS & Android
- 🌍 **Arabic-first** — RTL UI, Arabic reports and invoices
- 🖥️ **Point of Sale** — QR and barcode scanning built-in

Target market: retail and services companies in KSA and the GCC.

</td>
</tr>
</table>

---

## 📊 الإحصائيات التقنية — Technical Stats

<div align="center">

| المقياس | القيمة | التفاصيل |
|---|---|---|
| 🧪 **Automated Tests** | **359 passing** | 39 test files · 15,818 lines of test code |
| 🔒 **Security Score** | **9.3 / 10** | Helmet · JWT httpOnly · TOTP 2FA · RLS · 3-tier rate limiting |
| 🌿 **Branch Coverage** | **68%+ enforced** | Vitest v8 · CI-gated thresholds on critical modules |
| ⚡ **TypeScript Errors** | **Zero** | Strict mode · `tsc --noEmit` runs on every CI push |
| 🔁 **CI/CD Pipelines** | **3 workflows** | Test + Lint · Production Deploy · Playwright E2E |
| ✅ **Zod Validations** | **631 usages** | Every route input validated · `@workspace/api-zod` |
| 🗄️ **Database Schema** | **173 table definitions** | Drizzle ORM · PostgreSQL 16 · type-safe queries |
| 📐 **ADRs Documented** | **7 decisions** | Auth · WAC · RLS · Monorepo · Redis · Zod · Testing |
| 📡 **API Route Modules** | **65 modules** | Express 5 · multi-tenant scoped · Zod-validated |
| 📋 **Audit Log Calls** | **89 in routes** | Every financial mutation is permanently traceable |
| 🚀 **Source Lines** | **37,971** | Across API, frontend, and mobile (excl. tests) |
| 📱 **Mobile Screens** | **24** | Expo 54 · iOS & Android POS |

</div>

---

## 🛠️ المكدس التقني — Tech Stack

### الخلفية — Backend

[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-ioredis%205-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Drizzle](https://img.shields.io/badge/Drizzle%20ORM-0.45-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Zod](https://img.shields.io/badge/Zod-3.25-3E67B1?style=for-the-badge&logo=zod&logoColor=white)](https://zod.dev/)

| الطبقة | التقنية | الغرض |
|---|---|---|
| Runtime | Node.js 20 LTS | JavaScript runtime |
| Language | TypeScript 5 (strict) | Type safety across the full stack |
| Framework | Express 5 | HTTP server and routing |
| ORM | Drizzle ORM 0.45 | Type-safe SQL, zero-overhead queries |
| Database | PostgreSQL 16 | Primary data store with Row Level Security |
| Cache | Redis (ioredis 5) | Route-level caching with TTL invalidation |
| Validation | Zod 3.25 | Schema-first input validation on every endpoint |
| Auth | JWT + bcryptjs + TOTP | httpOnly cookies · 2FA · bcrypt password hashing |
| Logging | Pino | Structured JSON logging with request-ID tracing |
| Metrics | prom-client | Prometheus-compatible `/metrics` endpoint |
| Email | Nodemailer | Transactional email (verification, alerts) |
| Process | PM2 | Clustering, auto-restart, log management |

### الواجهة الأمامية — Frontend

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5-FF4154?style=for-the-badge&logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Radix UI](https://img.shields.io/badge/Radix%20UI-2-161618?style=for-the-badge&logo=radixui&logoColor=white)](https://www.radix-ui.com/)

| التقنية | الغرض |
|---|---|
| React 19 | UI framework with concurrent features |
| Vite 7 | Lightning-fast build tool and HMR dev server |
| TanStack Query v5 | Server state management, caching, and background sync |
| Tailwind CSS 4 | Utility-first RTL-compatible styling |
| Radix UI | Accessible, unstyled headless components |
| React Hook Form + Zod | Type-safe forms synced with backend Zod schemas |
| GSAP | Smooth animations and transitions |
| jsPDF + ExcelJS | Arabic PDF invoice and Excel report generation |
| ZXing | In-browser QR code and barcode scanning |
| Sentry | Frontend error monitoring and performance tracking |

### الجوال — Mobile

[![Expo](https://img.shields.io/badge/Expo-54-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)

- تطبيق كاشير ونقطة بيع (POS) لـ iOS وAndroid
- **24 شاشة** تغطي: المبيعات، المدفوعات، الكاميرا، QR Scanner، تقارير الوردية
- Expo Camera · Expo Barcode Scanner · Full RTL layout support
- مشاركة schemas وvalidation مع الـ backend عبر `@workspace/api-zod`

### البنية التحتية — Infrastructure

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Nginx](https://img.shields.io/badge/Nginx-Reverse%20Proxy-009639?style=for-the-badge&logo=nginx&logoColor=white)](https://nginx.org/)
[![PM2](https://img.shields.io/badge/PM2-Process%20Manager-2B037A?style=for-the-badge&logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Metrics-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)](https://prometheus.io/)

| المكون | الغرض |
|---|---|
| Docker Compose | Local dev environment orchestration |
| Nginx | Reverse proxy, SSL termination, static file serving |
| PM2 | Process clustering, zero-downtime restarts, log management |
| Redis | Caching layer for high-read API routes |
| PostgreSQL 16 | Primary database with connection pool monitoring |
| Automated Backups | AES-256-GCM encrypted, scheduled database dumps |
| Prometheus | Production metrics collection via `/api/metrics` |

### الاختبارات — Testing

[![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Supertest](https://img.shields.io/badge/Supertest-7-blue?style=for-the-badge)](https://github.com/ladjs/supertest)

```
359 Integration Tests  →  Supertest + Vitest  (real PostgreSQL, no mocks)
 39 Test Files         →  15,818 lines of test code
  3 CI/CD Pipelines    →  GitHub Actions (test · deploy · e2e)
 E2E Suite             →  Playwright (locale: ar-EG, viewport: 1280×720)
```

---

## 🏗️ المعمارية — Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Nginx (Reverse Proxy)                     │
│           SSL Termination · Rate Limiting · Static Files        │
└──────────────────┬─────────────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌────────────────────────────────┐
│ React 19 │  │  Expo 54 │  │       Express 5 API Server     │
│ Web App  │  │  Mobile  │  │                                │
│  (Vite)  │  │ iOS/And  │  │  ┌─────────────────────────┐  │
└──────────┘  └──────────┘  │  │      Middleware Stack    │  │
                             │  │  request-id · auth ·    │  │
                             │  │  tenant-guard · rate-   │  │
                             │  │  limit · feature-guard  │  │
                             │  └────────────┬────────────┘  │
                             │               │               │
                             │  ┌────────────▼────────────┐  │
                             │  │     65 Route Modules    │  │
                             │  │  Zod-validated · multi- │  │
                             │  │  tenant · audit-logged  │  │
                             │  └────────────┬────────────┘  │
                             └───────────────┼───────────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         ▼                   ▼                   ▼
                  ┌────────────┐      ┌───────────┐      ┌────────────┐
                  │ PostgreSQL │      │   Redis   │      │ Prometheus │
                  │  16 + RLS  │      │  Cache    │      │  Metrics   │
                  │  Drizzle   │      │  ioredis  │      │ /api/metrics│
                  └────────────┘      └───────────┘      └────────────┘
```

### 🔐 الأمان — Security Layers

| الطبقة | الآلية |
|---|---|
| **Authentication** | JWT tokens stored in httpOnly cookies — no localStorage exposure — [ADR-001](docs/ADR/ADR-001-jwt-httponly-cookies.md) |
| **Two-Factor Auth** | TOTP (Time-based One-Time Password) — compatible with Google Authenticator |
| **Multi-tenancy** | `company_id` scoped on every query + PostgreSQL Row Level Security — [ADR-003](docs/ADR/ADR-003-rls-defense-in-depth.md) |
| **Rate Limiting** | 3 independent tiers: general API · strict auth endpoints · per-tenant throttling |
| **Input Validation** | Zod schemas on every route — 631 validation points — [ADR-006](docs/ADR/ADR-006-zod-validation.md) |
| **HTTP Hardening** | Helmet CSP headers · CORS allowlist · HPP body-pollution protection |
| **Audit Trail** | 89 `writeAuditLog` calls — every financial mutation permanently recorded |
| **Encrypted Backups** | AES-256-GCM encryption on all automated database dumps |
| **Threat Model** | Full STRIDE threat model documented — [threat_model.md](threat_model.md) |

### 💰 نموذج التكلفة — Inventory Costing (WAC)

يستخدم النظام **التكلفة المتوسطة المرجحة (WAC)** لتقييم المخزون. يُحسب المتوسط تلقائيًا عند كل عملية شراء جديدة ويُحدَّث في قاعدة البيانات فورًا مع الحفاظ على سجل كامل بالقيم التاريخية — [ADR-002](docs/ADR/ADR-002-wac-costing.md).

> The system uses **Weighted Average Cost (WAC)** for all inventory valuation. WAC is recalculated automatically on every purchase receipt and cascaded through all dependent financial records in a single transaction.

### ⚡ الأداء — Performance Optimizations

| التحسين | التفاصيل |
|---|---|
| **Redis Caching** | 7 high-read routes cached: accounts, products, customers, categories, price lists, exchange rates, settings |
| **Cache Invalidation** | Write-through: every POST/PUT/DELETE invalidates relevant cache keys immediately |
| **Slow Query Logging** | Queries exceeding 200ms are automatically logged with query text and duration |
| **Pagination** | 141 paginated endpoints — no unbounded `SELECT *` on production data paths |
| **Response Compression** | gzip active on all API responses via compression middleware |
| **Request Tracing** | UUID request-ID on every request — correlates logs across the full response lifecycle |
| **Pool Monitoring** | PostgreSQL connection pool health exposed at `/api/health` with latency metrics |

---

## 🚀 البدء السريع — Quick Start

### المتطلبات — Prerequisites

```bash
Node.js    >= 20 LTS
pnpm       >= 10
PostgreSQL >= 16
Redis      >= 7    # Optional — the cache degrades gracefully without it
```

### التثبيت — Installation

```bash
# 1. استنساخ المستودع — Clone the repository
git clone https://github.com/your-org/muhkam-erp.git
cd muhkam-erp

# 2. تثبيت التبعيات — Install all workspace dependencies
pnpm install

# 3. إعداد متغيرات البيئة — Configure environment variables
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Edit .env — see the table below for required values
```

### إعداد قاعدة البيانات — Database Setup

```bash
cd artifacts/api-server

# تشغيل migrations — Apply all schema migrations
pnpm db:migrate

# بيانات أولية اختيارية — Optional: seed initial data
pnpm db:seed
```

### تشغيل بيئة التطوير — Start Development

```bash
# API Server → http://localhost:3000
pnpm --filter @workspace/api-server dev

# Web Frontend → http://localhost:5173
pnpm --filter @workspace/erp-system dev

# Mobile App (Expo)
pnpm --filter @workspace/erp-mobile start
```

### الاختبارات — Running Tests

```bash
# تشغيل جميع الاختبارات — Run all 359 tests
pnpm --filter @workspace/api-server test

# مع تقرير التغطية — With coverage report
pnpm --filter @workspace/api-server test -- --coverage

# Playwright E2E (Arabic locale ar-EG)
pnpm test:e2e

# فحص الأنواع عبر كل الحزم — Full monorepo type check
pnpm typecheck
```

### Docker (بيئة محلية كاملة — Full local environment)

```bash
# تشغيل PostgreSQL و Redis
docker compose up -d postgres redis

# ثم تشغيل الخدمات — Then start services
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/erp-system dev
```

### متغيرات البيئة الأساسية — Key Environment Variables

```env
# ═══════════════════════════════════════
# قاعدة البيانات — Database
# ═══════════════════════════════════════
DATABASE_URL=postgresql://user:password@localhost:5432/muhkam

# ═══════════════════════════════════════
# الأمان — Security (generate with: openssl rand -base64 64)
# ═══════════════════════════════════════
JWT_SECRET=your-256-bit-secret-minimum-32-chars
JWT_REFRESH_SECRET=your-separate-refresh-secret

# ═══════════════════════════════════════
# Redis — اختياري (يعمل بدونه)
# ═══════════════════════════════════════
REDIS_URL=redis://localhost:6379

# ═══════════════════════════════════════
# البريد الإلكتروني — Email (Nodemailer)
# ═══════════════════════════════════════
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password

# ═══════════════════════════════════════
# تنبيهات Telegram — اختياري
# ═══════════════════════════════════════
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

---

## 📁 هيكل المشروع — Project Structure

```
muhkam-erp/
│
├── artifacts/
│   │
│   ├── api-server/                    # 🖥️  Express 5 API (Node.js + TypeScript)
│   │   └── src/
│   │       ├── routes/                # 65 route modules
│   │       │   ├── sales/             #   └─ Sales (create · reports · returns)
│   │       │   ├── devices/           #   └─ Device workshop (CRUD · repairs · returns)
│   │       │   ├── payroll/           #   └─ HR & Payroll (salary · periods · processing)
│   │       │   ├── repairs/           #   └─ Repair management
│   │       │   ├── employees/         #   └─ Employee management
│   │       │   ├── reports/           #   └─ Financial & operational reports
│   │       │   ├── auth/              #   └─ Authentication (login · 2FA · refresh)
│   │       │   ├── customers.ts       #   └─ Customer ledger & receipts
│   │       │   ├── products.ts        #   └─ Product catalog (WAC pricing)
│   │       │   ├── inventory.ts       #   └─ Stock audit & adjustments
│   │       │   ├── purchases.ts       #   └─ Purchase orders & receiving
│   │       │   ├── accounts.ts        #   └─ Chart of accounts
│   │       │   └── ...                #   └─ 50+ additional modules
│   │       │
│   │       ├── middleware/            # 7 middleware modules
│   │       │   ├── auth.ts            #   └─ JWT verification + tenant extraction
│   │       │   ├── feature-guard.ts   #   └─ Feature-flag enforcement
│   │       │   ├── request-id.ts      #   └─ UUID request tracing
│   │       │   ├── request-timeout.ts #   └─ Per-route timeout enforcement
│   │       │   ├── per-tenant-rate-limit.ts
│   │       │   └── tenant-guard.ts
│   │       │
│   │       ├── lib/                   # 50 utility modules
│   │       │   ├── cache.ts           #   └─ Redis fail-open wrapper
│   │       │   ├── audit-log.ts       #   └─ Financial audit trail
│   │       │   ├── prom-metrics.ts    #   └─ Prometheus metrics collector
│   │       │   ├── slow-query.ts      #   └─ >200ms query instrumentation
│   │       │   ├── backup-crypto.ts   #   └─ AES-256-GCM encryption
│   │       │   ├── permissions.ts     #   └─ Role-based access control
│   │       │   └── ...
│   │       │
│   │       └── __tests__/             # 39 test files · 359 tests · 15,818 LOC
│   │
│   ├── erp-system/                    # ⚛️  React 19 Web Frontend
│   │   └── src/                       # 297 TypeScript + TSX files
│   │       ├── pages/                 #   Route-level page components
│   │       ├── components/            #   Shared UI (Radix UI + Tailwind)
│   │       ├── hooks/                 #   TanStack Query data hooks
│   │       └── lib/                   #   API client, PDF/Excel generators
│   │
│   └── erp-mobile/                    # 📱  Expo 54 Mobile App
│       └── app/                       # 24 screens — POS, Sales, Reports
│
├── lib/
│   └── db/                            # @workspace/db — Drizzle schema package
│       └── src/                       # 173 table definitions (pgTable)
│
├── docs/
│   ├── ADR/                           # Architecture Decision Records
│   │   ├── ADR-001-jwt-httponly-cookies.md
│   │   ├── ADR-002-wac-costing.md
│   │   ├── ADR-003-rls-defense-in-depth.md
│   │   ├── ADR-004-monorepo-pnpm.md
│   │   ├── ADR-005-redis-caching-strategy.md
│   │   ├── ADR-006-zod-validation.md
│   │   └── ADR-007-test-strategy.md
│   ├── RUNBOOK.md                     # Bilingual operational runbook (AR + EN)
│   └── DEPLOYMENT.md                  # Production deployment guide
│
├── deploy/
│   ├── nginx.conf                     # Production Nginx configuration
│   ├── deploy.sh                      # Deployment automation script
│   └── monitor.sh                     # Server health monitoring script
│
├── .github/workflows/
│   ├── ci.yml                         # Test · Lint · Type Check (every PR)
│   ├── deploy.yml                     # Production deployment pipeline
│   └── e2e.yml                        # Playwright E2E (locale: ar-EG)
│
├── ecosystem.config.cjs               # PM2 cluster configuration
├── docker-compose.yml                 # Local dev environment
├── playwright.config.ts               # E2E config (locale: ar-EG)
├── pnpm-workspace.yaml                # Monorepo + pinned dependency catalog
├── threat_model.md                    # Full STRIDE security threat model
└── SECURITY.md                        # Security policy and disclosure contact
```

---

## 📖 التوثيق — Documentation

| الوثيقة | الوصف |
|---|---|
| [RUNBOOK.md](docs/RUNBOOK.md) | دليل تشغيل ثنائي اللغة — 7 operational scenarios: DB failover, secret rotation, cache invalidation, Redis outage, `/healthz` 503 diagnosis, trial unblocking, backup restore |
| [ADR-001](docs/ADR/ADR-001-jwt-httponly-cookies.md) | Why JWT in httpOnly cookies (not localStorage) |
| [ADR-002](docs/ADR/ADR-002-wac-costing.md) | Weighted Average Cost inventory model and auto-calculation |
| [ADR-003](docs/ADR/ADR-003-rls-defense-in-depth.md) | Defense-in-depth with PostgreSQL Row Level Security |
| [ADR-004](docs/ADR/ADR-004-monorepo-pnpm.md) | pnpm monorepo structure and shared package strategy |
| [ADR-005](docs/ADR/ADR-005-redis-caching-strategy.md) | Redis caching — fail-open pattern, per-tenant keys, TTL strategy |
| [ADR-006](docs/ADR/ADR-006-zod-validation.md) | Zod for unified schema validation — backend + mobile sharing |
| [ADR-007](docs/ADR/ADR-007-test-strategy.md) | Test pyramid — Vitest + Supertest + Playwright, coverage gates |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step production deployment guide |
| [DATABASE.md](DATABASE.md) | Database schema overview and migration guide |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch strategy, commit conventions, PR checklist |
| [SECURITY.md](SECURITY.md) | Security policy and responsible disclosure |
| [threat_model.md](threat_model.md) | Full STRIDE threat model with mitigations |

---

## 🤝 المساهمة — Contributing

نرحب بالمساهمات! يرجى قراءة [دليل المساهمة](CONTRIBUTING.md) قبل فتح أي Pull Request.

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

```bash
# تشغيل مسار الجودة الكامل قبل الإرسال
# Run the full quality pipeline before submitting

pnpm typecheck      # Zero TypeScript errors required across all packages
pnpm lint           # ESLint must pass clean
pnpm format:check   # Prettier formatting enforced
pnpm test:all       # All 359 tests must pass
```

**Branch strategy:**
- `main` — production-ready, protected, requires passing CI
- `develop` — integration branch for feature work
- Feature branches: `feat/your-feature-name`

---

## 🛡️ الأمان — Security

للإبلاغ عن ثغرة أمنية، يرجى الاطلاع على [سياسة الأمان](SECURITY.md) ولا تفتح issue عام.

To report a vulnerability, please see our [Security Policy](SECURITY.md) — do not open a public issue.

---

<div align="center">

صُنع بـ ❤️ للسوق العربي

*Built with ❤️ for the Arabic market*

[🌐 halaltec.com](https://halaltec.com) &nbsp;·&nbsp; [📖 RUNBOOK](docs/RUNBOOK.md) &nbsp;·&nbsp; [🏗️ ADRs](docs/ADR/) &nbsp;·&nbsp; [🔒 Security](SECURITY.md)

</div>
