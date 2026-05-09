# ADR-007: Test Strategy — Vitest + Supertest + Playwright
# قرار معماري 007: استراتيجية الاختبار — Vitest + Supertest + Playwright

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-06-01 |
| **Deciders / المقررون** | Backend team |
| **Supersedes / يحلّ محل** | No previous test strategy |

---

## Context — السياق

### English

MUHKAM ERP is a financially critical application managing sales, purchases, payroll, and accounting for SMEs. Bugs in financial calculations — rounding errors, incorrect WAC (Weighted Average Cost) calculations, or incorrect journal entries — can cause real financial losses for users.

We needed a test strategy that:

1. **Covers the most critical business logic**: WAC costing, journal entry generation, sale posting/cancellation, returns, period locking.
2. **Tests the API as a black box**: Validates HTTP request/response contracts, not internal implementation details.
3. **Runs fast enough for CI**: Tests should complete in under 2 minutes for the full suite.
4. **Works without a running server**: Integration tests shouldn't need a live production-configured server.
5. **Is maintainable by a small team**: Low boilerplate, clear setup/teardown, ESM-native.

The tech stack is Node.js + Express 5 + TypeScript + Drizzle ORM. The monorepo uses pnpm workspaces.

### العربية

مُحكم ERP تطبيق حرج مالياً يُدير المبيعات والمشتريات والرواتب والمحاسبة. الأخطاء في الحسابات المالية — أخطاء التقريب، حسابات WAC الخاطئة، أو قيود محاسبية غير صحيحة — يمكن أن تُسبب خسائر مالية حقيقية للمستخدمين.

نحتاج استراتيجية اختبار:
1. تُغطي المنطق التجاري الأكثر أهمية: حساب WAC، توليد القيود المحاسبية، ترحيل/إلغاء المبيعات، المرتجعات، قفل الفترات.
2. تختبر الـ API كصندوق أسود.
3. تعمل بسرعة كافية للـ CI (أقل من دقيقتين للمجموعة الكاملة).
4. تعمل بدون خادم إنتاجي مُشغَّل.

---

## Decision — القرار

### English

We adopted a three-layer test pyramid:

### Layer 1: Unit Tests (Vitest)

**Tool**: Vitest 3.x  
**Scope**: Pure business logic — calculations, helpers, formatters, middleware logic.

**Why Vitest over Jest**:
- **ESM-native**: MUHKAM uses `"type": "module"` throughout. Jest requires complex transform config for ESM; Vitest supports it natively.
- **Speed**: Vitest uses Vite's transform pipeline — typically 2-5x faster than Jest for TypeScript projects.
- **API compatibility**: Vitest's API is Jest-compatible (`describe`, `it`, `expect`, `vi.mock`). No team retraining needed.
- **Single config**: One `vitest.config.ts` replaces both `jest.config.js` and `babel.config.js`.
- **Watch mode**: Vitest's watch mode is significantly faster than Jest's for large TypeScript projects.

**What we test at this layer**:
- WAC calculation math (`lib/wac.ts`)
- Invoice number generation (`lib/invoice-no.ts`)
- Permission checks (`lib/permissions.ts`)
- Date/period validation logic
- Zod schema validation edge cases
- Formatter functions (`formatSale`, `formatProduct`)

### Layer 2: Integration Tests (Vitest + Supertest)

**Tools**: Vitest 3.x + Supertest 7.x  
**Scope**: Full HTTP request/response cycle against a real test database.

**Why Supertest**:
- Starts an Express app in-process (no network required) — fastest possible integration testing.
- Returns a Supertest agent that supports chaining: `.post('/api/sales').send(body).expect(201)`.
- Works with the existing Express app export without modification.
- Battle-tested: used by thousands of Express projects.

**Test database strategy**:
- A dedicated PostgreSQL database (`muhkam_test`) is used for tests.
- `beforeEach`: inserts a fresh test company + admin user via a seed helper.
- `afterEach`: deletes all rows for the test company (not truncate — preserves sequences).
- Tests run serially within a file (Vitest `--no-threads` for DB-touching tests) but files can run in parallel.

**What we test at this layer** (359 tests across 38 files as of 2025-06):
- Complete sale creation → stock decrement → journal entry flow
- WAC recalculation on purchase returns
- Period lock enforcement
- JWT authentication middleware
- Multi-tenant isolation (company A cannot access company B's data)
- Cache invalidation (mock Redis, verify `DEL` calls)
- Rate limiting behavior

### Layer 3: End-to-End Tests (Playwright) — Planned

**Tool**: Playwright 1.x  
**Scope**: Critical user journeys in the full browser stack (frontend + API).

**Status**: Infrastructure prepared; not yet in CI.  
**Planned coverage**:
- Login → create sale → print receipt flow
- Purchase → stock increase → inventory audit consistency
- User role restrictions (cashier cannot access admin routes in UI)

### العربية

اعتمدنا هرم اختبار ثلاثي الطبقات:

**الطبقة 1 — اختبارات الوحدة (Vitest)**: المنطق التجاري الصرف — الحسابات، المساعدات، المُنسِّقات.

**لماذا Vitest بدلاً من Jest**:
- دعم ESM أصلي (المشروع يستخدم `"type": "module"`)
- أسرع 2-5 مرات لمشاريع TypeScript
- متوافق مع API الخاصة بـ Jest

**الطبقة 2 — اختبارات التكامل (Vitest + Supertest)**: دورة HTTP كاملة مقابل قاعدة بيانات اختبار حقيقية.

**لماذا Supertest**:
- يُشغِّل تطبيق Express في العملية نفسها (لا شبكة مطلوبة)
- أسرع اختبار تكامل ممكن
- مُجرَّب من آلاف مشاريع Express

**الطبقة 3 — اختبارات شاملة (Playwright)**: رحلات المستخدم الحرجة في المتصفح الكامل — مخطط لها، البنية التحتية جاهزة.

---

## Alternatives Considered — البدائل المدروسة

### English

| Alternative | Reason Rejected |
|-------------|-----------------|
| **Jest** | ESM support requires complex babel/transform config; slower for TS; `moduleNameMapper` hacks needed for workspace imports |
| **Mocha + Chai** | Requires separate assertion library; no built-in TypeScript support; less integrated watch mode |
| **node:test** (Node built-in) | Limited mocking capabilities; no parallel file execution; poor TypeScript support |
| **Cypress** (for integration) | Browser-based; too heavy for API testing; requires running server; slower CI |
| **Artillery / k6** (load testing) | Performance testing, not correctness testing; different tool category |
| **Prisma's test helpers** | Not applicable — we use Drizzle ORM |

### العربية

| البديل | سبب الرفض |
|--------|-----------|
| **Jest** | دعم ESM معقد؛ أبطأ للـ TypeScript |
| **Mocha + Chai** | يتطلب مكتبة تأكيدات منفصلة؛ دعم TypeScript محدود |
| **node:test** | قدرات mocking محدودة؛ دعم TypeScript ضعيف |
| **Cypress** | ثقيل جداً لاختبار API؛ يتطلب خادماً مُشغَّلاً |

---

## Consequences — التبعات

### English

**Positive**:
- **Fast feedback loop**: The full 359-test suite runs in ~40s locally (integration + unit).
- **High confidence in financial logic**: 38 test files covering all critical financial flows (sales, purchases, returns, payroll, accounting).
- **No server startup required**: Supertest starts Express in-process; tests can run in `CI=true` environments without network configuration.
- **ESM-native**: No transform config, no `moduleNameMapper` hacks, just TypeScript.
- **Shared types**: Zod schemas from `@workspace/api-zod` are imported and tested directly in integration tests.

**Negative / Trade-offs**:
- **Real DB required for integration tests**: Tests need a PostgreSQL instance. Solved via Docker Compose in CI and a local dev DB.
- **Test isolation is manual**: `beforeEach`/`afterEach` cleanup must be maintained as new tables are added.
- **No E2E coverage yet**: Playwright tests exist in the plan but not yet in CI — full browser regressions are caught manually.
- **Serial execution for DB tests**: Tests touching the DB run serially within a file to prevent race conditions. This is slower than full parallelism but necessary for correctness.

**Metrics** (as of 2025-06):
- Test files: 38
- Total tests: 359
- Suite duration: ~41s (CI environment)
- Critical paths covered: sales lifecycle, purchase lifecycle, returns, payroll, accounting, auth, multi-tenancy

### العربية

**إيجابيات**: حلقة تغذية راجعة سريعة — 359 اختباراً في ~40 ثانية. ثقة عالية في المنطق المالي. لا يحتاج بدء تشغيل خادم. دعم ESM أصلي.

**سلبيات**: يتطلب قاعدة بيانات PostgreSQL حقيقية للاختبارات التكاملية. التنظيف بين الاختبارات يدوي. لا تغطية E2E في CI حتى الآن.

**مقاييس** (اعتباراً من 2025-06):
- ملفات الاختبار: 38
- إجمالي الاختبارات: 359
- مدة المجموعة: ~41 ثانية

---

## Configuration Reference — مرجع الإعداد

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    pool: 'forks',        // process isolation for DB tests
    poolOptions: {
      forks: {
        singleFork: true  // serial execution to avoid DB race conditions
      }
    },
    testTimeout: 30_000,  // generous timeout for DB operations
  },
});
```

```typescript
// src/tests/setup.ts — global test setup
import { beforeAll, afterAll } from 'vitest';
import { pool } from '@workspace/db';

afterAll(async () => {
  await pool.end();  // clean up DB connections
});
```

---

*Related: ADR-006 (Zod — schemas tested via Supertest integration tests)*
