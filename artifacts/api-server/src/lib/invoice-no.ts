import {
  db,
  salesTable,
  purchasesTable,
  receiptVouchersTable,
  depositVouchersTable,
  paymentVouchersTable,
  treasuryVouchersTable,
  salesReturnsTable,
  purchaseReturnsTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Builds a sequential document number in the format PREFIX-YYYY-NNNN.
 * Uses the last known DB record to avoid timestamp-based collisions.
 * NOTE: Call inside a transaction for full atomicity under high concurrency.
 */
function buildSeqNo(prefix: string, year: number, last: string | null): string {
  const fullPrefix = `${prefix}-${year}-`;
  if (!last) return `${fullPrefix}0001`;
  const seq = parseInt(last.split("-").pop() ?? "0", 10);
  return `${fullPrefix}${String(isNaN(seq) ? 1 : seq + 1).padStart(4, "0")}`;
}

/** Next sale invoice: INV-YYYY-NNNN (scoped per company) */
export async function nextSaleInvoiceNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const [row] = await db
    .select({ no: salesTable.invoice_no })
    .from(salesTable)
    .where(and(eq(salesTable.company_id, companyId), sql`${salesTable.invoice_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(salesTable.id))
    .limit(1);
  return buildSeqNo("INV", year, row?.no ?? null);
}

/** Next purchase invoice: PUR-YYYY-NNNN (scoped per company) */
export async function nextPurchaseInvoiceNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PUR-${year}-`;
  const [row] = await db
    .select({ no: purchasesTable.invoice_no })
    .from(purchasesTable)
    .where(and(eq(purchasesTable.company_id, companyId), sql`${purchasesTable.invoice_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(purchasesTable.id))
    .limit(1);
  return buildSeqNo("PUR", year, row?.no ?? null);
}

/** Next device-purchase invoice: DEV-PUR-YYYY-NNNN (scoped per company) */
export async function nextDevicePurchaseInvoiceNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-PUR-${year}-`;
  const [row] = await db
    .select({ no: purchasesTable.invoice_no })
    .from(purchasesTable)
    .where(and(eq(purchasesTable.company_id, companyId), sql`${purchasesTable.invoice_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(purchasesTable.id))
    .limit(1);
  return buildSeqNo("DEV-PUR", year, row?.no ?? null);
}

/** Next receipt voucher: RCV-YYYY-NNNN (scoped per company) */
export async function nextReceiptVoucherNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RCV-${year}-`;
  const [row] = await db
    .select({ no: receiptVouchersTable.voucher_no })
    .from(receiptVouchersTable)
    .where(and(eq(receiptVouchersTable.company_id, companyId), sql`${receiptVouchersTable.voucher_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(receiptVouchersTable.id))
    .limit(1);
  return buildSeqNo("RCV", year, row?.no ?? null);
}

/** Next payment voucher: PAY-YYYY-NNNN (scoped per company) */
export async function nextPaymentVoucherNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;
  const [row] = await db
    .select({ no: paymentVouchersTable.voucher_no })
    .from(paymentVouchersTable)
    .where(and(eq(paymentVouchersTable.company_id, companyId), sql`${paymentVouchersTable.voucher_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(paymentVouchersTable.id))
    .limit(1);
  return buildSeqNo("PAY", year, row?.no ?? null);
}

/** Next deposit voucher: DEP-YYYY-NNNN (scoped per company) */
export async function nextDepositVoucherNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEP-${year}-`;
  const [row] = await db
    .select({ no: depositVouchersTable.voucher_no })
    .from(depositVouchersTable)
    .where(and(eq(depositVouchersTable.company_id, companyId), sql`${depositVouchersTable.voucher_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(depositVouchersTable.id))
    .limit(1);
  return buildSeqNo("DEP", year, row?.no ?? null);
}

/** Next treasury receipt voucher: RV-YYYY-NNNN (scoped per company) */
export async function nextTreasuryReceiptNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RV-${year}-`;
  const [row] = await db
    .select({ no: treasuryVouchersTable.voucher_no })
    .from(treasuryVouchersTable)
    .where(and(eq(treasuryVouchersTable.company_id, companyId), sql`${treasuryVouchersTable.voucher_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(treasuryVouchersTable.id))
    .limit(1);
  return buildSeqNo("RV", year, row?.no ?? null);
}

/** Next treasury payment voucher: PV-YYYY-NNNN (scoped per company) */
export async function nextTreasuryPaymentNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PV-${year}-`;
  const [row] = await db
    .select({ no: treasuryVouchersTable.voucher_no })
    .from(treasuryVouchersTable)
    .where(and(eq(treasuryVouchersTable.company_id, companyId), sql`${treasuryVouchersTable.voucher_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(treasuryVouchersTable.id))
    .limit(1);
  return buildSeqNo("PV", year, row?.no ?? null);
}

/** Next sales return: SR-YYYY-NNNN (scoped per company) */
export async function nextSaleReturnNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SR-${year}-`;
  const [row] = await db
    .select({ no: salesReturnsTable.return_no })
    .from(salesReturnsTable)
    .where(and(eq(salesReturnsTable.company_id, companyId), sql`${salesReturnsTable.return_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(salesReturnsTable.id))
    .limit(1);
  return buildSeqNo("SR", year, row?.no ?? null);
}

/** Next purchase return: PR-YYYY-NNNN (scoped per company) */
export async function nextPurchaseReturnNo(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;
  const [row] = await db
    .select({ no: purchaseReturnsTable.return_no })
    .from(purchaseReturnsTable)
    .where(and(eq(purchaseReturnsTable.company_id, companyId), sql`${purchaseReturnsTable.return_no} LIKE ${prefix + "%"}`))
    .orderBy(desc(purchaseReturnsTable.id))
    .limit(1);
  return buildSeqNo("PR", year, row?.no ?? null);
}
