/**
 * trial-scheduler.ts
 *
 * Background job that runs every hour and manages trial account lifecycle:
 *
 *  1. EMAIL VERIFICATION REMINDERS
 *     Finds unverified trial companies and logs/sends staged reminders:
 *       > 10 min  → initial reminder  ("Please verify your email")
 *       > 24 h    → urgent warning    ("Last chance — 24 h remaining")
 *       > 48 h    → mark verification_status = 'expired'
 *                   (write-lock applied via email-verify-guard middleware)
 *
 *  2. CONVERSION TRIGGERS
 *     Finds active verified trial companies and logs conversion nudges:
 *       Day 2–3 → "Try the stock transfer feature"
 *       Day 5–6 → "Your trial ends soon — upgrade now"
 *       After expiry → already handled by tenantGuard (read-only mode)
 *
 *  3. BATCH RE-SCORING
 *     Re-computes trial_score for every trial company so scores stay current
 *     as new signups arrive and share the same IP / user-agent.
 *
 * ── Design notes ────────────────────────────────────────────────────────────
 *  - Uses the same setInterval pattern as backup-scheduler.ts.
 *  - All actions are logged via Pino. When an email provider is integrated,
 *    replace the logger.info calls with actual email sends.
 *  - "Fail open" on individual errors: one bad company never skips the rest.
 *  - Reminders are idempotent: the log is the only side-effect until the
 *    48-hour mark, which writes to the DB once and is then a no-op.
 */

import { and, eq, not } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { logger } from "./logger";
import { scoreAllTrialCompanies } from "./trial-scoring";
import { sendTelegramAlert } from "./telegram";

const TICK_MS = 60 * 60 * 1000; // every hour

/* Age thresholds */
const REMINDER_AFTER_MS  =       10 * 60 * 1000;  // 10 minutes
const WARNING_AFTER_MS   =  24 * 60 * 60 * 1000;  // 24 hours
const EXPIRE_AFTER_MS    =  48 * 60 * 60 * 1000;  // 48 hours

/* Trial day thresholds for conversion triggers */
const CONV_EARLY_START   = 2;   // Day 2
const CONV_EARLY_END     = 3;   // Day 3
const CONV_LATE_START    = 5;   // Day 5
const CONV_LATE_END      = 6;   // Day 6

/* ─── Email verification lifecycle ──────────────────────────────────────── */

async function processVerificationReminders(): Promise<void> {
  const now = new Date();

  /* Fetch all unverified trial companies — we handle all age tiers in one query */
  const unverified = await db
    .select({
      id:                            companiesTable.id,
      name:                          companiesTable.name,
      admin_email:                   companiesTable.admin_email,
      created_at:                    companiesTable.created_at,
      email_verification_expires_at: companiesTable.email_verification_expires_at,
      verification_status:           companiesTable.verification_status,
    })
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.email_verified,   false),
        eq(companiesTable.has_used_trial,   true),
        not(eq(companiesTable.verification_status, "expired")), // already expired → skip
      )
    );

  for (const company of unverified) {
    try {
      const ageMs = now.getTime() - new Date(company.created_at).getTime();

      if (ageMs >= EXPIRE_AFTER_MS) {
        /* ── 48+ hours: mark verification_status = 'expired' ── */
        await db
          .update(companiesTable)
          .set({ verification_status: "expired" })
          .where(eq(companiesTable.id, company.id));

        logger.warn(
          { companyId: company.id, email: company.admin_email },
          "[trial-scheduler] Email verification expired — write-lock will be enforced"
        );

        /* TODO: replace with actual email send when email provider is configured */
        logger.info(
          { companyId: company.id, name: company.name },
          "[trial-scheduler] [EXPIRED] email not verified after 48h — write-lock enforced"
        );

      } else if (ageMs >= WARNING_AFTER_MS) {
        /* ── 24–48 hours: urgent warning ── */
        logger.warn(
          { companyId: company.id, email: company.admin_email, ageHours: Math.round(ageMs / 3_600_000) },
          "[trial-scheduler] Email verification: LAST CHANCE warning"
        );

        /* TODO: replace with email send */
        logger.warn(
          { companyId: company.id, email: company.admin_email, name: company.name },
          "[trial-scheduler] [LAST CHANCE] email verification warning sent"
        );

      } else if (ageMs >= REMINDER_AFTER_MS) {
        /* ── 10 min – 24 hours: initial reminder ── */
        logger.info(
          { companyId: company.id, email: company.admin_email },
          "[trial-scheduler] Email verification: sending reminder"
        );

        /* TODO: replace with email send */
        logger.info(
          { companyId: company.id, email: company.admin_email },
          "[trial-scheduler] [REMINDER] email verification reminder sent"
        );
      }
    } catch (err) {
      /* Fail open: log and continue to next company */
      logger.error({ err, companyId: company.id }, "[trial-scheduler] Error processing verification reminder");
    }
  }
}

/* ─── Conversion triggers ────────────────────────────────────────────────── */

async function processConversionTriggers(): Promise<void> {
  const now = new Date();

  /* Active, verified trial companies still within their trial window */
  const trialCompanies = await db
    .select({
      id:           companiesTable.id,
      name:         companiesTable.name,
      admin_email:  companiesTable.admin_email,
      start_date:   companiesTable.start_date,
      end_date:     companiesTable.end_date,
      email_verified: companiesTable.email_verified,
    })
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.plan_type, "trial"),
        eq(companiesTable.is_active, true),
        eq(companiesTable.has_used_trial, true),
      )
    );

  for (const company of trialCompanies) {
    try {
      const startDate  = new Date(company.start_date);
      const endDate    = new Date(company.end_date);
      const dayElapsed = Math.floor((now.getTime() - startDate.getTime()) / 86_400_000) + 1; // 1-indexed
      const daysLeft   = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);

      if (dayElapsed >= CONV_EARLY_START && dayElapsed <= CONV_EARLY_END) {
        /* Day 2–3: feature nudge */
        logger.info(
          { companyId: company.id, dayElapsed },
          "[trial-scheduler] Conversion trigger: early feature nudge"
        );
        /* TODO: replace with email/in-app notification */
        logger.info(
          { companyId: company.id, email: company.admin_email, dayElapsed },
          "[trial-scheduler] [CONVERSION] early feature nudge notification"
        );

      } else if (dayElapsed >= CONV_LATE_START && dayElapsed <= CONV_LATE_END) {
        /* Day 5–6: expiry warning */
        logger.warn(
          { companyId: company.id, dayElapsed, daysLeft },
          "[trial-scheduler] Conversion trigger: trial ending soon"
        );
        /* TODO: replace with email/in-app notification */
        logger.warn(
          { companyId: company.id, email: company.admin_email, dayElapsed, daysLeft },
          "[trial-scheduler] [EXPIRY] trial ending soon notification"
        );
      }

      /* Alert 5 — Telegram: اشتراك على وشك الانتهاء (3 أيام أو أقل) */
      if (daysLeft >= 0 && daysLeft <= 3) {
        void sendTelegramAlert(
          `⚠️ *اشتراك على وشك الانتهاء*\nالشركة: ${company.name}\nتاريخ الانتهاء: ${new Date(company.end_date).toLocaleDateString("ar-EG")}\nالأيام المتبقية: ${daysLeft}`
        );
      }
    } catch (err) {
      logger.error({ err, companyId: company.id }, "[trial-scheduler] Error processing conversion trigger");
    }
  }
}

/* ─── Main tick ──────────────────────────────────────────────────────────── */

async function tick(): Promise<void> {
  logger.info("[trial-scheduler] Tick started");

  try {
    await processVerificationReminders();
  } catch (err) {
    logger.error({ err }, "[trial-scheduler] processVerificationReminders failed");
  }

  try {
    await processConversionTriggers();
  } catch (err) {
    logger.error({ err }, "[trial-scheduler] processConversionTriggers failed");
  }

  try {
    await scoreAllTrialCompanies();
  } catch (err) {
    logger.error({ err }, "[trial-scheduler] scoreAllTrialCompanies failed");
  }

  logger.info("[trial-scheduler] Tick complete");
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

let interval: ReturnType<typeof setInterval> | null = null;

export function startTrialScheduler(): void {
  if (interval) return; // already started

  interval = setInterval(() => { void tick(); }, TICK_MS);

  /* Run once shortly after startup to catch any overdue accounts */
  setTimeout(() => { void tick(); }, 30_000);

  logger.info("[trial-scheduler] Started (hourly tick)");
}

export function stopTrialScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
