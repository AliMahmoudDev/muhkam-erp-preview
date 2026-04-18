/**
 * auto-account.ts
 *
 * ربط تلقائي: عند إنشاء عميل أو مورد يُنشئ النظام حساباً محاسبياً مرتبطاً
 * تلقائياً في شجرة الحسابات، ويعيد account_id.
 *
 * SECURITY: companyId is REQUIRED on every helper. There are no defaults — every
 * caller must pass the authenticated tenant id. A missing companyId would
 * otherwise silently bind accounts/journal entries to company 1.
 */

import { eq, and, count, sql } from "drizzle-orm";
import { db, accountsTable, journalEntriesTable, journalEntryLinesTable } from "@workspace/db";

type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

interface AccountSpec {
  code: string;
  name: string;
  type: AccountType;
}

export interface AccountRef {
  id: number;
  code: string;
  name: string;
}

export interface JournalLine {
  account: AccountRef;
  debit: number;
  credit: number;
}

function assertCompanyId(companyId: number, fnName: string): void {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error(`auto-account.${fnName}: companyId is required (got ${companyId})`);
  }
}

export async function getOrCreateAccount(spec: AccountSpec, companyId: number): Promise<AccountRef> {
  assertCompanyId(companyId, "getOrCreateAccount");
  const [existing] = await db
    .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
    .from(accountsTable)
    .where(and(eq(accountsTable.code, spec.code), eq(accountsTable.company_id, companyId)));

  if (existing) return existing;

  const [created] = await db
    .insert(accountsTable)
    .values({
      code: spec.code,
      name: spec.name,
      type: spec.type,
      is_posting: true,
      is_active: true,
      opening_balance: "0",
      current_balance: "0",
      level: 2,
      company_id: companyId,
    })
    .returning({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name });

  return created;
}

export async function getOrCreateCustomerAccount(
  customerCode: number,
  customerName: string,
  companyId: number,
): Promise<AccountRef> {
  return getOrCreateAccount({
    code: `AR-${customerCode}`,
    name: `عميل - ${customerName}`,
    type: "asset",
  }, companyId);
}

export async function getOrCreateCustomerPayableAccount(
  customerCode: number,
  customerName: string,
  companyId: number,
): Promise<AccountRef> {
  return getOrCreateAccount({
    code: `AP-C-${customerCode}`,
    name: `مورد - ${customerName}`,
    type: "liability",
  }, companyId);
}

/** @deprecated Use getOrCreateCustomerPayableAccount. Kept for backward-compat. */
export async function getOrCreateSupplierAccount(
  supplierCode: number,
  supplierName: string,
  companyId: number,
): Promise<AccountRef> {
  return getOrCreateAccount({
    code: `AP-${supplierCode}`,
    name: `مورد - ${supplierName}`,
    type: "liability",
  }, companyId);
}

export async function getOrCreateSafeAccount(
  safeId: number,
  safeName: string,
  companyId: number,
): Promise<AccountRef> {
  return getOrCreateAccount({
    code: `SAFE-${safeId}`,
    name: `خزينة - ${safeName}`,
    type: "asset",
  }, companyId);
}

export async function getOrCreateSalesRevenueAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "REV-SALES",
    name: "إيرادات المبيعات",
    type: "revenue",
  }, companyId);
}

export async function getOrCreateInventoryAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "ASSET-INVENTORY",
    name: "بضاعة المخزون",
    type: "asset",
  }, companyId);
}

export async function getOrCreateCOGSAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "EXP-COGS",
    name: "تكلفة البضاعة المباعة",
    type: "expense",
  }, companyId);
}

export async function getOrCreateGeneralExpenseAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "EXP-GENERAL",
    name: "مصروفات عمومية وإدارية",
    type: "expense",
  }, companyId);
}

export async function getOrCreateMiscRevenueAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "REV-MISC",
    name: "إيرادات متنوعة",
    type: "revenue",
  }, companyId);
}

/** @deprecated Use getOrCreateInventoryAccount. */
export async function getOrCreatePurchasesCostAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "EXP-PURCHASES",
    name: "تكلفة المشتريات (قديم)",
    type: "expense",
  }, companyId);
}

/**
 * حساب ضريبة القيمة المضافة المستحقة (ذمم ضريبية - التزام)
 * يُقيَّد فيه الضريبة المحصّلة من العملاء
 */
export async function getOrCreateVatPayableAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "LIAB-VAT-PAYABLE",
    name: "ضريبة القيمة المضافة المستحقة",
    type: "liability",
  }, companyId);
}

/**
 * حساب ضريبة القيمة المضافة على المشتريات (أصل ضريبي)
 * يُقيَّد فيه الضريبة المدفوعة للموردين
 */
export async function getOrCreateVatInputAccount(companyId: number): Promise<AccountRef> {
  return getOrCreateAccount({
    code: "ASSET-VAT-INPUT",
    name: "ضريبة القيمة المضافة على المشتريات",
    type: "asset",
  }, companyId);
}

/**
 * Creates a POSTED multi-line journal entry. companyId is REQUIRED.
 */
export async function createJournalEntry(
  opts: {
    date: string;
    description: string;
    reference: string;
    lines: JournalLine[];
    companyId: number;
  },
  tx?: DbOrTx,
): Promise<void> {
  const runner: DbOrTx = tx ?? (db as unknown as DbOrTx);
  const { date, description, reference, lines, companyId } = opts;
  assertCompanyId(companyId, "createJournalEntry");

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Journal entry imbalance: debit ${totalDebit} ≠ credit ${totalCredit}`);
  }
  if (totalDebit === 0) return;

  const [{ total }] = await runner
    .select({ total: count() })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.company_id, companyId));

  const entryNo = `JE-${String(Number(total) + 1).padStart(5, "0")}`;

  const [entry] = await runner
    .insert(journalEntriesTable)
    .values({
      entry_no: entryNo,
      date,
      description,
      status: "posted",
      reference,
      total_debit: String(totalDebit),
      total_credit: String(totalCredit),
      company_id: companyId,
    })
    .returning({ id: journalEntriesTable.id });

  await runner.insert(journalEntryLinesTable).values(
    lines.map((l) => ({
      entry_id: entry.id,
      account_id: l.account.id,
      account_code: l.account.code,
      account_name: l.account.name,
      debit: String(l.debit),
      credit: String(l.credit),
    })),
  );

  for (const l of lines) {
    const delta = l.debit - l.credit;
    if (delta === 0) continue;
    await runner
      .update(accountsTable)
      .set({ current_balance: sql`current_balance + ${String(delta)}::numeric` })
      .where(eq(accountsTable.id, l.account.id));
  }
}

export async function createAutoJournalEntry(opts: {
  date: string;
  description: string;
  reference: string;
  debit: AccountRef;
  credit: AccountRef;
  amount: number;
  companyId: number;
}): Promise<void> {
  const { date, description, reference, debit, credit, amount, companyId } = opts;
  assertCompanyId(companyId, "createAutoJournalEntry");
  await createJournalEntry({
    date,
    description,
    reference,
    companyId,
    lines: [
      { account: debit, debit: amount, credit: 0 },
      { account: credit, debit: 0, credit: amount },
    ],
  });
}
