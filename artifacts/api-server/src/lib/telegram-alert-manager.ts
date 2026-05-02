/**
 * telegram-alert-manager.ts
 *
 * مدير تنبيهات Telegram الذكي:
 * - يمنع تكرار الإرسال بـ cooldown مستمر في قاعدة البيانات (يبقى بعد restart)
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

/* ── Default config ─────────────────────────────────────────────── */

export const DEFAULT_TELEGRAM_CONFIG: TelegramAlertConfig = {
  enabled: true,
  alerts: {
    server_start:           { enabled: true,  cooldownHours: 1,  label: "بدء تشغيل السيرفر" },
    server_slow:            { enabled: true,  cooldownHours: 4,  label: "بطء الاستجابة" },
    server_high_memory:     { enabled: true,  cooldownHours: 4,  label: "ذاكرة مرتفعة" },
    db_slow:                { enabled: true,  cooldownHours: 4,  label: "قاعدة بيانات بطيئة" },
    backup_failed:          { enabled: true,  cooldownHours: 4,  label: "فشل النسخ الاحتياطي" },
    backup_success:         { enabled: false, cooldownHours: 0,  label: "نجاح النسخ الاحتياطي" },
    brute_force:            { enabled: true,  cooldownHours: 4,  label: "محاولات اختراق (IP)" },
    subscription_expiring:  { enabled: true,  cooldownHours: 4,  label: "اشتراك على وشك الانتهاء" },
    subscription_expired:   { enabled: true,  cooldownHours: 0,  label: "اشتراك منتهي" },
    new_company_registered: { enabled: true,  cooldownHours: 0,  label: "شركة جديدة" },
    ip_blocked:             { enabled: true,  cooldownHours: 4,  label: "حظر IP" },
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
  return alertType.split(":")[0];
}

/* ── Persistent state key in super_settings ─────────────────────── */
const PERSISTENT_STATE_KEY = "tg_alert_last_sent";

/* ── AlertManager class ─────────────────────────────────────────── */

class AlertManager {
  /** حالة الـ cooldown في الذاكرة: alertType → lastSentAt (ms timestamp) */
  private memState = new Map<string, number>();

  /** حالة الـ cooldown المقروءة من DB عند الـ startup */
  private persistentStateLoaded = false;

  private config: TelegramAlertConfig | null = null;
  private configLoadedAt = 0;
  private readonly CONFIG_TTL_MS = 5 * 60 * 1000;

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

  /** دمج الإعدادات المحفوظة مع الافتراضية */
  private mergeWithDefaults(saved: Partial<TelegramAlertConfig>): TelegramAlertConfig {
    const merged: TelegramAlertConfig = {
      enabled: saved.enabled ?? DEFAULT_TELEGRAM_CONFIG.enabled,
      alerts:  { ...DEFAULT_TELEGRAM_CONFIG.alerts },
    };
    if (saved.alerts) {
      for (const [key, rule] of Object.entries(saved.alerts)) {
        // eslint-disable-next-line security/detect-object-injection
        merged.alerts[key] = { ...merged.alerts[key], ...rule };
      }
    }
    return merged;
  }

  /** إبطال الـ config cache فورًا */
  invalidateConfigCache(): void {
    this.config = null;
    this.configLoadedAt = 0;
  }

  /* ── Persistent state: load from DB once on first use ── */
  private async loadPersistentState(): Promise<void> {
    if (this.persistentStateLoaded) return;
    this.persistentStateLoaded = true;

    try {
      const { db, superSettingsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");

      const [row] = await db
        .select()
        .from(superSettingsTable)
        .where(eq(superSettingsTable.key, PERSISTENT_STATE_KEY));

      if (row?.value) {
        const stored = JSON.parse(row.value) as Record<string, number>;
        for (const [k, v] of Object.entries(stored)) {
          if (typeof v === "number") this.memState.set(k, v);
        }
        logger.debug({ count: this.memState.size }, "telegram-alert-manager: loaded persistent cooldown state");
      }
    } catch (err) {
      logger.warn({ err }, "telegram-alert-manager: could not load persistent state — starting fresh");
    }
  }

  /* ── Persist current state to DB (fire-and-forget) ── */
  private persistState(): void {
    const snapshot: Record<string, number> = {};
    for (const [k, v] of this.memState) snapshot[k] = v;

    void (async () => {
      try {
        const { db, superSettingsTable } = await import("@workspace/db");
        const value = JSON.stringify(snapshot);
        await db
          .insert(superSettingsTable)
          .values({ key: PERSISTENT_STATE_KEY, value })
          .onConflictDoUpdate({
            target: superSettingsTable.key,
            set:    { value, updated_at: new Date() },
          });
      } catch (err) {
        logger.warn({ err }, "telegram-alert-manager: failed to persist cooldown state");
      }
    })();
  }

  /* ── Core throttle check ── */
  private shouldSend(alertType: string, cooldownHours: number): boolean {
    if (cooldownHours <= 0) return true;
    const lastSentAt = this.memState.get(alertType);
    if (!lastSentAt) return true;
    const elapsedMs  = Date.now() - lastSentAt;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    return elapsedMs >= cooldownMs;
  }

  private markSent(alertType: string): void {
    this.memState.set(alertType, Date.now());
    this.persistState();
  }

  async markResolved(alertType: string, resolvedMessage: string): Promise<void> {
    if (!this.memState.has(alertType)) return;
    try {
      await sendTelegramAlert(`✅ تم الحل: ${resolvedMessage}`);
    } catch (err) {
      logger.warn({ err, alertType }, "telegram-alert-manager: failed to send resolution message");
    }
    this.memState.delete(alertType);
    this.persistState();
  }

  /* ── Main send method ── */
  async send(options: {
    type:           string;
    message:        string;
    cooldownHours?: number;
  }): Promise<void> {
    const { type, message } = options;

    // تحميل الحالة المستمرة من DB (مرة واحدة فقط عند أول استدعاء)
    await this.loadPersistentState();

    // تحقق من إعدادات DB
    const cfg = await this.loadConfig();

    if (!cfg.enabled) {
      logger.debug({ alertType: type }, "telegram-alert-manager: all alerts disabled");
      return;
    }

    const base = baseType(type);
    // eslint-disable-next-line security/detect-object-injection
    const rule = cfg.alerts[base];
    if (rule && !rule.enabled) {
      logger.debug({ alertType: type }, "telegram-alert-manager: alert type disabled");
      return;
    }

    // cooldown: DB rule يتقدم على الـ code default
    const cooldownHours = rule?.cooldownHours ?? options.cooldownHours ?? 4;

    if (!this.shouldSend(type, cooldownHours)) {
      const lastSentAt = this.memState.get(type)!;
      const remainingMs = (cooldownHours * 3600_000) - (Date.now() - lastSentAt);
      const remainingMin = Math.ceil(remainingMs / 60_000);
      logger.debug({ alertType: type, remainingMin }, "telegram-alert-manager: alert throttled");
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

/** Singleton */
export const alertManager = new AlertManager();
