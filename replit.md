# MUHKAM ERP Workspace

A full-stack Arabic ERP System designed for businesses like mobile repair shops, providing comprehensive management with a localized user experience.

## Run & Operate

The project is a pnpm monorepo.

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT authentication
- `NODE_ENV`: `production`, `development`, `test`
- `SUPER_ADMIN_KEY`: Key for emergency super admin unlock
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: For Telegram notifications

**Commands:**

- **Install Dependencies:** `pnpm install`
- **Run API Server:** `pnpm --filter=api-server dev`
- **Run ERP Frontend:** `pnpm --filter=erp-system dev`
- **Run Mobile App:** `pnpm --filter=mobile dev`
- **Build API Server:** `pnpm --filter=api-server build`
- **Build ERP Frontend:** `pnpm --filter=erp-system build`
- **Typecheck:** `pnpm typecheck`
- **Generate API Client:** `pnpm --filter=api-spec codegen` (after `api-server` is running)
- **Migrate DB:** `pnpm --filter=db migrate`
- **DB Push (for schema changes):** `pnpm --filter=db db:push`
- **Run API Tests:** `pnpm --filter=api-server test`
- **Run Frontend Tests:** `pnpm --filter=erp-system test`

## Stack

- **Runtime:** Node.js 24
- **Package Manager:** pnpm
- **Language:** TypeScript 5.9
- **Backend:** Express 5, PostgreSQL, Drizzle ORM, Zod, esbuild
- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide Icons, Google Fonts
- **Mobile:** Expo 54, Expo Router v6, `@tanstack/react-query`
- **Security:** Helmet.js
- **API Docs:** Swagger UI
- **Testing:** Vitest, Supertest, React Testing Library

## Where things live

- `/apps/api-server`: Backend API application
- `/apps/erp-system`: Frontend ERP application
- `/apps/mobile`: Mobile application
- `/packages/db`: Database schema, migrations, and utilities (source-of-truth: `packages/db/src/schema/*.ts`)
- `/packages/api-spec`: OpenAPI specification and generated client (source-of-truth: `packages/api-spec/openapi.yaml`)
- `/packages/ui`: Reusable UI components and design system
- `/packages/lib`: Shared utilities and helper functions
- `artifacts/api-server/src/lib/integrity.ts`: Data integrity checks and repairs
- `artifacts/api-server/src/lib/auto-account.ts`: Automatic ledger account creation logic
- `apps/erp-system/src/components/InvoicePrint.tsx`: Reusable invoice printing component
- `apps/erp-system/src/index.css`: Global CSS overrides for theme consistency
- `apps/erp-system/src/pages/super-admin/`: Super admin module components

## Architecture decisions

-   **Monorepo Structure:** Uses pnpm workspaces to manage `api-server`, `erp-system`, `mobile`, `db`, and `api-spec` for cohesive development.
-   **RTL & Dark Glass-morphism UI:** Prioritizes Arabic RTL interface with a consistent dark glass-morphism theme and dynamic branding for user customization.
-   **Weighted Average Cost (WAC) for Profit:** Employs WAC for inventory costing, storing `cost_price` at the moment of sale to ensure accurate historical profit reporting.
-   **Atomic Financial Transactions:** All money movements are atomic using `db.transaction()` and recorded in a central `transactions` ledger for auditability.
-   **Multi-tenancy & RBAC:** Supports SaaS multi-tenancy with `company_id` isolation and a robust 3-layer JWT-based RBAC system for granular access control.
-   **Posting Control System:** Implements a document lifecycle (`draft` → `posted` → `cancelled`) for all financial documents, requiring explicit user actions.

## Product

-   **Core Modules:** Sales (POS), Purchases, Inventory, Financial Transactions, Reporting, HR, Repairs, Warranty, Used Devices.
-   **Customization:** Dynamic currency, font, accent color, company branding, and login background configurable via UI.
-   **Financial Controls:** Opening balance system, financial period locking, audit logs, VAT reporting, customer aging reports, journal entry reversal.
-   **Repair Management:** Configurable repair pipeline, parts management, payment tracking, QR code tracking for customers.
-   **Reporting:** Comprehensive financial and operational reports, including profit & loss, sales analysis, inventory, and trial balance.
-   **Alerts:** Smart alerts system for business conditions (e.g., low stock, customer debt).
-   **Employee Self-Service:** Portal for employees to access HR-related information.

## User preferences

I prefer iterative development with a focus on core features first. I value clear, detailed explanations for complex architectural decisions and new functionalities. Please ask before implementing any major changes or refactoring large portions of the codebase. I expect the agent to prioritize fixing critical bugs and stabilizing existing features before developing new ones. I prefer a communication style that is direct and technical, but also open to discussing alternative approaches.

## Gotchas

-   `POST /qa-checklist` requires body fields `items` (array of `{id,label,status}`) and `notes`.
-   `POST /pre-delivery` payment object must be nested: `{ payment: { payment_type, paid_amount, safe_id, payments: [...] } }`. Flat payment fields are silently ignored.
-   `final_cost` must be set via PATCH before transitioning a repair job to `repaired` status.
-   Server stringifies checklist arrays; always pass raw arrays, not pre-stringified.
-   `console.error` calls were replaced by `logger.error` for structured logging in `api-server`.
-   `invoice-no.ts` and `repairs.ts` contain sequential document number generators which are critical for preventing collision and require careful handling.

## Pointers

-   **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
-   **Zod Docs:** [https://zod.dev/](https://zod.dev/)
-   **Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
-   **React Docs:** [https://react.dev/](https://react.dev/)
-   **Express Docs:** [https://expressjs.com/](https://expressjs.com/)
-   **OpenAPI Specification:** [https://swagger.io/specification/](https://swagger.io/specification/)
-   **Orval Docs:** [https://orval.dev/](https://orval.dev/)
-   **PNPM Workspaces:** [https://pnpm.io/workspaces](https://pnpm.io/workspaces)