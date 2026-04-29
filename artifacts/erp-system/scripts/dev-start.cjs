#!/usr/bin/env node
/**
 * Dev startup for Replit ERP Frontend.
 *
 * Port 5000 is temporarily held by Replit's "Your app is starting..." placeholder.
 * It is released a few seconds after a workflow process starts.
 *
 * Strategy:
 *  1. Start Vite on port 5001 immediately.
 *  2. Wait for Vite to be serving HTTP.
 *  3. Keep trying to bind port 5000 until Replit releases it (may take 5-30s).
 *  4. Once port 5000 is bound, proxy all traffic to Vite on 5001.
 *     Replit's health check detects port 5000 → workflow is marked running.
 */

const net  = require('net');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const VITE_PORT   = 5001;
const HEALTH_PORT = 5000;
const MAX_WAIT_MS = 90_000;

// ── 1. Start Vite on port 5001 ────────────────────────────────────────────
const env = { ...process.env, PORT: String(VITE_PORT) };
const vite = spawn(
  'pnpm',
  ['--filter', '@workspace/erp-system', 'run', 'dev'],
  { stdio: 'inherit', env, cwd: path.join(__dirname, '..') }
);

vite.on('error', err => { console.error('[dev-start] Vite error:', err); process.exit(1); });
vite.on('exit',  code => { console.log('[dev-start] Vite exited:', code); process.exit(code ?? 0); });

// ── 2. Wait for Vite HTTP ─────────────────────────────────────────────────
function waitForVite(cb) {
  const started = Date.now();
  const attempt = () => {
    const req = http.get(`http://127.0.0.1:${VITE_PORT}/`, res => {
      console.log(`[dev-start] Vite ready on ${VITE_PORT} (HTTP ${res.statusCode})`);
      cb();
    });
    req.on('error', () => {
      if (Date.now() - started > MAX_WAIT_MS) { console.error('[dev-start] Timed out waiting for Vite'); process.exit(1); }
      setTimeout(attempt, 600);
    });
    req.setTimeout(900, () => { req.destroy(); setTimeout(attempt, 600); });
  };
  setTimeout(attempt, 2000);
}

// ── 3. Keep retrying until port 5000 is released ─────────────────────────
function waitForPort5000(cb) {
  const started = Date.now();
  let attempt = 0;
  const tryBind = () => {
    attempt++;
    const tester = net.createServer();
    tester.once('listening', () => {
      tester.close(() => {
        console.log(`[dev-start] Port ${HEALTH_PORT} is now available (attempt ${attempt})`);
        cb();
      });
    });
    tester.once('error', () => {
      if (attempt % 10 === 1) {
        console.log(`[dev-start] Waiting for Replit to release port ${HEALTH_PORT}...`);
      }
      if (Date.now() - started > MAX_WAIT_MS) {
        console.error(`[dev-start] Gave up waiting for port ${HEALTH_PORT}`);
        process.exit(1);
      }
      setTimeout(tryBind, 500);
    });
    tester.listen(HEALTH_PORT, '0.0.0.0');
  };
  tryBind();
}

// ── 4. Start TCP proxy on port 5000 → Vite on 5001 ───────────────────────
function startProxy() {
  const server = net.createServer(client => {
    const backend = net.connect(VITE_PORT, '127.0.0.1', () => {
      client.pipe(backend);
      backend.pipe(client);
    });
    backend.on('error', () => client.destroy());
    client.on('error',  () => backend.destroy());
  });

  server.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`[dev-start] ✓ Proxy ${HEALTH_PORT} → ${VITE_PORT} is live`);
  });

  server.on('error', err => {
    console.error(`[dev-start] Proxy error on ${HEALTH_PORT}:`, err.message);
    setTimeout(startProxy, 1000);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
waitForVite(() => {
  waitForPort5000(() => {
    startProxy();
  });
});
