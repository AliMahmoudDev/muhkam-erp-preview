import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { authenticate, requireRole, getTenant } from "../../middleware/auth";
import { z } from "zod/v4";
import { firstZodError } from "../../lib/schemas";
import { wrap } from "../../lib/async-handler";
import {
  customersTable,
  salesTable,
  saleItemsTable,
  purchasesTable,
  purchaseItemsTable,
  salesReturnsTable,
  receiptVouchersTable,
  depositVouchersTable,
  paymentVouchersTable,
  systemSettingsTable,
} from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import { setCache, getCache, deleteCache } from "../../lib/cache";
import { requireUser } from "../../lib/tenant";

const systemSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional().nullable(),
  company_id: z.union([z.string(), z.number()]).optional().nullable(),
});

const resetSchema = z.object({
  confirm: z.string(),
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function upsertSetting(key: string, value: string | null, companyId: number) {
  if (!companyId || companyId <= 0) throw Object.assign(new Error("upsertSetting: companyId required"), { status: 403 });
  if (value === null) {
    await db.delete(systemSettingsTable)
      .where(and(eq(systemSettingsTable.key, key), eq(systemSettingsTable.company_id, companyId)));
  } else {
    await db.insert(systemSettingsTable)
      .values({ key, company_id: companyId, value })
      .onConflictDoUpdate({
        target: [systemSettingsTable.key, systemSettingsTable.company_id],
        set:    { value, updated_at: new Date() },
      });
  }
}

const router = Router();

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

router.get("/settings/audit-logs", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const companyId = getTenant(req);
  const limit  = Math.min(parseInt(String(req.query.limit ?? "200")), 500);
  const rows   = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.company_id, companyId))
    .orderBy(desc(auditLogsTable.created_at))
    .limit(limit);
  const record_type = req.query.record_type as string | undefined;
  const filtered = record_type ? rows.filter(r => r.record_type === record_type) : rows;
  res.json(filtered.map(r => ({ ...r, created_at: r.created_at.toISOString() })));
}));

// ─── RESET DATABASE (Full Factory Reset) ──────────────────────────────────────
// يحذف كل بيانات الشركة بالكامل (من A إلى Z) مع الحفاظ على:
// 1. سجل الشركة نفسه (companies row)
// 2. المستخدم الحالي (admin الذي ينفّذ العملية)
// يستخدم نفس منهجية cascadeDeleteCompany لكن بدون حذف الشركة نفسها.

router.post("/settings/reset", authenticate, requireRole("admin"), wrap(async (req, res) => {
  const parsedReset = resetSchema.safeParse(req.body);
  if (!parsedReset.success) { res.status(400).json({ error: firstZodError(parsedReset.error) }); return; }
  const { confirm } = parsedReset.data;
  if (confirm !== "إعادة تعيين كاملة") {
    res.status(400).json({ error: "يجب كتابة عبارة التأكيد بشكل صحيح" }); return;
  }

  const companyId     = getTenant(req);
  const currentUserId = requireUser(req).id;

  await db.transaction(async (tx) => {
    const cid = companyId;

    // ملاحظة: ترتيب الحذف مهم لتجنب FK violations
    // نحذف من الأعمق للأبسط

    /* ── Level 3: deepest children (via subquery on employee/user) ── */
    await tx.execute(sql`DELETE FROM refresh_tokens          WHERE user_id IN (SELECT id FROM erp_users WHERE company_id = ${cid} AND id != ${currentUserId})`);
    await tx.execute(sql`DELETE FROM leave_approvals         WHERE leave_request_id IN (SELECT id FROM leave_requests WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM attendance_records      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM attendance_summary      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_contacts       WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_documents      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_status_history WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_history          WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_accrual_history   WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM overtime_records        WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM monthly_incentive_summary WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM daily_incentive_accrual WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM incentive_metrics       WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_leave_balances WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_shift_assignments WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM employee_incentive_assignments WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_deductions WHERE salary_advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_history   WHERE salary_advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_advance_ledger    WHERE advance_id IN (SELECT id FROM salary_advances WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM payroll_adjustments   WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM payroll_line_items    WHERE payroll_record_id IN (SELECT id FROM payroll_records WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_slabs  WHERE incentive_rule_id IN (SELECT id FROM incentive_rules WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid}))`);
    await tx.execute(sql`DELETE FROM incentive_rules  WHERE incentive_scheme_id IN (SELECT id FROM incentive_schemes WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM salary_components WHERE salary_structure_id IN (SELECT id FROM salary_structures WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM sale_items          WHERE sale_id IN (SELECT id FROM sales WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM sale_return_items   WHERE return_id IN (SELECT id FROM sales_returns WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM purchase_items      WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM purchase_return_items WHERE return_id IN (SELECT id FROM purchase_returns WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM stock_count_items   WHERE session_id IN (SELECT id FROM stock_count_sessions WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM leave_requests      WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM payroll_records     WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${cid})`);

    /* ── Accounting, banking, HR extras ── */
    await tx.execute(sql`DELETE FROM accrual_runs              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_statement_lines      WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM depreciation_runs         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budget_lines              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM employee_deductions       WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM warranty_records          WHERE company_id = ${cid}`);

    /* ── Repair module ── */
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

    /* ── Devices, price lists ── */
    await tx.execute(sql`DELETE FROM devices                   WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM price_list_items WHERE price_list_id IN (SELECT id FROM price_lists WHERE company_id = ${cid})`);
    await tx.execute(sql`DELETE FROM price_lists               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM sales_targets             WHERE company_id = ${cid}`);

    /* ── Level 2: all direct company_id tables ── */
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
    await tx.execute(sql`DELETE FROM suppliers             WHERE company_id = ${cid}`);
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
    await tx.execute(sql`DELETE FROM accruals              WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM bank_accounts         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM budgets               WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM fixed_assets          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM cost_centers          WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM exchange_rates        WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM announcements         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM notifications         WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_tiers    WHERE company_id = ${cid}`);
    await tx.execute(sql`DELETE FROM attendance_deduction_settings WHERE company_id = ${cid}`);

    /* ── Tables added later (trial, consignment, etc.) ── */
    await tx.execute(sql`DELETE FROM trial_abuse_log WHERE company_id = ${cid}`);

    /* ── Users: حذف الكل ما عدا المستخدم الحالي ── */
    await tx.execute(sql`DELETE FROM erp_users WHERE company_id = ${cid} AND id != ${currentUserId}`);
  });

  res.json({ success: true, message: "تم إعادة تعيين قاعدة البيانات بالكامل — تم حذف جميع البيانات" });
}));

// ─── CUSTOMER STATEMENT ───────────────────────────────────────────────────────

router.get("/customers/:id/statement", authenticate, wrap(async (req, res) => {
  const customerId = Number(req.params.id as string);
  const companyId  = getTenant(req);

  const [customer] = await db.select().from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.company_id, companyId)));
  if (!customer) { res.status(404).json({ error: "العميل غير موجود" }); return; }

  const sales = await db.select().from(salesTable)
    .where(and(eq(salesTable.customer_id, customerId), eq(salesTable.company_id, companyId)))
    .orderBy(desc(salesTable.created_at));

  const salesWithItems = await Promise.all(sales.map(async (sale) => {
    const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.sale_id, sale.id));
    return { ...sale, items };
  }));

  const linkedPurchases = await db.select().from(purchasesTable)
    .where(and(eq(purchasesTable.customer_id, customerId), eq(purchasesTable.company_id, companyId)))
    .orderBy(desc(purchasesTable.created_at));

  const purchasesWithItems = await Promise.all(linkedPurchases.map(async (pur) => {
    const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchase_id, pur.id));
    return { ...pur, items };
  }));

  const salesReturns = await db.select().from(salesReturnsTable)
    .where(and(eq(salesReturnsTable.customer_id, customerId), eq(salesReturnsTable.company_id, companyId)))
    .orderBy(desc(salesReturnsTable.created_at));

  const receiptVouchers = await db.select().from(receiptVouchersTable)
    .where(and(eq(receiptVouchersTable.customer_id, customerId), eq(receiptVouchersTable.company_id, companyId)))
    .orderBy(desc(receiptVouchersTable.created_at));

  const depositVouchers = await db.select().from(depositVouchersTable)
    .where(and(eq(depositVouchersTable.customer_id, customerId), eq(depositVouchersTable.company_id, companyId)))
    .orderBy(desc(depositVouchersTable.created_at));

  const paymentVouchers = await db.select().from(paymentVouchersTable)
    .where(and(eq(paymentVouchersTable.customer_id, customerId), eq(paymentVouchersTable.company_id, companyId)))
    .orderBy(desc(paymentVouchersTable.created_at));

  res.json({
    customer,
    sales: salesWithItems,
    linked_purchases: purchasesWithItems,
    sales_returns: salesReturns,
    receipt_vouchers: receiptVouchers,
    deposit_vouchers: depositVouchers,
    payment_vouchers: paymentVouchers,
  });
}));

// ─── SYSTEM SETTINGS ──────────────────────────────────────────────────────────

router.get("/settings/system", authenticate, wrap(async (req, res) => {
  const role      = req.user?.role ?? "";
  const companyId = role === "super_admin"
    ? Number(req.query.company_id)
    : req.user?.company_id;
  if (!companyId || !Number.isFinite(companyId)) {
    res.status(role === "super_admin" ? 400 : 403)
       .json({ error: role === "super_admin" ? "company_id query param required" : "Tenant not resolved" });
    return;
  }
  const cacheKey = `settings:${companyId}`;
  const cached = await getCache<Record<string, string>>(cacheKey);
  if (cached) { res.json(cached); return; }
  const rows = await db.select().from(systemSettingsTable)
    .where(eq(systemSettingsTable.company_id, companyId));
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value ?? "";
  await setCache(cacheKey, result, 300);
  res.json(result);
}));

router.post("/settings/system", authenticate, wrap(async (req, res) => {
  const role = req.user?.role ?? "";
  if (!["admin", "super_admin"].includes(role)) {
    res.status(403).json({ error: "غير مصرح" }); return;
  }
  const parsedSys = systemSettingSchema.safeParse(req.body);
  if (!parsedSys.success) { res.status(400).json({ error: firstZodError(parsedSys.error) }); return; }
  const { key, value } = parsedSys.data;
  if (!key.trim()) { res.status(400).json({ error: "المفتاح مطلوب" }); return; }
  const companyId = role === "super_admin"
    ? Number(req.body?.company_id ?? req.query.company_id)
    : req.user?.company_id;
  if (!companyId || !Number.isFinite(companyId)) {
    res.status(role === "super_admin" ? 400 : 403)
       .json({ error: role === "super_admin" ? "company_id required" : "Tenant not resolved" });
    return;
  }
  await upsertSetting(key.trim(), value ?? "", companyId);
  await deleteCache(`settings:${companyId}`);
  res.json({ success: true, key: key.trim(), value: value ?? "" });
}));

export default router;
