import { describe, it, expect } from 'vitest';
import { hasPermission } from '@/lib/permissions';
import type { AuthUser } from '@/contexts/auth';

function makeUser(
  role: string,
  permissions: Record<string, boolean> = {},
): AuthUser {
  return {
    id: 1,
    name: 'مستخدم تجريبي',
    username: 'testuser',
    role,
    permissions,
    company_id: 1,
  } as AuthUser;
}

/* ── null / undefined user ─────────────────────────────────────── */

describe('hasPermission — no user', () => {
  it('يرفض null', () => {
    expect(hasPermission(null, 'can_view_sales')).toBe(false);
  });

  it('يرفض undefined', () => {
    expect(hasPermission(undefined, 'can_view_sales')).toBe(false);
  });
});

/* ── صلاحيات المدير (admin) ──────────────────────────────────── */

describe('hasPermission — admin role', () => {
  const admin = makeUser('admin');

  it('يملك can_view_sales', () => {
    expect(hasPermission(admin, 'can_view_sales')).toBe(true);
  });

  it('يملك can_create_sale', () => {
    expect(hasPermission(admin, 'can_create_sale')).toBe(true);
  });

  it('يملك can_manage_settings', () => {
    expect(hasPermission(admin, 'can_manage_settings')).toBe(true);
  });

  it('يملك can_view_audit_log', () => {
    expect(hasPermission(admin, 'can_view_audit_log')).toBe(true);
  });

  it('يملك can_manage_users', () => {
    expect(hasPermission(admin, 'can_manage_users')).toBe(true);
  });

  it('يملك can_approve_payroll', () => {
    expect(hasPermission(admin, 'can_approve_payroll')).toBe(true);
  });
});

/* ── صلاحيات المشرف (manager) ───────────────────────────────── */

describe('hasPermission — manager role', () => {
  const manager = makeUser('manager');

  it('يملك can_view_sales', () => {
    expect(hasPermission(manager, 'can_view_sales')).toBe(true);
  });

  it('لا يملك can_manage_settings', () => {
    expect(hasPermission(manager, 'can_manage_settings')).toBe(false);
  });

  it('لا يملك can_manage_users', () => {
    expect(hasPermission(manager, 'can_manage_users')).toBe(false);
  });

  it('لا يملك can_view_audit_log', () => {
    expect(hasPermission(manager, 'can_view_audit_log')).toBe(false);
  });

  it('يملك can_view_reports', () => {
    expect(hasPermission(manager, 'can_view_reports')).toBe(true);
  });
});

/* ── صلاحيات الكاشير (cashier) ─────────────────────────────── */

describe('hasPermission — cashier role', () => {
  const cashier = makeUser('cashier');

  it('يملك can_create_sale', () => {
    expect(hasPermission(cashier, 'can_create_sale')).toBe(true);
  });

  it('يملك can_cash_sale', () => {
    expect(hasPermission(cashier, 'can_cash_sale')).toBe(true);
  });

  it('لا يملك can_credit_sale', () => {
    expect(hasPermission(cashier, 'can_credit_sale')).toBe(false);
  });

  it('لا يملك can_cancel_sale', () => {
    expect(hasPermission(cashier, 'can_cancel_sale')).toBe(false);
  });

  it('لا يملك can_view_reports', () => {
    expect(hasPermission(cashier, 'can_view_reports')).toBe(false);
  });

  it('يملك can_close_shift', () => {
    expect(hasPermission(cashier, 'can_close_shift')).toBe(true);
  });
});

/* ── صلاحيات مندوب المبيعات (salesperson) ─────────────────── */

describe('hasPermission — salesperson role', () => {
  const salesperson = makeUser('salesperson');

  it('يملك can_create_sale', () => {
    expect(hasPermission(salesperson, 'can_create_sale')).toBe(true);
  });

  it('لا يملك can_return_sale', () => {
    expect(hasPermission(salesperson, 'can_return_sale')).toBe(false);
  });

  it('لا يملك can_edit_price', () => {
    expect(hasPermission(salesperson, 'can_edit_price')).toBe(false);
  });

  it('لا يملك can_view_reports', () => {
    expect(hasPermission(salesperson, 'can_view_reports')).toBe(false);
  });
});

/* ── صلاحيات الموظف (employee) ─────────────────────────────── */

describe('hasPermission — employee role', () => {
  const employee = makeUser('employee');

  it('يملك can_view_attendance', () => {
    expect(hasPermission(employee, 'can_view_attendance')).toBe(true);
  });

  it('لا يملك can_view_sales', () => {
    expect(hasPermission(employee, 'can_view_sales')).toBe(false);
  });

  it('لا يملك can_manage_settings', () => {
    expect(hasPermission(employee, 'can_manage_settings')).toBe(false);
  });
});

/* ── override المستخدم يسبق defaults الدور ──────────────────── */

describe('hasPermission — user-level overrides win', () => {
  it('يمنع cashier يملك override=true من can_credit_sale', () => {
    const cashierWithOverride = makeUser('cashier', { can_credit_sale: true });
    expect(hasPermission(cashierWithOverride, 'can_credit_sale')).toBe(true);
  });

  it('يحجب admin يملك override=false من can_manage_users', () => {
    const restrictedAdmin = makeUser('admin', { can_manage_users: false });
    expect(hasPermission(restrictedAdmin, 'can_manage_users')).toBe(false);
  });

  it('يرفض صلاحية مجهولة لا يملكها أي دور', () => {
    const admin = makeUser('admin');
    expect(hasPermission(admin, 'can_do_magic_unknown_thing')).toBe(false);
  });
});
