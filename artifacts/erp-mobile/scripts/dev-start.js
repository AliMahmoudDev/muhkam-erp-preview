#!/usr/bin/env node

/**
 * Dev startup script for Replit.
 *
 * Replit's workflow health check only works for specific "supported" ports
 * (3000, 3001, 3002, 3003, 4200, 5000, 5173, 6000, 6800, 8000, 8008, 8080,
 * 8099, 9000). Port 20384 (the Expo artifact's port) is NOT in this list, so
 * restart_workflow always fails for the artifact workflow.
 *
 * Workaround:
 *  1. Start Metro on METRO_PORT (HEALTH_PORT + 1, e.g. 8100 when HEALTH_PORT=8099).
 *  2. Wait until Metro is actually serving HTTP on METRO_PORT.
 *  3. Open IPv4 proxy on 0.0.0.0:HEALTH_PORT (e.g. 8099) → Metro.
 *     This is a SUPPORTED port → Replit's health check succeeds.
 *  4. Open a SECOND IPv4 proxy on 0.0.0.0:20384 → Metro.
 *     This is the Expo canvas-iframe port routed via *.expo.riker.replit.dev.
 */

const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

// Health-check port (must be in Replit's supported port list)
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "8099", 10);
// Canvas iframe port (the fixed Expo proxy port, always 20384)
const CANVAS_PORT = 20384;
// Metro runs on a private port not used for health checks
const METRO_PORT = HEALTH_PORT + 1;

const env = { ...process.env, PORT: String(METRO_PORT) };

console.log(
  `[dev-start] Health port: ${HEALTH_PORT}, Canvas port: ${CANVAS_PORT}, Metro port: ${METRO_PORT}`
);

// ── 1. Start Metro/Expo ────────────────────────────────────────────────────
const expo = spawn(
  "pnpm",
  ["exec", "expo", "start", "--port", String(METRO_PORT)],
  { stdio: "inherit", env, cwd: __dirname + "/.." }
);

expo.on("error", (err) => {
  console.error("[dev-start] Expo process error:", err);
  process.exit(1);
});
expo.on("exit", (code) => {
  console.log("[dev-start] Expo exited with code", code);
  process.exit(code ?? 0);
});

// ── 2. Poll until Metro is serving HTTP ────────────────────────────────────
function waitForMetro(cb, attempt) {
  attempt = attempt || 1;
  const req = http.get(
    { hostname: "127.0.0.1", port: METRO_PORT, path: "/", timeout: 2000 },
    (res) => {
      res.resume();
      console.log(
        `[dev-start] Metro ready on 127.0.0.1:${METRO_PORT} (HTTP ${res.statusCode})`
      );
      cb();
    }
  );
  req.on("error", () => {
    if (attempt % 10 === 0) {
      console.log(
        `[dev-start] Waiting for Metro on port ${METRO_PORT}… (attempt ${attempt})`
      );
    }
    setTimeout(() => waitForMetro(cb, attempt + 1), 1000);
  });
  req.end();
}

// ── 3 & 4. Open IPv4 proxies once Metro is ready ──────────────────────────
function createProxy(listenPort, targetPort) {
  const proxy = net.createServer({ allowHalfOpen: false }, (client) => {
    const target = net.createConnection(
      { host: "127.0.0.1", port: targetPort, noDelay: true },
      () => {
        client.pipe(target);
        target.pipe(client);
      }
    );
    const cleanup = () => {
      client.destroy();
      target.destroy();
    };
    client.on("error", cleanup);
    target.on("error", cleanup);
    client.on("close", cleanup);
    target.on("close", cleanup);
  });

  proxy.listen(listenPort, "0.0.0.0", () => {
    console.log(
      `[dev-start] Proxy listening on 0.0.0.0:${listenPort} → 127.0.0.1:${targetPort}`
    );
  });

  proxy.on("error", (err) =>
    console.error(`[dev-start] Proxy error on ${listenPort}:`, err.message)
  );

  return proxy;
}

waitForMetro(() => {
  createProxy(HEALTH_PORT, METRO_PORT);
  createProxy(CANVAS_PORT, METRO_PORT);
});

// ── Propagate SIGTERM/SIGINT to Metro ─────────────────────────────────────
["SIGTERM", "SIGINT"].forEach((sig) => {
  process.on(sig, () => {
    try {
      expo.kill("SIGKILL");
    } catch (_) {}
    process.exit(0);
  });
});
