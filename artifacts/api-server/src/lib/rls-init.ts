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

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/* Tables with a direct `company_id integer` column that hold tenant business
   data. Excludes: erp_users (login flow), companies (auth), refresh_tokens,
   idempotency_keys, audit_logs, backups, system_settings, alerts (background
   jobs may write without auth context). */
const RLS_TABLES = [
  "products",
  "customers",
  "sales",
  "purchases",
  "sales_returns",
  "purchase_returns",
  "expenses",
  "income",
  "transactions",
  "accounts",
  "journal_entries",
  "receipt_vouchers",
  "deposit_vouchers",
  "payment_vouchers",
  "treasury_vouchers",
  "safe_transfers",
  "safes",
  "warehouses",
  "stock_movements",
  "employees",
  "branches",
  "departments",
  "customer_ledger",
  "categories",
  "suppliers",
  "fixed_assets",
  "depreciation_runs",
  "accruals",
  "accrual_runs",
  "bank_accounts",
  "bank_statement_lines",
  "budgets",
  "budget_lines",
  "cost_centers",
] as const;

const POLICY_NAME = "muhkam_tenant_isolation";

/* Application role (NOSUPERUSER, NOBYPASSRLS) — auth middleware switches the
   session to this role so RLS policies apply. Background jobs that connect
   without the middleware remain as the connection owner and bypass RLS. */
export const APP_ROLE = "erp_app_role";

/**
 * Ensure the constrained application role exists with the privileges it needs
 * on every public-schema table. Idempotent.
 */
async function ensureAppRole(): Promise<void> {
  /* Create role if missing — DO blocks can't accept bind params, so use raw SQL.
     APP_ROLE is a hard-coded constant (no injection risk). */
  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE "${APP_ROLE}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END
    $$;
  `));
  /* Grant the connection role the ability to SET ROLE to erp_app_role */
  await db.execute(sql.raw(`GRANT "${APP_ROLE}" TO CURRENT_USER`));
  /* Grant minimum required privileges on existing tables/sequences */
  await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO "${APP_ROLE}"`));
  await db.execute(sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_ROLE}"`));
  await db.execute(sql.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${APP_ROLE}"`));
  /* Apply default privileges so future tables are also accessible */
  await db.execute(sql.raw(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_ROLE}"
  `));
  await db.execute(sql.raw(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO "${APP_ROLE}"
  `));
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
    ) AS exists`,
  );
  const rows = (result as unknown as { rows?: Array<{ exists: boolean }> }).rows
    ?? (result as unknown as Array<{ exists: boolean }>);
  return rows?.[0]?.exists === true;
}

async function hasCompanyIdColumn(table: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = 'company_id'
    ) AS exists`,
  );
  const rows = (result as unknown as { rows?: Array<{ exists: boolean }> }).rows
    ?? (result as unknown as Array<{ exists: boolean }>);
  return rows?.[0]?.exists === true;
}

export async function initRLS(): Promise<{ enabled: number; skipped: number }> {
  let enabled = 0;
  let skipped = 0;

  /* Step 1: ensure the constrained role exists & has privileges */
  try {
    await ensureAppRole();
    logger.info({ role: APP_ROLE }, "[rls] application role ensured");
  } catch (err) {
    logger.error({ err }, "[rls] failed to ensure application role — RLS will not be enforced at session level");
  }

  for (const table of RLS_TABLES) {
    try {
      if (!(await tableExists(table))) {
        logger.debug({ table }, "[rls] table missing — skipping");
        skipped++;
        continue;
      }
      if (!(await hasCompanyIdColumn(table))) {
        logger.warn({ table }, "[rls] table has no company_id column — skipping");
        skipped++;
        continue;
      }

      /* Enable RLS (idempotent). FORCE makes it apply to table owner too. */
      await db.execute(sql.raw(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
      await db.execute(sql.raw(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`));

      /* Recreate policy idempotently */
      await db.execute(sql.raw(`DROP POLICY IF EXISTS "${POLICY_NAME}" ON "${table}"`));
      await db.execute(sql.raw(
        `CREATE POLICY "${POLICY_NAME}" ON "${table}"
         USING ${POLICY_EXPR}
         WITH CHECK ${POLICY_EXPR}`,
      ));

      enabled++;
    } catch (err) {
      logger.error({ table, err }, "[rls] failed to enable on table");
      skipped++;
    }
  }

  logger.info({ enabled, skipped, total: RLS_TABLES.length }, "[rls] initialization complete");
  return { enabled, skipped };
}
