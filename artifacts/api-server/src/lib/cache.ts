/**
 * cache.ts — طبقة التخزين المؤقت (Redis) للاستجابات التي تتغير نادراً.
 *
 * يعمل بمبدأ "fail-open":
 *   - إذا لم يكن REDIS_URL مضبوطاً → يعمل بدون تخزين مؤقت بصمت تام.
 *   - إذا فشل الاتصال بـ Redis → يُسجَّل تحذير ويستمر الطلب بالوصول المباشر لقاعدة البيانات.
 *   - كل العمليات محاطة بـ try/catch لضمان أن أي عطل في Redis لا يُوقف الخادم.
 *
 * الفرق عن redis.ts:
 *   redis.ts  → fail-closed، يُستخدم لحماية الـ trial (حرج).
 *   cache.ts  → fail-open،  يُستخدم للتخزين المؤقت (اختياري).
 */

import type { Redis as TRedis } from "ioredis";
import { logger } from "./logger";

let cacheClient: TRedis | null = null;
let _initialized = false;

async function initCacheClient(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn("[Cache] REDIS_URL غير مضبوط — التخزين المؤقت معطَّل");
    return;
  }

  try {
    const { default: Redis } = await import("ioredis");
    const c = new Redis(url, {
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    c.on("error", (err: Error) => {
      logger.warn({ err }, "[Cache] خطأ في Redis — التخزين المؤقت معطَّل مؤقتاً");
      cacheClient = null;
    });

    await c.connect();
    await c.ping();
    cacheClient = c;
    logger.info("[Cache] تم الاتصال بـ Redis — التخزين المؤقت مفعَّل");
  } catch (err) {
    logger.warn({ err }, "[Cache] Redis غير متاح — سيعمل الخادم بدون تخزين مؤقت");
    cacheClient = null;
  }
}

initCacheClient().catch(() => {});

/**
 * تخزين قيمة في الذاكرة المؤقتة مع مدة انتهاء صلاحية.
 * @param {string} key - مفتاح التخزين المؤقت
 * @param {unknown} value - القيمة المراد تخزينها (أي نوع قابل للتسلسل إلى JSON)
 * @param {number} ttlSeconds - مدة الصلاحية بالثواني
 * @returns {Promise<void>}
 */
export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!cacheClient) return;
  try {
    await cacheClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "[Cache] setCache فشل — تم تجاهل الخطأ");
  }
}

/**
 * استرجاع قيمة مخزَّنة مؤقتاً بواسطة مفتاحها.
 * @template T - نوع القيمة المتوقعة
 * @param {string} key - مفتاح التخزين المؤقت
 * @returns {Promise<T | null>} - القيمة المخزَّنة أو null إذا لم تكن موجودة أو انتهت صلاحيتها
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!cacheClient) return null;
  try {
    const raw = await cacheClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, key }, "[Cache] getCache فشل — سيتم الاستعلام من قاعدة البيانات");
    return null;
  }
}

/**
 * حذف مفتاح واحد من الذاكرة المؤقتة (لإبطال الصلاحية).
 * @param {string} key - مفتاح التخزين المؤقت المراد حذفه
 * @returns {Promise<void>}
 */
export async function deleteCache(key: string): Promise<void> {
  if (!cacheClient) return;
  try {
    await cacheClient.del(key);
  } catch (err) {
    logger.warn({ err, key }, "[Cache] deleteCache فشل — تم تجاهل الخطأ");
  }
}

/**
 * حذف جميع المفاتيح المطابقة لنمط معين من الذاكرة المؤقتة.
 * يستخدم SCAN بدلاً من KEYS لتجنب تعطيل Redis في بيئات الإنتاج.
 * @param {string} pattern - نمط المفاتيح (مثال: "settings:*")
 * @returns {Promise<void>}
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!cacheClient) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await cacheClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await cacheClient.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    logger.warn({ err, pattern }, "[Cache] deleteCachePattern فشل — تم تجاهل الخطأ");
  }
}
