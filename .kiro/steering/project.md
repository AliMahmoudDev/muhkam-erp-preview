# MUHKAM ERP — Project Steering Rules

## Project Identity

- Production multi-tenant ERP SaaS system (حلالتك / MUHKAM)
- Arabic-first UI with RTL layout
- Backend: Express 5 + Drizzle ORM + PostgreSQL
- Frontend: React 19 + Vite + TailwindCSS + Radix UI
- Package manager: pnpm (monorepo with workspace protocol)
- Deployed on Hetzner VPS via PM2

## Critical Safety Rules

### No Unsafe Refactors
- Never rename or restructure files across the codebase without explicit request
- Never change public API contracts (route paths, request/response shapes) without explicit request
- Never remove existing exports from shared libraries (lib/*)

### No Database Schema Changes
- Never modify `lib/db/src/schema/` files unless explicitly requested
- Never run `drizzle-kit push` or generate migrations without explicit request
- Database changes require careful migration planning for production tenants

### Preserve Tenant Isolation
- Every database query MUST be scoped by `tenantId`
- Never bypass Row-Level Security (RLS) patterns
- Never expose data across tenant boundaries
- Test tenant isolation when modifying data-access code

### Preserve Permissions & RBAC
- Never bypass permission checks in route handlers
- Never remove or weaken role-based access control
- Respect the existing permission middleware chain

### Preserve Audit Logging
- Never remove or disable audit log entries
- Financial operations MUST create audit trails
- Login/logout events MUST be logged

### Preserve Financial Calculations
- Never modify rounding, tax, or currency logic without explicit request
- Ledger balance operations must remain atomic
- Invoice numbering sequences must not be interrupted
- Double-entry accounting integrity must be maintained

### Preserve Arabic UI Behavior
- RTL layout must be maintained across all pages
- Arabic translations must not be removed
- Date formatting must respect Hijri/Gregorian preferences
- Number formatting must support Arabic-Indic numerals where configured

## Development Workflow

### Before Claiming Success
- Always run `pnpm typecheck` to verify no TypeScript errors
- Always run `pnpm lint` to verify no linting errors
- Always run `pnpm test` to verify tests pass
- If modifying build-related code, run `pnpm build` to verify builds succeed

### Commit Conventions
- Use descriptive Arabic commit messages
- Push to working branch immediately after committing
- Never push directly to `main` without PR

### CI Pipeline
- CI runs: lint → typecheck → test → build
- All checks must pass before merge
- Deploy workflow triggers only on main branch push

## Monorepo Structure

```
artifacts/
  api-server/     — Express backend API
  erp-system/     — Vite React frontend (production ERP)
  erp-mobile/     — Expo React Native mobile app
  mockup-sandbox/ — Design prototyping
lib/
  db/             — Drizzle ORM schema & migrations
  api-client-react/ — Typed React Query hooks
  api-zod/        — Shared Zod validation schemas
  api-spec/       — API specification
scripts/          — Utility & deployment scripts
```

## Environment Requirements

- Node.js 22+ (CI uses Node 22)
- pnpm 10+
- PostgreSQL 16+ (required for backend tests)
- Redis (optional, for caching in production)
