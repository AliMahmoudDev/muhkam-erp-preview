# ADR-004: pnpm Monorepo Structure
# قرار معماري 004: هيكل Monorepo باستخدام pnpm

| Field | Value |
|-------|-------|
| **Status / الحالة** | Accepted — مقبول |
| **Date / التاريخ** | 2025-01-20 |
| **Deciders / المقررون** | Full team |
| **Review date / تاريخ المراجعة** | 2026-01-20 |

---

## Context — السياق

### English

MUHKAM ERP spans multiple deployable units sharing significant business logic and type definitions:

- **`artifacts/api-server`** — Express 5 backend (Node.js)
- **`artifacts/erp-system`** — React 19 web frontend
- **`artifacts/erp-mobile`** — Expo React Native mobile app
- **`lib/db`** — Drizzle ORM schema + PostgreSQL connection pool
- **`lib/api-spec`** — OpenAPI 3.1 specification (single source of truth for the API contract)
- **`lib/api-zod`** — Zod v4 schemas auto-generated from the API spec (used by both frontend and backend)
- **`lib/api-client-react`** — React Query hooks auto-generated from the API spec (used by web + mobile)

The critical design question: **how should these packages be organised and how should shared code be shared?**

### العربية

مُحكم ERP يمتد عبر عدة وحدات قابلة للنشر تتشارك منطقًا تجاريًا وتعريفات أنواع TypeScript:

- **`artifacts/api-server`** — الخادم الخلفي Express 5 (Node.js)
- **`artifacts/erp-system`** — الواجهة الأمامية React 19
- **`artifacts/erp-mobile`** — تطبيق الجوال Expo React Native
- **`lib/db`** — مخطط Drizzle ORM + مجمع اتصالات PostgreSQL
- **`lib/api-spec`** — مواصفة OpenAPI 3.1 (مصدر الحقيقة الوحيد لعقد API)
- **`lib/api-zod`** — مخططات Zod v4 مولَّدة تلقائياً من المواصفة (مستخدمة من الخادم والواجهة)
- **`lib/api-client-react`** — React Query hooks مولَّدة تلقائياً (مستخدمة في الويب والجوال)

السؤال التصميمي الحيوي: **كيف ينبغي تنظيم هذه الحزم ومشاركة الكود المشترك؟**

---

## Decision — القرار

### English

Use a **pnpm workspace monorepo** with a single `pnpm-workspace.yaml` at the repository root.

**Why pnpm over npm/yarn workspaces:**

1. **Disk efficiency**: pnpm uses a global content-addressable store with hard links — packages are not duplicated per project. In a monorepo with 3 frontend packages all using React 19, only one copy of React exists on disk.
2. **Strict hoisting**: pnpm's default `node_modules` structure is non-flat — packages can only import what they explicitly declare as dependencies. This catches missing dependency declarations at install time, not at runtime.
3. **Speed**: pnpm install is significantly faster than npm install for large monorepos due to the store-based architecture and parallel downloads.
4. **Workspace protocol**: `workspace:*` in `package.json` dependencies creates true in-repo references that are resolved from the local filesystem, not from the registry.
5. **Catalog**: pnpm's catalog feature (in `pnpm-workspace.yaml`) pins shared transitive dependencies (React, Zod, drizzle-orm, TypeScript) to a single version across all workspace packages, eliminating version drift.

**Package boundaries enforced:**

- `lib/db` owns the database connection and all table schemas. No other package imports directly from the database driver.
- `lib/api-spec` is the contract layer — changes to the API surface start here.
- Code generation (`pnpm --filter @workspace/api-client-react run generate`) produces type-safe clients automatically — no hand-written fetch calls in the frontend.
- `artifacts/api-server` has no dependency on `artifacts/erp-system` or `artifacts/erp-mobile` (server/client separation is enforced at the package level).

### العربية

استخدام **Monorepo مساحة عمل pnpm** مع ملف `pnpm-workspace.yaml` واحد في جذر المستودع.

**لماذا pnpm بدلاً من npm/yarn:**

1. **كفاءة القرص**: pnpm يستخدم مخزنًا عالميًا قابلًا للعنونة بالمحتوى مع روابط صلبة — الحزم لا تتكرر لكل مشروع.
2. **رفع صارم**: هيكل `node_modules` في pnpm غير مسطَّح — الحزم يمكنها فقط استيراد ما تعلنه صراحةً كاعتمادية.
3. **السرعة**: تثبيت pnpm أسرع بشكل ملحوظ من npm للمستودعات الكبيرة.
4. **بروتوكول workspace**: `workspace:*` في `package.json` يُنشئ مراجع حقيقية داخل المستودع تُحلَّل من نظام الملفات المحلي.
5. **الكتالوج**: ميزة كتالوج pnpm في `pnpm-workspace.yaml` تثبِّت الاعتماديات المشتركة (React، Zod، drizzle-orm، TypeScript) على إصدار واحد عبر جميع الحزم.

---

## Consequences — التبعات

### English

**Positive:**
- Single `pnpm install` sets up the entire development environment — no per-package install steps.
- Shared types (`lib/api-zod`) are compiled once and referenced by all consumers — type safety spans the full stack.
- `pnpm --filter <pkg> run <script>` enables targeted CI steps (test only the API server, build only the web app).
- The catalog prevents dependency version drift across packages — all packages agree on the same React, Zod, and TypeScript versions.
- One `tsconfig` base in the repo root, extended by each package — consistent compiler options.
- Atomic commits across packages — a single commit can update the DB schema, the API route, the Zod schema, and the frontend hook together.

**Negative / Trade-offs:**
- `pnpm` is mandatory — contributors cannot use npm or yarn (enforced by the `preinstall` script in root `package.json`).
- Peer dependency resolution is stricter — adding a new package can create duplicate module instances if its transitive peers conflict (as happened with `prom-client` → `@opentelemetry/api` → duplicate `drizzle-orm`; resolved via `pnpm-workspace.yaml` overrides and `packageExtensions`).
- Large root `node_modules` — the pnpm store grows as packages are added. Managed with periodic `pnpm store prune`.
- Developers unfamiliar with monorepos need onboarding on the `--filter` flag and workspace protocol.

### العربية

**إيجابيات:**
- `pnpm install` واحد يُعِد بيئة التطوير بالكامل.
- الأنواع المشتركة تُترجَم مرة واحدة ويشير إليها جميع المستهلكين — أمان الأنواع يمتد عبر المكدس الكامل.
- `pnpm --filter` يُتيح خطوات CI مستهدفة.
- الكتالوج يمنع تباين الإصدارات بين الحزم.
- تعديلات ذرية عبر الحزم — commit واحد يمكنه تحديث مخطط قاعدة البيانات، مسار API، مخطط Zod، وhook الواجهة معًا.

**سلبيات / مقايضات:**
- pnpm إلزامي — المساهمون لا يمكنهم استخدام npm أو yarn.
- حل التبعيات الندية أصعب — إضافة حزمة جديدة يمكن أن تُنشئ نسخًا مكررة من الوحدات إذا تعارضت التبعيات الندية (كما حدث مع `prom-client` → `@opentelemetry/api` → نسختان من `drizzle-orm`؛ تم الحل عبر overrides وpackageExtensions في `pnpm-workspace.yaml`).
- المطورون غير المألوفين مع monorepos يحتاجون إرشادًا حول علامة `--filter` وبروتوكول workspace.

---

## Alternatives Considered — البدائل التي تم دراستها

| Approach | Reason Rejected |
|----------|----------------|
| Separate repositories (polyrepo) | Cross-repo type sharing requires package publishing; version drift between API and client types; slower feedback on breaking changes |
| npm workspaces | Flat hoisting causes phantom dependency issues; no content-addressable store → slower installs and more disk usage |
| Yarn Berry (PnP) | Plug'n'Play is incompatible with several Expo and native tools; complex configuration for the mobile package |
| Turborepo | Good build caching, but adds tooling complexity; pnpm's built-in `--filter` covers the project's current needs without an extra layer |
| Nx | Heavy configuration and concept overhead for a team focused on delivery; revisit if the monorepo grows beyond 10 packages |
