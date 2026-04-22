/**
 * ledger-balance.ts
 * مصدر الحقيقة للأرصدة: دفتر الأستاذ (journal_entry_lines)
 *
 * AR (ذمم العملاء):  balance = SUM(debit) - SUM(credit)  على الحساب المرتبط
 * AP (ذمم الموردين): balance = SUM(credit) - SUM(debit)  على الحساب المرتبط
 *
 * جميع الدوال تأخذ فقط القيود المرحّلة (status = 'posted').
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

type BalanceRow = { balance?: string | number | null };
type TotalRow = { total?: string | number | null };

function r2(n: number) { return Math.round(n * 100) / 100; }

/* ── رصيد عميل واحد (AR) ──────────────────────────────────────────────────── */
export async function getCustomerLedgerBalance(accountId: number | null | undefined): Promise<number> {
  if (!accountId) return 0;
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0)
    - COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    WHERE jel.account_id = ${accountId}
  `);
  return r2(Number((result.rows[0] as BalanceRow | undefined)?.balance ?? 0));
}

/* ── رصيد مورد واحد (AP) ──────────────────────────────────────────────────── */
export async function getSupplierLedgerBalance(accountId: number | null | undefined): Promise<number> {
  if (!accountId) return 0;
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0)
    - COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0) AS balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    WHERE jel.account_id = ${accountId}
  `);
  return r2(Number((result.rows[0] as BalanceRow | undefined)?.balance ?? 0));
}

/* ── إجمالي ذمم جميع العملاء لشركة محددة (AR) ───────────────────────────── */
export async function getTotalCustomerLedgerBalance(companyId: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0)
    - COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0) AS total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id AND a.code LIKE 'AR-%' AND a.company_id = ${companyId}
  `);
  return r2(Number((result.rows[0] as TotalRow | undefined)?.total ?? 0));
}

/* ── إجمالي ذمم جميع الموردين لشركة محددة (AP) ──────────────────────────── */
export async function getTotalSupplierLedgerBalance(companyId: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CAST(jel.credit AS FLOAT8)), 0)
    - COALESCE(SUM(CAST(jel.debit  AS FLOAT8)), 0) AS total
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.entry_id AND je.status = 'posted'
    JOIN accounts a ON a.id = jel.account_id AND a.code LIKE 'AP-%' AND a.company_id = ${companyId}
  `);
  return r2(Number((result.rows[0] as TotalRow | undefined)?.total ?? 0));
}
