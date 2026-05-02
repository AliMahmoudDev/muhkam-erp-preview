/**
 * Repair tracking token — HMAC-SHA256 based proof-of-possession token.
 *
 * The token is computed from the server-side secret + (companyId:jobNo).
 * Because the token is derived from a secret only the server knows, it is
 * unguessable even when job numbers are sequential.
 *
 * Requires REPAIR_TRACKING_SECRET env variable (minimum 32 characters).
 * The endpoint fails CLOSED (503) if the secret is absent.
 */
import { createHmac } from "node:crypto";

const SECRET = process.env["REPAIR_TRACKING_SECRET"] ?? "";

const MIN_SECRET_LENGTH = 32;

if (!SECRET) {
  // eslint-disable-next-line no-console
  console.warn(
    "[tracking-token] WARNING: REPAIR_TRACKING_SECRET is not set. " +
    "Public repair-tracking endpoints will be disabled until the secret is configured."
  );
} else if (SECRET.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `[tracking-token] FATAL: REPAIR_TRACKING_SECRET is too short (${SECRET.length} chars). ` +
    `Minimum required length is ${MIN_SECRET_LENGTH} characters to ensure adequate entropy.`
  );
}

/**
 * Returns true when the server secret is configured and tracking is enabled.
 */
export function isTrackingEnabled(): boolean {
  return SECRET.length > 0;
}

/**
 * Computes the HMAC-SHA256 token for a given company + job number pair.
 * Returns the first 32 hex characters of the digest (128 bits of entropy).
 * Returns an empty string when the secret is not configured.
 */
export function computeTrackingToken(companyId: number, jobNo: string): string {
  if (!SECRET) return "";
  return createHmac("sha256", SECRET)
    .update(`${companyId}:${jobNo}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Constant-time comparison to avoid timing attacks.
 */
export function verifyTrackingToken(companyId: number, jobNo: string, token: string): boolean {
  if (!SECRET || !token) return false;
  const expected = computeTrackingToken(companyId, jobNo);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
