/**
 * tenant.ts
 *
 * Reusable multi-tenant helpers for route handlers.
 *
 * The PRIMARY defence is the global middleware chain in routes/index.ts:
 *   authenticate → requireTenant → tenantGuard
 *
 * These helpers add DEFENCE-IN-DEPTH at the query layer so that a
 * missing WHERE clause is a loud runtime error rather than a silent
 * data-leak.
 *
 * Usage:
 *   import { tenantFilter, requireCompanyId } from "../lib/tenant";
 *
 *   const cid = requireCompanyId(req);                        // throws 403/400 if absent
 *   .where(tenantFilter(productsTable.company_id, cid))       // explicit eq()
 */

import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * Returns a Drizzle WHERE condition scoped to a single tenant company.
 *
 * Prefer this over inline `eq(table.company_id, companyId)` so that
 * grep-able, auditable code is easy to find.
 *
 * @example
 *   .where(tenantFilter(productsTable.company_id, companyId))
 *   .where(and(eq(productsTable.id, id), tenantFilter(productsTable.company_id, cid)))
 */
export function tenantFilter(column: PgColumn, companyId: number): SQL<unknown> {
  return eq(column, companyId);
}

/**
 * requireCompanyId — strict company_id guard for route handlers.
 *
 * - Regular (non-super_admin) user  → returns their company_id (always set
 *   after the global `requireTenant` middleware).
 * - super_admin                     → requires explicit ?company_id= query
 *   param (or company_id in body); throws HTTP 400 if absent.
 * - No authenticated user           → throws HTTP 403.
 *
 * Delegates to getTenant() from middleware/auth.ts.
 *
 * @throws {Error} with `.status` 400 | 403 — caught by the async wrapper.
 */
export { getTenant as requireCompanyId } from "../middleware/auth";

/**
 * requireUser — strict authenticated-user guard for route handlers.
 *
 * Returns the full AuthUser object after the `authenticate` middleware has run.
 * Throws HTTP 401 if no user is attached — caught by the async wrapper.
 *
 * @throws {Error} with `.status` 401
 */
export function requireUser(req: import("express").Request): import("../middleware/auth").AuthUser {
  const user = req.user;
  if (!user) {
    const err = Object.assign(new Error("غير مصرح: يلزم تسجيل الدخول أولاً"), { status: 401 });
    throw err;
  }
  return user;
}
