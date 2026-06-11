/**
 * Alert Service — smart, event-driven, role-targeted, no spam.
 *
 * trigger_mode : "event" | "daily"
 * role_target  : comma-separated roles that can see the alert ("admin,manager")
 *
 * Deduplication: one row per (type + reference_id). Updates in-place, never duplicates.
 * Auto-resolve : dismissAlert now soft-resolves (keeps history) instead of deleting.
 */

import { eq, and, sql, isNull } from 'drizzle-orm';
import {
  db,
  alertsTable,
  productsTable,
  safesTable,
  customersTable,
  systemSettingsTable,
} from '@workspace/db';
import { getCustomerLedgerBalance, getSupplierLedgerBalance } from './ledger-balance';

/* ── Thresholds ─────────────────────────────────────────────── */
const CUSTOMER_DEBT_LIMIT = 10_000;
const SUPPLIER_DEBT_LIMIT = 10_000;
const CASH_LOW_THRESHOLD = 500;

/* ── Role targets per alert type ────────────────────────────── */
const ROLE_TARGETS: Record<string, string> = {
  low_stock: 'admin,manager',
  customer_debt: 'admin,manager',
  supplier_payable: 'admin,manager',
  cash_low: 'admin,cashier',
  health: 'admin',
};

/* ── Today's date string ────────────────────────────────────── */
function today(): string {
  return new Date().toISOString().split('T')[0];
}

/* ── Read a system setting ──────────────────────────────────── */
async function getSetting(key: string, companyId: number): Promise<string | null> {
  const rows = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(and(eq(systemSettingsTable.key, key), eq(systemSettingsTable.company_id, companyId)))
    .limit(1);
  return rows[0]?.value ?? null;
}

/* ── Upsert: one alert per (type + ref_id), never duplicate ─── */
async function upsertAlert(
  companyId: number,
  type: string,
  referenceId: string | null,
  severity: string,
  message: string,
  triggerMode: 'event' | 'daily' = 'event'
) {
  // eslint-disable-next-line security/detect-object-injection
  const roleTarget = ROLE_TARGETS[type] ?? null;

  const where = referenceId
    ? and(
        eq(alertsTable.company_id, companyId),
        eq(alertsTable.type, type),
        eq(alertsTable.reference_id, referenceId)
      )
    : and(
        eq(alertsTable.company_id, companyId),
        eq(alertsTable.type, type),
        isNull(alertsTable.reference_id)
      );

  const existing = await db
    .select({
      id: alertsTable.id,
      last_triggered_date: alertsTable.last_triggered_date,
      is_resolved: alertsTable.is_resolved,
    })
    .from(alertsTable)
    .where(where)
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    // Daily mode: skip if already triggered today AND alert is still active (not resolved).
    // If the alert was resolved but the issue recurred → always re-activate.
    if (triggerMode === 'daily' && row.last_triggered_date === today() && !row.is_resolved) return;

    await db
      .update(alertsTable)
      .set({
        severity,
        message,
        is_read: false,
        is_resolved: false,
        resolved_at: null,
        resolved_by: null,
        role_target: roleTarget,
        trigger_mode: triggerMode,
        last_triggered_date: today(),
        created_at: new Date(),
      })
      .where(and(eq(alertsTable.id, row.id), eq(alertsTable.company_id, companyId)));
  } else {
    await db.insert(alertsTable).values({
      company_id: companyId,
      type,
      severity,
      message,
      reference_id: referenceId,
      trigger_mode: triggerMode,
      last_triggered_date: today(),
      role_target: roleTarget,
      is_read: false,
      is_resolved: false,
    });
  }
}

/* ── Auto-resolve: soft-resolve when issue disappears ──────── */
async function autoResolve(companyId: number, type: string, referenceId: string | null) {
  const where = referenceId
    ? and(
        eq(alertsTable.company_id, companyId),
        eq(alertsTable.type, type),
        eq(alertsTable.reference_id, referenceId)
      )
    : and(
        eq(alertsTable.company_id, companyId),
        eq(alertsTable.type, type),
        isNull(alertsTable.reference_id)
      );

  await db
    .update(alertsTable)
    .set({
      is_resolved: true,
      resolved_at: new Date(),
      resolved_by: null, // null = system auto-resolved
    })
    .where(where);
}

/* ══════════════════════════════════════════════════════════════
   CHECK FUNCTIONS
   ══════════════════════════════════════════════════════════════ */

export async function checkLowStock(
  companyId: number,
  productId?: number,
  mode: 'event' | 'daily' = 'event'
) {
  const rows = productId
    ? await db
        .select()
        .from(productsTable)
        .where(and(eq(productsTable.id, productId), eq(productsTable.company_id, companyId)))
    : await db.select().from(productsTable).where(eq(productsTable.company_id, companyId));

  for (const p of rows) {
    if (p.low_stock_threshold == null) continue;
    const qty = parseFloat(p.quantity ?? '0');
    if (qty <= p.low_stock_threshold) {
      await upsertAlert(
        companyId,
        'low_stock',
        String(p.id),
        'WARNING',
        `المخزون منخفض للمنتج (${p.name}) — الكمية: ${qty}`,
        mode
      );
    } else {
      await autoResolve(companyId, 'low_stock', String(p.id));
    }
  }
}

export async function checkCustomerDebt(
  companyId: number,
  customerId?: number,
  mode: 'event' | 'daily' = 'event'
) {
  const rows = customerId
    ? await db
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.id, customerId), eq(customersTable.company_id, companyId)))
    : await db.select().from(customersTable).where(eq(customersTable.company_id, companyId));

  for (const c of rows) {
    const balance = await getCustomerLedgerBalance(c.account_id, companyId);
    if (balance > CUSTOMER_DEBT_LIMIT) {
      await upsertAlert(
        companyId,
        'customer_debt',
        String(c.id),
        'WARNING',
        `رصيد العميل ${c.name} تجاوز الحد المسموح (${balance.toLocaleString('ar-EG')} ج.م)`,
        mode
      );
    } else {
      await autoResolve(companyId, 'customer_debt', String(c.id));
    }
  }
}

export async function checkSupplierPayable(
  companyId: number,
  supplierId?: number,
  mode: 'event' | 'daily' = 'event'
) {
  const rows = supplierId
    ? await db
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.id, supplierId), eq(customersTable.company_id, companyId)))
    : await db
        .select()
        .from(customersTable)
        .where(and(eq(customersTable.is_supplier, true), eq(customersTable.company_id, companyId)));

  for (const s of rows) {
    const balance = await getSupplierLedgerBalance(s.account_id, companyId);
    if (balance > SUPPLIER_DEBT_LIMIT) {
      await upsertAlert(
        companyId,
        'supplier_payable',
        String(s.id),
        'WARNING',
        `المستحقات للمورد ${s.name} تجاوزت الحد المسموح (${balance.toLocaleString('ar-EG')} ج.م)`,
        mode
      );
    } else {
      await autoResolve(companyId, 'supplier_payable', String(s.id));
    }
  }
}

export async function checkCashLow(companyId: number, mode: 'event' | 'daily' = 'daily') {
  const res = await db
    .select({ total: sql<string>`coalesce(sum(balance),0)` })
    .from(safesTable)
    .where(eq(safesTable.company_id, companyId));
  const total = parseFloat(res[0]?.total ?? '0');
  if (total < CASH_LOW_THRESHOLD) {
    await upsertAlert(
      companyId,
      'cash_low',
      null,
      'CRITICAL',
      `رصيد الخزنة أقل من الحد الأدنى — الرصيد الحالي: ${total.toLocaleString('ar-EG')} ج.م`,
      mode
    );
  } else {
    await autoResolve(companyId, 'cash_low', null);
  }
}

export async function checkHealthCritical(hasCritical: boolean, companyId: number) {
  if (hasCritical) {
    await upsertAlert(
      companyId,
      'health',
      null,
      'CRITICAL',
      'يوجد مشكلة حرجة في صحة النظام',
      'daily'
    );
  } else {
    await autoResolve(companyId, 'health', null);
  }
}

/* ── Manual resolve by user ID — scoped to tenant ───────────── */
export async function resolveAlert(alertId: number, userId: number, companyId: number) {
  await db
    .update(alertsTable)
    .set({
      is_resolved: true,
      resolved_at: new Date(),
      resolved_by: userId,
    })
    .where(and(eq(alertsTable.id, alertId), eq(alertsTable.company_id, companyId)));
}

/* ── Event-based checks (scoped, fast) ─────────────────────── */
export async function runEventChecks(opts: {
  companyId: number;
  customerId?: number;
  supplierId?: number;
  productId?: number;
}) {
  const enabled = await getSetting('enable_event_alerts', opts.companyId);
  if (enabled === 'false') return;

  await Promise.allSettled([
    opts.customerId
      ? checkCustomerDebt(opts.companyId, opts.customerId, 'event')
      : Promise.resolve(),
    opts.supplierId
      ? checkSupplierPayable(opts.companyId, opts.supplierId, 'event')
      : Promise.resolve(),
    opts.productId ? checkLowStock(opts.companyId, opts.productId, 'event') : Promise.resolve(),
    checkCashLow(opts.companyId, 'event'),
  ]);
}

/* ── Daily full scan (once per day via last_triggered_date) ─── */
export async function runDailyChecks(companyId: number) {
  const enabled = await getSetting('enable_daily_alerts', companyId);
  if (enabled === 'false') return;

  await Promise.allSettled([
    checkLowStock(companyId, undefined, 'daily'),
    checkCustomerDebt(companyId, undefined, 'daily'),
    checkSupplierPayable(companyId, undefined, 'daily'),
    checkCashLow(companyId, 'daily'),
  ]);
}

/* ── Legacy alias ─────────────────────────────────────────── */
export { runEventChecks as runAllChecks };
