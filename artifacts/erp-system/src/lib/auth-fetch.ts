/**
 * auth-fetch.ts — مغلّف fetch مركزي مع دعم CSRF تلقائي + تجديد الجلسة عند 401
 *
 * يقرأ كوكي csrf_token (غير httpOnly) ويُرسله في ترويسة X-CSRF-Token
 * تلقائياً مع كل طلب POST/PUT/PATCH/DELETE.
 *
 * عند استلام HTTP 401 (انتهاء رمز الوصول):
 *   1. يستدعي POST /api/auth/refresh مرة واحدة لتجديد الرمز
 *   2. إذا نجح التجديد → يُعيد الطلب الأصلي مرة واحدة
 *   3. إذا فشل التجديد → يُطلق حدث session:expired ويُرجع الاستجابة الأصلية
 *   4. يمنع تكرار طلبات التجديد المتزامنة (stampede prevention)
 */

/** اسم كوكي CSRF الذي يضبطه الخادم */
const CSRF_COOKIE_NAME = 'csrf_token';

/** اسم الترويسة المطلوبة من الخادم */
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/** الطرق التي تحتاج رمز CSRF */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** المسار الذي لا يجب إعادة محاولة التجديد له (لمنع الحلقة اللانهائية) */
const REFRESH_PATH = '/api/auth/refresh';

/**
 * يقرأ قيمة كوكي بالاسم من document.cookie.
 * يُرجع undefined إذا لم يُوجد.
 */
function getCookie(name: string): string | undefined {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : undefined;
}

/* ── Refresh stampede prevention ──────────────────────────────────
   يُخزَّن وعد التجديد الجاري حتى لا يُرسل أكثر من طلب تجديد واحد
   عند استلام عدة 401 بشكل متزامن. جميع الطلبات المعلّقة تنتظر نفس الوعد. */
let _refreshPromise: Promise<boolean> | null = null;

/**
 * يُنفّذ طلب تجديد الجلسة مرة واحدة.
 * يُرجع true إذا نجح التجديد، false إذا فشل.
 */
async function doRefresh(): Promise<boolean> {
  try {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
    const res = await fetch(REFRESH_PATH, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * يُحاول تجديد الجلسة مع منع التكرار المتزامن.
 * إذا كان هناك طلب تجديد قيد التنفيذ، يُنتظر نتيجته بدلاً من إرسال طلب جديد.
 */
function refreshSession(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string> | undefined),
  };

  /* ── إرفاق رمز CSRF تلقائياً للطلبات المتغيّرة ──────────────── */
  const method = (init.method ?? 'GET').toUpperCase();
  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  const res = await fetch(url, { ...init, headers, credentials: 'include' });

  /* ── Auto-refresh on 401 ────────────────────────────────────────
     إذا انتهت صلاحية رمز الوصول (401) وليس الطلب نفسه هو طلب التجديد:
     - نحاول تجديد الجلسة مرة واحدة
     - إذا نجح → نعيد الطلب الأصلي مرة واحدة
     - إذا فشل → نُطلق حدث session:expired ونُرجع الاستجابة الأصلية */
  if (res.status === 401 && !url.endsWith(REFRESH_PATH) && !url.includes(REFRESH_PATH)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      /* إعادة بناء ترويسات CSRF — قد يكون الكوكي تجدد بعد الـ refresh */
      const retryHeaders: Record<string, string> = {
        ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers as Record<string, string> | undefined),
      };
      if (STATE_CHANGING_METHODS.has(method)) {
        const freshCsrf = getCookie(CSRF_COOKIE_NAME);
        if (freshCsrf) {
          retryHeaders[CSRF_HEADER_NAME] = freshCsrf;
        }
      }
      return fetch(url, { ...init, headers: retryHeaders, credentials: 'include' });
    }
    /* فشل التجديد — الجلسة انتهت فعلاً */
    window.dispatchEvent(new CustomEvent('session:expired'));
    return res;
  }

  /* ── Subscription expired guard ─────────────────────────────────
     When the server returns 403 with a subscription-related message,
     fire a global DOM event so the auth context can intercept it.  */
  if (res.status === 403) {
    const clone = res.clone();
    clone
      .json()
      .then((body: { error?: string; code?: string }) => {
        if (
          typeof body?.error === 'string' &&
          (body.error.includes('الاشتراك') || body.error.includes('subscription'))
        ) {
          window.dispatchEvent(new CustomEvent('subscription:expired'));
        }
      })
      .catch(() => {});
  }

  return res;
}
