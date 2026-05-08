/**
 * Registration and email-verification routes:
 *   POST /auth/register
 *   GET  /auth/verify-email
 *   POST /auth/resend-verification
 */
import { Router } from 'express';
import { wrap } from '../../lib/async-handler';
import { eq } from 'drizzle-orm';
import { db, erpUsersTable, companiesTable } from '@workspace/db';
import { logger } from '../../lib/logger';
import {
  checkTrialEligibility,
  extractClientIP,
  recordTrialSignup,
  generateVerificationToken,
  buildVerificationLink,
  logVerificationLink,
} from '../../lib/trial-guard';
import { computeDeviceFingerprint } from '../../lib/trial-fingerprint';
import { ipRegistrationLimiter, checkAndRecordFPLimit } from '../../lib/registration-limiter';
import { scoreTrialCompany } from '../../lib/trial-scoring';
import { invalidateEmailVerifyCache } from '../../middleware/email-verify-guard';
import { authenticate, signToken, signRefreshToken } from '../../middleware/auth';
import { storeRefreshToken } from '../../lib/refresh-token-store';
import { hashPin } from '../../lib/hash';
import { alertManager, ALERT_TYPES } from '../../lib/telegram-alert-manager';
import {
  setAuthCookies,
  validatePasswordStrength,
} from './_shared';

const router = Router();

/* ── POST /auth/register — SaaS: register new company + first admin ─ */
router.post('/auth/register', ipRegistrationLimiter, wrap(async (req, res) => {
  try {
    const { company_name, admin_name, email, password } = req.body as {
      company_name?: string;
      admin_name?: string;
      email?: string;
      password?: string;
    };

    if (!company_name?.trim()) {
      res.status(400).json({ error: 'اسم الشركة مطلوب' });
      return;
    }
    if (!admin_name?.trim()) {
      res.status(400).json({ error: 'اسم المسؤول مطلوب' });
      return;
    }
    if (!email?.trim() || !email.includes('@')) {
      res.status(400).json({ error: 'بريد إلكتروني صحيح مطلوب' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'كلمة المرور مطلوبة' });
      return;
    }
    const pwError = validatePasswordStrength(password);
    if (pwError) {
      res.status(400).json({ error: pwError });
      return;
    }

    const normalEmail = email.toLowerCase().trim();

    const clientIP    = extractClientIP(req);
    const userAgent   = req.headers['user-agent'];
    const fingerprint = computeDeviceFingerprint(req);

    let fpLimit = { blocked: false, remaining: 3, resetMs: 0 };
    try { fpLimit = await checkAndRecordFPLimit(fingerprint); } catch {
      logger.warn({ fingerprint }, '[register] Redis unavailable — skipping FP rate limit (fail-open)');
    }
    if (fpLimit.blocked) {
      const retryAfter = Math.ceil((fpLimit.resetMs - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'تجاوزت الحد المسموح به من هذا الجهاز — يرجى الانتظار قبل المحاولة مرة أخرى',
        code:  'REGISTRATION_FP_RATE_LIMITED',
        retry_after_seconds: retryAfter,
      });
      return;
    }

    const [existingUser] = await db
      .select({ id: erpUsersTable.id })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.email, normalEmail));
    if (existingUser) {
      res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
      return;
    }

    let trialCheck;
    try {
      trialCheck = await checkTrialEligibility(normalEmail, clientIP, userAgent, fingerprint);
    } catch (err) {
      logger.error({ err, email: normalEmail, ip: clientIP }, '[register] Trial check DB error — blocking registration (fail-closed)');
      res.status(503).json({
        error: 'خدمة التحقق غير متاحة مؤقتاً — يرجى المحاولة بعد دقيقة',
        code:  'TRIAL_CHECK_UNAVAILABLE',
      });
      return;
    }

    if (!trialCheck.allowed) {
      const statusCode = trialCheck.blocked_by === 'email' ? 409 : 429;
      const messages: Record<string, string> = {
        email:      'هذا البريد الإلكتروني استُخدم بالفعل في فترة تجريبية — تواصل معنا للمساعدة',
        ip_public:  'تم الوصول إلى الحد الأقصى للحسابات التجريبية من هذا الاتصال — تواصل مع الدعم',
        ip_private: 'تم الوصول إلى الحد الأقصى للحسابات التجريبية من هذه الشبكة — تواصل مع الدعم',
        ua_ip:      'تم رصد نشاط غير معتاد من هذا الجهاز — تواصل مع الدعم',
      };
      const code: Record<string, string> = {
        email:      'TRIAL_EMAIL_USED',
        ip_public:  'TRIAL_IP_LIMIT',
        ip_private: 'TRIAL_NETWORK_LIMIT',
        ua_ip:      'TRIAL_DEVICE_LIMIT',
      };
      res.status(statusCode).json({
        error: messages[trialCheck.blocked_by ?? ''] ?? 'التسجيل غير متاح — تواصل مع الدعم',
        code:  code[trialCheck.blocked_by ?? ''] ?? 'TRIAL_BLOCKED',
      });
      return;
    }

    const verificationToken   = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const today    = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const baseUsername =
      normalEmail
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '') || 'admin';
    const hashedPw = await hashPin(password);

    const { company, user } = await db.transaction(async (tx) => {
      const [newCompany] = await tx
        .insert(companiesTable)
        .values({
          name:        company_name.trim(),
          plan_type:   'trial',
          start_date:  today.toISOString().slice(0, 10),
          end_date:    trialEnd.toISOString().slice(0, 10),
          is_active:   true,
          admin_email: normalEmail,
        })
        .returning();

      const username = `${baseUsername}_${newCompany.id}`;

      const [newUser] = await tx
        .insert(erpUsersTable)
        .values({
          name:        admin_name.trim(),
          username,
          email:       normalEmail,
          pin:         hashedPw,
          role:        'admin',
          active:      true,
          company_id:  newCompany.id,
          permissions: '{}',
        })
        .returning();

      return { company: newCompany, user: newUser };
    });

    db.update(companiesTable)
      .set({
        signup_ip:                     clientIP,
        signup_user_agent:             userAgent ?? null,
        has_used_trial:                true,
        email_verified:                false,
        email_verification_token:      verificationToken,
        email_verification_expires_at: verificationExpires,
        verification_status:           'pending',
      })
      .where(eq(companiesTable.id, company.id))
      .catch((err: unknown) => {
        logger.warn({ err, companyId: company.id }, '[register] Failed to set anti-abuse fields — schema migration may be pending');
      });

    void recordTrialSignup({
      email:       normalEmail,
      ip:          clientIP,
      user_agent:  userAgent,
      fingerprint: fingerprint,
      company_id:  company.id,
    });

    void scoreTrialCompany(company.id);

    void alertManager.send({
      type:          ALERT_TYPES.NEW_COMPANY,
      message:       `🎉 *شركة جديدة*\nالاسم: ${company.name}\nالخطة: ${company.plan_type}\nالوقت: ${new Date().toLocaleString("ar-EG")}`,
      cooldownHours: 0,
    });

    const verifyLink = buildVerificationLink(verificationToken);
    logVerificationLink(normalEmail, verifyLink);

    const token        = signToken(user.id, user.role, user.company_id ?? null);
    const refreshToken = signRefreshToken(user.id);
    void storeRefreshToken(refreshToken, user.id);

    setAuthCookies(res, token, refreshToken);

    res.status(201).json({
      user: {
        id:           user.id,
        name:         user.name,
        username:     user.username,
        role:         user.role,
        permissions:  {},
        active:       true,
        warehouse_id: null,
        safe_id:      null,
      },
      company: {
        id:            company.id,
        name:          company.name,
        plan_type:     company.plan_type,
        end_date:      company.end_date,
        daysRemaining: 7,
        email_verified: false,
      },
      verify_email_notice: 'أُرسل رابط التحقق إلى بريدك الإلكتروني — يرجى التحقق خلال 48 ساعة',
    });
  } catch (err) {
    logger.error({ err }, '[register] Unexpected error during account creation');
    res.status(500).json({ error: 'فشل إنشاء الحساب — حاول مجدداً' });
  }
}));

/* ── GET /auth/verify-email — confirm email via token ─── */
router.get('/auth/verify-email', wrap(async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token || typeof token !== 'string' || token.length < 10) {
      res.status(400).send('<h2>رابط التحقق غير صالح</h2>');
      return;
    }

    const [company] = await db
      .select({
        id:                            companiesTable.id,
        email_verified:                companiesTable.email_verified,
        email_verification_expires_at: companiesTable.email_verification_expires_at,
      })
      .from(companiesTable)
      .where(eq(companiesTable.email_verification_token, token))
      .limit(1);

    if (!company) {
      res.status(404).send('<h2>رابط التحقق غير موجود أو انتهت صلاحيته</h2>');
      return;
    }

    if (company.email_verified) {
      res.send('<h2>✅ البريد الإلكتروني مُفعَّل بالفعل</h2>');
      return;
    }

    if (
      company.email_verification_expires_at &&
      new Date() > company.email_verification_expires_at
    ) {
      res.status(410).send(
        '<h2>انتهت صلاحية رابط التحقق — يرجى التواصل مع الدعم لإعادة الإرسال</h2>'
      );
      return;
    }

    await db
      .update(companiesTable)
      .set({
        email_verified:                true,
        verification_status:           'verified',
        email_verification_token:      null,
        email_verification_expires_at: null,
      })
      .where(eq(companiesTable.id, company.id));

    invalidateEmailVerifyCache(company.id);

    void scoreTrialCompany(company.id);

    res.send(
      '<h2>✅ تم التحقق من البريد الإلكتروني بنجاح — يمكنك إغلاق هذه الصفحة والعودة للنظام</h2>'
    );
  } catch {
    res.status(500).send('<h2>خطأ في التحقق — حاول مجدداً أو تواصل مع الدعم</h2>');
  }
}));

/* ── POST /auth/resend-verification — resend verification email ─── */
router.post('/auth/resend-verification', authenticate, wrap(async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      res.status(400).json({ error: 'لا يوجد حساب شركة مرتبط' });
      return;
    }

    const [company] = await db
      .select({
        id:             companiesTable.id,
        admin_email:    companiesTable.admin_email,
        email_verified: companiesTable.email_verified,
      })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);

    if (!company) {
      res.status(404).json({ error: 'الشركة غير موجودة' });
      return;
    }
    if (company.email_verified) {
      res.status(400).json({ error: 'البريد الإلكتروني مُفعَّل بالفعل' });
      return;
    }

    const newToken   = generateVerificationToken();
    const newExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await db
      .update(companiesTable)
      .set({
        email_verification_token:      newToken,
        email_verification_expires_at: newExpires,
      })
      .where(eq(companiesTable.id, companyId));

    const verifyLink = buildVerificationLink(newToken);
    logVerificationLink(company.admin_email ?? 'unknown', verifyLink);

    res.json({ success: true, message: 'تم إعادة إرسال رابط التحقق' });
  } catch {
    res.status(500).json({ error: 'فشل إعادة الإرسال' });
  }
}));

export default router;
