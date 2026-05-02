/**
 * Escapes a string so it is safe to embed as text content inside an HTML document.
 * Replaces the five characters that have special meaning in HTML with their
 * named entity equivalents. Use this on every piece of user-supplied data that
 * is interpolated into a string of raw HTML before it is written to a document.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Helper لفتح نافذة الطباعة — تُستخدم من جميع دوال الطباعة في المشروع
 *
 * إذا كان الـ HTML يحتوي على <script>window.onload=()=>window.print()</script>
 * فلا داعي لتمرير delay — النافذة ستطبع تلقائياً.
 *
 * إذا لم يكن الـ HTML يحتوي على trigger داخلي، مرّر delay (مللي ثانية)
 * وسيتم استدعاء print() بعد التأخير المحدد.
 * مرّر autoClose: true إذا أردت إغلاق النافذة تلقائياً بعد الطباعة.
 */
export function openPrintWindow(
  html: string,
  options: { width?: number; height?: number; delay?: number; autoClose?: boolean } = {},
): boolean {
  const { width = 800, height = 700, delay, autoClose = false } = options;
  const w = window.open('', '_blank', `width=${width},height=${height}`);
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  if (delay !== undefined) {
    setTimeout(() => {
      w.print();
      if (autoClose) w.close();
    }, delay);
  }
  return true;
}
