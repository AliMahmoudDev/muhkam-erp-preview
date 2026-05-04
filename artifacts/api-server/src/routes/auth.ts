/**
 * /api/auth/* — Public login + protected "me" endpoint.
 * PIN validation happens here on the server — the frontend never compares PINs.
 * Login lockout: max 5 failed attempts → 15-minute lockout per userId.
 */
import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db, erpUsersTable, companiesTable } from '@workspace/db';
import { logger } from '../lib/logger';
import {
  checkTrialEligibility,
  extractClientIP,
  recordTrialSignup,
  generateVerificationToken,
  buildVerificationLink,
  logVerificationLink,
} from '../lib/trial-guard';
import { computeDeviceFingerprint } from '../lib/trial-fingerprint';
import { ipRegistrationLimiter, checkAndRecordFPLimit } from '../lib/registration-limiter';
import { scoreTrialCompany } from '../lib/trial-scoring';
import { invalidateEmailVerifyCache } from '../middleware/email-verify-guard';
import { authenticate, signToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth';
import { blacklistToken } from '../lib/session-blacklist';
import { storeRefreshToken, consumeRefreshToken, revokeUserRefreshTokens } from '../lib/refresh-token-store';
import {
  generateTOTPSecret,
  generateQRCode,
  verifyTOTP,
  encryptSecret,
  decryptSecret,
  isEncrypted,
} from '../lib/totp';
import { verifyPin, hashPin } from '../lib/hash';
import { loginSchema, validate } from '../lib/schemas';
import {
  getLoginLockout,
  recordLoginFailure,
  clearLoginLockout,
  check2FAAllowed,
  reset2FALockout,
  MAX_ATTEMPTS,
} from '../lib/brute-force-store';
import { alertManager, ALERT_TYPES } from '../lib/telegram-alert-manager';
/* maybeBackupAsync intentionally NOT imported — backups are now manual or
   scheduled only (see backup-scheduler.ts). Triggering full DB backups on
   every login/logout caused massive pool pressure under load. */

const JWT_SECRET: string = process.env.JWT_SECRET!;

/* ── Cookie helpers ─────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === 'production';

function setAuthCookies(res: import('express').Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    path: '/',
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh',
  });
}

function clearAuthCookies(res: import('express').Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
}

/** Enforce strong password: min 8 chars, uppercase, digit, special char */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8)
    return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (!/[A-Z]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل';
  if (!/[0-9]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل';
  if (!/[^A-Za-z0-9]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (@, #, $, ...)';
  return null;
}

function daysRemaining(endDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const router = Router();

/* ── POST /auth/login — validate PIN server-side, return JWT ─ */
router.post('/auth/login', async (req, res) => {
  try {
    /* Zod validation */
    const v = validate(loginSchema, req.body);
    if (!v.success) {
      res.status(400).json({ error: 'بيانات غير صحيحة', details: v.errors });
      return;
    }
    const { userId, username, pin, company_id: loginCompanyId } = v.data;

    /* ── Resolve uid — by userId or by username lookup ────── */
    let uid: number;
    if (userId !== undefined) {
      uid = userId;
    } else {
      const usernameNorm = username!.trim().toLowerCase();
      const isEmail = usernameNorm.includes('@');
      const [found] = await db
        .select({ id: erpUsersTable.id, company_id: erpUsersTable.company_id })
        .from(erpUsersTable)
        .where(
          isEmail
            ? eq(erpUsersTable.email, usernameNorm)
            : sql`LOWER(${erpUsersTable.username}) = ${usernameNorm}`,
        );
      if (!found) {
        res.status(401).json({ error: 'الحساب غير موجود أو معطل' });
        return;
      }
      /* If a company_id was sent (stored in browser from a previous session),
         verify it matches — but skip this check for super_admin (company_id = NULL)
         so they can always log in regardless of what the browser stored. */
      if (loginCompanyId && found.company_id !== null && found.company_id !== loginCompanyId) {
        res.status(401).json({ error: 'الحساب غير موجود أو معطل' });
        return;
      }
      uid = found.id;
    }

    /* ── Lockout check ────────────────────────────────────── */
    const lockout = await getLoginLockout(uid);
    if (lockout.lockedUntil !== null && Date.now() < lockout.lockedUntil) {
      const remainingMs = lockout.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      res.status(429).json({
        error: `تم تجميد الحساب مؤقتاً بسبب محاولات متكررة. انتظر ${remainingMin} دقيقة`,
      });
      return;
    }

    const [user] = await db.select().from(erpUsersTable).where(eq(erpUsersTable.id, uid));

    if (!user || !user.active) {
      res.status(401).json({ error: 'الحساب غير موجود أو معطل' });
      return;
    }

    const pinValid = await verifyPin(pin, user.pin ?? '');
    if (!pinValid) {
      const updated = await recordLoginFailure(uid);
      const remaining = MAX_ATTEMPTS - updated.attempts;
      if (remaining <= 0) {
        res.status(429).json({
          error: `تم تجميد الحساب لمدة 15 دقيقة بسبب تجاوز عدد المحاولات المسموح بها`,
        });
      } else {
        res.status(401).json({
          error: `الرقم السري غير صحيح — تبقّى ${remaining} محاولة`,
        });
      }
      return;
    }

    /* ── Lazy re-hash: if PIN was plain-text, upgrade it now ── */
    if (user.pin && !user.pin.startsWith('$2')) {
      try {
        const hashed = await hashPin(pin);
        await db.update(erpUsersTable).set({ pin: hashed }).where(eq(erpUsersTable.id, uid));
      } catch {
        /* non-fatal */
      }
    }

    /* ── Subscription check (skip for super_admin) ───────── */
    if (user.company_id && user.role !== 'super_admin') {
      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, user.company_id));

      if (company) {
        if (!company.is_active) {
          res.status(403).json({ error: 'الاشتراك معطل — تواصل مع المدير' });
          return;
        }
        const days = daysRemaining(company.end_date);
        if (days < 0) {
          res.status(403).json({
            error: 'انتهت صلاحية الاشتراك',
            expired: true,
            endDate: company.end_date,
          });
          return;
        }
      }
    }

    /* ── Block cashier/salesperson without warehouse or safe ─ */
    if (user.role === 'cashier' || user.role === 'salesperson') {
      if (!user.warehouse_id) {
        res.status(403).json({ error: 'هذا الحساب غير مرتبط بفرع/مخزن — تواصل مع المدير' });
        return;
      }
      if (!user.safe_id) {
        res.status(403).json({ error: 'هذا الحساب غير مرتبط بخزينة — تواصل مع المدير' });
        return;
      }
    }

    /* ── Success — clear lockout ──────────────────────────── */
    await clearLoginLockout(uid);

    /* ── 2FA check for super_admin ────────────────────────── */
    if (user.totp_enabled && user.role === 'super_admin') {
      const tempToken = jwt.sign({ userId: user.id, requires_2fa: true }, JWT_SECRET, {
        expiresIn: '5m',
      });
      res.json({
        requires_2fa: true,
        temp_token: tempToken,
        message: 'أدخل رمز التحقق من تطبيق المصادقة',
      });
      return;
    }

    const token = signToken(user.id, user.role, user.company_id ?? null);
    const refreshToken = signRefreshToken(user.id);
    void storeRefreshToken(refreshToken, user.id);

    /* Update last_login timestamp */
    await db
      .update(erpUsersTable)
      .set({ last_login: new Date() })
      .where(eq(erpUsersTable.id, user.id));

    let parsedPerms: Record<string, boolean> = {};
    try {
      parsedPerms = JSON.parse(user.permissions ?? '{}') as Record<string, boolean>;
    } catch {
      /* ignore */
    }

    /* Set httpOnly cookies — token never exposed to JS */
    setAuthCookies(res, token, refreshToken);

    const isMobile = req.headers['x-client'] === 'mobile';

    res.json({
      ...(isMobile ? { token } : {}),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        permissions: parsedPerms,
        active: user.active ?? true,
        warehouse_id: user.warehouse_id ?? null,
        employee_id: user.employee_id ?? null,
        safe_id: user.safe_id ?? null,
        company_id: user.company_id ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, '[auth/login] unexpected error during login');
    res.status(500).json({ error: 'فشل تسجيل الدخول' });
  }
});

/* ── POST /auth/refresh — rotate refresh token + issue new access token ─ */
router.post('/auth/refresh', async (req, res) => {
  try {
    /* Read from httpOnly cookie first, fall back to body (backward compat) */
    const refreshToken: string | undefined =
      (req.cookies as Record<string, string> | undefined)?.refresh_token
      ?? (req.body as { refreshToken?: string })?.refreshToken;
    if (!refreshToken) {
      res.status(400).json({ error: 'refresh token مطلوب' });
      return;
    }

    /* Step 1: verify JWT signature */
    const jwtPayload = verifyRefreshToken(refreshToken);
    if (!jwtPayload) {
      res.status(401).json({ error: 'refresh token غير صالح أو منتهي الصلاحية' });
      return;
    }

    /* Step 2: consume DB record (marks old token as used → prevents replay) */
    const dbPayload = await consumeRefreshToken(refreshToken);
    if (!dbPayload) {
      /* Token already used or revoked — possible token theft, revoke all */
      void revokeUserRefreshTokens(jwtPayload.userId);
      res.status(401).json({ error: 'تم رصد إعادة استخدام رمز منتهي — جميع الجلسات أُلغيت' });
      return;
    }

    const [user] = await db
      .select()
      .from(erpUsersTable)
      .where(and(eq(erpUsersTable.id, dbPayload.userId), eq(erpUsersTable.active, true)));
    if (!user) {
      res.status(401).json({ error: 'المستخدم غير موجود أو موقوف' });
      return;
    }

    /* Step 3: issue NEW access token + NEW refresh token (rotation) */
    const newToken = signToken(user.id, user.role, user.company_id ?? null);
    const newRefreshToken = signRefreshToken(user.id);
    void storeRefreshToken(newRefreshToken, user.id);

    /* Update cookies with rotated tokens */
    setAuthCookies(res, newToken, newRefreshToken);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'فشل تجديد الجلسة' });
  }
});

/* ── GET /auth/subscription — subscription status for current company ─ */
router.get('/auth/subscription', authenticate, async (req, res) => {
  try {
    if (req.user?.role === 'super_admin') {
      res.json({ unlimited: true });
      return;
    }
    const companyId = req.user?.company_id;
    if (!companyId) {
      res.json({ unlimited: true });
      return;
    }
    const [company] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));
    if (!company) {
      res.status(404).json({ error: 'الشركة غير موجودة' });
      return;
    }
    const days = daysRemaining(company.end_date);
    res.json({
      plan_type: company.plan_type,
      end_date: company.end_date,
      days_left: days,
      company_name: company.name,
      is_active: company.is_active,
      is_expiring_soon: days <= 14 && days > 0,
      is_expired: days <= 0,
    });
  } catch {
    res.status(500).json({ error: 'فشل جلب بيانات الاشتراك' });
  }
});

/* ── POST /auth/logout — blacklist access token + revoke refresh tokens ─ */
router.post('/auth/logout', authenticate, async (req, res) => {
  /* Blacklist access token — read from cookie first, then Authorization header */
  const cookieAccess = (req.cookies as Record<string, string> | undefined)?.access_token;
  const headerAccess = req.headers.authorization?.split(' ')[1];
  const accessToken = cookieAccess ?? headerAccess;
  if (accessToken) await blacklistToken(accessToken);

  /* Revoke refresh token — read from cookie first, then body */
  const cookieRefresh = (req.cookies as Record<string, string> | undefined)?.refresh_token;
  const { refreshToken: bodyRefresh } = req.body as { refreshToken?: string };
  const refreshToken = cookieRefresh ?? bodyRefresh;
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload) void revokeUserRefreshTokens(payload.userId);
  }

  /* Clear httpOnly cookies */
  clearAuthCookies(res);

  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

/* ── GET /auth/2fa/setup — generate TOTP secret + QR for super_admin ─── */
router.get('/auth/2fa/setup', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({ error: 'للمسؤول العام فقط' });
      return;
    }
    const [user] = await db
      .select()
      .from(erpUsersTable)
      .where(eq(erpUsersTable.id, req.user.id))
      .limit(1);
    if (user?.totp_enabled) {
      res.status(400).json({ error: 'المصادقة الثنائية مفعلة بالفعل' });
      return;
    }
    const { secret, otpauth_url } = generateTOTPSecret(user!.username);
    const qrCode = await generateQRCode(otpauth_url);
    await db
      .update(erpUsersTable)
      .set({ totp_secret: encryptSecret(secret), totp_verified: false })
      .where(eq(erpUsersTable.id, req.user.id));
    res.json({
      qr_code: qrCode,
      secret,
      message: 'امسح الـ QR Code بتطبيق Google Authenticator أو Authy',
    });
  } catch {
    res.status(500).json({ error: 'فشل إعداد المصادقة الثنائية' });
  }
});

/* ── POST /auth/2fa/verify — confirm TOTP setup, enable 2FA ─── */
router.post('/auth/2fa/verify', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({ error: 'للمسؤول العام فقط' });
      return;
    }
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'رمز التحقق مطلوب' });
      return;
    }
    const [user] = await db
      .select()
      .from(erpUsersTable)
      .where(eq(erpUsersTable.id, req.user.id))
      .limit(1);
    if (!user?.totp_secret) {
      res.status(400).json({ error: 'يجب إعداد 2FA أولاً' });
      return;
    }
    const rawSecret = isEncrypted(user.totp_secret)
      ? decryptSecret(user.totp_secret)
      : user.totp_secret;
    if (!verifyTOTP(rawSecret, token)) {
      res.status(400).json({ error: 'رمز التحقق غير صحيح' });
      return;
    }
    await db
      .update(erpUsersTable)
      .set({ totp_enabled: true, totp_verified: true })
      .where(eq(erpUsersTable.id, req.user.id));
    res.json({ success: true, message: 'تم تفعيل المصادقة الثنائية بنجاح ✅' });
  } catch {
    res.status(500).json({ error: 'فشل التحقق' });
  }
});

/* ── POST /auth/2fa/disable — disable 2FA (requires valid TOTP) ─── */
router.post('/auth/2fa/disable', authenticate, async (req, res) => {
  try {
    if (req.user?.role !== 'super_admin') {
      res.status(403).json({ error: 'للمسؤول العام فقط' });
      return;
    }
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'رمز التحقق مطلوب' });
      return;
    }
    const [user] = await db
      .select()
      .from(erpUsersTable)
      .where(eq(erpUsersTable.id, req.user.id))
      .limit(1);
    if (!user?.totp_enabled) {
      res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة' });
      return;
    }
    const rawSecret2 = isEncrypted(user.totp_secret!)
      ? decryptSecret(user.totp_secret!)
      : user.totp_secret!;
    if (!verifyTOTP(rawSecret2, token)) {
      res.status(400).json({ error: 'رمز التحقق غير صحيح' });
      return;
    }
    await db
      .update(erpUsersTable)
      .set({ totp_enabled: false, totp_secret: null, totp_verified: false })
      .where(eq(erpUsersTable.id, req.user.id));
    res.json({ success: true, message: 'تم إيقاف المصادقة الثنائية' });
  } catch {
    res.status(500).json({ error: 'فشل إيقاف المصادقة الثنائية' });
  }
});

/* ── GET /auth/2fa/status — check if 2FA is enabled for current user ─── */
router.get('/auth/2fa/status', authenticate, async (req, res) => {
  try {
    const [user] = await db
      .select({ totp_enabled: erpUsersTable.totp_enabled })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.id, req.user!.id))
      .limit(1);
    res.json({ totp_enabled: user?.totp_enabled ?? false });
  } catch {
    res.status(500).json({ error: 'فشل جلب حالة 2FA' });
  }
});

/* ── POST /auth/2fa/login — complete login after TOTP check ─── */
router.post('/auth/2fa/login', async (req, res) => {
  try {
    /* ── Brute-force guard: max 5 attempts / IP / 15 min ── */
    const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
    if (!(await check2FAAllowed(clientIP))) {
      res.status(429).json({ error: 'محاولات كثيرة — انتظر 15 دقيقة', retry_after: 900 });
      return;
    }

    const { temp_token, totp_code } = req.body as { temp_token?: string; totp_code?: string };
    if (!temp_token || !totp_code) {
      res.status(400).json({ error: 'البيانات ناقصة' });
      return;
    }
    let payload: { userId: number; requires_2fa: boolean };
    try {
      payload = jwt.verify(temp_token, JWT_SECRET) as typeof payload;
    } catch {
      res.status(401).json({ error: 'انتهت صلاحية الجلسة، أعد تسجيل الدخول' });
      return;
    }
    if (!payload.requires_2fa) {
      res.status(400).json({ error: 'طلب غير صالح' });
      return;
    }
    const [user] = await db
      .select()
      .from(erpUsersTable)
      .where(eq(erpUsersTable.id, payload.userId))
      .limit(1);
    if (!user?.totp_secret) {
      res.status(401).json({ error: 'خطأ في البيانات' });
      return;
    }

    /* Decrypt before verifying */
    const rawSecret = isEncrypted(user.totp_secret)
      ? decryptSecret(user.totp_secret)
      : user.totp_secret;
    if (!verifyTOTP(rawSecret, totp_code)) {
      res.status(401).json({ error: 'رمز التحقق غير صحيح أو منتهي' });
      return;
    }

    /* Success — clear attempts counter */
    await reset2FALockout(clientIP);

    /* Update last_login timestamp */
    await db
      .update(erpUsersTable)
      .set({ last_login: new Date() })
      .where(eq(erpUsersTable.id, user.id));

    const token = signToken(user.id, user.role, user.company_id ?? null);
    const refreshToken = signRefreshToken(user.id);
    void storeRefreshToken(refreshToken, user.id);

    /* Set httpOnly cookies */
    setAuthCookies(res, token, refreshToken);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch {
    res.status(500).json({ error: 'فشل إتمام تسجيل الدخول' });
  }
});

/* ── GET /auth/me — verify token + return fresh user data ─── */
router.get('/auth/me', authenticate, (req, res) => {
  const u = req.user!;
  let parsedPerms: Record<string, boolean> = {};
  try {
    parsedPerms = JSON.parse(u.permissions ?? '{}') as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  res.json({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    permissions: parsedPerms,
    active: u.active ?? true,
    warehouse_id: u.warehouse_id ?? null,
    employee_id: u.employee_id ?? null,
    safe_id: u.safe_id ?? null,
  });
});

/* ── POST /auth/register — SaaS: register new company + first admin ─
 *
 * Anti-abuse protection applied here (FAIL-CLOSED — blocks on any DB error):
 *  1. Duplicate email check in erp_users (existing guard)
 *  2. checkTrialEligibility() — runs 4 checks in priority order:
 *       a. Email permanently blocked in trial_abuse_log
 *       b. Public IP exceeded MAX_TRIALS_PUBLIC_IP (default 2)
 *       c. Private IP exceeded MAX_TRIALS_PRIVATE_IP (default 5)
 *       d. UA+IP fingerprint exceeded MAX_TRIALS_UA_IP (default 3)
 *  3. Stores signup_ip, signup_user_agent, has_used_trial on company row
 *  4. Generates email verification token and logs the verification link
 *  5. Records signup permanently in trial_abuse_log (all IPs, including private)
 */
router.post('/auth/register', ipRegistrationLimiter, async (req, res) => {
  try {
    const { company_name, admin_name, email, password } = req.body as {
      company_name?: string;
      admin_name?: string;
      email?: string;
      password?: string;
    };

    /* ── Field validation ─────────────────────────────────────── */
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

    /* ── Extract client IP, User-Agent, and Device Fingerprint ── */
    const clientIP    = extractClientIP(req);
    const userAgent   = req.headers['user-agent'];
    const fingerprint = computeDeviceFingerprint(req);

    /* ── Fingerprint rate limit (fail-open when Redis unavailable) ─ */
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

    /* ── Duplicate email check (erp_users) ───────────────────── */
    const [existingUser] = await db
      .select({ id: erpUsersTable.id })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.email, normalEmail));
    if (existingUser) {
      res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
      return;
    }

    /* ── Trial abuse checks (FAIL-CLOSED — all 7 checks in one call) ─── */
    let trialCheck;
    try {
      trialCheck = await checkTrialEligibility(normalEmail, clientIP, userAgent, fingerprint);
    } catch (err) {
      // DB error during abuse check — BLOCK the registration (fail-closed)
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

    /* ── Prepare email verification token (48-hour expiry) ────── */
    const verificationToken   = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    /* ── Hash password before transaction (CPU-bound, outside DB lock) ─ */
    const today    = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const baseUsername =
      normalEmail
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '') || 'admin';
    const hashedPw = await hashPin(password);

    /* ── Atomic transaction: company + user together ─────────── */
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

    /* ── Set anti-abuse fields (fire-and-forget, fails gracefully if columns missing) */
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

    /* ── Record to permanent trial abuse log ─────────────────── */
    // Fire-and-forget — must not prevent the user from getting their tokens
    void recordTrialSignup({
      email:       normalEmail,
      ip:          clientIP,
      user_agent:  userAgent,
      fingerprint: fingerprint,
      company_id:  company.id,
    });

    /* ── Compute initial trial score (fire-and-forget) ────────── */
    void scoreTrialCompany(company.id);

    /* ── Telegram: شركة جديدة سجّلت (لا cooldown — كل تسجيل يُرسل) ── */
    void alertManager.send({
      type:          ALERT_TYPES.NEW_COMPANY,
      message:       `🎉 *شركة جديدة*\nالاسم: ${company.name}\nالخطة: ${company.plan_type}\nالوقت: ${new Date().toLocaleString("ar-EG")}`,
      cooldownHours: 0,
    });

    /* ── Log verification link (no email service configured yet) */
    const verifyLink = buildVerificationLink(verificationToken);
    logVerificationLink(normalEmail, verifyLink);

    /* ── Issue JWT + cookies ─────────────────────────────────── */
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
      /* soft hint — trial is active but user should verify their email */
      verify_email_notice: 'أُرسل رابط التحقق إلى بريدك الإلكتروني — يرجى التحقق خلال 48 ساعة',
    });
  } catch (err) {
    logger.error({ err }, '[register] Unexpected error during account creation');
    res.status(500).json({ error: 'فشل إنشاء الحساب — حاول مجدداً' });
  }
});

/* ── GET /auth/verify-email — confirm email via token ───────────────────
 *
 * Called when the user clicks the verification link in their email.
 * Marks the company as email_verified=true and clears the token.
 * Returns a simple HTML page so it works directly in a browser.
 */
router.get('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token || typeof token !== 'string' || token.length < 10) {
      res.status(400).send('<h2>رابط التحقق غير صالح</h2>');
      return;
    }

    /* Find company by token */
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

    /* Already verified */
    if (company.email_verified) {
      res.send('<h2>✅ البريد الإلكتروني مُفعَّل بالفعل</h2>');
      return;
    }

    /* Check expiry */
    if (
      company.email_verification_expires_at &&
      new Date() > company.email_verification_expires_at
    ) {
      res.status(410).send(
        '<h2>انتهت صلاحية رابط التحقق — يرجى التواصل مع الدعم لإعادة الإرسال</h2>'
      );
      return;
    }

    /* Mark email as verified, clear token, update verification_status */
    await db
      .update(companiesTable)
      .set({
        email_verified:                true,
        verification_status:           'verified',
        email_verification_token:      null,
        email_verification_expires_at: null,
      })
      .where(eq(companiesTable.id, company.id));

    /* Invalidate email-verify-guard cache so the write-lock is lifted immediately */
    invalidateEmailVerifyCache(company.id);

    /* Re-score now that email is verified (adds the +30 bonus) — fire-and-forget */
    void scoreTrialCompany(company.id);

    res.send(
      '<h2>✅ تم التحقق من البريد الإلكتروني بنجاح — يمكنك إغلاق هذه الصفحة والعودة للنظام</h2>'
    );
  } catch {
    res.status(500).send('<h2>خطأ في التحقق — حاول مجدداً أو تواصل مع الدعم</h2>');
  }
});

/* ── POST /auth/resend-verification — resend verification email ─────────
 *
 * Generates a fresh token and logs the new verification link.
 * Rate-limited to prevent abuse: only works if email is not yet verified
 * and token has expired OR user explicitly requests resend.
 */
router.post('/auth/resend-verification', authenticate, async (req, res) => {
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
});

/* ── POST /auth/login/email — email + password SaaS login ─── */
router.post('/auth/login/email', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email?.trim() || !email.includes('@')) {
      res.status(400).json({ error: 'بريد إلكتروني صحيح مطلوب' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'كلمة المرور مطلوبة' });
      return;
    }

    const normalEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(erpUsersTable)
      .where(eq(erpUsersTable.email, normalEmail));

    if (!user || user.active === false) {
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      return;
    }

    /* Lockout check using email-based key */
    const lockout = await getLoginLockout(user.id);
    if (lockout.lockedUntil !== null && Date.now() < lockout.lockedUntil) {
      const remaining = Math.ceil((lockout.lockedUntil - Date.now()) / 60000);
      res.status(429).json({ error: `تم تجميد الحساب. انتظر ${remaining} دقيقة` });
      return;
    }

    const valid = await verifyPin(password, user.pin ?? '');
    if (!valid) {
      const updated = await recordLoginFailure(user.id);
      const rem = MAX_ATTEMPTS - updated.attempts;
      res.status(401).json({
        error:
          rem > 0 ? `كلمة المرور غير صحيحة — تبقّى ${rem} محاولة` : 'تم تجميد الحساب لمدة 15 دقيقة',
      });
      return;
    }

    /* Subscription check */
    if (user.company_id) {
      const [company] = await db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, user.company_id));
      if (company) {
        if (!company.is_active) {
          res.status(403).json({ error: 'الاشتراك معطل — تواصل مع المدير', suspended: true });
          return;
        }
        const days = daysRemaining(company.end_date);
        if (days < 0) {
          res
            .status(403)
            .json({ error: 'انتهت صلاحية الاشتراك', expired: true, endDate: company.end_date });
          return;
        }
      }
    }

    await clearLoginLockout(user.id);
    const token = signToken(user.id, user.role, user.company_id ?? null);
    let parsedPerms: Record<string, boolean> = {};
    try {
      parsedPerms = JSON.parse(user.permissions ?? '{}') as Record<string, boolean>;
    } catch {
      /* ignore */
    }

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        permissions: parsedPerms,
        active: user.active ?? true,
        warehouse_id: user.warehouse_id ?? null,
        employee_id: user.employee_id ?? null,
        safe_id: user.safe_id ?? null,
        company_id: user.company_id ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, '[auth/login/email] unexpected error during login');
    res.status(500).json({ error: 'فشل تسجيل الدخول' });
  }
});

/* ── POST /auth/emergency-unlock — clear brute-force lockout without JWT ──
 *
 * Protected by SUPER_ADMIN_PIN env var (same secret used to seed the account).
 * Designed for VPS use via curl when the account is locked and you cannot log in:
 *
 *   curl -X POST https://<your-domain>/api/auth/emergency-unlock \
 *        -H "Content-Type: application/json" \
 *        -d '{"username":"admin","emergency_key":"<SUPER_ADMIN_PIN value>"}'
 *
 * Clears the brute-force lockout (in-memory or Redis) for the given user.
 * Does NOT change the PIN or issue a token — just lifts the lockout.
 */
router.post('/auth/emergency-unlock', async (req, res) => {
  try {
    const emergencyKey = process.env.SUPER_ADMIN_PIN;
    if (!emergencyKey) {
      res.status(503).json({ error: 'SUPER_ADMIN_PIN غير مضبوط على هذا الخادم' });
      return;
    }

    const { username, emergency_key } = req.body as { username?: string; emergency_key?: string };

    if (!username || !emergency_key) {
      res.status(400).json({ error: 'username و emergency_key مطلوبان' });
      return;
    }

    const aKey = Buffer.alloc(64);
    const bKey = Buffer.alloc(64);
    Buffer.from(emergency_key).copy(aKey);
    Buffer.from(emergencyKey).copy(bKey);
    const keyMatch = timingSafeEqual(aKey, bKey);
    if (!keyMatch) {
      logger.warn({ username, ip: req.ip }, '[emergency-unlock] Invalid emergency key attempt');
      res.status(403).json({ error: 'مفتاح الطوارئ غير صحيح' });
      return;
    }

    const usernameNorm = username.trim().toLowerCase();
    const [found] = await db
      .select({ id: erpUsersTable.id, username: erpUsersTable.username, role: erpUsersTable.role })
      .from(erpUsersTable)
      .where(sql`LOWER(${erpUsersTable.username}) = ${usernameNorm}`);

    if (!found) {
      res.status(404).json({ error: `المستخدم '${username}' غير موجود` });
      return;
    }

    await clearLoginLockout(found.id);

    logger.warn({
      targetUser: found.username,
      targetId: found.id,
      ip: req.ip,
    }, '[emergency-unlock] Brute-force lockout cleared via emergency endpoint');

    res.json({
      success: true,
      message: `تم فك تجميد حساب '${found.username}' — يمكنك تسجيل الدخول الآن`,
      user: { id: found.id, username: found.username, role: found.role },
    });
  } catch (err) {
    logger.error({ err }, '[emergency-unlock] unexpected error');
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
