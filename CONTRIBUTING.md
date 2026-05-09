# Contributing to MUHKAM ERP — المساهمة في مشروع مُحكم ERP

> **Language / اللغة**: This document is bilingual — English first, Arabic below each section.  
> هذا المستند ثنائي اللغة — الإنجليزية أولاً، ثم العربية أسفل كل قسم.

---

## 1. Development Environment Setup — إعداد بيئة التطوير

### English

**Prerequisites:**

- **Node.js 22+** — server runtime and tooling
- **pnpm 10+** — the only supported package manager (do not use npm or yarn)
- **PostgreSQL 16+** — primary database
- **Docker** (optional) — to run PostgreSQL and Redis in isolated containers

**Setup steps:**

```bash
# 1. Clone the repository
git clone https://github.com/your-org/muhkam-erp.git
cd muhkam-erp

# 2. Install all workspace packages
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env — minimum required variables:
# DATABASE_URL=postgresql://user:password@localhost:5432/muhkam
# JWT_SECRET=<strong-random-secret-min-32-chars>
# JWT_REFRESH_SECRET=<different-strong-random-secret>

# 4. Push the database schema
pnpm --filter @workspace/db run push

# 5. Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# 6. In a new terminal — start the frontend (port 5000)
pnpm --filter @workspace/erp-system run dev
```

Navigate to `http://localhost:5000` to access the system.

### العربية

**المتطلبات الأساسية:**

- **Node.js 22+** — بيئة تشغيل JavaScript للخادم والأدوات
- **pnpm 10+** — مدير الحزم الوحيد المدعوم (لا تستخدم npm أو yarn)
- **PostgreSQL 16+** — قاعدة البيانات الرئيسية
- **Docker** (اختياري) — لتشغيل PostgreSQL وRedis في حاويات معزولة

**خطوات الإعداد:**

```bash
# 1. استنساخ المستودع
git clone https://github.com/your-org/muhkam-erp.git
cd muhkam-erp

# 2. تثبيت جميع الحزم
pnpm install

# 3. إعداد متغيرات البيئة
cp .env.example .env
# عدِّل .env — المتغيرات الأساسية المطلوبة:
# DATABASE_URL=postgresql://user:password@localhost:5432/muhkam
# JWT_SECRET=<سرّ قوي وعشوائي — 32 حرفًا على الأقل>
# JWT_REFRESH_SECRET=<سرّ ثانٍ مختلف تماماً>

# 4. دفع مخطط قاعدة البيانات
pnpm --filter @workspace/db run push

# 5. تشغيل الخادم الخلفي (المنفذ 8080)
pnpm --filter @workspace/api-server run dev

# 6. في نافذة طرفية جديدة — تشغيل الواجهة الأمامية (المنفذ 5000)
pnpm --filter @workspace/erp-system run dev
```

افتح المتصفح على `http://localhost:5000` للوصول إلى النظام.

---

## 2. Project Structure — هيكل المشروع

### English

```
muhkam-erp/
├── artifacts/
│   ├── api-server/       # Backend — Express 5 + TypeScript + Drizzle ORM
│   ├── erp-system/       # Web frontend — React 19 + Vite + Tailwind v4
│   ├── erp-mobile/       # Mobile app — Expo + React Native
│   └── mockup-sandbox/   # Component preview sandbox — Vite
├── lib/
│   ├── db/               # Database schema (Drizzle ORM) + connection pool
│   ├── api-spec/         # OpenAPI spec (openapi.yaml) — single source of truth
│   ├── api-zod/          # Zod schemas auto-generated from the spec
│   └── api-client-react/ # React Query hooks auto-generated from the spec
├── docs/
│   └── ADR/              # Architecture Decision Records
├── scripts/              # Build, deploy, and maintenance scripts
├── CHANGELOG.md
└── CONTRIBUTING.md
```

| Directory | Description |
|-----------|-------------|
| `artifacts/api-server/src/routes/` | One file per feature area. All routes require `authenticate` + `requireRole`. |
| `artifacts/api-server/src/lib/` | Shared utilities: logger, job-queue, monitor, prom-metrics, request-counter. |
| `artifacts/api-server/src/middleware/` | Auth, tenant guard, email-verify guard, rate limit, request timeout. |
| `lib/db/src/schema/` | All ~50 Drizzle table definitions. Any schema change starts here. |

### العربية

```
muhkam-erp/
├── artifacts/
│   ├── api-server/       # الخادم الخلفي — Express 5 + TypeScript + Drizzle ORM
│   ├── erp-system/       # الواجهة الأمامية — React 19 + Vite + Tailwind v4
│   ├── erp-mobile/       # تطبيق الجوال — Expo + React Native
│   └── mockup-sandbox/   # بيئة معاينة المكونات — Vite
├── lib/
│   ├── db/               # مخطط قاعدة البيانات (Drizzle ORM) وإعدادات الاتصال
│   ├── api-spec/         # مواصفة OpenAPI — مصدر الحقيقة للـ API
│   ├── api-zod/          # مخططات Zod مولَّدة تلقائياً من المواصفة
│   └── api-client-react/ # Hooks React Query مولَّدة تلقائياً
├── docs/
│   └── ADR/              # سجلات قرارات المعمارية
└── scripts/              # سكريبتات البناء والنشر والصيانة
```

---

## 3. Code Style Guidelines — إرشادات أسلوب الكود

### English

**TypeScript**

- `strict: true` is enabled in all packages — code that fails `pnpm typecheck` is not merged.
- Avoid `any` in production code. If unavoidable, add an inline comment explaining why.
- Import Zod as `import { z } from "zod/v4"` — never from the root `"zod"` path.
- All new route files must use `schema.safeParse(req.body)` and return `400` with Arabic error messages on failure.

**API routes**

- Every handler must call `authenticate` + `requireRole(...)` middleware.
- Always use `getTenant(req)` for `company_id` — never hardcode `1` or use `?? 1`.
- Wrap async handlers; Express 5 propagates async errors automatically.
- Return consistent JSON shapes: `{ data }` for success, `{ error, details? }` for errors.

**Database**

- Schema changes go in `lib/db/src/schema/`, exported from `lib/db/src/schema/index.ts`.
- Run `pnpm --filter @workspace/db run push` after schema changes in development.
- Never write raw SQL strings — use Drizzle query builder exclusively.
- Every query against a tenant table must include a `company_id` filter.

### العربية

**TypeScript**

- وضع `strict: true` مفعَّل في جميع المشاريع — أي كود يفشل في `pnpm typecheck` لن يُدمج.
- تجنب `any` في كود الإنتاج. إن كان لا مفر منه، أضف تعليقًا يشرح السبب.
- استيراد Zod بالصيغة `import { z } from "zod/v4"` — وليس من `"zod"` المباشرة.
- جميع ملفات المسارات الجديدة يجب أن تستخدم `schema.safeParse(req.body)` وتُرجع `400` مع رسائل خطأ بالعربية.

**مسارات API**

- كل معالج يجب أن يستدعي وسيط `authenticate` + `requireRole(...)`.
- استخدم دائمًا `getTenant(req)` للحصول على `company_id` — لا تُرمِّز `1` أو تستخدم `?? 1`.
- كل استعلام على جداول المستأجرين يجب أن يتضمن فلتر `company_id`.

---

## 4. Running Tests — تشغيل الاختبارات

### English

```bash
# Run all backend tests (Vitest)
pnpm --filter @workspace/api-server test --run

# Watch mode for active development
pnpm --filter @workspace/api-server test:watch

# Code coverage report
pnpm --filter @workspace/api-server test:coverage

# Run the full workspace test suite
pnpm run test:all

# TypeScript type check (must pass with zero errors)
pnpm --filter @workspace/api-server typecheck
```

**Test structure:**

```
artifacts/api-server/src/__tests__/
├── routes/              # One test file per route module
├── integration/         # Multi-tenant isolation and concurrency tests
├── smoke/               # Critical-path end-to-end flows
├── lib/                 # Unit tests for utilities (hash, sanitize, etc.)
├── auth.test.ts         # Authentication flows
├── security.test.ts     # Security middleware checks
├── tenant.test.ts       # Tenant resolution logic
└── validation.test.ts   # Zod schema validation
```

All 306 tests must pass before any PR is opened. The CI gate rejects PRs with failing tests.

### العربية

```bash
# تشغيل جميع اختبارات الخادم الخلفي
pnpm --filter @workspace/api-server test --run

# وضع المراقبة للتطوير النشط
pnpm --filter @workspace/api-server test:watch

# تقرير تغطية الكود
pnpm --filter @workspace/api-server test:coverage

# تشغيل جميع اختبارات المشروع
pnpm run test:all

# فحص أنواع TypeScript (يجب أن ينجح بدون أخطاء)
pnpm --filter @workspace/api-server typecheck
```

جميع الاختبارات الـ 306 يجب أن تنجح قبل فتح أي Pull Request. يرفض CI أي PR بها اختبارات فاشلة.

---

## 5. Submitting a Pull Request — تقديم Pull Request

### English

1. **Fork** the repository and create a branch from `main`.
2. **Branch naming convention:**
   ```
   feature/short-description      # new feature
   fix/short-description          # bug fix
   refactor/short-description     # refactoring without behaviour change
   docs/short-description         # documentation only
   ```
3. **Commit messages** — use the Conventional Commits format in Arabic or English:
   ```
   feat: add bank reconciliation statement import
   fix: correct ledger direction for credit sales
   refactor: extract safe-transfer logic to service layer
   docs: add ADR for JWT cookie strategy
   ```
4. **Before opening a PR**, ensure all of the following pass locally:
   ```bash
   pnpm --filter @workspace/api-server typecheck   # zero TS errors
   pnpm --filter @workspace/api-server lint        # zero lint errors
   pnpm --filter @workspace/api-server test --run  # all 306 tests pass
   ```
5. **PR description** must include:
   - What changed and why
   - How to test the change manually
   - Any migration steps required (schema changes, env vars)
6. **At least one reviewer approval** is required before merging.
7. Never push directly to `main`.

### العربية

1. **Fork** المستودع وأنشئ فرعًا من `main`.
2. **اصطلاح تسمية الفروع:**
   ```
   feature/وصف-قصير          # ميزة جديدة
   fix/وصف-قصير              # إصلاح خطأ
   refactor/وصف-قصير         # إعادة هيكلة دون تغيير السلوك
   docs/وصف-قصير             # توثيق فقط
   ```
3. **رسائل الـ Commit** — استخدم صيغة Conventional Commits بالعربية أو الإنجليزية:
   ```
   feat: إضافة استيراد كشف حساب بنكي للمطابقة
   fix: تصحيح اتجاه دفتر الأستاذ للمبيعات الآجلة
   refactor: استخراج منطق التحويل إلى طبقة خدمة
   docs: إضافة ADR لاستراتيجية JWT Cookies
   ```
4. **قبل فتح Pull Request**، تأكد من نجاح الأوامر التالية:
   ```bash
   pnpm --filter @workspace/api-server typecheck   # صفر أخطاء TypeScript
   pnpm --filter @workspace/api-server lint        # صفر أخطاء Lint
   pnpm --filter @workspace/api-server test --run  # جميع الـ 306 اختبار ناجحة
   ```
5. **وصف Pull Request** يجب أن يتضمن:
   - ماذا تغيَّر ولماذا
   - كيفية اختبار التغيير يدويًا
   - أي خطوات ترحيل مطلوبة (تغييرات مخطط، متغيرات بيئة)
6. **موافقة مراجع واحد على الأقل** مطلوبة قبل الدمج.
7. لا تُرفع أي commits مباشرة إلى `main`.

---

## 6. Security Reporting — الإبلاغ عن الثغرات الأمنية

### English

Do **not** open a public GitHub issue for security vulnerabilities. Instead, contact the maintainers privately at `security@muhkam.sa`. Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment

We aim to respond within 48 hours and release a patch within 7 days for critical issues.

### العربية

**لا** تفتح issue عامًا على GitHub للإبلاغ عن ثغرات أمنية. بدلاً من ذلك، تواصل مع الفريق خاصةً على `security@muhkam.sa` مع تضمين:
- وصف الثغرة
- خطوات إعادة الإنتاج
- تقييم الأثر المحتمل

نهدف إلى الرد خلال 48 ساعة وإصدار تصحيح خلال 7 أيام للثغرات الحرجة.
