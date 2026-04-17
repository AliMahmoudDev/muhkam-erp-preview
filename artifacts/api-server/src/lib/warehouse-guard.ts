/**
 * warehouse-guard.ts
 *
 * Tenant-scoped warehouse resolver. Eliminates `?? 1` warehouse_id fallbacks
 * that could leak rows into another tenant's warehouse (id=1 may belong to
 * a different company).
 *
 * Resolution order:
 *   1. `preferred` (when provided AND owned by `companyId`)
 *   2. First warehouse owned by `companyId` (deterministic by id)
 *   3. Throw 400 — caller MUST pass a warehouse_id
 *
 * Never returns a warehouse owned by another tenant.
 */

import { eq, and, asc } from "drizzle-orm";
import { db, warehousesTable } from "@workspace/db";

export async function resolveTenantWarehouseId(
  preferred: number | null | undefined,
  companyId: number,
): Promise<number> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    const err = new Error("Tenant context required to resolve warehouse") as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  if (preferred != null && Number.isFinite(preferred)) {
    const [owned] = await db
      .select({ id: warehousesTable.id })
      .from(warehousesTable)
      .where(and(eq(warehousesTable.id, Number(preferred)), eq(warehousesTable.company_id, companyId)));
    if (owned) return owned.id;
    // preferred warehouse exists but belongs to another tenant — refuse
    const err = new Error("المخزن المحدد لا ينتمي لهذه الشركة") as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  const [first] = await db
    .select({ id: warehousesTable.id })
    .from(warehousesTable)
    .where(eq(warehousesTable.company_id, companyId))
    .orderBy(asc(warehousesTable.id))
    .limit(1);

  if (first) return first.id;

  const err = new Error("لا يوجد مخزن للشركة — يجب إنشاء مخزن أولاً أو تحديد warehouse_id") as Error & { status?: number };
  err.status = 400;
  throw err;
}
