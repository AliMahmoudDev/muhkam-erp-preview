-- scripts/db-repair.sql
-- Idempotent — safe to run on every deploy, and on every re-run thereafter.
--
-- PURPOSE:
--   Ensures the seed company (id = 1) exists before drizzle-kit push
--   validates FK constraints. Without it, any table with
--   company_id DEFAULT 1 will fail the FK check when company 1 is absent.
--
--   Also re-points any orphaned rows (rows whose company_id references a
--   non-existent company) back to company 1, so existing data is never
--   silently lost.
--
-- ERROR HANDLING:
--   All work runs inside a nested BEGIN/EXCEPTION block. Any unexpected
--   error (e.g. a constraint violation) is caught, logged via RAISE NOTICE
--   with a clear "db-repair FAILED" prefix, then re-raised with RAISE; so
--   the original SQLSTATE and detail are preserved for machine parsing.
--   The outer Postgres transaction is rolled back automatically — nothing
--   is ever half-applied.
--
-- IDEMPOTENCY:
--   • The company INSERT uses ON CONFLICT (id) DO NOTHING.
--   • Every UPDATE skips rows that already point at a valid company.
--   • Re-running against a fully-repaired DB produces zero changed rows and
--     only NOTICE output — no harm done.
--
-- MANUAL TESTING (idempotency + orphan repair):
--   1. Create a fake orphan:
--        UPDATE products SET company_id = 99999
--          WHERE id = (SELECT id FROM products LIMIT 1);
--   2. Run the script:
--        psql $DATABASE_URL -f scripts/db-repair.sql
--   3. Confirm the orphan is repaired and you see:
--        NOTICE:  db-repair: products orphans fixed
--        NOTICE:  db-repair: completed successfully — ...
--   4. Run the script again — confirm zero errors and identical NOTICE output.
--
-- FAILURE SIMULATION:
--   To verify the exception handler fires, temporarily add inside the inner
--   BEGIN block (before the EXCEPTION keyword):
--        RAISE EXCEPTION 'simulated failure';
--   You should see two lines:
--        NOTICE:  db-repair FAILED — simulated failure (SQLSTATE=P0001)
--        ERROR:   simulated failure
--   The original error text and SQLSTATE are preserved in the final ERROR line.

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

  -- ── 1 & 2. Seed company + re-point orphaned FK rows ─────────────────────
  --
  -- All data work (INSERT + UPDATEs) runs inside a single nested
  -- BEGIN/EXCEPTION block.  Any unhandled error emits a clear
  -- "db-repair FAILED" NOTICE then re-raises the *original* exception
  -- (preserving SQLSTATE) so CI logs are unambiguous and the outer
  -- Postgres transaction is rolled back automatically (nothing is
  -- half-applied).
  BEGIN

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

  -- ── HR — attendance deductions ────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_deduction_settings') THEN
    UPDATE attendance_deduction_settings SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: attendance_deduction_settings orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_deduction_tiers') THEN
    UPDATE attendance_deduction_tiers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: attendance_deduction_tiers orphans fixed';
  END IF;

  -- ── HR — salary advances ──────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salary_advances') THEN
    UPDATE salary_advances SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: salary_advances orphans fixed';
  END IF;

  -- ── HR — employee bonuses & deductions ────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_bonuses') THEN
    UPDATE employee_bonuses SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: employee_bonuses orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_deductions') THEN
    UPDATE employee_deductions SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: employee_deductions orphans fixed';
  END IF;

  -- ── HR — custody ──────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_custody') THEN
    UPDATE employee_custody SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: employee_custody orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_custody_lines') THEN
    UPDATE employee_custody_lines SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: employee_custody_lines orphans fixed';
  END IF;

  -- ── HR — accruals ─────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accrual_runs') THEN
    UPDATE accrual_runs SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: accrual_runs orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accruals') THEN
    UPDATE accruals SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: accruals orphans fixed';
  END IF;

  -- ── Accounting — budgets & cost centers ───────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budgets') THEN
    UPDATE budgets SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: budgets orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_lines') THEN
    UPDATE budget_lines SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: budget_lines orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_centers') THEN
    UPDATE cost_centers SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: cost_centers orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fiscal_years') THEN
    UPDATE fiscal_years SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: fiscal_years orphans fixed';
  END IF;

  -- ── Accounting — bank ─────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
    UPDATE bank_accounts SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: bank_accounts orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_statement_lines') THEN
    UPDATE bank_statement_lines SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: bank_statement_lines orphans fixed';
  END IF;

  -- ── Accounting — bad debts & exchange rates ───────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bad_debts') THEN
    UPDATE bad_debts SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: bad_debts orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_rates') THEN
    UPDATE exchange_rates SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: exchange_rates orphans fixed';
  END IF;

  -- ── Fixed assets & depreciation ───────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fixed_assets') THEN
    UPDATE fixed_assets SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: fixed_assets orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'depreciation_runs') THEN
    UPDATE depreciation_runs SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: depreciation_runs orphans fixed';
  END IF;

  -- ── Sales — targets & price lists ─────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_targets') THEN
    UPDATE sales_targets SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: sales_targets orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'price_lists') THEN
    UPDATE price_lists SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: price_lists orphans fixed';
  END IF;

  -- ── Repair / maintenance ──────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_jobs') THEN
    UPDATE repair_jobs SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_jobs orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_job_parts') THEN
    UPDATE repair_job_parts SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_job_parts orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_payments') THEN
    UPDATE repair_payments SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_payments orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_statuses') THEN
    UPDATE repair_statuses SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_statuses orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_status_history') THEN
    UPDATE repair_status_history SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_status_history orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_accessories') THEN
    UPDATE repair_accessories SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_accessories orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_checklist_items') THEN
    UPDATE repair_checklist_items SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_checklist_items orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_dashboard_cards') THEN
    UPDATE repair_dashboard_cards SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_dashboard_cards orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_device_models') THEN
    UPDATE repair_device_models SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_device_models orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_pipeline_config') THEN
    UPDATE repair_pipeline_config SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: repair_pipeline_config orphans fixed';
  END IF;

  -- ── Warranty ──────────────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'warranty_records') THEN
    UPDATE warranty_records SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: warranty_records orphans fixed';
  END IF;

  -- ── Inventory — scrap ─────────────────────────────────────────────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scrap_items') THEN
    UPDATE scrap_items SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: scrap_items orphans fixed';
  END IF;

  -- ── Misc — notifications, announcements, devices, trial abuse ─────────────

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    UPDATE notifications SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: notifications orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
    UPDATE announcements SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: announcements orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'devices') THEN
    UPDATE devices SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: devices orphans fixed';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trial_abuse_log') THEN
    UPDATE trial_abuse_log SET company_id = 1 WHERE company_id NOT IN (SELECT id FROM companies);
    RAISE NOTICE 'db-repair: trial_abuse_log orphans fixed';
  END IF;

  RAISE NOTICE 'db-repair: completed successfully — all orphaned rows re-pointed to company 1';

  EXCEPTION
    WHEN OTHERS THEN
      -- Emit a clear "db-repair FAILED" notice for CI log grep,
      -- then re-raise the *original* exception unchanged so its SQLSTATE
      -- and detail fields are preserved for automated error parsing.
      -- Postgres automatically rolls back the entire outer transaction;
      -- no partial state is ever committed.
      RAISE NOTICE 'db-repair FAILED — % (SQLSTATE=%)', SQLERRM, SQLSTATE;
      RAISE;
  END; -- inner work block

END $$;
