/*
 * Integration test setup — runs before any test file in this directory.
 *
 * RULES:
 *   - No mocks of any kind. @workspace/db is real. The DB is real.
 *   - JWT env vars must be set BEFORE app.ts / auth.ts are ever imported,
 *     because auth.ts reads them at module-load time and throws if missing.
 *   - DATABASE_URL comes from the real environment (Replit PostgreSQL).
 */

process.env.JWT_SECRET          = 'integration-test-jwt-secret-minimum-32chars!!';
process.env.JWT_REFRESH_SECRET  = 'integration-test-refresh-secret-min-32chars!!';
process.env.NODE_ENV            = 'test';
