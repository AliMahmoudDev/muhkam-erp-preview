/**
 * telegram.ts
 * أداة إرسال تنبيهات تيليجرام للمشرف العام.
 * تقرأ TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID من متغيرات البيئة.
 */

const TELEGRAM_API = "https://api.telegram.org";

/**
 * يرسل رسالة تنبيه فورية إلى المشرف العام عبر بوت تيليجرام.
 * - إذا لم يكن TELEGRAM_BOT_TOKEN مضبوطاً، يتجاهل الإرسال بهدوء.
 * - لا تُوقف أي خطأ في تيليجرام تشغيل التطبيق.
 * @param message نص الرسالة (يدعم Markdown)
 */
export async function sendTelegramAlert(message: string): Promise<void> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    // eslint-disable-next-line no-console
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN غير مضبوط — تم تخطي الإرسال");
    return;
  }

  if (!chatId) {
    // eslint-disable-next-line no-console
    console.warn("[Telegram] TELEGRAM_CHAT_ID غير مضبوط — تم تخطي الإرسال");
    return;
  }

  try {
    const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       message,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      // eslint-disable-next-line no-console
      console.warn(`[Telegram] فشل الإرسال — ${res.status}: ${body}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Telegram] خطأ أثناء الإرسال:", err);
  }
}
