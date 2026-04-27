/**
 * tenant-guard.ts
 *
 * Middleware that enforces company subscription status on every authenticated API call.
 * - Inactive companies get 403
 * - Expired subscriptions get 402 (Payment Required) with days-past-due info
 * - Super admins bypass the check
 * - Read-only endpoints (GET) get a 7-day grace period before hard block
 *
 * Cache: company status is cached in-process for 60 seconds to avoid DB hit on every request.
 */

import type { Request, Response, NextFunction } from "express";
import { db, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

interface CacheEntry { expiresAt: number; status: "ok" | "inactive" | "expired"; daysPastDue: number }
const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * يجلب حالة اشتراك الشركة من قاعدة البيانات مع تخزين مؤقت لمدة 60 ثانية.
 * يُعيد "ok" إذا كان الاشتراك نشطاً وساري المفعول،
 * "expired" إذا تجاوز تاريخ الانتهاء، و"inactive" إذا كانت الشركة موقوفة أو غير موجودة.
 * @param {number} companyId - معرّف الشركة المراد التحقق منها
 * @returns {Promise<{ status: "ok" | "inactive" | "expired"; daysPastDue: number }>} - حالة الاشتراك وعدد أيام التأخر
 */
async function getCompanyStatus(companyId: number): Promise<{ status: "ok" | "inactive" | "expired"; daysPastDue: number }> {
  const now = Date.now();
  const cached = cache.get(companyId);
  if (cached && cached.expiresAt > now) {
    return { status: cached.status, daysPastDue: cached.daysPastDue };
  }

  const [company] = await db.select({
    is_active: companiesTable.is_active,
    end_date:  companiesTable.end_date,
    plan_type: companiesTable.plan_type,
  }).from(companiesTable).where(eq(companiesTable.id, companyId));

  if (!company) {
    cache.set(companyId, { expiresAt: now + CACHE_TTL_MS, status: "inactive", daysPastDue: 0 });
    return { status: "inactive", daysPastDue: 0 };
  }

  if (!company.is_active) {
    cache.set(companyId, { expiresAt: now + CACHE_TTL_MS, status: "inactive", daysPastDue: 0 });
    return { status: "inactive", daysPastDue: 0 };
  }

  const endDate = new Date(company.end_date);
  endDate.setHours(23, 59, 59, 999);
  const today = new Date();
  const daysPastDue = Math.max(0, Math.floor((today.getTime() - endDate.getTime()) / 86_400_000));

  const result = daysPastDue > 0 ? "expired" : "ok";
  cache.set(companyId, { expiresAt: now + CACHE_TTL_MS, status: result, daysPastDue });
  return { status: result, daysPastDue };
}

/**
 * يُبطل الإدخال المخزَّن مؤقتاً لشركة معينة.
 * يجب استدعاؤه فور تجديد اشتراك الشركة لضمان أن الطلبات التالية
 * تعكس الحالة الجديدة الصحيحة فوراً دون انتظار انتهاء صلاحية الكاش.
 * @param {number} companyId - معرّف الشركة المراد حذف كاشها
 * @returns {void}
 */
export function invalidateTenantCache(companyId: number): void {
  cache.delete(companyId);
}

const GRACE_PERIOD_DAYS = 7;

/**
 * وسيط التحقق من صلاحية اشتراك المستأجر على كل طلب مصادَق عليه.
 *
 * السلوك:
 *  - المشرف العام يتجاوز هذا الفحص دائماً
 *  - الشركات الموقوفة: 403
 *  - الاشتراكات المنتهية: 402 مع تفاصيل الأيام المتأخرة
 *  - طلبات GET تحصل على فترة سماح 7 أيام بعد انتهاء الاشتراك
 *  - عند خطأ في قاعدة البيانات: يسمح بالطلب (fail-open) لتجنب تعطُّل الخدمة
 * @param {Request} req - كائن الطلب من Express
 * @param {Response} res - كائن الاستجابة من Express
 * @param {NextFunction} next - دالة الانتقال للوسيط التالي
 * @returns {Promise<void>} - لا تُرجع قيمة
 */
export async function tenantGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only check authenticated requests with a company
  const user = req.user;
  if (!user || !user.company_id) { next(); return; }

  // Super admins bypass subscription checks
  if (user.role === "super_admin") { next(); return; }

  try {
    const { status, daysPastDue } = await getCompanyStatus(user.company_id);

    if (status === "inactive") {
      res.status(403).json({ error: "الحساب موقوف. يرجى التواصل مع الدعم الفني." });
      return;
    }

    if (status === "expired") {
      // Read-only endpoints get a grace period
      const isReadOnly = req.method === "GET";
      const gracePeriod = isReadOnly ? GRACE_PERIOD_DAYS : 0;

      if (daysPastDue > gracePeriod) {
        logger.warn({ companyId: user.company_id, daysPastDue }, "[TenantGuard] Subscription expired — blocking");
        res.status(402).json({
          error: "انتهى اشتراكك. يرجى تجديد الاشتراك للاستمرار.",
          days_past_due: daysPastDue,
          code: "SUBSCRIPTION_EXPIRED",
        });
        return;
      }

      // Within grace period: allow but add warning header
      res.setHeader("X-Subscription-Warning", `expired:${daysPastDue}d`);
    }

    next();
  } catch (err) {
    // On DB error: fail open (allow request) to avoid blocking all traffic on DB issues
    logger.error({ err, companyId: user.company_id }, "[TenantGuard] Error checking subscription — failing open");
    next();
  }
}
