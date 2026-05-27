# Local Development & Validation Guide

## Prerequisites

- **Node.js** 22+ (recommended: 24)
- **pnpm** 10+
- **PostgreSQL** 16+ (for backend tests)
- **Redis** (optional, for cache features)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run full local CI check (same as GitHub Actions)
pnpm ci:local
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm lint` | Lint backend + frontend |
| `pnpm lint:fix` | Auto-fix lint issues |
| `pnpm typecheck` | TypeScript type checking (all packages) |
| `pnpm test` | Run all unit tests |
| `pnpm build` | Typecheck + build all packages |
| `pnpm check` | Lint + typecheck + test (quick validation) |
| `pnpm fix` | Auto-fix lint + format all files |
| `pnpm ci:local` | Full CI pipeline locally (lint → typecheck → test → build) |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without modifying files |

## Validate Before Push

Before pushing code, run:

```bash
pnpm ci:local
```

This runs the same checks as GitHub Actions CI. The pre-push hook will also run lint, typecheck, and tests automatically.

## Fix CI Failures

### Lint errors

```bash
# See errors
pnpm lint

# Auto-fix what's possible
pnpm fix
```

### Type errors

```bash
# Check types
pnpm typecheck

# For a specific package
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/erp-system typecheck
```

### Test failures

```bash
# Run all tests
pnpm test

# Run backend tests only (requires PostgreSQL)
pnpm --filter @workspace/api-server test

# Run frontend tests only
pnpm --filter @workspace/erp-system test
```

### Build failures

```bash
# Full build (includes typecheck)
pnpm build

# Build specific packages
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/erp-system build
```

## Backend Tests (PostgreSQL Required)

Backend tests need a running PostgreSQL instance:

```bash
# Start PostgreSQL (example with Docker)
docker run -d --name muhkam-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=testdb \
  -p 5432:5432 \
  postgres:16

# Set environment
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testdb
export JWT_SECRET=local-dev-jwt-secret-minimum-32chars!!
export JWT_REFRESH_SECRET=local-dev-refresh-secret-minimum-32chars!!

# Push schema to test DB
pnpm --filter @workspace/db run push-force

# Run backend tests
pnpm --filter @workspace/api-server test
```

## Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Run validation: `pnpm ci:local`
4. Commit with descriptive message (Arabic preferred)
5. Push to branch
6. Create Pull Request targeting `main`
7. CI will run automatically on the PR

## Project Structure

```
artifacts/
  api-server/       — Express 5 backend API
  erp-system/       — Vite React 19 frontend
  erp-mobile/       — Expo React Native app
  mockup-sandbox/   — Design prototyping
lib/
  db/               — Drizzle ORM schema & DB client
  api-client-react/ — Typed React Query hooks
  api-zod/          — Shared Zod validation schemas
  api-spec/         — API specification
scripts/            — Utility & deployment scripts
```
