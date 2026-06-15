/**
 * Shared helper functions for super/companies routes.
 */
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';

/* Full cascade delete for a company — handles all FK-constrained tables in
   the correct order so Postgres doesn't throw a foreign-key violation.
   All statements run inside a single transaction for atomicity. */
export async function cascadeDeleteCompany(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const cid = id;

    /* ── Level 3: deepest children (no direct company_id) ── */
    await tx.execute(
      sql`DELETE FROM refresh_tokens          WHERE user_id          IN (SELECT id FROM erp_users           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM leave_approvals         WHERE leave_request_id IN (SELECT id FROM leave_requests      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`
    );
    await tx.execute(
      sql`DELETE FROM attendance_records      WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM attendance_summary      WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM employee_contacts       WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM employee_documents      WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM employee_status_history WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM salary_history          WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM leave_accrual_history   WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM overtime_records        WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM monthly_incentive_summary WHERE employee_id   IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM daily_incentive_accrual WHERE employee_id     IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM incentive_metrics       WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM employee_leave_balances WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM employee_shift_assignments WHERE employee_id  IN (SELECT id FROM employees           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM employee_incentive_assignments WHERE employee_id IN (SELECT id FROM employees        WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM salary_advance_deductions WHERE salary_advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM salary_advance_history   WHERE salary_advance_id IN (SELECT id FROM salary_advances  WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM salary_advance_ledger    WHERE advance_id        IN (SELECT id FROM salary_advances  WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM payroll_adjustments   WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`
    );
    await tx.execute(
      sql`DELETE FROM payroll_line_items    WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`
    );
    await tx.execute(
      sql`DELETE FROM incentive_slabs  WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`
    );
    await tx.execute(
      sql`DELETE FROM incentive_metrics WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`
    );
    await tx.execute(
      sql`DELETE FROM daily_incentive_accrual WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`
    );
    await tx.execute(
      sql`DELETE FROM incentive_rules  WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM salary_components WHERE salary_structure_id IN (SELECT id FROM salary_structures WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM journal_entry_lines WHERE entry_id  IN (SELECT id FROM journal_entries WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM sale_items          WHERE sale_id   IN (SELECT id FROM sales           WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM sale_return_items   WHERE return_id IN (SELECT id FROM sales_returns   WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM purchase_items      WHERE purchase_id IN (SELECT id FROM purchases     WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM stock_count_items   WHERE session_id IN (SELECT id FROM stock_count_sessions WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`
    );
    await tx.execute(
      sql`DELETE FROM payroll_records    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`
    );

    /* ── Accounting, banking, HR extras ── */
    await tx.execute(sql`DELETE FROM accrual_runs              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_statement_lines      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM depreciation_runs         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budget_lines              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_deductions       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM warranty_records          WHERE company_id = ${cid}`);

    /* ── Repair module (children first, then parents) ── */
    await tx.execute(sql`DELETE FROM repair_payments           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_job_parts          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_status_history     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_jobs               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_statuses           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_checklist_items    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_pipeline_config    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_dashboard_cards    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_device_models      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM repair_accessories        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM scrap_items               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bad_debts                 WHERE company_id = ${cid}`);

    /* ── Devices & suppliers ── */
    await tx.execute(sql`DELETE FROM devices                   WHERE company_id = ${cid}`);

    /* ── Price lists (items reference products — must delete before products) ── */
    await tx.execute(
      sql`DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM price_lists WHERE company_id = ${cid})`
    );
    await tx.execute(sql`DELETE FROM price_lists               WHERE company_id = ${cid}`);

    /* ── Sales targets ── */
    await tx.execute(sql`DELETE FROM sales_targets             WHERE company_id = ${cid}`);

    /* ── Level 2: tables with direct company_id ── */
    await tx.execute(sql`DELETE FROM journal_entries       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM sales_returns         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM purchase_returns      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM sales                 WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM purchases             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM receipt_vouchers      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM deposit_vouchers      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM payment_vouchers      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM treasury_vouchers     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM safe_transfers        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM stock_movements       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM stock_count_sessions  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM stock_transfers       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM expenses              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM income                WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM transactions          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM customer_ledger       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM salary_advances       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_bonuses      WHERE company_id = ${cid}`);
    await tx.execute(
      sql`DELETE FROM employee_custody_lines WHERE custody_id IN (SELECT id FROM employee_custody WHERE company_id = ${cid})`
    );
    await tx.execute(sql`DELETE FROM employee_custody      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM salary_structures     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM payroll_periods       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM statutory_contributions WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM tax_brackets          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM incentive_schemes     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM salary_advance_settings WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM leave_policies        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM leave_blackout_dates  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM leave_types           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM public_holidays       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM shift_schedules       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employees             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM job_titles            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM departments           WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM branches              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM products              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM customers             WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM categories            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM customer_classifications WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM expense_categories    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM accounts              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM safes                 WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM warehouses            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM fiscal_years          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM alerts                WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM system_settings       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM idempotency_keys      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM audit_logs            WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM accruals              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_accounts         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budgets               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM fixed_assets          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM cost_centers          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM exchange_rates        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM announcements         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM notifications         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_tiers     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_settings  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM erp_users             WHERE company_id = ${cid}`);

    /* ── Level 1: the company itself ── */
    await tx.execute(sql`DELETE FROM companies WHERE id = ${cid}`);
  });
}

export function daysRemaining(endDate: string | null | undefined): number {
  if (!endDate) return -9999; // treat missing date as far-expired (schema drift guard)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return -9999; // invalid date string guard
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
