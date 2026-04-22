import type { AuthUser } from "../middleware/auth";

const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  super_admin: {
    can_view_sales:              true, can_create_sale:             true,
    can_cash_sale:               true, can_partial_sale:            true,
    can_credit_sale:             true, can_cancel_sale:             true,
    can_return_sale:             true, can_edit_price:              true,
    can_view_purchases:          true, can_create_purchase:         true,
    can_cancel_purchase:         true, can_view_products:           true,
    can_manage_products:         true, can_view_customers:          true,
    can_manage_customers:        true, can_view_inventory:          true,
    can_adjust_inventory:        true, can_view_treasury:           true,
    can_view_expenses:           true, can_add_expense:             true,
    can_add_receipt_voucher:     true, can_add_payment_voucher:     true,
    can_close_shift:             true, can_view_reports:            true,
    can_manage_users:            true,
    can_view_employees:          true, can_manage_employees:        true,
    can_view_employee_salary:    true,
    can_view_payroll:            true, can_manage_payroll:          true,
    can_approve_payroll:         true,
    can_view_attendance:         true, can_manage_attendance:       true,
    can_view_leaves:             true, can_manage_leaves:           true,
  },
  admin: {
    can_view_sales:              true,  can_create_sale:            true,
    can_cash_sale:               true,  can_partial_sale:           true,
    can_credit_sale:             true,  can_cancel_sale:            true,
    can_return_sale:             true,  can_edit_price:             true,
    can_view_purchases:          true,  can_create_purchase:        true,
    can_cancel_purchase:         true,  can_view_products:          true,
    can_manage_products:         true,  can_view_customers:         true,
    can_manage_customers:        true,  can_view_inventory:         true,
    can_adjust_inventory:        true,  can_view_treasury:          true,
    can_view_expenses:           true,  can_add_expense:            true,
    can_add_receipt_voucher:     true,  can_add_payment_voucher:    true,
    can_close_shift:             true,  can_view_reports:           true,
    can_manage_users:            true,
    can_view_employees:          true,  can_manage_employees:       true,
    can_view_employee_salary:    true,
    can_view_payroll:            true,  can_manage_payroll:         true,
    can_approve_payroll:         true,
    can_view_attendance:         true,  can_manage_attendance:      true,
    can_view_leaves:             true,  can_manage_leaves:          true,
  },
  manager: {
    can_view_sales:              true,  can_create_sale:            true,
    can_cash_sale:               true,  can_partial_sale:           true,
    can_credit_sale:             true,  can_cancel_sale:            true,
    can_return_sale:             true,  can_edit_price:             true,
    can_view_purchases:          true,  can_create_purchase:        true,
    can_cancel_purchase:         true,  can_view_products:          true,
    can_manage_products:         true,  can_view_customers:         true,
    can_manage_customers:        true,  can_view_inventory:         true,
    can_adjust_inventory:        true,  can_view_treasury:          true,
    can_view_expenses:           true,  can_add_expense:            true,
    can_add_receipt_voucher:     true,  can_add_payment_voucher:    true,
    can_close_shift:             true,  can_view_reports:           true,
    can_manage_users:            false,
    can_view_employees:          true,  can_manage_employees:       true,
    can_view_employee_salary:    true,
    can_view_payroll:            true,  can_manage_payroll:         true,
    can_approve_payroll:         false,
    can_view_attendance:         true,  can_manage_attendance:      true,
    can_view_leaves:             true,  can_manage_leaves:          true,
  },
  salesperson: {
    can_view_sales:              true,  can_create_sale:            true,
    can_cash_sale:               true,  can_partial_sale:           true,
    can_credit_sale:             true,  can_cancel_sale:            false,
    can_return_sale:             false, can_edit_price:             false,
    can_view_purchases:          false, can_create_purchase:        false,
    can_cancel_purchase:         false, can_view_products:          true,
    can_manage_products:         false, can_view_customers:         true,
    can_manage_customers:        false, can_view_inventory:         false,
    can_adjust_inventory:        false, can_view_treasury:          true,
    can_view_expenses:           false, can_add_expense:            false,
    can_add_receipt_voucher:     false, can_add_payment_voucher:    false,
    can_close_shift:             false, can_view_reports:           false,
    can_manage_users:            false,
    can_view_employees:          false, can_manage_employees:       false,
    can_view_employee_salary:    false,
    can_view_payroll:            false, can_manage_payroll:         false,
    can_approve_payroll:         false,
    can_view_attendance:         false, can_manage_attendance:      false,
    can_view_leaves:             false, can_manage_leaves:          false,
  },
  employee: {
    // Self-service portal: only views own profile/payroll. No write access.
    can_view_sales:              false, can_create_sale:             false,
    can_cash_sale:               false, can_partial_sale:            false,
    can_credit_sale:             false, can_cancel_sale:             false,
    can_return_sale:             false, can_edit_price:              false,
    can_view_purchases:          false, can_create_purchase:         false,
    can_cancel_purchase:         false, can_view_products:           false,
    can_manage_products:         false, can_view_customers:          false,
    can_manage_customers:        false, can_view_inventory:          false,
    can_adjust_inventory:        false, can_view_treasury:           false,
    can_view_expenses:           false, can_add_expense:             false,
    can_add_receipt_voucher:     false, can_add_payment_voucher:     false,
    can_close_shift:             false, can_view_reports:            false,
    can_manage_users:            false,
    // Self-service: views own employee record only (filtered server-side)
    can_view_employees:          true,  can_manage_employees:        false,
    can_view_employee_salary:    true,
    can_view_payroll:            false, can_manage_payroll:          false,
    can_approve_payroll:         false,
    can_view_attendance:         true,  can_manage_attendance:       false,
    can_view_leaves:             true,  can_manage_leaves:           false,
  },
  cashier: {
    can_view_sales:              true,  can_create_sale:            true,
    can_cash_sale:               true,  can_partial_sale:           false,
    can_credit_sale:             false, can_cancel_sale:            false,
    can_return_sale:             false, can_edit_price:             false,
    can_view_purchases:          false, can_create_purchase:        false,
    can_cancel_purchase:         false, can_view_products:          true,
    can_manage_products:         false, can_view_customers:         true,
    can_manage_customers:        false, can_view_inventory:         false,
    can_adjust_inventory:        false, can_view_treasury:          true,
    can_view_expenses:           true,  can_add_expense:            true,
    can_add_receipt_voucher:     false, can_add_payment_voucher:    false,
    can_close_shift:             true,  can_view_reports:           false,
    can_manage_users:            false,
    can_view_employees:          false, can_manage_employees:       false,
    can_view_employee_salary:    false,
    can_view_payroll:            false, can_manage_payroll:         false,
    can_approve_payroll:         false,
    can_view_attendance:         false, can_manage_attendance:      false,
    can_view_leaves:             false, can_manage_leaves:          false,
  },
};

export function hasPermission(
  user: AuthUser | undefined,
  permission: string,
): boolean {
  if (!user) return false;

  let perms: Record<string, boolean> = {};
  try {
    const parsed = JSON.parse(user.permissions ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      perms = parsed as Record<string, boolean>;
    }
  } catch { /* ignore */ }

  // Explicit user-level override always wins
  // eslint-disable-next-line security/detect-object-injection
  if (perms[permission] === true)  return true;
  // eslint-disable-next-line security/detect-object-injection
  if (perms[permission] === false) return false;

  // Fall back to role defaults
  // eslint-disable-next-line security/detect-object-injection
  const roleDefaults = ROLE_DEFAULTS[user.role] ?? {};
  // eslint-disable-next-line security/detect-object-injection
  if (roleDefaults[permission] === true)  return true;
  // eslint-disable-next-line security/detect-object-injection
  if (roleDefaults[permission] === false) return false;

  // Final fallback: DENY by default. Unknown permissions must be added
  // explicitly to ROLE_DEFAULTS — never grant access implicitly.
  return false;
}
