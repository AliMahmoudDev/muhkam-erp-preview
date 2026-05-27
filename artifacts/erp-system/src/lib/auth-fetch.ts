/**
 * auth-fetch.ts — مغلّف fetch مركزي مع دعم CSRF تلقائي
 *
 * يقرأ كوكي csrf_token (غير httpOnly) ويُرسله في ترويسة X-CSRF-Token
 * تلقائياً مع كل طلب POST/PUT/PATCH/DELETE.
 */

/** اسم كوكي CSRF الذي يضبطه الخادم */
const CSRF_COOKIE_NAME = "csrf_token";

/** اسم الترويسة المطلوبة من الخادم */
const CSRF_HEADER_NAME = "X-CSRF-Token";

/** الطرق التي تحتاج رمز CSRF */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * يقرأ قيمة كوكي بالاسم من document.cookie.
 * يُرجع undefined إذا لم يُوجد.
 */
function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] ?? "") : undefined;
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  /* ── إرفاق رمز CSRF تلقائياً للطلبات المتغيّرة ──────────────── */
  const method = (init.method ?? "GET").toUpperCase();
  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  const res = await fetch(url, { ...init, headers, credentials: "include" });

  /* ── Subscription expired guard ─────────────────────────────────
     When the server returns 403 with a subscription-related message,
     fire a global DOM event so the auth context can intercept it.  */
  if (res.status === 403) {
    const clone = res.clone();
    clone.json().then((body: { error?: string; code?: string }) => {
      if (
        typeof body?.error === "string" &&
        (body.error.includes("الاشتراك") || body.error.includes("subscription"))
      ) {
        window.dispatchEvent(new CustomEvent("subscription:expired"));
      }
    }).catch(() => {});
  }

  return res;
}
