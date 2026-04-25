export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers, credentials: 'include' });

  /* ── Subscription expired guard ─────────────────────────────────
     When the server returns 403 with a subscription-related message,
     fire a global DOM event so the auth context can intercept it.  */
  if (res.status === 403) {
    const clone = res.clone();
    clone.json().then((body: { error?: string }) => {
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
