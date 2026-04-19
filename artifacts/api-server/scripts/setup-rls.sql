-- ══════════════════════════════════════════════════════════════
-- MUHKAM ERP — Row Level Security (Defense-in-Depth Layer)
-- Runs once; idempotent (DROP IF EXISTS before CREATE).
-- ══════════════════════════════════════════════════════════════

-- Helper: create GUC params if they don't exist
DO $$
BEGIN
  PERFORM set_config('app.current_company_id', '', false);
  PERFORM set_config('app.is_super_admin', 'false', false);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Policy template (reused for all company-scoped tables) ──
-- Allows row if:
--   1. is_super_admin flag is set to 'true'  (super admin bypasses all)
--   2. OR company_id matches the session company_id
-- DENIES if neither is set (unauthenticated access)
-- ════════════════════════════════════════════════════════════

DO $bulk$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'products','categories','customer_classifications','customers',
    'sales','purchases','expense_categories','expenses','income','transactions',
    'erp_users','safe_transfers','safes','warehouses','accounts',
    'journal_entries','purchase_returns','sales_returns',
    'treasury_vouchers','deposit_vouchers','payment_vouchers','receipt_vouchers',
    'stock_movements','stock_count_sessions','stock_transfers',
    'audit_logs','system_settings','alerts','customer_ledger',
    'branches','departments',
    'employees','job_titles','payroll_periods','salary_structures',
    'statutory_contributions','tax_brackets','public_holidays',
    'shift_schedules','leave_blackout_dates','leave_policies','leave_types',
    'incentive_schemes','salary_advance_settings','employee_bonuses',
    'employee_custody','idempotency_keys','salary_advances','fiscal_years'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- Force even table owner to obey RLS
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- Drop old policy if exists
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON %I', t);
    -- Create new policy
    EXECUTE format($policy$
      CREATE POLICY company_isolation ON %I
        FOR ALL
        USING (
          current_setting('app.is_super_admin', TRUE) = 'true'
          OR (
            NULLIF(current_setting('app.current_company_id', TRUE), '') IS NOT NULL
            AND company_id = NULLIF(current_setting('app.current_company_id', TRUE), '')::INTEGER
          )
        )
        WITH CHECK (
          current_setting('app.is_super_admin', TRUE) = 'true'
          OR (
            NULLIF(current_setting('app.current_company_id', TRUE), '') IS NOT NULL
            AND company_id = NULLIF(current_setting('app.current_company_id', TRUE), '')::INTEGER
          )
        )
    $policy$, t);
    RAISE NOTICE 'RLS enabled on table: %', t;
  END LOOP;
END $bulk$;

-- ── Special: companies table — super_admin only ──
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_isolation ON companies;
CREATE POLICY company_isolation ON companies
  FOR ALL
  USING (
    current_setting('app.is_super_admin', TRUE) = 'true'
    OR id = NULLIF(current_setting('app.current_company_id', TRUE), '')::INTEGER
  );

SELECT 'RLS setup complete' AS status;
