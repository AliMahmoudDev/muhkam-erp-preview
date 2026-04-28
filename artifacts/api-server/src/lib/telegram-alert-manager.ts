/**
 * telegram-alert-manager.ts
 *
 * مدير تنبيهات Telegram الذكي:
 * - يمنع تكرار الإرسال بـ cooldown داخلي
 * - يقرأ إعدادات التفعيل/الإيقاف من قاعدة البيانات (cache 5 دقائق)
 * - يتيح للسوبر أدمن التحكم الكامل في كل نوع تنبيه
 */

import { sendTelegramAlert } from "./telegram";
import { logger }            from "./logger";

/* ── Types ──────────────────────────────────────────────────────── */

export interface TelegramAlertRule {
  enabled:      boolean;
  cooldownHours: number;
  label:        string;
}

export interface TelegramAlertConfig {
  enabled: boolean;
  alerts:  Record<string, TelegramAlertRule>;
}

interface AlertState {
  lastSentAt: number;
  resolved:   boolean;
}

/* ── Default config ─────────────────────────────────────────────── */

export const DEFAULT_TELEGRAM_CONFIG: TelegramAlertConfig = {
  enabled: true,
  alerts: {
    server_start:           { enabled: true,  cooldownHours: 0, label: "بدء تشغيل السيرفر" },
    server_slow:            { enabled: true,  cooldownHours: 4, label: "بطء الاستجابة" },
    server_high_memory:     { enabled: true,  cooldownHours: 4, label: "ذاكرة مرتفعة" },
    db_slow:                { enabled: true,  cooldownHours: 4, label: "قاعدة بيانات بطيئة" },
    backup_failed:          { enabled: true,  cooldownHours: 4, label: "فشل النسخ الاحتياطي" },
    backup_success:         { enabled: false, cooldownHours: 0, label: "نجاح النسخ الاحتياطي" },
    brute_force:            { enabled: true,  cooldownHours: 4, label: "محاولات اختراق (IP)" },
    subscription_expiring:  { enabled: true,  cooldownHours: 4, label: "اشتراك على وشك الانتهاء" },
    subscription_expired:   { enabled: true,  cooldownHours: 0, label: "اشتراك منتهي" },
    new_company_registered: { enabled: true,  cooldownHours: 0, label: "شركة جديدة" },
    ip_blocked:             { enabled: true,  cooldownHours: 4, label: "حظر IP" },
  },
};

/** ثوابت أنواع التنبيهات — مرجع موحّد يُستخدم عبر كامل التطبيق */
export const ALERT_TYPES = {
  SERVER_START:          "server_start",
  SERVER_SLOW:           "server_slow",
  SERVER_HIGH_MEMORY:    "server_high_memory",
  DB_SLOW:               "db_slow",
  BACKUP_FAILED:         "backup_failed",
  BACKUP_SUCCESS:        "backup_success",
  BRUTE_FORCE:           (ip: string)         => `brute_force:${ip}`,
  SUBSCRIPTION_EXPIRING: (companyId: number)  => `subscription_expiring:${companyId}`,
  SUBSCRIPTION_EXPIRED:  (companyId: number)  => `subscription_expired:${companyId}`,
  NEW_COMPANY:           "new_company_registered",
  IP_BLOCKED:            (ip: string)         => `ip_blocked:${ip}`,
} as const;

/* ── Helper: extract base type from compound key ───────────────── */
function baseType(alertType: string): string {
  // "brute_force:1.2.3.4" → "brute_force"
  return alertType.split(":")[0];
}

/* ── AlertManager class ─────────────────────────────────────────── */

class AlertManager {
  private state     = new Map<string, AlertState>();
  private config:   TelegramAlertConfig | null = null;
  private configLoadedAt = 0;
  private readonly CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /* ── Config loading from DB (lazy, cached) ── */
  private async loadConfig(): Promise<TelegramAlertConfig> {
    const now = Date.now();
    if (this.config && now - this.configLoadedAt < this.CONFIG_TTL_MS) {
      return this.config;
    }

    try {
      const { db, superSettingsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");

      const [row] = await db
        .select()
        .from(superSettingsTable)
        .where(eq(superSettingsTable.key, "telegram_alert_config"));

      if (row?.value) {
        const parsed = JSON.parse(row.value) as TelegramAlertConfig;
        this.config = this.mergeWithDefaults(parsed);
      } else {
        this.config = { ...DEFAULT_TELEGRAM_CONFIG };
      }
    } catch (err) {
      logger.warn({ err }, "telegram-alert-manager: failed to load config from DB, using defaults");
      this.config = this.config ?? { ...DEFAULT_TELEGRAM_CONFIG };
    }

    this.configLoadedAt = Date.now();
    return this.config;
  }

  /** دمج الإعدادات المحفوظة مع الافتراضية (لضمان وجود أنواع جديدة) */
  private mergeWithDefaults(saved: Partial<TelegramAlertConfig>): TelegramAlertConfig {
    const merged: TelegramAlertConfig = {
      enabled: saved.enabled ?? DEFAULT_TELEGRAM_CONFIG.enabled,
      alerts:  { ...DEFAULT_TELEGRAM_CONFIG.alerts },
    };
    if (saved.alerts) {
      for (const [key, rule] of Object.entries(saved.alerts)) {
        merged.alerts[key] = { ...merged.alerts[key], ...rule };
      }
    }
    return merged;
  }

  /** إبطال الـ cache فورًا (يُستدعى بعد حفظ الإعدادات من الـ API) */
  invalidateConfigCache(): void {
    this.config = null;
    this.configLoadedAt = 0;
  }

  /* ── Core throttle logic ── */
  private shouldSend(alertType: string, cooldownHours: number): boolean {
    const entry = this.state.get(alertType);
    if (!entry) return true;
    const elapsedMs  = Date.now() - entry.lastSentAt;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    return elapsedMs > cooldownMs;
  }

  markSent(alertType: string): void {
    this.state.set(alertType, { lastSentAt: Date.now(), resolved: false });
  }

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

  /* ── Main send method ── */
  async send(options: {
    type:           string;
    message:        string;
    cooldownHours?: number;
    once?:          boolean;
  }): Promise<void> {
    const { type, message, once = false } = options;

    // تحقق من إعدادات DB أولاً
    const cfg = await this.loadConfig();

    // المفتاح الرئيسي
    if (!cfg.enabled) {
      logger.debug({ alertType: type }, "telegram-alert-manager: all alerts disabled");
      return;
    }

    // تحقق من نوع التنبيه المحدد
    const base = baseType(type);
    const rule = cfg.alerts[base];
    if (rule && !rule.enabled) {
      logger.debug({ alertType: type }, "telegram-alert-manager: alert type disabled");
      return;
    }

    // cooldown: إعداد DB يتقدم على الـ code default
    const dbCooldown = rule?.cooldownHours;
    const cooldownHours = once ? 0 : (dbCooldown ?? options.cooldownHours ?? 4);

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
