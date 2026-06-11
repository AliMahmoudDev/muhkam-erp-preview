/**
 * Login, session, and account routes:
 *   POST /auth/login
 *   POST /auth/refresh
 *   GET  /auth/subscription
 *   POST /auth/logout
 *   GET  /auth/me
 *   POST /auth/login/email
 *   POST /auth/emergency-unlock
 */
import { Router } from 'express';
import { wrap } from '../../lib/async-handler';
import { timingSafeEqual } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db, erpUsersTable, companiesTable } from '@workspace/db';
import { logger } from '../../lib/logger';
import { Role } from '../../lib/roles';
import {
  authenticate,
  signToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../middleware/auth';
import { blacklistToken } from '../../lib/session-blacklist';
import {
  storeRefreshToken,
  consumeRefreshToken,
  revokeUserRefreshTokens,
} from '../../lib/refresh-token-store';
import { verifyPin, hashPin } from '../../lib/hash';
import { loginSchema, validate } from '../../lib/schemas';
import {
  getLoginLockout,
  recordLoginFailure,
  clearLoginLockout,
  MAX_ATTEMPTS,
} from '../../lib/brute-force-store';
import { requireUser } from '../../lib/tenant';
import { JWT_SECRET, setAuthCookies, clearAuthCookies, daysRemaining } from './_shared';

const router = Router();

/* ── POST /auth/login — validate PIN server-side, return JWT ─ */
router.post(
  '/auth/login',
  wrap(async (req, res) => {
    try {
      const v = validate(loginSchema, req.body);
      if (!v.success) {
        res.status(400).json({ error: 'بيانات غير صحيحة', details: v.errors });
        return;
      }
      const { userId, username, pin, company_id: loginCompanyId } = v.data;

      let uid: number;
      if (userId !== undefined) {
        uid = userId;
      } else {
        if (!username) {
          res.status(400).json({ error: 'اسم المستخدم مطلوب' });
          return;
        }
        const usernameNorm = username.trim().toLowerCase();
        const isEmail = usernameNorm.includes('@');
        const [found] = await db
          .select({ id: erpUsersTable.id, company_id: erpUsersTable.company_id })
          .from(erpUsersTable)
          .where(
            isEmail
              ? eq(erpUsersTable.email, usernameNorm)
              : sql`LOWER(${erpUsersTable.username}) = ${usernameNorm}`
          );
        if (!found) {
          res.status(401).json({ error: 'الحساب غير موجود أو معطل' });
          return;
        }
        if (loginCompanyId && found.company_id !== null && found.company_id !== loginCompanyId) {
          res.status(401).json({ error: 'الحساب غير موجود أو معطل' });
          return;
        }
        uid = found.id;
      }

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

      if (user.pin && !user.pin.startsWith('$2')) {
        try {
          const hashed = await hashPin(pin);
          await db.update(erpUsersTable).set({ pin: hashed }).where(eq(erpUsersTable.id, uid));
        } catch {
          /* non-fatal */
        }
      }

      if (user.company_id && user.role !== Role.SuperAdmin) {
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

      if (user.role === Role.Cashier || user.role === Role.Salesperson) {
        if (!user.warehouse_id) {
          res.status(403).json({ error: 'هذا الحساب غير مرتبط بفرع/مخزن — تواصل مع المدير' });
          return;
        }
        if (!user.safe_id) {
          res.status(403).json({ error: 'هذا الحساب غير مرتبط بخزينة — تواصل مع المدير' });
          return;
        }
      }

      await clearLoginLockout(uid);

      if (user.totp_enabled && user.role === Role.SuperAdmin) {
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
  })
);

/* ── POST /auth/refresh — rotate refresh token + issue new access token ─ */
router.post(
  '/auth/refresh',
  wrap(async (req, res) => {
    try {
      const refreshToken: string | undefined =
        (req.cookies as Record<string, string> | undefined)?.refresh_token ??
        (req.body as { refreshToken?: string })?.refreshToken;
      if (!refreshToken) {
        res.status(400).json({ error: 'refresh token مطلوب' });
        return;
      }

      const jwtPayload = verifyRefreshToken(refreshToken);
      if (!jwtPayload) {
        res.status(401).json({ error: 'refresh token غير صالح أو منتهي الصلاحية' });
        return;
      }

      const dbPayload = await consumeRefreshToken(refreshToken);
      if (!dbPayload) {
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

      const newToken = signToken(user.id, user.role, user.company_id ?? null);
      const newRefreshToken = signRefreshToken(user.id);
      void storeRefreshToken(newRefreshToken, user.id);

      setAuthCookies(res, newToken, newRefreshToken);

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'فشل تجديد الجلسة' });
    }
  })
);

/* ── GET /auth/subscription — subscription status for current company ─ */
router.get(
  '/auth/subscription',
  authenticate,
  wrap(async (req, res) => {
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
  })
);

/* ── POST /auth/logout — blacklist access token + revoke refresh tokens ─ */
router.post('/auth/logout', authenticate, async (req, res) => {
  const cookieAccess = (req.cookies as Record<string, string> | undefined)?.access_token;
  const headerAccess = req.headers.authorization?.split(' ')[1];
  const accessToken = cookieAccess ?? headerAccess;
  if (accessToken) await blacklistToken(accessToken);

  const cookieRefresh = (req.cookies as Record<string, string> | undefined)?.refresh_token;
  const { refreshToken: bodyRefresh } = (req.body as { refreshToken?: string } | undefined) ?? {};
  const refreshToken = cookieRefresh ?? bodyRefresh;
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload) void revokeUserRefreshTokens(payload.userId);
  }

  clearAuthCookies(res);

  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

/* ── GET /auth/me — verify token + return fresh user data ─── */
router.get('/auth/me', authenticate, (req, res) => {
  const u = requireUser(req);
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

/* ── POST /auth/login/email — email + password SaaS login ─── */
router.post(
  '/auth/login/email',
  wrap(async (req, res) => {
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
            rem > 0
              ? `كلمة المرور غير صحيحة — تبقّى ${rem} محاولة`
              : 'تم تجميد الحساب لمدة 15 دقيقة',
        });
        return;
      }

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
  })
);

/* ── POST /auth/emergency-unlock — clear brute-force lockout without JWT ── */
router.post(
  '/auth/emergency-unlock',
  wrap(async (req, res) => {
    try {
      const emergencyKey = process.env.SUPER_ADMIN_PIN;
      if (!emergencyKey) {
        res.status(404).json({ error: 'المورد المطلوب غير موجود' });
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
        .select({
          id: erpUsersTable.id,
          username: erpUsersTable.username,
          role: erpUsersTable.role,
        })
        .from(erpUsersTable)
        .where(sql`LOWER(${erpUsersTable.username}) = ${usernameNorm}`);

      if (!found) {
        res.status(404).json({ error: `المستخدم '${username}' غير موجود` });
        return;
      }

      await clearLoginLockout(found.id);

      logger.warn(
        {
          targetUser: found.username,
          targetId: found.id,
          ip: req.ip,
        },
        '[emergency-unlock] Brute-force lockout cleared via emergency endpoint'
      );

      res.json({
        success: true,
        message: `تم فك تجميد حساب '${found.username}' — يمكنك تسجيل الدخول الآن`,
        user: { id: found.id, username: found.username, role: found.role },
      });
    } catch (err) {
      logger.error({ err }, '[emergency-unlock] unexpected error');
      res.status(500).json({ error: 'خطأ في الخادم' });
    }
  })
);

export default router;
