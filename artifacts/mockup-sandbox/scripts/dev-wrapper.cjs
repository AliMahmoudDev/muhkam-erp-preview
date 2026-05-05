/**
 * dev-wrapper.js — Opens PORT (9000) immediately for health-check,
 * then starts Vite on VITE_PORT (9001) and proxies to it.
 * Same pattern as erp-mobile/scripts/dev-wrapper.js.
 *
 * Port layout:
 *   PORT (9000)      — HTTP server for path-router health check + Vite proxy
 *   VITE_PORT (9001) — Internal Vite dev server
 */
const http = require("http");
const net  = require("net");
const { spawn } = require("child_process");

const PORT      = parseInt(process.env.PORT || "9000", 10);
const VITE_PORT = parseInt(process.env.VITE_PORT || "9001", 10);
const BASE_PATH = process.env.BASE_PATH || "/__mockup";

let viteReady = false;

// ── HTTP server on PORT (9000) — opens immediately for health-check ───────────
const server = http.createServer((req, res) => {
  if (!viteReady) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Mockup sandbox loading...\n");
    return;
  }
  const opts = {
    hostname: "127.0.0.1", port: VITE_PORT,
    path: req.url, method: req.method,
    headers: { ...req.headers, host: `localhost:${VITE_PORT}` },
  };
  const pr = http.request(opts, (pr2) => {
    res.writeHead(pr2.statusCode, pr2.headers);
    pr2.pipe(res, { end: true });
  });
  pr.on("error", () => { if (!res.headersSent) { res.writeHead(502); res.end("Vite not ready"); } });
  req.pipe(pr, { end: true });
});

// WebSocket (Vite HMR)
server.on("upgrade", (req, socket, head) => {
  if (!viteReady) { socket.destroy(); return; }
  const t = net.connect(VITE_PORT, "127.0.0.1", () => {
    t.write(`${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n");
    if (head?.length) t.write(head);
    t.pipe(socket, { end: false }); socket.pipe(t, { end: false });
  });
  t.on("error", () => socket.destroy()); socket.on("error", () => t.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[mockup-wrapper] HTTP server on port ${PORT} — health-check ready`);
  startVite();
});
server.on("error", (err) => { console.error("[mockup-wrapper] Server error:", err.message); process.exit(1); });

// ── Start Vite ────────────────────────────────────────────────────────────────
function startVite() {
  console.log(`[mockup-wrapper] Starting Vite on internal port ${VITE_PORT}...`);
  const env = { ...process.env, PORT: String(VITE_PORT), BASE_PATH };
  const vite = spawn("pnpm", ["exec", "vite", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: process.cwd(), env,
  });

  const onData = (data) => {
    const text = data.toString();
    process.stdout.write(text);
    if (!viteReady && (text.includes("ready in") || text.includes("Local:"))) {
      viteReady = true;
      console.log("[mockup-wrapper] Vite is ready — proxying traffic");
    }
  };

  if (vite.stdout) vite.stdout.on("data", onData);
  if (vite.stderr) vite.stderr.on("data", (d) => process.stderr.write(d));
  vite.on("exit", (code) => { console.log(`[mockup-wrapper] Vite exited (${code})`); process.exit(code ?? 0); });

  const cleanup = () => { vite.kill(); process.exit(0); };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGHUP", cleanup);
}
