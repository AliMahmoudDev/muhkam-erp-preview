/**
 * Repair tracking token — HMAC-SHA256 based proof-of-possession token.
 *
 * The token is computed from the server-side secret + (companyId:jobNo).
 * Because the token is derived from a secret only the server knows, it is
 * unguessable even when job numbers are sequential.
 *
 * Requires REPAIR_TRACKING_SECRET env variable (minimum 32 characters).
 * The endpoint fails CLOSED (503) if the secret is absent.
 *
 * Production behaviour when secret is absent:
 *   - isTrackingEnabled() → false
 *   - computeTrackingToken() → throws (no token is generated with an empty key)
 *   - verifyTrackingToken() → false (no token is accepted)
 */
import { createHmac } from "node:crypto";
import { logger } from "./logger";

const SECRET = process.env["REPAIR_TRACKING_SECRET"] ?? "";
const IS_PROD = process.env.NODE_ENV === "production";

const MIN_SECRET_LENGTH = 32;

if (!SECRET) {
  if (IS_PROD) {
    logger.error(
      "[tracking-token] REPAIR_TRACKING_SECRET is not set in production. " +
      "Public repair-tracking endpoints will return 503. " +
      "Set a 32+ character secret in .env to enable repair tracking."
    );
  } else {
    logger.warn(
      "[tracking-token] WARNING: REPAIR_TRACKING_SECRET is not set. " +
      "Public repair-tracking endpoints will be disabled until the secret is configured."
    );
  }
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
 *
 * Throws in production when the secret is not configured (fail-closed).
 * Returns an empty string in non-production environments for graceful degradation.
 */
export function computeTrackingToken(companyId: number, jobNo: string): string {
  if (!SECRET) {
    if (IS_PROD) {
      throw new Error(
        "[tracking-token] Cannot generate tracking token: " +
        "REPAIR_TRACKING_SECRET is not configured in production."
      );
    }
    return "";
  }
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
