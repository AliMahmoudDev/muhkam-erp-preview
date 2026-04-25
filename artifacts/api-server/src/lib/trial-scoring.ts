/**
 * trial-scoring.ts
 *
 * Computes an anti-abuse trust score (0–130) for trial companies.
 *
 * ── Score breakdown ──────────────────────────────────────────────────────────
 *   Base score:                                    100
 *   Deduction — IP seen in other trials:           -20
 *   Deduction — User-agent seen in other trials:   -20
 *   Bonus     — Email verified:                    +30
 *   ─────────────────────────────────────────────────
 *   Maximum possible:                              130
 *   Suspicious threshold:                          < 50
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   Called immediately after registration and by the hourly trial scheduler
 *   (to re-score when email_verified status changes or new signups arrive).
 *
 * ── Safety ───────────────────────────────────────────────────────────────────
 *   is_suspicious = true only marks for admin review — it does NOT block the
 *   company. Super admins can manually clear the flag.
 */

import { eq, ne, and, isNotNull } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { logger } from "./logger";

const SCORE_BASE              = 100;
const DEDUCT_IP               = 20;   // IP shared with another trial
const DEDUCT_UA               = 20;   // User-agent shared with another trial
const BONUS_EMAIL_VERIFIED    = 30;   // Email confirmed
const SUSPICIOUS_THRESHOLD    = 50;   // Score below this → is_suspicious

/**
 * Compute and persist the trial score for a single company.
 *
 * Returns the computed score so the caller can log or respond with it.
 * Never throws — errors are logged and the function returns null.
 */
export async function scoreTrialCompany(companyId: number): Promise<number | null> {
  try {
    const [company] = await db
      .select({
        id:                companiesTable.id,
        signup_ip:         companiesTable.signup_ip,
        signup_user_agent: companiesTable.signup_user_agent,
        email_verified:    companiesTable.email_verified,
      })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!company) return null;

    let score = SCORE_BASE;

    /* ── IP deduction ────────────────────────────────────────────────── */
    if (company.signup_ip) {
      const [ipConflict] = await db
        .select({ id: companiesTable.id })
        .from(companiesTable)
        .where(
          and(
            eq(companiesTable.signup_ip, company.signup_ip),
            eq(companiesTable.has_used_trial, true),
            ne(companiesTable.id, companyId),   // exclude this company
          )
        )
        .limit(1);

      if (ipConflict) {
        score -= DEDUCT_IP;
      }
    }

    /* ── User-agent deduction ────────────────────────────────────────── */
    if (company.signup_user_agent) {
      const [uaConflict] = await db
        .select({ id: companiesTable.id })
        .from(companiesTable)
        .where(
          and(
            eq(companiesTable.signup_user_agent, company.signup_user_agent),
            eq(companiesTable.has_used_trial, true),
            ne(companiesTable.id, companyId),
            isNotNull(companiesTable.signup_user_agent),
          )
        )
        .limit(1);

      if (uaConflict) {
        score -= DEDUCT_UA;
      }
    }

    /* ── Email verification bonus ────────────────────────────────────── */
    if (company.email_verified) {
      score += BONUS_EMAIL_VERIFIED;
    }

    /* ── Clamp to valid range and persist ────────────────────────────── */
    score = Math.max(0, Math.min(130, score));
    const isSuspicious = score < SUSPICIOUS_THRESHOLD;

    await db
      .update(companiesTable)
      .set({ trial_score: score, is_suspicious: isSuspicious })
      .where(eq(companiesTable.id, companyId));

    logger.info(
      { companyId, score, isSuspicious },
      "[trial-scoring] Score computed"
    );

    return score;
  } catch (err) {
    logger.error({ err, companyId }, "[trial-scoring] Failed to compute score — non-fatal");
    return null;
  }
}

/**
 * Re-score all trial companies in one batch pass.
 * Called by the trial scheduler to keep scores current as new signups arrive.
 */
export async function scoreAllTrialCompanies(): Promise<void> {
  try {
    const trials = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .where(eq(companiesTable.has_used_trial, true));

    for (const { id } of trials) {
      await scoreTrialCompany(id);
    }

    logger.info({ count: trials.length }, "[trial-scoring] Batch re-score complete");
  } catch (err) {
    logger.error({ err }, "[trial-scoring] Batch re-score failed");
  }
}
