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
