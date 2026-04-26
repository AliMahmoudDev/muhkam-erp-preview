import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* Reload automatically when a dynamic-import chunk fails to load.
   This happens when a new deployment invalidates old bundle hashes
   while the user still has the old HTML cached in their browser. */
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
