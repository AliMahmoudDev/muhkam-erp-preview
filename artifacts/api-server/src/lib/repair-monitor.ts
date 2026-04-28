/**
 * repair-monitor.ts
 *
 * مُجدوِل مراقبة بطاقات الصيانة المتأخّرة:
 * - يعمل كل 4 ساعات بالخلفية.
 * - يبحث عن البطاقات النشطة (غير "delivered/cancelled/rejected") التي
 *   لم تُحدَّث منذ فترة مساوية أو أكبر من العتبة (alert_days_threshold)
 *   أو 3 أيام افتراضياً.
 * - يُرسل تنبيه Telegram لكل بطاقة متأخّرة عبر alertManager بنوع
 *   فريد (`repair_overdue:<id>`) مع cooldown = 4 ساعات لمنع التكرار.
 * - يَستخدم نفس آلية markResolved في PATCH /repair-jobs/:id لإلغاء
 *   التنبيه تلقائياً بعد أي تحديث للبطاقة.
 */

import { db, repairJobsTable } from "@workspace/db";
import { sql, and, notInArray } from "drizzle-orm";
import { alertManager } from "./telegram-alert-manager";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // كل 4 ساعات
const DEFAULT_THRESHOLD_DAYS = 3;
const TERMINAL_STATUSES = ["delivered", "cancelled", "rejected"];

let timer: NodeJS.Timeout | null = null;

/**
 * يحسب عدد الأيام بين تاريخين (تقريبي — يكفي للعرض في رسالة التنبيه).
 */
function daysSince(date: Date): number {
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

/**
 * يفحص البطاقات المتأخّرة ويُرسل تنبيهات لكل واحدة منها.
 */
async function checkOverdueRepairs(): Promise<void> {
  try {
    /* استعلام واحد يجلب كل البطاقات النشطة المتأخّرة عبر كل الشركات.
       نعتمد على alert_days_threshold الخاص بالبطاقة، أو الافتراضي = 3 أيام. */
    const rows = await db
      .select({
        id:                   repairJobsTable.id,
        company_id:           repairJobsTable.company_id,
        job_no:               repairJobsTable.job_no,
        customer_name:        repairJobsTable.customer_name,
        device_brand:         repairJobsTable.device_brand,
        device_model:         repairJobsTable.device_model,
        status:               repairJobsTable.status,
        updated_at:           repairJobsTable.updated_at,
        alert_days_threshold: repairJobsTable.alert_days_threshold,
      })
      .from(repairJobsTable)
      .where(
        and(
          notInArray(repairJobsTable.status, TERMINAL_STATUSES),
          sql`${repairJobsTable.updated_at} < NOW() - (
            COALESCE(${repairJobsTable.alert_days_threshold}, ${DEFAULT_THRESHOLD_DAYS}) || ' days'
          )::interval`,
        ),
      );

    if (rows.length === 0) {
      logger.debug("[repair-monitor] no overdue repair jobs");
      return;
    }

    logger.info({ count: rows.length }, "[repair-monitor] found overdue repair jobs");

    for (const job of rows) {
      const daysAgo = daysSince(job.updated_at);
      const message =
        `⏰ *بطاقة صيانة متأخرة*\n` +
        `رقم البطاقة: ${job.job_no}\n` +
        `العميل: ${job.customer_name ?? "—"}\n` +
        `الجهاز: ${(job.device_brand ?? "")} ${(job.device_model ?? "")}`.trim() +
        `\nالحالة: ${job.status}\n` +
        `آخر تحديث: ${daysAgo} يوم`;

      await alertManager.send({
        type:          `repair_overdue:${job.id}`,
        message,
        cooldownHours: 4,
      });
    }
  } catch (err) {
    logger.error({ err }, "[repair-monitor] failed to check overdue repairs");
  }
}

/**
 * يبدأ مُجدوِل مراقبة الصيانة. يُستدعى مرة واحدة عند إقلاع السيرفر.
 */
export function startRepairMonitor(): void {
  if (timer) return;
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "[repair-monitor] starting scheduler");
  /* تشغيل أوّل فحص بعد دقيقة من الإقلاع — لتجنّب التحميل وقت البدء */
  setTimeout(() => void checkOverdueRepairs(), 60_000);
  timer = setInterval(() => void checkOverdueRepairs(), CHECK_INTERVAL_MS);
}

/**
 * يوقف مُجدوِل مراقبة الصيانة. يُستدعى عند إيقاف السيرفر بأمان.
 */
export function stopRepairMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("[repair-monitor] scheduler stopped");
  }
}
