/**
 * backup-crypto.ts
 *
 * AES-256-GCM encryption helpers for backup files.
 *
 * File format (binary):
 *   [magic 8B "MUHKMENC"] [version 1B = 0x01]
 *   [salt 16B] [iv 12B] [authTag 16B]
 *   [ciphertext ...]
 *
 * Key is derived once from BACKUP_ENCRYPTION_KEY env using scrypt + per-file salt.
 * If env var is missing, encryption is disabled (plaintext fallback) and a
 * warning is emitted at startup.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import { logger } from "./logger";

const MAGIC = Buffer.from("MUHKMENC", "utf8");
const VERSION = 0x01;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN; // 53

const PASSPHRASE = process.env.BACKUP_ENCRYPTION_KEY ?? "";

export function isEncryptionEnabled(): boolean {
  return PASSPHRASE.length > 0;
}

export function encryptedExtension(): string {
  return isEncryptionEnabled() ? ".enc" : "";
}

function deriveKey(salt: Buffer): Buffer {
  if (!PASSPHRASE) {
    throw new Error("BACKUP_ENCRYPTION_KEY is not set");
  }
  return crypto.scryptSync(PASSPHRASE, salt, 32, { N: 16384, r: 8, p: 1 });
}

/**
 * Detect whether a file is an encrypted MUHKAM backup by checking its magic header.
 */
export function isEncryptedFile(filepath: string): boolean {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fd = fs.openSync(filepath, "r");
    try {
      const buf = Buffer.alloc(MAGIC.length);
      const bytes = fs.readSync(fd, buf, 0, MAGIC.length, 0);
      return bytes === MAGIC.length && buf.equals(MAGIC);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

export function isEncryptedBuffer(buf: Buffer): boolean {
  return buf.length >= MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

/**
 * Stream-encrypt a plaintext file in place. Reads from `srcPath`, writes
 * to `dstPath`. The original `srcPath` is NOT deleted (caller decides).
 *
 * NOTE: GCM requires the auth tag to be written AFTER the ciphertext, but our
 *  format places it in the header. To support streaming we collect ciphertext
 *  in memory only for the final tag patch — for files >100MB we fall back to
 *  appending the tag at end-of-file with a different format flag. To keep
 *  the implementation simple and bounded, we use a temp-file approach:
 *  encrypt to a temp file (ciphertext only), then write [header + temp body]
 *  to dst.
 */
export async function encryptFile(srcPath: string, dstPath: string): Promise<void> {
  if (!isEncryptionEnabled()) {
    throw new Error("BACKUP_ENCRYPTION_KEY not configured — cannot encrypt");
  }
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const tmpCipher = `${dstPath}.cipher.tmp`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await pipeline(fs.createReadStream(srcPath), cipher, fs.createWriteStream(tmpCipher));
  const authTag = cipher.getAuthTag();

  const header = Buffer.concat([
    MAGIC,
    Buffer.from([VERSION]),
    salt,
    iv,
    authTag,
  ]);

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const out = fs.createWriteStream(dstPath);
  await new Promise<void>((resolve, reject) => {
    out.write(header, (err) => (err ? reject(err) : resolve()));
  });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await pipeline(fs.createReadStream(tmpCipher), out);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.unlinkSync(tmpCipher);
}

/**
 * Decrypt an encrypted backup file fully into a Buffer.
 * For restore flows where the JSON must be parsed.
 */
export function decryptFileToBuffer(filepath: string): Buffer {
  if (!isEncryptionEnabled()) {
    throw new Error("BACKUP_ENCRYPTION_KEY not configured — cannot decrypt");
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const data = fs.readFileSync(filepath);
  return decryptBuffer(data);
}

export function decryptBuffer(data: Buffer): Buffer {
  if (data.length < HEADER_LEN) {
    throw new Error("ملف مشفّر تالف — أصغر من حجم الترويسة المتوقع");
  }
  const magic = data.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new Error("ملف غير مشفّر بصيغة MUHKAM المتوقعة");
  }
  let off = MAGIC.length;
  // eslint-disable-next-line security/detect-object-injection
  const version = data[off]; off += 1;
  if (version !== VERSION) {
    throw new Error(`إصدار التشفير غير مدعوم: ${version}`);
  }
  const salt = data.subarray(off, off + SALT_LEN); off += SALT_LEN;
  const iv = data.subarray(off, off + IV_LEN); off += IV_LEN;
  const authTag = data.subarray(off, off + TAG_LEN); off += TAG_LEN;
  const ciphertext = data.subarray(off);

  const key = deriveKey(salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error(
      "فشل فك التشفير — كلمة سر غير صحيحة أو الملف تالف. " +
      `(${err instanceof Error ? err.message : String(err)})`
    );
  }
}

/**
 * Encrypt a Buffer in memory. Used for tenant /system/backup which builds
 * the JSON in memory before sending to the client.
 */
export function encryptBuffer(plaintext: Buffer): Buffer {
  if (!isEncryptionEnabled()) {
    throw new Error("BACKUP_ENCRYPTION_KEY not configured — cannot encrypt");
  }
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([
    MAGIC,
    Buffer.from([VERSION]),
    salt,
    iv,
    authTag,
    ciphertext,
  ]);
}

/**
 * Transform stream that buffers data, encrypts, prepends header on flush.
 * Use only for moderate-sized payloads (in-memory limit applies).
 */
export class EncryptStream extends Transform {
  private chunks: Buffer[] = [];
  private size = 0;
  private maxBytes: number;

  constructor(opts: { maxBytes?: number } = {}) {
    super();
    this.maxBytes = opts.maxBytes ?? 200 * 1024 * 1024; // 200 MB default cap
  }

  _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.size += chunk.length;
    if (this.size > this.maxBytes) {
      cb(new Error(`payload exceeds encryption stream cap (${this.maxBytes} bytes)`));
      return;
    }
    this.chunks.push(chunk);
    cb();
  }

  _flush(cb: TransformCallback): void {
    try {
      const plain = Buffer.concat(this.chunks);
      const encrypted = encryptBuffer(plain);
      this.push(encrypted);
      cb();
    } catch (err) {
      cb(err as Error);
    }
  }
}

/* Startup announcement */
if (!isEncryptionEnabled()) {
  logger.warn(
    "[backup-crypto] BACKUP_ENCRYPTION_KEY not set — backups will be stored as plaintext. " +
    "Set this env var to enable AES-256-GCM encryption.",
  );
} else {
  logger.info("[backup-crypto] AES-256-GCM backup encryption enabled");
}
