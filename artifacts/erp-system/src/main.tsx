import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Sentry, sentryEnabled } from "./lib/sentry";

/* Reload automatically when a dynamic-import chunk fails to load.
   This happens when a new deployment invalidates old bundle hashes
   while the user still has the old HTML cached in their browser. */
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

const rootEl = document.getElementById("root")!;

if (sentryEnabled) {
  createRoot(rootEl).render(
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: "2rem", textAlign: "center", direction: "rtl", fontFamily: "sans-serif" }}>
          <h2>حدث خطأ غير متوقع</h2>
          <p>تم إرسال تقرير تلقائي. يُرجى تحديث الصفحة والمحاولة مجدداً.</p>
          <button onClick={() => window.location.reload()}>تحديث الصفحة</button>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  );
} else {
  createRoot(rootEl).render(<App />);
}
