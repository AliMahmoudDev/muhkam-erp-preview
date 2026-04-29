/**
 * trial-fingerprint.ts
 *
 * Computes a device fingerprint from HTTP request headers.
 * Goes beyond User-Agent to include browser capability signals.
 *
 * Signals used (all extracted from headers — no JS needed server-side):
 *   - user-agent           : browser/OS identity
 *   - accept-language      : locale configuration
 *   - accept-encoding      : supported compression
 *   - accept               : MIME type preferences
 *   - sec-ch-ua            : Chrome brand list (Chromium-based browsers)
 *   - sec-ch-ua-platform   : OS platform from CH hints
 *   - sec-ch-ua-mobile     : mobile flag from CH hints
 *   - sec-fetch-site       : fetch destination context
 *   - dnt                  : do-not-track preference (fingerprinting signal)
 *
 * Result: SHA-256 hex string (deterministic per device/browser combo).
 *
 * Limitations:
 *   - VPN changes IP but NOT the fingerprint → catches VPN rotators
 *   - Different browsers on same machine → different fingerprints
 *   - Private/incognito mode sends fewer CH hints → partial fingerprint
 *     (still better than UA alone)
 */

import crypto from "crypto";
import type { Request } from "express";

export interface FingerprintComponents {
  ua:        string;
  lang:      string;
  encoding:  string;
  accept:    string;
  ch_ua:     string;
  ch_plat:   string;
  ch_mobile: string;
  dnt:       string;
}

/**
 * Extracts raw fingerprint signals from the request headers.
 * Returns the individual components so they can be logged for debugging.
 */
/** Safely extracts a single string value from a header (handles string | string[]). */
function h(req: Request, name: string): string {
  // eslint-disable-next-line security/detect-object-injection
  const val = req.headers[name];
  if (!val) return "";
  return (Array.isArray(val) ? val[0] : val).trim();
}

export function extractFingerprintComponents(req: Request): FingerprintComponents {
  return {
    ua:        h(req, "user-agent"),
    lang:      h(req, "accept-language"),
    encoding:  h(req, "accept-encoding"),
    accept:    h(req, "accept"),
    ch_ua:     h(req, "sec-ch-ua"),
    ch_plat:   h(req, "sec-ch-ua-platform"),
    ch_mobile: h(req, "sec-ch-ua-mobile"),
    dnt:       h(req, "dnt"),
  };
}

/**
 * Computes a SHA-256 fingerprint from the request.
 * Returns a 64-char hex string that is stable for the same browser/device.
 */
export function computeDeviceFingerprint(req: Request): string {
  const c = extractFingerprintComponents(req);
  const raw = [c.ua, c.lang, c.encoding, c.accept, c.ch_ua, c.ch_plat, c.ch_mobile, c.dnt]
    .join("\x00"); // null byte separator to prevent concatenation collisions
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}
