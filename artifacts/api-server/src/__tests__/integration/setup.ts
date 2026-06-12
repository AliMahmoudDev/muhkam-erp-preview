import { beforeAll } from 'vitest';

/*
 * Integration test setup — runs before any test file in this directory.
 *
 * RULES:
 *   - No mocks of any kind. @workspace/db is real. The DB is real.
 *   - JWT env vars must be set BEFORE app.ts / auth.ts are ever imported,
 *     because auth.ts reads them at module-load time and throws if missing.
 *   - DATABASE_URL comes from the real environment (Replit PostgreSQL or CI
 *     service container).
 *   - JWT_SECRET / JWT_REFRESH_SECRET: read from process.env if already set
 *     (e.g. injected by CI secrets or a local .env.test).  Only fall back to
 *     well-named test values when NODE_ENV === 'test' (vitest sets this before
 *     setupFiles run).  Any other environment causes an explicit error so the
 *     fallback can never silently mask a missing production secret.
 */

// Capture NODE_ENV before we touch it — vitest sets 'test' before this runs.
const isTestEnv = process.env.NODE_ENV === 'test';

if (!process.env.JWT_SECRET) {
  if (!isTestEnv) {
    throw new Error(
      '[integration setup] JWT_SECRET is not set and NODE_ENV !== "test". ' +
        'Refusing to fall back to the test default outside of a test environment.'
    );
  }
  process.env.JWT_SECRET = 'integration-test-jwt-secret-minimum-32chars!!';
}

if (!process.env.JWT_REFRESH_SECRET) {
  if (!isTestEnv) {
    throw new Error(
      '[integration setup] JWT_REFRESH_SECRET is not set and NODE_ENV !== "test". ' +
        'Refusing to fall back to the test default outside of a test environment.'
    );
  }
  process.env.JWT_REFRESH_SECRET = 'integration-test-jwt-refresh-secret-min-32chars!!';
}

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  const { pool } = await import('@workspace/db');

  await pool.query(`
    ALTER TABLE erp_users
    ADD COLUMN IF NOT EXISTS phone TEXT
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS erp_users_phone_idx
    ON erp_users (phone)
  `);

  await pool.query(`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS note TEXT
  `);
});
