/**
 * dev-wrapper.js — Opens port immediately for Replit health-check,
 * then proxies to Expo Metro dev server once it is ready.
 * Port NEVER closes — same server handles both phases.
 */
const http = require("http");
const net  = require("net");
const { spawn } = require("child_process");

const PORT       = parseInt(process.env.PORT || "20384", 10);
const METRO_PORT = 8081;

let metroReady = false;

const LOADING_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>جارٍ التحميل — مُحكم ERP</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;color:#fff;font-family:system-ui,sans-serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100vh;gap:24px;direction:rtl;padding:20px}
  .logo-wrap{width:80px;height:80px;border-radius:22px;background:#111;
    border:1px solid rgba(245,158,11,.25);display:flex;align-items:center;
    justify-content:center;font-size:40px;font-family:serif}
  h1{font-size:24px;letter-spacing:-.5px;font-weight:700}
  p{color:#8E8E93;font-size:14px;text-align:center;max-width:300px;line-height:1.6}
  .spinner{width:36px;height:36px;border:3px solid #1C1C1E;
    border-top-color:#F59E0B;border-radius:50%;
    animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .badge{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.25);
    color:#F59E0B;font-size:12px;padding:6px 16px;border-radius:20px}
</style>
</head>
<body>
  <div class="logo-wrap">م</div>
  <h1>مُحكم ERP</h1>
  <div class="badge">جارٍ تهيئة Metro Bundler...</div>
  <div class="spinner"></div>
  <p>يتم تهيئة الخادم. ستُحمَّل الصفحة تلقائياً خلال لحظات.</p>
  <script>setTimeout(()=>location.reload(),3000)</script>
</body>
</html>`;

// Single server — stays alive at all times on PORT
const server = http.createServer((req, res) => {
  if (!metroReady) {
    // Serve loading page until Metro is up
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(LOADING_HTML);
    return;
  }

  // Proxy to Metro
  const opts = {
    hostname: "127.0.0.1",
    port: METRO_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${METRO_PORT}` },
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", () => {
    res.writeHead(502);
    res.end("Metro not ready — please wait...");
  });

  req.pipe(proxyReq, { end: true });
});

// Handle WebSocket upgrades (Hot Reload / HMR)
server.on("upgrade", (req, socket, head) => {
  if (!metroReady) {
    socket.destroy();
    return;
  }
  const target = net.connect(METRO_PORT, "127.0.0.1", () => {
    target.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
      "\r\n\r\n"
    );
    if (head && head.length) target.write(head);
    target.pipe(socket, { end: false });
    socket.pipe(target, { end: false });
  });
  target.on("error", () => socket.destroy());
  socket.on("error", () => target.destroy());
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[dev-wrapper] Server listening on port ${PORT}`);
  startExpo();
});

server.on("error", (err) => {
  console.error("[dev-wrapper] Server error:", err.message);
  process.exit(1);
});

function startExpo() {
  console.log(`[dev-wrapper] Starting Expo Metro on port ${METRO_PORT}...`);

  const env = {
    ...process.env,
    PORT: String(METRO_PORT),
  };

  const expo = spawn(
    "pnpm",
    ["exec", "expo", "start", "--localhost", "--port", String(METRO_PORT)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: process.cwd(),
      env,
    }
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
