/**
 * Sales module shared helpers.
 *
 * Exported from this internal module and imported by create.ts, reports.ts,
 * and returns.ts. Do not import from routes outside the sales/ folder.
 */
import { eq, and } from "drizzle-orm";
import {
  db, salesTable, saleItemsTable, customersTable, accountsTable,
} from "@workspace/db";
import {
  getOrCreateSalesRevenueAccount,
  getOrCreateSafeAccount,
  getOrCreateCustomerAccount,
  getOrCreateCOGSAccount,
  getOrCreateInventoryAccount,
  getOrCreateVatPayableAccount,
  type JournalLine,
} from "../../lib/auto-account";

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatSale(s: typeof salesTable.$inferSelect) {
  return {
    ...s,
    total_amount: Number(s.total_amount),
    paid_amount: Number(s.paid_amount),
    remaining_amount: Number(s.remaining_amount),
    created_at: s.created_at.toISOString(),
  };
}

export function formatSaleItem(item: typeof saleItemsTable.$inferSelect) {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
    cost_price: item.cost_price != null ? Number(item.cost_price) : null,
    cost_total: item.cost_total != null ? Number(item.cost_total) : null,
    quantity_returned: item.quantity_returned != null ? Number(item.quantity_returned) : null,
  };
}

// ── Journal line builder ──────────────────────────────────────────────────────
//
// Revenue entry (قيد الإيراد):
//   Dr: Safe (SAFE) for paid amount  OR  Customer AR for remaining amount
//   Cr: Sales Revenue (REV-SALES) for net (ex-tax) amount
//
// COGS entry (قيد تكلفة البضاعة المباعة):
//   Dr: COGS account   (EXP-COGS)
//   Cr: Inventory      (ASSET-INVENTORY)
//
// VAT entry (if applicable):
//   Cr: VAT Payable    (LIA-VAT)

export async function buildSaleJournalLines(
  sale: typeof salesTable.$inferSelect,
  companyId: number,
): Promise<JournalLine[]> {
  const total      = Number(sale.total_amount);
  const paid       = Number(sale.paid_amount);
  const debt       = total - paid;
  const taxAmount  = Number((sale as Record<string, unknown>).tax_amount ?? 0);
  const netRevenue = total - taxAmount;
  const lines: JournalLine[] = [];

  // Revenue (net of tax)
  const revenueAcct = await getOrCreateSalesRevenueAccount(companyId);
  lines.push({ account: revenueAcct, debit: 0, credit: netRevenue > 0 ? netRevenue : total });

  // VAT payable
  if (taxAmount > 0) {
    const vatAcct = await getOrCreateVatPayableAccount(companyId);
    lines.push({ account: vatAcct, debit: 0, credit: taxAmount });
  }

  // Safe (cash paid)
  if (paid > 0 && sale.safe_id && sale.safe_name) {
    const safeAcct = await getOrCreateSafeAccount(sale.safe_id, sale.safe_name, companyId);
    lines.push({ account: safeAcct, debit: paid, credit: 0 });
  }

  // Customer AR (credit/partial remaining)
  if (debt > 0 && sale.customer_id) {
    const [cust] = await db.select()
      .from(customersTable)
      .where(and(eq(customersTable.id, sale.customer_id), eq(customersTable.company_id, companyId)));
    if (cust?.account_id) {
      const [acctRow] = await db
        .select({ id: accountsTable.id, code: accountsTable.code, name: accountsTable.name })
        .from(accountsTable)
        .where(and(eq(accountsTable.id, cust.account_id), eq(accountsTable.company_id, companyId)));
      if (acctRow) lines.push({ account: acctRow, debit: debt, credit: 0 });
    } else if (cust?.customer_code) {
      const custAcct = await getOrCreateCustomerAccount(cust.customer_code, cust.name, companyId);
      lines.push({ account: custAcct, debit: debt, credit: 0 });
    }
  }

  // COGS + Inventory
  const saleItems = await db
    .select({ cost_total: saleItemsTable.cost_total })
    .from(saleItemsTable)
    .where(eq(saleItemsTable.sale_id, sale.id));

  const totalCOGS = saleItems.reduce((sum, item) => sum + Number(item.cost_total), 0);
  if (totalCOGS > 0) {
    const cogsAcct      = await getOrCreateCOGSAccount(companyId);
    const inventoryAcct = await getOrCreateInventoryAccount(companyId);
    lines.push({ account: cogsAcct,      debit: totalCOGS, credit: 0 });
    lines.push({ account: inventoryAcct, debit: 0,         credit: totalCOGS });
  }

  return lines;
}
