/**
 * dev-wrapper.js — Opens PORT (8099) immediately for Replit path-router health-check,
 * then starts Expo Metro on METRO_PORT (8082) and proxies to it once ready.
 * Also opens a TCP proxy on CANVAS_PORT (20384) for Expo Go via expo.replit.dev.
 *
 * Port layout:
 *   PORT (8099)         — HTTP server for path-router health check + Metro proxy
 *   METRO_PORT (8082)   — Internal Metro bundler
 *   CANVAS_PORT (20384) — TCP proxy for Expo Go via expo.replit.dev
 */
const http = require("http");
const net  = require("net");
const { spawn } = require("child_process");

const PORT        = parseInt(process.env.PORT || "8099", 10);
const METRO_PORT  = parseInt(process.env.METRO_PORT || "8082", 10);
const CANVAS_PORT = 20384;

const LOADING_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>جارٍ التحميل</title>
<style>body{background:#000;color:#fff;display:flex;align-items:center;
justify-content:center;min-height:100vh;font-family:system-ui;direction:rtl}
.s{text-align:center}.sp{width:36px;height:36px;border:3px solid #333;
border-top-color:#F59E0B;border-radius:50%;animation:spin 1s linear infinite;margin:16px auto}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="s"><h2>مُحكم ERP</h2><div class="sp"></div>
<p>جارٍ تهيئة Metro Bundler...</p>
<script>setTimeout(()=>location.reload(),3000)</script>
</div></body></html>`;

let metroReady = false;

// ── HTTP server on PORT (8099) — opens immediately for health-check ───────────
const server = require("http").createServer((req, res) => {
  if (!metroReady) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(LOADING_HTML);
    return;
  }
  const opts = {
    hostname: "127.0.0.1", port: METRO_PORT,
    path: req.url, method: req.method,
    headers: { ...req.headers, host: `localhost:${METRO_PORT}` },
  };
  const pr = http.request(opts, (pr2) => {
    res.writeHead(pr2.statusCode, pr2.headers);
    pr2.pipe(res, { end: true });
  });
  pr.on("error", () => { if (!res.headersSent) { res.writeHead(502); res.end("Metro not ready"); } });
  req.pipe(pr, { end: true });
});
server.on("upgrade", (req, socket, head) => {
  if (!metroReady) { socket.destroy(); return; }
  const t = net.connect(METRO_PORT, "127.0.0.1", () => {
    t.write(`${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k,v])=>`${k}: ${v}`).join("\r\n") + "\r\n\r\n");
    if (head?.length) t.write(head);
    t.pipe(socket, { end: false }); socket.pipe(t, { end: false });
  });
  t.on("error", () => socket.destroy()); socket.on("error", () => t.destroy());
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[dev-wrapper] HTTP server on port ${PORT} — health-check ready`);
  startExpo();
});
server.on("error", (err) => { console.error("[dev-wrapper] Server error:", err.message); process.exit(1); });

// ── TCP proxy on CANVAS_PORT (20384) — opened after Metro is ready ───────────
// Replit routes expo.replit.dev → port 20384, so Expo Go connects here.
function openCanvasProxy() {
  const proxy = net.createServer({ allowHalfOpen: false }, (client) => {
    const target = net.createConnection(
      { host: "127.0.0.1", port: METRO_PORT, noDelay: true },
      () => { client.pipe(target); target.pipe(client); }
    );
    const cleanup = () => { client.destroy(); target.destroy(); };
    client.on("error", cleanup);
    target.on("error", cleanup);
    client.on("close", cleanup);
    target.on("close", cleanup);
  });

  proxy.listen(CANVAS_PORT, "0.0.0.0", () => {
    console.log(`[dev-wrapper] Expo canvas proxy on 0.0.0.0:${CANVAS_PORT} → 127.0.0.1:${METRO_PORT}`);
  });

  proxy.on("error", (err) =>
    console.error(`[dev-wrapper] Canvas proxy error on ${CANVAS_PORT}:`, err.message)
  );
}

// ── Start Metro ───────────────────────────────────────────────────────────────
function startExpo() {
  console.log(`[dev-wrapper] Starting Expo Metro on port ${METRO_PORT}...`);

  const env = { ...process.env, PORT: String(METRO_PORT) };

  const expo = spawn(
    "pnpm",
    ["exec", "expo", "start", "--localhost", "--port", String(METRO_PORT)],
    { stdio: ["ignore", "pipe", "pipe"], cwd: process.cwd(), env }
  );

  let buffer = "";
  const onData = (data) => {
    const text = data.toString();
    buffer += text;
    process.stdout.write(text);

    if (
      !metroReady &&
      (buffer.includes("Waiting on http://localhost") ||
       buffer.includes("Metro waiting on") ||
       buffer.includes("Logs for your project will appear"))
    ) {
      metroReady = true;
      console.log("[dev-wrapper] Metro is ready — proxying traffic");
      openCanvasProxy();
    }
  };

  if (expo.stdout) expo.stdout.on("data", onData);
  if (expo.stderr) expo.stderr.on("data", (d) => process.stderr.write(d));

  expo.on("exit", (code) => {
    console.log(`[dev-wrapper] Expo exited (${code})`);
    process.exit(code ?? 0);
  });

  const cleanup = () => { expo.kill(); process.exit(0); };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT",  cleanup);
  process.on("SIGHUP",  cleanup);
}

// startExpo() is called from server.listen() callback above
