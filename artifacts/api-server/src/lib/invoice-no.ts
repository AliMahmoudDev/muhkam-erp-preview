import { db, salesTable, purchasesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Builds a sequential invoice number in the format PREFIX-YYYY-NNNN.
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
    .where(
      and(
        eq(salesTable.company_id, companyId),
        sql`${salesTable.invoice_no} LIKE ${prefix + "%"}`,
      ),
    )
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
    .where(
      and(
        eq(purchasesTable.company_id, companyId),
        sql`${purchasesTable.invoice_no} LIKE ${prefix + "%"}`,
      ),
    )
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
    .where(
      and(
        eq(purchasesTable.company_id, companyId),
        sql`${purchasesTable.invoice_no} LIKE ${prefix + "%"}`,
      ),
    )
    .orderBy(desc(purchasesTable.id))
    .limit(1);
  return buildSeqNo("DEV-PUR", year, row?.no ?? null);
}
