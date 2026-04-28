/**
 * telegram-alert-manager.ts
 *
 * مدير تنبيهات Telegram الذكي — يمنع تكرار الإرسال باستخدام cooldown داخلي في الذاكرة.
 * يضمن أن كل نوع تنبيه لا يُرسل أكثر من مرة في الفترة الزمنية المحددة،
 * ويرسل رسالة حل واحدة عند معالجة المشكلة ثم يتوقف عن التتبع.
 */

import { sendTelegramAlert } from "./telegram";
import { logger } from "./logger";

interface AlertState {
  lastSentAt: number;
  resolved: boolean;
}

/** ثوابت أنواع التنبيهات — مرجع موحّد يُستخدم عبر كامل التطبيق */
export const ALERT_TYPES = {
  SERVER_START:          "server_start",
  SERVER_SLOW:           "server_slow",
  SERVER_HIGH_MEMORY:    "server_high_memory",
  DB_SLOW:               "db_slow",
  BACKUP_FAILED:         "backup_failed",
  BACKUP_SUCCESS:        "backup_success",
  BRUTE_FORCE:           (ip: string) => `brute_force:${ip}`,
  SUBSCRIPTION_EXPIRING: (companyId: number) => `subscription_expiring:${companyId}`,
  SUBSCRIPTION_EXPIRED:  (companyId: number) => `subscription_expired:${companyId}`,
  NEW_COMPANY:           "new_company_registered",
  IP_BLOCKED:            (ip: string) => `ip_blocked:${ip}`,
} as const;

class AlertManager {
  private state = new Map<string, AlertState>();

  /**
   * يتحقق هل يجب إرسال هذا التنبيه الآن.
   * يُعيد true فقط إذا لم يُرسل من قبل، أو مضى عليه أكثر من cooldownHours ساعة.
   */
  shouldSend(alertType: string, cooldownHours: number): boolean {
    const entry = this.state.get(alertType);
    if (!entry) return true;
    const elapsedMs   = Date.now() - entry.lastSentAt;
    const cooldownMs  = cooldownHours * 60 * 60 * 1000;
    return elapsedMs > cooldownMs;
  }

  /**
   * يسجّل وقت إرسال التنبيه في الذاكرة.
   */
  markSent(alertType: string): void {
    this.state.set(alertType, { lastSentAt: Date.now(), resolved: false });
  }

  /**
   * يُرسل رسالة حل مرة واحدة فقط إذا كان التنبيه قد أُرسل مسبقاً،
   * ثم يحذفه من السجل حتى لا يُرسل مجدداً.
   */
  async markResolved(alertType: string, resolvedMessage: string): Promise<void> {
    const entry = this.state.get(alertType);
    if (!entry) return;
    try {
      await sendTelegramAlert(`✅ تم الحل: ${resolvedMessage}`);
    } catch (err) {
      logger.warn({ err, alertType }, "telegram-alert-manager: failed to send resolution message");
    }
    this.state.delete(alertType);
  }

  /**
   * المدخل الرئيسي — يتحقق من cooldown ثم يُرسل التنبيه إذا كان مسموحاً به.
   * إذا كان مقيّداً: يسجّل في الـ log فقط ولا يرمي خطأ.
   *
   * once: true → cooldownHours = 0 (يُرسل في كل مرة بلا تحقق)
   */
  async send(options: {
    type: string;
    message: string;
    cooldownHours?: number;
    once?: boolean;
  }): Promise<void> {
    const { type, message, once = false } = options;
    const cooldownHours = once ? 0 : (options.cooldownHours ?? 4);

    if (!once && !this.shouldSend(type, cooldownHours)) {
      logger.debug({ alertType: type, cooldownHours }, "telegram-alert-manager: alert throttled");
      return;
    }

    try {
      await sendTelegramAlert(message);
      this.markSent(type);
    } catch (err) {
      logger.warn({ err, alertType: type }, "telegram-alert-manager: failed to send alert");
    }
  }
}

/** Singleton — استخدم هذا في كل مكان بدل استدعاء sendTelegramAlert مباشرة */
export const alertManager = new AlertManager();
