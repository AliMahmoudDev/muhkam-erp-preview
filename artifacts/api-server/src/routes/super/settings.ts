/**
 * /api/super/settings — System configuration routes.
 * Covers backups, Telegram bot credentials/settings, and support contact info.
 */
import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, superSettingsTable } from '@workspace/db';
import fs from 'fs';
import path from 'path';
import { authenticate, requireRole } from '../../middleware/auth';
import { wrap } from '../../lib/async-handler';
import { createDatabaseBackup, listBackups } from '../../lib/db-backup';
import { writeAuditLog } from '../../lib/audit-log';
import { alertManager, DEFAULT_TELEGRAM_CONFIG } from '../../lib/telegram-alert-manager';
import type { TelegramAlertConfig } from '../../lib/telegram-alert-manager';
import { checkBotStatus, getTgConfigStatus, invalidateTgCredsCache } from '../../lib/telegram';
import { logger } from '../../lib/logger';

const router = Router();
const superOnly = [authenticate, requireRole('super_admin')];

/* ── POST /super/backup/create — trigger pg_dump backup ── */
router.post(
  '/super/backup/create',
  ...superOnly,
  wrap(async (_req, res) => {
    const filepath = await createDatabaseBackup();
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const stats = fs.statSync(filepath);
    res.json({
      success: true,
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      filename: filepath.split('/').pop(),
      size_mb: (stats.size / 1024 / 1024).toFixed(2),
      created_at: new Date().toISOString(),
    });
  })
);

/* ── GET /super/backup/list — list available backups ── */
router.get(
  '/super/backup/list',
  ...superOnly,
  wrap(async (_req, res) => {
    const backups = listBackups();
    res.json({ backups, total: backups.length });
  })
);

/* ── GET /super/encryption-status — check if backup encryption is configured (no key exposed) ── */
router.get(
  '/super/encryption-status',
  ...superOnly,
  wrap(async (_req, res) => {
    const key = process.env.BACKUP_ENCRYPTION_KEY ?? null;
    res.json({ enabled: !!key });
  })
);

/* ── GET /super/encryption-key — return backup encryption key (super admin only) ── */
router.get(
  '/super/encryption-key',
  ...superOnly,
  wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const key = process.env.BACKUP_ENCRYPTION_KEY ?? null;
    await writeAuditLog({
      action: 'BACKUP_ENCRYPTION_KEY_VIEWED',
      record_type: 'system',
      record_id: 0,
      user: { id: req.user?.id, username: req.user?.username },
      company_id: null,
      note: key
        ? 'Super admin requested backup encryption key display/export'
        : 'Super admin requested backup encryption key, but it is not configured',
    });

    if (!key) {
      res.json({ enabled: false, key: null });
      return;
    }
    res.json({ enabled: true, length: key.length, key });
  })
);

/* ── GET /super/backup/download/:filename — stream a backup file ── */
router.get(
  '/super/backup/download/:filename',
  ...superOnly,
  wrap(async (req, res) => {
    const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'db-backups');
    const raw = req.params.filename as string;

    const filename = path.basename(raw);
    if (!filename || filename !== raw) {
      res.status(400).json({ error: 'اسم ملف غير صالح' });
      return;
    }

    const filepath = path.join(BACKUP_DIR, filename);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(filepath)) {
      res.status(404).json({ error: 'الملف غير موجود' });
      return;
    }

    const isEnc = filename.endsWith('.enc');
    res.setHeader('Content-Type', isEnc ? 'application/octet-stream' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    res.setHeader('Content-Length', fs.statSync(filepath).size);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.createReadStream(filepath).pipe(res);
  })
);

/* ══════════════════════════════════════════════════════════════════════════
   Telegram Alert Settings
   GET  /super/telegram-settings  → returns current config (merged w/ defaults)
   PUT  /super/telegram-settings  → saves config to DB + invalidates cache
══════════════════════════════════════════════════════════════════════════ */

router.get(
  '/super/telegram-settings',
  ...superOnly,
  wrap(async (_req, res) => {
    let row: { value: string | null } | undefined;
    try {
      [row] = await db
        .select()
        .from(superSettingsTable)
        .where(eq(superSettingsTable.key, 'telegram_alert_config'));
    } catch (err) {
      logger.warn({ err }, '[super/telegram-settings] DB read failed — returning defaults');
      res.json({ ...DEFAULT_TELEGRAM_CONFIG });
      return;
    }

    let config: TelegramAlertConfig = { ...DEFAULT_TELEGRAM_CONFIG };

    if (row?.value) {
      try {
        const saved = JSON.parse(row.value) as Partial<TelegramAlertConfig>;
        config = {
          enabled: saved.enabled ?? DEFAULT_TELEGRAM_CONFIG.enabled,
          alerts: { ...DEFAULT_TELEGRAM_CONFIG.alerts },
        };
        if (saved.alerts && typeof saved.alerts === 'object') {
          for (const [key, rule] of Object.entries(saved.alerts)) {
            // eslint-disable-next-line security/detect-object-injection
            if (config.alerts[key] && rule && typeof rule === 'object') {
              // eslint-disable-next-line security/detect-object-injection
              config.alerts[key] = { ...config.alerts[key], ...rule };
            }
          }
        }
      } catch (err) {
        logger.warn(
          { err, rawValue: row.value?.slice(0, 200) },
          '[super/telegram-settings] corrupted JSON in DB — returning defaults'
        );
        config = { ...DEFAULT_TELEGRAM_CONFIG };
      }
    }

    res.json(config);
  })
);

router.put(
  '/super/telegram-settings',
  ...superOnly,
  wrap(async (req, res) => {
    const body = req.body as Partial<TelegramAlertConfig>;

    if (typeof body !== 'object' || body === null) {
      res.status(400).json({ error: 'Invalid body' });
      return;
    }

    const toSave: TelegramAlertConfig = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      alerts: {},
    };

    if (body.alerts && typeof body.alerts === 'object') {
      for (const [key, rule] of Object.entries(body.alerts)) {
        if (typeof rule === 'object' && rule !== null) {
          // eslint-disable-next-line security/detect-object-injection
          toSave.alerts[key] = {
            enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
            cooldownHours: typeof rule.cooldownHours === 'number' ? rule.cooldownHours : 4,
            label: rule.label ?? key,
          };
        }
      }
    }

    const value = JSON.stringify(toSave);

    await db
      .insert(superSettingsTable)
      .values({ key: 'telegram_alert_config', value })
      .onConflictDoUpdate({
        target: superSettingsTable.key,
        set: { value, updated_at: new Date() },
      });

    alertManager.invalidateConfigCache();

    await writeAuditLog({
      action: 'TELEGRAM_SETTINGS_UPDATED',
      record_type: 'system',
      record_id: 0,
      new_value: { enabled: toSave.enabled, alertCount: Object.keys(toSave.alerts).length },
      user: req.user,
      company_id: null,
    });

    res.json({ success: true, config: toSave });
  })
);

/* ══════════════════════════════════════════════════════════════════════════
   Telegram Bot Credentials
   GET  /super/telegram-config  → returns bot status + masked token
   PUT  /super/telegram-config  → saves bot_token + chat_id to DB
   POST /super/telegram-test    → sends a test message
══════════════════════════════════════════════════════════════════════════ */

router.get(
  '/super/telegram-config',
  ...superOnly,
  wrap(async (_req, res) => {
    const [status, config] = await Promise.all([checkBotStatus(), getTgConfigStatus()]);
    res.json({ ...status, ...config });
  })
);

router.put(
  '/super/telegram-config',
  ...superOnly,
  wrap(async (req, res) => {
    const { bot_token, chat_id } = req.body as { bot_token?: string; chat_id?: string };

    if (!bot_token || !chat_id) {
      res.status(400).json({ error: 'bot_token و chat_id مطلوبان' });
      return;
    }

    const trimToken = bot_token.trim();
    const trimChatId = chat_id.trim();

    if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(trimToken)) {
      res.status(400).json({ error: 'Bot Token غير صحيح — يجب أن يكون بصيغة 123456:ABC...' });
      return;
    }

    for (const [key, value] of [
      ['tg_bot_token', trimToken],
      ['tg_chat_id', trimChatId],
    ] as [string, string][]) {
      await db
        .insert(superSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({
          target: superSettingsTable.key,
          set: { value, updated_at: new Date() },
        });
    }

    invalidateTgCredsCache();

    const status = await checkBotStatus();

    await writeAuditLog({
      action: 'TELEGRAM_SETTINGS_UPDATED',
      record_type: 'system',
      record_id: 0,
      new_value: { action: 'credentials_updated', connected: status.connected },
      user: req.user,
      company_id: null,
    });

    res.json({ success: true, ...status });
  })
);

router.post(
  '/super/telegram-test',
  ...superOnly,
  wrap(async (req, res) => {
    const { message } = req.body as { message?: string };

    const status = await checkBotStatus();
    if (!status.connected) {
      res.status(400).json({ success: false, error: status.error ?? 'البوت غير متصل' });
      return;
    }

    const testMsg =
      message?.trim() ||
      `🧪 *اختبار تنبيه MUHKAM ERP*\n\n✅ البوت يعمل بشكل صحيح\n🕐 ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;

    const { sendTelegramAlert: send } = await import('../../lib/telegram');
    await send(testMsg);

    res.json({ success: true, message: 'تم الإرسال بنجاح' });
  })
);

/* ══════════════════════════════════════════════════════════════════
   GLOBAL SUPPORT SETTINGS — GET & PUT (stored in super_settings table)
   ══════════════════════════════════════════════════════════════════ */

router.get(
  '/super/support-settings',
  ...superOnly,
  wrap(async (_req, res) => {
    const rows = await db
      .select()
      .from(superSettingsTable)
      .where(sql`${superSettingsTable.key} IN ('support_whatsapp','support_email')`);
    const result: Record<string, string> = {};
    for (const r of rows) result[r.key] = r.value ?? '';
    res.json(result);
  })
);

router.put(
  '/super/support-settings',
  ...superOnly,
  wrap(async (req, res) => {
    const { support_whatsapp, support_email } = req.body as {
      support_whatsapp?: string;
      support_email?: string;
    };

    const upsert = async (key: string, value: string) => {
      await db
        .insert(superSettingsTable)
        .values({ key, value, updated_at: new Date() })
        .onConflictDoUpdate({
          target: superSettingsTable.key,
          set: { value, updated_at: new Date() },
        });
    };

    if (support_whatsapp !== undefined) await upsert('support_whatsapp', support_whatsapp.trim());
    if (support_email !== undefined) await upsert('support_email', support_email.trim());

    void writeAuditLog({
      action: 'SUPPORT_SETTINGS_UPDATED',
      record_type: 'system',
      record_id: 0,
      new_value: { support_whatsapp, support_email },
      user: req.user,
      company_id: null,
      note: 'تحديث إعدادات التواصل للدعم',
    });

    res.json({ success: true });
  })
);

export default router;
