/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * backup-service.ts
 *
 * Builds JSON snapshots of application data and persists them to disk.
 *
 * Memory safety:
 * - Tables are streamed one at a time (not Promise.all) and written to disk
 *   in 1000-row pages. The full snapshot is never held in memory at once.
 * - A hard cap (`MAX_TOTAL_ROWS`) protects against unbounded growth on very
 *   large tenants — exceeding the cap aborts the JSON snapshot and falls back
 *   to a metadata-only record (operator should run pg_dump for full snapshot).
 */

import fs from "node:fs";
import path from "node:path";
import {
  db,
  backupsTable,
  productsTable, customersTable,
  salesTable, saleItemsTable,
  purchasesTable, purchaseItemsTable,
  salesReturnsTable, saleReturnItemsTable,
  purchaseReturnsTable, purchaseReturnItemsTable,
  expensesTable, incomeTable, transactionsTable,
  accountsTable, journalEntriesTable, journalEntryLinesTable,
  receiptVouchersTable, depositVouchersTable,
  paymentVouchersTable, treasuryVouchersTable,
  safeTransfersTable, stockMovementsTable,
  safesTable, warehousesTable,
  erpUsersTable, systemSettingsTable,
  alertsTable, auditLogsTable,
} from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { isEncryptionEnabled, encryptFile, encryptedExtension } from "./backup-crypto";
import { alertManager, ALERT_TYPES } from "./telegram-alert-manager";

/* ── Backup folder ─────────────────────────────────────────────── */
export const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "erp-backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/* ── Concurrency guard ─────────────────────────────────────────── */
let isBackingUp = false;

/* ── Limits ────────────────────────────────────────────────────── */
const MAX_BACKUPS    = 20;
const PAGE_SIZE      = 1000;        // rows per chunk per table
const MAX_TOTAL_ROWS = 2_000_000;   // hard cap → fall back to pg_dump

/* ── Tables to back up (order is preserved in the JSON output) ── */
const TABLES = [
  ["products",                productsTable],
  ["customers",               customersTable],
  ["sales",                   salesTable],
  ["sale_items",              saleItemsTable],
  ["purchases",               purchasesTable],
  ["purchase_items",          purchaseItemsTable],
  ["sales_returns",           salesReturnsTable],
  ["sale_return_items",       saleReturnItemsTable],
  ["purchase_returns",        purchaseReturnsTable],
  ["purchase_return_items",   purchaseReturnItemsTable],
  ["expenses",                expensesTable],
  ["income",                  incomeTable],
  ["transactions",            transactionsTable],
  ["accounts",                accountsTable],
  ["journal_entries",         journalEntriesTable],
  ["journal_entry_lines",     journalEntryLinesTable],
  ["receipt_vouchers",        receiptVouchersTable],
  ["deposit_vouchers",        depositVouchersTable],
  ["payment_vouchers",        paymentVouchersTable],
  ["treasury_vouchers",       treasuryVouchersTable],
  ["safe_transfers",          safeTransfersTable],
  ["stock_movements",         stockMovementsTable],
  ["safes",                   safesTable],
  ["warehouses",              warehousesTable],
  ["users",                   erpUsersTable],
  ["settings",                systemSettingsTable],
  ["alerts",                  alertsTable],
  ["audit_logs",              auditLogsTable],
] as const;

/* ── Streaming JSON writer ───────────────────────────────────────
 * Writes:
 *   { "version": "...", "app": "...", "created_at": "...",
 *     "data": { "table1": [ ... ], "table2": [ ... ] } }
 * one row at a time. */
async function streamBackupToFile(
  filepath: string,
): Promise<{ size: number; totalRows: number; truncated: boolean }> {
  const stream = fs.createWriteStream(filepath, { encoding: "utf8" });
  let streamErr: Error | null = null;
  /* Single error listener — avoid leak from per-chunk `once` listeners. */
  stream.on("error", (err) => { streamErr = err; });

  const write = (chunk: string) =>
    new Promise<void>((resolve, reject) => {
      if (streamErr) return reject(streamErr);
      const ok = stream.write(chunk, (err) => {
        if (err) reject(err);
        else if (ok) resolve();
      });
      if (!ok) stream.once("drain", () => resolve());
    });

  let size = 0;
  let totalRows = 0;
  let truncated = false;

  const safeWrite = async (chunk: string) => {
    size += Buffer.byteLength(chunk, "utf8");
    await write(chunk);
  };

  const created_at = new Date().toISOString();
  await safeWrite(`{"version":"2.1","app":"مُحكم - MUHKAM ERP","created_at":${JSON.stringify(created_at)},"data":{`);

  for (let t = 0; t < TABLES.length; t++) {
    // eslint-disable-next-line security/detect-object-injection
    const [name, table] = TABLES[t]!;
    await safeWrite(`${t === 0 ? "" : ","}${JSON.stringify(name)}:[`);

    let offset = 0;
    let firstRow = true;
    /* paginate to avoid loading the whole table into memory */
    while (true) {
      const rows = await db
        .select()
        .from(table as never)
        .limit(PAGE_SIZE)
        .offset(offset) as unknown[];

      if (rows.length === 0) break;

      for (const row of rows) {
        if (totalRows >= MAX_TOTAL_ROWS) { truncated = true; break; }
        await safeWrite(`${firstRow ? "" : ","}${JSON.stringify(row)}`);
        firstRow = false;
        totalRows++;
      }

      if (truncated || rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    await safeWrite(`]`);
    if (truncated) break;
  }

  await safeWrite(truncated
    ? `},"_meta":{"truncated":true,"reason":"max_rows_exceeded","not_restorable":true}}`
    : `}}`,
  );
  await new Promise<void>((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
  if (streamErr) throw streamErr;

  return { size, totalRows, truncated };
}

/**
 * @deprecated Use `triggerBackup` directly. Kept for callers (e.g. system.ts
 * download endpoint). This loads the whole snapshot into memory and should
 * NOT be used in hot paths — prefer `triggerBackup` which streams to disk.
 *
 * Now sequential (not Promise.all) and bounded by MAX_TOTAL_ROWS to prevent
 * OOM on large tenants. Throws if the cap would be exceeded so callers can
 * surface a clear 413/507 to the operator.
 */
export async function buildBackupPayload() {
  const result: Record<string, unknown> = {};
  let total = 0;
  for (const [name, table] of TABLES) {
    const rows = await db.select().from(table as never);
    total += rows.length;
    if (total > MAX_TOTAL_ROWS) {
      throw new Error(
        `Snapshot too large (>${MAX_TOTAL_ROWS} rows) — use SQL backup (pg_dump) endpoint instead.`,
      );
    }
    // eslint-disable-next-line security/detect-object-injection
    result[name] = rows;
  }
  return {
    version: "2.0",
    app: "مُحكم - MUHKAM ERP",
    created_at: new Date().toISOString(),
    data: result,
  };
}

/**
 * Trigger a backup. Streams the snapshot to disk to bound memory.
 * - trigger: "login" | "logout" | "sale_post" | "purchase_post" | "scheduled" | "manual"
 * - Returns the DB record, or null if a backup is already in progress.
 */
export async function triggerBackup(trigger: string): Promise<typeof backupsTable.$inferSelect | null> {
  if (isBackingUp) {
    logger.warn({ trigger }, "Backup already in progress — skipping");
    return null;
  }

  isBackingUp = true;
  try {
    ensureBackupDir();

    /* Quick row-count probe — if data is huge, skip JSON snapshot entirely. */
    const probeResult = await db.execute<{ count: number | string }>(
      sql`SELECT (
        SELECT COALESCE(SUM(reltuples)::bigint, 0)
        FROM pg_class
        WHERE relkind = 'r' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) AS count`
    );
    const probeRows = (probeResult as unknown as { rows?: Array<{ count: number | string }> }).rows
      ?? (probeResult as unknown as Array<{ count: number | string }>);
    const rowEstimate = Number(probeRows?.[0]?.count ?? 0);

    if (rowEstimate > MAX_TOTAL_ROWS) {
      logger.warn(
        { trigger, rowEstimate, MAX_TOTAL_ROWS },
        "Database too large for JSON backup — skipping (use pg_dump via /api/backups SQL endpoint)",
      );
      return null;
    }

    const dt = new Date().toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);
    const plainFilename = `halal-tech-${trigger}_${dt}.json`;
    const plainPath = path.join(BACKUP_DIR, plainFilename);

    const { size: plainSize, totalRows, truncated } = await streamBackupToFile(plainPath);

    /* If AES-256-GCM encryption is configured, encrypt the file in place
       and remove the plaintext snapshot. */
    let finalFilename = plainFilename;
    let finalSize = plainSize;
    if (isEncryptionEnabled()) {
      const encFilename = `${plainFilename}${encryptedExtension()}`; // .json.enc
      const encPath = path.join(BACKUP_DIR, encFilename);
      try {
        await encryptFile(plainPath, encPath);
        fs.unlinkSync(plainPath); // remove plaintext only after encryption succeeds
        const stat = fs.statSync(encPath);
        finalFilename = encFilename;
        finalSize = stat.size;
        logger.info({ trigger, filename: finalFilename, plainSize, encSize: finalSize }, "Backup encrypted");
      } catch (encErr) {
        /* Fail-closed: when an encryption key is configured, refuse to keep the
           plaintext file on disk. Delete the unencrypted snapshot and abort. */
        logger.error({ trigger, err: encErr }, "Backup encryption failed — deleting plaintext snapshot (fail-closed)");
        try { fs.unlinkSync(plainPath); } catch { /* ignore */ }
        throw new Error(
          `Backup encryption failed and BACKUP_ENCRYPTION_KEY is set. ` +
          `Refusing to retain plaintext snapshot. Cause: ${encErr instanceof Error ? encErr.message : String(encErr)}`
        );
      }
    }

    /* Insert into DB */
    const [record] = await db.insert(backupsTable).values({
      filename: finalFilename,
      size: finalSize,
      trigger,
    }).returning();

    /* Enforce MAX_BACKUPS — delete oldest beyond limit */
    const all = await db.select().from(backupsTable).orderBy(asc(backupsTable.created_at));
    if (all.length > MAX_BACKUPS) {
      const toDelete = all.slice(0, all.length - MAX_BACKUPS);
      for (const old of toDelete) {
        try {
          const oldPath = path.join(BACKUP_DIR, old.filename);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          await db.delete(backupsTable).where(eq(backupsTable.id, old.id));
        } catch (e) {
          logger.warn({ id: old.id, err: e }, "Failed to delete old backup");
        }
      }
    }

    logger.info({ trigger, filename: finalFilename, size: finalSize, totalRows, truncated }, "Backup completed");
    void alertManager.markResolved(
      ALERT_TYPES.BACKUP_FAILED,
      "النسخة الاحتياطية تعمل بشكل طبيعي"
    );
    if (!record) {
      throw new Error("فشل في تسجيل النسخة الاحتياطية في قاعدة البيانات");
    }
    return record;
  } catch (err) {
    logger.error({ trigger, err }, "Backup failed");
    void alertManager.send({
      type:          ALERT_TYPES.BACKUP_FAILED,
      message:       `🚨 *فشل النسخة الاحتياطية*\nالخطأ: ${err instanceof Error ? err.message : String(err)}\nالوقت: ${new Date().toLocaleString("ar-EG")}`,
      cooldownHours: 4,
    });
    return null;
  } finally {
    isBackingUp = false;
  }
}

/** Returns true if a backup is currently running */
export function isBackupInProgress() {
  return isBackingUp;
}

/** Check a boolean backup trigger setting */
export async function isBackupTriggerEnabled(key: "backup_on_login" | "backup_on_logout"): Promise<boolean> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key));
  return row?.value === "true";
}

/** Fire-and-forget backup triggered on login or logout (reads setting first) */
export function maybeBackupAsync(trigger: "login" | "logout") {
  const settingKey = trigger === "login" ? "backup_on_login" : "backup_on_logout";
  void isBackupTriggerEnabled(settingKey).then((enabled) => {
    if (enabled) void triggerBackup(trigger);
  });
}
