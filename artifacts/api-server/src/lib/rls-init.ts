/**
 * rls-init.ts
 *
 * Idempotent PostgreSQL Row-Level Security setup.
 *
 * Defense-in-depth layer on top of application-level company_id filtering.
 * Uses session GUCs already set by middleware/auth.ts:
 *   - app.current_company_id  (string, may be empty for super admin)
 *   - app.is_super_admin      ('true' | 'false')
 *
 * Permissive policy semantics:
 *   - GUC unset (background jobs, cron) → ALLOW (preserves legacy behavior)
 *   - is_super_admin = 'true'           → ALLOW
 *   - current_company_id matches row    → ALLOW
 *   - otherwise                         → DENY
 *
 * This catches developer bugs (forgotten company_id WHERE clauses in
 * authenticated routes) without breaking unauthenticated/system code paths.
 */

import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

/* Fallback list used only if dynamic discovery fails. Runtime discovery
   enables RLS on every public base table with a direct company_id column, so
   newly added tenant-scoped tables are not left unprotected by accident. */
const FALLBACK_RLS_TABLES = [
  'products',
  'customers',
  'sales',
  'purchases',
  'sales_returns',
  'purchase_returns',
  'expenses',
  'income',
  'transactions',
  'accounts',
  'journal_entries',
  'receipt_vouchers',
  'deposit_vouchers',
  'payment_vouchers',
  'treasury_vouchers',
  'safe_transfers',
  'safes',
  'warehouses',
  'stock_movements',
  'employees',
  'branches',
  'departments',
  'customer_ledger',
  'categories',
  'suppliers',
  'fixed_assets',
  'depreciation_runs',
  'accruals',
  'accrual_runs',
  'bank_accounts',
  'bank_statement_lines',
  'budgets',
  'budget_lines',
  'cost_centers',
  'devices',
] as const;

const POLICY_NAME = 'muhkam_tenant_isolation';

/* Application role (NOSUPERUSER, NOBYPASSRLS) — auth middleware switches the
   session to this role so RLS policies apply. Background jobs that connect
   without the middleware remain as the connection owner and bypass RLS. */
export const APP_ROLE = 'erp_app_role';

function queryRows<T>(result: unknown): T[] {
  return (result as { rows?: T[] }).rows ?? (result as T[]) ?? [];
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`[rls] unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryRlsStep<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= attempts) break;

      const delayMs = Math.min(500 * attempt, 2_000);
      logger.warn({ err, attempt, attempts, delayMs }, `[rls] ${label} failed — retrying`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Ensure the constrained application role exists with the privileges it needs
 * on every public-schema table. Idempotent.
 */
async function ensureAppRole(): Promise<void> {
  /* Create role if missing — DO blocks can't accept bind params, so use raw SQL.
     APP_ROLE is a hard-coded constant (no injection risk). */
  // nosemgrep: ban-drizzle-sql-raw — PostgreSQL DDL (DO block / GRANT / ALTER) cannot be expressed in Drizzle; APP_ROLE is a hardcoded constant
  await db.execute(
    sql.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE "${APP_ROLE}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END
    $$;
  `)
  );
  // nosemgrep: ban-drizzle-sql-raw
  await db.execute(sql.raw(`GRANT "${APP_ROLE}" TO CURRENT_USER`));
  // nosemgrep: ban-drizzle-sql-raw
  await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`));
  // nosemgrep: ban-drizzle-sql-raw
  await db.execute(
    sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`)
  );
  // nosemgrep: ban-drizzle-sql-raw
  await db.execute(
    sql.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_ROLE}"`)
  );
  // nosemgrep: ban-drizzle-sql-raw
  await db.execute(
    sql.raw(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}"
  `)
  );
  // nosemgrep: ban-drizzle-sql-raw
  await db.execute(
    sql.raw(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO "${APP_ROLE}"
  `)
  );
}

/**
 * The policy expression — evaluated for every row read/written.
 *
 * NULLIF + ::int makes empty string GUC behave as NULL (no tenant context).
 * Both USING (read) and WITH CHECK (write) get the same condition.
 */
const POLICY_EXPR = `(
  current_setting('app.current_company_id', true) IS NULL
  OR current_setting('app.current_company_id', true) = ''
  OR current_setting('app.is_super_admin', true) = 'true'
  OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int
)`;

async function tableExists(name: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists`
  );
  const rows =
    (result as unknown as { rows?: Array<{ exists: boolean }> }).rows ??
    (result as unknown as Array<{ exists: boolean }>);
  return rows?.[0]?.exists === true;
}

async function hasCompanyIdColumn(table: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = 'company_id'
    ) AS exists`
  );
  const rows =
    (result as unknown as { rows?: Array<{ exists: boolean }> }).rows ??
    (result as unknown as Array<{ exists: boolean }>);
  return rows?.[0]?.exists === true;
}

async function discoverCompanyScopedTables(): Promise<string[]> {
  const result = await db.execute<{ table_name: string }>(
    sql`SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.column_name = 'company_id'
          AND c.table_name NOT LIKE 'drizzle_%'
        ORDER BY c.table_name`
  );

  return queryRows<{ table_name: string }>(result)
    .map((row) => row.table_name)
    .filter(
      (name): name is string => typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    );
}

export async function initRLS(): Promise<{ enabled: number; skipped: number }> {
  let enabled = 0;
  let skipped = 0;

  /* Step 1: ensure the constrained role exists & has privileges */
  try {
    await retryRlsStep('ensure application role', ensureAppRole);
    logger.info({ role: APP_ROLE }, '[rls] application role ensured');
  } catch (err) {
    logger.error(
      { err },
      '[rls] failed to ensure application role — RLS will not be enforced at session level'
    );
  }

  let rlsTables: string[] = [...FALLBACK_RLS_TABLES];

  try {
    rlsTables = await retryRlsStep('discover company-scoped tables', discoverCompanyScopedTables);
    logger.info({ total: rlsTables.length }, '[rls] discovered company-scoped tables');
  } catch (err) {
    logger.error(
      { err, total: rlsTables.length },
      '[rls] failed to discover company-scoped tables — using fallback list'
    );
  }

  for (const table of rlsTables) {
    try {
      if (!(await tableExists(table))) {
        logger.debug({ table }, '[rls] table missing — skipping');
        skipped++;
        continue;
      }
      if (!(await hasCompanyIdColumn(table))) {
        logger.warn({ table }, '[rls] table has no company_id column — skipping');
        skipped++;
        continue;
      }

      const quotedTable = quoteIdentifier(table);
      const quotedPolicy = quoteIdentifier(POLICY_NAME);

      /* Enable RLS (idempotent). FORCE makes it apply to table owner too. */
      // nosemgrep: ban-drizzle-sql-raw — ALTER TABLE DDL not expressible in Drizzle; table name is validated by quoteIdentifier()
      await db.execute(sql.raw(`ALTER TABLE ${quotedTable} ENABLE ROW LEVEL SECURITY`));
      // nosemgrep: ban-drizzle-sql-raw
      await db.execute(sql.raw(`ALTER TABLE ${quotedTable} FORCE ROW LEVEL SECURITY`));

      /* Recreate policy idempotently inside a single DO block to avoid race conditions */
      // nosemgrep: ban-drizzle-sql-raw
      await db.execute(
        sql.raw(
          `DO $$
         BEGIN
           DROP POLICY IF EXISTS ${quotedPolicy} ON ${quotedTable};
           CREATE POLICY ${quotedPolicy} ON ${quotedTable}
             USING ${POLICY_EXPR}
             WITH CHECK ${POLICY_EXPR};
         END;
         $$`
        )
      );

      enabled++;
    } catch (err) {
      logger.error({ table, err }, '[rls] failed to enable on table');
      skipped++;
    }
  }

  logger.info({ enabled, skipped, total: rlsTables.length }, '[rls] initialization complete');
  return { enabled, skipped };
}
