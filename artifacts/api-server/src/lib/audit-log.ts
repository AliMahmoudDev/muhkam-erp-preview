/**
 * audit-log.ts
 *
 * Thin fire-and-forget helper for writing audit log entries.
 * Never throws — a logging failure must never break the main request.
 */

import { db, auditLogsTable } from "@workspace/db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "cancel"
  | "price_override"
  | "lock_period"
  | "unlock_period"
  | "lock_blocked"
  | "reversal_created"
  | "correction_created"
  // ── ERP critical events ────────────────────────────────────────────────────
  | "INTEGRITY_REPAIR"          // إصلاح انحراف محاسبي (أرصدة حسابات أو عملاء)
  | "INVENTORY_ADJUSTMENT"      // تسوية يدوية للمخزون
  | "INVENTORY_COUNT_APPLIED"   // تطبيق جلسة جرد مخزون
  | "INVENTORY_TRANSFER"        // تحويل مخزون بين مخازن
  | "PERIOD_OVERRIDE"           // تجاوز مدير للقفل المالي
  // ── Safe transfer events ───────────────────────────────────────────────────
  | "SAFE_TRANSFER_CREATED"     // إنشاء تحويل خزينة
  | "SAFE_TRANSFER_COMPLETED"   // اكتمال تحويل الخزينة بنجاح
  | "SAFE_TRANSFER_FEE_APPLIED" // تطبيق رسوم على تحويل خزينة
  // ── SaaS / super-admin events ─────────────────────────────────────────────
  | "COMPANY_ACTIVATED"
  | "COMPANY_SUSPENDED"
  | "COMPANY_EXTENDED"
  | "COMPANY_DELETED"
  | "ADMIN_PASSWORD_RESET"
  // ── Backup / restore lifecycle ────────────────────────────────────────────
  | "RESTORE_STARTED"
  | "RESTORE_REJECTED"
  | "RESTORE_FAILED"
  | "RESTORE_COMPLETED"
  // ── Super-admin tenant data access (forensic) ─────────────────────────────
  | "SUPER_ADMIN_ACCESS"        // super admin viewed tenant data/details
  | "SUPER_ADMIN_LIST_VIEW";    // super admin listed all companies

export type AuditRecordType =
  | "customer"
  | "supplier"
  | "sale"
  | "sale_return"
  | "purchase_return"
  | "product"
  | "financial_lock"
  | "expense"
  | "safe_transfer"
  | "receipt_voucher"
  | "payment_voucher"
  | "deposit_voucher"
  | "treasury_voucher"
  | "user"
  // ── ERP critical types ─────────────────────────────────────────────────────
  | "account_balances"        // إصلاح أرصدة الحسابات المحاسبية
  | "customer_balances"       // إصلاح أرصدة العملاء
  | "employee"                // إدارة الموظفين
  | "company"                 // SaaS company management
  | "subscription"            // تجديد/تمديد الاشتراك
  | "payroll_period"          // payroll period lifecycle
  | "salary_advance"          // salary advance lifecycle
  | "fiscal_year"             // fiscal year open/close
  | "erp_user"               // user account management (password reset, etc.)
  | "system"                 // tenant-level system actions (restore, etc.)
  | "announcement"           // super-admin announcements
  | "warranty";              // warranty records

interface AuditUser {
  id?: number;
  username?: string;
}

export async function writeAuditLog(opts: {
  action: AuditAction;
  record_type: AuditRecordType;
  record_id: number;
  old_value?: object | null;
  new_value?: object | null;
  user?: AuditUser | null;
  company_id?: number | null;
  note?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: opts.action,
      record_type: opts.record_type,
      record_id: opts.record_id,
      old_value: opts.old_value ?? null,
      new_value: opts.new_value ?? null,
      user_id: opts.user?.id ?? null,
      username: opts.user?.username ?? null,
      /* NULL when no tenant context (super_admin/system events). NEVER default
         to a tenant id — that pollutes another tenant's forensic trail. */
      company_id: opts.company_id ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit-log] failed to write log:", err);
  }
}
