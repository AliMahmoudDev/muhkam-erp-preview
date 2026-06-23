/**
 * csrf.ts — حماية CSRF باستخدام نمط Double-Submit Cookie
 *
 * الآلية:
 *   1. عند كل استجابة، يُضبط كوكي `csrf_token` (غير httpOnly) بقيمة عشوائية آمنة.
 *   2. عند طلبات تغيير الحالة (POST/PUT/PATCH/DELETE)، يجب أن يُرسل العميل
 *      نفس القيمة في ترويسة `X-CSRF-Token`.
 *   3. المقارنة تتم بـ timing-safe comparison لمنع هجمات التوقيت.
 *
 * الاستثناءات:
 *   - طرق GET/HEAD/OPTIONS (آمنة وعديمة التغيير)
 *   - مسارات تسجيل الدخول (/api/auth/login*) — لأن المستخدم لم يحصل على كوكي CSRF بعد
 *   - مسارات التحقق من الصحة (/api/health, /api/metrics)
 *   - طلبات API الخارجية عبر Bearer token (بدون كوكيز)
 *
 * ملاحظة أمنية:
 *   هذه الطبقة إضافية (defense-in-depth) فوق SameSite=Strict + CORS.
 *   لا تُستبدل بها ولا تُضعف JWT httpOnly cookies.
 */

import type { Request, Response, NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { logger } from "../lib/logger";

/* ── Configuration ─────────────────────────────────────────── */

/** اسم كوكي CSRF (غير httpOnly — ليقرأه الـ frontend) */
const CSRF_COOKIE_NAME = "csrf_token";

/** اسم الترويسة التي يُرسل فيها العميل الرمز */
const CSRF_HEADER_NAME = "x-csrf-token";

/** طول الرمز بالبايت (32 بايت = 64 حرف hex) */
const TOKEN_BYTES = 32;

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * المسارات المُستثناة من فحص CSRF.
 * تسجيل الدخول مُستثنى لأن المستخدم لا يملك كوكي CSRF قبل أول زيارة.
 * مسارات الصحة/المقاييس مُستثناة لأنها لا تُغيِّر حالة.
 */
const EXEMPT_PATHS: readonly string[] = [
  "/api/auth/login",
  "/api/auth/login/email",
  "/api/auth/2fa/login",
  "/api/auth/emergency-unlock",
  "/api/auth/register",
  "/api/health",
  "/api/metrics",
  "/api/auth/refresh",
];

/** طرق HTTP الآمنة التي لا تحتاج تحقق CSRF */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/* ── Helper ────────────────────────────────────────────────── */

/** يُولّد رمز CSRF عشوائي آمن (hex) */
function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * مقارنة آمنة زمنياً بين رمزين.
 * تُرجع true فقط إذا كانا متطابقين تماماً.
 */
function tokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

/** يتحقق مما إذا كان المسار مُستثنى */
function isExemptPath(path: string): boolean {
  const normalized = path.split("?")[0]?.toLowerCase() ?? "";
  return EXEMPT_PATHS.some((exempt) => normalized === exempt || normalized.startsWith(exempt + "/"));
}

/**
 * يتحقق مما إذا كان الطلب يستخدم Bearer token بدون كوكيز.
 * الطلبات عبر Bearer فقط (بدون access_token cookie) لا تحتاج CSRF
 * لأنها ليست عرضة لهجمات CSRF (المهاجم لا يملك الـ token).
 */
function isBearerOnlyRequest(req: Request): boolean {
  const hasAuthHeader = req.headers.authorization?.startsWith("Bearer ");
  const hasCookie = !!(req.cookies as Record<string, string> | undefined)?.access_token;
  return !!hasAuthHeader && !hasCookie;
}

/* ── Middleware ─────────────────────────────────────────────── */

/**
 * وسيط CSRF — يُضاف إلى سلسلة الوسائط بعد cookie-parser.
 *
 * السلوك:
 *  1. يضبط/يُجدّد كوكي csrf_token إن لم يكن موجوداً
 *  2. للطلبات المتغيّرة (POST/PUT/PATCH/DELETE):
 *     - يتحقق من مطابقة الترويسة للكوكي
 *     - يرفض الطلب بـ 403 إن لم تتطابق
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  /* ── 1. ضبط كوكي CSRF إن لم يكن موجوداً ── */
  const existingToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE_NAME]; // eslint-disable-line security/detect-object-injection

  if (!existingToken) {
    const newToken = generateToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false,        // يجب أن يقرأه الـ JS في المتصفح
      secure: IS_PROD,
      sameSite: IS_PROD ? "strict" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
    });
  }

  /* ── 2. تخطّي الطرق الآمنة (GET/HEAD/OPTIONS) ── */
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  /* ── 3. تخطّي المسارات المُستثناة ── */
  if (isExemptPath(req.path)) {
    next();
    return;
  }

  /* ── 4. تخطّي طلبات Bearer-only (ليست عبر كوكيز) ── */
  if (isBearerOnlyRequest(req)) {
    next();
    return;
  }

  /* ── 5. تخطّي الطلبات عبر x-client: mobile (تطبيق الموبايل لا يستخدم كوكيز) ── */
  if (req.headers["x-client"] === "mobile") {
    next();
    return;
  }

  /* ── 5b. تخطّي الطلبات التي لا تحمل أي بيانات مصادقة (ستُرفض لاحقاً بـ 401) ── */
  const hasAccessCookie = !!(req.cookies as Record<string, string> | undefined)?.access_token;
  const hasAuthHeader = !!req.headers.authorization;
  if (!hasAccessCookie && !hasAuthHeader) {
    next();
    return;
  }

  /* ── 6. التحقق من رمز CSRF ── */
  const cookieToken = existingToken;
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    logger.warn(
      {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasCookie: !!cookieToken,
        hasHeader: !!headerToken,
      },
      "[CSRF] رفض الطلب — رمز CSRF غير صالح أو مفقود",
    );

    res.status(403).json({
      error: "رمز الحماية (CSRF) غير صالح أو مفقود — أعد تحميل الصفحة وحاول مجدداً",
      code: "CSRF_INVALID",
    });
    return;
  }

  /* ── 7. الرمز صحيح — تابع ── */
  next();
}

/**
 * وسيط مساعد: يضمن وجود كوكي CSRF في كل استجابة (حتى GET).
 * يُستخدم لضمان أن الصفحة الأولى تحصل على الرمز.
 */
export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction): void {
  const existing = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE_NAME]; // eslint-disable-line security/detect-object-injection
  if (!existing) {
    res.cookie(CSRF_COOKIE_NAME, generateToken(), {
      httpOnly: false,
      secure: IS_PROD,
      sameSite: IS_PROD ? "strict" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
}

/** يُصدّر اسم الكوكي والترويسة للاستخدام في الاختبارات */
export const CSRF_CONFIG = {
  cookieName: CSRF_COOKIE_NAME,
  headerName: CSRF_HEADER_NAME,
} as const;
