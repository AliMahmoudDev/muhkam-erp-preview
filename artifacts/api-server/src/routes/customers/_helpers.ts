/**
 * customers/_helpers.ts — shared utilities
 */
import { eq, max } from 'drizzle-orm';
import { db, customersTable } from '@workspace/db';

export const CACHE_TTL = 60;

export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

export function formatCustomer(c: typeof customersTable.$inferSelect, ledgerBalance?: number) {
  return {
    ...c,
    balance: ledgerBalance !== undefined ? ledgerBalance : Number(c.balance),
    is_customer: c.is_customer ?? true,
    is_supplier: c.is_supplier ?? false,
    created_at: c.created_at.toISOString(),
  };
}

export async function getNextCustomerCode(companyId: number): Promise<number> {
  const result = await db
    .select({ maxCode: max(customersTable.customer_code) })
    .from(customersTable)
    .where(eq(customersTable.company_id, companyId));
  const currentMax = result[0]?.maxCode ?? 0;
  return Math.max(currentMax ?? 0, 1000) + 1;
}
