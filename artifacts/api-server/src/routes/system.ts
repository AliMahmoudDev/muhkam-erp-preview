import { Router, type IRouter } from 'express';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  productsTable,
  customersTable,
  salesTable,
  saleItemsTable,
  purchasesTable,
  purchaseItemsTable,
  salesReturnsTable,
  saleReturnItemsTable,
  purchaseReturnsTable,
  purchaseReturnItemsTable,
  expensesTable,
  incomeTable,
  transactionsTable,
  accountsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  receiptVouchersTable,
  depositVouchersTable,
  paymentVouchersTable,
  treasuryVouchersTable,
  safeTransfersTable,
  stockMovementsTable,
  safesTable,
  warehousesTable,
  erpUsersTable,
  systemSettingsTable,
  alertsTable,
  auditLogsTable,
  idempotencyKeysTable,
} from '@workspace/db';
import { authenticate, requireRole, requireTenant, getTenant } from '../middleware/auth';
import { wrap } from '../lib/async-handler';
import { writeAuditLog } from '../lib/audit-log';
import { BACKUP_DIR } from '../lib/backup-service';
import {
  isEncryptionEnabled,
  isEncryptedBuffer,
  decryptBuffer,
  encryptBuffer,
  encryptedExtension,
} from '../lib/backup-crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const router: IRouter = Router();

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/system/backup
   Returns a full JSON dump scoped to the caller's company.
   ══════════════════════════════════════════════════════════════════════════ */
router.post(
  '/system/backup',
  authenticate,
  requireRole('admin'),
  requireTenant,
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);
    // Drizzle's eq() requires the exact column type; we use a cast to keep the generic helper lean.
    const cEq = <T extends { company_id: unknown }>(t: T) =>
      eq(t.company_id as Parameters<typeof eq>[0], companyId);

    const [
      products,
      customers,
      sales,
      purchases,
      salesReturns,
      purchaseReturns,
      journalEntries,
      expenses,
      income,
      transactions,
      accounts,
      receiptVouchers,
      depositVouchers,
      paymentVouchers,
      treasuryVouchers,
      safeTransfers,
      stockMovements,
      safes,
      warehouses,
      users,
      settings,
      alerts,
      auditLogs,
    ] = await Promise.all([
      db.select().from(productsTable).where(cEq(productsTable)),
      db.select().from(customersTable).where(cEq(customersTable)),
      db.select().from(salesTable).where(cEq(salesTable)),
      db.select().from(purchasesTable).where(cEq(purchasesTable)),
      db.select().from(salesReturnsTable).where(cEq(salesReturnsTable)),
      db.select().from(purchaseReturnsTable).where(cEq(purchaseReturnsTable)),
      db.select().from(journalEntriesTable).where(cEq(journalEntriesTable)),
      db.select().from(expensesTable).where(cEq(expensesTable)),
      db.select().from(incomeTable).where(cEq(incomeTable)),
      db.select().from(transactionsTable).where(cEq(transactionsTable)),
      db.select().from(accountsTable).where(cEq(accountsTable)),
      db.select().from(receiptVouchersTable).where(cEq(receiptVouchersTable)),
      db.select().from(depositVouchersTable).where(cEq(depositVouchersTable)),
      db.select().from(paymentVouchersTable).where(cEq(paymentVouchersTable)),
      db.select().from(treasuryVouchersTable).where(cEq(treasuryVouchersTable)),
      db.select().from(safeTransfersTable).where(cEq(safeTransfersTable)),
      db.select().from(stockMovementsTable).where(cEq(stockMovementsTable)),
      db.select().from(safesTable).where(cEq(safesTable)),
      db.select().from(warehousesTable).where(cEq(warehousesTable)),
      db
        .select()
        .from(erpUsersTable)
        .where(eq(erpUsersTable.company_id, companyId))
        .then((rows) => rows.filter((u) => u.role !== 'super_admin')),
      db.select().from(systemSettingsTable).where(cEq(systemSettingsTable)),
      db.select().from(alertsTable).where(cEq(alertsTable)),
      db.select().from(auditLogsTable).where(cEq(auditLogsTable)),
    ]);

    const saleIds = sales.map((r) => r.id);
    const purchIds = purchases.map((r) => r.id);
    const srIds = salesReturns.map((r) => r.id);
    const prIds = purchaseReturns.map((r) => r.id);
    const jeIds = journalEntries.map((r) => r.id);

    const [saleItems, purchaseItems, saleReturnItems, purchaseReturnItems, journalEntryLines] =
      await Promise.all([
        saleIds.length
          ? db.select().from(saleItemsTable).where(inArray(saleItemsTable.sale_id, saleIds))
          : [],
        purchIds.length
          ? db
              .select()
              .from(purchaseItemsTable)
              .where(inArray(purchaseItemsTable.purchase_id, purchIds))
          : [],
        srIds.length
          ? db
              .select()
              .from(saleReturnItemsTable)
              .where(inArray(saleReturnItemsTable.return_id, srIds))
          : [],
        prIds.length
          ? db
              .select()
              .from(purchaseReturnItemsTable)
              .where(inArray(purchaseReturnItemsTable.return_id, prIds))
          : [],
        jeIds.length
          ? db
              .select()
              .from(journalEntryLinesTable)
              .where(inArray(journalEntryLinesTable.entry_id, jeIds))
          : [],
      ]);

    const backup = {
      version: '2.0',
      app: 'مُحكم - MUHKAM ERP',
      created_at: new Date().toISOString(),
      company_id: companyId,
      _meta: { truncated: false },
      data: {
        products,
        customers,
        sales,
        sale_items: saleItems,
        purchases,
        purchase_items: purchaseItems,
        sales_returns: salesReturns,
        sale_return_items: saleReturnItems,
        purchase_returns: purchaseReturns,
        purchase_return_items: purchaseReturnItems,
        expenses,
        income,
        transactions,
        accounts,
        journal_entries: journalEntries,
        journal_entry_lines: journalEntryLines,
        receipt_vouchers: receiptVouchers,
        deposit_vouchers: depositVouchers,
        payment_vouchers: paymentVouchers,
        treasury_vouchers: treasuryVouchers,
        safe_transfers: safeTransfers,
        stock_movements: stockMovements,
        safes,
        warehouses,
        users,
        settings,
        alerts,
        audit_logs: auditLogs,
      },
    };

    const json = JSON.stringify(backup, null, 2);
    const dt = new Date().toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
    const ext = encryptedExtension(); // ".enc" or ""
    const filename = `halal-tech-backup_company-${companyId}_${dt}.json${ext}`;

    if (isEncryptionEnabled()) {
      const ciphertext = encryptBuffer(Buffer.from(json, 'utf8'));
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('X-Backup-Encrypted', 'aes-256-gcm');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(ciphertext);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(json);
    }
  })
);

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/system/restore — TENANT-SCOPED restore.

   Hardening contract:
   1. file.company_id MUST match req.user.company_id (no cross-tenant restore)
   2. file._meta.truncated MUST be false (cannot restore partial backups)
   3. Idempotency token blocks accidental double-clicks within 5 min
   4. Auto pre-restore snapshot is created BEFORE any DELETE
   5. ALL DELETEs are scoped to the caller's company_id only
   6. Audit log written BEFORE (intent) and AFTER (outcome)
   7. Long transaction explicitly raises statement_timeout
   ══════════════════════════════════════════════════════════════════════════ */

/* Idempotency window for restore (matches retention policy). */
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

/**
 * Persisted idempotency claim. Returns true if the (company, scope, key) was
 * NOT seen within the TTL window and is now claimed; false if it was already
 * claimed (caller should reject as duplicate).
 */
async function claimIdempotency(companyId: number, scope: string, key: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
  // Best-effort GC of stale rows for this scope (keeps the table small)
  await db
    .delete(idempotencyKeysTable)
    .where(
      sql`${idempotencyKeysTable.scope} = ${scope} AND ${idempotencyKeysTable.created_at} < ${cutoff}`
    );
  try {
    await db.insert(idempotencyKeysTable).values({
      company_id: companyId,
      scope,
      key,
    });
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') return false; // unique violation = duplicate
    throw err;
  }
}

router.post(
  '/system/restore',
  authenticate,
  requireRole('admin'),
  requireTenant,
  wrap(async (req, res) => {
    const companyId: number = getTenant(req);

    /* ── -1. Body parsing: raw bytes → JSON object ──────────────────────────
     The /api/system/restore endpoint uses express.raw() (see app.ts) to support
     both plaintext JSON and AES-256-GCM-encrypted backup files. We detect the
     format by checking the magic header, decrypt if needed, then JSON.parse. */
    let body: Record<string, unknown>;
    try {
      const raw = req.body as Buffer;
      if (!raw || !Buffer.isBuffer(raw) || raw.length === 0) {
        res.status(400).json({ error: 'لم يتم استلام ملف النسخة الاحتياطية' });
        return;
      }
      let plaintext: Buffer;
      if (isEncryptedBuffer(raw)) {
        if (!isEncryptionEnabled()) {
          res.status(400).json({
            error: 'الملف مشفّر لكن مفتاح التشفير غير مهيّأ على الخادم — راجع المدير',
          });
          return;
        }
        plaintext = decryptBuffer(raw);
      } else {
        plaintext = raw;
      }
      body = JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>;
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'ملف النسخة الاحتياطية غير صالح',
      });
      return;
    }

    /* ── 0. Idempotency check ────────────────────────────────── */
    const idemToken = String(req.headers['idempotency-key'] ?? '');
    if (!idemToken || idemToken.length < 8) {
      res
        .status(400)
        .json({ error: 'Idempotency-Key header (≥8 chars) مطلوب لمنع الاستعادة المكررة' });
      return;
    }
    if (!(await claimIdempotency(companyId, 'restore', idemToken))) {
      res
        .status(409)
        .json({ error: 'تم تنفيذ نفس عملية الاستعادة خلال آخر 5 دقائق — مرفوضة لمنع التكرار' });
      return;
    }

    /* ── 1. Body shape validation ────────────────────────────── */
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح' });
      return;
    }
    if (!('data' in body) || typeof body.data !== 'object' || body.data === null) {
      res.status(400).json({ error: 'ملف غير مكتمل — مفتاح data مفقود' });
      return;
    }

    /* ── 2. Tenant-match check (HARD BLOCK) ──────────────────── */
    const fileCompanyId = Number(body.company_id);
    if (!Number.isFinite(fileCompanyId) || fileCompanyId !== companyId) {
      await writeAuditLog({
        action: 'RESTORE_REJECTED',
        record_type: 'system',
        record_id: companyId,
        new_value: {
          reason: 'company_mismatch',
          file_company_id: body.company_id,
          target: companyId,
        },
        user: req.user,
        company_id: companyId,
      });
      res.status(403).json({
        error: `ملف النسخة لشركة أخرى (${body.company_id}) — لا يمكن استعادته في شركتك (${companyId})`,
      });
      return;
    }

    /* ── 3. Truncated-file check (HARD BLOCK) ───────────────── */
    const meta = (body._meta ?? {}) as Record<string, unknown>;
    if (meta.truncated === true) {
      res.status(400).json({
        error: 'هذا الملف نسخة مقطوعة (truncated) — لا يمكن استعادته. اطلب نسخة كاملة.',
      });
      return;
    }

    const tables = body.data as Record<string, unknown[]>;

    /* ── restore_modules: optional array for selective restore ── */
    const restoreModules: string[] | null = Array.isArray(body.restore_modules)
      ? (body.restore_modules as string[])
      : null;
    const shouldRestore = (mod: string) => !restoreModules || restoreModules.includes(mod);

    /* Required base keys must exist in the file (even for selective restore) */
    const required = ['products', 'customers', 'sales'];
    // eslint-disable-next-line security/detect-object-injection
    const missing = required.filter((k) => !Array.isArray(tables[k]));
    if (missing.length > 0) {
      res.status(400).json({ error: `ملف غير مكتمل — مفاتيح مفقودة: ${missing.join(', ')}` });
      return;
    }

    /* ── 3.5. Restore relationship validation ───────────────
     Child tables do not carry company_id; they inherit tenancy through their
     parent rows. Before any pre-restore snapshot or DELETE, reject backup files
     whose child rows point at missing / foreign parents, products, or accounts. */
    const rowsOf = (key: string): Record<string, unknown>[] => {
      // eslint-disable-next-line security/detect-object-injection
      return Array.isArray(tables[key]) ? (tables[key] as Record<string, unknown>[]) : [];
    };

    const parseId = (value: unknown): number | null => {
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? n : null;
    };

    const assertCompanyScopedRows = () => {
      for (const [tableName, rows] of Object.entries(tables)) {
        if (!Array.isArray(rows)) continue;
        for (const [index, row] of (rows as Record<string, unknown>[]).entries()) {
          if (!row || typeof row !== 'object') continue;
          const rawCompanyId = row.company_id;
          if (rawCompanyId === undefined || rawCompanyId === null) continue;
          if (Number(rawCompanyId) !== companyId) {
            throw new Error(`restore_company_mismatch:${tableName}[${index}].company_id`);
          }
        }
      }
    };

    const idSet = (label: string, rows: Record<string, unknown>[]): Set<number> => {
      const ids = new Set<number>();
      for (const [index, row] of rows.entries()) {
        const id = parseId(row.id);
        if (id === null) throw new Error(`restore_invalid_id:${label}[${index}].id`);
        if (ids.has(id)) throw new Error(`restore_duplicate_id:${label}.${id}`);
        ids.add(id);
      }
      return ids;
    };

    const assertRequiredRef = (
      label: string,
      rows: Record<string, unknown>[],
      field: string,
      allowedIds: Set<number>
    ) => {
      for (const [index, row] of rows.entries()) {
        // eslint-disable-next-line security/detect-object-injection
        const id = parseId(row[field]);
        if (id === null || !allowedIds.has(id)) {
          throw new Error(`restore_invalid_reference:${label}[${index}].${field}`);
        }
      }
    };

    const assertOptionalRef = (
      label: string,
      rows: Record<string, unknown>[],
      field: string,
      allowedIds: Set<number>
    ) => {
      for (const [index, row] of rows.entries()) {
        // eslint-disable-next-line security/detect-object-injection
        const raw = row[field];
        if (raw === undefined || raw === null || raw === '') continue;
        const id = parseId(raw);
        if (id === null || !allowedIds.has(id)) {
          throw new Error(`restore_invalid_reference:${label}[${index}].${field}`);
        }
      }
    };

    try {
      assertCompanyScopedRows();

      const productIds = idSet('products', rowsOf('products'));
      const accountIds = idSet('accounts', rowsOf('accounts'));
      const saleIds = idSet('sales', rowsOf('sales'));
      const purchaseIds = idSet('purchases', rowsOf('purchases'));
      const salesReturnIds = idSet('sales_returns', rowsOf('sales_returns'));
      const purchaseReturnIds = idSet('purchase_returns', rowsOf('purchase_returns'));
      const journalEntryIds = idSet('journal_entries', rowsOf('journal_entries'));
      const saleItemIds = idSet('sale_items', rowsOf('sale_items'));
      const purchaseItemIds = idSet('purchase_items', rowsOf('purchase_items'));

      assertRequiredRef('sale_items', rowsOf('sale_items'), 'sale_id', saleIds);
      assertRequiredRef('sale_items', rowsOf('sale_items'), 'product_id', productIds);

      assertRequiredRef('purchase_items', rowsOf('purchase_items'), 'purchase_id', purchaseIds);
      assertRequiredRef('purchase_items', rowsOf('purchase_items'), 'product_id', productIds);

      assertRequiredRef(
        'sale_return_items',
        rowsOf('sale_return_items'),
        'return_id',
        salesReturnIds
      );
      assertRequiredRef('sale_return_items', rowsOf('sale_return_items'), 'product_id', productIds);
      assertOptionalRef(
        'sale_return_items',
        rowsOf('sale_return_items'),
        'original_sale_item_id',
        saleItemIds
      );

      assertRequiredRef(
        'purchase_return_items',
        rowsOf('purchase_return_items'),
        'return_id',
        purchaseReturnIds
      );
      assertRequiredRef(
        'purchase_return_items',
        rowsOf('purchase_return_items'),
        'product_id',
        productIds
      );
      assertOptionalRef(
        'purchase_return_items',
        rowsOf('purchase_return_items'),
        'original_purchase_item_id',
        purchaseItemIds
      );

      assertRequiredRef(
        'journal_entry_lines',
        rowsOf('journal_entry_lines'),
        'entry_id',
        journalEntryIds
      );
      assertRequiredRef(
        'journal_entry_lines',
        rowsOf('journal_entry_lines'),
        'account_id',
        accountIds
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await writeAuditLog({
        action: 'RESTORE_REJECTED',
        record_type: 'system',
        record_id: companyId,
        new_value: { reason },
        user: req.user,
        company_id: companyId,
      });
      res.status(400).json({ error: 'ملف النسخة الاحتياطية يحتوي علاقات غير صالحة', reason });
      return;
    }

    /* ── 4. Audit BEFORE — intent ───────────────────────────── */
    await writeAuditLog({
      action: 'RESTORE_STARTED',
      record_type: 'system',
      record_id: companyId,
      new_value: {
        file_version: body.version,
        file_date: body.created_at,
        counts: Object.fromEntries(
          Object.entries(tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
        ),
      },
      user: req.user,
      company_id: companyId,
    });

    /* ── 5. Tenant-scoped pre-restore snapshot ─────────────────
     We deliberately do NOT call triggerBackup() here — that produces a
     GLOBAL backup file containing all tenants' data, which would leak
     other tenants' rows to whoever holds this tenant's filesystem. */
    let snapshotPath: string | null = null;
    try {
      // Drizzle eq() requires the exact column type; cast keeps the generic helper lean.
      const cEq = <T extends { company_id: unknown }>(t: T) =>
        eq(t.company_id as Parameters<typeof eq>[0], companyId);
      const [
        products,
        customers,
        sales,
        purchases,
        salesReturns,
        purchaseReturns,
        journalEntries,
        expenses,
        income,
        transactions,
        accounts,
        receiptVouchers,
        depositVouchers,
        paymentVouchers,
        treasuryVouchers,
        safeTransfers,
        stockMovements,
        safes,
        warehouses,
        settings,
        alerts,
      ] = await Promise.all([
        db.select().from(productsTable).where(cEq(productsTable)),
        db.select().from(customersTable).where(cEq(customersTable)),
        db.select().from(salesTable).where(cEq(salesTable)),
        db.select().from(purchasesTable).where(cEq(purchasesTable)),
        db.select().from(salesReturnsTable).where(cEq(salesReturnsTable)),
        db.select().from(purchaseReturnsTable).where(cEq(purchaseReturnsTable)),
        db.select().from(journalEntriesTable).where(cEq(journalEntriesTable)),
        db.select().from(expensesTable).where(cEq(expensesTable)),
        db.select().from(incomeTable).where(cEq(incomeTable)),
        db.select().from(transactionsTable).where(cEq(transactionsTable)),
        db.select().from(accountsTable).where(cEq(accountsTable)),
        db.select().from(receiptVouchersTable).where(cEq(receiptVouchersTable)),
        db.select().from(depositVouchersTable).where(cEq(depositVouchersTable)),
        db.select().from(paymentVouchersTable).where(cEq(paymentVouchersTable)),
        db.select().from(treasuryVouchersTable).where(cEq(treasuryVouchersTable)),
        db.select().from(safeTransfersTable).where(cEq(safeTransfersTable)),
        db.select().from(stockMovementsTable).where(cEq(stockMovementsTable)),
        db.select().from(safesTable).where(cEq(safesTable)),
        db.select().from(warehousesTable).where(cEq(warehousesTable)),
        db.select().from(systemSettingsTable).where(cEq(systemSettingsTable)),
        db.select().from(alertsTable).where(cEq(alertsTable)),
      ]);
      const sIds = sales.map((r) => r.id),
        pIds = purchases.map((r) => r.id);
      const srIds = salesReturns.map((r) => r.id),
        prIds = purchaseReturns.map((r) => r.id);
      const jeIds = journalEntries.map((r) => r.id);
      const [saleItems, purchaseItems, saleReturnItems, purchaseReturnItems, journalEntryLines] =
        await Promise.all([
          sIds.length
            ? db.select().from(saleItemsTable).where(inArray(saleItemsTable.sale_id, sIds))
            : [],
          pIds.length
            ? db
                .select()
                .from(purchaseItemsTable)
                .where(inArray(purchaseItemsTable.purchase_id, pIds))
            : [],
          srIds.length
            ? db
                .select()
                .from(saleReturnItemsTable)
                .where(inArray(saleReturnItemsTable.return_id, srIds))
            : [],
          prIds.length
            ? db
                .select()
                .from(purchaseReturnItemsTable)
                .where(inArray(purchaseReturnItemsTable.return_id, prIds))
            : [],
          jeIds.length
            ? db
                .select()
                .from(journalEntryLinesTable)
                .where(inArray(journalEntryLinesTable.entry_id, jeIds))
            : [],
        ]);

      const snap = {
        version: '2.0',
        app: 'مُحكم - MUHKAM ERP',
        created_at: new Date().toISOString(),
        company_id: companyId,
        _meta: { truncated: false, kind: 'pre-restore' },
        data: {
          products,
          customers,
          sales,
          sale_items: saleItems,
          purchases,
          purchase_items: purchaseItems,
          sales_returns: salesReturns,
          sale_return_items: saleReturnItems,
          purchase_returns: purchaseReturns,
          purchase_return_items: purchaseReturnItems,
          expenses,
          income,
          transactions,
          accounts,
          journal_entries: journalEntries,
          journal_entry_lines: journalEntryLines,
          receipt_vouchers: receiptVouchers,
          deposit_vouchers: depositVouchers,
          payment_vouchers: paymentVouchers,
          treasury_vouchers: treasuryVouchers,
          safe_transfers: safeTransfers,
          stock_movements: stockMovements,
          safes,
          warehouses,
          settings,
          alerts,
        },
      };
      if (!isEncryptionEnabled()) {
        throw new Error(
          'BACKUP_ENCRYPTION_KEY not configured — cannot create encrypted pre-restore snapshot'
        );
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.chmod(BACKUP_DIR, 0o700);

      const dt = new Date().toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
      const filename = `pre-restore_company-${companyId}_${dt}.json${encryptedExtension()}`;
      const full = path.join(BACKUP_DIR, filename);
      const encryptedSnap = encryptBuffer(Buffer.from(JSON.stringify(snap), 'utf8'));

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.writeFile(full, encryptedSnap, { mode: 0o600 });
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.chmod(full, 0o600);

      snapshotPath = filename;
    } catch (err) {
      res.status(500).json({ error: 'فشل إنشاء نسخة وقائية قبل الاستعادة — تم إلغاء العملية' });
      await writeAuditLog({
        action: 'RESTORE_FAILED',
        record_type: 'system',
        record_id: companyId,
        new_value: { reason: 'pre_snapshot_failed', error: String(err) },
        user: req.user,
        company_id: companyId,
      });
      return;
    }

    /* ── 6. Date parsing helper ─────────────────────────────── */
    const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    const parseDates = (rows: Record<string, unknown>[]) =>
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === 'string' && ISO_RE.test(v) ? new Date(v) : v,
          ])
        )
      );

    const get = (key: string): Record<string, unknown>[] => {
      // eslint-disable-next-line security/detect-object-injection
      const rows = Array.isArray(tables[key]) ? (tables[key] as Record<string, unknown>[]) : [];
      /* Force company_id on every row to caller's tenant — defensive */
      return parseDates(rows).map((r) => ({
        ...r,
        ...('company_id' in r ? { company_id: companyId } : {}),
      }));
    };

    /* ── 7. Tenant-scoped DELETE + INSERT in a long transaction ─ */
    try {
      await db.transaction(async (tx) => {
        /* Allow longer txn — restore can take a while on big tenants */
        await tx.execute(sql`SET LOCAL statement_timeout = '300000'`);
        await tx.execute(sql`SET LOCAL lock_timeout = '60000'`);

        /* Serialize concurrent restores for the same tenant — prevents two
         admins from racing each other and corrupting the dataset. The lock
         is released automatically at txn commit/rollback. */
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'restore:' + companyId}))`);

        /* Collect this tenant's parent IDs for cascade-style child deletes */
        const tenantSaleIds = (
          await tx
            .select({ id: salesTable.id })
            .from(salesTable)
            .where(eq(salesTable.company_id, companyId))
        ).map((r) => r.id);
        const tenantPurchaseIds = (
          await tx
            .select({ id: purchasesTable.id })
            .from(purchasesTable)
            .where(eq(purchasesTable.company_id, companyId))
        ).map((r) => r.id);
        const tenantSrIds = (
          await tx
            .select({ id: salesReturnsTable.id })
            .from(salesReturnsTable)
            .where(eq(salesReturnsTable.company_id, companyId))
        ).map((r) => r.id);
        const tenantPrIds = (
          await tx
            .select({ id: purchaseReturnsTable.id })
            .from(purchaseReturnsTable)
            .where(eq(purchaseReturnsTable.company_id, companyId))
        ).map((r) => r.id);
        const tenantJeIds = (
          await tx
            .select({ id: journalEntriesTable.id })
            .from(journalEntriesTable)
            .where(eq(journalEntriesTable.company_id, companyId))
        ).map((r) => r.id);

        const tenantOnly = (col: Parameters<typeof eq>[0]) => eq(col, companyId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle insert values() requires per-table types; any[] is unavoidable for this generic restore helper
        const ins = async <T>(tbl: Parameters<typeof tx.insert>[0], rows: T[]) => {
          if (rows.length > 0) await tx.insert(tbl).values(rows as any[]);
        };

        /* ── Module: sales ── */
        if (shouldRestore('sales')) {
          if (tenantSrIds.length)
            await tx
              .delete(saleReturnItemsTable)
              .where(inArray(saleReturnItemsTable.return_id, tenantSrIds));
          if (tenantSaleIds.length)
            await tx.delete(saleItemsTable).where(inArray(saleItemsTable.sale_id, tenantSaleIds));
          await tx.delete(salesReturnsTable).where(tenantOnly(salesReturnsTable.company_id));
          await tx.delete(salesTable).where(tenantOnly(salesTable.company_id));
        }

        /* ── Module: purchases ── */
        if (shouldRestore('purchases')) {
          if (tenantPrIds.length)
            await tx
              .delete(purchaseReturnItemsTable)
              .where(inArray(purchaseReturnItemsTable.return_id, tenantPrIds));
          if (tenantPurchaseIds.length)
            await tx
              .delete(purchaseItemsTable)
              .where(inArray(purchaseItemsTable.purchase_id, tenantPurchaseIds));
          await tx.delete(purchaseReturnsTable).where(tenantOnly(purchaseReturnsTable.company_id));
          await tx.delete(purchasesTable).where(tenantOnly(purchasesTable.company_id));
        }

        /* ── Module: finance ── */
        if (shouldRestore('finance')) {
          if (tenantJeIds.length)
            await tx
              .delete(journalEntryLinesTable)
              .where(inArray(journalEntryLinesTable.entry_id, tenantJeIds));
          await tx.delete(journalEntriesTable).where(tenantOnly(journalEntriesTable.company_id));
          await tx.delete(expensesTable).where(tenantOnly(expensesTable.company_id));
          await tx.delete(incomeTable).where(tenantOnly(incomeTable.company_id));
          await tx.delete(receiptVouchersTable).where(tenantOnly(receiptVouchersTable.company_id));
          await tx.delete(depositVouchersTable).where(tenantOnly(depositVouchersTable.company_id));
          await tx.delete(paymentVouchersTable).where(tenantOnly(paymentVouchersTable.company_id));
          await tx
            .delete(treasuryVouchersTable)
            .where(tenantOnly(treasuryVouchersTable.company_id));
          await tx.delete(safeTransfersTable).where(tenantOnly(safeTransfersTable.company_id));
          await tx.delete(transactionsTable).where(tenantOnly(transactionsTable.company_id));
          await tx.delete(accountsTable).where(tenantOnly(accountsTable.company_id));
        }

        /* ── Module: products ── */
        if (shouldRestore('products')) {
          await tx.delete(stockMovementsTable).where(tenantOnly(stockMovementsTable.company_id));
          await tx.delete(productsTable).where(tenantOnly(productsTable.company_id));
        }

        /* ── Module: customers ── */
        if (shouldRestore('customers')) {
          await tx.delete(customersTable).where(tenantOnly(customersTable.company_id));
        }

        /* ── Module: infrastructure ── */
        if (shouldRestore('infrastructure')) {
          await tx.delete(safesTable).where(tenantOnly(safesTable.company_id));
          await tx.delete(warehousesTable).where(tenantOnly(warehousesTable.company_id));
        }

        /* ── Module: alerts ── */
        if (shouldRestore('alerts')) {
          await tx.delete(alertsTable).where(tenantOnly(alertsTable.company_id));
        }

        /* audit_logs intentionally NOT deleted — immutable forensic trail. */

        /* ── Re-insert (parents first) ── */
        if (shouldRestore('infrastructure')) {
          await ins(safesTable, get('safes'));
          await ins(warehousesTable, get('warehouses'));
        }
        if (shouldRestore('products')) {
          await ins(productsTable, get('products'));
        }
        if (shouldRestore('customers')) {
          await ins(customersTable, get('customers'));
        }
        if (shouldRestore('finance')) {
          await ins(accountsTable, get('accounts'));
          await ins(expensesTable, get('expenses'));
          await ins(incomeTable, get('income'));
          await ins(transactionsTable, get('transactions'));
          await ins(receiptVouchersTable, get('receipt_vouchers'));
          await ins(depositVouchersTable, get('deposit_vouchers'));
          await ins(paymentVouchersTable, get('payment_vouchers'));
          await ins(treasuryVouchersTable, get('treasury_vouchers'));
          await ins(safeTransfersTable, get('safe_transfers'));
          await ins(journalEntriesTable, get('journal_entries'));
          await ins(journalEntryLinesTable, get('journal_entry_lines'));
        }
        if (shouldRestore('sales')) {
          await ins(salesTable, get('sales'));
          await ins(saleItemsTable, get('sale_items'));
          await ins(salesReturnsTable, get('sales_returns'));
          await ins(saleReturnItemsTable, get('sale_return_items'));
        }
        if (shouldRestore('purchases')) {
          await ins(purchasesTable, get('purchases'));
          await ins(purchaseItemsTable, get('purchase_items'));
          await ins(purchaseReturnsTable, get('purchase_returns'));
          await ins(purchaseReturnItemsTable, get('purchase_return_items'));
        }
        if (shouldRestore('products')) {
          await ins(stockMovementsTable, get('stock_movements'));
        }
        if (shouldRestore('alerts')) {
          await ins(alertsTable, get('alerts'));
        }
        /* audit_logs are NOT restored — they are an immutable forensic trail
         maintained by the running system, not part of restorable state. */
      });
    } catch (err) {
      await writeAuditLog({
        action: 'RESTORE_FAILED',
        record_type: 'system',
        record_id: companyId,
        new_value: { reason: 'transaction_failed', error: String(err), pre_snapshot: snapshotPath },
        user: req.user,
        company_id: companyId,
      });
      res.status(500).json({
        error: 'فشلت الاستعادة — تم استرجاع البيانات السابقة. النسخة الوقائية محفوظة.',
        pre_snapshot: snapshotPath,
      });
      return;
    }

    const counts = Object.fromEntries(
      Object.entries(tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
    );

    /* ── 8. Audit AFTER — outcome ───────────────────────────── */
    await writeAuditLog({
      action: 'RESTORE_COMPLETED',
      record_type: 'system',
      record_id: companyId,
      new_value: { counts, pre_snapshot: snapshotPath, file_version: body.version },
      user: req.user,
      company_id: companyId,
    });

    res.json({
      success: true,
      message: 'تمت الاستعادة بنجاح',
      pre_snapshot: snapshotPath,
      counts,
    });
  })
);

export default router;
