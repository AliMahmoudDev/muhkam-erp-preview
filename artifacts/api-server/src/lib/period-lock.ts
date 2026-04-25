/**
 * period-lock.ts — Financial Period Lock (Multi-Tenant)
 *
 * PURPOSE:
 *   Prevents modifications to financial documents (sales, purchases, expenses,
 *   vouchers, journal entries, etc.) that fall within a closed accounting period.
 *   This protects the integrity of published financial statements.
 *
 * HOW IT WORKS:
 *   Each company can set a `closing_date` in their system_settings. Any document
 *   with a date ≤ closing_date is considered "locked". Write operations (create,
 *   update, cancel) on locked documents are rejected with HTTP 423 Locked.
 *
 *   The closing_date is fetched from the database and cached per company for
 *   5 seconds to avoid a DB hit on every API request.
 *
 * ADMIN OVERRIDE:
 *   A user with role "admin" can bypass the lock by sending:
 *     { "admin_override": true }
 *   in the request body. The override is recorded in the audit log.
 *
 * USAGE:
 *   Place this call at the start of any write handler, before business logic:
 *
 *     await assertPeriodOpen(docDate, req);
 *
 *   Where `docDate` is the document's date (YYYY-MM-DD) or null to use today.
 *
 * إذا كان closing_date مُعيَّناً في system_settings للشركة، يُمنع أيّ تعديل أو حذف أو
 * إلغاء لأيّ مستند تاريخه ≤ closing_date.
 */

import { and, eq } from "drizzle-orm";
import { db, systemSettingsTable } from "@workspace/db";
import { httpError } from "./async-handler";
import { writeAuditLog } from "./audit-log";
import type { Request } from "express";

/** Short-lived in-process cache to avoid a DB round-trip on every request */
const CACHE_TTL_MS = 5_000; // Re-read from DB at most every 5 seconds

/** Per-company cache entry: maps company_id → { closing_date, expiry_timestamp } */
const cache = new Map<number, { date: string | null; expiry: number }>();

/**
 * Returns the current closing date (YYYY-MM-DD) for a company, or null if
 * no period lock is configured.
 *
 * Uses a short-lived in-process cache to avoid a DB read on every API call.
 * Cache is invalidated via invalidateClosingDateCache() when the setting changes.
 *
 * @param companyId  The tenant company's ID
 * @returns  Closing date string (e.g. "2025-12-31") or null if unlocked
 */
export async function getClosingDate(companyId: number = 1): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(companyId);

  // Return cached value if still fresh
  if (cached && now < cached.expiry) return cached.date;

  // Cache miss or expired — fetch from DB
  const [row] = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(
      and(
        eq(systemSettingsTable.key, "closing_date"),
        eq(systemSettingsTable.company_id, companyId),
      )
    );

  const date = row?.value ?? null;
  cache.set(companyId, { date, expiry: now + CACHE_TTL_MS });
  return date;
}

/**
 * Guards write operations against closed financial periods.
 *
 * Call this at the start of any route handler that creates or modifies
 * a financial document, passing the document's date.
 *
 * @param docDate  The document's date (YYYY-MM-DD), or null/undefined to use today's date.
 *                 This is the date that will be checked against the closing_date.
 * @param req      Express request object — used to read company_id, role, and body.
 *
 * @throws 423 Locked  If the document date falls within a closed period AND the
 *                     user is not an admin bypassing with admin_override: true.
 *
 * Possible outcomes:
 *  a) No closing_date configured → silently returns (no lock active)
 *  b) docDate > closing_date → silently returns (date is in open period)
 *  c) docDate ≤ closing_date, admin + override → records audit log, returns
 *  d) docDate ≤ closing_date, no override → throws 423 with Arabic error message
 */
export async function assertPeriodOpen(
  docDate: string | null | undefined,
  req: Request,
): Promise<void> {
  const companyId  = req.user!.company_id!;
  const closingDate = await getClosingDate(companyId);

  // Case (a): No period lock configured for this company — allow all writes
  if (!closingDate) return;

  // Normalize the document date to YYYY-MM-DD; default to today if not provided
  const date = (docDate ?? new Date().toISOString().split("T")[0]).slice(0, 10);

  // Case (b): Document date is after the closing date — in the open period, allow
  if (date > closingDate) return;

  // Document date is within the locked period
  // Case (c): Admin override — log it and allow
  const isAdmin          = req.user?.role === "admin";
  const overrideRequested = req.body?.admin_override === true;

  if (isAdmin && overrideRequested) {
    // Write an audit entry so there is a record of every override
    void writeAuditLog({
      action:      "PERIOD_OVERRIDE",
      record_type: "financial_lock",
      record_id:   0,
      old_value:   { closing_date: closingDate, doc_date: docDate ?? "today", status: "LOCKED" },
      new_value:   { overridden: true, admin: req.user?.username, role: "admin" },
      user:        { id: req.user?.id, username: req.user?.username },
    });
    return;
  }

  // Case (d): Period is locked and no admin override — reject the write
  // Provide a helpful hint to admins about how to override
  const adminHint = isAdmin ? " (المدير: أرسل admin_override: true للتجاوز)" : "";
  throw httpError(423,
    `لا يمكن تعديل هذا السجل لأنه ضمن فترة مالية مغلقة (حتى ${closingDate}).` +
    ` للتصحيح، استخدم إجراءً عكسياً أو سند/قيد تصحيحي جديد.` +
    adminHint
  );
}

/**
 * Clears the closing date cache for a company (or all companies).
 * Must be called after changing the `closing_date` system setting so the
 * next request picks up the new value instead of serving stale data.
 *
 * @param companyId  If provided, clears cache only for that company.
 *                   If omitted, clears the entire cache (all companies).
 */
export function invalidateClosingDateCache(companyId?: number): void {
  if (companyId !== undefined) {
    cache.delete(companyId);
  } else {
    cache.clear();
  }
}
