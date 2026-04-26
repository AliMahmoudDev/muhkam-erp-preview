/**
 * debug.ts — Super-admin-only diagnostic endpoints
 *
 * GET /api/super/trial-check?email=...&ip=...
 *   Returns the full trial eligibility decision for a given email + IP.
 *   Useful for diagnosing why a registration was blocked or allowed.
 *
 * Access: super_admin only (never exposed to regular users)
 */

import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { wrap } from "../lib/async-handler";
import {
  checkTrialEligibility,
  isPrivateOrLoopbackIP,
  extractClientIP,
  MAX_TRIALS_PUBLIC_IP,
  MAX_TRIALS_PRIVATE_IP,
  MAX_TRIALS_UA_IP,
} from "../lib/trial-guard";

const router = Router();
const superOnly = [authenticate, requireRole("super_admin")] as const;

/**
 * GET /api/super/trial-check
 *
 * Query params:
 *   email  (required) — email address to check
 *   ip     (optional) — override IP to check (defaults to caller's IP)
 *   ua     (optional) — override user-agent to check
 *
 * Returns the full TrialCheckResult plus metadata about current limits.
 * Does NOT modify any state — read-only diagnostic.
 */
router.get(
  "/super/trial-check",
  ...superOnly,
  wrap(async (req, res) => {
    const email = (req.query["email"] as string | undefined)?.trim();
    const ipOverride = (req.query["ip"] as string | undefined)?.trim();
    const uaOverride = (req.query["ua"] as string | undefined)?.trim();

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "email query param is required and must be valid" });
      return;
    }

    const ip        = ipOverride ?? extractClientIP(req);
    const userAgent = uaOverride ?? (req.headers["user-agent"] as string | undefined);

    let decision;
    let check_error: string | null = null;

    try {
      decision = await checkTrialEligibility(email, ip, userAgent);
    } catch (err) {
      check_error = err instanceof Error ? err.message : String(err);
      decision = null;
    }

    res.json({
      input: {
        email:      email.toLowerCase().trim(),
        ip,
        user_agent: userAgent ?? null,
      },
      ip_metadata: {
        is_private:           isPrivateOrLoopbackIP(ip),
        limit_applied:        isPrivateOrLoopbackIP(ip) ? MAX_TRIALS_PRIVATE_IP : MAX_TRIALS_PUBLIC_IP,
      },
      limits: {
        MAX_TRIALS_PUBLIC_IP,
        MAX_TRIALS_PRIVATE_IP,
        MAX_TRIALS_UA_IP,
      },
      decision,
      check_error,
      note: check_error
        ? "DB error occurred — registration would be BLOCKED (fail-closed)"
        : undefined,
    });
  }),
);

export default router;
