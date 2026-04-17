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
  -- Every table with a company_id column is covered below.
  -- Tables are grouped by domain for readability.
  -- Tables with a nullable company_id use the extra IS NOT NULL guard so we
  -- never accidentally overwrite NULL sentinels (audit_logs, erp_users).

  -- ── Core / tenant setup ───────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    UPDATE categories SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: categories orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
    UPDATE branches SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: branches orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
    UPDATE system_settings SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: system_settings orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'idempotency_keys') THEN
    UPDATE idempotency_keys SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: idempotency_keys orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alerts') THEN
    UPDATE alerts SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: alerts orphans fixed';
  END IF;

  -- nullable company_id: only touch rows that have a value AND that value is orphaned
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    UPDATE audit_logs SET company_id = 1 WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: audit_logs orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_users') THEN
    UPDATE erp_users SET company_id = 1 WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: erp_users orphans fixed';
  END IF;

  -- ── Inventory ─────────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warehouses') THEN
    UPDATE warehouses SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: warehouses orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    UPDATE products SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: products orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
    UPDATE stock_movements SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: stock_movements orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_transfers') THEN
    UPDATE stock_transfers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: stock_transfers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_count_sessions') THEN
    UPDATE stock_count_sessions SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: stock_count_sessions orphans fixed';
  END IF;

  -- ── Customers & suppliers ─────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_classifications') THEN
    UPDATE customer_classifications SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: customer_classifications orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    UPDATE customers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: customers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_ledger') THEN
    UPDATE customer_ledger SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: customer_ledger orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    UPDATE suppliers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: suppliers orphans fixed';
  END IF;

  -- ── Sales & purchases ─────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    UPDATE sales SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: sales orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchases') THEN
    UPDATE purchases SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: purchases orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_returns') THEN
    UPDATE sales_returns SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: sales_returns orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_returns') THEN
    UPDATE purchase_returns SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: purchase_returns orphans fixed';
  END IF;

  -- ── Finance / cash ────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'safes') THEN
    UPDATE safes SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: safes orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'safe_transfers') THEN
    UPDATE safe_transfers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: safe_transfers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    UPDATE transactions SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: transactions orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    UPDATE expenses SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: expenses orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expense_categories') THEN
    UPDATE expense_categories SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: expense_categories orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income') THEN
    UPDATE income SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: income orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receipt_vouchers') THEN
    UPDATE receipt_vouchers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: receipt_vouchers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deposit_vouchers') THEN
    UPDATE deposit_vouchers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: deposit_vouchers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_vouchers') THEN
    UPDATE payment_vouchers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: payment_vouchers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'treasury_vouchers') THEN
    UPDATE treasury_vouchers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: treasury_vouchers orphans fixed';
  END IF;

  -- ── Accounting ────────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
    UPDATE accounts SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: accounts orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
    UPDATE journal_entries SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: journal_entries orphans fixed';
  END IF;

  -- ── HR — employees ────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
    UPDATE departments SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: departments orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_titles') THEN
    UPDATE job_titles SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: job_titles orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    UPDATE employees SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: employees orphans fixed';
  END IF;

  -- ── HR — attendance ───────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shift_schedules') THEN
    UPDATE shift_schedules SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: shift_schedules orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'public_holidays') THEN
    UPDATE public_holidays SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: public_holidays orphans fixed';
  END IF;

  -- ── HR — payroll ──────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salary_structures') THEN
    UPDATE salary_structures SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: salary_structures orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tax_brackets') THEN
    UPDATE tax_brackets SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: tax_brackets orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'statutory_contributions') THEN
    UPDATE statutory_contributions SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: statutory_contributions orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_periods') THEN
    UPDATE payroll_periods SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: payroll_periods orphans fixed';
  END IF;

  -- ── HR — salary advances ──────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salary_advance_settings') THEN
    UPDATE salary_advance_settings SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: salary_advance_settings orphans fixed';
  END IF;

  -- ── HR — leave management ─────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_types') THEN
    UPDATE leave_types SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: leave_types orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_policies') THEN
    UPDATE leave_policies SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: leave_policies orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_blackout_dates') THEN
    UPDATE leave_blackout_dates SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: leave_blackout_dates orphans fixed';
  END IF;

  -- ── HR — incentives ───────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'incentive_schemes') THEN
    UPDATE incentive_schemes SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: incentive_schemes orphans fixed';
  END IF;

END $$;
