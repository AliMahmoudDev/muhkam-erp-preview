/**
 * /api/super/* — Super-admin panel for managing all SaaS companies.
 * Only accessible to users with role = "super_admin".
 * Super-admin users have no company_id (null) so subscription checks are bypassed.
 */
import { Router } from "express";
import { eq, desc, sql, and, isNull, count } from "drizzle-orm";
import { db, companiesTable, erpUsersTable, planSettingsTable, trialAbuseLogTable } from "@workspace/db";
import type { CompanyFeatures } from "@workspace/db";
import fs from "fs";
import path from "path";

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
import { authenticate, requireRole, superAdminIPGuard } from "../middleware/auth";
import { invalidateTenantCache } from "../middleware/tenant-guard";
import { invalidateFeatureCache } from "../middleware/feature-guard";
import { wrap } from "../lib/async-handler";
import { hashPin } from "../lib/hash";
import { createCompanySchema, validate } from "../lib/schemas";
import { createDatabaseBackup, listBackups } from "../lib/db-backup";
import { writeAuditLog } from "../lib/audit-log";

const router = Router();

/* Apply IP guard to all super-admin routes */
router.use(superAdminIPGuard);

const superOnly = [authenticate, requireRole("super_admin")];

function daysRemaining(endDate: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const end = new Date(endDate); end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── GET /super/audit-log — forensic trail of super-admin actions ──
   Returns audit_logs entries originating from super_admin (no tenant context).
   Supports optional filters: ?action=&record_type=&limit= */
router.get("/super/audit-log", ...superOnly, wrap(async (req, res) => {
  const { auditLogsTable } = await import("@workspace/db");
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100), 1), 500);
  const action = req.query.action ? String(req.query.action) : null;
  const recordType = req.query.record_type ? String(req.query.record_type) : null;

  const conditions: any[] = [sql`${auditLogsTable.company_id} IS NULL`];
  if (action)     conditions.push(eq(auditLogsTable.action, action));
  if (recordType) conditions.push(eq(auditLogsTable.record_type, recordType));

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(sql.join(conditions, sql` AND `))
    .orderBy(desc(auditLogsTable.created_at))
    .limit(limit);

  res.json({ count: rows.length, rows });
}));

/* ── GET /super/companies — list all companies with stats ── */
router.get("/super/companies", ...superOnly, wrap(async (req, res) => {
  /* Forensic: log that super_admin enumerated the tenant directory */
  void writeAuditLog({
    action: "SUPER_ADMIN_LIST_VIEW", record_type: "company", record_id: 0,
    user: req.user, company_id: null,
    note: "عرض قائمة كل الشركات",
  });
  const companies = await db
    .select()
    .from(companiesTable)
    .orderBy(desc(companiesTable.created_at));

  /* Single GROUP BY query instead of N+1 — was running 1 query per company. */
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

  /* Forensic: super_admin opened a tenant's detail page — record the access. */
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

  /* Bust in-process caches so the next request sees the new data immediately */
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

  /* Generate a temp password: 12 chars — letters + digits + symbols */
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!";
  let tempPassword = "";
  for (let i = 0; i < 12; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

  const result = await db.transaction(async (tx) => {
    /* 1. Create the company */
    const [co] = await tx.insert(companiesTable).values({
      name:        name.trim(),
      plan_type,
      edition,
      start_date:  today.toISOString().slice(0, 10),
      end_date:    end.toISOString().slice(0, 10),
      is_active:   true,
      admin_email: admin_email ?? null,
    }).returning();

    /* 2. Create the admin user */
    const resolvedAdminName = admin_name?.trim() || `مدير ${name.trim()}`;

    /* Auto-generate username: sanitize company name → ascii slug + company id */
    let resolvedUsername = admin_username?.trim().toLowerCase();
    if (!resolvedUsername) {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[\u0600-\u06ff\s]+/g, "_") // Arabic chars → _
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 20) || "admin";
      resolvedUsername = `${slug}_${co.id}`;
    }

    /* Ensure username uniqueness */
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

  /* Find the primary admin of this company */
  const admins = await db
    .select({ id: erpUsersTable.id, username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id))
    .orderBy(erpUsersTable.id);

  if (admins.length === 0) {
    res.status(400).json({ error: "لا يوجد مستخدمون لهذه الشركة" });
    return;
  }

  /* Find the admin-role user first, else fall back to first user */
  const adminUsers = await db
    .select({ id: erpUsersTable.id, username: erpUsersTable.username, name: erpUsersTable.name })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.company_id, id))
    .orderBy(erpUsersTable.id);

  const target = adminUsers[0];

  /* Generate a random 10-char temp password */
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
/* Trial companies: users are deleted too (cascade in app layer).
   Paid/active companies with users require confirmation code + force=true.
   Request body: { confirm_code?: string, expected_code?: string, force?: boolean } */
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

  /* Cascade delete: removes all FK-linked records across all 50 tables then the company */
  await cascadeDeleteCompany(id);

  await writeAuditLog({
    action: "COMPANY_DELETED", record_type: "company", record_id: id,
    old_value: co, new_value: { deleted_user_count: usersInCompany.length, force: !!force },
    user: req.user, company_id: req.user?.company_id ?? null,
    note: "حذف شركة من لوحة المدير العام",
  });

  res.json({ message: "تم حذف الشركة وجميع بياناتها بنجاح" });
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

  /* expiring soon: active companies whose end_date is within 7 days */
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  /* recent signups: created in last 30 days */
  const ago30 = new Date(now);
  ago30.setDate(ago30.getDate() - 30);

  const expiringSoon = companies.filter(c =>
    c.is_active && c.end_date >= nowStr && c.end_date <= in7Str
  );

  /* per-company user counts */
  const userCountByCompany: Record<number, number> = {};
  for (const u of users) {
    if (u.company_id) userCountByCompany[u.company_id] = (userCountByCompany[u.company_id] ?? 0) + 1;
  }

  /* monthly signups for last 6 months */
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

/* ══════════════════════════════════════════════
   Super-Admin Manager Endpoints
   /api/super/managers — CRUD for super_admin users
   ══════════════════════════════════════════════ */

/* ── GET /super/managers — list all super_admin accounts ── */
router.get("/super/managers", ...superOnly, wrap(async (_req, res) => {
  const managers = await db
    .select({
      id: erpUsersTable.id,
      name: erpUsersTable.name,
      username: erpUsersTable.username,
      email: erpUsersTable.email,
      active: erpUsersTable.active,
      last_login: erpUsersTable.last_login,
      created_at: erpUsersTable.created_at,
    })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.role, "super_admin"))
    .orderBy(desc(erpUsersTable.created_at));
  res.json(managers);
}));

/* ── POST /super/managers — create new super_admin ── */
router.post("/super/managers", ...superOnly, wrap(async (req, res) => {
  const { name, username, pin } = req.body as { name?: string; username?: string; pin?: string };

  if (!name?.trim())     { res.status(400).json({ error: "الاسم الكامل مطلوب" }); return; }
  if (!username?.trim()) { res.status(400).json({ error: "اسم المستخدم مطلوب" }); return; }
  if (/\s/.test(username)) { res.status(400).json({ error: "اسم المستخدم لا يجب أن يحتوي على مسافات" }); return; }
  if (!pin || pin.length < 4) { res.status(400).json({ error: "الرقم السري يجب أن يكون 4 أحرف على الأقل" }); return; }

  const [existing] = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(sql`LOWER(${erpUsersTable.username}) = ${username.trim().toLowerCase()}`);
  if (existing) { res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" }); return; }

  const hashedPin = await hashPin(pin);
  const [created] = await db.insert(erpUsersTable).values({
    name: name.trim(),
    username: username.trim().toLowerCase(),
    pin: hashedPin,
    role: "super_admin",
    active: true,
    company_id: null,
  }).returning({
    id: erpUsersTable.id, name: erpUsersTable.name,
    username: erpUsersTable.username, active: erpUsersTable.active,
    last_login: erpUsersTable.last_login, created_at: erpUsersTable.created_at,
  });
  res.status(201).json(created);
}));

/* ── PATCH /super/managers/:id — update name/username/pin ── */
router.patch("/super/managers/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const { name, username, pin } = req.body as { name?: string; username?: string; pin?: string };

  const [manager] = await db.select().from(erpUsersTable).where(eq(erpUsersTable.id, id));
  if (!manager || manager.role !== "super_admin") { res.status(404).json({ error: "المدير غير موجود" }); return; }

  if (username?.trim() && /\s/.test(username)) {
    res.status(400).json({ error: "اسم المستخدم لا يجب أن يحتوي على مسافات" }); return;
  }
  if (username?.trim() && username.trim().toLowerCase() !== manager.username.toLowerCase()) {
    const [dup] = await db.select({ id: erpUsersTable.id }).from(erpUsersTable)
      .where(sql`LOWER(${erpUsersTable.username}) = ${username.trim().toLowerCase()}`);
    if (dup) { res.status(400).json({ error: "اسم المستخدم مستخدم بالفعل" }); return; }
  }

  const updates: Partial<typeof erpUsersTable.$inferInsert> = {};
  if (name?.trim())       updates.name     = name.trim();
  if (username?.trim())   updates.username = username.trim().toLowerCase();
  if (pin && pin.length >= 4) updates.pin  = await hashPin(pin);

  const [updated] = await db.update(erpUsersTable).set(updates)
    .where(eq(erpUsersTable.id, id)).returning({
      id: erpUsersTable.id, name: erpUsersTable.name,
      username: erpUsersTable.username, active: erpUsersTable.active,
      last_login: erpUsersTable.last_login, created_at: erpUsersTable.created_at,
    });
  res.json(updated);
}));

/* ── PATCH /super/managers/:id/toggle — toggle active status ── */
router.patch("/super/managers/:id/toggle", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) { res.status(400).json({ error: "لا يمكن إيقاف حسابك الحالي" }); return; }

  const [manager] = await db.select().from(erpUsersTable).where(eq(erpUsersTable.id, id));
  if (!manager || manager.role !== "super_admin") { res.status(404).json({ error: "المدير غير موجود" }); return; }

  const [updated] = await db.update(erpUsersTable)
    .set({ active: !manager.active })
    .where(eq(erpUsersTable.id, id))
    .returning({ id: erpUsersTable.id, active: erpUsersTable.active });
  res.json(updated);
}));

/* ── DELETE /super/managers/:id — remove a super_admin ── */
router.delete("/super/managers/:id", ...superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) { res.status(400).json({ error: "لا يمكن حذف حسابك الحالي" }); return; }

  const allManagers = await db
    .select({ id: erpUsersTable.id })
    .from(erpUsersTable)
    .where(eq(erpUsersTable.role, "super_admin"));
  if (allManagers.length <= 1) {
    res.status(400).json({ error: "يجب أن يكون هناك مدير عام واحد على الأقل" }); return;
  }

  const [manager] = await db.select({ id: erpUsersTable.id })
    .from(erpUsersTable).where(eq(erpUsersTable.id, id));
  if (!manager) { res.status(404).json({ error: "المدير غير موجود" }); return; }

  await db.delete(erpUsersTable).where(eq(erpUsersTable.id, id));
  res.json({ message: "تم حذف المدير بنجاح" });
}));

/* ── POST /super/backup/create — trigger pg_dump backup ── */
router.post("/super/backup/create", ...superOnly, wrap(async (_req, res) => {
  const filepath = await createDatabaseBackup();
  const stats    = fs.statSync(filepath);
  res.json({
    success:    true,
    message:    "تم إنشاء النسخة الاحتياطية بنجاح",
    filename:   filepath.split("/").pop(),
    size_mb:    (stats.size / 1024 / 1024).toFixed(2),
    created_at: new Date().toISOString(),
  });
}));

/* ── GET /super/backup/list — list available backups ── */
router.get("/super/backup/list", ...superOnly, wrap(async (_req, res) => {
  const backups = listBackups();
  res.json({ backups, total: backups.length });
}));

/* ── GET /super/encryption-key — return the backup encryption key (super admin only) ── */
router.get("/super/encryption-key", ...superOnly, wrap(async (_req, res) => {
  const key = process.env.BACKUP_ENCRYPTION_KEY ?? null;
  if (!key) {
    res.json({ key: null, enabled: false });
    return;
  }
  res.json({ key, enabled: true, length: key.length });
}));

/* ── GET /super/backup/download/:filename — stream a backup file ── */
router.get("/super/backup/download/:filename", ...superOnly, wrap(async (req, res) => {
  const BACKUP_DIR = process.env.BACKUP_DIR ?? "/home/runner/workspace/db-backups";
  const raw = req.params.filename as string;

  /* Sanitize: strip any directory traversal */
  const filename = path.basename(raw);
  if (!filename || filename !== raw) {
    res.status(400).json({ error: "اسم ملف غير صالح" });
    return;
  }

  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "الملف غير موجود" });
    return;
  }

  const isEnc = filename.endsWith(".enc");
  res.setHeader(
    "Content-Type",
    isEnc ? "application/octet-stream" : "application/json"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", fs.statSync(filepath).size);
  fs.createReadStream(filepath).pipe(res);
}));

/* ══════════════════════════════════════════════════════════════════
   PLAN SETTINGS — GET & PUT (prices editable from super-admin UI)
   ══════════════════════════════════════════════════════════════════ */

/* Default seed plans — inserted once if the table is empty */
const DEFAULT_PLANS = [
  { key: "trial",        name_ar: "تجريبية",           description: "فترة تجريبية مجانية",                   price: 0,    includes_mobile: false },
  { key: "basic",        name_ar: "أساسية",             description: "النظام الأساسي بدون تطبيق الموبايل",   price: 299,  includes_mobile: false },
  { key: "basic_mobile", name_ar: "أساسية + موبايل",   description: "النظام الأساسي مع تطبيق الموبايل",     price: 449,  includes_mobile: true  },
  { key: "advanced",     name_ar: "كاملة (Advanced)",   description: "النسخة الكاملة بجميع الميزات",         price: 699,  includes_mobile: true  },
];

async function getPlanPricesMap(): Promise<Record<string, number>> {
  const rows = await db.select().from(planSettingsTable);
  if (rows.length === 0) {
    /* seed defaults */
    await db.insert(planSettingsTable).values(DEFAULT_PLANS).onConflictDoNothing();
    return Object.fromEntries(DEFAULT_PLANS.map(p => [p.key, p.price]));
  }
  return Object.fromEntries(rows.map(r => [r.key, r.price]));
}

router.get("/super/plan-settings", ...superOnly, wrap(async (_req, res) => {
  let rows = await db.select().from(planSettingsTable).orderBy(planSettingsTable.id);
  if (rows.length === 0) {
    await db.insert(planSettingsTable).values(DEFAULT_PLANS).onConflictDoNothing();
    rows = await db.select().from(planSettingsTable).orderBy(planSettingsTable.id);
  }
  res.json(rows);
}));

router.put("/super/plan-settings/:key", ...superOnly, wrap(async (req, res) => {
  const key = String(req.params['key']);
  const { name_ar, description, price, includes_mobile, is_active } = req.body as {
    name_ar?: string; description?: string; price?: number;
    includes_mobile?: boolean; is_active?: boolean;
  };

  if (price !== undefined && (typeof price !== "number" || price < 0)) {
    res.status(400).json({ error: "السعر يجب أن يكون رقماً موجباً" }); return;
  }

  const updates: Partial<typeof planSettingsTable.$inferInsert> = { updated_at: new Date() };
  if (name_ar        !== undefined) updates.name_ar        = name_ar;
  if (description    !== undefined) updates.description    = description;
  if (price          !== undefined) updates.price          = price;
  if (includes_mobile !== undefined) updates.includes_mobile = includes_mobile;
  if (is_active      !== undefined) updates.is_active      = is_active;

  const existing = await db.select().from(planSettingsTable).where(eq(planSettingsTable.key, key));
  let row;
  if (existing.length === 0) {
    [row] = await db.insert(planSettingsTable)
      .values({ key, name_ar: name_ar ?? key, price: price ?? 0, ...updates })
      .returning();
  } else {
    [row] = await db.update(planSettingsTable).set(updates)
      .where(eq(planSettingsTable.key, key)).returning();
  }

  res.json(row);
}));

/* ══════════════════════════════════════════════════════════════════
   FEATURE 1 — Revenue Dashboard
   GET /super/revenue — MRR, plan breakdown, monthly revenue trends
   ══════════════════════════════════════════════════════════════════ */

router.get("/super/revenue", ...superOnly, wrap(async (_req, res) => {
  const [companies, planPrices] = await Promise.all([
    db.select().from(companiesTable),
    getPlanPricesMap(),
  ]);
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  const activeCompanies = companies.filter(c => c.is_active && c.end_date >= nowStr);

  /* MRR = sum of prices for all currently active companies */
  const mrr = activeCompanies.reduce((sum, c) => sum + (planPrices[c.plan_type] ?? 0), 0);
  const arr  = mrr * 12;

  /* Plan breakdown */
  const planBreakdown = Object.entries(planPrices).map(([plan, price]) => ({
    plan,
    price,
    count:   activeCompanies.filter(c => c.plan_type === plan).length,
    revenue: activeCompanies.filter(c => c.plan_type === plan).length * price,
  }));

  /* Monthly revenue for last 12 months */
  const monthlyRevenue: { month: string; revenue: number; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    const activeInMonth = companies.filter(c => {
      const start = new Date(c.start_date);
      const end   = new Date(c.end_date);
      const monthStart = new Date(y, m, 1);
      const monthEnd   = new Date(y, m + 1, 0);
      return c.is_active && start <= monthEnd && end >= monthStart;
    });
    const revenue = activeInMonth.reduce((sum, c) => sum + (planPrices[c.plan_type] ?? 0), 0);
    monthlyRevenue.push({ month: label, revenue, count: activeInMonth.length });
  }

  /* Conversion rate: trial → paid */
  const totalTrialEver = companies.filter(c => c.plan_type === "trial").length;
  const totalPaidEver  = companies.filter(c => c.plan_type !== "trial").length;
  const conversionRate = companies.length > 0
    ? Math.round((totalPaidEver / companies.length) * 100)
    : 0;

  /* ARPU */
  const arpu = activeCompanies.length > 0
    ? Math.round(mrr / activeCompanies.length)
    : 0;

  res.json({
    mrr, arr, arpu, conversionRate,
    activeCompanies: activeCompanies.length,
    trialCompanies:  activeCompanies.filter(c => c.plan_type === "trial").length,
    paidCompanies:   activeCompanies.filter(c => c.plan_type !== "trial").length,
    planBreakdown,
    monthlyRevenue,
    totalPaidEver, totalTrialEver,
  });
}));

/* ══════════════════════════════════════════════════════════════════
   FEATURE 2 — Smart Alerts Center
   GET /super/alerts — expiring, inactive, system issues
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/alerts", ...superOnly, wrap(async (_req, res) => {
  const companies = await db.select().from(companiesTable);
  const now    = new Date();
  const nowStr = now.toISOString().slice(0, 10);

  const alerts: {
    type: "warning" | "danger" | "info" | "success";
    category: string;
    title: string;
    body: string;
    company_id?: number;
    company_name?: string;
    days?: number;
  }[] = [];

  /* ── Expiring within 3 days (danger) ── */
  const in3 = new Date(now); in3.setDate(in3.getDate() + 3);
  const in3Str = in3.toISOString().slice(0, 10);
  companies
    .filter(c => c.is_active && c.end_date >= nowStr && c.end_date <= in3Str)
    .forEach(c => {
      const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
      alerts.push({
        type: "danger", category: "expiry",
        title: `⚠️ ينتهي الاشتراك خلال ${days} ${days === 1 ? "يوم" : "أيام"}`,
        body: `شركة "${c.name}" — خطة ${c.plan_type} — تنتهي في ${c.end_date}`,
        company_id: c.id, company_name: c.name, days,
      });
    });

  /* ── Expiring within 7 days (warning) ── */
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  companies
    .filter(c => c.is_active && c.end_date > in3Str && c.end_date <= in7Str)
    .forEach(c => {
      const days = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000);
      alerts.push({
        type: "warning", category: "expiry",
        title: `🔔 ينتهي الاشتراك قريباً (${days} أيام)`,
        body: `شركة "${c.name}" — خطة ${c.plan_type} — تنتهي في ${c.end_date}`,
        company_id: c.id, company_name: c.name, days,
      });
    });

  /* ── Expired (ended but still marked active) ── */
  companies
    .filter(c => c.is_active && c.end_date < nowStr)
    .forEach(c => {
      alerts.push({
        type: "danger", category: "expired",
        title: "⛔ اشتراك منتهي (الحساب لا يزال نشطاً!)",
        body: `شركة "${c.name}" — انتهى في ${c.end_date} — يجب تعليقه أو تجديده`,
        company_id: c.id, company_name: c.name,
      });
    });

  /* ── New signups this week ── */
  const ago7 = new Date(now); ago7.setDate(ago7.getDate() - 7);
  const newThisWeek = companies.filter(c => new Date(c.created_at) >= ago7);
  if (newThisWeek.length > 0) {
    alerts.push({
      type: "success", category: "signup",
      title: `🎉 ${newThisWeek.length} شركة جديدة هذا الأسبوع`,
      body: newThisWeek.map(c => c.name).join("، "),
    });
  }

  /* ── High number of trials (conversion concern) ── */
  const trialCount = companies.filter(c => c.plan_type === "trial" && c.is_active && c.end_date >= nowStr).length;
  const paidCount  = companies.filter(c => c.plan_type !== "trial" && c.is_active && c.end_date >= nowStr).length;
  if (trialCount > paidCount && trialCount > 2) {
    alerts.push({
      type: "warning", category: "conversion",
      title: "📊 معدل تحويل منخفض",
      body: `${trialCount} شركة تجريبية مقابل ${paidCount} مدفوعة — حاول التواصل معهم لتحويلهم`,
    });
  }

  /* ── System health check ── */
  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  if (mem > 400) {
    alerts.push({
      type: "warning", category: "system",
      title: "💾 استهلاك ذاكرة مرتفع",
      body: `الخادم يستخدم ${mem} MB من الذاكرة — راقب الوضع`,
    });
  }

  const critical   = alerts.filter(a => a.type === "danger").length;
  const warnings   = alerts.filter(a => a.type === "warning").length;
  const info_count = alerts.filter(a => a.type === "info").length;
  const successes  = alerts.filter(a => a.type === "success").length;

  res.json({ alerts, summary: { critical, warnings, info: info_count, successes, total: alerts.length } });
}));

/* ══════════════════════════════════════════════════════════════════
   FEATURE 4 — Export Companies as CSV
   GET /super/export/companies — download companies list as CSV
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/export/companies", ...superOnly, wrap(async (_req, res) => {
  const [companies, planPricesEx] = await Promise.all([
    db.select().from(companiesTable),
    getPlanPricesMap(),
  ]);
  const users = await db
    .select({ id: erpUsersTable.id, company_id: erpUsersTable.company_id })
    .from(erpUsersTable)
    .where(sql`${erpUsersTable.role} != 'super_admin'`);

  const now = new Date();
  const nowStr = now.toISOString().slice(0, 10);
  const userCountByCompany: Record<number, number> = {};
  for (const u of users) {
    if (u.company_id) userCountByCompany[u.company_id] = (userCountByCompany[u.company_id] ?? 0) + 1;
  }

  const header = "الرقم,اسم الشركة,نوع الخطة,تاريخ البداية,تاريخ الانتهاء,الحالة,عدد المستخدمين,الإيراد الشهري (ج.م.),تاريخ التسجيل";
  const rows = companies.map(c => {
    const status = !c.is_active ? "موقوف" : c.end_date < nowStr ? "منتهي" : c.plan_type === "trial" ? "تجريبي" : "نشط";
    const revenue = planPricesEx[c.plan_type] ?? 0;
    const userCount = userCountByCompany[c.id] ?? 0;
    return [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.plan_type,
      c.start_date,
      c.end_date,
      status,
      userCount,
      revenue,
      new Date(c.created_at).toLocaleDateString("ar-EG"),
    ].join(",");
  });

  const csv = "\uFEFF" + header + "\n" + rows.join("\n"); // BOM for Excel Arabic support
  const filename = `muhkam-companies-${nowStr}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}));

/* ══════════════════════════════════════════════════════════════════
   FEATURE 5 — Announcements / Notifications
   CRUD: GET / POST / PATCH /:id / DELETE /:id
   Also: GET /super/announcements/for-company/:id (for tenant display)
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/announcements", ...superOnly, wrap(async (_req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const rows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.created_at));
  res.json({ announcements: rows, total: rows.length });
}));

router.post("/super/announcements", ...superOnly, wrap(async (req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const { title, body, type = "info", target = "all", company_id, expires_at } = req.body as {
    title: string; body: string; type?: string; target?: string;
    company_id?: number; expires_at?: string;
  };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "العنوان والنص مطلوبان" });
    return;
  }
  const [row] = await db.insert(announcementsTable).values({
    title: title.trim(),
    body: body.trim(),
    type,
    target: target ?? (company_id ? String(company_id) : "all"),
    company_id: company_id ?? null,
    is_active: true,
    created_by: (req.user as any)?.username ?? "super_admin",
    expires_at: expires_at ? new Date(expires_at) : null,
  }).returning();
  void writeAuditLog({
    action: "create", record_type: "announcement", record_id: row.id,
    user: req.user, company_id: null, note: `إشعار جديد: ${title}`,
  });
  res.status(201).json(row);
}));

router.patch("/super/announcements/:id", ...superOnly, wrap(async (req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const id = Number(req.params.id);
  const updates: Partial<{ title: string; body: string; type: string; is_active: boolean; expires_at: Date | null }> = {};
  if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
  if (req.body.body  !== undefined) updates.body  = String(req.body.body).trim();
  if (req.body.type  !== undefined) updates.type  = String(req.body.type);
  if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
  if (req.body.expires_at !== undefined) updates.expires_at = req.body.expires_at ? new Date(req.body.expires_at) : null;
  const [row] = await db.update(announcementsTable).set(updates).where(eq(announcementsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "الإشعار غير موجود" }); return; }
  res.json(row);
}));

router.delete("/super/announcements/:id", ...superOnly, wrap(async (req, res) => {
  const { announcementsTable } = await import("@workspace/db");
  const id = Number(req.params.id);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  void writeAuditLog({
    action: "delete", record_type: "announcement", record_id: id,
    user: req.user, company_id: null, note: `حذف إشعار رقم ${id}`,
  });
  res.json({ ok: true });
}));

/* ══════════════════════════════════════════════════════════════════
   FEATURE 6 — Server Health & Metrics
   GET /super/health — deep health + request metrics + DB pool stats
   ══════════════════════════════════════════════════════════════════ */
router.get("/super/health", ...superOnly, wrap(async (_req, res) => {
  const { checkDeepHealth } = await import("../lib/monitor");
  const { getMetrics }      = await import("../lib/request-counter");
  const { pool }            = await import("@workspace/db");

  const [health, metrics] = await Promise.all([
    checkDeepHealth(),
    Promise.resolve(getMetrics()),
  ]);

  const poolStats = {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
  };

  const mem = process.memoryUsage();

  res.json({
    health,
    metrics,
    pool: poolStats,
    memory: {
      heap_used_mb:  Math.round(mem.heapUsed  / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb:        Math.round(mem.rss       / 1024 / 1024),
      external_mb:   Math.round(mem.external  / 1024 / 1024),
    },
    process: {
      uptime_hours: Math.round(process.uptime() / 3600 * 10) / 10,
      node_version: process.version,
      pid:          process.pid,
      env:          process.env.NODE_ENV ?? "development",
    },
    timestamp: new Date().toISOString(),
  });
}));

/* ═══════════════════════════════════════════════════════════════════════════
 * TRIAL ABUSE ANALYTICS
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * GET /super/trial-abuse-stats
 *
 * Returns a snapshot of the trial system for the super admin dashboard:
 *   • top_ips          — IPs with the most trial registrations (abuse pattern)
 *   • suspicious       — companies where is_suspicious = true
 *   • unverified       — trial companies where email is not yet verified
 *   • expiring_soon    — active trials expiring within 2 days
 *   • total_trials     — lifetime trial company count
 *   • conversion_rate  — percentage of trials that converted to paid
 */
router.get("/super/trial-abuse-stats", ...superOnly, wrap(async (_req, res) => {
  const nowStr = new Date().toISOString().slice(0, 10);

  /* All companies ever on trial */
  const allTrials = await db
    .select({
      id:                  companiesTable.id,
      name:                companiesTable.name,
      admin_email:         companiesTable.admin_email,
      signup_ip:           companiesTable.signup_ip,
      plan_type:           companiesTable.plan_type,
      is_active:           companiesTable.is_active,
      is_suspicious:       companiesTable.is_suspicious,
      trial_score:         companiesTable.trial_score,
      email_verified:      companiesTable.email_verified,
      verification_status: companiesTable.verification_status,
      end_date:            companiesTable.end_date,
      created_at:          companiesTable.created_at,
    })
    .from(companiesTable)
    .where(eq(companiesTable.has_used_trial, true))
    .orderBy(desc(companiesTable.created_at));

  /* Top IPs by registration count (non-overridden rows only) */
  const ipMap = new Map<string, number>();
  for (const c of allTrials) {
    if (c.signup_ip) ipMap.set(c.signup_ip, (ipMap.get(c.signup_ip) ?? 0) + 1);
  }
  const topIPs = Array.from(ipMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  /* Suspicious companies (score < 50) */
  const suspicious = allTrials
    .filter(c => c.is_suspicious)
    .map(c => ({
      id: c.id, name: c.name, email: c.admin_email,
      trial_score: c.trial_score, signup_ip: c.signup_ip,
      created_at: c.created_at,
    }));

  /* Unverified trial companies still within or past their window */
  const unverified = allTrials
    .filter(c => !c.email_verified && c.verification_status !== "verified")
    .map(c => ({
      id: c.id, name: c.name, email: c.admin_email,
      verification_status: c.verification_status, created_at: c.created_at,
    }));

  /* Active trials expiring within 2 days */
  const soon = new Date();
  soon.setDate(soon.getDate() + 2);
  const soonStr = soon.toISOString().slice(0, 10);
  const expiringSoon = allTrials.filter(
    c => c.plan_type === "trial" && c.is_active && c.end_date >= nowStr && c.end_date <= soonStr
  ).map(c => ({ id: c.id, name: c.name, email: c.admin_email, end_date: c.end_date }));

  /* Conversion stats */
  const totalTrials  = allTrials.length;
  const converted    = allTrials.filter(c => c.plan_type !== "trial").length;
  const conversionRate = totalTrials > 0 ? Math.round((converted / totalTrials) * 100) : 0;

  res.json({
    top_ips:         topIPs,
    suspicious,
    unverified,
    expiring_soon:   expiringSoon,
    total_trials:    totalTrials,
    converted,
    conversion_rate: `${conversionRate}%`,
    generated_at:    new Date().toISOString(),
  });
}));

/* ═══════════════════════════════════════════════════════════════════════════
 * TRIAL ABUSE OVERRIDE ROUTES
 * Allow the super admin to unblock legitimate users without deleting history.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ── GET /super/trial-abuse — list all trial abuse log entries ──────────── */
router.get("/super/trial-abuse", ...superOnly, wrap(async (req, res) => {
  const page  = Math.max(1, Number(req.query.page  ?? 1));
  const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(trialAbuseLogTable)
    .orderBy(desc(trialAbuseLogTable.created_at))
    .limit(limit)
    .offset(offset);

  // Also pull per-IP counts so the admin can see patterns
  const ipCounts = await db
    .select({
      ip:    trialAbuseLogTable.ip,
      total: count(),
    })
    .from(trialAbuseLogTable)
    .where(isNull(trialAbuseLogTable.override_reason))
    .groupBy(trialAbuseLogTable.ip)
    .orderBy(desc(count()));

  res.json({ rows, ip_counts: ipCounts, page, limit });
}));

/* ── POST /super/trial-abuse/:id/override — grant override for a log row ── */
router.post("/super/trial-abuse/:id/override", ...superOnly, wrap(async (req, res) => {
  const id     = parseInt(req.params.id);
  const { reason } = req.body as { reason?: string };

  if (!id || isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صالح" });
    return;
  }
  if (!reason?.trim()) {
    res.status(400).json({ error: "سبب التجاوز مطلوب" });
    return;
  }

  const [updated] = await db
    .update(trialAbuseLogTable)
    .set({
      override_reason: reason.trim(),
      overridden_by:   req.user?.username ?? "super_admin",
    })
    .where(eq(trialAbuseLogTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "السجل غير موجود" });
    return;
  }

  res.json({ success: true, row: updated });
}));

/* ── DELETE /super/trial-abuse/:id/override — revoke an override ────────── */
router.delete("/super/trial-abuse/:id/override", ...superOnly, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "معرّف غير صالح" });
    return;
  }

  const [updated] = await db
    .update(trialAbuseLogTable)
    .set({ override_reason: null, overridden_by: null })
    .where(eq(trialAbuseLogTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "السجل غير موجود" });
    return;
  }

  res.json({ success: true, row: updated });
}));

/* ── POST /super/companies/:id/verify-email — manually mark email verified ─ */
router.post("/super/companies/:id/verify-email", ...superOnly, wrap(async (req, res) => {
  const cid = parseInt(req.params.id);
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
