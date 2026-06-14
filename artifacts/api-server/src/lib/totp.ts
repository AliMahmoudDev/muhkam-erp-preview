import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

const APP_NAME = 'مُحكم - MUHKAM ERP';

/* ── AES-256-CBC encryption key for TOTP secrets ─────────────
   Production must provide TOTP_ENCRYPTION_KEY.
   Keep the legacy slice/pad derivation to avoid breaking existing encrypted TOTP secrets.
─────────────────────────────────────────────────────────────── */
const RAW_TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;

if (!RAW_TOTP_ENCRYPTION_KEY || RAW_TOTP_ENCRYPTION_KEY.length < 32) {
  throw new Error('[FATAL] TOTP_ENCRYPTION_KEY must be set to at least 32 characters');
}

const ENCRYPTION_KEY: string = RAW_TOTP_ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0');

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptSecret(encryptedSecret: string): string {
  const [ivHex, encrypted] = encryptedSecret.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Returns true if the value looks like an AES-encrypted secret (hex:hex) */
export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}

export function generateTOTPSecret(username: string) {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME} (${username})`,
    issuer: APP_NAME,
    length: 32,
  });
  if (!secret.otpauth_url) {
    throw new Error('فشل في إنشاء رابط TOTP — لم يُنتج المكتبة otpauth_url');
  }
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
}

export async function generateQRCode(otpauth_url: string): Promise<string> {
  return QRCode.toDataURL(otpauth_url);
}

export function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2,
  });
}
