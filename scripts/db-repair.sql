-- scripts/db-repair.sql
-- Idempotent — safe to run on every deploy.
--
-- PURPOSE:
--   Ensures the seed company (id = 1) exists before drizzle-kit push
--   validates FK constraints. Without it, any table with
--   company_id DEFAULT 1 will fail the FK check when company 1 is absent.
--
--   Also re-points any orphaned rows (rows whose company_id references a
--   non-existent company) back to company 1, so existing data is never
--   silently lost.

DO $$
BEGIN
  -- Guard: only run if companies table already exists in this schema
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    RAISE NOTICE 'db-repair: companies table does not yet exist — skipping (first-deploy case)';
    RETURN;
  END IF;

  -- ── 1. Ensure the seed company (id = 1) exists ────────────────────────────
  INSERT INTO companies (id, name, plan_type, start_date, end_date, is_active)
  VALUES (
    1,
    'HalalTech',
    'pro',
    CURRENT_DATE,
    (CURRENT_DATE + INTERVAL '10 years')::date,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'db-repair: company id=1 ensured';

  -- ── 2. Re-point orphaned FK rows to company 1 ─────────────────────────────
  -- Add more tables here as the schema grows.

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    UPDATE categories SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: categories orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    UPDATE products SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: products orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    UPDATE customers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: customers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'safes') THEN
    UPDATE safes SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: safes orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouses') THEN
    UPDATE warehouses SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: warehouses orphans fixed';
  END IF;

END $$;
