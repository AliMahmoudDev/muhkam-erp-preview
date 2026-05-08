/**
 * /api/super/companies — Company management routes.
 * Creates, reads, updates, suspends, extends and deletes tenant companies.
 */
import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, companiesTable, erpUsersTable } from "@workspace/db";
import type { CompanyFeatures } from "@workspace/db";
import { authenticate, requireRole } from "../../middleware/auth";
import { invalidateTenantCache } from "../../middleware/tenant-guard";
import { invalidateFeatureCache } from "../../middleware/feature-guard";
import { wrap } from "../../lib/async-handler";
import { hashPin } from "../../lib/hash";
import { createCompanySchema, validate } from "../../lib/schemas";
import { writeAuditLog } from "../../lib/audit-log";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")];

/* Full cascade delete for a company — handles all FK-constrained tables in
   the correct order so Postgres doesn't throw a foreign-key violation. */
async function cascadeDeleteCompany(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const cid = id;

    /* ── Level 3: deepest children (no direct company_id) ── */
    await tx.execute(sql`DELETE FROM refresh_tokens          WHERE user_id          IN (SELECT id FROM erp_users           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_approvals         WHERE leave_request_id IN (SELECT id FROM leave_requests      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM attendance_records      WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM attendance_summary      WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_contacts       WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_documents      WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_status_history WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_history          WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_accrual_history   WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM overtime_records        WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM monthly_incentive_summary WHERE employee_id   IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM daily_incentive_accrual WHERE employee_id     IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM incentive_metrics       WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_leave_balances WHERE employee_id      IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_shift_assignments WHERE employee_id  IN (SELECT id FROM employees           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_incentive_assignments WHERE employee_id IN (SELECT id FROM employees        WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_deductions WHERE salary_advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_history   WHERE salary_advance_id IN (SELECT id FROM salary_advances  WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_ledger    WHERE advance_id        IN (SELECT id FROM salary_advances  WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM payroll_adjustments   WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM payroll_line_items    WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_slabs  WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_metrics WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM daily_incentive_accrual WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_rules  WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_components WHERE salary_structure_id IN (SELECT id FROM salary_structures WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM journal_entry_lines WHERE entry_id  IN (SELECT id FROM journal_entries WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM sale_items          WHERE sale_id   IN (SELECT id FROM sales           WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM sale_return_items   WHERE return_id IN (SELECT id FROM sales_returns   WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM purchase_items      WHERE purchase_id IN (SELECT id FROM purchases     WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM stock_count_items   WHERE session_id IN (SELECT id FROM stock_count_sessions WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM payroll_records    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    /* ── newly added tables (accounting, banking, HR extras) ── */
    await tx.execute(sql`DELETE FROM accrual_runs              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_statement_lines      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM depreciation_runs         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budget_lines              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_deductions       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM warranty_records          WHERE company_id = ${cid}`);

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
    await tx.execute(sql`DELETE FROM employee_custody_lines WHERE custody_id IN (SELECT id FROM employee_custody WHERE company_id = ${cid})`);
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
    /* ── additional tables added after initial cascade was written ── */
    await tx.execute(sql`DELETE FROM accruals                       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_accounts                  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budgets                        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM fixed_assets                   WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM cost_centers                   WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM exchange_rates                 WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM announcements                  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM notifications                  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_tiers     WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_settings  WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM erp_users             WHERE company_id = ${cid}`);

    /* ── Level 1: the company itself ── */
    await tx.execute(sql`DELETE FROM companies WHERE id = ${cid}`);
  });
}

function daysRemaining(endDate: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const end = new Date(endDate); end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── GET /super/companies — list all companies with stats ── */
router.get("/super/companies", ...superOnly, wrap(async (req, res) => {
  void writeAuditLog({
    action: "SUPER_ADMIN_LIST_VIEW", record_type: "company", record_id: 0,
    user: req.user, company_id: null,
    note: "عرض قائمة كل الشركات",
  });
  const companies = await db
    .select()
    .from(companiesTable)
    .orderBy(desc(companiesTable.created_at));

  const userCounts = await db
    .select({
      company_id: erpUsersTable.company_id,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(erpUsersTable)
    .groupBy(erpUsersTable.company_id);

  const countMap = new Map<number, number>();
  for (const row of userCounts) {
    if (row.company_id != null) countMap.set(row.company_id, row.count);
  }

  const result = companies.map((co) => {
    const days = daysRemaining(co.end_date);
    const status =
      !co.is_active ? "suspended" :
      days < 0     ? "expired" :
      co.plan_type === "trial" ? "trial" : "active";

    return {
      ...co,
      daysRemaining: days,
      status,
      userCount: countMap.get(co.id) ?? 0,
    };
  });

  res.json(result);
}));

/* ── GET /super/companies/:id — single company detail ── */
router.get("/super/companies/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  void writeAuditLog({
    action: "SUPER_ADMIN_ACCESS", record_type: "company", record_id: id,
    new_value: { viewed_company_name: co.name },
    user: req.user, company_id: null,
    note: `عرض تفاصيل شركة: ${co.name}`,
  });

  const users = await db
    .select({
      id: erpUsersTable.id,
      name: erpUsersTable.name,
      username: erpUsersTable.username,
      email: erpUsersTable.email,
      role: erpUsersTable.role,
      active: erpUsersTable.active,
    })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id));

  res.json({ ...co, daysRemaining: daysRemaining(co.end_date), users });
}));

/* ── PUT /super/companies/:id — update plan / expiry / active ── */
router.put("/super/companies/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { name, plan_type, edition, end_date, is_active, features } = req.body as {
    name?: string; plan_type?: string; edition?: string; end_date?: string; is_active?: boolean;
    features?: Record<string, boolean>;
  };

  const [before] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!before) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const updates: Partial<typeof companiesTable.$inferInsert> = {};
  if (name      !== undefined) updates.name      = name.trim();
  if (plan_type !== undefined) updates.plan_type = plan_type;
  if (edition   !== undefined && ["advanced","ultimate"].includes(edition)) updates.edition = edition;
  if (end_date  !== undefined) updates.end_date  = end_date;
  if (is_active !== undefined) updates.is_active = is_active;
  if (features  !== undefined) updates.features  = features as CompanyFeatures;

  const [updated] = await db
    .update(companiesTable).set(updates)
    .where(eq(companiesTable.id, id)).returning();

  if (!updated) {
    res.status(404).json({ error: "الشركة حُذفت أثناء التحديث" });
    return;
  }

  invalidateTenantCache(id);
  invalidateFeatureCache(id);

  await writeAuditLog({
    action: "update", record_type: "company", record_id: id,
    old_value: before, new_value: updated,
    user: req.user, company_id: req.user?.company_id ?? null,
    note: "تعديل بيانات الشركة من لوحة المدير العام",
  });

  res.json({ ...updated, daysRemaining: daysRemaining(updated.end_date) });
}));

/* ── POST /super/companies/:id/activate — activate a company ── */
router.post("/super/companies/:id/activate", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(companiesTable)
    .set({ is_active: true })
    .where(eq(companiesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  await writeAuditLog({
    action: "COMPANY_ACTIVATED", record_type: "company", record_id: id,
    new_value: { is_active: true },
    user: req.user, company_id: req.user?.company_id ?? null,
  });

  res.json({ message: "تم تفعيل الشركة", company: updated });
}));

/* ── POST /super/companies/:id/suspend — suspend a company ── */
router.post("/super/companies/:id/suspend", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(companiesTable)
    .set({ is_active: false })
    .where(eq(companiesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  await writeAuditLog({
    action: "COMPANY_SUSPENDED", record_type: "company", record_id: id,
    new_value: { is_active: false },
    user: req.user, company_id: req.user?.company_id ?? null,
  });

  res.json({ message: "تم إيقاف الشركة", company: updated });
}));

/* ── POST /super/companies/:id/extend — extend trial / subscription ── */
router.post("/super/companies/:id/extend", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { days = 7, plan_type } = req.body as { days?: number; plan_type?: string };

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const base = new Date(co.end_date) < new Date() ? new Date() : new Date(co.end_date);
  base.setDate(base.getDate() + Number(days));
  const newEndDate = base.toISOString().slice(0, 10);

  const updates: Partial<typeof companiesTable.$inferInsert> = { end_date: newEndDate, is_active: true };
  if (plan_type) updates.plan_type = plan_type;

  const [updated] = await db
    .update(companiesTable).set(updates)
    .where(eq(companiesTable.id, id)).returning();

  await writeAuditLog({
    action: "COMPANY_EXTENDED", record_type: "subscription", record_id: id,
    old_value: { end_date: co.end_date, plan_type: co.plan_type, is_active: co.is_active },
    new_value: { end_date: newEndDate, plan_type: updates.plan_type ?? co.plan_type, is_active: true, days_added: Number(days) },
    user: req.user, company_id: req.user?.company_id ?? null,
    note: `تمديد الاشتراك ${days} يوم`,
  });

  res.json({ message: `تم تمديد الاشتراك ${days} يوم`, company: { ...updated, daysRemaining: daysRemaining(newEndDate) } });
}));

/* ── POST /super/companies — create company + admin user manually (super only) ── */
router.post("/super/companies", ...superOnly, wrap(async (req, res) => {
  const v = validate(createCompanySchema, req.body);
  if (!v.success) { res.status(400).json({ error: "بيانات غير صحيحة", details: v.errors }); return; }

  const { name, plan_type, edition = "ultimate", duration_days, admin_email, admin_name, admin_username } = v.data;
  const today = new Date();
  const end   = new Date(today);
  end.setDate(end.getDate() + (duration_days ?? 30));

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
  let tempPassword = "";
  for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  const result = await db.transaction(async (tx) => {
    const [co] = await tx.insert(companiesTable).values({
      name:        name.trim(),
      plan_type,
      edition,
      start_date:  today.toISOString().slice(0, 10),
      end_date:    end.toISOString().slice(0, 10),
      is_active:   true,
      admin_email: admin_email ?? null,
    }).returning();

    const resolvedAdminName = admin_name?.trim() || `مدير ${name.trim()}`;

    let resolvedUsername = admin_username?.trim().toLowerCase();
    if (!resolvedUsername) {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[\u0600-\u06ff\s]+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 20) || "admin";
      resolvedUsername = `${slug}_${co.id}`;
    }

    const [taken] = await tx
      .select({ id: erpUsersTable.id })
      .from(erpUsersTable)
      .where(sql`LOWER(${erpUsersTable.username}) = ${resolvedUsername}`);
    if (taken) resolvedUsername = `${resolvedUsername}_${co.id}`;

    const hashedPw = await hashPin(tempPassword);
    const [user] = await tx.insert(erpUsersTable).values({
      name:        resolvedAdminName,
      username:    resolvedUsername,
      pin:         hashedPw,
      role:        "admin",
      active:      true,
      company_id:  co.id,
      permissions: "{}",
      email:       admin_email ?? null,
    }).returning({
      id: erpUsersTable.id,
      username: erpUsersTable.username,
      name: erpUsersTable.name,
    });

    return { company: co, admin: user };
  });

  await writeAuditLog({
    action: "create", record_type: "company", record_id: result.company.id,
    old_value: null, new_value: { name, plan_type, admin: result.admin.username },
    user: req.user, company_id: null,
    note: `إنشاء شركة جديدة مع مستخدم مدير: ${result.admin.username}`,
  });

  res.status(201).json({
    company: result.company,
    admin: {
      username:      result.admin.username,
      name:          result.admin.name,
      temp_password: tempPassword,
    },
    message: "تم إنشاء الشركة والمستخدم بنجاح",
  });
}));

/* ── POST /super/companies/:id/reset-admin-password — generate a temp password ── */
router.post("/super/companies/:id/reset-admin-password", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const admins = await db
    .select({ id: erpUsersTable.id, username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id))
    .orderBy(erpUsersTable.id);

  if (admins.length === 0) {
    res.status(400).json({ error: "لا يوجد مستخدمون لهذه الشركة" });
    return;
  }

  const adminUsers = await db
    .select({ id: erpUsersTable.id, username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id))
    .orderBy(erpUsersTable.id);

  const target = adminUsers[0];

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
  let tempPassword = "";
  for (let i = 0; i < 10; i++) {
    tempPassword += chars[Math.floor(Math.random() * chars.length)];
  }

  const hashed = await hashPin(tempPassword);
  await db
    .update(erpUsersTable)
    .set({ pin: hashed, login_attempts: 0 })
    .where(eq(erpUsersTable.id, target.id));

  await writeAuditLog({
    action: "ADMIN_PASSWORD_RESET", record_type: "erp_user", record_id: target.id,
    old_value: null, new_value: { company_id: id, reset_by: "super_admin" },
    user: req.user, company_id: null,
    note: `إعادة تعيين كلمة مرور مدير شركة: ${co.name}`,
  });

  res.json({
    message: "تم إعادة تعيين كلمة المرور بنجاح",
    username: target.username,
    name: target.name,
    temp_password: tempPassword,
  });
}));

/* ── DELETE /super/companies/:id — delete a company ── */
router.delete("/super/companies/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);

  const [co] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!co) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const usersInCompany = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id));

  const { confirm_code, expected_code, force } = req.body as {
    confirm_code?: string; expected_code?: string; force?: boolean;
  };

  if (usersInCompany.length > 0) {
    const isTrial = co.plan_type === "trial";
    if (!force) {
      res.status(400).json({
        error: "يوجد مستخدمون مرتبطون بهذه الشركة",
        has_users: true,
        user_count: usersInCompany.length,
        is_trial: isTrial,
      });
      return;
    }
    if (!confirm_code || !expected_code || confirm_code.trim() !== expected_code.trim()) {
      res.status(400).json({ error: "كود التأكيد غير صحيح" });
      return;
    }
  }

  await cascadeDeleteCompany(id);

  await writeAuditLog({
    action: "COMPANY_DELETED", record_type: "company", record_id: id,
    old_value: co, new_value: { deleted_user_count: usersInCompany.length, force: !!force },
    user: req.user, company_id: req.user?.company_id ?? null,
    note: "حذف شركة من لوحة المدير العام",
  });

  res.json({ message: "تم حذف الشركة وجميع بياناتها بنجاح" });
}));

/* ── GET /super/companies/:id/snapshot — rich view of company data ── */
router.get("/super/companies/:id/snapshot", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
  if (!company) { res.status(404).json({ error: "الشركة غير موجودة" }); return; }

  const [admins, recentAudit] = await Promise.all([
    db.select({ id: erpUsersTable.id, name: erpUsersTable.name, username: erpUsersTable.username,
                role: erpUsersTable.role, active: erpUsersTable.active, last_login: erpUsersTable.last_login })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.company_id, id))
      .limit(20),
    (async () => {
      const { auditLogsTable: al } = await import("@workspace/db");
      return db.select().from(al)
        .where(eq(al.company_id, id))
        .orderBy(desc(al.created_at))
        .limit(15);
    })(),
  ]);

  const [salesRow, purchasesRow] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0)::numeric AS total FROM sales WHERE company_id=${id}`),
    db.execute(sql`SELECT COUNT(*) AS cnt FROM purchases WHERE company_id=${id}`),
  ]);

  const salesCount     = Number((salesRow.rows[0] as Record<string, unknown>)?.cnt ?? 0);
  const salesRevenue   = Number((salesRow.rows[0] as Record<string, unknown>)?.total ?? 0);
  const purchasesCount = Number((purchasesRow.rows[0] as Record<string, unknown>)?.cnt ?? 0);

  void writeAuditLog({
    action: "SUPER_ADMIN_ACCESS", record_type: "company", record_id: id,
    user: req.user, company_id: null,
    note: `عرض لقطة شركة: ${company.name}`,
  });

  res.json({ company, admins, recentAudit, stats: { salesCount, salesRevenue, purchasesCount } });
}));

/* ── GET /super/stats — overall stats (enhanced) ── */
router.get("/super/stats", ...superOnly, wrap(async (_req, res) => {
  const companies = await db.select().from(companiesTable);
  const users = await db
    .select({ id: erpUsersTable.id, company_id: erpUsersTable.company_id })
    .from(erpUsersTable)
    .where(sql`${erpUsersTable.role} != 'super_admin'`);

  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const ago30 = new Date(now);
  ago30.setDate(ago30.getDate() - 30);

  const expiringSoon = companies.filter(c =>
    c.is_active && c.end_date >= nowStr && c.end_date <= in7Str
  );

  const userCountByCompany: Record<number, number> = {};
  for (const u of users) {
    if (u.company_id) userCountByCompany[u.company_id] = (userCountByCompany[u.company_id] ?? 0) + 1;
  }

  const monthlySignups: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    const count = companies.filter(c => {
      const cd = new Date(c.created_at);
      return cd.getFullYear() === y && cd.getMonth() === m;
    }).length;
    monthlySignups.push({ month: label, count });
  }

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.is_active && c.end_date >= nowStr).length,
    trial: companies.filter(c => c.plan_type === "trial" && c.is_active && c.end_date >= nowStr).length,
    paid: companies.filter(c => c.plan_type === "paid" && c.is_active && c.end_date >= nowStr).length,
    expired: companies.filter(c => c.end_date < nowStr).length,
    suspended: companies.filter(c => !c.is_active).length,
    totalUsers: users.length,
    expiringSoon: expiringSoon.length,
    expiringSoonList: expiringSoon.map(c => ({
      id: c.id, name: c.name,
      end_date: c.end_date, plan_type: c.plan_type,
      days_left: Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000),
    })),
    recentSignups: companies.filter(c => new Date(c.created_at) >= ago30).length,
    monthlySignups,
    userCountByCompany,
  };

  res.json(stats);
}));

/* ── POST /super/companies/:id/verify-email — manually mark email verified ─ */
router.post("/super/companies/:id/verify-email", ...superOnly, wrap(async (req, res) => {
  const cid = parseInt(req.params.id as string);
  if (!cid || isNaN(cid)) {
    res.status(400).json({ error: "معرّف غير صالح" });
    return;
  }

  const [updated] = await db
    .update(companiesTable)
    .set({
      email_verified:                true,
      email_verification_token:      null,
      email_verification_expires_at: null,
    })
    .where(eq(companiesTable.id, cid))
    .returning({ id: companiesTable.id, email_verified: companiesTable.email_verified });

  if (!updated) {
    res.status(404).json({ error: "الشركة غير موجودة" });
    return;
  }

  res.json({ success: true, company: updated });
}));

export default router;
