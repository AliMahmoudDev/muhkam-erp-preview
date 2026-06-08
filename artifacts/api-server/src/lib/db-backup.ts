/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * db-backup.ts — pg_dump → gzip database backup utility.
 * Creates daily compressed SQL backups in BACKUP_DIR.
 * When BACKUP_ENCRYPTION_KEY is set, backups are AES-256-GCM encrypted
 * and the plaintext .sql.gz is removed after successful encryption.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { logger } from './logger';
import { encryptFile, isEncryptionEnabled, encryptedExtension } from './backup-crypto';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR ?? '/home/runner/workspace/db-backups';
const MAX_BACKUPS = 30;

export async function createDatabaseBackup(): Promise<string> {
  /* Refuse to create unencrypted backups — plaintext SQL dumps expose the full
     multi-tenant database if the backup directory or media is ever compromised.
     BACKUP_ENCRYPTION_KEY must be configured before backups can be created. */
  if (!isEncryptionEnabled()) {
    throw new Error(
      'Backup creation refused: BACKUP_ENCRYPTION_KEY is not set. ' +
        'Configure the encryption key before creating database backups to prevent plaintext sensitive-data exposure.'
    );
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');

  const url = new URL(dbUrl);
  const host = url.hostname;
  const port = url.port || '5432';
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const dbName = url.pathname.slice(1);

  /* ── Use a temp .pgpass file (mode 600) instead of inline PGPASSWORD —
        prevents password exposure in /proc/<pid>/environ and `ps e`. ── */
  const pgpassFile = path.join(os.tmpdir(), `.pgpass-${process.pid}-${Date.now()}`);
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  const pgpassLine = `${escape(host)}:${port}:${escape(dbName)}:${escape(user)}:${escape(password)}\n`;
  fs.writeFileSync(pgpassFile, pgpassLine, { mode: 0o600 });

  try {
    const dockerImage = process.env.BACKUP_PGDUMP_DOCKER_IMAGE?.trim();
    const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\''`)}'`;
    const outputFilename = path.basename(filepath);

    const command = dockerImage
      ? [
          'docker run --rm',
          `--user ${typeof process.getuid === 'function' ? process.getuid() : 1000}:${typeof process.getgid === 'function' ? process.getgid() : 1000}`,
          '-e PGPASSFILE=/tmp/.pgpass',
          `-e PGHOST=${shellQuote(host)}`,
          `-e PGPORT=${shellQuote(port)}`,
          `-e PGUSER=${shellQuote(user)}`,
          `-e PGDATABASE=${shellQuote(dbName)}`,
          `-v ${shellQuote(`${BACKUP_DIR}:/backup`)}`,
          `-v ${shellQuote(`${pgpassFile}:/tmp/.pgpass:ro`)}`,
          shellQuote(dockerImage),
          `bash -lc ${shellQuote(`pg_dump --no-owner --no-acl | gzip > /backup/${outputFilename}`)}`,
        ].join(' ')
      : [
          'pg_dump',
          `-h ${shellQuote(host)}`,
          `-p ${shellQuote(port)}`,
          `-U ${shellQuote(user)}`,
          `-d ${shellQuote(dbName)}`,
          '--no-owner',
          '--no-acl',
          `| gzip > ${shellQuote(filepath)}`,
        ].join(' ');

    await execAsync(command, {
      env: { ...process.env, PGPASSFILE: pgpassFile },
    });
  } finally {
    try {
      fs.unlinkSync(pgpassFile);
    } catch {
      /* ignore */
    }
  }

  /* ── Encrypt the dump (always required — plaintext creation is refused above) ── */
  const encFilepath = `${filepath}${encryptedExtension()}`;
  try {
    await encryptFile(filepath, encFilepath);
    fs.unlinkSync(filepath); // remove plaintext dump immediately
    const encSize = fs.statSync(encFilepath).size;
    logger.info({ filepath: encFilepath, size: encSize }, 'Database backup created (encrypted)');
    await cleanOldBackups();
    return encFilepath;
  } catch (err) {
    /* Encryption failed — remove any partial encrypted file and the plaintext dump */
    try {
      fs.unlinkSync(encFilepath);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(filepath);
    } catch {
      /* ignore */
    }
    throw new Error(
      `Backup encryption failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function isBackupFile(f: string): boolean {
  return f.startsWith('backup-') && (f.endsWith('.sql.gz') || f.endsWith('.sql.gz.enc'));
}

async function cleanOldBackups(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter(isBackupFile)
    .map((f) => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  for (const file of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, file.name));
    logger.info({ file: file.name }, 'Old backup deleted');
  }
}

export function listBackups(): Array<{
  filename: string;
  size_mb: string;
  created_at: string;
  encrypted: boolean;
}> {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter(isBackupFile)
    .map((f) => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        filename: f,
        size_mb: (stats.size / 1024 / 1024).toFixed(2),
        created_at: stats.mtime.toISOString(),
        encrypted: f.endsWith('.enc'),
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function startDbBackupScheduler(): void {
  const scheduleNext = () => {
    const now = new Date();
    const next3am = new Date();
    next3am.setHours(3, 0, 0, 0);
    if (next3am <= now) next3am.setDate(next3am.getDate() + 1);

    const ms = next3am.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        await createDatabaseBackup();
        logger.info('Scheduled database backup completed');
      } catch (err) {
        logger.error({ err }, 'Scheduled database backup failed');
      }
      scheduleNext();
    }, ms);

    logger.info({ nextBackup: next3am.toISOString() }, 'Next database backup scheduled');
  };

  scheduleNext();
  logger.info('Database backup scheduler started');
}
