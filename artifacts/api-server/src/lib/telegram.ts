/**
 * telegram.ts
 * أداة إرسال تنبيهات تيليجرام للمشرف العام.
 * يقرأ البيانات من قاعدة البيانات أولاً، ثم يتراجع إلى متغيرات البيئة.
 */

import { logger } from "./logger";

const TELEGRAM_API = "https://api.telegram.org";

/* ── DB credentials cache (TTL: 2 min) ─────────────────────────── */
interface TgCreds { token: string; chatId: string; }
let _cachedCreds: TgCreds | null = null;
let _cacheLoadedAt = 0;
const CREDS_TTL_MS = 2 * 60 * 1000;

export function invalidateTgCredsCache(): void {
  _cachedCreds = null;
  _cacheLoadedAt = 0;
}

async function loadCreds(): Promise<TgCreds | null> {
  const now = Date.now();
  if (_cachedCreds && now - _cacheLoadedAt < CREDS_TTL_MS) return _cachedCreds;

  try {
    const { db, superSettingsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(superSettingsTable)
      .where(inArray(superSettingsTable.key, ["tg_bot_token", "tg_chat_id"]));

    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    const token  = map["tg_bot_token"]  ?? process.env.TELEGRAM_BOT_TOKEN  ?? "";
    const chatId = map["tg_chat_id"]    ?? process.env.TELEGRAM_CHAT_ID    ?? "";

    _cachedCreds = token && chatId ? { token, chatId } : null;
  } catch {
    const token  = process.env.TELEGRAM_BOT_TOKEN  ?? "";
    const chatId = process.env.TELEGRAM_CHAT_ID    ?? "";
    _cachedCreds = token && chatId ? { token, chatId } : null;
  }

  _cacheLoadedAt = Date.now();
  return _cachedCreds;
}

/**
 * يرسل رسالة تنبيه فورية إلى المشرف العام عبر بوت تيليجرام.
 * لا تُوقف أي خطأ في تيليجرام تشغيل التطبيق.
 * @param message نص الرسالة (يدعم MarkdownV2)
 */
export async function sendTelegramAlert(message: string): Promise<void> {
  const creds = await loadCreds();
  if (!creds) {
    logger.warn("[Telegram] بيانات البوت غير مضبوطة — تم تخطي الإرسال");
    return;
  }

  try {
    const url = `${TELEGRAM_API}/bot${creds.token}/sendMessage`;
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    creds.chatId,
        text:       message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      logger.warn({ status: res.status, body }, "[Telegram] فشل الإرسال");
    }
  } catch (err) {
    logger.warn({ err }, "[Telegram] خطأ أثناء الإرسال");
  }
}

/**
 * يتحقق من صحة بيانات البوت ويُعيد معلوماته.
 * يُستخدم في endpoint حالة الاتصال.
 */
export async function checkBotStatus(): Promise<{
  connected: boolean;
  bot_username?: string;
  bot_name?: string;
  token_set: boolean;
  chat_id_set: boolean;
  error?: string;
}> {
  const creds = await loadCreds();

  if (!creds) {
    const hasToken  = !!(process.env.TELEGRAM_BOT_TOKEN);
    const hasChatId = !!(process.env.TELEGRAM_CHAT_ID);
    return {
      connected:   false,
      token_set:   hasToken,
      chat_id_set: hasChatId,
      error:       !hasToken ? "Bot Token غير مضبوط" : "Chat ID غير مضبوط",
    };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${creds.token}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { username: string; first_name: string }; description?: string };

    if (!data.ok) {
      return {
        connected:   false,
        token_set:   true,
        chat_id_set: true,
        error:       data.description ?? "Bot Token خاطئ",
      };
    }

    return {
      connected:    true,
      token_set:    true,
      chat_id_set:  true,
      bot_username: data.result?.username,
      bot_name:     data.result?.first_name,
    };
  } catch (err) {
    return {
      connected:   false,
      token_set:   true,
      chat_id_set: true,
      error:       "تعذّر الاتصال بـ Telegram API",
    };
  }
}

/**
 * يُعيد Bot Token و Chat ID المضبوطَين (مع إخفاء جزء من Token).
 */
export async function getTgConfigStatus(): Promise<{
  token_masked: string | null;
  chat_id: string | null;
  source: "db" | "env" | "none";
}> {
  try {
    const { db, superSettingsTable } = await import("@workspace/db");
    const { inArray } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(superSettingsTable)
      .where(inArray(superSettingsTable.key, ["tg_bot_token", "tg_chat_id"]));

    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    const dbToken  = map["tg_bot_token"];
    const dbChatId = map["tg_chat_id"];

    if (dbToken && dbChatId) {
      const parts = dbToken.split(":");
      const masked = parts.length >= 2
        ? `${parts[0]}:${"*".repeat(Math.max(0, parts[1].length - 4))}${parts[1].slice(-4)}`
        : `${"*".repeat(Math.max(0, dbToken.length - 4))}${dbToken.slice(-4)}`;
      return { token_masked: masked, chat_id: dbChatId, source: "db" };
    }

    const envToken  = process.env.TELEGRAM_BOT_TOKEN;
    const envChatId = process.env.TELEGRAM_CHAT_ID;

    if (envToken && envChatId) {
      const parts = envToken.split(":");
      const masked = parts.length >= 2
        ? `${parts[0]}:${"*".repeat(Math.max(0, parts[1].length - 4))}${parts[1].slice(-4)}`
        : `${"*".repeat(Math.max(0, envToken.length - 4))}${envToken.slice(-4)}`;
      return { token_masked: masked, chat_id: envChatId, source: "env" };
    }

    return { token_masked: null, chat_id: null, source: "none" };
  } catch {
    return { token_masked: null, chat_id: null, source: "none" };
  }
}
