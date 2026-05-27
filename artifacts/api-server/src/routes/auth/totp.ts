/**
 * Two-factor authentication (TOTP) routes:
 *   GET  /auth/2fa/setup
 *   POST /auth/2fa/verify
 *   POST /auth/2fa/disable
 *   GET  /auth/2fa/status
 *   POST /auth/2fa/login
 */
import { Router } from 'express';
import { wrap } from '../../lib/async-handler';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db, erpUsersTable } from '@workspace/db';
import { authenticate, signToken, signRefreshToken } from '../../middleware/auth';
import { storeRefreshToken } from '../../lib/refresh-token-store';
import {
  generateTOTPSecret,
  generateQRCode,
  verifyTOTP,
  encryptSecret,
  decryptSecret,
  isEncrypted,
} from '../../lib/totp';
import {
  check2FAAllowed,
  reset2FALockout,
} from '../../lib/brute-force-store';
import { requireUser } from "../../lib/tenant";
import {
  JWT_SECRET,
  setAuthCookies,
} from './_shared';

const router = Router();

/* ── GET /auth/2fa/setup — generate TOTP secret + QR for super_admin ─── */
router.get('/auth/2fa/setup', authenticate, wrap(async (req, res) => {
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
    if (!user) {
      res.status(401).json({ error: "المستخدم غير موجود" });
      return;
    }
    if (user.totp_enabled) {
      res.status(400).json({ error: 'المصادقة الثنائية مفعلة بالفعل' });
      return;
    }
    const { secret, otpauth_url } = generateTOTPSecret(user.username);
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
}));

/* ── POST /auth/2fa/verify — confirm TOTP setup, enable 2FA ─── */
router.post('/auth/2fa/verify', authenticate, wrap(async (req, res) => {
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
}));

/* ── POST /auth/2fa/disable — disable 2FA (requires valid TOTP) ─── */
router.post('/auth/2fa/disable', authenticate, wrap(async (req, res) => {
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
    if (!user.totp_secret) {
      res.status(400).json({ error: "لم يتم العثور على مفتاح TOTP — يرجى إعادة التفعيل" });
      return;
    }
    const rawSecret2 = isEncrypted(user.totp_secret)
      ? decryptSecret(user.totp_secret)
      : user.totp_secret;
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
}));

/* ── GET /auth/2fa/status — check if 2FA is enabled for current user ─── */
router.get('/auth/2fa/status', authenticate, wrap(async (req, res) => {
  try {
    const [user] = await db
      .select({ totp_enabled: erpUsersTable.totp_enabled })
      .from(erpUsersTable)
      .where(eq(erpUsersTable.id, requireUser(req).id))
      .limit(1);
    res.json({ totp_enabled: user?.totp_enabled ?? false });
  } catch {
    res.status(500).json({ error: 'فشل جلب حالة 2FA' });
  }
}));

/* ── POST /auth/2fa/login — complete login after TOTP check ─── */
router.post('/auth/2fa/login', wrap(async (req, res) => {
  try {
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

    const rawSecret = isEncrypted(user.totp_secret)
      ? decryptSecret(user.totp_secret)
      : user.totp_secret;
    if (!verifyTOTP(rawSecret, totp_code)) {
      res.status(401).json({ error: 'رمز التحقق غير صحيح أو منتهي' });
      return;
    }

    await reset2FALockout(clientIP);

    await db
      .update(erpUsersTable)
      .set({ last_login: new Date() })
      .where(eq(erpUsersTable.id, user.id));

    const token = signToken(user.id, user.role, user.company_id ?? null);
    const refreshToken = signRefreshToken(user.id);
    void storeRefreshToken(refreshToken, user.id);

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
}));

export default router;
