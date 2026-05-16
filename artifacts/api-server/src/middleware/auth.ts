import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, pool, erpUsersTable, companiesTable } from "@workspace/db";
import type { PoolClient } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { isTokenBlacklisted } from "../lib/session-blacklist";
import { sanitizeObject } from "../lib/sanitize";
import { logger } from "../lib/logger";
import { Role } from "../lib/roles";

/** نوع عميل pg المُثبَّت من تجمُّع الاتصالات */
type PinnedClient = PoolClient;

/**
 * يضبط متغيرات جلسة PostgreSQL لتفعيل عزل البيانات على مستوى الصفوف (RLS)
 * ويُحوِّل الاتصال إلى الدور المقيَّد `erp_app_role`.
 *
 * ملاحظة مهمة — تجمُّع الاتصالات:
 *   الطبقة الأولى للحماية هي شرط `where(eq(table.company_id, req.companyId))`
 *   الموجود في كل مسار. أما RLS فهو طبقة دفاعية إضافية فحسب. نظرًا لأن
 *   Drizzle يستخدم اتصالًا مختلفًا من التجمُّع لكل استعلام، فإن `SET ROLE`
 *   و`set_config` لا يضمنان تطبيق RLS على جميع الاستعلامات في الطلب الواحد.
 * @param {object} user - بيانات المستخدم التي تشمل رقم الشركة والدور
 * @param {PinnedClient} [client] - عميل pg مُثبَّت (اختياري). إن وُجد، تُنفَّذ الأوامر عليه مباشرةً
 * @returns {Promise<void>} - لا تُرجع قيمة
 */
async function setDbContext(
  user: { company_id: number | null; role: string },
  client?: PinnedClient,
): Promise<void> {
  const companyId = user.company_id ? String(user.company_id) : "";
  const isSuperAdmin = user.role === Role.SuperAdmin ? "true" : "false";
  try {
    if (client) {
      await client.query("SET ROLE erp_app_role");
      await client.query(
        "SELECT set_config('app.current_company_id', $1, false)," +
        "       set_config('app.is_super_admin', $2, false)",
        [companyId, isSuperAdmin],
      );
    } else {
      await db.execute(sql`SET ROLE erp_app_role`);
      await db.execute(
        sql`SELECT set_config('app.current_company_id', ${companyId}, false),
                   set_config('app.is_super_admin', ${isSuperAdmin}, false)`
      );
    }
  } catch {
    /* Non-fatal: app-level company_id filtering is still the primary guard */
  }
}

/**
 * يُعيد ضبط دور الاتصال ومتغيرات الجلسة إلى قيمها الافتراضية
 * بعد انتهاء الطلب، للحدّ من تسرُّب سياق المستأجر إلى طلبات أخرى
 * تستخدم الاتصال ذاته من التجمُّع.
 * @param {PinnedClient} [client] - عميل pg مُثبَّت (اختياري). إن وُجد، تُنفَّذ الأوامر عليه مباشرةً
 * @returns {Promise<void>} - لا تُرجع قيمة
 */
async function clearDbContext(client?: PinnedClient): Promise<void> {
  try {
    if (client) {
      await client.query("RESET ROLE");
      await client.query(
        "SELECT set_config('app.current_company_id', '', false)," +
        "       set_config('app.is_super_admin', 'false', false)",
      );
    } else {
      await db.execute(sql`RESET ROLE`);
      await db.execute(
        sql`SELECT set_config('app.current_company_id', '', false),
                   set_config('app.is_super_admin', 'false', false)`
      );
    }
  } catch {
    /* ignore — best effort */
  }
}

if (!process.env.JWT_SECRET) {
  throw new Error("[FATAL] JWT_SECRET environment variable is not set. Server cannot start securely.");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: string;
  permissions: string;
  active: boolean | null;
  warehouse_id: number | null;
  safe_id: number | null;
  company_id: number | null;
  employee_id: number | null;
}

/* Locals augmentation — stays here because PinnedClient is a local type alias */
declare global {
  namespace Express {
    interface Locals {
      /** عميل pg مُثبَّت لطلب RLS (دفاع في العمق) — غير مضمون الوجود */
      pgClient?: PinnedClient;
    }
  }
}

/**
 * يُنشئ رمز وصول (Access Token) قصير الصلاحية مدته 4 ساعات.
 * @param {number} userId - معرّف المستخدم
 * @param {string} role - دور المستخدم في النظام
 * @param {number|null} companyId - معرّف الشركة المرتبطة بالمستخدم (null للمشرف العام)
 * @returns {string} - رمز JWT موقَّع
 */
export function signToken(userId: number, role: string, companyId: number | null = null): string {
  return jwt.sign({ userId, role, companyId }, JWT_SECRET, { expiresIn: "4h" });
}

/* ── Sign a long-lived refresh token (7 d) ──────────────── */
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error(
    "[FATAL] JWT_REFRESH_SECRET environment variable is not set. " +
    "Server cannot start securely. Set a strong independent JWT_REFRESH_SECRET.",
  );
}
const REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET;

/**
 * يُنشئ رمز تحديث (Refresh Token) طويل الصلاحية مدته 7 أيام.
 * يُستخدم لاستبدال رمز الوصول المنتهي دون إعادة تسجيل الدخول.
 * @param {number} userId - معرّف المستخدم
 * @returns {string} - رمز JWT موقَّع بالسرّ الخاص بالتحديث
 */
export function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: "7d" });
}

/**
 * يتحقق من صحة رمز التحديث ويُرجع معرّف المستخدم المضمَّن فيه.
 * @param {string} token - رمز التحديث المُرسَل من العميل
 * @returns {{ userId: number } | null} - معرّف المستخدم في حال كان الرمز صحيحاً، أو null عند الفشل
 */
export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as { userId: number; type: string };
    if (decoded.type !== "refresh") return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

/**
 * وسيط المصادقة الرئيسي — يتحقق من رمز JWT ويُرفق بيانات المستخدم بالطلب.
 *
 * ترتيب التحقق:
 *  1. يقرأ الرمز من الكوكيز (httpOnly) أولاً، ثم من ترويسة Authorization كاحتياط
 *  2. يتحقق من أن الرمز غير مُدرج في قائمة الإلغاء (logout/revocation)
 *  3. يُفكّك الرمز ويتحقق من صلاحيته عبر JWT_SECRET
 *  4. يُعيد قراءة بيانات المستخدم من قاعدة البيانات (لا يثق برمز التوكن وحده)
 *  5. يتحقق من نشاط الحساب، وصلاحية الاشتراك، وإعدادات المستخدم
 * @param {Request} req - كائن الطلب من Express
 * @param {Response} res - كائن الاستجابة من Express
 * @param {NextFunction} next - دالة الانتقال للوسيط التالي
 * @returns {Promise<void>} - لا تُرجع قيمة
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  /* Primary: httpOnly cookie — Secondary: Authorization header (fallback) */
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.access_token;
  const authHeader = req.headers.authorization;
  const token = cookieToken ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

  if (!token) {
    res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول أولاً" });
    return;
  }

  /* Check token blacklist (logout / revocation) */
  if (await isTokenBlacklisted(token)) {
    res.status(401).json({ error: "انتهت الجلسة، يرجى تسجيل الدخول مجدداً" });
    return;
  }

  let payload: { userId: number; role: string };

  try {
    payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
  } catch {
    res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
    return;
  }

  /* Always re-read from DB — never trust the token's role alone */
  const [user] = await db
    .select()
    .from(erpUsersTable)
    .where(eq(erpUsersTable.id, payload.userId));

  if (!user || user.active === false) {
    res.status(401).json({ error: "الحساب غير نشط" });
    return;
  }

  /* cashier/salesperson must have warehouse_id AND safe_id configured */
  if (user.role === Role.Cashier || user.role === "salesperson") {
    if (!user.warehouse_id || !user.safe_id) {
      res.status(400).json({ error: "يجب تحديد المخزن والخزنة لهذا المستخدم — يرجى مراجعة المدير" });
      return;
    }
  }

  /* Non-super_admin must belong to a company */
  if (user.role !== Role.SuperAdmin && !user.company_id) {
    res.status(403).json({ error: "حساب غير مرتبط بشركة — تواصل مع المدير" });
    return;
  }

  if (user.company_id) {
    const [co] = await db
      .select({ is_active: companiesTable.is_active, end_date: companiesTable.end_date })
      .from(companiesTable)
      .where(eq(companiesTable.id, user.company_id));
    if (co) {
      if (!co.is_active) {
        res.status(403).json({ error: "الاشتراك موقوف — يرجى التواصل مع المدير" });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      if (co.end_date < today) {
        res.status(403).json({ error: "انتهت صلاحية الاشتراك — يرجى تجديد الاشتراك" });
        return;
      }
    }
  }

  req.user = user as AuthUser;

  /* ── Per-request connection pinning for RLS (defense-in-depth) ───────────────
     نحجز اتصالًا واحدًا من التجمُّع لكامل عمر الطلب، ونضبط عليه متغيرات جلسة
     RLS حتى تنطبق على جميع الاستعلامات التي تستخدم هذا الاتصال.
     يُعرَّض العميل المُثبَّت عبر res.locals.pgClient ليستخدمه أي مسار يريد.
     إذا فشل الحجز، نسجّل التحذير ونستمر بالتجمُّع الاعتيادي (fail-open) —
     الحماية الأساسية هي شرط company_id في كل مسار، وهي تبقى سارية دائمًا.
     ──────────────────────────────────────────────────────────────────────────── */
  let pinnedClient: PinnedClient | undefined;
  try {
    pinnedClient = await pool.connect();
    await setDbContext(user, pinnedClient);
    res.locals.pgClient = pinnedClient;
  } catch (err) {
    logger.warn({ err }, "[auth] connection-pinning failed — falling back to pool for RLS context");
    void setDbContext(user);          // pool best-effort fallback
  }

  /* تنظيف الاتصال المُثبَّت عند انتهاء الاستجابة — مع الحرص على عدم الإطلاق مرتين */
  const releasePinned = (): void => {
    const c = pinnedClient;
    if (!c) return;
    pinnedClient = undefined;         // guard against double-release on finish+close
    void clearDbContext(c).finally(() => { c.release(); });
  };
  res.on("finish", releasePinned);
  res.on("close",  releasePinned);

  next();
}

/**
 * مصنع وسائط التحقق من الدور — يُنشئ وسيطاً يرفض الطلبات
 * التي لا يمتلك أصحابها أحد الأدوار المُحددة.
 * @param {...string} roles - قائمة الأدوار المسموح بها (مثل: "admin", "manager")
 * @returns {Function} - وسيط Express يتحقق من دور المستخدم
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول أولاً" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `ليس لديك صلاحية — يتطلب: ${roles.join(" أو ")}`,
        required: roles,
        yourRole: req.user.role,
      });
      return;
    }
    next();
  };
}

/**
 * وسيط تنظيف جسم الطلب من هجمات XSS.
 * يُطبَّق على كائنات JSON فقط، ويتجاهل الـ Buffer (مثل نقطة الاستعادة /api/system/restore).
 * @param {Request} req - كائن الطلب من Express
 * @param {Response} _res - كائن الاستجابة (غير مُستخدَم)
 * @param {NextFunction} next - دالة الانتقال للوسيط التالي
 * @returns {void}
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  /* Skip Buffers (e.g. /api/system/restore uses express.raw() — body is a Buffer) */
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
}

/* ─────────────────────────────────────────────────────────
   requireTenant — MANDATORY tenant resolution guard.
   Must run AFTER `authenticate`. Rejects any non-super_admin
   request that has no company_id. Eliminates `?? 1` fallbacks
   completely — every route can safely use req.user!.company_id!
   after this middleware passes.
   ───────────────────────────────────────────────────────── */
/**
 * وسيط التحقق الصارم من سياق المستأجر — يرفض حتى المشرف العام.
 * يُستخدَم في المسارات التي تُعدِّل موارد مرتبطة بشركة محددة
 * ولا يصح تنفيذها عبر شركات متعددة (cross-tenant).
 * @param {Request} req - كائن الطلب من Express
 * @param {Response} res - كائن الاستجابة من Express
 * @param {NextFunction} next - دالة الانتقال للوسيط التالي
 * @returns {void}
 */
export function requireTenantStrict(req: Request, res: Response, next: NextFunction): void {
  const cid = req.user?.company_id;
  if (typeof cid !== "number" || cid <= 0) {
    res.status(403).json({
      error: "هذه العملية تتطلب سياق شركة (tenant) — استخدم حساب مستخدم تابع للشركة",
    });
    return;
  }
  next();
}

/**
 * وسيط التحقق من سياق المستأجر — يضمن ارتباط الطلب بشركة محددة.
 * يجب تشغيله بعد `authenticate`. يسمح للمشرف العام بالمرور دون شركة.
 * بعد اجتياز هذا الوسيط، يمكن لكل مسار استخدام `req.user.company_id` بأمان.
 * @param {Request} req - كائن الطلب من Express
 * @param {Response} res - كائن الاستجابة من Express
 * @param {NextFunction} next - دالة الانتقال للوسيط التالي
 * @returns {void}
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "غير مصرح: يلزم تسجيل الدخول أولاً" });
    return;
  }
  // super_admin operates across tenants — must explicitly pass company_id when needed
  if (req.user.role === Role.SuperAdmin) {
    next();
    return;
  }
  if (!req.user.company_id || typeof req.user.company_id !== "number") {
    res.status(403).json({ error: "Tenant not resolved — حساب غير مرتبط بشركة" });
    return;
  }
  req.companyId = req.user.company_id;
  next();
}

/**
 * يستخرج معرّف الشركة (tenant) من الطلب بشكل صارم.
 * يُرجع القيمة مباشرةً أو يُلقي استثناءً (يُعالجه error handler بـ 403).
 * المشرف العام يحتاج إلى تمرير `?company_id=` صراحةً في الاستعلام أو الجسم.
 * @param {Request} req - كائن الطلب من Express
 * @returns {number} - معرّف الشركة
 * @throws {Error} - إذا لم يكن سياق الشركة متاحاً (status: 403) أو ناقصاً للمشرف (status: 400)
 */
export function getTenant(req: Request): number {
  const cid = req.user?.company_id;
  if (typeof cid === "number" && cid > 0) return cid;
  if (req.user?.role === Role.SuperAdmin) {
    const q = Number(req.query?.company_id ?? req.body?.company_id);
    if (Number.isFinite(q) && q > 0) return q;
    const err = Object.assign(new Error("super_admin must provide company_id"), { status: 400 });
    throw err;
  }
  const err = Object.assign(new Error("Tenant not resolved"), { status: 403 });
  throw err;
}

/* ── Convenience combos ─────────────────────────────────── */
export const adminOnly    = [authenticate, requireRole("admin"), requireTenant] as const;
export const managerUp    = [authenticate, requireRole("admin", "manager"), requireTenant] as const;
export const anyAuth      = [authenticate, requireTenant] as const;

/**
 * وسيط قائمة السماح بالعناوين IP لمسارات المشرف العام.
 * إذا كان متغير البيئة `SUPER_ADMIN_IPS` فارغاً، يُسمح بالوصول من أي عنوان
 * (السلوك الافتراضي في بيئة التطوير).
 * في الإنتاج: يُرفض أي عنوان IP غير موجود في القائمة.
 * يعتمد على `req.ip` الذي تحدده Express عبر إعداد "trust proxy"
 * لمنع تزوير ترويسة X-Forwarded-For.
 * @param {Request} req - كائن الطلب من Express
 * @param {Response} res - كائن الاستجابة من Express
 * @param {NextFunction} next - دالة الانتقال للوسيط التالي
 * @returns {void}
 */
export function superAdminIPGuard(req: Request, res: Response, next: NextFunction): void {
  const allowedIPs = process.env.SUPER_ADMIN_IPS?.split(",").map((ip) => ip.trim()).filter(Boolean);

  /* If no IP list configured:
   *   - In production: fail-closed — reject all requests.
   *     An unconfigured allowlist in production is a misconfiguration, not a
   *     reason to expose super-admin endpoints to every IP.
   *   - In non-production: allow all (development convenience).
   */
  if (!allowedIPs || allowedIPs.length === 0) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("[superAdminIPGuard] SUPER_ADMIN_IPS is not configured in production — blocking all super-admin access");
      res.status(403).json({ error: "الوصول مرفوض — قائمة IP المسموح بها غير مضبوطة" });
      return;
    }
    next();
    return;
  }

  /*
   * Use req.ip only — Express resolves it correctly via "trust proxy"
   * setting in app.ts (trust proxy = 1), so it reads the real client IP
   * from X-Forwarded-For safely without allowing header spoofing.
   * Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
   * so that IPs configured as plain IPv4 still match when nginx proxies.
   */
  const rawIP = req.ip || req.socket.remoteAddress || "";
  const clientIP = rawIP.startsWith("::ffff:") ? rawIP.slice(7) : rawIP;

  if (!clientIP || !allowedIPs.includes(clientIP)) {
    logger.warn({ clientIP, allowedIPs }, "[superAdminIPGuard] blocked request from unlisted IP");
    res.status(403).json({ error: "الوصول مرفوض — عنوان IP غير مصرح به" });
    return;
  }

  next();
}
