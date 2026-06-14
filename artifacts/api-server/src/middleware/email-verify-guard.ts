/**
 * email-verify-guard.ts
 *
 * Hard-lock middleware for the email verification requirement.
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *  For unverified tenant companies:
 *    • GET requests → allowed (read-only access preserved)
 *    • POST / PUT / PATCH / DELETE → blocked with 403 EMAIL_NOT_VERIFIED
 *
 * ── What it does NOT do ──────────────────────────────────────────────────────
 *  • Does NOT block non-trial companies (email_verified = true or no trial)
 *  • Does NOT block GET requests under any circumstances
 *  • Does NOT block super admins (they never have a company_id)
 *  • Does NOT throw on DB errors — fails open to avoid mass lockouts
 *
 * ── Placement in middleware chain ─────────────────────────────────────────────
 *  Mounted AFTER tenantGuard in routes/index.ts so that an expired subscription
 *  is caught first (402) before the email check (403).
 *
 * ── Cache ─────────────────────────────────────────────────────────────────────
 *  Verification status is cached per company for 2 minutes to avoid a DB hit
 *  on every single request. The cache is invalidated on email verification
 *  (call invalidateEmailVerifyCache(companyId) from the verify endpoint).
 */

import type { Request, Response, NextFunction } from 'express';
import { db, companiesTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

interface CacheEntry {
  expiresAt: number;
  verificationStatus: string;
  emailVerified: boolean;
}

const cache = new Map<number, CacheEntry>();
const CACHE_MS = 2 * 60 * 1000; // 2 minutes

/** Call this after a company verifies their email to flush stale cache. */
export function invalidateEmailVerifyCache(companyId: number): void {
  cache.delete(companyId);
}

async function getVerificationStatus(
  companyId: number
): Promise<{ emailVerified: boolean; verificationStatus: string }> {
  const now = Date.now();
  const cached = cache.get(companyId);
  if (cached && cached.expiresAt > now) {
    return { emailVerified: cached.emailVerified, verificationStatus: cached.verificationStatus };
  }

  const [company] = await db
    .select({
      email_verified: companiesTable.email_verified,
      verification_status: companiesTable.verification_status,
      has_used_trial: companiesTable.has_used_trial,
    })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  const result = {
    emailVerified: company?.email_verified ?? true, // safe default: assume verified if not found
    verificationStatus: company?.verification_status ?? 'verified',
  };

  cache.set(companyId, { expiresAt: now + CACHE_MS, ...result });
  return result;
}

export async function emailVerifyGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  /* Read-only requests are always allowed */
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  /* Only applies to authenticated tenant users */
  const user = req.user;
  if (!user || !user.company_id) {
    next();
    return;
  }

  /* Super admins bypass all checks */
  if (user.role === 'super_admin') {
    next();
    return;
  }

  try {
    const { emailVerified } = await getVerificationStatus(user.company_id);

    if (!emailVerified) {
      logger.warn(
        { companyId: user.company_id, method: req.method, url: req.url },
        '[EmailVerifyGuard] Write blocked — email not verified'
      );

      res.status(403).json({
        error: 'يجب التحقق من البريد الإلكتروني قبل إجراء أي تعديلات',
        code: 'EMAIL_NOT_VERIFIED',
        hint: 'POST /api/auth/resend-verification to get a new link',
      });
      return;
    }

    next();
  } catch (err) {
    /* Fail open: log the error but don't block the user on a DB hiccup */
    logger.error(
      { err, companyId: user.company_id },
      '[EmailVerifyGuard] Error checking verification — failing open'
    );
    next();
  }
}
