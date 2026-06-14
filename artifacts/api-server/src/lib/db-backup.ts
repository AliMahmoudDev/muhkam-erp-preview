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
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'db-backups');

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/* Keep the newest N encrypted DB backups locally and on R2.
   Default: 30 daily backups. Override with DB_BACKUP_MAX_FILES or BACKUP_MAX_FILES. */
const MAX_BACKUPS = parsePositiveInt(
  process.env.DB_BACKUP_MAX_FILES ?? process.env.BACKUP_MAX_FILES,
  30
);

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

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
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  }
  fs.chmodSync(BACKUP_DIR, 0o700);

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
          `bash -lc ${shellQuote(`umask 077 && pg_dump --schema=public --no-owner --no-acl | gzip > /backup/${outputFilename}`)}`,
        ].join(' ')
      : [
          'umask 077 &&',
          'pg_dump',
          `-h ${shellQuote(host)}`,
          `-p ${shellQuote(port)}`,
          `-U ${shellQuote(user)}`,
          `-d ${shellQuote(dbName)}`,
          '--schema=public',
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

  fs.chmodSync(filepath, 0o600);

  /* ── Encrypt the dump (always required — plaintext creation is refused above) ── */
  const encFilepath = `${filepath}${encryptedExtension()}`;
  try {
    await encryptFile(filepath, encFilepath);
    fs.unlinkSync(filepath); // remove plaintext dump immediately
    const encSize = fs.statSync(encFilepath).size;
    logger.info({ filepath: encFilepath, size: encSize }, 'Database backup created (encrypted)');
    await uploadEncryptedBackupToR2(encFilepath);
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

type R2BackupConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
};

function getR2BackupConfig(): R2BackupConfig | null {
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (process.env.R2_ACCOUNT_ID?.trim()
      ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
      : '');
  const bucket = process.env.R2_BUCKET?.trim() || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';
  const prefix = (process.env.R2_BACKUP_PREFIX?.trim() || 'db').replace(/^\/+|\/+$/g, '');

  const values = [endpoint, bucket, accessKeyId, secretAccessKey];
  const anyConfigured = values.some(Boolean);
  const allConfigured = values.every(Boolean);

  if (!anyConfigured) return null;
  if (!allConfigured) {
    throw new Error(
      'R2 backup upload is partially configured. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
    );
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, prefix };
}

async function uploadEncryptedBackupToR2(encFilepath: string): Promise<void> {
  const config = getR2BackupConfig();
  if (!config) return;

  const dockerImage = process.env.BACKUP_AWS_CLI_DOCKER_IMAGE?.trim() || 'amazon/aws-cli';
  const filename = path.basename(encFilepath);
  const objectKey = config.prefix ? `${config.prefix}/${filename}` : filename;
  const envFile = path.join(os.tmpdir(), `.r2-backup-${process.pid}-${Date.now()}.env`);

  fs.writeFileSync(
    envFile,
    [
      `AWS_ACCESS_KEY_ID=${config.accessKeyId}`,
      `AWS_SECRET_ACCESS_KEY=${config.secretAccessKey}`,
      'AWS_DEFAULT_REGION=auto',
      '',
    ].join('\n'),
    { mode: 0o600 }
  );

  try {
    const command = [
      'docker run --rm',
      `--env-file ${shellQuote(envFile)}`,
      `-v ${shellQuote(`${path.dirname(encFilepath)}:/backup:ro`)}`,
      shellQuote(dockerImage),
      `--endpoint-url ${shellQuote(config.endpoint)}`,
      's3 cp',
      '--only-show-errors',
      shellQuote(`/backup/${filename}`),
      shellQuote(`s3://${config.bucket}/${objectKey}`),
    ].join(' ');

    await execAsync(command);
    logger.info(
      { bucket: config.bucket, key: objectKey },
      'Encrypted database backup uploaded to R2'
    );

    try {
      await cleanOldR2Backups(config);
    } catch (cleanupErr) {
      logger.warn({ err: cleanupErr }, 'R2 backup retention cleanup failed');
    }
  } finally {
    try {
      fs.unlinkSync(envFile);
    } catch {
      /* ignore */
    }
  }
}

async function cleanOldR2Backups(config: R2BackupConfig): Promise<void> {
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  const prefix = config.prefix ? `${config.prefix}/` : '';
  let continuationToken: string | undefined;
  const objects: Array<{ key: string; time: number }> = [];

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const item of result.Contents ?? []) {
      if (!item.Key) continue;
      if (!isBackupFile(path.basename(item.Key))) continue;
      objects.push({
        key: item.Key,
        time: item.LastModified?.getTime() ?? 0,
      });
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  objects.sort((a, b) => b.time - a.time);

  for (const old of objects.slice(MAX_BACKUPS)) {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: old.key }));
    logger.info({ key: old.key }, 'Old R2 database backup deleted');
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
